"use client";

import { useState } from "react";
import { MileageBars } from "@/components/charts/mileage-bars";
import { CardHeader, Stat } from "@/components/ui/primitives";
import type { WeekMileage } from "@/lib/types";

export interface AnnualYearData {
  year: number;
  totalMi: number;
  monthly: WeekMileage[];
  currentIndex: number;
  isCurrentYear: boolean;
}

export function AnnualMileageCard({
  years,
  deltaPct,
}: {
  years: AnnualYearData[]; // most recent year first
  deltaPct: number | null; // latest year vs prior year, same point in the calendar
}) {
  const [selectedYear, setSelectedYear] = useState(years[0]?.year);
  const active = years.find((y) => y.year === selectedYear) ?? years[0];
  if (!active) return null;
  const isLatest = active.year === years[0].year;

  return (
    <div className="card">
      <CardHeader
        title="Annual Mileage"
        action={
          <div className="seg">
            {years.map((y) => (
              <button
                key={y.year}
                type="button"
                className={y.year === active.year ? "active" : ""}
                onClick={() => setSelectedYear(y.year)}
              >
                {y.year}
              </button>
            ))}
          </div>
        }
      />
      <Stat
        label={active.isCurrentYear ? "So far" : "Total"}
        value={active.totalMi.toLocaleString()}
        unit="mi"
        size="xl"
        delta={
          isLatest && deltaPct != null
            ? `${deltaPct >= 0 ? "+" : ""}${deltaPct}% vs same point last yr`
            : undefined
        }
        deltaKind={deltaPct != null && deltaPct >= 0 ? "up" : "down"}
      />
      <div style={{ marginTop: 14 }}>
        <MileageBars
          weeks={active.monthly}
          width={820}
          height={160}
          currentIndex={active.currentIndex}
        />
      </div>
      <div className="row gap-16" style={{ marginTop: 10 }}>
        {years.map((y) => (
          <span
            key={y.year}
            className="num"
            style={{
              fontSize: 11,
              color: y.year === active.year ? "var(--accent)" : "var(--text-3)",
            }}
          >
            {y.year} · {y.totalMi.toLocaleString()} mi
          </span>
        ))}
      </div>
    </div>
  );
}
