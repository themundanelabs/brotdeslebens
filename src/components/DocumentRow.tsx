import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { Document, ExtractionMethod, Layout } from "../types";

interface Props {
  doc: Document;
  layouts: Layout[];
  llmConfigured: boolean;
  localLlmAvailable: boolean;
  onChanged: () => void;
  onLayoutsChanged: () => void;
}

const NEW_LAYOUT_SENTINEL = "__new_layout__";

const STATUS_STYLES: Record<Document["status"], string> = {
  uploaded: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  processing: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  done: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  error: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

export function DocumentRow({
  doc,
  layouts,
  llmConfigured,
  localLlmAvailable,
  onChanged,
  onLayoutsChanged,
}: Props) {
  const [region, setRegion] = useState(doc.region);
  const [layout, setLayout] = useState<string | null>(doc.layout);
  const [firstPage, setFirstPage] = useState(doc.first_page);
  const [lastPage, setLastPage] = useState(doc.last_page);
  const [year, setYear] = useState(doc.year ?? new Date().getFullYear());
  const [method, setMethod] = useState<ExtractionMethod>("local");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    region !== doc.region ||
    layout !== doc.layout ||
    firstPage !== doc.first_page ||
    lastPage !== doc.last_page ||
    year !== doc.year;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.patchDocument(doc.id, { region, layout, first_page: firstPage, last_page: lastPage, year });
      onChanged();
    } catch (err) {
      setError(err instanceof api.ApiError ? err.detail : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const extract = async () => {
    setError(null);
    try {
      await api.extractDocument(doc.id, method);
      onChanged();
    } catch (err) {
      setError(err instanceof api.ApiError ? err.detail : "Extraction failed to start");
    }
  };

  const remove = async () => {
    if (!confirm(`Delete "${doc.original_filename}" and all its events?`)) return;
    await api.deleteDocument(doc.id);
    onChanged();
  };

  const handleLayoutChange = async (value: string) => {
    if (value !== NEW_LAYOUT_SENTINEL) {
      setLayout(value || null);
      return;
    }
    const name = window.prompt(
      "Name this layout (e.g. the publisher/canton) — it gets its own isolated model, " +
        "never trained on any other layout's documents:"
    );
    if (!name || !name.trim()) return;
    setError(null);
    try {
      const created = await api.addLayout(name.trim());
      onLayoutsChanged();
      setLayout(created.layout_id);
    } catch (err) {
      setError(err instanceof api.ApiError ? err.detail : "Could not create layout");
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-medium text-slate-900 dark:text-slate-100">{doc.original_filename}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {doc.page_count} pages · uploaded {new Date(doc.uploaded_at).toLocaleString()}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[doc.status]}`}>
            {doc.status}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {doc.event_count} events
            {doc.extraction_method ? ` · ${doc.extraction_method}` : ""}
          </span>
          <button
            type="button"
            onClick={remove}
            className="rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            Delete
          </button>
        </div>
      </div>

      {doc.error_message && (
        <p className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          {doc.error_message}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <Field label="Region label">
          <input
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="e.g. Kanton Solothurn"
            className="w-48 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800"
          />
        </Field>
        <Field label="Layout">
          <select
            value={layout ?? ""}
            onChange={(e) => handleLayoutChange(e.target.value)}
            className={`w-48 rounded-md border bg-white px-2 py-1 text-sm dark:bg-slate-800 ${
              layout ? "border-slate-300 dark:border-slate-700" : "border-amber-400 dark:border-amber-600"
            }`}
          >
            <option value="">Unrecognized — pick one</option>
            {layouts.map((l) => (
              <option key={l.layout_id} value={l.layout_id}>
                {l.display_name}
              </option>
            ))}
            <option value={NEW_LAYOUT_SENTINEL}>+ Add new layout…</option>
          </select>
        </Field>
        <Field label="First page">
          <input
            type="number"
            min={0}
            max={doc.page_count - 1}
            value={firstPage}
            onChange={(e) => setFirstPage(Number(e.target.value))}
            className="w-20 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800"
          />
        </Field>
        <Field label="Last page">
          <input
            type="number"
            min={0}
            max={doc.page_count - 1}
            value={lastPage}
            onChange={(e) => setLastPage(Number(e.target.value))}
            className="w-20 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800"
          />
        </Field>
        <Field label="Year">
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-24 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800"
          />
        </Field>
        <button
          type="button"
          disabled={!dirty || saving}
          onClick={save}
          className="rounded-md bg-slate-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40 dark:bg-slate-600"
        >
          {saving ? "Saving…" : "Save"}
        </button>

        <div className="ml-auto flex items-end gap-2">
          <Field label="Method">
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as ExtractionMethod)}
              title={!llmConfigured ? "Online LLM Service is disabled: set LLM_API_KEY to enable it" : ""}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="local">Local (heuristic)</option>
              <option value="llm" disabled={!llmConfigured} title={!llmConfigured ? "Set LLM_API_KEY to enable" : ""}>
                Online LLM Service{!llmConfigured ? " (not configured)" : ""}
              </option>
              <option
                value="local_llm"
                disabled={!localLlmAvailable}
                title={!localLlmAvailable ? "Install llama-cpp-python to enable (see requirements-local-llm.txt)" : ""}
              >
                Local LLM (offline){!localLlmAvailable ? " (not installed)" : ""}
              </option>
            </select>
          </Field>
          <button
            type="button"
            disabled={!doc.region || !doc.layout || doc.status === "processing"}
            onClick={extract}
            title={
              !doc.region
                ? "Set a region label before extracting"
                : !doc.layout
                  ? "Set a layout before extracting"
                  : ""
            }
            className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
          >
            {doc.status === "processing" ? "Extracting…" : "Extract"}
          </button>
          <Link
            to={`/documents/${doc.id}/train`}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Train
          </Link>
        </div>
      </div>

      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
      {label}
      {children}
    </label>
  );
}
