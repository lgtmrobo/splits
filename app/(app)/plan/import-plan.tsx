"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePlan, importPlan, type ImportPlanState } from "./actions";

const M_PER_MILE = 1609.344;

const RACE_DISTANCES = [
  { label: "5K", value: 5000 },
  { label: "10K", value: 10000 },
  { label: "Half marathon", value: 21097.5 },
  { label: "Marathon", value: 42195 },
  { label: "50K", value: 50000 },
  { label: "10 mile", value: 10 * M_PER_MILE },
];

const INITIAL: ImportPlanState = { status: "idle" };

/** The block being viewed, for replace mode. */
export interface ExistingBlock {
  planId: string;
  name: string;
  race: {
    name: string;
    race_date: string;
    distance_m: number;
    goal_time_s: number | null;
  } | null;
}

export function ImportPlanButton({
  primary = false,
  existing,
}: {
  primary?: boolean;
  existing?: ExistingBlock;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={primary ? "btn primary" : "btn"}
        onClick={() => setOpen(true)}
      >
        {existing ? "Update block" : "Upload block (CSV)"}
      </button>
      {open && <ImportPlanDialog existing={existing} onClose={() => setOpen(false)} />}
    </>
  );
}

function formatGoal(s: number | null): string {
  if (s == null) return "";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** Preset select value for a stored distance, or "custom". */
function distancePreset(distanceM: number | undefined): string {
  if (distanceM == null) return String(RACE_DISTANCES[2].value);
  const match = RACE_DISTANCES.find((d) => Math.abs(d.value - distanceM) < 2);
  return match ? String(match.value) : "custom";
}

function ImportPlanDialog({
  existing,
  onClose,
}: {
  existing?: ExistingBlock;
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(importPlan, INITIAL);
  const [deleting, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [asNew, setAsNew] = useState(false);
  const replacing = !!existing && !asNew;
  const race = replacing ? existing.race : null;

  const [withRace, setWithRace] = useState(!!race);
  const [distance, setDistance] = useState(distancePreset(race?.distance_m));
  // Controlled so values survive React resetting the form after a failed submit.
  const [fields, setFields] = useState({
    name: replacing ? existing.name : "",
    race_name: race?.name ?? "",
    race_date: race?.race_date ?? "",
    goal_time: formatGoal(race?.goal_time_s ?? null),
    race_distance_mi:
      race && distancePreset(race.distance_m) === "custom"
        ? (race.distance_m / M_PER_MILE).toFixed(1)
        : "",
  });
  const bind = (key: keyof typeof fields) => ({
    name: key,
    value: fields[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setFields((f) => ({ ...f, [key]: e.target.value })),
  });

  useEffect(() => {
    if (state.status === "ok") {
      onClose();
      router.push(replacing ? `/plan?plan=${state.planId}` : "/plan");
      router.refresh();
    }
  }, [state, onClose, router, replacing]);

  const remove = () => {
    if (!existing) return;
    if (
      !confirm(
        `Delete "${existing.name}" and all its planned workouts? Your runs and races aren't affected.`,
      )
    )
      return;
    startDelete(async () => {
      try {
        await deletePlan(existing.planId);
        onClose();
        router.push("/plan");
        router.refresh();
      } catch (e) {
        setDeleteError(String(e));
      }
    });
  };

  const busy = pending || deleting;

  return (
    <div
      role="dialog"
      aria-label={replacing ? "Update training block" : "Upload training block"}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.5)",
        display: "grid",
        placeItems: "center",
        zIndex: 200,
      }}
      onClick={onClose}
    >
      <form
        action={formAction}
        className="card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 480,
          maxWidth: "90vw",
          maxHeight: "90vh",
          overflowY: "auto",
          padding: 24,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <input type="hidden" name="mode" value={replacing ? "replace" : "new"} />
        {replacing && <input type="hidden" name="plan_id" value={existing.planId} />}

        <div className="row between baseline">
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 500, letterSpacing: "-0.01em" }}>
            {replacing ? "Update training block" : "Upload training block"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "none",
              border: "none",
              color: "var(--text-3)",
              cursor: "pointer",
              fontSize: 16,
            }}
          >
            ×
          </button>
        </div>

        <p className="muted" style={{ margin: 0, fontSize: 12, lineHeight: 1.5 }}>
          {replacing ? (
            <>
              Upload your edited sheet. <strong>Today onward is replaced</strong> by the CSV;
              days before today stay as they are, so it&apos;s fine to re-upload the whole file.{" "}
            </>
          ) : (
            <>One row per day: date, workout type, miles, target pace, description. </>
          )}
          <a href="/plan-template.csv" download style={{ color: "var(--accent)" }}>
            Download the template
          </a>
          {replacing ? "." : " (Google Sheets → File → Download → CSV works)."}
        </p>

        <Field label="Block name *">
          <input {...bind("name")} type="text" required maxLength={100} placeholder="Spring Half Build" />
        </Field>

        <Field label="CSV file *">
          <input name="csv" type="file" accept=".csv,text/csv" required />
        </Field>

        <label className="row gap-6" style={{ fontSize: 12, cursor: "pointer" }}>
          <input type="checkbox" checked={withRace} onChange={(e) => setWithRace(e.target.checked)} />
          This block builds to a race
        </label>

        {withRace && (
          <>
            <Field label="Race name">
              <input {...bind("race_name")} type="text" required maxLength={100} placeholder="Rose Bowl Half" />
            </Field>
            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="Race date">
                <input {...bind("race_date")} type="date" required />
              </Field>
              <Field label="Goal time (optional)">
                <input {...bind("goal_time")} type="text" placeholder="1:45:00" />
              </Field>
            </div>
            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="Distance">
                <select name="race_distance" value={distance} onChange={(e) => setDistance(e.target.value)}>
                  {RACE_DISTANCES.map((d) => (
                    <option key={d.label} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                  <option value="custom">Other…</option>
                </select>
              </Field>
              {distance === "custom" && (
                <Field label="Miles">
                  <input {...bind("race_distance_mi")} type="number" min={0.1} step={0.1} required />
                </Field>
              )}
            </div>
          </>
        )}

        {existing && (
          <label className="row gap-6" style={{ fontSize: 12, cursor: "pointer" }}>
            <input type="checkbox" checked={asNew} onChange={(e) => setAsNew(e.target.checked)} />
            Upload as a separate new block instead
          </label>
        )}

        {state.status === "error" && (
          <div style={{ color: "var(--red)", fontSize: 12, lineHeight: 1.5 }}>
            {state.message}
            {state.details && (
              <ul style={{ margin: "6px 0 0", paddingLeft: 16 }}>
                {state.details.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        {deleteError && (
          <div style={{ color: "var(--red)", fontSize: 12 }}>{deleteError}</div>
        )}

        <div className="row between" style={{ marginTop: 6 }}>
          <div>
            {existing && (
              <button
                type="button"
                className="btn"
                onClick={remove}
                disabled={busy}
                style={{ color: "var(--red)" }}
              >
                {deleting ? "Deleting…" : "Delete block"}
              </button>
            )}
          </div>
          <div className="row gap-8">
            <button type="button" className="btn" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={busy}>
              {pending ? "Saving…" : replacing ? "Replace schedule" : "Import block"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="col gap-4">
      <span className="stat-label" style={{ marginBottom: 0 }}>
        {label}
      </span>
      {children}
    </label>
  );
}
