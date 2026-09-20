// Ported 1:1 from the mockup's icon()/brandMark()/hostGlyph() helpers.
const PATHS: Record<string, string> = {
  menu: "M4 5h16M4 12h16M4 19h16",
  x: "M18 6 6 18M6 6l12 12",
  search: "",
  sliders: "M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6",
  calendar: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
  map: "m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z M9 3v15M15 6v15",
  church: "M10 9h4M12 7v5 M18 21V10l-6-4-6 4v11 M6 21h12M10 21v-4h4v4",
  info: "",
  filter: "M3 6h18M7 12h10M10 18h4",
  pin: "",
  share: "",
  pluscal: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M12 14v4M10 16h4",
  check: "M20 6 9 17l-5-5",
  left: "m15 18-6-6 6-6",
};

interface IconProps {
  name: keyof typeof PATHS;
  size?: number;
  className?: string;
}

export function Icon({ name, size = 20, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {name === "search" && (
        <>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3-3" />
        </>
      )}
      {name === "info" && (
        <>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </>
      )}
      {name === "pin" && (
        <>
          <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z" />
          <circle cx="12" cy="10" r="3" />
        </>
      )}
      {name === "share" && (
        <>
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
        </>
      )}
      {!["search", "info", "pin", "share"].includes(name) &&
        PATHS[name].split(" M").map((seg, i) => (
          <path key={i} d={i === 0 ? seg : "M" + seg} />
        ))}
    </svg>
  );
}

export function BrandMark({ className, size = 44 }: { className?: string; size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="currentColor" />
      <g fill="none" stroke="#F7F1E4" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="32" cy="22" r="9.5" strokeWidth="1.7" />
        <path d="M32 16.2v11.6M26.4 22h11.2" strokeWidth="1.5" />
        <path d="M20 38.5c2.2 7.4 6.6 12.5 12 12.5s9.8-5.1 12-12.5" strokeWidth="1.7" />
        <path d="M22.5 38.5h19" strokeWidth="1.6" />
        <path d="M32 38.5V51" strokeWidth="1.6" />
        <path d="M12 34.5c3.2-1 5.8.4 7.4 3.4 1.2-3.6 3.6-5.4 6.6-5.2" strokeWidth="1.35" />
        <path d="M52 34.5c-3.2-1-5.8.4-7.4 3.4-1.2-3.6-3.6-5.4-6.6-5.2" strokeWidth="1.35" />
      </g>
    </svg>
  );
}

export function HostGlyph({ size = 16, className = "host" }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="8.25" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M12 7.2v9.6M7.2 12h9.6" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function WheatRule({ style }: { style?: React.CSSProperties }) {
  return (
    <div className="wheat-rule" aria-hidden="true" style={style}>
      <span />
      <HostGlyph size={16} />
      <span />
    </div>
  );
}

/** Small inline marker shown next to Eucharistie/Kommunion cards — a
 * text-match heuristic since our real categories are freeform strings
 * with no formal "is this a Eucharistie" flag. */
export function isHostCategory(category: string | null): boolean {
  if (!category) return false;
  const c = category.toLowerCase();
  return c.includes("eucharistie") || c.includes("kommunion");
}
