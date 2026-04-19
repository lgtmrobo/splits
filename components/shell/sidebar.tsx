"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/icon";

interface ShellSummary {
  activities: number;
  gear: number;
  races: number;
  plan: { name: string; week: number; totalWeeks: number; pct: number } | null;
  nextRace: { name: string; date: string; weeksOut: number } | null;
  lastSync: string | null;
  lastSyncCount: number;
}

interface NavItem {
  href: string;
  icon: IconName;
  label: string;
  countKey?: keyof Pick<ShellSummary, "activities" | "gear" | "races">;
  matchPrefix?: string;
}

const ITEMS: NavItem[] = [
  { href: "/", icon: "dash", label: "Dashboard" },
  { href: "/activities", icon: "activities", label: "Activities", countKey: "activities", matchPrefix: "/activities" },
  { href: "/plan", icon: "plan", label: "Training Plan", matchPrefix: "/plan" },
  { href: "/shoes", icon: "shoe", label: "Shoes", countKey: "gear" },
  { href: "/races", icon: "race", label: "Races", countKey: "races" },
  { href: "/stats", icon: "stats", label: "Stats" },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtMd(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function Sidebar({ summary }: { summary: ShellSummary }) {
  const pathname = usePathname();
  const isActive = (item: NavItem) => {
    if (item.href === "/") return pathname === "/";
    if (item.matchPrefix) return pathname.startsWith(item.matchPrefix);
    return pathname === item.href;
  };

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">S</div>
        <div className="col">
          <div className="brand-name">Splits</div>
          <div className="brand-sub">v0.1.0</div>
        </div>
      </div>

      <div className="col gap-4">
        <div className="nav-group-label">Workspace</div>
        <nav className="nav">
          {ITEMS.map((it) => {
            const count = it.countKey ? summary[it.countKey] : undefined;
            return (
              <Link key={it.href} href={it.href} className={`nav-item ${isActive(it) ? "active" : ""}`}>
                <Icon name={it.icon} className="ico" />
                <span>{it.label}</span>
                {count != null && count > 0 && <span className="nav-count">{count}</span>}
              </Link>
            );
          })}
        </nav>
      </div>

      {summary.plan && (
        <div className="col gap-4">
          <div className="nav-group-label">Current Block</div>
          <div style={{ padding: "6px 8px", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 12, color: "var(--text-1)", lineHeight: 1.3 }}>
              {summary.nextRace?.name ?? summary.plan.name}
            </div>
            {summary.nextRace && (
              <div className="num" style={{ fontSize: 11, color: "var(--text-3)", letterSpacing: "0.04em" }}>
                {fmtMd(summary.nextRace.date)} · {summary.nextRace.weeksOut} weeks out
              </div>
            )}
            <div style={{ position: "relative", height: 4, background: "var(--surface-2)", borderRadius: 2, marginTop: 4 }}>
              <div style={{ position: "absolute", inset: 0, width: `${summary.plan.pct}%`, background: "var(--accent)", borderRadius: 2 }} />
            </div>
            <div className="row between" style={{ fontFamily: "var(--font-geist-mono), monospace", fontSize: 10, color: "var(--text-3)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              <span>W{summary.plan.week}/{summary.plan.totalWeeks}</span>
              <span>{summary.plan.pct}%</span>
            </div>
          </div>
        </div>
      )}

      <div className="sidebar-footer">
        {summary.lastSync ? (
          <>
            <span className="pill-status">Strava synced · {relativeTime(summary.lastSync)}</span>
            {summary.lastSyncCount > 0 && (
              <div style={{ fontFamily: "var(--font-geist-mono), monospace", fontSize: 10, color: "var(--text-4)", letterSpacing: "0.04em" }}>
                Last sync: {summary.lastSyncCount} {summary.lastSyncCount === 1 ? "activity" : "activities"}
              </div>
            )}
          </>
        ) : (
          <span className="pill-status">Not synced</span>
        )}
      </div>
    </aside>
  );
}
