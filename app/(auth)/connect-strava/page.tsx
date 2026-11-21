import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { isOwnerEmail } from "@/lib/auth/allowlist";
import { createServerSupabase } from "@/lib/supabase/server";

// Copy depends on who is signed in (owner vs invited), so never prerender.
export const dynamic = "force-dynamic";

export default async function ConnectStravaPage() {
  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  // The owner gets a 2-year history import; invited users start fresh.
  const importsHistory = isOwnerEmail(user?.email);

  return (
    <div
      className="card card-panel"
      style={{
        width: 420,
        padding: "32px 28px",
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      <div className="row gap-10">
        <div className="brand-mark">S</div>
        <div className="col">
          <div className="brand-name" style={{ fontSize: 16 }}>
            Splits
          </div>
          <div className="brand-sub">One more step</div>
        </div>
      </div>

      <div className="hr" />

      <div className="col gap-8">
        <h1
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 500,
            letterSpacing: "-0.01em",
          }}
        >
          Connect your Strava
        </h1>
        <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
          Splits reads your runs from Strava.{" "}
          {importsHistory
            ? "On first connect we'll import the last 2 years of runs."
            : "Tracking starts from the moment you connect — past runs aren't imported."}{" "}
          Your data is never shared or sold.
        </p>
        <p className="muted" style={{ margin: 0, fontSize: 12, lineHeight: 1.5 }}>
          Use COROS, Garmin or another watch? Make a free Strava account and
          turn on Strava sync in your watch&apos;s app — runs flow through
          automatically.
        </p>
      </div>

      <div
        className="col gap-8"
        style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.5 }}
      >
        <div className="row gap-8">
          <span style={{ color: "var(--accent)" }}>✓</span>
          <span>Read-only access to activities and gear</span>
        </div>
        <div className="row gap-8">
          <span style={{ color: "var(--accent)" }}>✓</span>
          <span>Revoke anytime in Strava → Settings → My Apps</span>
        </div>
        <div className="row gap-8">
          <span style={{ color: "var(--accent)" }}>✓</span>
          <span>New activities sync automatically via webhook</span>
        </div>
      </div>

      <Link
        href="/api/strava/auth"
        className="btn primary"
        style={{ justifyContent: "center", padding: "10px 14px" }}
      >
        <Icon name="sync" size={12} /> Connect Strava
      </Link>

      <div className="hr" />

      <div className="col gap-8">
        <div style={{ fontSize: 14, fontWeight: 500 }}>Optional: connect WHOOP</div>
        <p className="muted" style={{ margin: 0, fontSize: 12, lineHeight: 1.5 }}>
          Pulls daily recovery (resting HR, HRV) and per-workout strain + HR
          zones. We'll backfill the last 30 days on connect.
        </p>
      </div>

      <Link
        href="/api/whoop/auth"
        className="btn"
        style={{ justifyContent: "center", padding: "10px 14px" }}
      >
        <Icon name="sync" size={12} /> Connect WHOOP
      </Link>
    </div>
  );
}
