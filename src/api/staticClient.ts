/**
 * The public-build implementation of the shared `Api` contract
 * (see client.ts) — everything comes from one static `/data/events.json`
 * export (produced by `backend/scripts/export_public_data.py`, fetched
 * once and cached) instead of live HTTP calls, since the public site has
 * no backend behind it at all. Only Agenda and Map are reachable in this
 * build (see App.tsx's build-time route gating), so only `listEvents`,
 * `getEvent`, `getMeta`, `getMapLocations`, and `geocodeAddress` (a
 * direct client-side Nominatim call — see backend/app/geocoding.py for
 * the server-side equivalent this mirrors) need real implementations.
 * Every other method exists only so this object satisfies the same
 * `Api` type the admin pages' code references — they're never reached
 * at runtime in this build (those pages aren't rendered here) and just
 * reject clearly if somehow called.
 */
import type { Api } from "./client";
import { ApiError } from "./errors";
import type { Event, EventFilters, MapLocation, MapLocations, Meta, UnmappedPlace } from "../types";

// The one extra shape the export adds on top of the live `Event` type —
// present on every row in events.json, just not part of the live-API
// contract other pages type against.
interface PublicEventRow extends Event {
  map_location: string | null;
  lat: number | null;
  lon: number | null;
}

let cachedEvents: Promise<PublicEventRow[]> | null = null;

function loadEvents(): Promise<PublicEventRow[]> {
  if (!cachedEvents) {
    cachedEvents = fetch(`${import.meta.env.BASE_URL}data/events.json`).then((res) => {
      if (!res.ok) throw new ApiError(res.status, "Could not load data/events.json");
      return res.json() as Promise<PublicEventRow[]>;
    });
  }
  return cachedEvents;
}

function effectiveDate(filters: EventFilters): string | undefined {
  if (filters.today) return new Date().toISOString().slice(0, 10);
  return filters.date;
}

// Mirrors query_filters.py's build_where()/`exclude` parameter — each
// dimension's own option list must reflect every *other* active filter
// but never be narrowed by its own current value (FR-4.2).
function matches(e: PublicEventRow, filters: EventFilters, exclude: Set<string> = new Set()): boolean {
  if (filters.document_id != null && !exclude.has("document_id") && e.document_id !== filters.document_id) {
    return false;
  }
  if (filters.region && !exclude.has("region") && e.region !== filters.region) return false;
  if (filters.parish && !exclude.has("parish") && e.parish !== filters.parish) return false;
  const date = effectiveDate(filters);
  if (date && !exclude.has("date") && e.iso_date !== date) return false;
  if (filters.category && !exclude.has("category")) {
    if (filters.category === "Unmapped") {
      if (e.category) return false;
    } else if (e.category !== filters.category) {
      return false;
    }
  }
  if (filters.search && !exclude.has("search")) {
    if (!(e.raw_text ?? "").toLowerCase().includes(filters.search.toLowerCase())) return false;
  }
  return true;
}

function toEvent(row: PublicEventRow): Event {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { map_location, lat, lon, ...event } = row;
  return event;
}

async function notAvailable(action: string): Promise<never> {
  throw new ApiError(501, `${action} isn't available on the public site — this is a read-only deployment.`);
}

async function geocodeAddressDirect(address: string): Promise<{ lat: number; lon: number }> {
  // Same free OSM Nominatim endpoint backend/app/geocoding.py calls
  // server-side — there's no backend here to proxy through, so this
  // calls it directly from the browser (a single interactive lookup per
  // "Find nearest" click, well within Nominatim's usage policy for
  // light client-side use).
  const params = new URLSearchParams({ q: `${address}, Kanton Solothurn, Schweiz`, format: "json", limit: "1" });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
  if (!res.ok) throw new ApiError(res.status, "Could not reach the address lookup service");
  const results = (await res.json()) as { lat: string; lon: string }[];
  if (!results.length) throw new ApiError(404, "Could not find that address");
  return { lat: parseFloat(results[0].lat), lon: parseFloat(results[0].lon) };
}

