"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Pill } from "@/components/ui/primitives";

interface PageMeta {
  crumb: string;
  title: string;
  showDate?: boolean;
}

function metaForPath(pathname: string): PageMeta {
  if (pathname === "/") return { crumb: "Overview", title: "Dashboard", showDate: true };
  if (pathname.startsWith("/activities/")) return { crumb: "Activity", title: "Activity" };
  if (pathname === "/activities") return { crumb: "Log", title: "Activities" };
  if (pathname.startsWith("/plan")) return { crumb: "Schedule", title: "Training Plan" };
  if (pathname === "/shoes") return { crumb: "Gear", title: "Shoes" };
  if (pathname === "/races") return { crumb: "Calendar", title: "Races" };
  if (pathname === "/stats") return { crumb: "Analytics", title: "Stats" };
  return { crumb: "", title: "" };
}

const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function todayLabel(): string {
  const d = new Date();
  return `${DAYS_SHORT[d.getDay()]} · ${MONTHS[d.getMonth()]} ${d.getDate()} ${d.getFullYear()}`;
}

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const p = metaForPath(pathname);
  const [syncing, setSyncing] = useState(false);

  async function onSync() {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await fetch("/api/strava/sync", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error("[sync] failed", res.status, body);
      }
      router.refresh();
    } catch (e) {
      console.error("[sync] error", e);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="topbar">
      <div className="topbar-left">
        <span className="topbar-crumb">{p.crumb}</span>
        <span style={{ color: "var(--text-4)" }}>/</span>
        <span className="topbar-title">{p.title}</span>
        {p.showDate && <Pill kind="muted">{todayLabel()}</Pill>}
      </div>
      <div className="topbar-right">
        <button type="button" className="btn" onClick={onSync} disabled={syncing}>
          <Icon name="sync" size={12} /> {syncing ? "Syncing…" : "Sync Strava"}
        </button>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 999,
            background: "linear-gradient(135deg, #2a2a32, #1a1a20)",
            border: "1px solid var(--hairline-strong)",
            display: "grid",
            placeItems: "center",
            fontFamily: "var(--font-geist-mono), monospace",
            fontSize: 11,
            color: "var(--text-1)",
          }}
        >
          B
        </div>
      </div>
    </div>
  );
}
