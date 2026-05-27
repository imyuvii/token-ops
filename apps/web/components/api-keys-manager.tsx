"use client";

import { useState } from "react";

import { createApiKey, toggleApiKey } from "@/lib/api";
import type { ApiKey, Project } from "@/lib/types";

type ApiKeysManagerProps = {
  initialKeys: ApiKey[];
  projects: Project[];
};

export function ApiKeysManager({ initialKeys, projects }: ApiKeysManagerProps) {
  const [keys, setKeys] = useState(initialKeys);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [formState, setFormState] = useState({
    label: "Production ingest key",
    project_id: String(projects[0]?.id ?? ""),
  });
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      const created = await createApiKey({
        label: formState.label,
        project_id: Number(formState.project_id),
      });
      setKeys((previous) => [created.api_key, ...previous]);
      setCreatedSecret(created.raw_key);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create API key.");
    }
  }

  async function handleToggle(key: ApiKey) {
    try {
      const updated = await toggleApiKey(key.id, !key.is_active);
      setKeys((previous) => previous.map((item) => (item.id === updated.id ? updated : item)));
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Unable to update API key.");
    }
  }

  const inputClassName =
    "rounded-2xl border border-white/10 bg-white/6 px-3 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-300/40";

  return (
    <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      <form onSubmit={handleCreate} className="space-y-3 rounded-[24px] border border-white/8 bg-white/5 p-4">
        <h3 className="font-space-grotesk text-xl font-semibold text-white">Issue API key</h3>
        <input
          className={inputClassName}
          value={formState.label}
          onChange={(event) => setFormState((previous) => ({ ...previous, label: event.target.value }))}
          placeholder="Key label"
        />
        <select
          className={inputClassName}
          value={formState.project_id}
          onChange={(event) =>
            setFormState((previous) => ({ ...previous, project_id: event.target.value }))
          }
        >
          {projects.map((project) => (
            <option key={project.id} value={project.id} className="bg-slate-900">
              {project.name}
            </option>
          ))}
        </select>
        {createdSecret ? (
          <div className="rounded-2xl bg-emerald-300/10 p-3 text-sm text-emerald-200">
            Copy this once: {createdSecret}
          </div>
        ) : null}
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        <button
          type="submit"
          className="w-full rounded-2xl bg-white px-4 py-3 font-medium text-slate-950 transition hover:bg-slate-100"
        >
          Create key
        </button>
      </form>

      <div className="space-y-3 rounded-[24px] border border-white/8 bg-white/5 p-4">
        <h3 className="font-space-grotesk text-xl font-semibold text-white">Issued keys</h3>
        {keys.map((key) => (
          <article
            key={key.id}
            className="flex flex-col gap-3 rounded-[22px] border border-white/8 bg-[#0c1625] p-4 lg:flex-row lg:items-center lg:justify-between"
          >
            <div>
              <p className="font-space-grotesk text-lg text-white">{key.label}</p>
              <p className="mt-1 text-sm text-slate-400">
                {key.project_name} • {key.key_prefix}...
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleToggle(key)}
              className={`rounded-2xl px-4 py-2 text-sm font-medium ${
                key.is_active ? "bg-emerald-300/12 text-emerald-200" : "bg-white/10 text-slate-300"
              }`}
            >
              {key.is_active ? "Active" : "Inactive"}
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}

