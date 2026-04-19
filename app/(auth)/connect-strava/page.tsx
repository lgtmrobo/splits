import Link from "next/link";
import { Icon } from "@/components/ui/icon";

export default function ConnectStravaPage() {
  return (
    <div
      className="card"
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
          Splits reads your activities from Strava. On first connect we'll
          backfill the last 2 years of runs. Everything stays in your
          database — we never share or sell your data.
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
          <span>You can disconnect anytime from settings</span>
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
    </div>
  );
}
