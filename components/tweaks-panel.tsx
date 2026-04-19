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

const STORAGE_KEY = "splits.accent";

function setFavicon(accent: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="${accent}"/><text x="16" y="22" text-anchor="middle" font-family="ui-monospace, 'SF Mono', Menlo, monospace" font-size="20" font-weight="700" letter-spacing="-0.03em" fill="#0A0A0C">S</text></svg>`;
  const href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  let link = document.querySelector<HTMLLinkElement>("link#dynamic-favicon");
  if (!link) {
    // Remove any existing rel=icon links to avoid Next.js re-applying its default
    document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]').forEach((el) => el.remove());
    link = document.createElement("link");
    link.id = "dynamic-favicon";
    link.rel = "icon";
    link.type = "image/svg+xml";
    document.head.appendChild(link);
  }
  link.href = href;
}

export function TweaksPanel() {
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Load persisted choice on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const idx = SWATCHES.findIndex((s) => s.name === saved);
      if (idx >= 0) setActive(idx);
    }
    setHydrated(true);
  }, []);

  // Apply CSS vars + persist + sync favicon whenever active changes
  useEffect(() => {
    if (!hydrated) return;
    const s = SWATCHES[active];
    const r = document.documentElement;
    r.style.setProperty("--accent", s.accent);
    r.style.setProperty("--accent-dim", s.dim);
    r.style.setProperty("--accent-soft", s.soft);
    r.style.setProperty("--accent-glow", s.glow);
    localStorage.setItem(STORAGE_KEY, s.name);
    setFavicon(s.accent);
  }, [active, hydrated]);

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
