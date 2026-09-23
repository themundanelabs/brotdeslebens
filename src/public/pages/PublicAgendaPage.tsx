import { useEffect, useMemo, useState } from "react";
import "../theme.css";
import { api } from "../../api/client";
import { usePoll } from "../../hooks/usePoll";
import type { Event, EventFilters } from "../../types";
import { PublicHeader } from "../components/PublicHeader";
import { PublicBottomNav } from "../components/PublicBottomNav";
import { MenuDrawer } from "../components/MenuDrawer";
import { FilterSheet } from "../components/FilterSheet";
import { SnippetSheet } from "../components/SnippetSheet";
import { EventDetail } from "../components/EventDetail";
import { DayStrip } from "../components/DayStrip";
import { PublicEventCard } from "../components/PublicEventCard";
import { FeaturedCard } from "../components/FeaturedCard";
import { Icon, HostGlyph } from "../icons";
import { headingDate, isToday, sortableTime, toIso } from "../dates";

type Preset = "today" | "week" | "all";

function activeFilterCount(filters: EventFilters, preset: Preset, day: string | null): number {
  return (
    (filters.document_region ? 1 : 0) +
    (filters.document_id != null ? 1 : 0) +
    (filters.parish ? 1 : 0) +
    (filters.category ? 1 : 0) +
    (filters.search ? 1 : 0) +
    (preset !== "week" || day ? 1 : 0)
  );
}

