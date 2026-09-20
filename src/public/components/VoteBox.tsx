import { useState } from "react";
import { Icon } from "../icons";
import { readLocalVotes, submitFeedback, type Vote } from "../lib/feedback";

interface Props {
  eventId: number;
  compact?: boolean;
}

/** "Angaben stimmen / Angaben falsch" — new feature per explicit user
 * request, capturing visitor feedback on whether the extracted data
 * matches the PDF snippet, for later use retraining the extraction
 * models. See src/public/lib/feedback.ts for where the vote goes. */
export function VoteBox({ eventId, compact = false }: Props) {
  const [vote, setVote] = useState<Vote | null>(() => readLocalVotes()[eventId] ?? null);
  const [submitting, setSubmitting] = useState(false);

  const cast = async (next: Vote) => {
    setSubmitting(true);
    setVote(next);
    await submitFeedback(eventId, next);
    setSubmitting(false);
  };

  return (
    <section className="vote">
      <p>Stimmen diese Angaben?</p>
      {!compact && (
        <p className="hint">
          Im ursprünglichen Kirchenblatt liegt hier der PDF-Ausschnitt. Ihre Rückmeldung hilft uns, Fehler zu finden.
        </p>
      )}
      <div className="vote-grid">
        <button
          type="button"
          className={`vote-btn${vote === "accurate" ? " on" : ""}`}
          disabled={submitting}
          onClick={() => cast("accurate")}
        >
          <Icon name="check" size={16} /> Angaben stimmen
        </button>
        <button
          type="button"
          className={`vote-btn${vote === "false" ? " on" : ""}`}
          disabled={submitting}
          onClick={() => cast("false")}
        >
          <Icon name="x" size={16} /> Angaben falsch
        </button>
      </div>
      {vote && <p className="thanks">Danke. Wir nehmen die Rückmeldung zur Prüfung des Ausschnitts.</p>}
    </section>
  );
}
