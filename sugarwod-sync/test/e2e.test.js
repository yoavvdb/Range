// End-to-end against a fake SugarWOD site: login gate, date-addressed whiteboard loading JSON over XHR,
// then the MCP server driven by a real MCP client. Needs a Chromium; set SUGARWOD_CHROMIUM_PATH if
// Playwright's own browser isn't installed.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const home = fs.mkdtempSync(path.join(os.tmpdir(), "swsync-"));
process.env.SUGARWOD_SYNC_HOME = home;

const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };
const WODS = { [day(-1)]: "Fran\n21-15-9 Thrusters, Pull-ups", [day(1)]: "Snatch complex\nPower snatch + OHS", [day(2)]: "Engine\n40 DUs, 15 cal row" };

let server, base, loggedIn = false;
before(async () => {
  server = http.createServer((req, res) => {
    const u = new URL(req.url, "http://x");
    if (u.pathname === "/login") {
      loggedIn = true; // pretend the user logged in
      res.setHeader("set-cookie", "sess=1; Path=/");
      return res.end("<html><body>Logged in</body></html>");
    }
    if (!req.headers.cookie?.includes("sess=1")) { res.writeHead(302, { location: "/login" }); return res.end(); }
    if (u.pathname === "/whiteboard") {
      return res.end(`<html><body><main id="m">loading</main><script>
        fetch('/api/v2/workouts?dates=' + new URLSearchParams(location.search).get('date'))
          .then(r => r.json()).then(j => { document.getElementById('m').textContent = JSON.stringify(j) });
      </script></body></html>`);
    }
    if (u.pathname === "/api/v2/workouts") {
      const d = u.searchParams.get("dates");
      const data = WODS[d] ? [{ id: d, attributes: { title: WODS[d].split("\n")[0], description: WODS[d].split("\n")[1], scheduled_date_int: +d } }] : [];
      res.setHeader("content-type", "application/json");
      return res.end(JSON.stringify({ data }));
    }
    res.writeHead(404); res.end();
  });
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
  process.env.SUGARWOD_BASE = base;
});
after(() => { server.close(); fs.rmSync(home, { recursive: true, force: true }); });

test("sync reports a missing login", async () => {
  const { syncWhiteboard } = await import("../src/whiteboard.js");
  await assert.rejects(syncWhiteboard({ back: 0, ahead: 0, delayMs: 0 }), /not logged in/);
});

test("sync reads the whiteboard once logged in, and MCP serves it", async () => {
  // simulate `sugarwod-sync login` by visiting /login in the saved profile
  const { chromium } = await import("playwright");
  const { PROFILE_DIR, merge } = await import("../src/store.js");
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { headless: true, ...(process.env.SUGARWOD_CHROMIUM_PATH ? { executablePath: process.env.SUGARWOD_CHROMIUM_PATH } : {}) });
  const p = await ctx.newPage(); await p.goto(`${base}/login`);
  fs.writeFileSync(path.join(home, "session.json"), JSON.stringify({ cookies: (await ctx.storageState()).cookies }));
  await ctx.close();

  const { syncWhiteboard } = await import("../src/whiteboard.js");
  const r = await syncWhiteboard({ back: 1, ahead: 2, delayMs: 0 });
  assert.deepEqual(r.workouts.map((w) => w.title).sort(), ["Engine", "Fran", "Snatch complex"]);
  assert.equal(r.missingDays.length, 1); // today is a rest day in the fake gym
  merge(r.workouts, { source: "sugarwod-whiteboard" });

  const client = new Client({ name: "test", version: "0" });
  await client.connect(new StdioClientTransport({
    command: process.execPath, args: [path.resolve("src/cli.js"), "mcp"],
    env: { ...process.env, SUGARWOD_SYNC_HOME: home },
  }));
  const tools = (await client.listTools()).tools.map((t) => t.name).sort();
  assert.deepEqual(tools, ["sugarwod_export_for_range", "sugarwod_history", "sugarwod_import_csv", "sugarwod_sync", "sugarwod_upcoming", "sugarwod_workouts"]);
  const up = await client.callTool({ name: "sugarwod_upcoming", arguments: { days: 7 } });
  assert.match(up.content[0].text, /Snatch complex/);
  assert.match(up.content[0].text, /Engine/);
  assert.doesNotMatch(up.content[0].text, /Fran/);
  const hist = await client.callTool({ name: "sugarwod_history", arguments: { days: 7 } });
  assert.match(hist.content[0].text, /Fran/);
  const out = path.join(home, "range.json");
  await client.callTool({ name: "sugarwod_export_for_range", arguments: { path: out } });
  const file = JSON.parse(fs.readFileSync(out, "utf8"));
  assert.equal(file.format, "range-training/1");
  assert.equal(file.workouts.length, 3);
  await client.close();
});
