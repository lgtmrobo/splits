import Anthropic from "@anthropic-ai/sdk";
import { buildAnalysisPrompt, PROMPT_VERSION, SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { createServiceRoleSupabase } from "@/lib/supabase/server";
import type {
  Activity,
  HRZone,
  PlannedRun,
  RunAnalysis,
  RunAnalysisFeedback,
} from "@/lib/types";

const MODEL = "claude-sonnet-4-6";

export interface AnalysisInput {
  activity: Activity;
  recent: Activity[];
  zones: HRZone[];
  matchedPlan: PlannedRun | null;
  planAdherence14d: { completed: number; total: number } | null;
}

/**
 * Run the AI analysis for a single activity and persist to run_analyses.
 * Idempotent: if an analysis already exists for this activity, returns it
 * unless `force: true`.
 */
export async function analyzeRun(
  input: AnalysisInput,
  opts: { force?: boolean } = {}
): Promise<RunAnalysis> {
  const supabase = createServiceRoleSupabase();

  if (!opts.force) {
    const { data: existing } = await supabase
      .from("run_analyses")
      .select("*")
      .eq("activity_id", input.activity.id)
      .maybeSingle();
    if (existing) return existing as RunAnalysis;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const client = new Anthropic({ apiKey });
  const userPrompt = buildAnalysisPrompt(input);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  // Strip any accidental code fences then parse
  const cleaned = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  let parsed: {
    summary: string;
    pacing: string;
    effort: string;
    plan_adherence: string;
    recovery_recommendation: string;
    flags: RunAnalysisFeedback["flags"];
    plan_adherence_score: number | null;
  };
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`AI returned unparseable JSON: ${cleaned.slice(0, 200)}`);
  }

  const tokensUsed = response.usage.input_tokens + response.usage.output_tokens;

  const analysis: RunAnalysis = {
    activity_id: input.activity.id,
    model: MODEL,
    prompt_version: PROMPT_VERSION,
    summary: parsed.summary,
    feedback_jsonb: {
      pacing: parsed.pacing,
      effort: parsed.effort,
      plan_adherence: parsed.plan_adherence,
      recovery_recommendation: parsed.recovery_recommendation,
      flags: parsed.flags,
    },
    plan_adherence_score: parsed.plan_adherence_score,
    tokens_used: tokensUsed,
    generated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("run_analyses").upsert(analysis, {
    onConflict: "activity_id",
  });
  if (error) throw error;

  return analysis;
}
