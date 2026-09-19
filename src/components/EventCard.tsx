import type { Event } from "../types";
import { formatEvent } from "../lib/share";
import { ShareMenu } from "./ShareMenu";

interface Props {
  event: Event;
  selected: boolean;
  onSelect: (event: Event) => void;
}

/** FR-4.6: what each card must show. */
export function EventCard({ event, selected, onSelect }: Props) {
  return (
    // A <div> with a button role, not a <button>: it contains ShareMenu's
    // own <button>, and nested <button> elements are invalid HTML (browsers
    // silently break out of them, corrupting click handling).
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(event)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(event);
        }
      }}
      className={`w-full cursor-pointer rounded-lg border p-3 text-left transition-colors ${
        selected
          ? "border-sky-500 bg-sky-50 dark:border-sky-400 dark:bg-sky-950/40"
          : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {event.document_region}
        </span>
        <ShareMenu text={formatEvent(event)} title={event.raw_event_type ?? "Kirchenblatt event"} />
      </div>

      <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
        {event.raw_date_text ?? "Date unknown"}
        {event.raw_time && <span className="font-normal text-slate-500 dark:text-slate-400"> · {event.raw_time}</span>}
      </div>
      <div className="text-sm text-slate-600 dark:text-slate-400">
        {event.parish ?? event.region ?? "Parish/region unknown"}
        {event.place && event.place !== event.parish && (
          <span className="text-slate-400 dark:text-slate-500"> · in {event.place}</span>
        )}
      </div>
      <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">Page {event.page + 1}</div>

      {event.raw_event_type && (
        <div className="mt-2 text-sm text-slate-800 dark:text-slate-200">{event.raw_event_type}</div>
      )}

      <div className="mt-2">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            event.category
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
              : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
          }`}
        >
          {event.category ?? "Unmapped"}
        </span>
      </div>
    </div>
  );
}
