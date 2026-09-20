import { useEffect, useMemo, useState } from "react";
import "../theme.css";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
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

// Same rationale as the admin MapPage's CHURCH_ICON — an inline SVG
// rather than Leaflet's default marker image, since Vite doesn't
// reliably resolve Leaflet's bundled marker PNG paths. Tinted to the
// mockup's wine colour instead of admin's orange for visual consistency
// with the rest of the public site.
const CHURCH_ICON = L.divIcon({
  className: "",
  html: `<svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">
    <path d="M15 0C6.716 0 0 6.716 0 15c0 10.5 15 25 15 25s15-14.5 15-25C30 6.716 23.284 0 15 0z" fill="#6E2430"/>
    <g fill="white">
      <rect x="14" y="5" width="2" height="5"/>
      <rect x="12.3" y="7" width="5.4" height="1.6"/>
      <polygon points="15,9.5 8,15.5 22,15.5"/>
      <rect x="9" y="15.5" width="12" height="8.5"/>
      <rect x="13" y="19.5" width="4" height="4.5" fill="#6E2430"/>
    </g>
  </svg>`,
  iconSize: [30, 40],
  iconAnchor: [15, 40],
  popupAnchor: [0, -36],
});

const YOU_ICON = L.divIcon({
  className: "",
  html: '<div style="width:16px;height:16px;border-radius:50%;background:#0ea5e9;border:2px solid white;box-shadow:0 0 0 2px #0ea5e9;"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const SOLOTHURN_CENTER: [number, number] = [47.29, 7.7];

function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const lat1 = (a[0] * Math.PI) / 180;
  const lat2 = (b[0] * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 12);
    } else {
      map.fitBounds(points, { padding: [32, 32] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(points)]);
  return null;
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
  const [filters, setFilters] = useState<EventFilters>({});
  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);

  const [address, setAddress] = useState("");
  const [addressCoords, setAddressCoords] = useState<[number, number] | null>(null);
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
      distanceKm: addressCoords ? haversineKm(addressCoords, [loc.lat, loc.lon]) : null,
    }));
    if (addressCoords) withDistance.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
    else withDistance.sort((a, b) => a.place.localeCompare(b.place));
    return withDistance;
  }, [locations, addressCoords]);

  const points: [number, number][] = useMemo(
    () =>
      addressCoords
        ? [addressCoords, ...locations.map((l): [number, number] => [l.lat, l.lon])]
        : locations.map((l): [number, number] => [l.lat, l.lon]),
    [locations, addressCoords]
  );

  const findNearest = async () => {
    const q = address.trim();
    if (!q) return;
    setLocating(true);
    setLocateError(null);
    try {
      const { lat, lon } = await api.geocodeAddress(q);
      setAddressCoords([lat, lon]);
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
              <MapContainer center={SOLOTHURN_CENTER} zoom={10} style={{ width: "100%", height: "360px" }}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <FitBounds points={points} />
                {addressCoords && (
                  <Marker position={addressCoords} icon={YOU_ICON}>
                    <Popup>Sie sind hier</Popup>
                  </Marker>
                )}
                {locations.map((loc) => (
                  <Marker key={loc.place} position={[loc.lat, loc.lon]} icon={CHURCH_ICON}>
                    <Popup>
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px", fontSize: "12px" }}>
                        <strong>{loc.place}</strong>
                        {loc.events.map((e) => (
                          <button
                            key={e.id}
                            type="button"
                            onClick={() => setSelectedId(e.id)}
                            style={{ textAlign: "left", background: "none", border: 0, padding: "2px 0", cursor: "pointer" }}
                          >
                            {e.raw_date_text} {e.raw_time && `· ${e.raw_time}`} · {e.raw_event_type}
                          </button>
                        ))}
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
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
