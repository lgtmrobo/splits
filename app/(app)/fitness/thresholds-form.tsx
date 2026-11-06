"use client";

import { useActionState } from "react";
import { saveThresholds, type ThresholdFormState } from "./actions";

export interface ThresholdField {
  name: "pace" | "lthr" | "resting_hr" | "max_hr";
  label: string;
  /** Hand-set value, shown in the input. Blank = use the estimate. */
  setValue: string;
  /** What the model is using right now, shown as placeholder + caption. */
  current: string;
  source: "set" | "estimated" | "default" | "missing";
  unit: string;
}

const SOURCE_LABEL: Record<ThresholdField["source"], string> = {
  set: "set by you",
  estimated: "estimated",
  default: "default",
  missing: "not enough data",
};

const INITIAL: ThresholdFormState = { ok: false, error: null };

export function ThresholdsForm({ fields }: { fields: ThresholdField[] }) {
  const [state, action, pending] = useActionState(saveThresholds, INITIAL);

  return (
    <form action={action} className="col gap-12">
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
        {fields.map((f) => (
          <label key={f.name} className="col gap-4" style={{ fontSize: 11 }}>
            <span className="stat-label">{f.label}</span>
            <input
              type="text"
              name={f.name}
              defaultValue={f.setValue}
              placeholder={f.current}
              inputMode={f.name === "pace" ? "text" : "numeric"}
              aria-describedby={`${f.name}-hint`}
            />
            <span id={`${f.name}-hint`} className="muted">
              {f.current} {f.unit} · {SOURCE_LABEL[f.source]}
            </span>
          </label>
        ))}
      </div>
      <div className="row gap-12" style={{ alignItems: "center" }}>
        <button type="submit" className="btn primary" disabled={pending}>
          {pending ? "Saving…" : "Save thresholds"}
        </button>
        <span className="muted" style={{ fontSize: 11 }}>
          Leave a field blank to estimate it from your runs.
        </span>
        {state.error && (
          <span role="alert" style={{ color: "var(--red)", fontSize: 12 }}>
            {state.error}
          </span>
        )}
        {state.ok && !pending && (
          <span style={{ color: "var(--accent)", fontSize: 12 }}>Saved.</span>
        )}
      </div>
    </form>
  );
}
