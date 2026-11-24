"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RaceFields, type RaceValues } from "@/components/races/race-fields";
import { Field, Modal } from "@/components/ui/modal";
import { deletePlan, importPlan, type ImportPlanState } from "./actions";

const INITIAL: ImportPlanState = { status: "idle" };

/** A race the block can build to: an upcoming race on the Races page. */
export type RaceOption = RaceValues & { id: string; plan_id: string | null };

/** The block being viewed, for replace mode. */
export interface ExistingBlock {
  planId: string;
  name: string;
  raceId: string | null;
}

export function ImportPlanButton({
  primary = false,
  existing,
  races,
}: {
  primary?: boolean;
  existing?: ExistingBlock;
  races: RaceOption[];
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
      {open && (
        <ImportPlanDialog existing={existing} races={races} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function ImportPlanDialog({
  existing,
  races,
  onClose,
}: {
  existing?: ExistingBlock;
  races: RaceOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(importPlan, INITIAL);
  const [deleting, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [asNew, setAsNew] = useState(false);
  const replacing = !!existing && !asNew;
  const thisPlanId = replacing ? existing.planId : null;

  // Races another block already builds to can't be picked.
  const pickable = races.filter((r) => !r.plan_id || r.plan_id === thisPlanId);
  const [choice, setChoice] = useState<string>((replacing && existing.raceId) || "");
  const [name, setName] = useState(replacing ? existing.name : "");
  const picked = pickable.find((r) => r.id === choice) ?? null;

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
    <Modal
      title={replacing ? "Update training block" : "Upload training block"}
      onClose={onClose}
    >
      <form action={formAction} className="col gap-14">
        <input type="hidden" name="mode" value={replacing ? "replace" : "new"} />
        {replacing && <input type="hidden" name="plan_id" value={existing.planId} />}

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
          <input
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            type="text"
            required
            maxLength={100}
            placeholder="Spring Half Build"
          />
        </Field>

        <Field label="CSV file *">
          <input name="csv" type="file" accept=".csv,text/csv" required />
        </Field>

        <Field label="Goal race">
          <select name="race_choice" value={choice} onChange={(e) => setChoice(e.target.value)}>
            <option value="">No race</option>
            {pickable.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} · {r.race_date}
              </option>
            ))}
            <option value="new">New race…</option>
          </select>
        </Field>

        {/* Keyed so switching races reloads the fields with that race's values. */}
        {choice && <RaceFields key={choice} initial={picked} />}

        {existing && (
          <label className="row gap-6" style={{ fontSize: 12, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={asNew}
              onChange={(e) => {
                setAsNew(e.target.checked);
                setName(e.target.checked ? "" : existing.name);
                setChoice(e.target.checked ? "" : (existing.raceId ?? ""));
              }}
            />
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
        {deleteError && <div style={{ color: "var(--red)", fontSize: 12 }}>{deleteError}</div>}

        <div className="row between wrap gap-8" style={{ marginTop: 6 }}>
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
    </Modal>
  );
}
