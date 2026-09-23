import { Icon } from "../icons";
import type { EventFilters, Meta } from "../../types";

interface Props {
  open: boolean;
  meta: Meta | undefined;
  filters: EventFilters;
  onChange: (patch: EventFilters) => void;
  onClear: () => void;
  onClose: () => void;
}

function Chip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`chip ${on ? "on" : "ghost"}`} onClick={onClick}>
      {label}
    </button>
  );
}

/** The mockup's full-filter modal sheet. Canton and Kirchenblatt-Ausgabe
 * are already inline dropdowns in the main agenda view (per explicit
 * direction), so this sheet only needs Gemeinde/Pfarrei and Art der
 * Feier — duplicating the dropdowns here would be redundant. */
export function FilterSheet({ open, meta, filters, onChange, onClear, onClose }: Props) {
  if (!open) return null;
  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="sheet filters" role="dialog" aria-label="Filter">
        <div className="handle" />
        <div className="sheet-head">
          <h2 className="display" style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
            <Icon name="filter" size={20} /> Filter
          </h2>
          <button type="button" className="icon-btn ghost" onClick={onClose} aria-label="Schliessen">
            <Icon name="x" size={20} />
          </button>
        </div>
        <div className="sheet-body">
          <p className="flabel first">Standort / Pfarrei</p>
          <div className="wrap-filters">
            <Chip label="Alle" on={!filters.parish} onClick={() => onChange({ parish: undefined })} />
            {meta?.parishes.map((p) => (
              <Chip key={p} label={p} on={filters.parish === p} onClick={() => onChange({ parish: p })} />
            ))}
          </div>

          <p className="flabel">Art der Feier</p>
          <div className="wrap-filters">
            <Chip label="Alle" on={!filters.category} onClick={() => onChange({ category: undefined })} />
            {meta?.categories.map((c) => (
              <Chip key={c} label={c} on={filters.category === c} onClick={() => onChange({ category: c })} />
            ))}
          </div>

          <div className="filter-actions">
            <button type="button" className="btn outline" onClick={onClear}>
              Zurücksetzen
            </button>
            <button type="button" className="btn" onClick={onClose}>
              Anzeigen
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
