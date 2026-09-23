import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
// eslint-disable-next-line import/no-unresolved
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import { api } from "../api/client";
import { usePoll } from "../hooks/usePoll";
import type { Event, LineOut, TrainResult } from "../types";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

type Mode = "parish" | "date_time" | "event_type" | "links";

const MIN_WIDTH = 280;
const MAX_WIDTH = 1000;

function eventKey(e: { page: number; bbox: { x0: number; y0: number; x1: number; y1: number } }): string {
  return `${e.page}|${e.bbox.x0}|${e.bbox.y0}|${e.bbox.x1}|${e.bbox.y1}`;
}

/** Trainer UI (brief step 4): pick which model to train before clicking —
 * Parish mode writes gold header-line labels for M1
 * (`parish_line_classifier.py`); Event type mode selects several events at
 * once, on the page or across the whole booklet, and bulk-applies one
 * category to all of them (feeds M2 the same `category_mappings` data the
 * Settings-page table does, just faster to review page by page); Links
 * mode writes gold event→header overrides for G (`spatial_linker.py`).
 * Each mode's "Retrain"/"Apply" action touches exactly one model's data —
 * never more than one. */
export function TrainPage() {
  const { id } = useParams<{ id: string }>();
  const documentId = Number(id);

  const [mode, setMode] = useState<Mode>("parish");
  const [pageNum, setPageNum] = useState(0); // 0-indexed, matches the backend's `page`
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [scale, setScale] = useState(1);
  const [containerWidth, setContainerWidth] = useState(700);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [lines, setLines] = useState<LineOut[]>([]);
  const [trainResult, setTrainResult] = useState<TrainResult | null>(null);
  const [training, setTraining] = useState(false);
  const [applying, setApplying] = useState(false);
  const [selectedEventKey, setSelectedEventKey] = useState<string | null>(null);
  const [linkStatus, setLinkStatus] = useState<"idle" | "saving" | "reextracting" | "done" | "error">("idle");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  // Event-type mode's selection persists across page navigation — "select
  // some on this page, flip through the booklet, select more, then apply
  // to everything at once" — keyed by eventKey() since Event.id can churn
  // across re-extractions but the bbox identity is what the user is
  // actually pointing at.
  const [selectedEvents, setSelectedEvents] = useState<Map<string, Event>>(new Map());
  const [blocklisting, setBlocklisting] = useState<string | null>(null);

  const { data: documents } = usePoll(() => api.listDocuments(), []);
  const doc = documents?.find((d) => d.id === documentId) ?? null;
  const { data: mappings, refetch: refetchMappings } = usePoll(() => api.listMappings("all"), []);
  const { data: meta, refetch: refetchMeta } = usePoll(() => api.getMeta({}), []);
  const { data: events, refetch: refetchEvents } = usePoll(
    () => api.listEvents({ document_id: documentId }),
    [documentId]
  );
  // Global, text-only "never a parish header" overrides (Trainer UI's own
  // blocklist section below) — separate from the per-occurrence gold
  // labels lines cycle through on click, which only train the model
  // rather than guaranteeing an exclusion.
  const { data: ignoredHeaders, refetch: refetchIgnoredHeaders } = usePoll(() => api.listIgnoredHeaders(), []);

  const categoryByType = new Map((mappings ?? []).map((m) => [m.raw_event_type, m.category]));

  useEffect(() => {
    if (!documentId) return;
    let cancelled = false;
    const task = pdfjsLib.getDocument({ url: api.documentPdfUrl(documentId) });
    task.promise.then((d) => {
      if (!cancelled) setPdfDoc(d);
    });
    return () => {
      cancelled = true;
      task.destroy();
    };
  }, [documentId]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 700;
      setContainerWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, w)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    let cancelled = false;
    let renderTask: RenderTask | null = null;
    const clamped = Math.min(Math.max(pageNum + 1, 1), pdfDoc.numPages);
    pdfDoc.getPage(clamped).then((page) => {
      if (cancelled) return;
      const unscaled = page.getViewport({ scale: 1 });
      const pageScale = containerWidth / unscaled.width;
      const viewport = page.getViewport({ scale: pageScale });
      const canvas = canvasRef.current!;
      const context = canvas.getContext("2d")!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      setScale(pageScale);
      renderTask = page.render({ canvasContext: context, viewport, canvas });
      renderTask.promise.catch(() => {
        /* ignore — a superseded render is expected on rapid page changes */
      });
    });
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pdfDoc, pageNum, containerWidth]);

  useEffect(() => {
    if (!documentId || (mode !== "parish" && mode !== "links" && mode !== "date_time")) return;
    let cancelled = false;
    api.getDocumentLines(documentId, pageNum).then((fresh) => {
      if (!cancelled) setLines(fresh);
    });
    return () => {
      cancelled = true;
    };
  }, [documentId, pageNum, mode]);

  const pageEvents = (events ?? []).filter((e) => e.page === pageNum);

  const cycleLabel = (current: LineOut["label"]): LineOut["label"] => {
    if (current === null) return "parish";
    if (current === "parish") return "not_parish";
    return null;
  };

  const cycleRole = (current: LineOut["role_label"]): LineOut["role_label"] => {
    if (current === null) return "date_heading";
    if (current === "date_heading") return "time_event";
    if (current === "time_event") return "other";
    return null;
  };

  const handleLineClick = async (line: LineOut) => {
    if (mode === "parish") {
      const next = cycleLabel(line.label);
      setLines((prev) => prev.map((l) => (l === line ? { ...l, label: next } : l)));
      await api.setParishLineLabel(documentId, {
        page: line.page,
        x0: line.x0,
        y0: line.y0,
        x1: line.x1,
        y1: line.y1,
        text: line.text,
        label: next,
      });
    } else if (mode === "date_time") {
      const next = cycleRole(line.role_label);
      setLines((prev) => prev.map((l) => (l === line ? { ...l, role_label: next } : l)));
      await api.setLineRoleLabel(documentId, {
        page: line.page,
        x0: line.x0,
        y0: line.y0,
        x1: line.x1,
        y1: line.y1,
        text: line.text,
        role: next,
      });
    } else if (mode === "links" && selectedEventKey) {
      const [ep, ex0, ey0, ex1, ey1] = selectedEventKey.split("|").map(Number);
      setSelectedEventKey(null);
      setLinkStatus("saving");
      try {
        await api.setEventParishLink(documentId, {
          event_page: ep,
          event_x0: ex0,
          event_y0: ey0,
          event_x1: ex1,
          event_y1: ey1,
          header_page: line.page,
          header_x0: line.x0,
          header_y0: line.y0,
          header_x1: line.x1,
          header_y1: line.y1,
        });
        // The link is only consulted by G (spatial_linker.link_parish)
        // during extraction — writing it doesn't touch the parish already
        // stored on existing events, so nothing would visibly change
        // without re-running extraction now.
        setLinkStatus("reextracting");
        await api.extractDocument(documentId, doc?.extraction_method ?? "local");
        await refetchEvents();
        setLinkStatus("done");
        setTimeout(() => setLinkStatus("idle"), 2500);
      } catch {
        setLinkStatus("error");
      }
    }
  };

  // Blocklist a line's exact text as never a parish header — global and
  // text-only (not tied to this one document/page/bbox), so it takes
  // effect for every layout's future predictions immediately. It does
  // NOT touch documents already extracted; re-extract to apply it to
  // events already stored (same caveat as Links mode above).
  const blocklistHeader = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setBlocklisting(trimmed);
    try {
      await api.setLocationMapping(trimmed, { kind: "ignore", corrected_value: null });
      await refetchIgnoredHeaders();
      setLines(await api.getDocumentLines(documentId, pageNum));
    } finally {
      setBlocklisting(null);
    }
  };

  const unblocklistHeader = async (text: string) => {
    setBlocklisting(text);
    try {
      await api.setLocationMapping(text, { kind: null, corrected_value: null });
      await refetchIgnoredHeaders();
      setLines(await api.getDocumentLines(documentId, pageNum));
    } finally {
      setBlocklisting(null);
    }
  };

  const toggleEventSelection = (e: Event) => {
    const key = eventKey(e);
    setSelectedEvents((prev) => {
      const next = new Map(prev);
      if (next.has(key)) next.delete(key);
      else next.set(key, e);
      return next;
    });
  };

  const applyCategory = async (category: string | null) => {
    const rawTypes = [...new Set([...selectedEvents.values()].map((e) => e.raw_event_type).filter((t): t is string => !!t))];
    if (rawTypes.length === 0) return;
    setApplying(true);
    try {
      await api.bulkSetCategory(rawTypes, category);
      setSelectedEvents(new Map());
      refetchMappings();
      refetchEvents();
    } finally {
      setApplying(false);
    }
  };

  const addCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    setAddingCategory(true);
    try {
      await api.addCategory(name);
      setNewCategoryName("");
      refetchMeta();
    } finally {
      setAddingCategory(false);
    }
  };

  const retrain = async (model: "parish" | "event_type" | "line_role") => {
    setTraining(true);
    try {
      const result = await api.trainModel(model, documentId);
      setTrainResult(result);
      if (model === "parish" || model === "line_role") {
        setLines(await api.getDocumentLines(documentId, pageNum));
      } else {
        refetchMappings();
      }
    } finally {
      setTraining(false);
    }
  };

  const numPages = pdfDoc?.numPages ?? 0;
  const overlayLines = mode === "parish" || mode === "links" || mode === "date_time" ? lines : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
          Train: {doc?.original_filename ?? `Document ${documentId}`}
        </h1>
        <Link to="/documents" className="text-sm text-sky-600 hover:underline dark:text-sky-400">
          ← Back to Documents
        </Link>
      </div>

      <div className="flex gap-2">
        {([
          ["parish", "Parish headers"],
          ["date_time", "Date & Time"],
          ["event_type", "Event types"],
          ["links", "Links"],
        ] as [Mode, string][]).map(([m, label]) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              mode === m
                ? "bg-sky-600 text-white"
                : "border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
            <button
              type="button"
              disabled={pageNum <= 0}
              onClick={() => setPageNum((p) => Math.max(0, p - 1))}
              className="rounded-md border border-slate-300 px-2 py-1 text-sm disabled:opacity-40 dark:border-slate-700"
            >
              ← Prev
            </button>
            <span className="text-sm text-slate-600 dark:text-slate-300">
              Page {pageNum + 1} {numPages ? `of ${numPages}` : ""}
            </span>
            <button
              type="button"
              disabled={numPages === 0 || pageNum + 1 >= numPages}
              onClick={() => setPageNum((p) => Math.min(Math.max(numPages - 1, 0), p + 1))}
              className="rounded-md border border-slate-300 px-2 py-1 text-sm disabled:opacity-40 dark:border-slate-700"
            >
              Next →
            </button>
          </div>

          <div
            ref={containerRef}
            className="relative overflow-auto rounded-lg border border-slate-200 bg-slate-100 p-2 dark:border-slate-800 dark:bg-slate-950"
          >
            <div className="relative inline-block">
              <canvas ref={canvasRef} className="block shadow" />

              {overlayLines.map((line, i) => {
                const key = `${line.page}|${line.x0}|${line.y0}|${line.x1}|${line.y1}`;
                const bg =
                  mode === "date_time"
                    ? line.role_label === "date_heading"
                      ? "bg-sky-400/40 border-sky-500"
                      : line.role_label === "time_event"
                        ? "bg-purple-400/40 border-purple-500"
                        : line.role_label === "other"
                          ? "bg-red-400/20 border-red-500"
                          : "border-transparent"
                    : line.label === "parish"
                      ? "bg-emerald-400/40 border-emerald-500"
                      : line.label === "not_parish"
                        ? "bg-red-400/20 border-red-500"
                        : "border-transparent";
                // A confident prediction gets the plain ring as before; a
                // predicted header the model isn't sure about (M1's
                // features are purely structural — bold/white/size/
                // position/gazetteer, no actual text semantics — so
                // recurring boilerplate that happens to share those
                // structural traits with a real header, e.g. "Agenda",
                // often lands here) gets a thicker, differently-colored
                // ring instead, flagging it for a second look rather than
                // trusting it the same way.
                const ring =
                  mode === "date_time"
                    ? line.predicted_role
                      ? "ring-2 ring-amber-400"
                      : ""
                    : line.predicted_header
                      ? (line.header_confidence ?? 1) >= 0.8
                        ? "ring-2 ring-amber-400"
                        : "ring-4 ring-orange-500 ring-offset-1"
                      : "";
                const isBlocklisted = mode === "parish" && (ignoredHeaders ?? []).includes(line.text.trim());
                const title =
                  mode === "parish"
                    ? isBlocklisted
                      ? `${line.text} — blocklisted (right-click to remove)`
                      : `${line.text}${
                          line.header_confidence != null
                            ? ` (header confidence: ${Math.round(line.header_confidence * 100)}%)`
                            : ""
                        } — right-click to blocklist`
                    : line.text;
                return (
                  <button
                    key={key + i}
                    type="button"
                    onClick={() => handleLineClick(line)}
                    onContextMenu={(e) => {
                      if (mode !== "parish") return;
                      e.preventDefault();
                      if (isBlocklisted) unblocklistHeader(line.text.trim());
                      else blocklistHeader(line.text);
                    }}
                    title={title}
                    className={`absolute border ${bg} ${ring} cursor-pointer hover:border-sky-400 ${
                      isBlocklisted ? "bg-slate-500/40 opacity-60" : ""
                    }`}
                    style={{
                      left: line.x0 * scale,
                      top: line.y0 * scale,
                      width: (line.x1 - line.x0) * scale,
                      height: (line.y1 - line.y0) * scale,
                    }}
                  />
                );
              })}

              {mode === "event_type" &&
                pageEvents.map((e) => {
                  const key = eventKey(e);
                  const selected = selectedEvents.has(key);
                  const category = e.raw_event_type ? categoryByType.get(e.raw_event_type) : null;
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => toggleEventSelection(e)}
                      title={`${e.raw_event_type ?? ""} ${category ? `(${category})` : "(unmapped)"}`}
                      className={`absolute border-2 cursor-pointer ${
                        selected
                          ? "border-sky-500 bg-sky-400/30"
                          : category
                            ? "border-emerald-500/60 bg-emerald-400/10 hover:border-sky-400"
                            : "border-amber-500/60 bg-amber-400/10 hover:border-sky-400"
                      }`}
                      style={{
                        left: e.bbox.x0 * scale,
                        top: e.bbox.y0 * scale,
                        width: (e.bbox.x1 - e.bbox.x0) * scale,
                        height: (e.bbox.y1 - e.bbox.y0) * scale,
                      }}
                    />
                  );
                })}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {mode === "parish" && (
            <>
              <button
                type="button"
                disabled={training}
                onClick={() => retrain("parish")}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {training ? "Training…" : "Retrain M1 (parish)"}
              </button>
              {trainResult?.model === "parish" && (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Trained on {trainResult.positive_count} parish / {trainResult.negative_count} not-parish
                  examples.
                </p>
              )}
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Click a line to cycle: unlabeled → parish (green) → not parish (red) → unlabeled — a
                training example for this one occurrence. A thin amber ring means the model confidently
                predicts that line is a header (≥80%); a thick orange ring means it predicted "header" but
                isn't confident. Hover a line to see its exact confidence.
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                <strong>Right-click</strong> a line to blocklist its exact text as never a parish header,
                anywhere — this is a hard override (unlike the click-to-label training examples above, it
                doesn't rely on the model learning it) and applies immediately to every future prediction,
                across every document and layout. Blocklisted lines show greyed out on the page.
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5 text-xs text-amber-700 dark:border-slate-800 dark:bg-slate-900/60 dark:text-amber-400">
                Blocklisting doesn't change any document already extracted — it only stops that text from
                being predicted as a header <em>going forward</em>. Documents affected need to be
                re-extracted (Documents page, or the "Extract" action) for their already-stored events to
                pick up the change, and the public site needs re-exporting/redeploying after that.
              </div>

              <div className="flex flex-col gap-1 border-t border-slate-200 pt-3 dark:border-slate-800">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Blocklisted (never a parish header) — {(ignoredHeaders ?? []).length}
                </p>
                {(ignoredHeaders ?? []).length === 0 && (
                  <p className="text-xs text-slate-400">
                    None yet. Right-click a line on the page to add one.
                  </p>
                )}
                {(ignoredHeaders ?? []).map((text) => (
                  <div
                    key={text}
                    className="flex items-center justify-between gap-2 rounded-md border border-slate-200 px-2 py-1 text-xs dark:border-slate-800"
                  >
                    <span className="truncate" title={text}>
                      {text}
                    </span>
                    <button
                      type="button"
                      disabled={blocklisting === text}
                      onClick={() => unblocklistHeader(text)}
                      aria-label={`Remove "${text}" from the blocklist`}
                      className="shrink-0 rounded px-1.5 py-0.5 text-slate-400 hover:bg-red-100 hover:text-red-700 disabled:opacity-40 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {mode === "date_time" && (
            <>
              <button
                type="button"
                disabled={training}
                onClick={() => retrain("line_role")}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {training ? "Training…" : "Retrain M3 (date & time)"}
              </button>
              {trainResult?.model === "line_role" && (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Trained on {trainResult.positive_count} date-heading / {trainResult.negative_count}{" "}
                  time-event examples.
                </p>
              )}
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Click a line to cycle: unlabeled → date heading (blue) → time event (purple) → other (red) →
                unlabeled. Label a few "other" lines too (a parish header, a random line of body text) — the
                model needs negative examples to learn the difference, not just positive ones. An amber ring
                means the model (or, before one's trained yet, a generic fallback pattern) currently predicts
                that line is a date or time.
              </div>
            </>
          )}

          {mode === "event_type" && (
            <>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Click events on the page to select them (amber = unmapped, green = already categorized, blue
                = selected). Selection carries across pages — build up a batch across the whole booklet, then
                apply one category to all of it at once.
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-300">{selectedEvents.size} selected</span>
                {selectedEvents.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedEvents(new Map())}
                    className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {(meta?.categories ?? []).map((c) => (
                  <button
                    key={c}
                    type="button"
                    disabled={applying || selectedEvents.size === 0}
                    onClick={() => applyCategory(c)}
                    className="rounded-full bg-sky-600 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-40"
                  >
                    Apply "{c}"
                  </button>
                ))}
                <button
                  type="button"
                  disabled={applying || selectedEvents.size === 0}
                  onClick={() => applyCategory(null)}
                  className="rounded-full border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200"
                >
                  Clear category
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addCategory();
                  }}
                  placeholder="Add new category…"
                  className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                <button
                  type="button"
                  disabled={addingCategory || !newCategoryName.trim()}
                  onClick={addCategory}
                  className="shrink-0 rounded-md bg-slate-700 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-40 dark:bg-slate-600"
                >
                  {addingCategory ? "Adding…" : "Add"}
                </button>
              </div>

              <div className="flex items-center gap-3 border-t border-slate-200 pt-3 dark:border-slate-800">
                <button
                  type="button"
                  disabled={training}
                  onClick={() => retrain("event_type")}
                  className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                >
                  {training ? "Training…" : "Retrain M2 (event type)"}
                </button>
              </div>
              {trainResult?.model === "event_type" && (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Trained on {trainResult.positive_count} event / {trainResult.negative_count} place examples.
                </p>
              )}

              <div className="flex flex-col gap-1 border-t border-slate-200 pt-3 dark:border-slate-800">
                {pageEvents.map((e) => {
                  const key = eventKey(e);
                  const selected = selectedEvents.has(key);
                  const category = e.raw_event_type ? categoryByType.get(e.raw_event_type) : null;
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => toggleEventSelection(e)}
                      className={`flex items-center justify-between rounded-md border px-2 py-1.5 text-left text-xs ${
                        selected
                          ? "border-sky-500 bg-sky-50 dark:border-sky-400 dark:bg-sky-950/40"
                          : "border-slate-200 dark:border-slate-800"
                      }`}
                    >
                      <span>
                        {e.raw_time} · {e.raw_event_type}
                      </span>
                      <span className="text-slate-400">{category ?? "unmapped"}</span>
                    </button>
                  );
                })}
                {pageEvents.length === 0 && (
                  <p className="text-xs text-slate-400">No events extracted on this page yet.</p>
                )}
              </div>
            </>
          )}

          {mode === "links" && (
            <>
              <div className="flex flex-col gap-2 rounded-md border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
                <p>
                  Every event on the page gets its <strong>parish</strong> from the nearest parish-name
                  banner above it (a "header" — e.g. "Pfarrei Mümliswil"), worked out automatically by
                  measuring position on the page. Use Links mode when that automatic guess is wrong for one
                  specific event — for example a banner that visually spans several columns, or an event
                  sitting just after a column break, where the geometry picks the wrong banner.
                </p>
                <p>
                  <strong>How:</strong> click an event in the list below to select it, then click the
                  correct parish banner on the page to the left — an amber ring marks lines the model
                  already recognizes as banners, but any line can be clicked. The pairing is saved, then
                  the document is <strong>re-extracted automatically</strong> so the event's parish below
                  updates to match — that re-extraction takes a few seconds, watch the status line below.
                </p>
                <p>
                  This only fixes that one event's parish — it does not retrain any model or change how
                  other events on this or any other page are linked.
                </p>
              </div>
              {linkStatus !== "idle" && (
                <p
                  className={`text-xs font-medium ${
                    linkStatus === "error"
                      ? "text-red-600 dark:text-red-400"
                      : linkStatus === "done"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-sky-600 dark:text-sky-400"
                  }`}
                >
                  {linkStatus === "saving" && "Saving link…"}
                  {linkStatus === "reextracting" && "Re-extracting to apply the link…"}
                  {linkStatus === "done" && "✓ Applied — parish updated below."}
                  {linkStatus === "error" && "Something went wrong saving the link — try again."}
                </p>
              )}
              <div className="flex flex-col gap-1">
                {pageEvents.map((e) => {
                  const key = eventKey(e);
                  return (
                    <button
                      key={e.id}
                      type="button"
                      disabled={linkStatus === "saving" || linkStatus === "reextracting"}
                      onClick={() => setSelectedEventKey(key)}
                      className={`rounded-md border px-2 py-1.5 text-left text-xs disabled:opacity-50 ${
                        selectedEventKey === key
                          ? "border-sky-500 bg-sky-50 dark:border-sky-400 dark:bg-sky-950/40"
                          : "border-slate-200 dark:border-slate-800"
                      }`}
                    >
                      {e.raw_date_text} · {e.raw_time} · {e.raw_event_type} (parish: {e.parish ?? "—"})
                    </button>
                  );
                })}
                {pageEvents.length === 0 && (
                  <p className="text-xs text-slate-400">No events extracted on this page yet.</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
