import { useState } from "react";
import { copyToClipboard, mailtoLink, shareOrCopy, telegramLink, whatsappLink } from "../lib/share";

interface Props {
  text: string;
  title?: string;
}

/**
 * FR-6.2/6.3: copy, native share (falling back to copy), mailto, WhatsApp,
 * Telegram — all pre-filled with formatted text. Every handler stops
 * propagation so it never triggers the parent card's selection.
 */
export function ShareMenu({ text, title }: Props) {
  const [open, setOpen] = useState(false);
  const [justCopied, setJustCopied] = useState(false);

  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  const flashCopied = async () => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setJustCopied(true);
      setTimeout(() => setJustCopied(false), 1500);
    }
  };

  return (
    <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={stop(() => setOpen((o) => !o))}
        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        aria-label="Share"
      >
        {justCopied ? "Copied!" : "Share"}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-44 rounded-md border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <MenuButton
            label="Copy to clipboard"
            onClick={stop(async () => {
              await flashCopied();
              setOpen(false);
            })}
          />
          <MenuButton
            label="Share…"
            onClick={stop(async () => {
              const result = await shareOrCopy(text, title);
              if (result === "copied") await flashCopied();
              setOpen(false);
            })}
          />
          <MenuLink label="Email" href={mailtoLink(text, title)} onClose={() => setOpen(false)} />
          <MenuLink label="WhatsApp" href={whatsappLink(text)} onClose={() => setOpen(false)} />
          <MenuLink label="Telegram" href={telegramLink(text)} onClose={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}

function MenuButton({ label, onClick }: { label: string; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full rounded px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
    >
      {label}
    </button>
  );
}

function MenuLink({ label, href, onClose }: { label: string; href: string; onClose: () => void }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      className="block rounded px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
    >
      {label}
    </a>
  );
}
