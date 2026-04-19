"use client";

import { useState } from "react";
import { Segmented } from "@/components/ui/segmented";

type Range = "ytd" | "12w" | "all";

export function StatsRangeSwitcher() {
  const [range, setRange] = useState<Range>("ytd");
  return (
    <Segmented
      options={[
        { value: "ytd", label: "YTD" },
        { value: "12w", label: "12w" },
        { value: "all", label: "All" },
      ]}
      value={range}
      onChange={setRange}
    />
  );
}
