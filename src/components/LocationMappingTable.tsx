import { useMemo, useState } from "react";
import { api } from "../api/client";
import type { LocationKind, LocationMapping } from "../types";

interface Props {
  mappings: LocationMapping[];
  onChanged: () => void;
}

type SortKey = "raw_text" | "count" | "kind";
type SortDir = "asc" | "desc";

const DEFAULT_DIR: Record<SortKey, SortDir> = {
  raw_text: "asc",
  count: "desc",
  kind: "asc",
};

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "raw_text", label: "Raw text" },
  { key: "count", label: "Occurrences" },
  { key: "kind", label: "Kind" },
];

const KIND_LABEL: Record<LocationKind, string> = {
  parish: "Parish",
  place: "Place",
  ignore: "Ignore",
};

function compareValues(a: LocationMapping, b: LocationMapping, key: SortKey): number {
  if (key === "count") return a.count - b.count;
  if (key === "kind") return (a.kind ?? "parish").localeCompare(b.kind ?? "parish");
  return a.raw_text.localeCompare(b.raw_text);
}

/** Mirrors MappingTable, but for the location_mappings review table: fixes
 * up whatever bold-header noise the extractors' plausibility heuristics
 * still let through — mark a raw string as the real physical venue
 * ("place") or drop it entirely ("ignore") without needing a
 * re-extraction. */
export function LocationMappingTable({ mappings, onChanged }: Props) {
  const [filter, setFilter] = useState<"all" | "unreviewed">("all");
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [sortKey, setSortKey] = useState<SortKey>("count");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const visible = filter === "unreviewed" ? mappings.filter((m) => !m.kind) : mappings;

  const sorted = useMemo(() => {
    const copy = [...visible];
    copy.sort((a, b) => compareValues(a, b, sortKey) * (sortDir === "asc" ? 1 : -1));
    return copy;
  }, [visible, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(DEFAULT_DIR[key]);
    }
  };

  const save = async (m: LocationMapping, patch: { kind: LocationKind; corrected_value: string | null }) => {
    setSavingKey(m.raw_text);
    try {
      await api.setLocationMapping(m.raw_text, patch);
      onChanged();
    } finally {
      setSavingKey(null);
    }
  };

  const handleKindChange = (m: LocationMapping, kind: LocationKind) => {
    save(m, { kind, corrected_value: kind === "parish" ? m.corrected_value : null });
  };

  const handleCorrectedBlur = (m: LocationMapping) => {
    const draft = drafts[m.raw_text];
    if (draft === undefined || draft === (m.corrected_value ?? "")) return;
    save(m, { kind: m.kind ?? "parish", corrected_value: draft || null });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        {(["all", "unreviewed"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              filter === f
                ? "bg-sky-600 text-white"
                : "border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            }`}
          >
            {f === "all" ? "All" : "Unreviewed only"}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
            <tr>
              {COLUMNS.map((col) => (
                <th key={col.key} className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => handleSort(col.key)}
                    className="flex items-center gap-1 uppercase tracking-wide text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
                  >
                    {col.label}
                    <span className="text-slate-300 dark:text-slate-600">
                      {sortKey === col.key ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
                    </span>
                  </button>
                </th>
              ))}
              <th className="px-3 py-2">Corrected value</th>
              <th className="px-3 py-2">Suggested</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((m) => {
              const kind = m.kind ?? "parish";
              const draft = drafts[m.raw_text] ?? m.corrected_value ?? "";
              return (
                <tr
                  key={m.raw_text}
                  className="border-t border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-950"
                >
                  <td className="px-3 py-2 text-slate-800 dark:text-slate-200">{m.raw_text}</td>
                  <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{m.count}</td>
                  <td className="px-3 py-2">
                    <select
                      value={kind}
                      disabled={savingKey === m.raw_text}
                      onChange={(e) => handleKindChange(m, e.target.value as LocationKind)}
                      className="w-28 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800"
                    >
                      {(Object.keys(KIND_LABEL) as LocationKind[]).map((k) => (
                        <option key={k} value={k}>
                          {KIND_LABEL[k]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={draft}
                      disabled={kind !== "parish" || savingKey === m.raw_text}
                      placeholder={kind === "parish" ? "(unchanged)" : "—"}
                      onChange={(e) => setDrafts((d) => ({ ...d, [m.raw_text]: e.target.value }))}
                      onBlur={() => handleCorrectedBlur(m)}
                      className="w-48 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800"
                    />
                  </td>
                  <td className="px-3 py-2">
                    {m.suggested_kind ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                        {KIND_LABEL[m.suggested_kind]}?
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                  Nothing to show.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
