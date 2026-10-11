#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { merge, query, todayIso, addDays, toRangeFile, formatWorkout, HOME, DB_FILE } from "./store.js";
import { sugarwodCsvToWorkouts } from "./csv.js";

const [cmd, ...rest] = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = rest.indexOf(`--${name}`);
  if (i < 0) return dflt;
  const v = rest[i + 1];
  return v === undefined || v.startsWith("--") ? true : v;
};
const VALUE_FLAGS = new Set(["--back", "--ahead", "--debug", "--out"]);
const positional = rest.filter((a, i) => !a.startsWith("--") && !VALUE_FLAGS.has(rest[i - 1]));

const HELP = `sugarwod-sync — your SugarWOD training, for Range and for Claude

  login                      Open SugarWOD in a browser window and log in (once)
  sync [--back 3] [--ahead 7] [--headed] [--debug DIR]
                             Read your gym's whiteboard for those days into the local cache
  watch [--debug DIR]        Click through the whiteboard yourself; every workout it loads is saved
  import-csv FILE            Import workouts.csv from SugarWOD's "Export Workouts" (your logged history)
  export [FILE] [--back 30] [--ahead 14]
                             Write range-training.json for Range's Training → Import
  list [--back 7] [--ahead 7]
                             Print cached workouts
  mcp                        Run as an MCP server over stdio (for Claude)
  ci-sync [--out FILE] [--back 7] [--ahead 7]
                             Unattended: log in with SUGARWOD_EMAIL / SUGARWOD_PASSWORD, read the whiteboard,
                             write an encrypted file (RANGE_SYNC_KEY) for the Range app

Cache: ${DB_FILE}`;

async function main() {
  switch (cmd) {
    case "login": {
      const { login } = await import("./whiteboard.js");
      const ok = await login();
      console.log(ok ? "Logged in. Your session is saved; run `sugarwod-sync sync` next." : "Still on the login page. Run `sugarwod-sync login` again.");
      break;
    }
    case "sync": {
      const { syncWhiteboard } = await import("./whiteboard.js");
      const r = await syncWhiteboard({
        back: +flag("back", 3), ahead: +flag("ahead", 7),
        headless: !flag("headed", false), debugDir: flag("debug", undefined),
      });
      const m = merge(r.workouts, { source: "sugarwod-whiteboard" });
      console.log(`Found ${r.workouts.length} workouts (${m.added} new, ${m.updated} updated).`);
      if (r.missingDays.length) console.log(`Nothing found for ${r.missingDays.join(", ")}. Rest days, not published yet, or run \`sugarwod-sync watch\` to capture them by clicking.`);
      break;
    }
    case "watch": {
      const { watch } = await import("./whiteboard.js");
      const ws = await watch({ debugDir: flag("debug", undefined) });
      const m = merge(ws, { source: "sugarwod-whiteboard" });
      console.log(`Captured ${ws.length} workouts (${m.added} new).`);
      break;
    }
    case "import-csv": {
      const file = positional[0];
      if (!file) throw new Error("Usage: sugarwod-sync import-csv path/to/workouts.csv");
      const ws = sugarwodCsvToWorkouts(fs.readFileSync(file, "utf8"));
      const m = merge(ws, { source: "sugarwod-csv" });
      console.log(`Imported ${ws.length} logged workouts (${m.added} new). Cache holds ${m.total}.`);
      break;
    }
    case "export": {
      const t = todayIso();
      const ws = query({ from: addDays(t, -flag("back", 30)), to: addDays(t, +flag("ahead", 14)) });
      const out = positional[0] || path.join(HOME, "range-training.json");
      fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
      fs.writeFileSync(out, JSON.stringify(toRangeFile(ws), null, 2));
      console.log(`Wrote ${ws.length} workouts to ${out}\nIn Range: Training → Import → choose this file.`);
      break;
    }
    case "list": {
      const t = todayIso();
      const ws = query({ from: addDays(t, -flag("back", 7)), to: addDays(t, +flag("ahead", 7)) });
      console.log(ws.length ? ws.map(formatWorkout).join("\n\n") : "No cached workouts in that range.");
      break;
    }
    case "ci-sync": {
      // Used by the scheduled GitHub workflow: log in, read the whiteboard, merge with the previous file, encrypt.
      const { loginWithPassword, syncWhiteboard } = await import("./whiteboard.js");
      const { seal, unseal } = await import("./seal.js");
      const { SUGARWOD_EMAIL: email, SUGARWOD_PASSWORD: pass, RANGE_SYNC_KEY: key } = process.env;
      if (!email || !pass || !key) throw new Error("Set SUGARWOD_EMAIL, SUGARWOD_PASSWORD and RANGE_SYNC_KEY.");
      const out = flag("out", "sugarwod.json.enc");
      let previous = [];
      try { previous = (await unseal(JSON.parse(fs.readFileSync(out, "utf8")), key)).workouts || []; } catch { /* first run or new key */ }
      await loginWithPassword(email, pass);
      const r = await syncWhiteboard({ back: +flag("back", 7), ahead: +flag("ahead", 7), delayMs: 1500 });
      const keyOf = (w) => `${w.date}|${(w.title || "").toLowerCase()}|${(w.text || "").slice(0, 60).toLowerCase()}`;
      const map = new Map(previous.map((w) => [keyOf(w), w]));
      r.workouts.forEach((w) => map.set(keyOf(w), w));
      const cutoff = addDays(todayIso(), -60);
      const workouts = [...map.values()].filter((w) => w.date >= cutoff).sort((a, b) => a.date.localeCompare(b.date));
      fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
      fs.writeFileSync(out, JSON.stringify(await seal({ ...toRangeFile(workouts), syncedAt: new Date().toISOString() }, key)));
      // Only counts go to the log (workflow logs can be public); never workout text or credentials.
      console.log(`Synced: ${r.workouts.length} workouts read, ${workouts.length} in the file. Days with nothing found: ${r.missingDays.length}.`);
      if (!r.workouts.length) console.log("Nothing was read from the whiteboard. If this keeps happening, the reader needs adjusting to SugarWOD's pages.");
      break;
    }
    case "mcp": {
      const { startMcp } = await import("./mcp.js");
      await startMcp();
      break;
    }
    default:
      console.log(HELP);
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
