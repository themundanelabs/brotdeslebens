import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { NavBar } from "./components/NavBar";
import { AgendaPage } from "./pages/AgendaPage";
import { MapPage } from "./pages/MapPage";

// The public build (VITE_DATA_MODE=static — see staticClient.ts's module
// docstring) only ever ships Agenda + Map; admin pages are lazy-loaded so
// Rollup can emit them as chunks the public build's entry flow never
// requests, not just a hidden route. The admin build never sets this env
// var, so `isStatic` is always false there and every route below renders
// exactly as it always has.
const isStatic = import.meta.env.VITE_DATA_MODE === "static";

// The `isStatic ? null : lazy(...)` form (not just the `!isStatic &&`
// below) matters: `isStatic` is a build-time-replaced literal, so Rollup
// constant-folds this ternary and can prove the `lazy(() => import(...))`
// branch — and therefore the whole chunk it would emit — is unreachable
// in the public build, not merely unused at runtime.
const DocumentsPage = isStatic
  ? null
  : lazy(() => import("./pages/DocumentsPage").then((m) => ({ default: m.DocumentsPage })));
const TrainPage = isStatic
  ? null
  : lazy(() => import("./pages/TrainPage").then((m) => ({ default: m.TrainPage })));
const SettingsPage = isStatic
  ? null
  : lazy(() => import("./pages/SettingsPage").then((m) => ({ default: m.SettingsPage })));

export default function App() {
  return (
    <div className="min-h-full">
      <NavBar />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Suspense fallback={<p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>}>
          <Routes>
            <Route path="/" element={<AgendaPage />} />
            <Route path="/map" element={<MapPage />} />
            {!isStatic && DocumentsPage && TrainPage && SettingsPage && (
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
