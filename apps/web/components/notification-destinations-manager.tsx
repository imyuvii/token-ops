"use client";

import { useState } from "react";

import {
  createNotificationDestination,
  testNotificationDestination,
  toggleNotificationDestination,
} from "@/lib/api";
import type { NotificationDelivery, NotificationDestination } from "@/lib/types";

type NotificationDestinationsManagerProps = {
  initialDestinations: NotificationDestination[];
};

export function NotificationDestinationsManager({
  initialDestinations,
}: NotificationDestinationsManagerProps) {
  const [destinations, setDestinations] = useState(initialDestinations);
  const [lastDelivery, setLastDelivery] = useState<NotificationDelivery | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formState, setFormState] = useState({
    name: "Pager webhook",
    channel: "webhook",
    target: "https://example.invalid/pager",
  });

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      const created = await createNotificationDestination({
        name: formState.name,
        channel: formState.channel as NotificationDestination["channel"],
        target: formState.target,
      });
      setDestinations((previous) => [created, ...previous]);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create destination.");
    }
  }

  async function handleToggle(destination: NotificationDestination) {
    try {
      const updated = await toggleNotificationDestination(destination.id, !destination.is_active);
      setDestinations((previous) =>
        previous.map((item) => (item.id === updated.id ? updated : item))
      );
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Unable to update destination.");
    }
  }

  async function handleTest(destination: NotificationDestination) {
    try {
      const delivery = await testNotificationDestination(destination.id);
      setLastDelivery(delivery);
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : "Unable to test destination.");
    }
  }

  const inputClassName =
    "rounded-2xl border border-white/10 bg-white/6 px-3 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-300/40";

  return (
    <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      <form onSubmit={handleCreate} className="space-y-3 rounded-[24px] border border-white/8 bg-white/5 p-4">
        <h3 className="font-space-grotesk text-xl font-semibold text-white">Add destination</h3>
        <input
          className={inputClassName}
          value={formState.name}
          onChange={(event) => setFormState((previous) => ({ ...previous, name: event.target.value }))}
        />
        <select
          className={inputClassName}
          value={formState.channel}
          onChange={(event) => setFormState((previous) => ({ ...previous, channel: event.target.value }))}
        >
          {["slack", "email", "webhook", "teams"].map((value) => (
            <option key={value} value={value} className="bg-slate-900">
              {value}
            </option>
          ))}
        </select>
        <input
          className={inputClassName}
          value={formState.target}
          onChange={(event) => setFormState((previous) => ({ ...previous, target: event.target.value }))}
        />
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        {lastDelivery ? (
          <p className="rounded-2xl bg-emerald-300/10 p-3 text-sm text-emerald-200">
            {lastDelivery.context}
          </p>
        ) : null}
        <button
          type="submit"
          className="w-full rounded-2xl bg-white px-4 py-3 font-medium text-slate-950 transition hover:bg-slate-100"
        >
          Create destination
        </button>
      </form>

      <div className="space-y-3 rounded-[24px] border border-white/8 bg-white/5 p-4">
        <h3 className="font-space-grotesk text-xl font-semibold text-white">Delivery targets</h3>
        {destinations.map((destination) => (
          <article
            key={destination.id}
            className="rounded-[22px] border border-white/8 bg-[#0c1625] p-4"
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="font-space-grotesk text-lg text-white">{destination.name}</p>
                <p className="mt-1 text-sm text-slate-400">
                  {destination.channel} • {destination.target}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleTest(destination)}
                  className="rounded-2xl border border-white/10 bg-white/6 px-4 py-2 text-sm text-slate-200"
                >
                  Test
                </button>
                <button
                  type="button"
                  onClick={() => handleToggle(destination)}
                  className={`rounded-2xl px-4 py-2 text-sm ${
                    destination.is_active
                      ? "bg-emerald-300/12 text-emerald-200"
                      : "bg-white/10 text-slate-300"
                  }`}
                >
                  {destination.is_active ? "Active" : "Inactive"}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

