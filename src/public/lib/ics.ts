import type { Event } from "../../types";

/** Downloads a single-event .ics file — new for the public site (the
 * mockup's "Kalender" button); nothing equivalent exists in the admin app. */
export function downloadIcs(e: Event): void {
  if (!e.iso_date) return;
  const stamp = e.iso_date.replace(/-/g, "");
  const timeMatch = (e.raw_time ?? "").match(/(\d{1,2})[.:](\d{2})/);
  const hhmm = timeMatch ? `${timeMatch[1].padStart(2, "0")}${timeMatch[2]}` : "0000";
  const location = [e.place, e.parish].filter(Boolean).join(", ");
  const description = (e.raw_text ?? e.raw_event_type ?? "").replace(/\n/g, "\\n");
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Brot des Lebens//Kirchenblatt Agenda//DE",
    "BEGIN:VEVENT",
    `UID:event-${e.id}@brotdeslebens.ch`,
    `DTSTAMP:${stamp}T${hhmm}00`,
    `DTSTART:${stamp}T${hhmm}00`,
    `SUMMARY:${e.raw_event_type ?? "Gottesdienst"}`,
    location ? `LOCATION:${location}` : null,
    description ? `DESCRIPTION:${description}` : null,
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter((line): line is string => line != null)
    .join("\r\n");
  const blob = new Blob([ics], { type: "text/calendar" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `event-${e.id}.ics`;
  a.click();
  URL.revokeObjectURL(a.href);
}
