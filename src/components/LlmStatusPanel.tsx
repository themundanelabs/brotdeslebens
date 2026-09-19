import { useState } from "react";
import { api } from "../api/client";
import type { LlmStatus, LlmTestResult } from "../types";

interface Props {
  status: LlmStatus | undefined;
}

/** FR-7.2/7.3: configuration visibility plus a one-click live connectivity
 * test. */
export function LlmStatusPanel({ status }: Props) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<LlmTestResult | null>(null);

  const runTest = async () => {
    setTesting(true);
    setResult(null);
    try {
      setResult(await api.testLlm());
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Online LLM Service</h2>

      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-slate-500 dark:text-slate-400">Configured</dt>
        <dd className={status?.configured ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>
          {status ? (status.configured ? "Yes" : "No — set LLM_API_KEY") : "…"}
        </dd>
        <dt className="text-slate-500 dark:text-slate-400">Base URL</dt>
        <dd className="text-slate-800 dark:text-slate-200">{status?.base_url ?? "…"}</dd>
        <dt className="text-slate-500 dark:text-slate-400">Model</dt>
        <dd className="text-slate-800 dark:text-slate-200">{status?.model ?? "…"}</dd>
      </dl>

      <button
        type="button"
        disabled={testing || !status?.configured}
        onClick={runTest}
        className="mt-3 rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
      >
        {testing ? "Testing…" : "Test connection"}
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
    </div>
  );
}
