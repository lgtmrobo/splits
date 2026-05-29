// COROS Training Hub — push planned runs to the training calendar.
//
// ⚠️  Uses the UNOFFICIAL, reverse-engineered COROS Training Hub API
//     (same endpoints t.coros.com uses). Undocumented; may break anytime.
//     Endpoints/auth mapped from the cygnusb/coros-mcp project.
//
// Credentials come from .env (gitignored): COROS_EMAIL, COROS_PASSWORD,
// COROS_REGION (us|eu|asia, default us).
//
// Usage:
//   node scripts/coros-push.mjs probe        # read-only: login + dump library/calendar/sports
//   node scripts/coros-push.mjs test YYYYMMDD # schedule ONE sample run on a date
//   node scripts/coros-push.mjs push          # bulk: all planned runs from today → Surf City
//
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const env = readFileSync("/Users/1234/Documents/Repos/splits/.env", "utf8");
for (const line of env.split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const REGION = process.env.COROS_REGION || "us";
const BASE = {
  eu: "https://teameuapi.coros.com",
  us: "https://teamapi.coros.com",
  asia: "https://teamcnapi.coros.com",
  cn: "https://teamcnapi.coros.com",
}[REGION];
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36";

const md5 = (s) => createHash("md5").update(s).digest("hex");

let AUTH = null; // { token, userId }

async function login() {
  const email = process.env.COROS_EMAIL;
  const password = process.env.COROS_PASSWORD;
  if (!email || !password) {
    throw new Error("Set COROS_EMAIL and COROS_PASSWORD in .env");
  }
  const resp = await fetch(BASE + "/account/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": UA },
    body: JSON.stringify({ account: email, accountType: 2, pwd: md5(password) }),
  });
  const body = await resp.json();
  if (body.result !== "0000") {
    throw new Error(`login failed: ${body.result} ${body.message ?? ""}`);
  }
  AUTH = { token: body.data.accessToken, userId: body.data.userId };
  console.log(`✓ logged in as userId=${AUTH.userId} (region=${REGION})`);
}

function headers() {
  return {
    "Content-Type": "application/json",
    "User-Agent": UA,
    accessToken: AUTH.token,
    yfheader: JSON.stringify({ userId: AUTH.userId }),
  };
}

