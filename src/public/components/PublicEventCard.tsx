import type { Event } from "../../types";
import { formatTimeCompact } from "../dates";
import { Icon, HostGlyph, isHostCategory } from "../icons";

interface Props {
  event: Event;
  onSelect: (e: Event) => void;
}

export function PublicEventCard({ event, onSelect }: Props) {
  const place = event.place ?? event.parish ?? "";
  return (
    <li>
      <button type="button" className="card" onClick={() => onSelect(event)}>
        <span className="time">
          <span className="t">{formatTimeCompact(event.raw_time)}</span>
          <span className="u">Uhr</span>
        </span>
        <span className="body">
          <span className="line">
            {isHostCategory(event.category) && <HostGlyph size={14} />}
            <span>{event.raw_event_type ?? "Gottesdienst"}</span>
          </span>
          <span className="meta">
            <Icon name="church" size={14} />
            {event.parish && <span>{event.parish}</span>}
            {event.document_region && (
              <>
                <span className="sep">·</span>
                <span>{event.document_region}</span>
              </>
            )}
            {place && (
              <>
                <span className="sep">·</span>
                <span className="trunc">{place}</span>
              </>
            )}
          </span>
          <span className="page">Kirchenblatt S. {event.page + 1}</span>
        </span>
      </button>
    </li>
  );
}
