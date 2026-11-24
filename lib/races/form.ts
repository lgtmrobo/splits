// Race fields from a form post, shared by Add race and the plan upload's
// goal race. Field names: race_name, race_type, race_date, race_distance
// (meters preset or "custom"), race_distance_mi, goal_time, race_location,
// race_gpx (optional file).

import { parseGoalTime } from "@/lib/plan/csv";
import { courseFromGpx } from "@/lib/races/gpx";
import {
  isRaceType,
  isTriathlon,
  M_PER_MILE,
  triTotalM,
  type RaceType,
} from "@/lib/races/types";

const MAX_NAME_LENGTH = 100;
const MAX_LOCATION_LENGTH = 100;
const MAX_GPX_BYTES = 5 * 1024 * 1024;

export interface RaceInput {
  name: string;
  race_type: RaceType;
  race_date: string;
  distance_m: number;
  goal_time_s: number | null;
  location?: string | null;
  course_polyline?: string;
  course_elevation_gain_m?: number | null;
}

function text(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}

/**
 * The race described by the form. `null` = no race name given; a string is
 * a validation error to show the user.
 */
export async function readRace(form: FormData): Promise<RaceInput | null | string> {
  const name = text(form, "race_name");
  if (!name) return null;
  if (name.length > MAX_NAME_LENGTH) return "Race name is too long.";

  const typeRaw = text(form, "race_type") || "run";
  if (!isRaceType(typeRaw)) return "Pick a race type.";

  const raceDate = text(form, "race_date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raceDate)) return "Pick a race date.";

  let distanceM: number;
  if (isTriathlon(typeRaw)) {
    distanceM = triTotalM(typeRaw as "ironman_70_3" | "ironman");
  } else {
    const preset = text(form, "race_distance");
    const miles =
      preset === "custom" ? Number(text(form, "race_distance_mi")) : Number(preset) / M_PER_MILE;
    if (!Number.isFinite(miles) || miles <= 0 || miles > 500) {
      return "Enter the race distance.";
    }
    distanceM = miles * M_PER_MILE;
  }

  const goal = parseGoalTime(text(form, "goal_time"));
  if (goal === undefined) return "Goal time should look like 1:45:00 or 24:30.";

  const race: RaceInput = {
    name,
    race_type: typeRaw,
    race_date: raceDate,
    distance_m: Math.round(distanceM),
    goal_time_s: goal,
  };

  // Only touch location / course when the form has those fields, so the plan
  // upload (which doesn't) never wipes them on an existing race.
  if (form.has("race_location")) {
    const location = text(form, "race_location");
    if (location.length > MAX_LOCATION_LENGTH) return "Location is too long.";
    race.location = location || null;
  }

  const gpx = form.get("race_gpx");
  if (gpx instanceof File && gpx.size > 0) {
    if (gpx.size > MAX_GPX_BYTES) return "That GPX file is too big (5 MB max).";
    const course = courseFromGpx(await gpx.text());
    if (!course) return "Couldn't find any track points in that GPX file.";
    Object.assign(race, course);
  }

  return race;
}
