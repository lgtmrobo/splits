import { MilesBar } from "@/components/charts/miles-bar";
import { Sparkline } from "@/components/charts/sparkline";
import { Icon } from "@/components/ui/icon";
import { Pill, Stat } from "@/components/ui/primitives";
import { getAllActivities, getAllGear } from "@/lib/supabase/queries";
import { metersToMiles, speedToPacePerMile } from "@/lib/utils/units";

const M_PER_MILE = 1609.344;

function paceFromSpeed(ms: number): string {
  if (!ms || ms <= 0) return "—";
  const secPerMile = M_PER_MILE / ms;
  const m = Math.floor(secPerMile / 60);
  const s = Math.round(secPerMile % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default async function ShoesPage() {
  const [gear, activities] = await Promise.all([getAllGear(), getAllActivities()]);
  const active = gear.filter((g) => !g.retired);
  const retired = gear.filter((g) => g.retired);
  const lifetimeMi = Math.round(gear.reduce((acc, g) => acc + metersToMiles(g.distance_m), 0));

  // Per-shoe aggregations from real activities
  const perShoe = new Map<string, {
    runs: number;
    distSum: number;
    timeSum: number;
    fastestSpeed: number;
    lastRun: string | null;
    weekly: number[];
  }>();
  const todayMs = Date.now();
  const week0 = todayMs - 12 * 7 * 86400_000;
  for (const g of gear) perShoe.set(g.id, { runs: 0, distSum: 0, timeSum: 0, fastestSpeed: 0, lastRun: null, weekly: new Array(12).fill(0) });

  for (const a of activities) {
    if (!a.gear_id) continue;
    const s = perShoe.get(a.gear_id);
    if (!s) continue;
    s.runs++;
    s.distSum += Number(a.distance_m ?? 0);
    s.timeSum += Number(a.moving_time_s ?? 0);
    if (a.max_speed_ms && a.max_speed_ms > s.fastestSpeed) s.fastestSpeed = a.max_speed_ms;
    const date = a.start_date_local?.slice(0, 10) ?? null;
    if (date && (!s.lastRun || date > s.lastRun)) s.lastRun = date;
    const t = new Date(a.start_date).getTime();
    if (t >= week0) {
      const idx = 11 - Math.floor((todayMs - t) / (7 * 86400_000));
      if (idx >= 0 && idx < 12) s.weekly[idx] += metersToMiles(Number(a.distance_m ?? 0));
    }
  }

  // Top-line summary cards
  const mostMiles = [...gear].sort((a, b) => b.distance_m - a.distance_m)[0] ?? null;
  let fastestShoe: { name: string; pace: string } | null = null;
  let fastestSpeed = 0;
  for (const [id, s] of perShoe) {
    if (s.fastestSpeed > fastestSpeed) {
      const g = gear.find((x) => x.id === id);
      if (g) {
        fastestSpeed = s.fastestSpeed;
        fastestShoe = { name: g.name, pace: paceFromSpeed(s.fastestSpeed) };
      }
    }
  }
  const readyRetire = active.filter((g) => g.distance_m / g.cap_m > 0.85);
  const readyRetireRemain = readyRetire.length
    ? Math.round(metersToMiles(readyRetire.reduce((a, g) => a + (g.cap_m - g.distance_m), 0)))
    : 0;

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const monthShoes = new Set<string>();
  let monthMi = 0;
  for (const a of activities) {
    if (new Date(a.start_date) < monthStart) continue;
    monthMi += metersToMiles(Number(a.distance_m ?? 0));
    if (a.gear_id) monthShoes.add(a.gear_id);
  }

  return (
    <div className="content fadein">
      <div className="row between" style={{ marginBottom: 14 }}>
        <div className="col gap-4">
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 500, letterSpacing: "-0.01em" }}>Shoes</h1>
          <div className="muted num" style={{ fontSize: 12 }}>
            {active.length} active · {retired.length} retired · {lifetimeMi.toLocaleString()} lifetime mi
          </div>
        </div>
        <div className="row gap-10">
          <button type="button" className="btn">Import from Strava</button>
          <button type="button" className="btn primary">+ Add shoe</button>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(5, 1fr)", marginBottom: 14 }}>
        <div className="card compact">
          {mostMiles ? (
            <Stat label="Most miles" value={Math.round(metersToMiles(mostMiles.distance_m))} unit="mi" delta={mostMiles.name} />
          ) : (
            <Stat label="Most miles" value="—" />
          )}
        </div>
        <div className="card compact">
          {fastestShoe ? (
            <Stat label="Fastest pace" value={fastestShoe.pace} unit="/mi" delta={fastestShoe.name} />
          ) : (
            <Stat label="Fastest pace" value="—" />
          )}
        </div>
        <div className="card compact">
          <Stat
            label="Ready to retire"
            value={String(readyRetire.length)}
            delta={readyRetire.length ? `${readyRetireRemain} mi left` : undefined}
            deltaKind={readyRetire.length ? "warn" : undefined}
          />
        </div>
        <div className="card compact">
          <Stat label="This month" value={monthMi.toFixed(1)} unit="mi" delta={monthShoes.size ? `across ${monthShoes.size} shoe${monthShoes.size === 1 ? "" : "s"}` : undefined} />
        </div>
        <div className="card compact">
          <Stat label="Lifetime" value={lifetimeMi.toLocaleString()} unit="mi" />
        </div>
      </div>

      <div className="card-title" style={{ marginBottom: 8 }}>Active Rotation</div>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
        {active.length === 0 && (
          <div className="card muted" style={{ fontSize: 13 }}>No active shoes synced yet.</div>
        )}
        {active.map((s) => {
          const mi = metersToMiles(s.distance_m);
          const capMi = metersToMiles(s.cap_m);
          const pct = (mi / capMi) * 100;
          const warn = pct > 70;
          const danger = pct > 90;
          const stats = perShoe.get(s.id) ?? { runs: 0, distSum: 0, timeSum: 0, fastestSpeed: 0, lastRun: null, weekly: [] as number[] };
          const avgSpeed = stats.timeSum > 0 ? stats.distSum / stats.timeSum : 0;
          const last12wMi = stats.weekly.reduce((a, b) => a + b, 0);
          return (
            <div key={s.id} className="card">
              <div className="row between" style={{ marginBottom: 12 }}>
                <div className="row gap-10">
                  <div style={{ width: 10, height: 36, background: s.color, borderRadius: 3 }} />
                  <div className="col" style={{ gap: 2 }}>
                    <div style={{ fontSize: 15, fontWeight: 500 }}>{s.name}</div>
                    <div className="muted num" style={{ fontSize: 11 }}>
                      {[s.brand_name, s.purpose].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </div>
                </div>
                <div className="row gap-6">
                  {danger && <Pill kind="red">Retire soon</Pill>}
                  {warn && !danger && <Pill kind="warn">Near cap</Pill>}
                  <button type="button" className="btn ghost">
                    <Icon name="more" size={14} />
                  </button>
                </div>
              </div>
              <div className="row baseline gap-6" style={{ marginBottom: 6 }}>
                <span className="stat-num" style={{ fontSize: 34 }}>{Math.round(mi)}</span>
                <span className="stat-unit">mi</span>
                <span className="muted num" style={{ fontSize: 12, marginLeft: 6 }}>of {Math.round(capMi)}</span>
                <span className="muted num" style={{ fontSize: 12, marginLeft: "auto" }}>{Math.round(pct)}%</span>
              </div>
              <MilesBar miles={mi} cap={capMi} color={s.color} />
              <div className="grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--hairline)" }}>
                <Stat label="Runs" value={String(stats.runs)} />
                <Stat label="Avg pace" value={avgSpeed > 0 ? speedToPacePerMile(avgSpeed) : "—"} unit="/mi" />
                <Stat label="Last run" value={stats.lastRun ? stats.lastRun.slice(5) : "—"} />
                <Stat label="Fastest" value={stats.fastestSpeed > 0 ? paceFromSpeed(stats.fastestSpeed) : "—"} unit="/mi" />
              </div>
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--hairline)" }}>
                <div className="row between" style={{ marginBottom: 4 }}>
                  <span className="stat-label" style={{ marginBottom: 0 }}>Usage · last 12 weeks</span>
                  <span className="num muted" style={{ fontSize: 11 }}>{Math.round(last12wMi)} mi</span>
                </div>
                <Sparkline data={stats.weekly.length ? stats.weekly : [0]} height={28} stroke={s.color} />
              </div>
            </div>
          );
        })}
      </div>

      {retired.length > 0 && (
        <>
          <div className="card-title" style={{ marginBottom: 8 }}>Retired</div>
          <div className="card" style={{ padding: 0 }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th></th>
                  <th>Shoe</th>
                  <th>Brand</th>
                  <th>Purpose</th>
                  <th className="num">Miles</th>
                  <th>Last run</th>
                  <th className="num">Avg pace</th>
                </tr>
              </thead>
              <tbody>
                {retired.map((s) => {
                  const stats = perShoe.get(s.id);
                  const avgSpeed = stats && stats.timeSum > 0 ? stats.distSum / stats.timeSum : 0;
                  return (
                    <tr key={s.id}>
                      <td style={{ width: 24 }}>
                        <div style={{ width: 8, height: 24, background: s.color, borderRadius: 2 }} />
                      </td>
                      <td>{s.name}</td>
                      <td className="muted">{s.brand_name}</td>
                      <td className="muted">{s.purpose}</td>
                      <td className="num">{Math.round(metersToMiles(s.distance_m))}</td>
                      <td className="num muted">{stats?.lastRun ?? "—"}</td>
                      <td className="num">{avgSpeed > 0 ? speedToPacePerMile(avgSpeed) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
