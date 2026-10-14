// SugarWOD for a whole gym, through SugarWOD's official API (v2, beta): the gym owner creates an API key
// in SugarWOD (Gym settings → Developer keys). Gives the gym's programming; scores aren't in the API yet.
// Docs: https://app.sugarwod.com/developers-api-docs
const API = () => process.env.SUGARWOD_API_BASE || "https://api.sugarwod.com/v2";
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
const iso = (n) => { const s = String(n); return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`; };
const clean = (s) => String(s || "").replace(/\r/g, "").replace(/<[^>]+>/g, "").replace(/\n{3,}/g, "\n\n").trim();

async function get(path, key) {
  const r = await fetch(API() + path, { headers: { Authorization: key, Accept: "application/json" } });
  if (r.status === 401 || r.status === 403) { const e = new Error("SugarWOD didn't accept the API key. Check it in SugarWOD → Gym settings → Developer keys."); e.auth = true; throw e; }
  if (!r.ok) throw new Error(`SugarWOD API ${r.status} on ${path.split("?")[0]}`);
  return r.json();
}

export default {
  id: "sugarwod-gym",
  name: "SugarWOD (gym API key)",
  kind: "apikey",
  available: true,
  blurb: "For gym owners and coaches: your box's programming through SugarWOD's official API.",
  fields: [
    { key: "apiKey", label: "SugarWOD API key", type: "password", required: true },
    { key: "track", label: "Track name (optional)", type: "text", required: false, option: true },
  ],
  consent: "Range stores the API key encrypted and only reads your gym's workout calendar with it.",

  async sync({ secret, options }) {
    const tracks = (await get("/tracks", secret.apiKey)).data || [];
    const want = options?.track ? tracks.find((t) => (t.attributes?.name || "").toLowerCase() === options.track.toLowerCase()) : null;
    if (options?.track && !want) throw new Error(`No track called "${options.track}". Tracks: ${tracks.map((t) => t.attributes?.name).join(", ")}`);
    const days = new Map();
    const start = new Date(); start.setDate(start.getDate() - 14);
    for (let i = 0; i < 3; i++) { // three 7-day windows (the API's limit per request)
      const a = new Date(start); a.setDate(a.getDate() + 7 * i);
      const b = new Date(a); b.setDate(b.getDate() + 6);
      const q = `/workouts?dates=${ymd(a)}-${ymd(b)}${want ? `&track_id=${want.id}` : ""}&page[limit]=100`;
      for (const w of (await get(q, secret.apiKey)).data || []) {
        const at = w.attributes || {};
        const d = iso(at.scheduled_date_int);
        if (!days.has(d)) days.set(d, []);
        days.get(d).push({ title: clean(at.title), text: clean(at.description) });
      }
    }
    const workouts = [...days.entries()].sort().map(([date, ps]) => ({
      date, title: ps.map((p) => p.title).filter(Boolean).slice(0, 3).join(" · ").slice(0, 80) || "Workout",
      text: ps.map((p) => [p.title, p.text].filter(Boolean).join("\n")).join("\n\n"), source: "sugarwod-api",
    }));
    return { workouts, state: null, info: { tracks: tracks.map((t) => t.attributes?.name), track: want?.attributes?.name || "all" } };
  },
};
