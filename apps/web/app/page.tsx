import { AppShell } from "@/components/app-shell";
import { FilterBar } from "@/components/filter-bar";
import { StatusPill } from "@/components/status-pill";
import { getDashboardData } from "@/lib/api";
import { parseDashboardFilters } from "@/lib/search-params";
import type { SpendPoint } from "@/lib/types";

const latencyModels = [
  { key: "gpt-4.1", label: "GPT-4.1" },
  { key: "gpt-4.1-mini", label: "GPT-4.1-mini" },
  { key: "claude-sonnet", label: "Claude Sonnet" },
  { key: "gemini-flash", label: "Gemini Flash" },
] as const;

const accentStyles: Record<string, string> = {
  amber: "from-amber-300/20 to-amber-500/0 text-amber-200 ring-amber-300/20",
  cyan: "from-cyan-300/20 to-cyan-500/0 text-cyan-200 ring-cyan-300/20",
  coral: "from-orange-300/20 to-rose-500/0 text-orange-200 ring-orange-300/20",
  lime: "from-lime-300/20 to-lime-500/0 text-lime-200 ring-lime-300/20",
};

function heatColor(value: number): string {
  if (value >= 2400) return "bg-[#ff8b66]/85 text-slate-950";
  if (value >= 1800) return "bg-[#ffb36b]/70 text-slate-950";
  if (value >= 1200) return "bg-[#7bddff]/65 text-slate-950";
  return "bg-white/8 text-slate-200";
}

