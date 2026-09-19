import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { api } from "../api/client";
import { FilterBar } from "../components/FilterBar";
import { PdfSnippet } from "../components/PdfSnippet";
import { usePoll } from "../hooks/usePoll";
import type { EventFilters, MapLocation } from "../types";

// A self-contained inline SVG rather than Leaflet's default marker image —
// Vite doesn't reliably resolve Leaflet's bundled marker PNG paths, so
// markers rendered with no icon at all. An inline SVG has no external
// asset to resolve.
const CHURCH_ICON = L.divIcon({
  className: "",
  html: `<svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">
    <path d="M15 0C6.716 0 0 6.716 0 15c0 10.5 15 25 15 25s15-14.5 15-25C30 6.716 23.284 0 15 0z" fill="#f97316"/>
    <g fill="white">
      <rect x="14" y="5" width="2" height="5"/>
      <rect x="12.3" y="7" width="5.4" height="1.6"/>
      <polygon points="15,9.5 8,15.5 22,15.5"/>
      <rect x="9" y="15.5" width="12" height="8.5"/>
      <rect x="13" y="19.5" width="4" height="4.5" fill="#f97316"/>
    </g>
  </svg>`,
  iconSize: [30, 40],
  iconAnchor: [15, 40],
  popupAnchor: [0, -36],
});

const YOU_ICON = L.divIcon({
  className: "",
  html: '<div style="width:16px;height:16px;border-radius:50%;background:#0ea5e9;border:2px solid white;box-shadow:0 0 0 2px #0ea5e9;"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const SOLOTHURN_CENTER: [number, number] = [47.29, 7.7];

function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const lat1 = (a[0] * Math.PI) / 180;
  const lat2 = (b[0] * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 12);
    } else {
      map.fitBounds(points, { padding: [32, 32] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(points)]);
  return null;
}

export function MapPage() {
  const [filters, setFilters] = useState<EventFilters>({});
  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);

  const [address, setAddress] = useState("");
  const [addressCoords, setAddressCoords] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeSummary, setGeocodeSummary] = useState<string | null>(null);

  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);

  const { data: meta } = usePoll(() => api.getMeta(filters), [filtersKey]);
  const { data: mapData, refetch } = usePoll(() => api.getMapLocations(filters), [filtersKey]);
  // The map-locations endpoint returns lightweight event summaries (no
  // bbox) — the full event list (same filters, already used by the
  // Agenda page) is fetched alongside it so a clicked event's bbox is
  // available for the source-page preview below.
  const { data: allEvents } = usePoll(() => api.listEvents(filters), [filtersKey]);
  const eventsById = useMemo(() => new Map((allEvents ?? []).map((e) => [e.id, e])), [allEvents]);
  const selectedEvent = selectedEventId != null ? eventsById.get(selectedEventId) ?? null : null;

  const locations = mapData?.locations ?? [];
  const unmapped = mapData?.unmapped ?? [];

  const sorted: (MapLocation & { distanceKm: number | null })[] = useMemo(() => {
    const withDistance = locations.map((loc) => ({
      ...loc,
      distanceKm: addressCoords ? haversineKm(addressCoords, [loc.lat, loc.lon]) : null,
    }));
    if (addressCoords) {
      withDistance.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
    } else {
      withDistance.sort((a, b) => a.place.localeCompare(b.place));
    }
    return withDistance;
  }, [locations, addressCoords]);

  const points: [number, number][] = useMemo(
    () => (addressCoords ? [addressCoords, ...locations.map((l): [number, number] => [l.lat, l.lon])] : locations.map((l): [number, number] => [l.lat, l.lon])),
    [locations, addressCoords]
  );

  const findNearest = async () => {
    const q = address.trim();
    if (!q) return;
    setLocating(true);
    setLocateError(null);
    try {
      const { lat, lon } = await api.geocodeAddress(q);
      setAddressCoords([lat, lon]);
    } catch {
      setLocateError("Could not find that address. Try adding more detail (street, town).");
      setAddressCoords(null);
    } finally {
      setLocating(false);
    }
  };

  const runGeocodePlaces = async () => {
    setGeocoding(true);
    setGeocodeSummary(null);
    try {
      const result = await api.geocodePlaces();
      setGeocodeSummary(
        `Geocoded ${result.geocoded} new location(s)${
          result.failed.length ? `, ${result.failed.length} not found (${result.failed.join(", ")})` : ""
        }.`
      );
      refetch();
    } finally {
      setGeocoding(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <FilterBar
        meta={meta}
        filters={filters}
        onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
        onClear={() => setFilters({})}
      />

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") findNearest();
          }}
          placeholder="Your address (street, town)…"
          className="min-w-[220px] flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
        <button
          type="button"
          disabled={locating || !address.trim()}
          onClick={findNearest}
          className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {locating ? "Locating…" : "Find nearest"}
        </button>
        {addressCoords && (
          <button
            type="button"
            onClick={() => {
              setAddressCoords(null);
              setAddress("");
            }}
            className="text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
          >
            Clear
          </button>
        )}
        {locateError && <span className="text-sm text-red-600 dark:text-red-400">{locateError}</span>}
      </div>

      {unmapped.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          <span>
            {unmapped.reduce((s, u) => s + u.count, 0)} event(s) at {unmapped.length} location(s) aren't on the
            map yet ({unmapped.map((u) => u.place).join(", ")}).
          </span>
          <button
            type="button"
            disabled={geocoding}
            onClick={runGeocodePlaces}
            className="rounded-md bg-amber-600 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
          >
            {geocoding ? "Geocoding…" : "Geocode locations"}
          </button>
          {geocodeSummary && <span className="text-xs">{geocodeSummary}</span>}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_320px]">
        <div className="h-[65vh] overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
          <MapContainer center={SOLOTHURN_CENTER} zoom={10} className="h-full w-full">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitBounds points={points} />
            {addressCoords && (
              <Marker position={addressCoords} icon={YOU_ICON}>
                <Popup>You are here</Popup>
              </Marker>
            )}
            {locations.map((loc) => (
              <Marker key={loc.place} position={[loc.lat, loc.lon]} icon={CHURCH_ICON}>
                <Popup>
                  <div className="flex flex-col gap-1 text-xs">
                    <strong>{loc.place}</strong>
                    {loc.events.map((e) => (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => setSelectedEventId(e.id)}
                        className={`rounded px-1 py-0.5 text-left hover:bg-sky-100 dark:hover:bg-sky-900/40 ${
                          selectedEventId === e.id ? "bg-sky-100 dark:bg-sky-900/40" : ""
                        }`}
                      >
                        {e.raw_date_text} {e.raw_time && `· ${e.raw_time}`} · {e.raw_event_type}
                        {e.category ? ` (${e.category})` : ""}
                      </button>
                    ))}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        <div className="flex max-h-[65vh] flex-col gap-2 overflow-y-auto">
          {sorted.length === 0 && (
            <p className="text-sm text-slate-400">No mapped events match the current filters.</p>
          )}
          {sorted.map((loc) => (
            <div
              key={loc.place}
              className="rounded-md border border-slate-200 p-2 text-sm dark:border-slate-800"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-800 dark:text-slate-100">{loc.place}</span>
                {loc.distanceKm != null && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {loc.distanceKm.toFixed(1)} km
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {loc.events.length} event{loc.events.length === 1 ? "" : "s"}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium text-slate-600 dark:text-slate-300">Preview</h2>
        <PdfSnippet documentId={selectedEvent?.document_id ?? null} event={selectedEvent} />
      </div>
    </div>
  );
}
