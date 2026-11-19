// 1.4.88 LIVE MATCHES feed job: ONE call to the cricket API for everyone (the free CricAPI key allows ~100 calls a day, and it must
// never be inside the game). Run it on a schedule (GitHub Actions: tools/live/live-fixtures.yml); it writes fixtures.json, which the
// game reads (VITE_LIVE_FEED_URL at build time). Only the matches between the game's sides are kept, with the game's own team names.
//   CRICAPI_KEY=xxxx node tools/live/fetch-fixtures.mjs [out.json]
import { writeFileSync } from "node:fs";
// Three providers: ESPN (default, no key), cricketliveapi.com (CRICKETLIVE_API_KEY, a Bearer token: /api/v1/cricket/matches/upcoming + /live + /recent) or
// CricAPI (CRICAPI_KEY: api.cricapi.com/v1/matches). The first key that is set is used.
// With neither key: ESPN's public cricket feed (no key, no sign-up: the one ESPN's own pages read; undocumented, so it may change).
const liveKey = process.env.CRICKETLIVE_API_KEY, key = process.env.CRICAPI_KEY, espn = !liveKey && !key;
const out = process.argv[2] ?? "fixtures.json", DAY = 86_400_000, now = Date.now();
const NATIONS = ["India", "Australia", "England", "South Africa", "New Zealand", "Pakistan", "Sri Lanka", "West Indies", "Bangladesh", "Afghanistan", "Ireland", "Netherlands", "Scotland", "Namibia", "USA", "Nepal", "Oman", "Canada", "Uganda", "Papua New Guinea"];
const ALIAS = { "United States of America": "USA", "United States": "USA", "Mumbai Indians": "Mumbai Indianz", "Chennai Super Kings": "Chennai Super Kingz", "Royal Challengers Bengaluru": "Royal Challengers Bengaluroo", "Royal Challengers Bangalore": "Royal Challengers Bengaluroo", "Kolkata Knight Riders": "Kolkata Knight Riderz", "Delhi Capitals": "Delhi Capitalz", "Punjab Kings": "Punjab Kingz", "Rajasthan Royals": "Rajasthan Royalz", "Sunrisers Hyderabad": "Sunrisers Hyderabaad", "Lucknow Super Giants": "Lucknow Super Giantz", "Gujarat Titans": "Gujarat Titanz", PNG: "Papua New Guinea" };
const SIDES = new Set([...NATIONS, ...Object.values(ALIAS)]);
const side = (n) => { if (!n || /women|\bu-?19\b|\bu-?23\b| a$|\bxi\b|emerging/i.test(n)) return null; const m = ALIAS[n.trim()] ?? n.trim(); return SIDES.has(m) ? m : null; };
const list = [];
const fmtOf = (x) => { const f = String(x ?? "").toLowerCase(); return /t20/.test(f) ? "t20" : /odi|one.?day|50/.test(f) ? "odi" : /test/.test(f) ? "test" : null; };
// cricketliveapi.com's start time field is not in its public docs: the usual names are tried (seconds or ms or an ISO date)
const startOf = (m) => { for (const k of ["start_time", "startTime", "start_date", "startDate", "match_start", "match_date", "matchDate", "date_time", "dateTimeGMT", "start", "date", "timestamp", "start_timestamp"]) { const v = m[k]; if (v === undefined || v === null || v === "") continue;
    const n = Number(v); if (Number.isFinite(n) && n > 1e9) return n < 1e12 ? n * 1000 : n; const t = Date.parse(/Z|[+-]\d\d:?\d\d$/.test(String(v)) || !/T|\d:\d/.test(String(v)) ? String(v) : `${v}Z`); if (Number.isFinite(t)) return t; } return NaN; };