export function PublicAgendaPage() {
  const [filters, setFilters] = useState<EventFilters>({});
  const [preset, setPreset] = useState<Preset>("week");
  const [day, setDay] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [desktop, setDesktop] = useState(() => window.matchMedia("(min-width: 768px)").matches);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = (ev: MediaQueryListEvent) => setDesktop(ev.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);
  const { data: meta } = usePoll(() => api.getMeta(filters), [filtersKey]);
  const { data: allEvents, error } = usePoll(() => api.listEvents(filters), [filtersKey]);

  // FR-4.3 equivalent: drop a filter value that's no longer reachable
  // given the other active filters.
  useEffect(() => {
    if (!meta) return;
    const patch: EventFilters = {};
    if (filters.document_region && !(meta.cantons ?? []).includes(filters.document_region)) {
      patch.document_region = undefined;
    }
    if (filters.document_id != null && !meta.documents.some((d) => d.id === filters.document_id)) {
      patch.document_id = undefined;
    }
    if (filters.parish && !meta.parishes.includes(filters.parish)) patch.parish = undefined;
    if (filters.category && !meta.categories.includes(filters.category)) patch.category = undefined;
    if (Object.keys(patch).length > 0) setFilters((f) => ({ ...f, ...patch }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta]);

  const now = new Date();
  const todayIso = toIso(now);
  const weekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  weekEnd.setDate(weekEnd.getDate() + 7);

  const dateFiltered = useMemo(() => {
    const events = allEvents ?? [];
    if (day) return events.filter((e) => e.iso_date === day);
    if (preset === "today") return events.filter((e) => e.iso_date === todayIso);
    if (preset === "all") return events;
    return events.filter((e) => e.iso_date != null && e.iso_date >= todayIso && e.iso_date < toIso(weekEnd));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allEvents, preset, day, todayIso]);

  const sorted = useMemo(
    () =>
      [...dateFiltered].sort((a, b) => {
        const ak = `${a.iso_date ?? ""}T${sortableTime(a.raw_time)}`;
        const bk = `${b.iso_date ?? ""}T${sortableTime(b.raw_time)}`;
        return ak.localeCompare(bk);
      }),
    [dateFiltered]
  );

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of allEvents ?? []) {
      if (!e.iso_date) continue;
      map[e.iso_date] = (map[e.iso_date] ?? 0) + 1;
    }
    return map;
  }, [allEvents]);

  const featured = useMemo(() => {
    const noFilters =
      !filters.document_region && !filters.document_id && !filters.parish && !filters.category && !filters.search;
    if (!noFilters || preset === "today" || day) return null;
    const nowKey = `${todayIso}T${sortableTime(now.toTimeString().slice(0, 5))}`;
    return (allEvents ?? [])
      .filter((e) => e.iso_date != null && `${e.iso_date}T${sortableTime(e.raw_time)}` >= nowKey)
      .sort((a, b) => `${a.iso_date}T${sortableTime(a.raw_time)}`.localeCompare(`${b.iso_date}T${sortableTime(b.raw_time)}`))[0];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allEvents, filters, preset, day, todayIso]);

  useEffect(() => {
    if (allEvents && selectedId != null && !allEvents.some((e) => e.id === selectedId)) {
      setSelectedId(null);
    }
  }, [allEvents, selectedId]);

  const selectedEvent = allEvents?.find((e) => e.id === selectedId) ?? null;

  const openEvent = (e: Event) => setSelectedId(e.id);
  const openParish = (parish: string) => {
    setFilters((f) => ({ ...f, parish }));
    setSelectedId(null);
  };
  const clearFilters = () => {
    setFilters({});
    setPreset("week");
    setDay(null);
  };

  const listForCards = featured ? sorted.filter((e) => e.id !== featured.id) : sorted;
  const grouped = new Map<string, Event[]>();
  for (const e of listForCards) {
    if (!e.iso_date) continue;
    if (!grouped.has(e.iso_date)) grouped.set(e.iso_date, []);
    grouped.get(e.iso_date)!.push(e);
  }

  const nFilters = activeFilterCount(filters, preset, day);

  return (
    <div className="bdl">
      <div className="wrap">
        <div className="col">
          <PublicHeader
            subtitle="Kirchenblatt Agenda"
            activeFilterCount={nFilters}
            showFilterButton
            showVerse
            onOpenMenu={() => setMenuOpen(true)}
            onOpenFilters={() => setFiltersOpen(true)}
          />
          <main className="main">
            <div className="search">
              <span className="lead">
                <Icon name="search" size={16} />
              </span>
              <input
                type="search"
                placeholder="Suche: Eucharistie, Pfarrei, Jahrzeit…"
                value={filters.search ?? ""}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value || undefined }))}
                aria-label="Suche"
              />
              {filters.search && (
                <button
                  type="button"
                  className="clear"
                  aria-label="Suche leeren"
                  onClick={() => setFilters((f) => ({ ...f, search: undefined }))}
                >
                  <Icon name="x" size={16} />
                </button>
              )}
            </div>

            <div className="row no-scroll">
              <button
                type="button"
                className={`chip ${preset === "today" && !day ? "on" : "off"}`}
                onClick={() => {
                  setPreset("today");
                  setDay(null);
                }}
              >
                Heute
              </button>
              <button
                type="button"
                className={`chip ${preset === "week" && !day ? "on" : "off"}`}
                onClick={() => {
                  setPreset("week");
                  setDay(null);
                }}
              >
                7 Tage
              </button>
              <button
                type="button"
                className={`chip ${preset === "all" && !day ? "on" : "off"}`}
                onClick={() => {
                  setPreset("all");
                  setDay(null);
                }}
              >
                Alle Daten
              </button>
              {nFilters > 0 && (
                <button type="button" className="chip reset" onClick={clearFilters}>
                  Zurücksetzen
                </button>
              )}
            </div>

            <DayStrip selectedDay={day ?? (preset === "today" ? todayIso : null)} counts={counts} onSelect={setDay} />

            <div className="row tight no-scroll">
              <select
                className={`select-chip${filters.document_region ? " active" : ""}`}
                value={filters.document_region ?? ""}
                onChange={(e) => setFilters((f) => ({ ...f, document_region: e.target.value || undefined }))}
                aria-label="Kanton"
              >
                <option value="">Alle Kantone</option>
                {(meta?.cantons ?? []).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                className={`select-chip${filters.document_id != null ? " active" : ""}`}
                value={filters.document_id ?? ""}
                onChange={(e) => setFilters((f) => ({ ...f, document_id: e.target.value ? Number(e.target.value) : undefined }))}
                aria-label="Kirchenblatt-Ausgabe"
              >
                <option value="">Alle Ausgaben</option>
                {meta?.documents.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.region}
                  </option>
                ))}
              </select>
            </div>

            <div className="row tight no-scroll">
              <button
                type="button"
                className={`chip ${!filters.parish ? "on" : "off"}`}
                onClick={() => setFilters((f) => ({ ...f, parish: undefined }))}
              >
                Alle Standorte
              </button>
              {meta?.parishes.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`chip ${filters.parish === p ? "on" : "off"}`}
                  onClick={() => setFilters((f) => ({ ...f, parish: p }))}
                >
                  {p}
                </button>
              ))}
            </div>

            <div className="row tight no-scroll">
              <button
                type="button"
                className={`chip ${!filters.category ? "on" : "off"}`}
                onClick={() => setFilters((f) => ({ ...f, category: undefined }))}
              >
                Alle Feiern
              </button>
              {meta?.categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`chip ${filters.category === c ? "on" : "off"}`}
                  onClick={() => setFilters((f) => ({ ...f, category: c }))}
                >
                  {c}
                </button>
              ))}
            </div>

            <aside className="note">
              <Icon name="info" size={16} />
              <p>
                Diese Website nutzt KI, um Veranstaltungen zu finden, wobei gelegentlich Fehler auftreten können.
                Zur Sicherheit zeigen wir bei jedem Termin einen Ausschnitt des originalen Newsletters – bitte
                prüfen Sie diesen immer auf Zeit und Ort. Wir freuen uns über Ihr Feedback, übernehmen jedoch
                keine Haftung für fehlerhafte Angaben oder unangekündigte Änderungen des Herausgebers.
              </p>
            </aside>

            {error != null && (
              <div className="empty">
                <p>Die Termine konnten nicht geladen werden.</p>
              </div>
            )}

            {featured && <FeaturedCard event={featured} onSelect={openEvent} />}

            <div className="count-row">
              <p className="n">{sorted.length === 1 ? "1 Gottesdienst" : `${sorted.length} Gottesdienste`}</p>
              {filters.parish && <p className="place">{filters.parish}</p>}
              {!filters.parish && filters.document_region && <p className="place">Kanton {filters.document_region}</p>}
            </div>

            {sorted.length === 0 ? (
              <div className="empty">
                <HostGlyph size={32} />
                <h2>Keine Gottesdienste</h2>
                <p>Für diese Auswahl ist im Kirchenblatt nichts eingetragen. Datum oder Pfarrei anpassen.</p>
                <button type="button" className="btn" style={{ marginTop: "1rem" }} onClick={clearFilters}>
                  Filter zurücksetzen
                </button>
              </div>
            ) : (
              <div style={{ marginTop: ".75rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                {[...grouped.entries()].map(([iso, events]) => (
                  <section className="section" key={iso}>
                    <header className="section-head">
                      <h2>{headingDate(iso)}</h2>
                    </header>
                    {isToday(iso) && <p className="today-label">Heute in den Pfarreien</p>}
                    <ul className="cards">
                      {events.map((e) => (
                        <PublicEventCard key={e.id} event={e} onSelect={openEvent} />
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </main>
        </div>

        <aside className="aside">
          {selectedEvent ? (
            <div className="aside-card">
              <p className="display" style={{ fontSize: "1.125rem", fontWeight: 600 }}>
                Kirchenblatt
              </p>
              <div style={{ marginTop: ".75rem" }}>
                <EventDetail event={selectedEvent} showFeedback onOpenParish={openParish} />
              </div>
            </div>
          ) : (
            <div className="aside-empty">
              <HostGlyph size={32} />
              <h2>Aus dem Kirchenblatt</h2>
              <p>Wählen Sie einen Gottesdienst, um den Ausschnitt aus dem Newsletter zu lesen.</p>
            </div>
          )}
        </aside>
      </div>

      {!desktop && <PublicBottomNav />}
      {!desktop && <SnippetSheet event={selectedEvent} onClose={() => setSelectedId(null)} onOpenParish={openParish} />}
      <FilterSheet
        open={filtersOpen}
        meta={meta}
        filters={filters}
        onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
        onClear={clearFilters}
        onClose={() => setFiltersOpen(false)}
      />
      <MenuDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  );
}
