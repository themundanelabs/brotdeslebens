import { api } from "../api/client";
import { DocumentRow } from "../components/DocumentRow";
import { DocumentUploadForm } from "../components/DocumentUploadForm";
import { usePoll } from "../hooks/usePoll";

export function DocumentsPage() {
  const { data: documents, refetch } = usePoll(() => api.listDocuments(), []);
  const { data: llmStatus } = usePoll(() => api.getLlmStatus(), []);
  const { data: localLlmStatus } = usePoll(() => api.getLocalLlmStatus(), []);
  const { data: layouts, refetch: refetchLayouts } = usePoll(() => api.listLayouts(), []);

  return (
    <div className="flex flex-col gap-4">
      <DocumentUploadForm onUploaded={refetch} />

      {!llmStatus?.configured && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Online LLM Service extraction is disabled — set <code>LLM_API_KEY</code> in the backend
          <code> .env</code> to enable it. See the Settings page for connection diagnostics.
        </p>
      )}
      {!localLlmStatus?.available && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Local LLM extraction is disabled — install it with{" "}
          <code>
            pip install -r requirements-local-llm.txt --extra-index-url
            https://abetlen.github.io/llama-cpp-python/whl/cpu
          </code>{" "}
          to enable it. Fully offline (no API key, no network calls at inference time), but noticeably
          slower than the cloud LLM method on CPU — expect it to take a while per document.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {(documents ?? []).map((doc) => (
          <DocumentRow
            key={doc.id}
            doc={doc}
            layouts={layouts ?? []}
            llmConfigured={!!llmStatus?.configured}
            localLlmAvailable={!!localLlmStatus?.available}
            onChanged={refetch}
            onLayoutsChanged={refetchLayouts}
          />
        ))}
        {documents && documents.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            No documents yet — upload a Kirchenblatt PDF above.
          </div>
        )}
      </div>
    </div>
  );
}