const ymd = (t) => new Date(t).toISOString().slice(0, 10).replace(/-/g, "");
if (espn) {
  // each date from a week ago to 30 days on: that day's matches (ESPN answers a date with the matches around it); kept: Tests, ODIs,
  // T20Is between the game's nations, and T20s between IPL franchises
  const seen = new Set();
  for (let d = -7; d <= 30; d++) {
    let j; try { const r = await fetch(`https://site.api.espn.com/apis/site/v2/sports/cricket/scorepanel?dates=${ymd(now + d * DAY)}`); if (!r.ok) { console.error(`ESPN ${d}: HTTP ${r.status}`); continue; } j = await r.json(); } catch (e) { console.error(`ESPN ${d}:`, e.message); continue; }
    for (const sc of j.scores ?? []) for (const e of sc.events ?? []) { const c = e.competitions?.[0]; if (!c || seen.has(e.id)) continue; seen.add(e.id);
      const cls = String(c.class?.generalClassCard ?? ""), [ta, tb] = (c.competitors ?? []).map((x) => x.team?.displayName ?? x.team?.name), a = side(ta), b = side(tb);
      if (/women/i.test(cls) || !a || !b) continue; const ipl = !NATIONS.includes(a) && !NATIONS.includes(b);
      const fmt = cls === "Test" ? "test" : cls === "ODI" ? "odi" : cls === "T20I" ? "t20" : ipl && /twenty20|t20/i.test(cls) ? "t20" : null; if (!fmt || (ipl ? NATIONS.includes(a) || NATIONS.includes(b) : !NATIONS.includes(a) || !NATIONS.includes(b))) continue;
      const start = Date.parse(e.date); if (!Number.isFinite(start) || start < now - 8 * DAY || start > now + 30 * DAY) continue;
      const lg = sc.leagues?.find((l) => l.id === String(e.leagueId)) ?? sc.leagues?.[0], desc = c.description ?? e.description ?? "";
      list.push({ id: `espn-${e.id}`, name: `${a} vs ${b}${desc ? `, ${desc}` : ""}`, series: [lg?.name, desc].filter(Boolean).join(" · ") || cls, fmt, a, b, start, venue: c.venue?.fullName, status: e.status?.type?.description }); }
  }
} else if (liveKey) {
  let shown = false;
  for (const kind of ["live", "upcoming", "recent"]) {
    const r = await fetch(`https://cricketliveapi.com/api/v1/cricket/matches/${kind}`, { headers: { Authorization: `Bearer ${liveKey}`, Accept: "application/json" } });
    if (!r.ok) { console.error(`feed ${kind}: HTTP ${r.status}`); if (r.status === 401) process.exit(1); continue; }
    const j = await r.json(); const data = Array.isArray(j) ? j : j.data ?? j.matches ?? [];
    if (!shown && data[0]) { shown = true; console.log(`(${kind}) first match's fields: ${Object.keys(data[0]).join(", ")}`); }
    for (const m of data) { const fmt = fmtOf(m.format ?? m.match_format ?? m.matchType), a = side(m.first_team?.name ?? m.team1?.name ?? m.teams?.[0]), b = side(m.second_team?.name ?? m.team2?.name ?? m.teams?.[1]), start = startOf(m);
      if (!fmt || !a || !b) continue; if (!Number.isFinite(start)) { console.log(`  no start time found for ${a} v ${b} (${m.match_desc ?? ""})`); continue; }
      if (start < now - 8 * DAY || start > now + 30 * DAY) continue;
      const id = String(m.match_id ?? m.id); if (list.some((x) => x.id === id)) continue;
      list.push({ id, name: `${a} vs ${b}${m.match_desc ? `, ${m.match_desc}` : ""}`, series: [m.series_name, m.match_desc].filter(Boolean).join(" · ") || fmt.toUpperCase(), fmt, a, b, start, venue: m.venue, status: m.status }); }
  }
} else for (const off of [0, 25, 50, 75]) {
  const r = await fetch(`https://api.cricapi.com/v1/matches?apikey=${encodeURIComponent(key)}&offset=${off}`), j = await r.json();
  if (j.status !== "success") { console.error("feed:", j.reason ?? j.status); process.exit(1); }
  for (const m of j.data ?? []) { const fmt = ["t20", "odi", "test"].includes(m.matchType) ? m.matchType : null, [ta, tb] = m.teams ?? [], a = side(ta), b = side(tb);
    const start = Date.parse(m.dateTimeGMT ? `${m.dateTimeGMT}Z` : m.date ?? ""); if (!fmt || !a || !b || !Number.isFinite(start) || start < now - 8 * DAY || start > now + 30 * DAY) continue;
    const name = m.name ?? `${a} vs ${b}`; list.push({ id: m.id, name, series: name.split(",").slice(1).join(",").trim() || fmt.toUpperCase(), fmt, a, b, start, venue: m.venue, status: m.status }); }
  if ((j.data ?? []).length < 25) break;
}
// the owner's own fixture list (curated.json next to this script, his schema: international_matches[]) fills the gaps and looks
// further ahead (4 months); the same match from the feed wins (same two sides, starting within a day and a half)
import { existsSync, readFileSync } from "node:fs";
const curPath = new URL("curated.json", import.meta.url).pathname;
if (existsSync(curPath)) { let added = 0; const cur = JSON.parse(readFileSync(curPath, "utf8"));
  for (const m of cur.international_matches ?? []) { const fmt = fmtOf(m.format), a = side(m.home_team), b = side(m.away_team), start = Date.parse(m.start_time_utc ?? `${m.start_date}T00:00:00Z`);
    if (!fmt || !a || !b || !Number.isFinite(start) || start < now - 8 * DAY || start > now + 120 * DAY) continue;
    if (list.some((x) => ((x.a === a && x.b === b) || (x.a === b && x.b === a)) && Math.abs(x.start - start) < 1.5 * DAY)) continue;
    const match = String(m.match ?? "").replace(/\s*\(ongoing\)/i, "");
    list.push({ id: `cur-${a}-${b}-${(m.start_date ?? "").replace(/-/g, "")}`.replace(/\s+/g, ""), name: `${a} vs ${b}${match ? `, ${match}` : ""}`, series: [m.series, match].filter(Boolean).join(" · "), fmt, a, b, start, venue: [m.venue, m.city].filter(Boolean).join(", ") }); added++; }
  console.log(`curated.json: ${added} more matches`); }
list.sort((x, y) => x.start - y.start);
writeFileSync(out, JSON.stringify({ at: now, list }, null, 1)); console.log(`${list.length} matches → ${out}`);
