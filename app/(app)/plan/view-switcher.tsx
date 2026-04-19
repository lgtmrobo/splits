"use client";

import { useState } from "react";
import { Segmented } from "@/components/ui/segmented";

type View = "week" | "block" | "full";

export function PlanViewSwitcher() {
  const [view, setView] = useState<View>("week");
  return (
    <Segmented
      options={[
        { value: "week", label: "Week" },
        { value: "block", label: "Block" },
        { value: "full", label: "Full" },
      ]}
      value={view}
      onChange={setView}
    />
  );
}
