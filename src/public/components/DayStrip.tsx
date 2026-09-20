import { dayNumber, daysFrom, isToday, monthShort, weekdayShort } from "../dates";

interface Props {
  selectedDay: string | null;
  counts: Record<string, number>;
  onSelect: (iso: string) => void;
}

export function DayStrip({ selectedDay, counts, onSelect }: Props) {
  const days = daysFrom(new Date(), 16);
  return (
    <div className="week no-scroll">
      {days.map((iso) => {
        const on = selectedDay === iso;
        const today = isToday(iso);
        const count = counts[iso] ?? 0;
        return (
          <button
            key={iso}
            type="button"
            className={`day${on ? " on" : today ? " today" : ""}`}
            onClick={() => onSelect(iso)}
          >
            <span className="wd">{weekdayShort(iso)}</span>
            <span className="num">{dayNumber(iso)}</span>
            <span className="mo">{monthShort(iso)}</span>
            <span className={`dot${count > 0 ? " has" : ""}`} />
          </button>
        );
      })}
    </div>
  );
}
