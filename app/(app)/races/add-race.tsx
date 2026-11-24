"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RaceFields } from "@/components/races/race-fields";
import { Modal } from "@/components/ui/modal";
import { addRace, type AddRaceState } from "./actions";

const INITIAL: AddRaceState = { status: "idle" };

export function AddRaceButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn primary" onClick={() => setOpen(true)}>
        + Add race
      </button>
      {open && <AddRaceDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function AddRaceDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(addRace, INITIAL);

  useEffect(() => {
    if (state.status === "ok") {
      onClose();
      router.refresh();
    }
  }, [state, onClose, router]);

  return (
    <Modal title="Add race" onClose={onClose}>
      <form action={formAction} className="col gap-14">
        <RaceFields withCourse />
        <p className="muted" style={{ margin: 0, fontSize: 12, lineHeight: 1.5 }}>
          To train for it, upload a training block on the Plan page and pick this race.
        </p>
        {state.status === "error" && (
          <div style={{ color: "var(--red)", fontSize: 12 }}>{state.message}</div>
        )}
        <div className="row gap-8" style={{ justifyContent: "flex-end", marginTop: 6 }}>
          <button type="button" className="btn" onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={pending}>
            {pending ? "Saving…" : "Add race"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
