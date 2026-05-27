import { AlertRulesManager } from "@/components/alert-rules-manager";
import { AppShell } from "@/components/app-shell";
import { FilterBar } from "@/components/filter-bar";
import { NotificationDestinationsManager } from "@/components/notification-destinations-manager";
import { StatusPill } from "@/components/status-pill";
import { requireSession } from "@/lib/auth";
import {
  getAlertIncidents,
  getAlertRules,
  getDashboardData,
  getNotificationDestinations,
  getNotifications,
} from "@/lib/api";
import { parseDashboardFilters } from "@/lib/search-params";

export default async function AlertsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = await parseDashboardFilters(searchParams);
  const session = await requireSession({ roles: ["admin", "manager"] });
  const [dashboard, incidents, rules, destinations, notifications] = await Promise.all([
    getDashboardData(filters),
    getAlertIncidents(filters),
    getAlertRules(),
    getNotificationDestinations(),
    getNotifications(),
  ]);

  return (
    <AppShell
      active="alerts"
      title="Alerting and operational guardrails"
      description="Manage alert rules and review triggered incidents across cost, latency, error rate, and cache efficiency."
      session={session}
    >
      <FilterBar options={dashboard.filters} current={filters} />

      <section className="rounded-[26px] border border-white/8 bg-white/5 p-5">
        <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Incident queue</p>
        <h2 className="mt-2 font-space-grotesk text-2xl font-semibold text-white">
          Triggered incidents
        </h2>

        <div className="mt-6 grid gap-3 lg:grid-cols-2">
          {incidents.length ? (
            incidents.map((incident) => (
              <article
                key={`${incident.title}-${incident.timestamp}`}
                className="rounded-[22px] border border-white/8 bg-[#0c1625] p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-space-grotesk text-lg font-medium text-white">
                      {incident.title}
                    </h3>
                    <p className="mt-2 text-sm text-slate-300">{incident.context}</p>
                  </div>
                  <StatusPill tone={incident.severity === "High" ? "danger" : "warning"}>
                    {incident.severity}
                  </StatusPill>
                </div>
                <p className="mt-4 text-xs uppercase tracking-[0.24em] text-slate-500">
                  {incident.timestamp} • {incident.status}
                </p>
              </article>
            ))
          ) : (
            <p className="rounded-[22px] border border-white/8 bg-[#0c1625] p-4 text-sm text-slate-300">
              No alert rules have triggered in the current filter window.
            </p>
          )}
        </div>
      </section>

      <AlertRulesManager initialRules={rules} />
      <NotificationDestinationsManager initialDestinations={destinations} />

      <section className="rounded-[26px] border border-white/8 bg-white/5 p-5">
        <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Delivery history</p>
        <h2 className="mt-2 font-space-grotesk text-2xl font-semibold text-white">
          Recent alert deliveries
        </h2>

        <div className="mt-6 grid gap-3 lg:grid-cols-2">
          {notifications.slice(0, 6).map((delivery) => (
            <article
              key={delivery.id}
              className="rounded-[22px] border border-white/8 bg-[#0c1625] p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-space-grotesk text-lg text-white">{delivery.rule_name}</h3>
                  <p className="mt-2 text-sm text-slate-300">{delivery.context}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {delivery.channel} • {delivery.created_at}
                  </p>
                </div>
                <StatusPill tone={delivery.status === "delivered" ? "success" : "warning"}>
                  {delivery.status}
                </StatusPill>
              </div>
            </article>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
