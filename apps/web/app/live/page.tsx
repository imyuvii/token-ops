import { AppShell } from "@/components/app-shell";
import { LiveOpsPanel } from "@/components/live-ops-panel";
import { getNotifications, getRecentEvents } from "@/lib/api";

export default async function LivePage() {
  const [events, notifications] = await Promise.all([getRecentEvents(), getNotifications()]);

  return (
    <AppShell
      active="live"
      title="Live operational stream"
      description="Follow realtime telemetry flow and notification delivery activity across the TokenOps control plane."
    >
      <LiveOpsPanel initialEvents={events.slice(0, 10)} notifications={notifications.slice(0, 10)} />
    </AppShell>
  );
}
