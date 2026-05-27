"use client";

import { useEffect, useState } from "react";

import type { NotificationDelivery, TelemetryEvent } from "@/lib/types";

type LiveOpsPanelProps = {
  initialEvents: TelemetryEvent[];
  notifications: NotificationDelivery[];
};

export function LiveOpsPanel({ initialEvents, notifications }: LiveOpsPanelProps) {
  const [events, setEvents] = useState(initialEvents);
  const [streamStatus, setStreamStatus] = useState<"connecting" | "live" | "closed">("connecting");

  useEffect(() => {
    const source = new EventSource("http://localhost:8000/api/v1/stream/events");
    source.onopen = () => setStreamStatus("live");
    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as TelemetryEvent[];
        setEvents(payload);
      } catch {
        setStreamStatus("closed");
      }
    };
    source.onerror = () => {
      setStreamStatus("closed");
      source.close();
    };
    return () => {
      source.close();
      setStreamStatus("closed");
    };
  }, []);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_380px]">
      <section className="rounded-[26px] border border-white/8 bg-white/5 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Realtime stream</p>
            <h2 className="mt-2 font-space-grotesk text-2xl font-semibold text-white">
              Live telemetry feed
            </h2>
          </div>
          <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-cyan-200">
            {streamStatus}
          </span>
        </div>
        <div className="mt-6 space-y-3">
          {events.map((event) => (
            <article
              key={event.request_id}
              className="rounded-[22px] border border-white/8 bg-[#0c1625] p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-space-grotesk text-lg text-white">{event.request_id}</h3>
                  <p className="mt-2 text-sm text-slate-300">
                    {event.application} • {event.model} • {event.total_tokens} tokens
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{event.timestamp}</p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-200">
                  {event.status}
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[26px] border border-white/8 bg-white/5 p-5">
        <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Notification outbox</p>
        <h2 className="mt-2 font-space-grotesk text-2xl font-semibold text-white">
          Recent deliveries
        </h2>
        <div className="mt-6 space-y-3">
          {notifications.map((delivery) => (
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
                <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-emerald-200">
                  {delivery.status}
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

