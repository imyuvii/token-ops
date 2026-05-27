import { ApiKeysManager } from "@/components/api-keys-manager";
import { AppShell } from "@/components/app-shell";
import { StatusPill } from "@/components/status-pill";
import { getApiKeys, getProjects } from "@/lib/api";

export default async function GovernancePage() {
  const [projects, apiKeys] = await Promise.all([getProjects(), getApiKeys()]);

  return (
    <AppShell
      active="governance"
      title="Governed ingestion and project controls"
      description="Manage projects, monthly AI budgets, and ingestion credentials used by downstream applications."
    >
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
    </AppShell>
  );
}
