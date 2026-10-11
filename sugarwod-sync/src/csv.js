// Reads the official SugarWOD export (Profile → "Export Workouts" on app.sugarwod.com, emailed as workouts.csv).
// Columns: date, title, description, best_result_raw, best_result_display, score_type,
//          barbell_lift, set_details, notes, rx_or_scaled, pr
import { isoDate } from "./store.js";

export function parseCsv(text) {
  const s = String(text).replace(/^﻿/, "");
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const pad = (n) => String(n).padStart(2, "0");
const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

export function normDate(raw) {
  const s = String(raw || "").trim();
  let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return ymd(m[1], +m[2], +m[3]);
  if ((m = s.match(/^(\d{4})(\d{2})(\d{2})$/))) return ymd(m[1], +m[2], +m[3]);
  if ((m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/))) {
    let [a, b, y] = [+m[1], +m[2], +m[3]];
    if (y < 100) y += 2000;
    // SugarWOD is US-based: month first, unless the first number can't be a month
    const [mo, d] = a > 12 ? [b, a] : [a, b];
    return ymd(y, mo, d);
  }
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : isoDate(new Date(t));
}

export function sugarwodCsvToWorkouts(text) {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  const head = rows[0].map((h) => h.trim().toLowerCase());
  if (!head.includes("date") || !head.includes("description")) {
    throw new Error(`This doesn't look like a SugarWOD export (columns: ${head.join(", ")})`);
  }
  return rows
    .slice(1)
    .filter((r) => r.some((c) => c.trim()))
    .map((r) => {
      const g = (k) => { const i = head.indexOf(k); return i >= 0 ? (r[i] || "").trim() : ""; };
      const date = normDate(g("date"));
      if (!date) return null;
      const w = { date, title: g("title"), text: g("description"), source: "sugarwod-csv", done: true };
      const result = g("best_result_display") || g("best_result_raw");
      if (result) w.result = result;
      if (g("score_type")) w.scoreType = g("score_type");
      if (g("rx_or_scaled")) w.rx = g("rx_or_scaled");
      if (/^(true|yes|1|y)$/i.test(g("pr"))) w.pr = true;
      if (g("notes")) w.notes = g("notes");
      if (g("set_details")) w.sets = g("set_details");
      return w;
    })
    .filter(Boolean);
}