function buildChartPath(series: SpendPoint[], width: number, height: number): string {
  if (series.length === 0) return "";

  const maxValue = Math.max(...series.map((point) => point.spend));
  const minValue = Math.min(...series.map((point) => point.spend));
  const xStep = width / Math.max(series.length - 1, 1);
  const valueRange = Math.max(maxValue - minValue, 1);

  return series
    .map((point, index) => {
      const x = index * xStep;
      const y = height - ((point.spend - minValue) / valueRange) * (height - 24) - 12;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function buildAreaPath(linePath: string, width: number, height: number): string {
  if (!linePath) return "";
  return `${linePath} L ${width} ${height} L 0 ${height} Z`;
}

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = await parseDashboardFilters(searchParams);
  const data = await getDashboardData(filters);
  const chartWidth = 760;
  const chartHeight = 260;
  const linePath = buildChartPath(data.spend_series, chartWidth, chartHeight);
  const areaPath = buildAreaPath(linePath, chartWidth, chartHeight);

  return (
    <AppShell
      active="overview"
      title="Operational AI observability"
      description="Track spend, latency, prompt performance, routing quality, and alert posture across real telemetry data."
    >
      <FilterBar options={data.filters} current={filters} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {data.metrics.map((metric) => (
          <article
            key={metric.label}
            className="rounded-[24px] border border-white/8 bg-white/5 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.25)]"
          >
            <div
              className={`mb-5 inline-flex rounded-full border bg-gradient-to-r px-3 py-1 text-xs uppercase tracking-[0.24em] ring-1 ${
                accentStyles[metric.accent]
              }`}
            >
              {metric.label}
            </div>
            <div className="font-space-grotesk text-4xl font-semibold tracking-tight text-white">
              {metric.value}
            </div>
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className={metric.delta.startsWith("-") ? "text-rose-300" : "text-emerald-300"}>
                {metric.delta}
              </span>
              <span className="text-slate-400">{metric.trend}</span>
            </div>
          </article>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_380px]">
        <section className="rounded-[26px] border border-white/8 bg-[#0b1523]/90 p-5">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Spend timeline</p>
              <h2 className="mt-2 font-space-grotesk text-2xl font-semibold text-white">
                Spend and request load
              </h2>
            </div>
            <StatusPill tone="warning">Forecasting enabled</StatusPill>
          </div>

          <div className="h-[300px] rounded-[22px] border border-white/8 bg-[linear-gradient(180deg,_rgba(255,255,255,0.04),_rgba(255,255,255,0.01))] p-4">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="h-[240px] w-full overflow-visible"
              role="img"
              aria-label="AI spend over the selected window"
            >
              <defs>
                <linearGradient id="spendAreaFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7bddff" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#7bddff" stopOpacity="0.02" />
                </linearGradient>
              </defs>

              {[0, 1, 2, 3].map((row) => {
                const y = 24 + row * 56;
                return (
                  <line
                    key={y}
                    x1="0"
                    x2={chartWidth}
                    y1={y}
                    y2={y}
                    stroke="rgba(148, 163, 184, 0.14)"
                    strokeDasharray="4 8"
                  />
                );
              })}

              <path d={areaPath} fill="url(#spendAreaFill)" />
              <path
                d={linePath}
                fill="none"
                stroke="#7bddff"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {data.spend_series.map((point, index) => {
                const x = (chartWidth / Math.max(data.spend_series.length - 1, 1)) * index;
                const maxValue = Math.max(...data.spend_series.map((item) => item.spend));
                const minValue = Math.min(...data.spend_series.map((item) => item.spend));
                const y =
                  chartHeight -
                  ((point.spend - minValue) / Math.max(maxValue - minValue, 1)) * (chartHeight - 24) -
                  12;

                return (
                  <g key={point.day}>
                    <circle cx={x} cy={y} r="6" fill="#08111c" stroke="#7bddff" strokeWidth="3" />
                  </g>
                );
              })}
            </svg>

            <div className="mt-2 grid grid-cols-7 gap-2 text-xs text-slate-400">
              {data.spend_series.slice(-7).map((point) => (
                <div key={point.day}>
                  <p>{point.day}</p>
                  <p className="mt-1 text-slate-200">${point.spend.toFixed(1)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-[26px] border border-white/8 bg-white/5 p-5">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Cache intelligence</p>
          <h2 className="mt-2 font-space-grotesk text-2xl font-semibold text-white">
            Savings from prompt and embedding reuse
          </h2>

          <div className="mt-6 grid gap-3">
            {[
              ["Hit rate", data.cache_summary.hit_rate],
              ["Tokens saved", data.cache_summary.tokens_saved],
              ["Cost saved", data.cache_summary.cost_saved],
              ["Latency reduction", data.cache_summary.latency_reduction],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/5 px-4 py-4"
              >
                <span className="text-sm text-slate-300">{label}</span>
                <span className="font-space-grotesk text-xl font-semibold text-white">{value}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="rounded-[26px] border border-white/8 bg-white/5 p-5">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Latency heatmap</p>
          <h2 className="mt-2 font-space-grotesk text-2xl font-semibold text-white">
            Model latency by peak window
          </h2>

          <div className="mt-6 overflow-hidden rounded-[22px] border border-white/8">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="bg-white/6 text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-medium">Time</th>
                  {latencyModels.map((model) => (
                    <th key={model.key} className="px-4 py-3 font-medium">
                      {model.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.latency_heatmap.map((row) => (
                  <tr key={row.hour} className="border-t border-white/6">
                    <td className="px-4 py-3 text-slate-300">{row.hour}</td>
                    {latencyModels.map((model) => (
                      <td key={`${row.hour}-${model.key}`} className="px-4 py-3">
                        <div
                          className={`rounded-xl px-3 py-2 text-center font-medium ${heatColor(
                            row[model.key]
                          )}`}
                        >
                          {row[model.key]} ms
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-[26px] border border-white/8 bg-white/5 p-5">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Alert stream</p>
          <h2 className="mt-2 font-space-grotesk text-2xl font-semibold text-white">
            Triggered operational signals
          </h2>

          <div className="mt-6 space-y-3">
            {data.alerts.length ? (
              data.alerts.map((alert) => (
                <article
                  key={`${alert.title}-${alert.timestamp}`}
                  className="rounded-[22px] border border-white/8 bg-[#0c1625] p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-space-grotesk text-lg font-medium text-white">
                        {alert.title}
                      </h3>
                      <p className="mt-2 text-sm text-slate-300">{alert.context}</p>
                    </div>
                    <StatusPill tone={alert.severity === "High" ? "danger" : "warning"}>
                      {alert.severity}
                    </StatusPill>
                  </div>
                  <p className="mt-4 text-xs uppercase tracking-[0.24em] text-slate-500">
                    {alert.timestamp} • {alert.status}
                  </p>
                </article>
              ))
            ) : (
              <p className="rounded-[22px] border border-white/8 bg-[#0c1625] p-4 text-sm text-slate-300">
                No triggered incidents in the selected window.
              </p>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <section className="rounded-[26px] border border-white/8 bg-white/5 p-5">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Model comparison</p>
          <h2 className="mt-2 font-space-grotesk text-2xl font-semibold text-white">
            Value across providers
          </h2>

          <div className="mt-6 overflow-hidden rounded-[22px] border border-white/8">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="bg-white/6 text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-medium">Model</th>
                  <th className="px-4 py-3 font-medium">Provider</th>
                  <th className="px-4 py-3 font-medium">Avg cost</th>
                  <th className="px-4 py-3 font-medium">Latency</th>
                  <th className="px-4 py-3 font-medium">Quality</th>
                </tr>
              </thead>
              <tbody>
                {data.model_comparison.map((row) => (
                  <tr key={row.model} className="border-t border-white/6">
                    <td className="px-4 py-4 font-medium text-white">{row.model}</td>
                    <td className="px-4 py-4 text-slate-300">{row.provider}</td>
                    <td className="px-4 py-4 text-slate-300">{row.avg_cost}</td>
                    <td className="px-4 py-4 text-slate-300">{row.avg_latency}</td>
                    <td className="px-4 py-4 text-slate-300">{row.quality_score}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-[26px] border border-white/8 bg-white/5 p-5">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Request posture</p>
          <h2 className="mt-2 font-space-grotesk text-2xl font-semibold text-white">
            Highest traffic endpoints
          </h2>

          <div className="mt-6 space-y-3">
            {data.request_overview.map((request) => (
              <article
                key={request.endpoint}
                className="rounded-[22px] border border-white/8 bg-[#0c1625] p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="font-space-grotesk text-lg font-medium text-white">
                      {request.endpoint}
                    </h3>
                    <p className="mt-2 text-sm text-slate-300">
                      {request.requests} requests • {request.error_rate} error rate
                    </p>
                  </div>
                  <StatusPill tone="neutral">{request.p95_latency}</StatusPill>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-[26px] border border-white/8 bg-white/5 p-5">
        <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Team usage</p>
        <h2 className="mt-2 font-space-grotesk text-2xl font-semibold text-white">
          Spend concentration by engineering group
        </h2>

        <div className="mt-6 overflow-hidden rounded-[22px] border border-white/8">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-white/6 text-slate-300">
              <tr>
                <th className="px-4 py-3 font-medium">Team</th>
                <th className="px-4 py-3 font-medium">Spend</th>
                <th className="px-4 py-3 font-medium">Tokens</th>
                <th className="px-4 py-3 font-medium">Requests</th>
                <th className="px-4 py-3 font-medium">Efficiency</th>
              </tr>
            </thead>
            <tbody>
              {data.team_usage.map((team) => (
                <tr key={team.team} className="border-t border-white/6">
                  <td className="px-4 py-4 font-medium text-white">{team.team}</td>
                  <td className="px-4 py-4 text-slate-300">{team.spend}</td>
                  <td className="px-4 py-4 text-slate-300">{team.tokens}</td>
                  <td className="px-4 py-4 text-slate-300">{team.requests}</td>
                  <td className="px-4 py-4 text-slate-300">{team.efficiency}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}

