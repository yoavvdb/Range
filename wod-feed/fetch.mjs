// Reads the gym's public workout feed (the same one its website embed uses: no login, no key, no secrets)
// and writes it as site/wod.json, which the app loads next to itself. The programme is already public,
// so the file is plain JSON. Usage: node wod-feed/fetch.mjs [out-file]
import fs from "node:fs";

const AFF = process.env.WOD_AFFILIATE || "h23IStOrLE";
const OUT = process.argv[2] || "site/wod.json";
const BACK = 3, AHEAD = 7;
const URL = (d) => `https://app.sugarwod.com/public/api/v1/affiliates/${AFF}/workouts/${d.replace(/-/g, "")}`;

const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" });
const today = dayFmt.format(new Date());
const addDays = (iso, n) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

async function getDay(d) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(URL(d), { headers: { accept: "application/json" } });
      if (r.ok) { const j = await r.json(); if (j && j.success && Array.isArray(j.data)) return j.data; }
    } catch (e) { /* retry */ }
    await new Promise((r) => setTimeout(r, 800 * (i + 1)));
  }
  return null;
}

const days = {};
let ok = 0;
for (let n = -BACK; n <= AHEAD; n++) {
  const d = addDays(today, n), list = await getDay(d);
  if (!list) continue;
  ok++;
  days[d] = list.map((w) => ({
    title: String(w.title || "").trim(),
    text: String(w.description || "").trim(),
    track: String(w.track || "").trim(),
    order: w.whiteboardDisplayOrder || 0,
    movements: (w.movements || []).map((m) => (typeof m === "string" ? m : m && m.name)).filter(Boolean),
  })).filter((w) => w.title || w.text);
}
if (!ok) { console.error("The public feed did not answer; keeping the previous file."); process.exit(1); }
fs.mkdirSync(OUT.replace(/[^/]*$/, "") || ".", { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ format: "range-wod/1", fetchedAt: new Date().toISOString(), days }));
console.log(`wod.json: ${ok} days, ${Object.values(days).reduce((t, x) => t + x.length, 0)} items`);
