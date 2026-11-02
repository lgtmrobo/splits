"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { FluidHoverHighlight } from "@/components/fluid/fluid-hover-highlight";
import { Icon, type IconName } from "@/components/ui/icon";
import { fontWeights } from "@/lib/fluid/font-weight";
import { spring } from "@/lib/fluid/springs";
import {
  useFluidHover,
  useRegisterFluidHoverItem,
} from "@/lib/fluid/use-fluid-hover";

interface ShellSummary {
  activities: number;
  gear: number;
  races: number;
  plan: { name: string; week: number; totalWeeks: number; pct: number } | null;
  nextRace: { name: string; date: string; weeksOut: number } | null;
  upcomingBlock: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    raceName: string | null;
    raceDate: string | null;
  } | null;
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
  {
    href: "/activities",
    icon: "activities",
    label: "Activities",
    countKey: "activities",
    matchPrefix: "/activities",
  },
  { href: "/plan", icon: "plan", label: "Training Plan", matchPrefix: "/plan" },
  { href: "/shoes", icon: "shoe", label: "Shoes", countKey: "gear" },
  { href: "/races", icon: "race", label: "Races", countKey: "races" },
  { href: "/stats", icon: "stats", label: "Stats" },
  { href: "/heatmap", icon: "heatmap", label: "Heatmap" },
];

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

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

/** A nav label that turns semibold when active without shifting its
 *  neighbours: an invisible semibold copy reserves the width. */
function NavLabel({ label, active }: { label: string; active: boolean }) {
  return (
    <span className="nav-label">
      <span
        style={{
          fontVariationSettings: active ? fontWeights.semibold : fontWeights.normal,
        }}
      >
        {label}
      </span>
      <span aria-hidden="true" style={{ fontVariationSettings: fontWeights.semibold }}>
        {label}
      </span>
    </span>
  );
}

function NavRow({
  item,
  index,
  active,
  count,
  registerItem,
}: {
  item: NavItem;
  index: number;
  active: boolean;
  count: number | undefined;
  registerItem: (index: number, element: HTMLElement | null) => void;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  useRegisterFluidHoverItem(registerItem, index, ref);
  return (
    <Link
      ref={ref}
      href={item.href}
      className={`nav-item ${active ? "active" : ""}`}
      aria-current={active ? "page" : undefined}
    >
      <Icon name={item.icon} className="ico" />
      <NavLabel label={item.label} active={active} />
      {count != null && count > 0 && <span className="nav-count">{count}</span>}
    </Link>
  );
}

/** Nav with one hover highlight gliding between rows, and an active
 *  background that slides to the new row on navigation (spring.moderate)
 *  instead of blinking from one row to the next. */
function FluidNav({
  items,
  activeIndex,
  summary,
}: {
  items: NavItem[];
  activeIndex: number;
  summary: ShellSummary;
}) {
  const ref = useRef<HTMLElement>(null);
  const hover = useFluidHover(ref, { axis: "y" });
  const activeRect =
    hover.isMeasured && activeIndex >= 0 ? hover.itemRects[activeIndex] : undefined;
  return (
    <nav ref={ref} className="nav fluid-list" {...hover.handlers}>
      {activeRect && (
        <motion.div
          className="nav-active-bg"
          initial={false}
          animate={{
            x: activeRect.left,
            y: activeRect.top,
            width: activeRect.width,
            height: activeRect.height,
          }}
          transition={spring.moderate}
        />
      )}
      <FluidHoverHighlight hover={hover} className="fluid-list-highlight" />
      {items.map((it, i) => (
        <NavRow
          key={it.href}
          item={it}
          index={i}
          active={i === activeIndex}
          count={it.countKey ? summary[it.countKey] : undefined}
          registerItem={hover.registerItem}
        />
      ))}
    </nav>
  );
}

export function Sidebar({ summary }: { summary: ShellSummary }) {
  const pathname = usePathname();
  const isActive = (item: NavItem) => {
    if (item.href === "/") return pathname === "/";
    if (item.matchPrefix) return pathname.startsWith(item.matchPrefix);
    return pathname === item.href;
  };
  const activeIndex = ITEMS.findIndex(isActive);

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">S</div>
        <div className="brand-name">Splits</div>
      </div>

      <FluidNav items={ITEMS} activeIndex={activeIndex} summary={summary} />

      {summary.plan && (
        <div className="side-group">
          <div className="side-label">Current block</div>
          <div className="side-block">
            <div className="side-block-name">
              {summary.nextRace?.name ?? summary.plan.name}
            </div>
            {summary.nextRace && (
              <div className="side-caption">
                {fmtMd(summary.nextRace.date)} · {summary.nextRace.weeksOut}{" "}
                {summary.nextRace.weeksOut === 1 ? "week" : "weeks"} out
              </div>
            )}
            <div className="side-meter">
              <span style={{ width: `${summary.plan.pct}%` }} />
            </div>
            <div className="side-caption">
              Week {summary.plan.week} of {summary.plan.totalWeeks} ·{" "}
              {summary.plan.pct}%
            </div>
          </div>
        </div>
      )}

      {summary.upcomingBlock && (
        <div className="side-group">
          <div className="side-label">Next block</div>
          <Link
            href={`/plan?plan=${summary.upcomingBlock.id}`}
            className="side-block side-block-link"
          >
            <div className="side-block-name">
              {summary.upcomingBlock.raceName ?? summary.upcomingBlock.name}
            </div>
            <div className="side-caption">
              {fmtMd(summary.upcomingBlock.startDate)} –{" "}
              {fmtMd(summary.upcomingBlock.endDate)}
            </div>
          </Link>
        </div>
      )}

      <div className="sidebar-footer">
        {summary.lastSync ? (
          <span className="side-sync">
            Synced {relativeTime(summary.lastSync)}
            {summary.lastSyncCount > 0 &&
              ` · ${summary.lastSyncCount} ${summary.lastSyncCount === 1 ? "activity" : "activities"}`}
          </span>
        ) : (
          <span className="side-sync">Not synced</span>
        )}
      </div>
    </aside>
  );
}
