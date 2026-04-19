import type { Activity, HRZone, PlannedRun } from "@/lib/types";

export const PROMPT_VERSION = "v1";

export const SYSTEM_PROMPT = `You are a running coach reviewing a single workout the athlete just completed. Your tone is direct, specific, and actionable — like a coach texting a quick note, not writing a report. No hedging, no filler. Cite numbers from the data, not vibes.

Response format: return ONLY valid JSON matching this schema (no prose outside the JSON, no code fences):

{
  "summary": "2-3 sentence plain-language headline",
  "pacing": "short paragraph on pace vs target (use numbers)",
  "effort": "short paragraph on HR/effort (use numbers)",
  "plan_adherence": "how well this satisfied the planned workout, or 'Unplanned run' if no plan match",
  "recovery_recommendation": "short suggestion for the next 24-48h",
  "flags": [
    { "kind": "positive" | "note" | "warn", "text": "short phrase, <8 words" }
  ],
  "plan_adherence_score": number 0-100 or null if unplanned
}

Rules:
- Keep every string tight. summary ≤ 2 sentences, paragraphs ≤ 3 sentences.
- Always include 1-3 flags. Default to 2.
- flags.kind: "positive" for wins, "note" for tune-ups, "warn" for red flags (injury risk, big HR/pace mismatch, etc).`;

/**
 * Build the user-turn payload for an activity.
 */
export function buildAnalysisPrompt(args: {
  activity: Activity;
  recent: Activity[];
  zones: HRZone[];
  matchedPlan: PlannedRun | null;
  planAdherence14d: { completed: number; total: number } | null;
}): string {
  const { activity: a, recent, zones, matchedPlan, planAdherence14d } = args;

  const recentSummary = recent
    .slice(0, 5)
    .map(
      (r) =>
        `- ${r.start_date_local.slice(0, 10)} · ${r.name} · ${(r.distance_m / 1609.344).toFixed(1)}mi @ ${
          r.average_speed_ms
            ? (() => {
                const s = 1609.344 / r.average_speed_ms;
                const m = Math.floor(s / 60);
                const ss = Math.round(s % 60);
                return `${m}:${String(ss).padStart(2, "0")}/mi`;
              })()
            : "—"
        } · HR ${r.average_heartrate ?? "—"}`
    )
    .join("\n");

  const zoneSummary = zones
    .map((z) => `  ${z.zone} (${z.label}, ${z.bpm_range}): ${z.minutes}m · ${z.pct}%`)
    .join("\n");

  const planLine = matchedPlan
    ? `Planned: ${matchedPlan.workout_type} · ${
        matchedPlan.target_distance_m
          ? `${(matchedPlan.target_distance_m / 1609.344).toFixed(1)}mi`
          : ""
      } — ${matchedPlan.description ?? ""}`
    : "No planned workout for this date (unplanned run).";

  const adherenceLine = planAdherence14d
    ? `14-day plan adherence: ${planAdherence14d.completed}/${planAdherence14d.total} sessions completed.`
    : "";

  return `Activity to analyze:
- Name: ${a.name}
- Type: ${a.type} / ${a.sport_type ?? ""}
- Date: ${a.start_date_local}
- Distance: ${(a.distance_m / 1609.344).toFixed(2)}mi
- Moving time: ${Math.floor(a.moving_time_s / 60)}:${String(a.moving_time_s % 60).padStart(2, "0")}
- Avg pace: ${
    a.average_speed_ms
      ? (() => {
          const s = 1609.344 / a.average_speed_ms;
          const m = Math.floor(s / 60);
          const ss = Math.round(s % 60);
          return `${m}:${String(ss).padStart(2, "0")}/mi`;
        })()
      : "—"
  }
- Avg HR: ${a.average_heartrate ?? "—"}  ·  Max HR: ${a.max_heartrate ?? "—"}
- Elevation gain: ${a.total_elevation_gain_m ? Math.round(a.total_elevation_gain_m / 0.3048) : "—"} ft
- Cadence: ${a.average_cadence ?? "—"} spm

Time in zones (this run):
${zoneSummary}

${planLine}
${adherenceLine}

Previous 5 activities:
${recentSummary}

Return your JSON analysis now.`;
}
