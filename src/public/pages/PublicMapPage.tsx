import { useEffect, useMemo, useState } from "react";
import "../theme.css";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import { api } from "../../api/client";
import { usePoll } from "../../hooks/usePoll";
import type { Event, EventFilters, MapLocation } from "../../types";
import { PublicHeader } from "../components/PublicHeader";
import { PublicBottomNav } from "../components/PublicBottomNav";
import { MenuDrawer } from "../components/MenuDrawer";
import { SnippetSheet } from "../components/SnippetSheet";
import { EventDetail } from "../components/EventDetail";
import { Icon, HostGlyph } from "../icons";
import { formatTimeCompact } from "../dates";

const SOLOTHURN_CENTER = { lat: 47.29, lng: 7.7 };
const MAP_LIBRARIES: "places"[] = ["places"];

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function nextByParish(events: Event[]): Record<string, Event> {
  const next: Record<string, Event> = {};
  const now = new Date();
  const upcoming = events
    .filter((e) => e.iso_date && e.iso_date >= now.toISOString().slice(0, 10))
    .sort((a, b) => `${a.iso_date}${a.raw_time ?? ""}`.localeCompare(`${b.iso_date}${b.raw_time ?? ""}`));
  for (const e of upcoming) {
    if (e.parish && !next[e.parish]) next[e.parish] = e;
  }
  return next;
}

