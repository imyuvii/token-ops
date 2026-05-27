import { AppShell } from "@/components/app-shell";
import { FilterBar } from "@/components/filter-bar";
import { ReplayPanel } from "@/components/replay-panel";
import { StatusPill } from "@/components/status-pill";
import { requireSession } from "@/lib/auth";
import { getDashboardData, getRecentEvents } from "@/lib/api";
import { parseDashboardFilters } from "@/lib/search-params";

export default async function RequestsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = await parseDashboardFilters(searchParams);
  const session = await requireSession();
  const [dashboard, events] = await Promise.all([
    getDashboardData(filters),
    getRecentEvents(filters),
  ]);

  return (
    <AppShell
      active="requests"
      title="Recent AI request traces"
      description="Inspect recent AI requests with prompt lineage, token cost, latency, cache usage, and failure context."
      session={session}
    >
      <FilterBar options={dashboard.filters} current={filters} />

      <section className="rounded-[26px] border border-white/8 bg-white/5 p-5">
        <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Request stream</p>
        <h2 className="mt-2 font-space-grotesk text-2xl font-semibold text-white">
          Latest telemetry events
        </h2>

        <div className="mt-6 overflow-x-auto rounded-[22px] border border-white/8">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-white/6 text-slate-300">
              <tr>
                <th className="px-4 py-3 font-medium">Request</th>
                <th className="px-4 py-3 font-medium">App</th>
                <th className="px-4 py-3 font-medium">Model</th>
                <th className="px-4 py-3 font-medium">Prompt</th>
                <th className="px-4 py-3 font-medium">Tokens</th>
                <th className="px-4 py-3 font-medium">Cost</th>
                <th className="px-4 py-3 font-medium">Latency</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.request_id} className="border-t border-white/6 align-top">
                  <td className="px-4 py-4">
                    <p className="font-medium text-white">{event.request_id}</p>
                    <p className="mt-1 text-xs text-slate-400">{event.timestamp}</p>
                  </td>
                  <td className="px-4 py-4 text-slate-300">
                    <p>{event.application}</p>
                    <p className="mt-1 text-xs text-slate-500">{event.endpoint}</p>
                  </td>
                  <td className="px-4 py-4 text-slate-300">
                    <p>{event.model}</p>
                    <p className="mt-1 text-xs text-slate-500">{event.provider}</p>
                  </td>
                  <td className="px-4 py-4 text-slate-300">
                    <p>{event.prompt_name}</p>
                    <p className="mt-1 text-xs text-slate-500">{event.prompt_version}</p>
                  </td>
                  <td className="px-4 py-4 text-slate-300">{event.total_tokens}</td>
                  <td className="px-4 py-4 text-slate-300">${event.cost.toFixed(4)}</td>
                  <td className="px-4 py-4 text-slate-300">{event.latency_ms} ms</td>
                  <td className="px-4 py-4">
                    <div className="space-y-2">
                      <StatusPill tone={event.status === "success" ? "success" : "danger"}>
                        {event.status}
                      </StatusPill>
                      {event.cache_hit ? <StatusPill tone="neutral">cache hit</StatusPill> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <ReplayPanel suggestedRequestId={events[0]?.request_id} />
    </AppShell>
  );
}
