import { ApiKeysManager } from "@/components/api-keys-manager";
import { AppShell } from "@/components/app-shell";
import { StatusPill } from "@/components/status-pill";
import { requireSession } from "@/lib/auth";
import { getApiKeys, getAuditLogs, getMembers, getOrganization, getProjects } from "@/lib/api";

export default async function GovernancePage() {
  const session = await requireSession({ roles: ["admin", "manager"] });
  const [projects, apiKeys, organization, members, auditLogs] = await Promise.all([
    getProjects(),
    getApiKeys(),
    getOrganization(),
    getMembers(),
    getAuditLogs(),
  ]);

  return (
    <AppShell
      active="governance"
      title="Governed ingestion and project controls"
      description="Manage projects, monthly AI budgets, and ingestion credentials used by downstream applications."
      session={session}
    >
      <section className="rounded-[26px] border border-white/8 bg-white/5 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Organization</p>
            <h2 className="mt-2 font-space-grotesk text-2xl font-semibold text-white">
              {organization.name}
            </h2>
          </div>
          <StatusPill tone="success">{organization.plan}</StatusPill>
        </div>
      </section>

      <section className="rounded-[26px] border border-white/8 bg-white/5 p-5">
        <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Projects</p>
        <h2 className="mt-2 font-space-grotesk text-2xl font-semibold text-white">
          Budget ownership by project
        </h2>

        <div className="mt-6 grid gap-3 lg:grid-cols-2">
          {projects.map((project) => (
            <article key={project.id} className="rounded-[22px] border border-white/8 bg-[#0c1625] p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-space-grotesk text-lg text-white">{project.name}</h3>
                  <p className="mt-2 text-sm text-slate-400">
                    {project.team} • {project.environment}
                  </p>
                </div>
                <StatusPill tone="warning">${project.budget_monthly.toLocaleString()}</StatusPill>
              </div>
            </article>
          ))}
        </div>
      </section>

      <ApiKeysManager initialKeys={apiKeys} projects={projects} />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-[26px] border border-white/8 bg-white/5 p-5">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Members</p>
          <h2 className="mt-2 font-space-grotesk text-2xl font-semibold text-white">
            Org roles and access
          </h2>

          <div className="mt-6 overflow-hidden rounded-[22px] border border-white/8">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="bg-white/6 text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Team</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id} className="border-t border-white/6">
                    <td className="px-4 py-4 font-medium text-white">{member.name}</td>
                    <td className="px-4 py-4 text-slate-300">{member.email}</td>
                    <td className="px-4 py-4 text-slate-300">{member.role}</td>
                    <td className="px-4 py-4 text-slate-300">{member.team}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-[26px] border border-white/8 bg-white/5 p-5">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Exports</p>
          <h2 className="mt-2 font-space-grotesk text-2xl font-semibold text-white">
            Download event history
          </h2>
          <a
            href="http://localhost:8000/api/v1/export/events.csv"
            className="mt-6 inline-flex rounded-2xl bg-white px-4 py-3 font-medium text-slate-950 transition hover:bg-slate-100"
          >
            Export events CSV
          </a>
          <p className="mt-4 text-sm text-slate-400">
            Use filtered CSV exports for finance review, incident postmortems, or offline analysis.
          </p>
        </div>
      </section>

      <section className="rounded-[26px] border border-white/8 bg-white/5 p-5">
        <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Audit trail</p>
        <h2 className="mt-2 font-space-grotesk text-2xl font-semibold text-white">
          Privileged action history
        </h2>

        <div className="mt-6 overflow-hidden rounded-[22px] border border-white/8">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-white/6 text-slate-300">
              <tr>
                <th className="px-4 py-3 font-medium">Actor</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Resource</th>
                <th className="px-4 py-3 font-medium">Detail</th>
                <th className="px-4 py-3 font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log) => (
                <tr key={log.id} className="border-t border-white/6">
                  <td className="px-4 py-4 text-slate-300">
                    <p className="font-medium text-white">{log.actor_email}</p>
                    <p className="mt-1 text-xs text-slate-500">{log.actor_role}</p>
                  </td>
                  <td className="px-4 py-4 text-slate-300">{log.action}</td>
                  <td className="px-4 py-4 text-slate-300">
                    {log.resource_type} #{log.resource_id}
                  </td>
                  <td className="px-4 py-4 text-slate-300">{log.detail}</td>
                  <td className="px-4 py-4 text-slate-400">{log.created_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
