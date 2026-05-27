import Link from "next/link";
import type { ReactNode } from "react";

type AppShellProps = {
  active: "overview" | "requests" | "prompts" | "alerts" | "ingest";
  title: string;
  description: string;
  children: ReactNode;
};

const navItems = [
  { href: "/", label: "Overview", key: "overview" },
  { href: "/requests", label: "Requests", key: "requests" },
  { href: "/prompts", label: "Prompts", key: "prompts" },
  { href: "/alerts", label: "Alerts", key: "alerts" },
  { href: "/ingest", label: "Ingest", key: "ingest" },
] as const;

export function AppShell({ active, title, description, children }: AppShellProps) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(125,211,252,0.11),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(251,146,60,0.14),_transparent_24%),linear-gradient(180deg,_#09111d_0%,_#060b14_100%)] text-slate-100">
      <div className="mx-auto grid min-h-screen max-w-[1600px] grid-cols-1 gap-6 px-4 py-4 lg:grid-cols-[250px_minmax(0,1fr)] lg:px-6">
        <aside className="rounded-[28px] border border-white/8 bg-white/5 p-5 backdrop-blur-xl">
          <div className="mb-10">
            <p className="font-space-grotesk text-2xl font-semibold tracking-tight text-white">
              TokenOps
            </p>
            <p className="mt-2 text-sm text-slate-400">
              Production observability for operational AI systems.
            </p>
          </div>

          <nav className="space-y-2 text-sm">
            {navItems.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className={`block rounded-2xl px-4 py-3 ${
                  item.key === active
                    ? "bg-white text-slate-950 shadow-[0_18px_60px_rgba(255,255,255,0.12)]"
                    : "text-slate-300 transition hover:bg-white/6 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="mt-10 rounded-[24px] border border-cyan-200/12 bg-gradient-to-br from-cyan-300/15 via-transparent to-amber-300/10 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-cyan-200/80">Shipping status</p>
            <p className="mt-3 font-space-grotesk text-2xl font-semibold text-white">Functional MVP</p>
            <p className="mt-2 text-sm text-slate-300">
              Live ingestion, persisted telemetry, alert rules, and a filterable analytics surface.
            </p>
          </div>
        </aside>

        <section className="space-y-6 rounded-[28px] border border-white/8 bg-white/4 p-4 backdrop-blur-xl lg:p-6">
          <header className="rounded-[26px] border border-white/8 bg-[linear-gradient(135deg,_rgba(255,255,255,0.08),_rgba(255,255,255,0.02))] p-5">
            <p className="text-sm uppercase tracking-[0.28em] text-slate-400">TokenOps control plane</p>
            <h1 className="mt-3 font-space-grotesk text-4xl font-semibold tracking-tight text-white">
              {title}
            </h1>
            <p className="mt-3 max-w-3xl text-sm text-slate-300 lg:text-base">{description}</p>
          </header>

          {children}
        </section>
      </div>
    </main>
  );
}
