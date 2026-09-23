export type DocumentStatus = "uploaded" | "processing" | "done" | "error";
export type ExtractionMethod = "local" | "llm" | "local_llm";

export interface Document {
  id: number;
  original_filename: string;
  region: string;
  canton: string;
  layout: string | null;
  status: DocumentStatus;
  error_message: string | null;
  extraction_method: ExtractionMethod | null;
  page_count: number;
  first_page: number;
  last_page: number;
  year: number | null;
  event_count: number;
  uploaded_at: string;
  extracted_at: string | null;
}

export interface LineBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface Event {
  id: number;
  document_id: number;
  document_region: string;
  document_ausgabe: string;
  region: string | null;
  parish: string | null;
  place: string | null;
  raw_date_text: string | null;
  iso_date: string | null;
  raw_time: string | null;
  raw_event_type: string | null;
  raw_text: string | null;
  page: number;
  bbox: LineBox;
  page_width: number;
  page_height: number;
  line_boxes: LineBox[];
  category: string | null;
}

export interface MetaDocumentOption {
  id: number;
  region: string;
}

export interface Meta {
  documents: MetaDocumentOption[];
  regions: string[];
  parishes: string[];
  dates: string[];
  categories: string[];
  /** Public site only — distinct Document.canton values ("Canton"
   * filter). Optional since the live backend's /api/meta doesn't return
   * it; the admin UI never reads this field. */
  cantons?: string[];
}

export interface Mapping {
  raw_event_type: string;
  category: string | null;
  place: string | null;
  count: number;
  suggested_type: "place" | "event" | null;
  suggested_confidence: number | null;
}

export type LocationKind = "parish" | "place" | "ignore";

export interface LocationMapping {
  raw_text: string;
  kind: LocationKind | null;
  corrected_value: string | null;
  count: number;
  suggested_kind: "ignore" | null;
}

export interface LlmStatus {
  configured: boolean;
  base_url: string;
  model: string;
}

export interface LlmTestResult {
  success: boolean;
  latency_ms: number | null;
  reply: string | null;
  error: string | null;
}

export interface LocalLlmStatus {
  available: boolean;
  downloaded: boolean;
  repo_id: string;
  model_file: string;
}

export interface EventFilters {
  document_id?: number;
  region?: string;
  parish?: string;
  date?: string;
  category?: string;
  search?: string;
  today?: boolean;
  /** Public site only ("Canton" filter, per explicit mapping to
   * Document.region) — filters by document_region directly rather than
   * a single document_id. Never set by the admin UI. */
  document_region?: string;
}

export interface LineOut {
  page: number;
  column: number;
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  bold: boolean;
  white: boolean;
  predicted_header: boolean;
  /** M1's raw confidence (0-1) that this line is a parish header — null
   * for lines that never reached the model (not bold, or hard-filtered). */
  header_confidence: number | null;
  label: "parish" | "not_parish" | null;
  predicted_role: "date_heading" | "time_event" | null;
  role_label: "date_heading" | "time_event" | "other" | null;
}

export interface ParishLineLabelPatch {
  page: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  text: string;
  label: "parish" | "not_parish" | null;
}

export interface LineRoleLabelPatch {
  page: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  text: string;
  role: "date_heading" | "time_event" | "other" | null;
}

export interface EventParishLinkPatch {
  event_page: number;
  event_x0: number;
  event_y0: number;
  event_x1: number;
  event_y1: number;
  header_page: number | null;
  header_x0: number | null;
  header_y0: number | null;
  header_x1: number | null;
  header_y1: number | null;
}

export interface TrainResult {
  model: "parish" | "event_type" | "line_role";
  positive_count: number;
  negative_count: number;
}

export interface MapEvent {
  id: number;
  document_id: number;
  iso_date: string | null;
  raw_date_text: string | null;
  raw_time: string | null;
  raw_event_type: string | null;
  category: string | null;
  parish: string | null;
}

export interface MapLocation {
  place: string;
  lat: number;
  lon: number;
  events: MapEvent[];
}

export interface UnmappedPlace {
  place: string;
  count: number;
}

export interface MapLocations {
  locations: MapLocation[];
  unmapped: UnmappedPlace[];
}

export interface GeocodeSummary {
  geocoded: number;
  failed: string[];
  already_cached: number;
}

export interface Layout {
  layout_id: string;
  display_name: string;
}
