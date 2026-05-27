"use client";

import { startTransition, useState } from "react";

import { createAlertRule, toggleAlertRule } from "@/lib/api";
import type { AlertRule } from "@/lib/types";

type AlertRulesManagerProps = {
  initialRules: AlertRule[];
};

export function AlertRulesManager({ initialRules }: AlertRulesManagerProps) {
  const [rules, setRules] = useState(initialRules);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formState, setFormState] = useState({
    name: "Cost drift monitor",
    rule_type: "budget",
    severity: "medium",
    channel: "slack",
    threshold: "9000",
    window_minutes: "1440",
  });

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const created = await createAlertRule({
        name: formState.name,
        rule_type: formState.rule_type as AlertRule["rule_type"],
        severity: formState.severity as AlertRule["severity"],
        channel: formState.channel as AlertRule["channel"],
        threshold: Number(formState.threshold),
        window_minutes: Number(formState.window_minutes),
        enabled: true,
      });
      setRules((previous) => [created, ...previous]);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create rule.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleToggle(rule: AlertRule) {
    startTransition(async () => {
      try {
        const updated = await toggleAlertRule(rule.id, !rule.enabled);
        setRules((previous) =>
          previous.map((currentRule) => (currentRule.id === updated.id ? updated : currentRule))
        );
      } catch (toggleError) {
        setError(toggleError instanceof Error ? toggleError.message : "Unable to update rule.");
      }
    });
  }

  const inputClassName =
    "rounded-2xl border border-white/10 bg-white/6 px-3 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-300/40";

  return (
    <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      <form
        onSubmit={handleCreate}
        className="space-y-3 rounded-[24px] border border-white/8 bg-white/5 p-4"
      >
        <h3 className="font-space-grotesk text-xl font-semibold text-white">Create rule</h3>
        <input
          className={inputClassName}
          value={formState.name}
          onChange={(event) => setFormState((previous) => ({ ...previous, name: event.target.value }))}
          placeholder="Rule name"
        />
        <select
          className={inputClassName}
          value={formState.rule_type}
          onChange={(event) =>
            setFormState((previous) => ({ ...previous, rule_type: event.target.value }))
          }
        >
          <option value="budget" className="bg-slate-900">Budget</option>
          <option value="latency" className="bg-slate-900">Latency</option>
          <option value="error_rate" className="bg-slate-900">Error rate</option>
          <option value="cache_hit" className="bg-slate-900">Cache hit</option>
        </select>
        <div className="grid grid-cols-2 gap-3">
          <select
            className={inputClassName}
            value={formState.severity}
            onChange={(event) =>
              setFormState((previous) => ({ ...previous, severity: event.target.value }))
            }
          >
            {["low", "medium", "high"].map((value) => (
              <option key={value} value={value} className="bg-slate-900">
                {value}
              </option>
            ))}
          </select>
          <select
            className={inputClassName}
            value={formState.channel}
            onChange={(event) =>
              setFormState((previous) => ({ ...previous, channel: event.target.value }))
            }
          >
            {["slack", "email", "webhook", "teams"].map((value) => (
              <option key={value} value={value} className="bg-slate-900">
                {value}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input
            className={inputClassName}
            value={formState.threshold}
            onChange={(event) =>
              setFormState((previous) => ({ ...previous, threshold: event.target.value }))
            }
            type="number"
            step="0.1"
            placeholder="Threshold"
          />
          <input
            className={inputClassName}
            value={formState.window_minutes}
            onChange={(event) =>
              setFormState((previous) => ({ ...previous, window_minutes: event.target.value }))
            }
            type="number"
            placeholder="Window minutes"
          />
        </div>
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        <button
          type="submit"
          disabled={isSaving}
          className="w-full rounded-2xl bg-white px-4 py-3 font-medium text-slate-950 transition hover:bg-slate-100 disabled:opacity-60"
        >
          {isSaving ? "Saving..." : "Create alert rule"}
        </button>
      </form>

      <div className="space-y-3 rounded-[24px] border border-white/8 bg-white/5 p-4">
        <h3 className="font-space-grotesk text-xl font-semibold text-white">Active rules</h3>
        {rules.map((rule) => (
          <article
            key={rule.id}
            className="flex flex-col gap-3 rounded-[22px] border border-white/8 bg-[#0c1625] p-4 lg:flex-row lg:items-center lg:justify-between"
          >
            <div>
              <p className="font-space-grotesk text-lg text-white">{rule.name}</p>
              <p className="mt-1 text-sm text-slate-400">
                {rule.rule_type} • {rule.threshold} • {rule.window_minutes} min • {rule.channel}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleToggle(rule)}
              className={`rounded-2xl px-4 py-2 text-sm font-medium ${
                rule.enabled
                  ? "bg-emerald-300/12 text-emerald-200"
                  : "bg-white/10 text-slate-300"
              }`}
            >
              {rule.enabled ? "Enabled" : "Disabled"}
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}

