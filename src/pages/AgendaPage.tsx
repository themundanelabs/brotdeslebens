import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { EventList } from "../components/EventList";
import { FilterBar } from "../components/FilterBar";
import { PdfViewer } from "../components/PdfViewer";
import { usePoll } from "../hooks/usePoll";
import type { EventFilters } from "../types";

export function AgendaPage() {
  const [filters, setFilters] = useState<EventFilters>({});
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);

  const { data: meta } = usePoll(() => api.getMeta(filters), [filtersKey]);
  const { data: events, error } = usePoll(() => api.listEvents(filters), [filtersKey]);

  // FR-4.3: if a selected filter value becomes unreachable given the other
  // active filters, silently clear it instead of showing zero results.
  useEffect(() => {
    if (!meta) return;
    const patch: EventFilters = {};
    if (filters.region && !meta.regions.includes(filters.region)) patch.region = undefined;
    if (filters.parish && !meta.parishes.includes(filters.parish)) patch.parish = undefined;
    if (filters.date && !meta.dates.includes(filters.date)) patch.date = undefined;
    if (filters.document_id != null && !meta.documents.some((d) => d.id === filters.document_id)) {
      patch.document_id = undefined;
    }
    if (Object.keys(patch).length > 0) setFilters((f) => ({ ...f, ...patch }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta]);

  // FR-4.7: selection persists across background refresh only while the
  // event still exists in the current result set.
  useEffect(() => {
    if (events && selectedId != null && !events.some((e) => e.id === selectedId)) {
      setSelectedId(null);
    }
  }, [events, selectedId]);

  const selectedEvent = events?.find((e) => e.id === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <FilterBar
        meta={meta}
        filters={filters}
        onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
        onClear={() => setFilters({})}
      />

      {error != null && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
          Could not load events. Is the backend running?
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="max-h-[75vh] overflow-y-auto pr-1">
          <EventList
            events={events ?? []}
            selectedId={selectedId}
            onSelect={(e) => setSelectedId(e.id)}
            groupByCategory={!!filters.today}
          />
        </div>
        <div className="h-[60vh] md:sticky md:top-4 md:h-[75vh]">
          <PdfViewer documentId={selectedEvent?.document_id ?? null} event={selectedEvent} />
        </div>
      </div>
    </div>
  );
}
