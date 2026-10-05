// Workout/activity type pill — one pastel tone per type so the kind of run
// reads at a glance. Accepts either a planned `workout_type` ("tempo") or a
// derived activity label ("Workout", "Fartlek"); matching is case-insensitive.

const TONE_BY_TYPE: Record<string, string> = {
  easy: "easy",
  recovery: "recovery",
  long: "long",
  tempo: "tempo",
  interval: "workout",
  workout: "workout",
  fartlek: "fartlek",
  race: "race",
  rest: "rest",
};

export function TypePill({ type, label }: { type: string; label?: string }) {
  const tone = TONE_BY_TYPE[type.toLowerCase()] ?? "rest";
  const text = label ?? type.charAt(0).toUpperCase() + type.slice(1);
  return <span className={`pill type-${tone}`}>{text}</span>;
}
