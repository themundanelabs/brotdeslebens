import { BrandMark, Icon } from "../icons";

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Hamburger drawer. Per explicit direction, this is a placeholder for
 * future resource links — the mockup's "Heilige Messe für Kinder" page is
 * out of scope for now, so the nav list is intentionally empty. */
export function MenuDrawer({ open, onClose }: Props) {
  if (!open) return null;
  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="menu" role="dialog" aria-label="Menü">
        <div className="menu-head">
          <BrandMark className="brand" size={40} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 className="display" style={{ fontSize: "1.125rem", fontWeight: 600, lineHeight: 1.2 }}>
              Brot des Lebens
            </h2>
            <p className="kicker">Heilige Messe — Lesen & Vertiefen</p>
          </div>
          <button type="button" className="icon-btn ghost" onClick={onClose} aria-label="Menü schliessen">
            <Icon name="x" size={20} />
          </button>
        </div>
        <nav>
          <p className="empty-note">Weitere Ressourcen und Links folgen hier in Kürze.</p>
        </nav>
        <p className="menu-foot">«Ich bin das Brot des Lebens» — Joh 6,35</p>
      </div>
    </>
  );
}
