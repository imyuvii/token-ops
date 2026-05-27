"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startTransition, useDeferredValue, useEffect, useState } from "react";

import type { DashboardFilters, FilterOptions } from "@/lib/types";

type FilterBarProps = {
  options: FilterOptions;
  current: DashboardFilters;
};

function normalize(value?: string): string {
  return value ?? "";
}

export function FilterBar({ options, current }: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [draft, setDraft] = useState({
    days: String(current.days ?? 30),
    team: normalize(current.team),
    model: normalize(current.model),
    environment: normalize(current.environment),
    application: normalize(current.application),
  });
  const deferredDraft = useDeferredValue(draft);

  useEffect(() => {
    setDraft({
      days: String(current.days ?? 30),
      team: normalize(current.team),
      model: normalize(current.model),
      environment: normalize(current.environment),
      application: normalize(current.application),
    });
  }, [current.application, current.days, current.environment, current.model, current.team]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(deferredDraft).forEach(([key, value]) => {
      if (!value) {
        params.delete(key);
        return;
      }
      params.set(key, value);
    });

    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}` as never, { scroll: false });
    });
  }, [deferredDraft, pathname, router, searchParams]);

  const selectClassName =
    "rounded-2xl border border-white/10 bg-white/6 px-3 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-300/40";

  return (
    <section className="grid gap-3 rounded-[24px] border border-white/8 bg-white/5 p-4 md:grid-cols-5">
      <select
        className={selectClassName}
        value={draft.days}
        onChange={(event) => setDraft((previous) => ({ ...previous, days: event.target.value }))}
      >
        {[7, 14, 30, 60, 90].map((value) => (
          <option key={value} value={value} className="bg-slate-900">
            Last {value} days
          </option>
        ))}
      </select>

      <select
        className={selectClassName}
        value={draft.team}
        onChange={(event) => setDraft((previous) => ({ ...previous, team: event.target.value }))}
      >
        <option value="" className="bg-slate-900">
          All teams
        </option>
        {options.teams.map((value) => (
          <option key={value} value={value} className="bg-slate-900">
            {value}
          </option>
        ))}
      </select>

      <select
        className={selectClassName}
        value={draft.application}
        onChange={(event) =>
          setDraft((previous) => ({ ...previous, application: event.target.value }))
        }
      >
        <option value="" className="bg-slate-900">
          All apps
        </option>
        {options.applications.map((value) => (
          <option key={value} value={value} className="bg-slate-900">
            {value}
          </option>
        ))}
      </select>

      <select
        className={selectClassName}
        value={draft.model}
        onChange={(event) => setDraft((previous) => ({ ...previous, model: event.target.value }))}
      >
        <option value="" className="bg-slate-900">
          All models
        </option>
        {options.models.map((value) => (
          <option key={value} value={value} className="bg-slate-900">
            {value}
          </option>
        ))}
      </select>

      <select
        className={selectClassName}
        value={draft.environment}
        onChange={(event) =>
          setDraft((previous) => ({ ...previous, environment: event.target.value }))
        }
      >
        <option value="" className="bg-slate-900">
          All envs
        </option>
        {options.environments.map((value) => (
          <option key={value} value={value} className="bg-slate-900">
            {value}
          </option>
        ))}
      </select>
    </section>
  );
}
