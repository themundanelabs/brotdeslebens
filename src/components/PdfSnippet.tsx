import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
// eslint-disable-next-line import/no-unresolved
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import { api } from "../api/client";
import type { Event } from "../types";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const MIN_WIDTH = 280;
const MAX_WIDTH = 640;
// PDF points of context kept around the event on each side — vertical
// padding shows the parish banner/neighboring events above and below;
// horizontal padding (plus the minimum column width) keeps a short
// one-line event from cropping to an unreadably narrow sliver.
const V_PAD = 55;
const H_PAD = 24;
const MIN_COLUMN_WIDTH = 220;

// The public build has no backend/live PDF to crop from — see
// staticClient.ts's module docstring. This swaps in the pre-rendered
// snippet image export_public_data.py produces (using these exact same
// MIN_COLUMN_WIDTH/H_PAD/V_PAD constants server-side, kept in sync by
// hand) instead of live pdf.js cropping. The admin build never sets this
// env var, so it's always false there and every hook below runs exactly
// as it always has.
const isStatic = import.meta.env.VITE_DATA_MODE === "static";

interface Props {
  documentId: number | null;
  event: Event | null;
}

/** A cropped, zoomed-in render of just the area around one event — a
 * "newsletter preview" sized for a narrow (phone-width) panel, in
 * contrast to PdfViewer's full-page + highlight-box view. Trades page-
 * level context for legibility at small widths. */
export function PdfSnippet({ documentId, event }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [containerWidth, setContainerWidth] = useState(420);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 420;
      setContainerWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, w)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current || !event) return;
    let cancelled = false;
    const pageNum = event.page + 1;

    pdfDoc.getPage(pageNum).then((page) => {
      if (cancelled) return;
      const unscaled = page.getViewport({ scale: 1 });

      const xs0 = event.line_boxes.map((b) => b.x0);
      const xs1 = event.line_boxes.map((b) => b.x1);
      const eventX0 = Math.min(...xs0);
      const eventX1 = Math.max(...xs1);
      const desiredWidth = Math.max(MIN_COLUMN_WIDTH, eventX1 - eventX0 + 2 * H_PAD);
      const centerX = (eventX0 + eventX1) / 2;
      let cropX0 = centerX - desiredWidth / 2;
      let cropX1 = centerX + desiredWidth / 2;
      if (cropX0 < 0) {
        cropX1 -= cropX0;
        cropX0 = 0;
      }
      if (cropX1 > unscaled.width) {
        cropX0 -= cropX1 - unscaled.width;
        cropX1 = unscaled.width;
      }
      cropX0 = Math.max(0, cropX0);
      cropX1 = Math.min(unscaled.width, cropX1);

      const cropY0 = Math.max(0, event.bbox.y0 - V_PAD);
      const cropY1 = Math.min(unscaled.height, event.bbox.y1 + V_PAD);
      const cropWidth = cropX1 - cropX0;
      const cropHeight = cropY1 - cropY0;
      if (cropWidth <= 0 || cropHeight <= 0) return;

      const scale = containerWidth / cropWidth;
      const viewport = page.getViewport({ scale });

      const full = document.createElement("canvas");
      full.width = viewport.width;
      full.height = viewport.height;
      const fullCtx = full.getContext("2d")!;

      page
        .render({ canvasContext: fullCtx, viewport, canvas: full })
        .promise.then(() => {
          if (cancelled) return;
          const canvas = canvasRef.current!;
          const destW = Math.round(cropWidth * scale);
          const destH = Math.round(cropHeight * scale);
          canvas.width = destW;
          canvas.height = destH;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(
            full,
            cropX0 * scale,
            cropY0 * scale,
            destW,
            destH,
            0,
            0,
            destW,
            destH
          );

          ctx.strokeStyle = "rgba(217, 119, 6, 0.9)"; // amber-600
          ctx.fillStyle = "rgba(252, 211, 77, 0.25)"; // amber-300/25
          ctx.lineWidth = 2;
          for (const box of event.line_boxes) {
            const x = (box.x0 - cropX0) * scale;
            const y = (box.y0 - cropY0) * scale;
            const w = (box.x1 - box.x0) * scale;
            const h = (box.y1 - box.y0) * scale;
            ctx.fillRect(x, y, w, h);
            ctx.strokeRect(x, y, w, h);
          }
        })
        .catch((err) => {
          if (!cancelled && err?.name !== "RenderingCancelledException") {
            setError("Could not render preview");
          }
        });
    });

    return () => {
      cancelled = true;
    };
  }, [pdfDoc, event, containerWidth]);

  if (!event) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        Select an event on the map to preview it here.
      </div>
    );
  }

  if (isStatic) {
    return (
      <div className="flex flex-col gap-2">
        <div
          ref={containerRef}
          className="overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-950"
        >
          <img src={`${import.meta.env.BASE_URL}data/snippets/${event.id}.jpg`} alt="" className="block w-full" />
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {event.raw_date_text} · {event.raw_time} · {event.raw_event_type}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={containerRef}
        className="overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-950"
      >
        {error ? (
          <div className="p-4 text-sm text-red-600 dark:text-red-400">{error}</div>
        ) : (
          <canvas ref={canvasRef} className="block w-full" />
        )}
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {event.raw_date_text} · {event.raw_time} · {event.raw_event_type} — page {event.page + 1}
      </p>
    </div>
  );
}
