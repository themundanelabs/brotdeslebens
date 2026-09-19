import type { Event } from "../types";
import { EventCard } from "./EventCard";
import { ShareMenu } from "./ShareMenu";
import { formatEventList } from "../lib/share";

interface Props {
  events: Event[];
  selectedId: number | null;
  onSelect: (event: Event) => void;
  groupByCategory: boolean;
}

/** FR-4.5: when "today" is active, group by mapped category (with an
 * "Unmapped" bucket) instead of a flat list. */
export function EventList({ events, selectedId, onSelect, groupByCategory }: Props) {
  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        No events match the current filters.
      </div>
    );
  }

  if (!groupByCategory) {
    return (
      <div className="space-y-3">
        <ListShareHeader events={events} title="Events" />
        {events.map((e) => (
          <EventCard key={e.id} event={e} selected={e.id === selectedId} onSelect={onSelect} />
        ))}
      </div>
    );
  }

  const groups = new Map<string, Event[]>();
  for (const e of events) {
    const key = e.category ?? "Unmapped";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }

  return (
    <div className="space-y-6">
      {[...groups.entries()].map(([category, groupEvents]) => (
        <div key={category}>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {category} <span className="font-normal text-slate-400">({groupEvents.length})</span>
            </h3>
            <ShareMenu text={formatEventList(groupEvents, category)} title={category} />
          </div>
          <div className="space-y-3">
            {groupEvents.map((e) => (
              <EventCard key={e.id} event={e} selected={e.id === selectedId} onSelect={onSelect} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ListShareHeader({ events, title }: { events: Event[]; title: string }) {
  return (
    <div className="flex items-center justify-end">
      <ShareMenu text={formatEventList(events, title)} title={title} />
    </div>
  );
}
