// MCP server (stdio) so Claude can read your SugarWOD training and plan mobility around it.
import fs from "node:fs";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { query, merge, load, todayIso, addDays, toRangeFile, formatWorkout, HOME } from "./store.js";
import { sugarwodCsvToWorkouts } from "./csv.js";
import { syncWhiteboard } from "./whiteboard.js";

const text = (t) => ({ content: [{ type: "text", text: t }] });
const list = (ws, empty) => (ws.length ? ws.map(formatWorkout).join("\n\n---\n\n") : empty);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export async function startMcp() {
  const server = new McpServer({ name: "sugarwod", version: "0.1.0" });

  server.registerTool(
    "sugarwod_upcoming",
    {
      title: "Upcoming SugarWOD workouts",
      description: "Workouts on your gym's whiteboard from today through the next N days, from the local cache. Run sugarwod_sync first if it's empty or stale.",
      inputSchema: { days: z.number().int().min(0).max(30).default(7) },
    },
    async ({ days }) => {
      const t = todayIso();
      const ws = query({ from: t, to: addDays(t, days) });
      const age = load().updatedAt;
      return text(list(ws, `No upcoming workouts cached for the next ${days} days. Run sugarwod_sync.`) + `\n\n(Cache updated: ${age || "never"})`);
    },
  );

  server.registerTool(
    "sugarwod_history",
    {
      title: "Recent SugarWOD training",
      description: "Workouts from the last N days (whiteboard plus your logged results from the SugarWOD CSV export).",
      inputSchema: { days: z.number().int().min(1).max(365).default(14) },
    },
    async ({ days }) => {
      const t = todayIso();
      const ws = query({ from: addDays(t, -days), to: addDays(t, -1) }).reverse();
      return text(list(ws, `No workouts in the last ${days} days. Import your SugarWOD CSV export or run sugarwod_sync with days_back.`));
    },
  );

  server.registerTool(
    "sugarwod_workouts",
    {
      title: "SugarWOD workouts in a date range",
      description: "All cached workouts between two dates (inclusive).",
      inputSchema: { from: isoDate, to: isoDate },
    },
    async ({ from, to }) => text(list(query({ from, to }), `No workouts between ${from} and ${to}.`)),
  );

  server.registerTool(
    "sugarwod_sync",
    {
      title: "Refresh from the SugarWOD whiteboard",
      description: "Opens app.sugarwod.com in a headless browser using the session from `sugarwod-sync login` and caches the whiteboard for the given days. Takes about 3 seconds per day.",
      inputSchema: {
        days_back: z.number().int().min(0).max(14).default(3),
        days_ahead: z.number().int().min(0).max(14).default(7),
      },
    },
    async ({ days_back, days_ahead }) => {
      const r = await syncWhiteboard({ back: days_back, ahead: days_ahead });
      const m = merge(r.workouts, { source: "sugarwod-whiteboard" });
      const miss = r.missingDays.length ? `\nNo workouts found for: ${r.missingDays.join(", ")} (rest days, or not published yet).` : "";
      return text(`Synced ${r.workouts.length} workouts (${m.added} new, ${m.updated} updated).${miss}`);
    },
  );

  server.registerTool(
    "sugarwod_import_csv",
    {
      title: "Import SugarWOD history export",
      description: "Imports workouts.csv from SugarWOD's 'Export Workouts' (Profile page on app.sugarwod.com, sent by email).",
      inputSchema: { path: z.string().describe("Absolute path to workouts.csv") },
    },
    async ({ path: p }) => {
      const ws = sugarwodCsvToWorkouts(fs.readFileSync(p, "utf8"));
      const m = merge(ws, { source: "sugarwod-csv" });
      return text(`Imported ${ws.length} logged workouts (${m.added} new). Cache now holds ${m.total}.`);
    },
  );

  server.registerTool(
    "sugarwod_export_for_range",
    {
      title: "Export for the Range app",
      description: "Writes a range-training.json file that Range's Training → Import button reads.",
      inputSchema: {
        days_back: z.number().int().min(0).max(365).default(30),
        days_ahead: z.number().int().min(0).max(30).default(14),
        path: z.string().optional().describe("Where to write the file. Defaults to ~/.sugarwod-sync/range-training.json"),
      },
    },
    async ({ days_back, days_ahead, path: p }) => {
      const t = todayIso();
      const ws = query({ from: addDays(t, -days_back), to: addDays(t, days_ahead) });
      const out = p || path.join(HOME, "range-training.json");
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, JSON.stringify(toRangeFile(ws), null, 2));
      return text(`Wrote ${ws.length} workouts to ${out}. In Range, open Training → Import and choose this file.`);
    },
  );

  await server.connect(new StdioServerTransport());
}
