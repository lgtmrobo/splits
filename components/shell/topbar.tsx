"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/ui/icon";

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
  if (pathname === "/fitness") return { crumb: "Analytics", title: "Fitness" };
  if (pathname === "/heatmap") return { crumb: "Map", title: "Heatmap" };
  if (pathname === "/triathlon") return { crumb: "Multisport", title: "Triathlon" };
  return { crumb: "", title: "" };
}

const DAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function todayLabel(): string {
  const d = new Date();
  return `${DAYS_LONG[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export function Topbar({ initial, email }: { initial: string; email: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const p = metaForPath(pathname);
  const [syncing, setSyncing] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  // Phone layout: the sidebar is a drawer (see [data-nav="open"] in
  // globals.css). It closes whenever a nav link changes the page.
  useEffect(() => setNavOpen(false), [pathname]);
  useEffect(() => {
    document.documentElement.dataset.nav = navOpen ? "open" : "closed";
  }, [navOpen]);

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
        <button
          type="button"
          className="btn icon nav-toggle"
          onClick={() => setNavOpen((o) => !o)}
          aria-label="Menu"
          aria-expanded={navOpen}
        >
          <Icon name="menu" size={16} />
        </button>
        <span className="topbar-title">{p.title}</span>
        {p.showDate && <span className="topbar-date">{todayLabel()}</span>}
      </div>
      <div className="topbar-right">
        <button
          type="button"
          className="btn"
          onClick={onSync}
          disabled={syncing}
          aria-label="Sync Strava"
        >
          <Icon name="sync" size={12} />
          <span className="sync-label">{syncing ? "Syncing…" : "Sync Strava"}</span>
        </button>
        <AccountMenu initial={initial} email={email} />
      </div>
      {/* Portaled: the topbar's backdrop-filter would trap a fixed child. */}
      {navOpen &&
        createPortal(
          <div className="nav-backdrop" onClick={() => setNavOpen(false)} />,
          document.body,
        )}
    </div>
  );
}

/** Avatar that opens on hover (or tap, on touch screens) to log out. */
function AccountMenu({ initial, email }: { initial: string; email: string | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // A tap anywhere else closes it.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  return (
    <div
      ref={ref}
      className={`account-menu ${open ? "open" : ""}`}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="avatar"
        onClick={() => setOpen((o) => !o)}
        aria-label="Account"
        aria-expanded={open}
      >
        {initial}
      </button>
      <div className="account-pop card card-panel">
        {email && <div className="account-email">{email}</div>}
        <form action="/api/auth/signout" method="post">
          <button type="submit" className="btn account-logout">
            Log out
          </button>
        </form>
      </div>
    </div>
  );
}
