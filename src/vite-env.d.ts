/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE: string;
  readonly VITE_DATA_MODE?: string;
  /** Fine-grained GitHub PAT (Contents: write, this repo only) — enables
   * real submission for the public site's feedback vote buttons. Unset
   * until the user provisions it; see src/public/lib/feedback.ts. */
  readonly VITE_FEEDBACK_GH_TOKEN?: string;
  /** Google Maps JavaScript API key, restricted to www.brotdeslebens.ch —
   * powers the public site's Map page. Unset until the user provisions it. */
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
