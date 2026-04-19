"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import { saveShoe, deleteShoe, type ShoePayload } from "./actions";

interface Props {
  initial?: ShoePayload & { id: string };
  onClose: () => void;
}

const M_PER_MILE = 1609.344;

const PURPOSE_OPTIONS = ["Daily", "Workouts / Race", "Long runs", "Recovery", "Trail", "Other"];

export function ShoeForm({ initial, onClose }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ShoePayload>(
    initial ?? {
      name: "",
      brand_name: "",
      model_name: "",
      description: "Daily",
      miles: 0,
      cap_miles: 500,
      primary_shoe: false,
      retired: false,
    }
  );

  const submit = () => {
    if (!form.name.trim()) {
      setError("Name is required");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await saveShoe(form);
        onClose();
      } catch (e) {
        setError(String(e));
      }
    });
  };

  const remove = () => {
    if (!initial?.id) return;
    if (!confirm(`Delete "${form.name}"? Activities currently using this shoe will be unlinked.`)) return;
    startTransition(async () => {
      try {
        await deleteShoe(initial.id);
        onClose();
      } catch (e) {
        setError(String(e));
      }
    });
  };

  return (
    <div
      role="dialog"
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
      <div
        className="card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 460,
          maxWidth: "90vw",
          padding: 24,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div className="row between baseline">
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 500, letterSpacing: "-0.01em" }}>
            {initial ? "Edit shoe" : "Add shoe"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: "none", border: "none", color: "var(--text-3)", cursor: "pointer", fontSize: 16 }}
          >×</button>
        </div>

        <Field label="Name *">
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Saucony Triumph 22"
            autoFocus
          />
        </Field>

        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Brand">
            <input
              type="text"
              value={form.brand_name}
              onChange={(e) => setForm({ ...form, brand_name: e.target.value })}
              placeholder="Saucony"
            />
          </Field>
          <Field label="Model">
            <input
              type="text"
              value={form.model_name}
              onChange={(e) => setForm({ ...form, model_name: e.target.value })}
              placeholder="Triumph 22"
            />
          </Field>
        </div>

        <Field label="Purpose">
          <select
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          >
            {PURPOSE_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>

        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Current miles">
            <input
              type="number"
              min={0}
              value={form.miles}
              onChange={(e) => setForm({ ...form, miles: Number(e.target.value) })}
            />
          </Field>
          <Field label="Retire at (mi)">
            <input
              type="number"
              min={50}
              value={form.cap_miles}
              onChange={(e) => setForm({ ...form, cap_miles: Number(e.target.value) })}
            />
          </Field>
        </div>

        <div className="row gap-14">
          <label className="row gap-6" style={{ fontSize: 12, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={form.primary_shoe}
              onChange={(e) => setForm({ ...form, primary_shoe: e.target.checked })}
            />
            Primary shoe
          </label>
          <label className="row gap-6" style={{ fontSize: 12, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={form.retired}
              onChange={(e) => setForm({ ...form, retired: e.target.checked })}
            />
            Retired
          </label>
        </div>

        {error && (
          <div style={{ color: "var(--red)", fontSize: 12 }}>{error}</div>
        )}

        <div className="row between" style={{ marginTop: 6 }}>
          <div>
            {initial && (
              <button type="button" className="btn" onClick={remove} disabled={pending} style={{ color: "var(--red)" }}>
                <Icon name="more" size={12} /> Delete
              </button>
            )}
          </div>
          <div className="row gap-8">
            <button type="button" className="btn" onClick={onClose} disabled={pending}>Cancel</button>
            <button type="button" className="btn primary" onClick={submit} disabled={pending}>
              {pending ? "Saving…" : initial ? "Save" : "Add shoe"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="col gap-4">
      <span className="stat-label" style={{ marginBottom: 0 }}>{label}</span>
      {children}
    </label>
  );
}
