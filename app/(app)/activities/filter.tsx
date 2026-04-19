"use client";

import { useState } from "react";
import { Segmented } from "@/components/ui/segmented";

type Filter = "all" | "workout" | "long" | "easy" | "recovery";

export function ActivityTypeFilter() {
  const [filter, setFilter] = useState<Filter>("all");
  return (
    <Segmented
      options={[
        { value: "all", label: "All" },
        { value: "workout", label: "Work" },
        { value: "long", label: "Long" },
        { value: "easy", label: "Easy" },
        { value: "recovery", label: "Recov" },
      ]}
      value={filter}
      onChange={setFilter}
    />
  );
}
