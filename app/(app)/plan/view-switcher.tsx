"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Segmented } from "@/components/ui/segmented";

type View = "week" | "block" | "full";

export function PlanViewSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = (searchParams.get("view") as View | null) ?? "week";

  const setView = (next: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "week") params.delete("view");
    else params.set("view", next);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

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
