import type { Event } from "../types";

/** FR-6.1: formatted plain-text block for one event. */
export function formatEvent(e: Event): string {
  const lines = [
    e.document_region,
    [e.raw_date_text ?? "Date unknown", e.raw_time].filter(Boolean).join(", "),
    e.parish ?? e.region ?? "Parish/region unknown",
    e.raw_event_type ?? "",
    `Category: ${e.category ?? "Unmapped"}`,
  ];
  return lines.filter(Boolean).join("\n");
}

/** FR-6.1: formatted plain-text block for a list/group of events. */
export function formatEventList(events: Event[], title?: string): string {
  const header = title ? `${title}\n${"=".repeat(title.length)}\n\n` : "";
  return header + events.map(formatEvent).join("\n\n---\n\n");
}

export function mailtoLink(text: string, subject = "Kirchenblatt Agenda"): string {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
}

export function whatsappLink(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function telegramLink(text: string): string {
  return `https://t.me/share/url?url=&text=${encodeURIComponent(text)}`;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** FR-6.2: native Web Share API when available, falling back to copy. */
export async function shareOrCopy(text: string, title = "Kirchenblatt Agenda"): Promise<"shared" | "copied" | "failed"> {
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return "shared";
    } catch {
      // user cancelled or share failed — fall through to copy
    }
  }
  const ok = await copyToClipboard(text);
  return ok ? "copied" : "failed";
}
