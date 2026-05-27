import { AppShell } from "@/components/app-shell";
import { FilterBar } from "@/components/filter-bar";
import { StatusPill } from "@/components/status-pill";
import { getDashboardData, getPromptInsights } from "@/lib/api";
import { parseDashboardFilters } from "@/lib/search-params";

function toneForStatus(status: string): "success" | "warning" | "danger" {
  if (status === "Optimized") return "success";
  if (status === "Stable") return "warning";
  return "danger";
}

export default async function PromptsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = await parseDashboardFilters(searchParams);
  const [dashboard, prompts] = await Promise.all([
    getDashboardData(filters),
    getPromptInsights(filters),
  ]);

  return (
    <AppShell
      active="prompts"
      title="Prompt and version analytics"
      description="Compare prompt versions by cost, latency, request volume, and operational stability."
    >
      <FilterBar options={dashboard.filters} current={filters} />

      <section className="grid gap-4 lg:grid-cols-2">
        {prompts.map((prompt) => (
          <article
            key={`${prompt.name}-${prompt.version}-${prompt.owner}`}
            className="rounded-[26px] border border-white/8 bg-white/5 p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-space-grotesk text-2xl font-semibold text-white">{prompt.name}</p>
                <p className="mt-2 text-sm text-slate-400">
                  {prompt.version} • {prompt.owner} • {prompt.requests} requests
                </p>
              </div>
              <StatusPill tone={toneForStatus(prompt.status)}>{prompt.status}</StatusPill>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-2xl border border-white/8 bg-[#0c1625] p-4">
                <p className="text-slate-400">Success rate</p>
                <p className="mt-2 font-space-grotesk text-2xl text-white">{prompt.success_rate}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-[#0c1625] p-4">
                <p className="text-slate-400">Avg cost</p>
                <p className="mt-2 font-space-grotesk text-2xl text-white">{prompt.avg_cost}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-[#0c1625] p-4">
                <p className="text-slate-400">Latency</p>
                <p className="mt-2 font-space-grotesk text-2xl text-white">{prompt.avg_latency}</p>
              </div>
            </div>
          </article>
        ))}
      </section>
    </AppShell>
  );
}

