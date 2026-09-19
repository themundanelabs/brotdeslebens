import type { EventFilters, Meta } from "../types";

interface Props {
  meta: Meta | undefined;
  filters: EventFilters;
  onChange: (patch: EventFilters) => void;
  onClear: () => void;
}

/** FR-4.1/4.2: cascading filter controls — each dropdown's own option list
 * comes from `meta`, which the caller re-fetches with every *other* active
 * filter applied (never narrowed by its own selection). */
export function FilterBar({ meta, filters, onChange, onClear }: Props) {
  const hasAny =
    filters.document_id != null ||
    filters.region ||
    filters.parish ||
    filters.date ||
    filters.category ||
    filters.search ||
    filters.today;

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <Field label="Search">
        <input
          type="text"
          value={filters.search ?? ""}
          onChange={(e) => onChange({ search: e.target.value || undefined })}
          placeholder="Search text…"
          className="w-40 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
        />
      </Field>

      <Field label="Document">
        <select
          value={filters.document_id ?? ""}
          onChange={(e) => onChange({ document_id: e.target.value ? Number(e.target.value) : undefined })}
          className="w-44 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
        >
          <option value="">All documents</option>
          {meta?.documents.map((d) => (
            <option key={d.id} value={d.id}>
              {d.region}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Pastoralraum">
        <select
          value={filters.region ?? ""}
          onChange={(e) => onChange({ region: e.target.value || undefined })}
          className="w-44 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
        >
          <option value="">All regions</option>
          {meta?.regions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Parish">
        <select
          value={filters.parish ?? ""}
          onChange={(e) => onChange({ parish: e.target.value || undefined })}
          className="w-44 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
        >
          <option value="">All parishes</option>
          {meta?.parishes.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Date">
        <select
          value={filters.today ? "" : filters.date ?? ""}
          disabled={filters.today}
          onChange={(e) => onChange({ date: e.target.value || undefined })}
          className="w-36 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800"
        >
          <option value="">All dates</option>
          {meta?.dates.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Category">
        <select
          value={filters.category ?? ""}
          onChange={(e) => onChange({ category: e.target.value || undefined })}
          className="w-44 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
        >
          <option value="">All categories</option>
          {meta?.categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
          <option value="Unmapped">Unmapped</option>
        </select>
      </Field>

      <button
        type="button"
        onClick={() => onChange({ today: !filters.today, date: undefined })}
        className={`rounded-md px-3 py-1.5 text-sm font-medium ${
          filters.today
            ? "bg-sky-600 text-white"
            : "border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        }`}
      >
        Today
      </button>

      {hasAny && (
        <button
          type="button"
          onClick={onClear}
          className="ml-auto rounded-md px-3 py-1.5 text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
        >
          Clear filters
        </button>
      )}
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
