"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { importPlan, type ImportPlanState } from "./actions";

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

export function ImportPlanButton({ primary = false }: { primary?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={primary ? "btn primary" : "btn"}
        onClick={() => setOpen(true)}
      >
        Upload block (CSV)
      </button>
      {open && <ImportPlanDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function ImportPlanDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(importPlan, INITIAL);
  const [withRace, setWithRace] = useState(false);
  const [distance, setDistance] = useState(String(RACE_DISTANCES[2].value));
  // Controlled so values survive React resetting the form after a failed submit.
  const [fields, setFields] = useState({
    name: "",
    race_name: "",
    race_date: "",
    goal_time: "",
    race_distance_mi: "",
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
      router.push("/plan");
      router.refresh();
    }
  }, [state, onClose, router]);

  return (
    <div
      role="dialog"
      aria-label="Upload training block"
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
        <div className="row between baseline">
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 500, letterSpacing: "-0.01em" }}>
            Upload training block
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
          One row per day: date, workout type, miles, target pace, description.{" "}
          <a href="/plan-template.csv" download style={{ color: "var(--accent)" }}>
            Download the template
          </a>
          , fill it in (Google Sheets → File → Download → CSV works), and upload it here.
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

        <div className="row gap-8" style={{ justifyContent: "flex-end", marginTop: 6 }}>
          <button type="button" className="btn" onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={pending}>
            {pending ? "Importing…" : "Import block"}
          </button>
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