export const staticApi: Api = {
  ApiError,
  apiBase: "",

  listEvents: async (filters) => (await loadEvents()).filter((e) => matches(e, filters)).map(toEvent),
  getEvent: async (id) => {
    const event = (await loadEvents()).find((e) => e.id === id);
    if (!event) throw new ApiError(404, "Event not found");
    return toEvent(event);
  },
  getMeta: async (filters) => {
    const events = await loadEvents();
    const distinct = <T>(values: (T | null | undefined)[]) =>
      [...new Set(values.filter((v): v is T => v != null))].sort();

    const documents = distinct(
      events.filter((e) => matches(e, filters, new Set(["document_id"]))).map((e) => e.document_id)
    ).map((id) => {
      const e = events.find((ev) => ev.document_id === id)!;
      return { id, region: e.document_region };
    });

    const meta: Meta = {
      documents,
      regions: distinct(events.filter((e) => matches(e, filters, new Set(["region"]))).map((e) => e.region)),
      parishes: distinct(events.filter((e) => matches(e, filters, new Set(["parish"]))).map((e) => e.parish)),
      dates: distinct(events.filter((e) => matches(e, filters, new Set(["date"]))).map((e) => e.iso_date)),
      categories: distinct(
        events.filter((e) => matches(e, filters, new Set(["category"]))).map((e) => e.category)
      ),
    };
    return meta;
  },
  getMapLocations: async (filters) => {
    const events = (await loadEvents()).filter((e) => matches(e, filters));
    const grouped = new Map<string, MapLocation>();
    const unmapped = new Map<string, number>();

    for (const e of events) {
      if (!e.map_location) continue;
      const mapEvent = {
        id: e.id,
        document_id: e.document_id,
        iso_date: e.iso_date,
        raw_date_text: e.raw_date_text,
        raw_time: e.raw_time,
        raw_event_type: e.raw_event_type,
        category: e.category,
        parish: e.parish,
      };
      if (e.lat != null && e.lon != null) {
        const existing = grouped.get(e.map_location);
        if (existing) {
          existing.events.push(mapEvent);
        } else {
          grouped.set(e.map_location, { place: e.map_location, lat: e.lat, lon: e.lon, events: [mapEvent] });
        }
      } else {
        unmapped.set(e.map_location, (unmapped.get(e.map_location) ?? 0) + 1);
      }
    }

    const result: MapLocations = {
      locations: [...grouped.values()],
      unmapped: [...unmapped.entries()]
        .map(([place, count]): UnmappedPlace => ({ place, count }))
        .sort((a, b) => a.place.localeCompare(b.place)),
    };
    return result;
  },
  geocodeAddress: geocodeAddressDirect,
  // Reachable from Map's "Geocode locations" button when `unmapped` is
  // non-empty — a graceful no-op rather than an error, since there's
  // nothing for a public visitor's click to meaningfully do here.
  geocodePlaces: async () => ({ geocoded: 0, failed: [], already_cached: 0 }),

  documentPdfUrl: () => "",
  listMappings: () => notAvailable("Listing mappings"),
  setMapping: () => notAvailable("Editing mappings"),
  bulkSetCategory: () => notAvailable("Bulk categorizing"),
  addCategory: () => notAvailable("Adding categories"),
  listDocuments: () => notAvailable("Listing documents"),
  uploadDocuments: () => notAvailable("Uploading documents"),
  patchDocument: () => notAvailable("Editing documents"),
  listLayouts: () => notAvailable("Listing layouts"),
  addLayout: () => notAvailable("Adding layouts"),
  extractDocument: () => notAvailable("Extracting documents"),
  deleteDocument: () => notAvailable("Deleting documents"),
  getLlmStatus: () => notAvailable("LLM status"),
  testLlm: () => notAvailable("Testing the LLM"),
  getLocalLlmStatus: () => notAvailable("Local LLM status"),
  testLocalLlm: () => notAvailable("Testing the local LLM"),
  listLocationMappings: () => notAvailable("Listing location mappings"),
  setLocationMapping: () => notAvailable("Editing location mappings"),
  getDocumentLines: () => notAvailable("Reading document lines"),
  setParishLineLabel: () => notAvailable("Labeling parish lines"),
  setEventParishLink: () => notAvailable("Linking events"),
  setLineRoleLabel: () => notAvailable("Labeling date/time lines"),
  trainModel: () => notAvailable("Training models"),
};
