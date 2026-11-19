// 1.4.88 LIVE MATCHES feed job: ONE call to the cricket API for everyone (the free CricAPI key allows ~100 calls a day, and it must
// never be inside the game). Run it on a schedule (GitHub Actions: tools/live/live-fixtures.yml); it writes fixtures.json, which the
// game reads (VITE_LIVE_FEED_URL at build time). Only the matches between the game's sides are kept, with the game's own team names.
//   CRICAPI_KEY=xxxx node tools/live/fetch-fixtures.mjs [out.json]
import { writeFileSync } from "node:fs";
const key = process.env.CRICAPI_KEY; if (!key) { console.error("CRICAPI_KEY is not set"); process.exit(1); }
const out = process.argv[2] ?? "fixtures.json", DAY = 86_400_000, now = Date.now();
const NATIONS = ["India", "Australia", "England", "South Africa", "New Zealand", "Pakistan", "Sri Lanka", "West Indies", "Bangladesh", "Afghanistan", "Ireland", "Netherlands", "Scotland", "Namibia", "USA", "Nepal", "Oman", "Canada", "Uganda", "Papua New Guinea"];
const ALIAS = { "United States of America": "USA", "United States": "USA", "Mumbai Indians": "Mumbai Indianz", "Chennai Super Kings": "Chennai Super Kingz", "Royal Challengers Bengaluru": "Royal Challengers Bengaluroo", "Royal Challengers Bangalore": "Royal Challengers Bengaluroo", "Kolkata Knight Riders": "Kolkata Knight Riderz", "Delhi Capitals": "Delhi Capitalz", "Punjab Kings": "Punjab Kingz", "Rajasthan Royals": "Rajasthan Royalz", "Sunrisers Hyderabad": "Sunrisers Hyderabaad", "Lucknow Super Giants": "Lucknow Super Giantz", "Gujarat Titans": "Gujarat Titanz", PNG: "Papua New Guinea" };
const SIDES = new Set([...NATIONS, ...Object.values(ALIAS)]);
const side = (n) => { if (!n || /women|\bu-?19\b|\bu-?23\b| a$|\bxi\b|emerging/i.test(n)) return null; const m = ALIAS[n.trim()] ?? n.trim(); return SIDES.has(m) ? m : null; };
const list = [];
for (const off of [0, 25, 50, 75]) {
  const r = await fetch(`https://api.cricapi.com/v1/matches?apikey=${encodeURIComponent(key)}&offset=${off}`), j = await r.json();
  if (j.status !== "success") { console.error("feed:", j.reason ?? j.status); process.exit(1); }
  for (const m of j.data ?? []) { const fmt = ["t20", "odi", "test"].includes(m.matchType) ? m.matchType : null, [ta, tb] = m.teams ?? [], a = side(ta), b = side(tb);
    const start = Date.parse(m.dateTimeGMT ? `${m.dateTimeGMT}Z` : m.date ?? ""); if (!fmt || !a || !b || !Number.isFinite(start) || start < now - 8 * DAY || start > now + 30 * DAY) continue;
    const name = m.name ?? `${a} vs ${b}`; list.push({ id: m.id, name, series: name.split(",").slice(1).join(",").trim() || fmt.toUpperCase(), fmt, a, b, start, venue: m.venue, status: m.status }); }
  if ((j.data ?? []).length < 25) break;
}
list.sort((x, y) => x.start - y.start);
writeFileSync(out, JSON.stringify({ at: now, list }, null, 1)); console.log(`${list.length} matches → ${out}`);
