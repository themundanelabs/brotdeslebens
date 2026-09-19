import { useMemo, useState } from "react";
import { api } from "../api/client";
import type { Mapping, Meta } from "../types";

interface Props {
  mappings: Mapping[];
  categories: Meta["categories"];
  knownPlaces: string[];
  onChanged: () => void;
}

type SortKey = "raw_event_type" | "count" | "category" | "place" | "suggested_type";
type SortDir = "asc" | "desc";

/** Sensible first-click direction per column: text columns start ascending,
 * the occurrence count starts descending (most-common first, matching the
 * API's default order). */
const DEFAULT_DIR: Record<SortKey, SortDir> = {
  raw_event_type: "asc",
  count: "desc",
  category: "asc",
  place: "asc",
  suggested_type: "asc",
};

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "raw_event_type", label: "Raw event type" },
  { key: "count", label: "Occurrences" },
  { key: "category", label: "Category" },
  { key: "place", label: "Place" },
  { key: "suggested_type", label: "Suggested" },
];

const PLACES_DATALIST_ID = "known-places";

function compareValues(a: Mapping, b: Mapping, key: SortKey): number {
  if (key === "count") return a.count - b.count;
  if (key === "category") return (a.category ?? "").localeCompare(b.category ?? "");
  if (key === "place") return (a.place ?? "").localeCompare(b.place ?? "");
  if (key === "suggested_type") {
    // Order by label first (event before place), then by confidence within
    // a label, so sorting groups the two kinds together instead of just
    // interleaving by raw confidence number.
    const labelCmp = (a.suggested_type ?? "").localeCompare(b.suggested_type ?? "");
    if (labelCmp !== 0) return labelCmp;
    return (a.suggested_confidence ?? 0) - (b.suggested_confidence ?? 0);
  }
  return a.raw_event_type.localeCompare(b.raw_event_type);
}

/** FR-3.3/3.4: every raw event-type string with its live count, a dropdown
 * restricted to the fixed target category list, a free-text "Place" alias
 * (for raw_event_type strings that turned out to actually name a place —
 * prepopulated from the parish/place review screen's known locations, or
 * typeable fresh), and a place/event suggestion from the trained
 * classifier — all sortable by clicking the column header. Both the
 * category and place corrections made here feed back into the classifier's
 * training data (see ml_classifier.py's `_mine_training_examples`), so
 * suggestions improve as the mapping table gets reviewed. */
export function MappingTable({ mappings, categories, knownPlaces, onChanged }: Props) {
  const [filter, setFilter] = useState<"all" | "unmapped">("all");
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [placeDrafts, setPlaceDrafts] = useState<Record<string, string>>({});
  const [sortKey, setSortKey] = useState<SortKey>("count");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const visible = filter === "unmapped" ? mappings.filter((m) => !m.category && !m.place) : mappings;

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

  const save = async (m: Mapping, patch: { category: string | null; place: string | null }) => {
    setSavingKey(m.raw_event_type);
    try {
      await api.setMapping(m.raw_event_type, patch);
      onChanged();
    } finally {
      setSavingKey(null);
    }
  };

  const handleCategoryChange = (m: Mapping, category: string) => {
    save(m, { category: category || null, place: m.place });
  };

  const handlePlaceBlur = (m: Mapping) => {
    const draft = placeDrafts[m.raw_event_type];
    if (draft === undefined || draft === (m.place ?? "")) return;
    save(m, { category: m.category, place: draft || null });
  };

  return (
    <div className="flex flex-col gap-3">
      <datalist id={PLACES_DATALIST_ID}>
        {knownPlaces.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>

      <div className="flex gap-2">
        {(["all", "unmapped"] as const).map((f) => (
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
            {f === "all" ? "All" : "Unmapped only"}
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
            </tr>
          </thead>
          <tbody>
            {sorted.map((m) => {
              const placeDraft = placeDrafts[m.raw_event_type] ?? m.place ?? "";
              return (
                <tr
                  key={m.raw_event_type}
                  className="border-t border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-950"
                >
                  <td className="px-3 py-2 text-slate-800 dark:text-slate-200">{m.raw_event_type}</td>
                  <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{m.count}</td>
                  <td className="px-3 py-2">
                    <select
                      value={m.category ?? ""}
                      disabled={savingKey === m.raw_event_type}
                      onChange={(e) => handleCategoryChange(m, e.target.value)}
                      className="w-56 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800"
                    >
                      <option value="">Unmapped</option>
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      list={PLACES_DATALIST_ID}
                      value={placeDraft}
                      disabled={savingKey === m.raw_event_type}
                      placeholder="Not a place"
                      onChange={(e) =>
                        setPlaceDrafts((d) => ({ ...d, [m.raw_event_type]: e.target.value }))
                      }
                      onBlur={() => handlePlaceBlur(m)}
                      className="w-44 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800"
                    />
                  </td>
                  <td className="px-3 py-2">
                    {m.suggested_type ? (
                      <span
                        title={
                          m.suggested_confidence != null
                            ? `${Math.round(m.suggested_confidence * 100)}% confidence`
                            : undefined
                        }
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          m.suggested_type === "place"
                            ? "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300"
                            : "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300"
                        }`}
                      >
                        {m.suggested_type === "place" ? "Place?" : "Event"}
                        {m.suggested_confidence != null && ` · ${Math.round(m.suggested_confidence * 100)}%`}
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
