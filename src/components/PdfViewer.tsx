import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
// eslint-disable-next-line import/no-unresolved
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import type { Event } from "../types";
import { api } from "../api/client";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const MIN_WIDTH = 280;
const MAX_WIDTH = 900;

// The public build has no backend/live PDF to render — see staticClient.ts's
// module docstring. This swaps in the pre-rendered snippet image
// export_public_data.py produces instead of live pdf.js rendering; the
// admin build never sets this env var, so it's always false there and
// every hook below runs exactly as it always has.
const isStatic = import.meta.env.VITE_DATA_MODE === "static";

interface Props {
  documentId: number | null;
  event: Event | null;
}

/** FR-5: client-side PDF rendering with a source-verification highlight
 * overlay, independent page navigation, and responsive width. */
export function PdfViewer({ documentId, event }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [containerWidth, setContainerWidth] = useState(600);
  const [scale, setScale] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // Load the PDF whenever the document changes.
  useEffect(() => {
    setPdfDoc(null);
    setError(null);
    if (documentId == null || isStatic) return;
    let cancelled = false;
    const task = pdfjsLib.getDocument({ url: api.documentPdfUrl(documentId) });
    task.promise
      .then((doc) => {
        if (!cancelled) setPdfDoc(doc);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load PDF");
      });
    return () => {
      cancelled = true;
      task.destroy();
    };
  }, [documentId]);

  // FR-5.1: jump to the selected event's exact source page. Keyed on
  // event.id (not the event object) so the ~2.5s background poll — which
  // hands PdfViewer a brand-new object for the same still-selected event —
  // doesn't re-trigger this and snap the user back mid-manual navigation.
  useEffect(() => {
    if (event && event.document_id === documentId) {
      setPageNum(event.page + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id, documentId]);

  // FR-5.4: responsive width, clamped 280-900px.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 600;
      setContainerWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, w)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Render the current page. Guards against two overlapping page.render()
  // calls racing on the shared canvas (e.g. a second navigation landing
  // before the first render settles), which otherwise corrupts the canvas
  // and surfaces as a spurious "Could not render page".
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    let cancelled = false;
    let renderTask: RenderTask | null = null;
    const clampedPage = Math.min(Math.max(pageNum, 1), pdfDoc.numPages);
    pdfDoc.getPage(clampedPage).then((page) => {
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
      renderTask.promise.catch((err) => {
        if (!cancelled && err?.name !== "RenderingCancelledException") setError("Could not render page");
      });
    });
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pdfDoc, pageNum, containerWidth]);

  const numPages = pdfDoc?.numPages ?? 0;
  const clampedPage = Math.min(Math.max(pageNum, 1), Math.max(numPages, 1));
  const showHighlights = event && event.document_id === documentId && event.page + 1 === clampedPage;

  if (isStatic) {
    if (!event) {
      return (
        <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-300 p-8 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Select an event to preview it.
        </div>
      );
    }
    return (
      <div className="flex h-full flex-col gap-2 overflow-auto rounded-lg border border-slate-200 bg-slate-100 p-2 dark:border-slate-800 dark:bg-slate-950">
        <img
          src={`/data/snippets/${event.id}.jpg`}
          alt={`${event.raw_date_text ?? ""} ${event.raw_time ?? ""} ${event.raw_event_type ?? ""}`}
          className="w-full rounded-md shadow"
        />
      </div>
    );
  }

  if (documentId == null) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-300 p-8 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        Select an event to view its source page.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
        <button
          type="button"
          disabled={clampedPage <= 1}
          onClick={() => setPageNum((p) => Math.max(1, p - 1))}
          className="rounded-md border border-slate-300 px-2 py-1 text-sm disabled:opacity-40 dark:border-slate-700"
        >
          ← Prev
        </button>
        <span className="text-sm text-slate-600 dark:text-slate-300">
          Page {clampedPage} {numPages ? `of ${numPages}` : ""}
        </span>
        <button
          type="button"
          disabled={numPages === 0 || clampedPage >= numPages}
          onClick={() => setPageNum((p) => Math.min(numPages, p + 1))}
          className="rounded-md border border-slate-300 px-2 py-1 text-sm disabled:opacity-40 dark:border-slate-700"
        >
          Next →
        </button>
      </div>

      <div
        ref={containerRef}
        className="relative flex-1 overflow-auto rounded-lg border border-slate-200 bg-slate-100 p-2 dark:border-slate-800 dark:bg-slate-950"
      >
        {error && <div className="p-4 text-sm text-red-600 dark:text-red-400">{error}</div>}
        <div className="relative inline-block">
          <canvas ref={canvasRef} className="block shadow" />
          {showHighlights &&
            event!.line_boxes.map((box, i) => (
              <div
                key={i}
                className="pointer-events-none absolute rounded-sm border-2 border-amber-400 bg-amber-300/30"
                style={{
                  left: box.x0 * scale,
                  top: box.y0 * scale,
                  width: (box.x1 - box.x0) * scale,
                  height: (box.y1 - box.y0) * scale,
                }}
              />
            ))}
        </div>
      </div>
    </div>
  );
}
