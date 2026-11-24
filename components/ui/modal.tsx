"use client";

import { useEffect, type ReactNode } from "react";

/**
 * Centered dialog on desktop, bottom sheet on phones (see .modal in
 * globals.css). Closes on backdrop click and Escape.
 */
export function Modal({
  title,
  onClose,
  width = 480,
  children,
}: {
  title: string;
  onClose: () => void;
  width?: number;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="card card-panel modal"
        style={{ width }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row between baseline">
          <h2 className="modal-title">{title}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Labeled form field used inside modals. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="col gap-4">
      <span className="stat-label" style={{ marginBottom: 0 }}>
        {label}
      </span>
      {children}
    </label>
  );
}
