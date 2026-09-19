import { NavLink } from "react-router-dom";
import { useDarkMode } from "../hooks/useDarkMode";

// See App.tsx's matching comment — admin nav links only exist outside
// the public (static) build; the admin build never sets this env var.
const isStatic = import.meta.env.VITE_DATA_MODE === "static";

const LINKS = [
  { to: "/", label: "Agenda", end: true },
  { to: "/map", label: "Map", end: false },
  ...(isStatic
    ? []
    : [
        { to: "/documents", label: "Documents", end: false },
        { to: "/settings", label: "Settings", end: false },
      ]),
];

export function NavBar() {
  const [dark, toggleDark] = useDarkMode();

  return (
    <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <span className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Kirchenblatt Agenda
        </span>
        <nav className="flex gap-1">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `rounded-md px-3 py-1.5 text-sm font-medium ${
                  isActive
                    ? "bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-300"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <button
          type="button"
          onClick={toggleDark}
          aria-label="Toggle dark mode"
          className="ml-auto rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-700"
        >
          {dark ? "☀️ Light" : "🌙 Dark"}
        </button>
      </div>
    </header>
  );
}
