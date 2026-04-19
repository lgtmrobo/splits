"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Segmented } from "@/components/ui/segmented";

type Filter = "all" | "workout" | "long" | "easy" | "recovery";

export function ActivityTypeFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filter = (searchParams.get("type") as Filter | null) ?? "all";

  const setFilter = (next: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "all") params.delete("type");
    else params.set("type", next);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

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
