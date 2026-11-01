"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  clearShoeSplit,
  saveShoeSplit,
} from "@/app/(app)/activities/[id]/actions";
import { ShoeDot } from "@/components/gear/shoe-label";

const MAX_PARTS = 4;

interface ShoeOption {
  id: string;
  name: string;
  color: string;
}

interface Part {
  gear_id: string;
  miles: string;
}

export interface ShoeSplitSummary {
  gear_id: string;
  miles: number;
  pace: string;
}

/**
 * Per-shoe breakdown for a split run, plus an inline editor to split a run
 * across pairs (e.g. yards 1–3 in one shoe, yard 4 in another). Every row
 * but the last takes miles; the last shoe gets the rest of the run.
 */
export function ShoeSplitEditor({
  activityId,
  totalMiles,
  shoes,
  split,
  defaultGearId,
}: {
  activityId: number;
  totalMiles: number;
  shoes: ShoeOption[];
  split: ShoeSplitSummary[];
  defaultGearId: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [parts, setParts] = useState<Part[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const shoeById = new Map(shoes.map((s) => [s.id, s]));
  const isSplit = split.length > 1;

  function startEditing() {
    const first = defaultGearId ?? shoes[0]?.id ?? "";
    const second = shoes.find((s) => s.id !== first)?.id ?? first;
    setParts(
      isSplit
        ? split.map((s) => ({ gear_id: s.gear_id, miles: s.miles.toFixed(2) }))
        : [
            { gear_id: first, miles: (totalMiles / 2).toFixed(2) },
            { gear_id: second, miles: "" },
          ],
    );
    setError(null);
    setEditing(true);
  }

  const leadingMiles = parts
    .slice(0, -1)
    .reduce((sum, p) => sum + (Number(p.miles) || 0), 0);
  const remainder = totalMiles - leadingMiles;

  function updatePart(i: number, patch: Partial<Part>) {
    setParts(parts.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  }

  function run(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        setEditing(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save the split");
      }
    });
  }

  if (!editing) {
    return (
      <div className="row gap-10" style={{ alignItems: "center", flexWrap: "wrap" }}>
        {isSplit &&
          split.map((s, i) => {
            const shoe = shoeById.get(s.gear_id);
            return (
              <span
                key={i}
                className="num"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  color: "var(--text-2)",
                }}
              >
                {shoe && <ShoeDot color={shoe.color} />}
                {shoe?.name ?? "Unknown shoe"}
                <span style={{ color: "var(--text-1)" }}>
                  {s.miles.toFixed(2)} mi
                </span>
                <span style={{ color: "var(--text-3)" }}>{s.pace}/mi</span>
              </span>
            );
          })}
        {shoes.length > 1 && (
          <button type="button" className="btn ghost" onClick={startEditing}>
            {isSplit ? "Edit shoe split" : "Split shoes"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="col gap-8" style={{ maxWidth: 520 }}>
      {parts.map((p, i) => {
        const isLast = i === parts.length - 1;
        return (
          <div key={i} className="row gap-8" style={{ alignItems: "center" }}>
            <span className="muted num" style={{ fontSize: 11, width: 14 }}>
              {i + 1}
            </span>
            <select
              value={p.gear_id}
              onChange={(e) => updatePart(i, { gear_id: e.target.value })}
              style={{ flex: 1 }}
            >
              {shoes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {isLast ? (
              <span
                className="num"
                style={{
                  width: 110,
                  fontSize: 12,
                  color: remainder > 0 ? "var(--text-2)" : "var(--red)",
                }}
              >
                rest · {remainder.toFixed(2)} mi
              </span>
            ) : (
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={p.miles}
                onChange={(e) => updatePart(i, { miles: e.target.value })}
                aria-label={`Miles in shoe ${i + 1}`}
                style={{ width: 110 }}
              />
            )}
            <button
              type="button"
              className="btn ghost"
              aria-label="Remove shoe"
              disabled={parts.length <= 2}
              onClick={() => setParts(parts.filter((_, j) => j !== i))}
            >
              ✕
            </button>
          </div>
        );
      })}
      {error && (
        <div style={{ fontSize: 12, color: "var(--red)" }}>{error}</div>
      )}
      <div className="row gap-8" style={{ flexWrap: "wrap" }}>
        {parts.length < MAX_PARTS && (
          <button
            type="button"
            className="btn ghost"
            onClick={() =>
              setParts([
                ...parts.slice(0, -1),
                { ...parts[parts.length - 1], miles: "" },
                { gear_id: shoes[0]?.id ?? "", miles: "" },
              ])
            }
          >
            + Add shoe
          </button>
        )}
        <button
          type="button"
          className="btn primary"
          disabled={pending || remainder <= 0}
          onClick={() =>
            run(() =>
              saveShoeSplit(
                activityId,
                parts.map((p) => ({ gear_id: p.gear_id, miles: Number(p.miles) })),
              ),
            )
          }
        >
          {pending ? "Saving…" : "Save split"}
        </button>
        {isSplit && (
          <button
            type="button"
            className="btn"
            disabled={pending}
            onClick={() => run(() => clearShoeSplit(activityId))}
          >
            Use one shoe
          </button>
        )}
        <button
          type="button"
          className="btn ghost"
          disabled={pending}
          onClick={() => setEditing(false)}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
