// Reads your SugarWOD data through the same endpoints the website uses, from inside a logged-in page
// (so the session cookie and CSRF token are the site's own). Endpoints found by inspecting app.sugarwod.com:
//   GET /api/workouts?week=YYYYMMDD&track=NAME&trackId=ID   gym programming for the week starting that Sunday
//   GET /api/athletes/{id}/results                          everything you've logged (score, RX, PR, workout text)
import { todayIso, addDays } from "./store.js";

const toInt = (iso) => +iso.replace(/-/g, "");
const toIso = (n) => { const s = String(n); return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`; };
const sundayOf = (iso) => { const [y, m, d] = iso.split("-").map(Number); const x = new Date(y, m - 1, d); x.setDate(x.getDate() - x.getDay()); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
const clean = (s) => String(s || "").replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();

export async function fetchSugarwod(page, { back = 7, ahead = 7, historyDays = 60, track = process.env.SUGARWOD_TRACK } = {}) {
  await page.goto("https://app.sugarwod.com/workouts/calendar", { waitUntil: "networkidle", timeout: 45000 });
  const today = todayIso(), from = addDays(today, -Math.max(back, historyDays)), to = addDays(today, ahead);
  const weeks = []; for (let d = sundayOf(addDays(today, -back)); d <= to; d = addDays(d, 7)) weeks.push(toInt(d));
  // older weeks, only to work out which program you follow from your logged results
  const probe = []; for (let i = 1; i <= 6; i++) probe.push(toInt(sundayOf(addDays(today, -back - 7 * i))));

  const raw = await page.evaluate(async ({ weeks, probe, wanted }) => {
    const get = async (u) => { const r = await fetch(u, { headers: { "X-Requested-With": "XMLHttpRequest", Accept: "application/json" } }); if (!r.ok) throw new Error(`${r.status} on ${u.split("?")[0]}`); return r.json(); };
    const csrf = window.CSRF, me = window.CUR_ATH_ID;
    if (!me) throw new Error("Not logged in (no athlete id on the page).");
    // the program picker on the calendar lists your gym's tracks
    const tracks = [...document.querySelectorAll("select option")].map((o) => ({ name: o.textContent.trim(), id: o.value })).filter((t) => t.id && !/no-/.test(t.id));
    const results = (await get(`/api/athletes/${me}/results?_csrf=${csrf}`)).data || [];
    const byTrack = {}, matches = {}, ids = new Set(results.map((r) => r.swId));
    const week = async (t, w) => (await get(`/api/workouts?week=${w}&track=${encodeURIComponent(t.name)}&trackId=${t.id}&_csrf=${csrf}`)).data || [];
    for (const t of tracks) {
      if (wanted && t.name !== wanted) continue;
      byTrack[t.name] = [];
      for (const w of weeks) byTrack[t.name].push(...(await week(t, w)));
      matches[t.name] = byTrack[t.name].filter((x) => ids.has(x.id)).length;
    }
    // nothing logged recently: look further back to see which program your results belong to
    if (!wanted && Object.values(matches).every((m) => m === 0))
      for (const t of tracks) for (const w of probe) { matches[t.name] += (await week(t, w)).filter((x) => ids.has(x.id)).length; if (matches[t.name] > 3) break; }
    return { tracks: tracks.map((t) => t.name), results, byTrack, matches };
  }, { weeks, probe, wanted: track || "" });

  // Which program do you follow? The one your logged results come from (fallback: the first track).
  const names = Object.keys(raw.byTrack);
  const chosen = track || names.sort((a, b) => (raw.matches[b] || 0) - (raw.matches[a] || 0))[0];

  const days = new Map(); // date -> { parts: [], results: [] }
  const day = (iso) => { if (!days.has(iso)) days.set(iso, { parts: [], results: [] }); return days.get(iso); };
  (raw.byTrack[chosen] || []).forEach((w) => {
    const iso = toIso(w.scheduledDateInteger);
    if (iso >= today && iso <= to) day(iso).parts.push({ title: clean(w.title), text: clean(w.description), order: w.whiteboardDisplayOrder || 0 });
  });
  raw.results.forEach((r) => {
    const iso = toIso(r.dateInt);
    if (iso >= from && iso < today) day(iso).results.push({ title: clean(r.title), text: clean(r.description), result: `${clean(r.title) || "Result"}: ${r.result}${r.rx ? " RX" : " scaled"}${r.pr ? " · PR" : ""}`, loggedAt: r.createdAt || null });
  });

  const workouts = [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, d]) => {
    const parts = d.results.length ? d.results : d.parts.sort((a, b) => a.order - b.order);
    const filler = /^(rest day|lesson plan|warm[ -]?up|cool[ -]?down|mobility|\d{1,2}[./]\d{1,2}([./]\d{2,4})?)$/i;
    const real = parts.filter((p) => !filler.test(p.title));
    if (!real.length && parts.some((p) => /rest/i.test(p.title))) return { date, title: "Rest day", text: "", source: "sugarwod" };
    if (!real.length) return { date, title: "Rest day", text: "", source: "sugarwod" };
    return {
      date,
      title: real.map((p) => p.title).filter(Boolean).slice(0, 3).join(" · ").slice(0, 80) || "Workout",
      text: real.map((p) => [p.title, p.text].filter(Boolean).join("\n")).join("\n\n"),
      ...(d.results.length ? { result: d.results.map((r) => r.result).join("; "), done: true } : {}),
      // when you entered the scores (the latest one for that day), so late logging shows up
      ...(d.results.some((r) => r.loggedAt) ? { loggedAt: d.results.map((r) => r.loggedAt).filter(Boolean).sort().pop() } : {}),
      source: d.results.length ? "sugarwod-results" : "sugarwod-whiteboard",
    };
  });
  return { workouts, track: chosen, tracks: raw.tracks, counts: { results: raw.results.length, programmed: (raw.byTrack[chosen] || []).length } };
}
