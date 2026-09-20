import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { NavBar } from "./components/NavBar";

// The public build (VITE_DATA_MODE=static — see staticClient.ts's module
// docstring) ships its own redesigned Agenda/Map pages and none of the
// admin pages; the admin build ships the reverse. Every page is behind
// `isStatic ? null : lazy(...)` (not just a gated <Route>) so Rollup can
// constant-fold the ternary and prove the unreachable branch's whole
// lazy-imported chunk is dead code, not merely unused at runtime — see
// this pattern's verification note in git history for this file.
const isStatic = import.meta.env.VITE_DATA_MODE === "static";

const AgendaPage = isStatic ? null : lazy(() => import("./pages/AgendaPage").then((m) => ({ default: m.AgendaPage })));
const MapPage = isStatic ? null : lazy(() => import("./pages/MapPage").then((m) => ({ default: m.MapPage })));
const DocumentsPage = isStatic
  ? null
  : lazy(() => import("./pages/DocumentsPage").then((m) => ({ default: m.DocumentsPage })));
const TrainPage = isStatic
  ? null
  : lazy(() => import("./pages/TrainPage").then((m) => ({ default: m.TrainPage })));
const SettingsPage = isStatic
  ? null
  : lazy(() => import("./pages/SettingsPage").then((m) => ({ default: m.SettingsPage })));

const PublicAgendaPage = isStatic
  ? lazy(() => import("./public/pages/PublicAgendaPage").then((m) => ({ default: m.PublicAgendaPage })))
  : null;
const PublicMapPage = isStatic
  ? lazy(() => import("./public/pages/PublicMapPage").then((m) => ({ default: m.PublicMapPage })))
  : null;

export default function App() {
  if (isStatic) {
    // No NavBar/admin chrome here — the public pages own their full page
    // layout (header, nav, responsive grid) via the mockup-ported theme.
    return (
      <Suspense fallback={<div />}>
        <Routes>
          {PublicAgendaPage && <Route path="/" element={<PublicAgendaPage />} />}
          {PublicMapPage && <Route path="/map" element={<PublicMapPage />} />}
        </Routes>
      </Suspense>
    );
  }

  return (
    <div className="min-h-full">
      <NavBar />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Suspense fallback={<p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>}>
          <Routes>
            {AgendaPage && <Route path="/" element={<AgendaPage />} />}
            {MapPage && <Route path="/map" element={<MapPage />} />}
            {DocumentsPage && TrainPage && SettingsPage && (
              <>
                <Route path="/documents" element={<DocumentsPage />} />
                <Route path="/documents/:id/train" element={<TrainPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </>
            )}
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}
