import { useState } from "react";
import { api } from "../api/client";
import type { LlmTestResult, LocalLlmStatus } from "../types";

interface Props {
  status: LocalLlmStatus | undefined;
}

/** FR-7.2/7.3 equivalent for the fully-local "Local LLM" extraction method:
 * whether llama-cpp-python is installed, whether the model has been
 * downloaded yet, and a one-click round-trip test. The test (and the first
 * real extraction) triggers the download if it hasn't happened yet, so it
 * can take a while the first time — that's expected, not a hang. */
export function LocalLlmStatusPanel({ status }: Props) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<LlmTestResult | null>(null);

  const runTest = async () => {
    setTesting(true);
    setResult(null);
    try {
      setResult(await api.testLocalLlm());
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Local LLM (offline)</h2>

      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-slate-500 dark:text-slate-400">Installed</dt>
        <dd className={status?.available ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>
          {status ? (status.available ? "Yes" : "No — see requirements-local-llm.txt") : "…"}
        </dd>
        <dt className="text-slate-500 dark:text-slate-400">Model downloaded</dt>
        <dd className={status?.downloaded ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400"}>
          {status ? (status.downloaded ? "Yes" : "Not yet — downloads on first use") : "…"}
        </dd>
        <dt className="text-slate-500 dark:text-slate-400">Model</dt>
        <dd className="break-all text-slate-800 dark:text-slate-200">
          {status ? `${status.repo_id} / ${status.model_file}` : "…"}
        </dd>
      </dl>

      <button
        type="button"
        disabled={testing || !status?.available}
        onClick={runTest}
        title={!status?.downloaded ? "First run downloads the model — this may take a minute or two" : ""}
        className="mt-3 rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
      >
        {testing ? "Testing… (downloading/loading the model can take a while the first time)" : "Test"}
      </button>

      {result && (
        <div
          className={`mt-3 rounded-md p-2 text-sm ${
            result.success
              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
          }`}
        >
          {result.success ? (
            <>
              ✓ Success in {result.latency_ms?.toFixed(0)}ms — reply: “{result.reply}”
            </>
          ) : (
            <>✗ {result.error}</>
          )}
        </div>
      )}

      <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
        Runs entirely on this machine, CPU-bound by default — noticeably slower per column than the
        cloud LLM method (seconds rather than sub-second), so a full document can take several minutes.
        Swap models via <code>LOCAL_LLM_REPO</code>/<code>LOCAL_LLM_FILE</code> in <code>.env</code>.
      </p>
    </div>
  );
}