export function PublicMapPage() {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey ?? "",
    libraries: MAP_LIBRARIES,
  });

  const [filters, setFilters] = useState<EventFilters>({});
  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);

  const [address, setAddress] = useState("");
  const [addressCoords, setAddressCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [desktop, setDesktop] = useState(() => window.matchMedia("(min-width: 768px)").matches);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = (ev: MediaQueryListEvent) => setDesktop(ev.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const { data: meta } = usePoll(() => api.getMeta(filters), [filtersKey]);
  const { data: mapData } = usePoll(() => api.getMapLocations(filters), [filtersKey]);
  const { data: allEvents } = usePoll(() => api.listEvents(filters), [filtersKey]);
  const eventsById = useMemo(() => new Map((allEvents ?? []).map((e) => [e.id, e])), [allEvents]);
  const selectedEvent = selectedId != null ? eventsById.get(selectedId) ?? null : null;
  const next = useMemo(() => nextByParish(allEvents ?? []), [allEvents]);

  const locations = mapData?.locations ?? [];

  const sorted: (MapLocation & { distanceKm: number | null })[] = useMemo(() => {
    const withDistance = locations.map((loc) => ({
      ...loc,
      distanceKm: addressCoords ? haversineKm(addressCoords, { lat: loc.lat, lng: loc.lon }) : null,
    }));
    if (addressCoords) withDistance.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
    else withDistance.sort((a, b) => a.place.localeCompare(b.place));
    return withDistance;
  }, [locations, addressCoords]);

  const findNearest = async () => {
    const q = address.trim();
    if (!q) return;
    setLocating(true);
    setLocateError(null);
    try {
      const { lat, lon } = await api.geocodeAddress(q);
      setAddressCoords({ lat, lng: lon });
    } catch {
      setLocateError("Adresse nicht gefunden. Bitte Strasse und Ort angeben.");
      setAddressCoords(null);
    } finally {
      setLocating(false);
    }
  };

  const openParish = (parish: string) => {
    setFilters((f) => ({ ...f, parish }));
    setSelectedId(null);
  };

  return (
    <div className="bdl">
      <div className="wrap">
        <div className="col">
          <PublicHeader
            subtitle="Orte · Buchsgau & Gäu"
            activeFilterCount={0}
            showFilterButton={false}
            showVerse={false}
            onOpenMenu={() => setMenuOpen(true)}
            onOpenFilters={() => {}}
          />
          <main className="main">
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
                className={`select-chip${filters.parish ? " active" : ""}`}
                value={filters.parish ?? ""}
                onChange={(e) => setFilters((f) => ({ ...f, parish: e.target.value || undefined }))}
                aria-label="Gemeinde"
              >
                <option value="">Alle Gemeinden</option>
                {meta?.parishes.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div className="search" style={{ marginTop: ".75rem" }}>
              <span className="lead">
                <Icon name="pin" size={16} />
              </span>
              <input
                type="text"
                placeholder="Ihre Adresse (Strasse, Ort)…"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && findNearest()}
              />
            </div>
            <div className="row no-scroll">
              <button type="button" className="chip on" disabled={locating || !address.trim()} onClick={findNearest}>
                {locating ? "Suche…" : "Nächste finden"}
              </button>
              {addressCoords && (
                <button
                  type="button"
                  className="chip reset"
                  onClick={() => {
                    setAddressCoords(null);
                    setAddress("");
                  }}
                >
                  Zurücksetzen
                </button>
              )}
            </div>
            {locateError && (
              <p className="sub" style={{ color: "var(--wine)" }}>
                {locateError}
              </p>
            )}

            <div className="map-card" style={{ marginTop: "1rem" }}>
              {!apiKey ? (
                <p style={{ padding: "1.5rem" }}>
                  Karte noch nicht verfügbar — Google Maps API-Schlüssel fehlt.
                </p>
              ) : loadError ? (
                <p style={{ padding: "1.5rem" }}>Karte konnte nicht geladen werden.</p>
              ) : !isLoaded ? (
                <p style={{ padding: "1.5rem" }}>Karte wird geladen…</p>
              ) : (
                <GoogleMap
                  mapContainerStyle={{ width: "100%", height: "360px" }}
                  center={addressCoords ?? SOLOTHURN_CENTER}
                  zoom={addressCoords ? 12 : 10}
                >
                  {addressCoords && (
                    <Marker
                      position={addressCoords}
                      icon={{
                        path: window.google.maps.SymbolPath.CIRCLE,
                        scale: 8,
                        fillColor: "#0ea5e9",
                        fillOpacity: 1,
                        strokeColor: "#fff",
                        strokeWeight: 2,
                      }}
                    />
                  )}
                  {locations.map((loc) => (
                    <Marker
                      key={loc.place}
                      position={{ lat: loc.lat, lng: loc.lon }}
                      title={loc.place}
                      onClick={() => loc.events[0] && setSelectedId(loc.events[0].id)}
                    />
                  ))}
                </GoogleMap>
              )}
            </div>

            <ul className="map-list">
              {sorted.length === 0 && <p className="sub">Keine Orte für diese Auswahl.</p>}
              {sorted.map((loc) => {
                const n = next[loc.place];
                return (
                  <li key={loc.place}>
                    <button
                      type="button"
                      className={`map-item${selectedId != null && loc.events.some((e) => e.id === selectedId) ? " on" : ""}`}
                      onClick={() => loc.events[0] && setSelectedId(loc.events[0].id)}
                    >
                      <span className="pin">
                        <Icon name="pin" size={16} />
                      </span>
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span className="nm">{loc.place}</span>
                        <span className="ch">
                          {loc.events.length} {loc.events.length === 1 ? "Termin" : "Termine"}
                          {loc.distanceKm != null ? ` · ${loc.distanceKm.toFixed(1)} km` : ""}
                        </span>
                      </span>
                      <span className="nx">
                        {n ? (
                          <>
                            <span className="t">{formatTimeCompact(n.raw_time)}</span>
                            <span className="l">nächste Feier</span>
                          </>
                        ) : (
                          <span className="l">—</span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
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
              <p>Wählen Sie einen Ort, um die nächste Feier zu sehen.</p>
            </div>
          )}
        </aside>
      </div>

      {!desktop && <PublicBottomNav />}
      {!desktop && <SnippetSheet event={selectedEvent} onClose={() => setSelectedId(null)} onOpenParish={openParish} />}
      <MenuDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  );
}
