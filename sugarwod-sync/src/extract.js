// Finds workouts inside whatever JSON the SugarWOD web app loads, without depending on exact endpoints.
// A workout is any object with a description-like field and a scheduled date, matching the shape
// documented for the SugarWOD API (title, description, scheduled_date_int / scheduled_at, track).

const TITLE_KEYS = ["title", "name", "workout_title", "workoutTitle"];
const DESC_KEYS = ["description", "workout_description", "workoutDescription", "details"];
const DATE_KEYS = [
  "scheduled_date_int", "scheduledDateInt", "scheduled_date", "scheduledDate",
  "scheduled_at", "scheduledAt", "workout_date", "workoutDate", "date",
];

const pad = (n) => String(n).padStart(2, "0");

export function toIsoDate(v) {
  if (v == null) return null;
  if (typeof v === "object" && typeof v.iso === "string") v = v.iso; // Parse-style {__type:"Date", iso}
  if (typeof v === "number") {
    if (v > 19000000 && v < 30000000) {
      const s = String(v);
      return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
    }
    const ms = v > 1e11 ? v : v > 1e9 ? v * 1000 : null;
    if (!ms) return null;
    const d = new Date(ms); // scheduled_at is midnight UTC, so read the UTC date
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  if (typeof v === "string") {
    if (/^\d{8}$/.test(v)) return `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  }
  return null;
}

export function stripHtml(s) {
  return String(s)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h\d)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const pick = (o, keys) => {
  for (const k of keys) if (typeof o[k] === "string" && o[k].trim()) return o[k];
  return null;
};

export function sniffWorkouts(json) {
  const out = [];
  const seen = new Set();
  const walk = (node, depth) => {
    if (depth > 14 || node == null || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach((n) => walk(n, depth + 1)); return; }
    const desc = pick(node, DESC_KEYS);
    const date = DATE_KEYS.map((k) => toIsoDate(node[k])).find(Boolean);
    if (desc && desc.trim().length > 3 && date) {
      const title = (pick(node, TITLE_KEYS) || "").trim();
      const text = stripHtml(desc);
      const k = `${date}|${title}|${text.slice(0, 60)}`;
      if (!seen.has(k)) {
        seen.add(k);
        const w = { date, title, text, source: "sugarwod-whiteboard" };
        const track = node.track && typeof node.track === "object" ? node.track.name || node.track.title : node.track_name;
        if (typeof track === "string" && track) w.track = track;
        if (typeof node.score_type === "string") w.scoreType = node.score_type;
        out.push(w);
      }
    }
    for (const v of Object.values(node)) if (v && typeof v === "object") walk(v, depth + 1);
  };
  walk(json, 0);
  return out;
}
