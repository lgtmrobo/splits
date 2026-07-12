"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/ui/icon";

export function ResyncButton({ activityId }: { activityId: number }) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);

  async function onClick() {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await fetch(`/api/activities/${activityId}/streams?force=1`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error("[resync] failed", res.status, body);
      }
      router.refresh();
    } catch (e) {
      console.error("[resync] error", e);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <button type="button" className="btn" onClick={onClick} disabled={syncing}>
      <Icon name="sync" size={12} />
      {syncing ? "Syncing…" : "Re-sync"}
    </button>
  );
}
