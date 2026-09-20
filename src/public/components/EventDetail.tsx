import { Icon } from "../icons";
import { downloadIcs } from "../lib/ics";
import { shareOrCopy, formatEvent } from "../../lib/share";
import { formatTime, longDate } from "../dates";
import type { Event } from "../../types";
import { VoteBox } from "./VoteBox";

interface Props {
  event: Event;
  showFeedback: boolean;
  onOpenParish?: (parish: string) => void;
}

export function EventDetail({ event, showFeedback, onOpenParish }: Props) {
  const place = event.place ?? event.parish ?? "";
  const mapsQuery = encodeURIComponent([event.place, event.parish].filter(Boolean).join(", "));

  return (
    <div className="detail">
      <div>
        <p className="eyebrow">
          {event.iso_date ? longDate(event.iso_date) : event.raw_date_text} · {formatTime(event.raw_time)}
        </p>
        <h2>{event.raw_event_type ?? "Gottesdienst"}</h2>
        <div className="place-row">
          <Icon name="church" size={16} />
          <div>
            <p style={{ fontWeight: 500, lineHeight: 1.35 }}>{place}</p>
            {event.region && <p className="sub">{event.region}</p>}
          </div>
        </div>
        <p className="sub">
          {event.category ?? "Unmapped"} {event.document_region ? `· ${event.document_region}` : ""}
        </p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
        <h3 style={{ fontSize: "1.125rem", fontWeight: 600 }}>Aus dem Kirchenblatt</h3>
      </div>
      <article className="clip">
        <img
          className="clip-photo"
          src={`${import.meta.env.BASE_URL}data/snippets/${event.id}.jpg`}
          alt="Ausschnitt aus dem Kirchenblatt"
        />
        <header className="clip-head">
          <p className="clip-k">Kirchenblatt</p>
          <div className="clip-row">
            <p className="nm">{event.document_region ?? "Ausgabe"}</p>
            <p className="pg">Seite {event.page + 1}</p>
          </div>
        </header>
      </article>

      {showFeedback && <VoteBox eventId={event.id} />}

      <div className="actions">
        <button
          type="button"
          className="btn secondary"
          onClick={() => shareOrCopy(formatEvent(event), event.raw_event_type ?? "Gottesdienst")}
        >
          <Icon name="share" size={16} /> Teilen
        </button>
        <button type="button" className="btn secondary" onClick={() => downloadIcs(event)}>
          <Icon name="pluscal" size={16} /> Kalender
        </button>
        <a
          className="btn secondary"
          href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
          target="_blank"
          rel="noreferrer"
        >
          <Icon name="pin" size={16} /> Route
        </a>
      </div>

      {event.parish && onOpenParish && (
        <button type="button" className="parish-btn" onClick={() => onOpenParish(event.parish!)}>
          Alle Termine in {event.parish}
        </button>
      )}

      <p className="disclaimer">
        Ausschnitt aus dem gedruckten Kirchenblatt. Angaben ohne Gewähr — bitte das aktuelle Blatt beachten.
      </p>
    </div>
  );
}
