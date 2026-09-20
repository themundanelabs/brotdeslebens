import { NavLink } from "react-router-dom";
import { BrandMark, Icon } from "../icons";

interface Props {
  subtitle: string;
  activeFilterCount: number;
  showFilterButton: boolean;
  showVerse: boolean;
  onOpenMenu: () => void;
  onOpenFilters: () => void;
}

export function PublicHeader({ subtitle, activeFilterCount, showFilterButton, showVerse, onOpenMenu, onOpenFilters }: Props) {
  return (
    <header className="header">
      <div className="header-row">
        <button type="button" className="icon-btn" onClick={onOpenMenu} aria-label="Menü öffnen">
          <Icon name="menu" size={20} />
        </button>
        <BrandMark className="brand" size={44} />
        <div className="title">
          <h1 className="display">Brot des Lebens</h1>
          <p className="kicker">{subtitle}</p>
        </div>
        <nav className="desk-tabs">
          <NavLink to="/" end className={({ isActive }) => `tab${isActive ? " on" : ""}`}>
            <Icon name="calendar" size={16} /> Gottesdienste
          </NavLink>
          <NavLink to="/map" className={({ isActive }) => `tab${isActive ? " on" : ""}`}>
            <Icon name="map" size={16} /> Orte
          </NavLink>
        </nav>
        {showFilterButton && (
          <div className="filter-wrap">
            <button type="button" className="icon-btn" onClick={onOpenFilters} aria-label="Alle Filter">
              <Icon name="sliders" size={20} />
            </button>
            {activeFilterCount > 0 && <span className="badge">{activeFilterCount}</span>}
          </div>
        )}
      </div>
      {showVerse && <p className="verse">«Ich bin das Brot des Lebens» — Joh 6,35</p>}
    </header>
  );
}
