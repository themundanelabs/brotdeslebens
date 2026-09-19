import { useRef, useState } from "react";
import { api } from "../api/client";

interface Props {
  onUploaded: () => void;
}

/** FR-1.1/1.2: upload one or more PDFs at once; per-file rejection surfaces
 * the offending filename. */
export function DocumentUploadForm({ onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await api.uploadDocuments(Array.from(files));
      onUploaded();
    } catch (err) {
      setError(err instanceof api.ApiError ? err.detail : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Upload Kirchenblatt PDF(s)
        </span>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          multiple
          disabled={busy}
          onChange={(e) => handleFiles(e.target.files)}
          className="text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-sky-600 file:px-3 file:py-1.5 file:text-white hover:file:bg-sky-700 dark:text-slate-300"
        />
      </label>
      {busy && <p className="mt-2 text-sm text-slate-500">Uploading…</p>}
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
