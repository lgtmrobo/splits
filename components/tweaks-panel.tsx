"use client";

import { useEffect, useState } from "react";

interface Swatch {
  name: string;
  accent: string;
  dim: string;
  soft: string;
  glow: string;
}

const SWATCHES: Swatch[] = [
  {
    name: "electric-green",
    accent: "#8EF542",
    dim: "#6FC02F",
    soft: "rgba(142, 245, 66, 0.12)",
    glow: "rgba(142, 245, 66, 0.35)",
  },
  {
    name: "cyan",
    accent: "#42E8F5",
    dim: "#2FB0C0",
    soft: "rgba(66, 232, 245, 0.12)",
    glow: "rgba(66, 232, 245, 0.35)",
  },
  {
    name: "amber",
    accent: "#F5C542",
    dim: "#C09A2F",
    soft: "rgba(245, 197, 66, 0.12)",
    glow: "rgba(245, 197, 66, 0.35)",
  },
  {
    name: "magenta",
    accent: "#F542B8",
    dim: "#C02F8E",
    soft: "rgba(245, 66, 184, 0.12)",
    glow: "rgba(245, 66, 184, 0.35)",
  },
  {
    name: "violet",
    accent: "#A78BFA",
    dim: "#7C6FCF",
    soft: "rgba(167, 139, 250, 0.12)",
    glow: "rgba(167, 139, 250, 0.35)",
  },
];

export function TweaksPanel() {
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const s = SWATCHES[active];
    const r = document.documentElement;
    r.style.setProperty("--accent", s.accent);
    r.style.setProperty("--accent-dim", s.dim);
    r.style.setProperty("--accent-soft", s.soft);
    r.style.setProperty("--accent-glow", s.glow);
  }, [active]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn"
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          zIndex: 100,
          fontFamily: "var(--font-geist-mono), monospace",
          fontSize: 10,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        Tweaks
      </button>
    );
  }

  return (
    <div className="tweaks-panel">
      <div className="row between" style={{ marginBottom: 10 }}>
        <span className="tweaks-title" style={{ marginBottom: 0 }}>
          Accent color
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close tweaks"
          style={{
            background: "none",
            border: "none",
            color: "var(--text-3)",
            cursor: "pointer",
            fontSize: 14,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>
      <div className="swatch-row">
        {SWATCHES.map((s, i) => (
          <button
            key={s.name}
            type="button"
            aria-label={s.name}
            className={`swatch ${active === i ? "active" : ""}`}
            style={{ background: s.accent }}
            onClick={() => setActive(i)}
          />
        ))}
      </div>
    </div>
  );
}
