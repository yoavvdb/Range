// Local cache of workouts at ~/.sugarwod-sync/workouts.json (override with SUGARWOD_SYNC_HOME).
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export const HOME = process.env.SUGARWOD_SYNC_HOME || path.join(os.homedir(), ".sugarwod-sync");
export const PROFILE_DIR = path.join(HOME, "browser-profile");
export const DB_FILE = path.join(HOME, "workouts.json");

export const isoDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const todayIso = () => isoDate(new Date());
export const addDays = (iso, n) => {
  const [y, m, d] = iso.split("-").map(Number);
  return isoDate(new Date(y, m - 1, d + n));
};

export function load() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  } catch {
    return { workouts: [], updatedAt: null };
  }
}

// Same day + same title + same opening text = same workout, whichever source it came from.
const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
export const keyOf = (w) => `${w.date}|${norm(w.title)}|${norm(w.text).slice(0, 60)}`;

export function merge(incoming, { source } = {}) {
  const db = load();
  const map = new Map(db.workouts.map((w) => [keyOf(w), w]));
  let added = 0;
  let updated = 0;
  for (const w of incoming) {
    const k = keyOf(w);
    if (map.has(k)) {
      Object.assign(map.get(k), w);
      updated++;
    } else {
      map.set(k, { ...w, source: w.source || source });
      added++;
    }
  }
  db.workouts = [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
  db.updatedAt = new Date().toISOString();
  fs.mkdirSync(HOME, { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  return { added, updated, total: db.workouts.length };
}

export function query({ from, to } = {}) {
  return load().workouts.filter((w) => (!from || w.date >= from) && (!to || w.date <= to));
}

// File format the Range app imports (Training → Import).
export function toRangeFile(workouts) {
  return {
    format: "range-training/1",
    exportedAt: new Date().toISOString(),
    workouts: workouts.map((w) => ({
      date: w.date,
      title: w.title || "",
      text: w.text || "",
      ...(w.result ? { result: w.result } : {}),
      source: w.source || "sugarwod",
    })),
  };
}

export function formatWorkout(w) {
  const head = `${w.date}${w.title ? ` — ${w.title}` : ""}${w.track ? ` [${w.track}]` : ""}`;
  const res = w.result ? `\nResult: ${w.result}${w.rx ? ` (${w.rx})` : ""}${w.pr ? " PR" : ""}` : "";
  return `${head}\n${(w.text || "").trim()}${res}`;
}
