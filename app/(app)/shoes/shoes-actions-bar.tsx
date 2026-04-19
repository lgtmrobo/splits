"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { ShoeForm } from "./shoe-form";
import type { ShoePayload } from "./actions";

export function AddShoeButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn primary" onClick={() => setOpen(true)}>
        + Add shoe
      </button>
      {open && <ShoeForm onClose={() => setOpen(false)} />}
    </>
  );
}

export function EditShoeButton({ shoe }: { shoe: ShoePayload & { id: string } }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="btn ghost"
        onClick={() => setOpen(true)}
        title="Edit shoe"
      >
        <Icon name="more" size={14} />
      </button>
      {open && <ShoeForm initial={shoe} onClose={() => setOpen(false)} />}
    </>
  );
}