async function api(path, { method = "GET", params, body } = {}) {
  let url = BASE + path;
  if (params) url += "?" + new URLSearchParams(params).toString();
  const resp = await fetch(url, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await resp.json();
  if (json.result !== "0000") {
    throw new Error(`${path} error: ${json.result} ${json.message ?? ""}`);
  }
  return json.data;
}

// ---- read-only discovery --------------------------------------------------
async function probe() {
  await login();

  console.log("\n=== workout library (/training/program/query) ===");
  const programs = await api("/training/program/query", { method: "POST", body: {} });
  const list = Array.isArray(programs) ? programs : programs?.dataList ?? [];
  console.log(`templates: ${list.length}`);
  for (const p of list.slice(0, 5)) {
    console.log(`  • ${p.name}  sportType=${p.sportType}  exercises=${p.exercises?.length ?? "?"}`);
  }
  // Dump the FULL first running-ish template so we learn the exact schema
  // (sportType, targetType, intensityType) for a real run workout.
  const run = list.find((p) => /run/i.test(p.name)) ?? list[0];
  if (run) {
    console.log("\n--- full sample program (for schema discovery) ---");
    console.log(JSON.stringify(run, null, 2).slice(0, 4000));
  }

  console.log("\n=== sport list (/activity/fit/getImportSportList) ===");
  try {
    const sports = await api("/activity/fit/getImportSportList", { params: { userId: AUTH.userId } });
    console.log(JSON.stringify(sports, null, 2).slice(0, 2000));
  } catch (e) {
    console.log("(sport list failed:", e.message, ")");
  }

  console.log("\n=== upcoming calendar (/training/schedule/query, today→+30d) ===");
  const today = new Date(Date.UTC(2026, 4, 28)); // pinned: 2026-05-28
  const ymd = (d) => d.toISOString().slice(0, 10).replace(/-/g, "");
  const end = new Date(today.getTime() + 30 * 86400000);
  const sched = await api("/training/schedule/query", {
    params: { startDate: ymd(today), endDate: ymd(end), supportRestExercise: 1 },
  });
  console.log(`maxIdInPlan=${sched?.maxIdInPlan}  entities=${(sched?.entities ?? []).length}  programs=${(sched?.programs ?? []).length}`);
  if ((sched?.programs ?? []).length) {
    console.log("\n--- scheduled program(s) — FULL (run schema ground truth) ---");
    console.log(JSON.stringify(sched.programs, null, 2));
    console.log("\n--- entities ---");
    console.log(JSON.stringify(sched.entities, null, 2));
  } else {
    console.log("(no scheduled workouts in window yet)");
  }
}

async function scan() {
  await login();
  const tries = [
    ["POST", "/training/program/query", { body: {} }],
    ["GET", "/training/schedule/querysum", { params: { startDate: "20260101", endDate: "20261231" } }],
    ["GET", "/training/schedule/query", { params: { startDate: "20260101", endDate: "20261231", supportRestExercise: 1 } }],
    ["POST", "/training/plan/query", { body: {} }],
    ["POST", "/training/plan/list", { body: {} }],
    ["GET", "/training/plan/query", { params: { userId: AUTH.userId } }],
    ["POST", "/training/trainingPlan/query", { body: {} }],
  ];
  for (const [method, path, opts] of tries) {
    try {
      const data = await api(path, { method, ...opts });
      const s = JSON.stringify(data);
      console.log(`\n✓ ${method} ${path} → ${s.length} bytes`);
      console.log(s.slice(0, 3000));
    } catch (e) {
      console.log(`\n✗ ${method} ${path} → ${e.message}`);
    }
  }
}

async function detail() {
  await login();
  const planId = process.argv[3];
  if (!planId) throw new Error("usage: detail <planId>");
  const tries = [
    ["POST", "/training/plan/detail/query", { body: { id: planId } }],
    ["POST", "/training/plan/queryDetail", { body: { id: planId } }],
    ["POST", "/training/plan/query", { body: { id: planId } }],
    ["POST", "/training/program/query", { body: { planId } }],
    ["POST", "/training/program/query", { body: { id: planId } }],
    ["GET", "/training/plan/detail/query", { params: { id: planId } }],
    ["POST", "/training/plan/program/query", { body: { planId } }],
  ];
  for (const [method, path, opts] of tries) {
    try {
      const data = await api(path, { method, ...opts });
      const s = JSON.stringify(data);
      const hasProg = /"exercises"|"sportType"|"targetType"/.test(s);
      console.log(`\n✓ ${method} ${path} → ${s.length} bytes  ${hasProg ? "★ has program detail" : ""}`);
      if (hasProg || s.length > 200) console.log(JSON.stringify(data, null, 2).slice(0, 5000));
    } catch (e) {
      console.log(`\n✗ ${method} ${path} → ${e.message}`);
    }
  }
}

// ---- write -----------------------------------------------------------------
// Cloned from a real scheduled "3 mi easy" run (probe ground truth). The
// generic run block (originId/sid_run_training) + intensityType 8 pace zone
// is server-validated; we override only name + distance (cm) per session.
const MI_M = 1609.344;
function buildRunProgram(name, meters) {
  const cm = Math.round(meters * 100); // targetValue is centimeters
  const estTime = Math.round((meters / MI_M) * 10.5 * 60); // rough 10:30/mi
  const exercise = {
    access: 0, defaultOrder: 0, equipment: [1], exerciseType: 2, groupId: "0",
    hrType: 0, id: 1, intensityCustom: 0, intensityDisplayUnit: 2,
    intensityMultiplier: 1000, intensityPercent: 72000, intensityPercentExtend: 80000,
    intensityType: 8, intensityValue: 372823, intensityValueExtend: 410105,
    isDefaultAdd: 0, isGroup: false, isIntensityPercent: false, name: "T3001",
    originId: "426109589008859136", overview: "sid_run_training", part: [0],
    restType: 3, restValue: 0, sets: 1, sortNo: 16777216, sourceId: "0",
    sourceUrl: "", sportType: 1, status: 1, subType: 0, targetDisplayUnit: 3,
    targetType: 5, targetValue: cm, videoInfos: [], videoUrl: "",
  };
  return {
    access: 1, name, sportType: 1, unit: 1, subType: 65535,
    targetType: 5, targetValue: cm, distance: cm, estimatedDistance: cm,
    estimatedTime: estTime, duration: estTime, estimatedType: 6,
    exerciseNum: 1, totalSets: 1, isTargetTypeConsistent: 1,
    referExercise: { hrType: 0, intensityType: 8, valueType: 1 },
    exercises: [exercise],
  };
}

async function scheduleRun(name, meters, happenDay, sortNo = 1) {
  // idInPlan must be unique within the plan: maxIdInPlan + 1 for that day.
  const sched = await api("/training/schedule/query", {
    params: { startDate: happenDay, endDate: happenDay, supportRestExercise: 1 },
  });
  const idInPlan = (parseInt(sched?.maxIdInPlan, 10) || 0) + 1;
  const program = { ...buildRunProgram(name, meters), idInPlan };
  await api("/training/schedule/update", {
    method: "POST",
    body: {
      entities: [{ happenDay, idInPlan, sortNoInSchedule: sortNo }],
      programs: [program],
      versionObjects: [{ id: idInPlan, status: 1 }],
      pbVersion: 2,
    },
  });
  return idInPlan;
}

async function test() {
  await login();
  const day = process.argv[3] || "20260531";
  console.log(`scheduling TEST run on ${day}...`);
  const idInPlan = await scheduleRun("TEST · 4 mi easy", 4 * MI_M, day);
  console.log(`✓ posted (idInPlan=${idInPlan}). reading back...`);
  const sched = await api("/training/schedule/query", {
    params: { startDate: day, endDate: day, supportRestExercise: 1 },
  });
  for (const p of sched?.programs ?? []) {
    console.log(`  • "${p.name}"  sportType=${p.sportType}  targetType=${p.targetType}  ${(p.targetValue / 100 / MI_M).toFixed(2)} mi`);
  }
  console.log(`entities on ${day}: ${(sched?.entities ?? []).length}`);
}

async function deleteEntity(entity) {
  await api("/training/schedule/update", {
    method: "POST",
    body: {
      versionObjects: [{
        id: String(entity.idInPlan),
        planProgramId: String(entity.planProgramId ?? entity.idInPlan),
        planId: String(entity.planId),
        status: 3,
      }],
      pbVersion: 2,
    },
  });
}

async function clean() {
  await login();
  const start = process.argv[3] || "20260528";
  const end = process.argv[4] || "20260920";
  const sched = await api("/training/schedule/query", {
    params: { startDate: start, endDate: end, supportRestExercise: 1 },
  });
  const entities = sched?.entities ?? [];
  console.log(`deleting ${entities.length} scheduled entries in ${start}–${end}...`);
  for (const e of entities) {
    await deleteEntity(e);
    console.log(`  ✗ removed idInPlan=${e.idInPlan} (day ${e.happenDay})`);
  }
  console.log("done.");
}

async function push() {
  await login();
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );
  const planId = "b1eb6032-4840-48c6-b073-5e4dc7cb0afd"; // Surf City 10 Miler Build
  const { data: runs, error } = await sb
    .from("planned_runs")
    .select("scheduled_date, workout_type, target_distance_m, description")
    .eq("plan_id", planId)
    .gte("scheduled_date", "2026-05-28")
    .order("scheduled_date");
  if (error) throw error;

  const sessions = runs.filter((r) => r.workout_type !== "rest" && r.target_distance_m);
  console.log(`pushing ${sessions.length} runs (skipping ${runs.length - sessions.length} rest days)...`);
  let ok = 0;
  for (const r of sessions) {
    const day = r.scheduled_date.replace(/-/g, "");
    const name = r.description || `${r.workout_type} ${(r.target_distance_m / MI_M).toFixed(1)} mi`;
    try {
      await scheduleRun(name, r.target_distance_m, day);
      ok++;
      console.log(`  ✓ ${r.scheduled_date}  ${name}`);
    } catch (e) {
      console.log(`  ✗ ${r.scheduled_date}  ${name} — ${e.message}`);
    }
  }
  console.log(`\ndone: ${ok}/${sessions.length} scheduled. Open COROS app → Sync with your device.`);
}

const cmd = process.argv[2] ?? "probe";
if (cmd === "probe") {
  probe().catch((e) => { console.error("✗", e.message); process.exit(1); });
} else if (cmd === "push") {
  push().catch((e) => { console.error("✗", e.message); process.exit(1); });
} else if (cmd === "clean") {
  clean().catch((e) => { console.error("✗", e.message); process.exit(1); });
} else if (cmd === "test") {
  test().catch((e) => { console.error("✗", e.message); process.exit(1); });
} else if (cmd === "detail") {
  detail().catch((e) => { console.error("✗", e.message); process.exit(1); });
} else if (cmd === "scan") {
  scan().catch((e) => { console.error("✗", e.message); process.exit(1); });
} else {
  console.error(`'${cmd}' not implemented yet — run 'probe' first to discover the run schema.`);
  process.exit(1);
}
