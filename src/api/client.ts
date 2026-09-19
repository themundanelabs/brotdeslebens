import type {
  Document,
  Event,
  EventFilters,
  EventParishLinkPatch,
  ExtractionMethod,
  GeocodeSummary,
  Layout,
  LineOut,
  LineRoleLabelPatch,
  LlmStatus,
  LlmTestResult,
  LocalLlmStatus,
  LocationKind,
  LocationMapping,
  MapLocations,
  Mapping,
  Meta,
  ParishLineLabelPatch,
  TrainResult,
} from "../types";
import { ApiError } from "./errors";
import { staticApi } from "./staticClient";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function toQuery(filters: EventFilters): string {
  const params = new URLSearchParams();
  if (filters.document_id != null) params.set("document_id", String(filters.document_id));
  if (filters.region) params.set("region", filters.region);
  if (filters.parish) params.set("parish", filters.parish);
  if (filters.date) params.set("date", filters.date);
  if (filters.category) params.set("category", filters.category);
  if (filters.search) params.set("search", filters.search);
  if (filters.today) params.set("today", "true");
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

const liveApi = {
  ApiError,
  apiBase: API_BASE,

  listEvents: (filters: EventFilters) => request<Event[]>(`/api/events${toQuery(filters)}`),
  getEvent: (id: number) => request<Event>(`/api/events/${id}`),
  getMeta: (filters: EventFilters) => request<Meta>(`/api/meta${toQuery(filters)}`),

  listMappings: (filter: "all" | "unmapped" = "all") =>
    request<Mapping[]>(`/api/mappings?filter=${filter}`),
  setMapping: (rawEventType: string, patch: { category: string | null; place: string | null }) =>
    request<Mapping>(`/api/mappings/${encodeURIComponent(rawEventType)}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
  bulkSetCategory: (rawEventTypes: string[], category: string | null) =>
    request<Mapping[]>("/api/mappings/bulk", {
      method: "POST",
      body: JSON.stringify({ raw_event_types: rawEventTypes, category }),
    }),
  addCategory: (name: string) =>
    request<string[]>("/api/mappings/categories", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),

  listDocuments: () => request<Document[]>("/api/documents"),
  uploadDocuments: (files: File[]) => {
    const form = new FormData();
    for (const f of files) form.append("files", f);
    return request<Document[]>("/api/documents", { method: "POST", body: form });
  },
  patchDocument: (
    id: number,
    patch: Partial<Pick<Document, "region" | "layout" | "first_page" | "last_page" | "year">>
  ) =>
    request<Document>(`/api/documents/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  listLayouts: () => request<Layout[]>("/api/layouts"),
  addLayout: (displayName: string) =>
    request<Layout>("/api/layouts", {
      method: "POST",
      body: JSON.stringify({ display_name: displayName }),
    }),
  extractDocument: (id: number, method: ExtractionMethod) =>
    request<Document>(`/api/documents/${id}/extract`, {
      method: "POST",
      body: JSON.stringify({ method }),
    }),
  deleteDocument: (id: number) => request<void>(`/api/documents/${id}`, { method: "DELETE" }),
  documentPdfUrl: (id: number) => `${API_BASE}/api/documents/${id}/pdf`,

  getLlmStatus: () => request<LlmStatus>("/api/llm/status"),
  testLlm: () => request<LlmTestResult>("/api/llm/test", { method: "POST" }),

  getLocalLlmStatus: () => request<LocalLlmStatus>("/api/llm/local-status"),
  testLocalLlm: () => request<LlmTestResult>("/api/llm/local-test", { method: "POST" }),

  listLocationMappings: () => request<LocationMapping[]>("/api/location-mappings"),
  setLocationMapping: (rawText: string, patch: { kind: LocationKind | null; corrected_value: string | null }) =>
    request<LocationMapping>(`/api/location-mappings/${encodeURIComponent(rawText)}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),

  getDocumentLines: (documentId: number, page: number) =>
    request<LineOut[]>(`/api/documents/${documentId}/lines?page=${page}`),
  setParishLineLabel: (documentId: number, patch: ParishLineLabelPatch) =>
    request<void>(`/api/documents/${documentId}/labels/parish`, {
      method: "POST",
      body: JSON.stringify(patch),
    }),
  setEventParishLink: (documentId: number, patch: EventParishLinkPatch) =>
    request<void>(`/api/documents/${documentId}/labels/link`, {
      method: "POST",
      body: JSON.stringify(patch),
    }),
  setLineRoleLabel: (documentId: number, patch: LineRoleLabelPatch) =>
    request<void>(`/api/documents/${documentId}/labels/line-role`, {
      method: "POST",
      body: JSON.stringify(patch),
    }),
  trainModel: (model: "parish" | "event_type" | "line_role", documentId: number) =>
    request<TrainResult>(`/api/train/${model}?document_id=${documentId}`, { method: "POST" }),

  getMapLocations: (filters: EventFilters) =>
    request<MapLocations>(`/api/map/locations${toQuery(filters)}`),
  geocodePlaces: () => request<GeocodeSummary>("/api/map/geocode", { method: "POST" }),
  geocodeAddress: (address: string) =>
    request<{ lat: number; lon: number }>("/api/map/geocode-address", {
      method: "POST",
      body: JSON.stringify({ address }),
    }),
};

// The shared contract both the live (this file's default) and static
// (staticClient.ts, used by the public build — see its module docstring)
// implementations satisfy. Every page imports `api` and never cares which
// one it got; admin-only methods still need to type-check even in the
// static build since the admin pages' *code* still references them
// (they're just never reached at runtime there — see App.tsx's
// build-time route gating).
export type Api = typeof liveApi;

// `VITE_DATA_MODE` is unset in every build except the public one
// (`.env.public`), so this is always `liveApi` — same object, same
// behavior, for local dev and the admin build. A plain static import
// (not dynamic) so Vite's build-time env replacement + Rollup's dead-
// code elimination can fold the unused branch away entirely per build —
// no async/module-loading behavior change for either branch.
export const api: Api = import.meta.env.VITE_DATA_MODE === "static" ? staticApi : liveApi;
