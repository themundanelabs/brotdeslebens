import type { Event } from "../../types";
import { formatTimeCompact } from "../dates";
import { WheatRule } from "../icons";

interface Props {
  event: Event;
  onSelect: (e: Event) => void;
}

/** "Nächste Feier" hero card — new derived UI element (pure client-side
 * computation off the already-fetched event list: earliest upcoming
 * event), no backend change needed. */
export function FeaturedCard({ event, onSelect }: Props) {
  const place = event.place ?? event.parish ?? "";
  return (
    <button type="button" className="featured" onClick={() => onSelect(event)}>
      <p className="eye">Nächste Feier</p>
      <p className="clock">{formatTimeCompact(event.raw_time)} Uhr</p>
      <p className="ttl">{event.raw_event_type ?? "Gottesdienst"}</p>
      <p className="where">
        {[event.parish, event.document_region, place].filter(Boolean).join(" · ")}
      </p>
      <WheatRule />
      <p className="cta">Tippen für den Ausschnitt aus dem Kirchenblatt</p>
    </button>
  );
}
