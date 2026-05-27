import { AppShell } from "@/components/app-shell";
import { FilterBar } from "@/components/filter-bar";
import { StatusPill } from "@/components/status-pill";
import { requireSession } from "@/lib/auth";
import { getDashboardData, getQuality } from "@/lib/api";
import { parseDashboardFilters } from "@/lib/search-params";

export default async function QualityPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = await parseDashboardFilters(searchParams);
  const session = await requireSession();
  const [dashboard, quality] = await Promise.all([getDashboardData(filters), getQuality(filters)]);

  return (
    <AppShell
      active="quality"
      title="Quality and hallucination posture"
      description="Track confidence posture, inspect riskier prompt families, and review low-confidence request IDs for follow-up."
      session={session}
    >
      <FilterBar options={dashboard.filters} current={filters} />

      <div className="grid gap-4 md:grid-cols-3">
        {quality.metrics.map((metric) => (
          <article
            key={metric.label}
            className="rounded-[24px] border border-white/8 bg-white/5 p-5"
          >
            <p className="text-sm uppercase tracking-[0.24em] text-slate-400">{metric.label}</p>
            <p className="mt-3 font-space-grotesk text-4xl text-white">{metric.value}</p>
            <p className="mt-3 text-sm text-slate-300">{metric.trend}</p>
          </article>
        ))}
      </div>

      <section className="rounded-[26px] border border-white/8 bg-white/5 p-5">
        <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Signal breakdown</p>
        <h2 className="mt-2 font-space-grotesk text-2xl font-semibold text-white">
          Quality confidence drivers
        </h2>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {quality.signal_breakdown.map((signal) => (
            <article
              key={signal.label}
              className="rounded-[22px] border border-white/8 bg-[#0c1625] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-400">{signal.label}</p>
                  <p className="mt-2 font-space-grotesk text-3xl text-white">{signal.value}</p>
                </div>
                <StatusPill tone={signal.status === "healthy" ? "success" : "warning"}>
                  {signal.status}
                </StatusPill>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[26px] border border-white/8 bg-white/5 p-5">
        <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Prompt risk</p>
        <h2 className="mt-2 font-space-grotesk text-2xl font-semibold text-white">
          Prompt families needing the most attention
        </h2>

        <div className="mt-6 overflow-hidden rounded-[22px] border border-white/8">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-white/6 text-slate-300">
              <tr>
                <th className="px-4 py-3 font-medium">Prompt</th>
                <th className="px-4 py-3 font-medium">Owner</th>
                <th className="px-4 py-3 font-medium">Hallucination risk</th>
                <th className="px-4 py-3 font-medium">Confidence</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {quality.risky_prompts.map((prompt) => (
                <tr key={`${prompt.prompt_name}-${prompt.version}`} className="border-t border-white/6">
                  <td className="px-4 py-4 font-medium text-white">
                    {prompt.prompt_name}
                    <p className="mt-1 text-xs text-slate-500">{prompt.version}</p>
                  </td>
                  <td className="px-4 py-4 text-slate-300">{prompt.owner}</td>
                  <td className="px-4 py-4 text-slate-300">{prompt.hallucination_risk}</td>
                  <td className="px-4 py-4 text-slate-300">{prompt.confidence_score}</td>
                  <td className="px-4 py-4">
                    <StatusPill tone={prompt.quality_status === "Stable" ? "success" : "warning"}>
                      {prompt.quality_status}
                    </StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-[26px] border border-white/8 bg-white/5 p-5">
        <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Low confidence responses</p>
        <h2 className="mt-2 font-space-grotesk text-2xl font-semibold text-white">
          Review queue
        </h2>

        <div className="mt-6 grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
          {quality.low_confidence_cases.map((item) => (
            <article
              key={item.request_id}
              className="rounded-[22px] border border-white/8 bg-[#0c1625] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-space-grotesk text-lg text-white">{item.request_id}</p>
                <StatusPill tone={item.confidence_band === "low" ? "danger" : "warning"}>
                  {item.confidence_band}
                </StatusPill>
              </div>
              <p className="mt-2 text-sm text-slate-300">
                {item.prompt_name} • {item.model}
              </p>
              <p className="mt-2 text-sm text-slate-400">{item.risk_reason}</p>
              <p className="mt-3 text-sm text-cyan-200">
                {item.suggested_action}
              </p>
            </article>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
