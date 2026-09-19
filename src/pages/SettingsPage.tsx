import { api } from "../api/client";
import { LlmStatusPanel } from "../components/LlmStatusPanel";
import { LocalLlmStatusPanel } from "../components/LocalLlmStatusPanel";
import { LocationMappingTable } from "../components/LocationMappingTable";
import { MappingTable } from "../components/MappingTable";
import { usePoll } from "../hooks/usePoll";

export function SettingsPage() {
  const { data: mappings, refetch } = usePoll(() => api.listMappings("all"), []);
  const { data: locationMappings, refetch: refetchLocations } = usePoll(
    () => api.listLocationMappings(),
    []
  );
  const { data: meta } = usePoll(() => api.getMeta({}), []);
  const { data: llmStatus } = usePoll(() => api.getLlmStatus(), []);
  const { data: localLlmStatus } = usePoll(() => api.getLocalLlmStatus(), []);

  const knownPlaces = [
    ...new Set(
      (locationMappings ?? [])
        .filter((m) => m.kind !== "ignore")
        .map((m) => m.corrected_value || m.raw_text)
    ),
  ];

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h1 className="mb-3 text-lg font-semibold text-slate-800 dark:text-slate-100">
          Category mapping
        </h1>
        <MappingTable
          mappings={mappings ?? []}
          categories={meta?.categories ?? []}
          knownPlaces={knownPlaces}
          onChanged={refetch}
        />
      </section>

      <section>
        <h1 className="mb-3 text-lg font-semibold text-slate-800 dark:text-slate-100">
          Parish &amp; place review
        </h1>
        <LocationMappingTable mappings={locationMappings ?? []} onChanged={refetchLocations} />
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div>
          <h1 className="mb-3 text-lg font-semibold text-slate-800 dark:text-slate-100">
            LLM diagnostics
          </h1>
          <LlmStatusPanel status={llmStatus} />
        </div>
        <div>
          <h1 className="mb-3 text-lg font-semibold text-slate-800 dark:text-slate-100">
            Local LLM diagnostics
          </h1>
          <LocalLlmStatusPanel status={localLlmStatus} />
        </div>
      </section>
    </div>
  );
}
