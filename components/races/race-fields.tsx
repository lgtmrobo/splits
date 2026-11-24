"use client";

import { useState } from "react";
import { Field } from "@/components/ui/modal";
import {
  isTriathlon,
  M_PER_MILE,
  RACE_DISTANCES,
  RACE_TYPES,
  TRI_LEGS,
  type RaceType,
} from "@/lib/races/types";

/** A race's editable values, as the fields show them. */
export interface RaceValues {
  name: string;
  race_type: RaceType;
  race_date: string;
  distance_m: number | null;
  goal_time_s: number | null;
  location?: string | null;
}

function formatGoal(s: number | null): string {
  if (s == null) return "";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** Preset select value for a stored distance, or "custom". */
function distancePreset(distanceM: number | null | undefined): string {
  if (distanceM == null) return String(RACE_DISTANCES[2].value);
  const match = RACE_DISTANCES.find((d) => Math.abs(d.value - distanceM) < 2);
  return match ? String(match.value) : "custom";
}

const legMiles = (m: number) => Number((m / M_PER_MILE).toFixed(1));

/**
 * Race name, type, date, goal and distance inputs (names match
 * lib/races/form.ts). Controlled, so values survive React resetting the
 * form after a failed submit. `withCourse` adds location + GPX upload.
 */
export function RaceFields({
  initial,
  withCourse = false,
}: {
  initial?: RaceValues | null;
  withCourse?: boolean;
}) {
  const [type, setType] = useState<RaceType>(initial?.race_type ?? "run");
  const [distance, setDistance] = useState(distancePreset(initial?.distance_m));
  const [fields, setFields] = useState({
    race_name: initial?.name ?? "",
    race_date: initial?.race_date ?? "",
    goal_time: formatGoal(initial?.goal_time_s ?? null),
    race_location: initial?.location ?? "",
    race_distance_mi:
      initial?.distance_m != null && distancePreset(initial.distance_m) === "custom"
        ? (initial.distance_m / M_PER_MILE).toFixed(1)
        : "",
  });
  const bind = (key: keyof typeof fields) => ({
    name: key,
    value: fields[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setFields((f) => ({ ...f, [key]: e.target.value })),
  });
  const tri = isTriathlon(type) ? TRI_LEGS[type as "ironman_70_3" | "ironman"] : null;

  return (
    <>
      <Field label="Race name">
        <input {...bind("race_name")} type="text" required maxLength={100} placeholder="Carlsbad Half Marathon" />
      </Field>
      <div className="grid m-stack" style={{ gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="Type">
          <select name="race_type" value={type} onChange={(e) => setType(e.target.value as RaceType)}>
            {RACE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Race date">
          <input {...bind("race_date")} type="date" required />
        </Field>
      </div>
      {tri ? (
        <div className="muted" style={{ fontSize: 12 }}>
          Swim {legMiles(tri.swim_m)} mi · Bike {legMiles(tri.bike_m)} mi · Run {legMiles(tri.run_m)} mi.
          Swims and rides sync from Strava along with your runs.
        </div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Distance">
            <select name="race_distance" value={distance} onChange={(e) => setDistance(e.target.value)}>
              {RACE_DISTANCES.map((d) => (
                <option key={d.label} value={d.value}>
                  {d.label}
                </option>
              ))}
              <option value="custom">Other…</option>
            </select>
          </Field>
          {distance === "custom" && (
            <Field label="Miles">
              <input {...bind("race_distance_mi")} type="number" min={0.1} step={0.1} required />
            </Field>
          )}
        </div>
      )}
      <div className="grid m-stack" style={{ gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="Goal time (optional)">
          <input {...bind("goal_time")} type="text" inputMode="numeric" placeholder={tri ? "5:30:00" : "1:45:00"} />
        </Field>
        {withCourse && (
          <Field label="Location (optional)">
            <input {...bind("race_location")} type="text" maxLength={100} placeholder="Carlsbad, CA" />
          </Field>
        )}
      </div>
      {withCourse && (
        <Field label="Course GPX (optional)">
          <input name="race_gpx" type="file" accept=".gpx,application/gpx+xml" />
        </Field>
      )}
    </>
  );
}
