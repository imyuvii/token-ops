import { AppShell } from "@/components/app-shell";
import { FilterBar } from "@/components/filter-bar";
import { StatusPill } from "@/components/status-pill";
import { getBenchmarks, getDashboardData, getRecommendations } from "@/lib/api";
import { parseDashboardFilters } from "@/lib/search-params";

export default async function OptimizerPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = await parseDashboardFilters(searchParams);
  const [dashboard, benchmarks, recommendations] = await Promise.all([
    getDashboardData(filters),
    getBenchmarks(filters),
    getRecommendations(filters),
  ]);

  return (
    <AppShell
      active="optimizer"
      title="Optimization benchmarks and recommendations"
      description="Turn observability into action with team benchmarks and concrete recommendations for cost, latency, and quality improvements."
    >
      <FilterBar options={dashboard.filters} current={filters} />

      <section className="rounded-[26px] border border-white/8 bg-white/5 p-5">
        <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Recommended actions</p>
        <h2 className="mt-2 font-space-grotesk text-2xl font-semibold text-white">
          Highest leverage improvements
        </h2>
        <div className="mt-6 grid gap-3 lg:grid-cols-2">
          {recommendations.map((recommendation) => (
            <article
              key={recommendation.title}
              className="rounded-[22px] border border-white/8 bg-[#0c1625] p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-space-grotesk text-lg text-white">{recommendation.title}</h3>
                  <p className="mt-2 text-sm text-slate-300">{recommendation.rationale}</p>
                </div>
                <StatusPill tone={recommendation.priority === "high" ? "danger" : "warning"}>
                  {recommendation.priority}
                </StatusPill>
              </div>
              <p className="mt-4 text-sm text-cyan-200">{recommendation.projected_impact}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[26px] border border-white/8 bg-white/5 p-5">
        <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Team benchmarks</p>
        <h2 className="mt-2 font-space-grotesk text-2xl font-semibold text-white">
          Relative operating efficiency
        </h2>

        <div className="mt-6 overflow-hidden rounded-[22px] border border-white/8">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-white/6 text-slate-300">
              <tr>
                <th className="px-4 py-3 font-medium">Team</th>
                <th className="px-4 py-3 font-medium">Efficiency</th>
                <th className="px-4 py-3 font-medium">Avg cost / req</th>
                <th className="px-4 py-3 font-medium">P95 latency</th>
                <th className="px-4 py-3 font-medium">Success rate</th>
              </tr>
            </thead>
            <tbody>
              {benchmarks.map((benchmark) => (
                <tr key={benchmark.team} className="border-t border-white/6">
                  <td className="px-4 py-4 font-medium text-white">{benchmark.team}</td>
                  <td className="px-4 py-4 text-slate-300">{benchmark.efficiency_score}</td>
                  <td className="px-4 py-4 text-slate-300">{benchmark.avg_cost_per_request}</td>
                  <td className="px-4 py-4 text-slate-300">{benchmark.p95_latency}</td>
                  <td className="px-4 py-4 text-slate-300">{benchmark.success_rate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
