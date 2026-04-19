"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Segmented } from "@/components/ui/segmented";

type Range = "ytd" | "12w" | "all";

export function StatsRangeSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const range = (searchParams.get("range") as Range | null) ?? "ytd";

  const setRange = (next: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "ytd") params.delete("range");
    else params.set("range", next);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

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
