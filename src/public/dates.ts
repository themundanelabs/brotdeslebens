// Ported from the mockup's date helpers, adapted to work off our real
// Event.iso_date ("YYYY-MM-DD") / raw_time ("HH:MM") strings.
const WD = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const WDL = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const MO = ["Jan", "Feb", "März", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
const MOL = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

export function parseIso(iso: string): Date {
  return new Date(iso + "T12:00:00");
}
export function toIso(d: Date): string {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
export function isToday(iso: string): boolean {
  return toIso(new Date()) === iso;
}
export function weekdayShort(iso: string): string {
  return WD[parseIso(iso).getDay()];
}
export function dayNumber(iso: string): string {
  return String(parseIso(iso).getDate());
}
export function monthShort(iso: string): string {
  return MO[parseIso(iso).getMonth()];
}
export function longDate(iso: string): string {
  const d = parseIso(iso);
  return `${WDL[d.getDay()]}, ${d.getDate()}. ${MOL[d.getMonth()]} ${d.getFullYear()}`;
}
export function headingDate(iso: string): string {
  const d = parseIso(iso);
  const core = `${WDL[d.getDay()]}, ${d.getDate()}. ${MOL[d.getMonth()]}`;
  return isToday(iso) ? `Heute · ${core}` : core;
}
/** raw_time is already "HH:MM" (sometimes with odd separators from OCR) —
 * best-effort formatting, falls back to the raw string untouched. */
export function formatTime(hhmm: string | null): string {
  if (!hhmm) return "";
  const m = hhmm.match(/^(\d{1,2})[.:](\d{2})/);
  if (!m) return hhmm;
  const [, h, min] = m;
  return min === "00" ? `${h}.00 Uhr` : `${h}.${min} Uhr`;
}
export function formatTimeCompact(hhmm: string | null): string {
  if (!hhmm) return "";
  const m = hhmm.match(/^(\d{1,2})[.:](\d{2})/);
  return m ? `${m[1]}.${m[2]}` : hhmm;
}
/** Zero-padded "HH:MM" for chronological comparison — raw_time comes
 * from OCR'd text (e.g. "9.00 Uhr", "14.30", "9:00h") and is not
 * reliably zero-padded or colon-separated, so plain string comparison
 * would sort "9.00" after "10.00". Returns "99:99" (sorts last) when
 * unparseable, so events with a missing/garbled time still render, just
 * at the end of their day's group. */
export function sortableTime(hhmm: string | null): string {
  const m = (hhmm ?? "").match(/^(\d{1,2})[.:](\d{2})/);
  if (!m) return "99:99";
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}
export function daysFrom(start: Date, count: number): string[] {
  const out: string[] = [];
  const d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  d.setDate(d.getDate() - 1);
  for (let i = 0; i < count; i++) {
    out.push(toIso(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}
