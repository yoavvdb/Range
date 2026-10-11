// Scheduled-sync path against a fake SugarWOD with a real login form and JSON login API.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execFileP = promisify(execFile);

const home = fs.mkdtempSync(path.join(os.tmpdir(), "swci-"));
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };
const WODS = { [day(-1)]: ["Fran", "21-15-9 Thrusters, Pull-ups"], [day(2)]: ["Engine", "40 DUs, 15 cal row"] };
let server, base;
before(async () => {
  server = http.createServer((req, res) => {
    res.setHeader("content-type", "text/html");
    const u = new URL(req.url, "http://x");
    if (u.pathname === "/login") return res.end(`<html><body><form id="f"><input name="username"><input name="password" type="password"><button id="login-button" type="submit">Log in</button></form>
      <script>document.getElementById('f').onsubmit=e=>{e.preventDefault();fetch('/public/api/v1/login',{method:'POST',body:new URLSearchParams(new FormData(e.target))}).then(r=>{if(r.ok)location.href='/whiteboard'})}</script></body></html>`);
    if (u.pathname === "/public/api/v1/login" && req.method === "POST") {
      let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
        const p = new URLSearchParams(b);
        res.setHeader("content-type", "application/json");
        if (p.get("username") === "me@example.com" && p.get("password") === "right") { res.setHeader("set-cookie", "sess=1; Path=/"); return res.end('{"ok":true}'); }
        res.writeHead(401); res.end('{"message":"That email/password combination does not match.","code":101}');
      }); return;
    }
    if (!req.headers.cookie?.includes("sess=1")) { res.writeHead(302, { location: "/login" }); return res.end(); }
    if (u.pathname === "/whiteboard") return res.end(`<main>…</main><script>fetch('/api/w?d='+(new URLSearchParams(location.search).get('date')||''))</script>`);
    if (u.pathname === "/api/w") { const d = u.searchParams.get("d"), w = WODS[d]; res.setHeader("content-type", "application/json");
      return res.end(JSON.stringify({ data: w ? [{ title: w[0], description: w[1], scheduled_date_int: +d }] : [] })); }
    res.writeHead(404); res.end();
  });
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server.close(); fs.rmSync(home, { recursive: true, force: true }); });

const run = async (env) => (await execFileP(process.execPath, ["src/cli.js", "ci-sync", "--out", path.join(home, "out.enc"), "--back", "1", "--ahead", "2"],
  { env: { ...process.env, SUGARWOD_SYNC_HOME: home, SUGARWOD_BASE: base, RANGE_SYNC_KEY: "correct horse battery", ...env }, encoding: "utf8" })).stdout;

test("wrong password fails clearly without printing it", async () => {
  try { await run({ SUGARWOD_EMAIL: "me@example.com", SUGARWOD_PASSWORD: "wrong" }); assert.fail("should fail"); }
  catch (e) { assert.match(String(e.stderr), /rejected the login \(401/); assert.doesNotMatch(String(e.stderr) + String(e.stdout), /wrong/); }
});

test("logs in, reads the whiteboard and writes an encrypted file the app can open", async () => {
  const out = await run({ SUGARWOD_EMAIL: "me@example.com", SUGARWOD_PASSWORD: "right" });
  assert.match(out, /Synced: 2 workouts read/);
  const box = JSON.parse(fs.readFileSync(path.join(home, "out.enc"), "utf8"));
  assert.equal(box.format, "range-sealed/1");
  assert.doesNotMatch(JSON.stringify(box), /Fran|Thrusters/);
  const { unseal } = await import("../src/seal.js");
  const data = await unseal(box, "correct horse battery");
  assert.deepEqual(data.workouts.map((w) => w.title).sort(), ["Engine", "Fran"]);
  await assert.rejects(unseal(box, "wrong key"));
  // second run keeps earlier workouts (merge), still 2
  await run({ SUGARWOD_EMAIL: "me@example.com", SUGARWOD_PASSWORD: "right" });
  const again = await unseal(JSON.parse(fs.readFileSync(path.join(home, "out.enc"), "utf8")), "correct horse battery");
  assert.equal(again.workouts.length, 2);
});
