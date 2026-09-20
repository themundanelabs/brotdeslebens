import { NavLink } from "react-router-dom";
import { Icon } from "../icons";

export function PublicBottomNav() {
  return (
    <nav className="bottom-nav">
      <div className="grid">
        <NavLink to="/" end className={({ isActive }) => `navtab${isActive ? " on" : ""}`}>
          <Icon name="calendar" size={20} />
          Gottesdienste
        </NavLink>
        <NavLink to="/map" className={({ isActive }) => `navtab${isActive ? " on" : ""}`}>
          <Icon name="map" size={20} />
          Orte
        </NavLink>
      </div>
    </nav>
  );
}
