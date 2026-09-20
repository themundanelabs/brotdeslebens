import { Icon } from "../icons";
import type { Event } from "../../types";
import { EventDetail } from "./EventDetail";
import { VoteBox } from "./VoteBox";

interface Props {
  event: Event | null;
  onClose: () => void;
  onOpenParish?: (parish: string) => void;
}

/** Mobile-only bottom sheet for a selected event's detail — desktop shows
 * the same EventDetail in the persistent aside instead (see
 * PublicAgendaPage), matching the mockup's state.desktop branch. */
export function SnippetSheet({ event, onClose, onOpenParish }: Props) {
  if (!event) return null;
  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label="Kirchenblatt">
        <div className="handle" />
        <div className="sheet-head">
          <h2 className="display">Kirchenblatt</h2>
          <button type="button" className="icon-btn ghost" onClick={onClose} aria-label="Schliessen">
            <Icon name="x" size={20} />
          </button>
        </div>
        <div className="sheet-body">
          <EventDetail event={event} showFeedback={false} onOpenParish={onOpenParish} />
        </div>
        <div className="sheet-foot">
          <VoteBox eventId={event.id} compact />
        </div>
      </div>
    </>
  );
}
