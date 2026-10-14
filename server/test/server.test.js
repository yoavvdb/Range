// End-to-end: the real server (in-process) against a stand-in SugarWOD (website + official API).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { chromium } from "playwright";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "range-srv-"));
const pad = (n) => String(n).padStart(2, "0");
const ymdOf = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
const dayInt = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return +ymdOf(d); };
const isoOf = (n) => { const s = String(dayInt(n)); return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`; };

// ---- stand-in SugarWOD -------------------------------------------------------------------------------
const SW = { password: "sw-right-pass", logins: 0, results: [] };
const PROGRAM = [{ id: "w1", scheduledDateInteger: dayInt(-1), title: "Fran", description: "21-15-9 thrusters, pull-ups" },
  { id: "w2", scheduledDateInteger: dayInt(2), title: "Back Squat", description: "5x5" }];
SW.results = [{ swId: "w1", dateInt: dayInt(-1), title: "Fran", description: "21-15-9", result: "3:41", rx: true, pr: false, createdAt: new Date().toISOString() }];
let sw, swBase, api, apiBase, fakesUp;

before(() => (fakesUp = (async () => {
  sw = http.createServer((req, res) => {
    const u = new URL(req.url, "http://x");
    const html = (s) => { res.setHeader("content-type", "text/html"); res.end(s); };
    if (u.pathname === "/login") return html(`<form id="f"><input name="username"><input name="password" type="password"><button id="login-button" type="submit">Log in</button></form>
      <script>document.getElementById('f').onsubmit=e=>{e.preventDefault();fetch('/public/api/v1/login',{method:'POST',body:new URLSearchParams(new FormData(e.target))}).then(r=>{if(r.ok)location.href='/workouts/calendar'})}</script>`);
    if (u.pathname === "/public/api/v1/login" && req.method === "POST") {
      let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
        const p = new URLSearchParams(b); SW.logins++;
        res.setHeader("content-type", "application/json");
        if (p.get("username") === "athlete@example.com" && p.get("password") === SW.password) { res.setHeader("set-cookie", "sess=ok; Path=/"); return res.end('{"ok":true}'); }
        res.writeHead(401); res.end('{"message":"That email/password combination does not match.","code":101}');
      }); return;
    }
    if (!req.headers.cookie?.includes("sess=ok")) { res.writeHead(302, { location: "/login" }); return res.end(); }
    if (u.pathname === "/workouts/calendar") return html(`<select><option value="no-subscription-selected">No program</option><option value="t1">WOD</option></select>
      <script>window.CSRF="c";window.CUR_ATH_ID="me1"</script>`);
    res.setHeader("content-type", "application/json");
    if (u.pathname === "/api/athletes/me1/results") return res.end(JSON.stringify({ data: SW.results }));
    if (u.pathname === "/api/workouts") {
      const week = +u.searchParams.get("week"), end = (() => { const s = String(week); const d = new Date(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8) + 7); return +ymdOf(d); })();
      return res.end(JSON.stringify({ data: PROGRAM.filter((w) => w.scheduledDateInteger >= week && w.scheduledDateInteger < end) }));
    }
    res.writeHead(404); res.end("{}");
  });
  await new Promise((r) => sw.listen(0, "127.0.0.1", r));
  swBase = `http://127.0.0.1:${sw.address().port}`;

  api = http.createServer((req, res) => {
    const u = new URL(req.url, "http://x");
    res.setHeader("content-type", "application/json");
    if (req.headers.authorization !== "gym-key") { res.writeHead(401); return res.end("{}"); }
    if (u.pathname === "/v2/tracks") return res.end(JSON.stringify({ data: [{ id: "T1", attributes: { name: "WOD" } }] }));
    if (u.pathname === "/v2/workouts") {
      const [a, b] = u.searchParams.get("dates").split("-").map(Number);
      const all = [{ attributes: { title: "Murph", description: "1 mile run...", scheduled_date_int: dayInt(1) } }];
      return res.end(JSON.stringify({ data: all.filter((w) => w.attributes.scheduled_date_int >= a && w.attributes.scheduled_date_int <= b) }));
    }
    res.writeHead(404); res.end("{}");
  });
  await new Promise((r) => api.listen(0, "127.0.0.1", r));
  apiBase = `http://127.0.0.1:${api.address().port}/v2`;
})()));

// ---- the Range server ----------------------------------------------------------------------------------
let range, base, ctx;
const pushed = [];
before(async () => {
  await fakesUp;
  process.env.SUGARWOD_BASE = swBase;
  process.env.SUGARWOD_API_BASE = apiBase;
  const { openDb } = await import("../src/db.js");
  const { makeVault } = await import("../src/security.js");
  const { makeSyncer } = await import("../src/sync.js");
  const { createApp } = await import("../src/app.js");
  const site = path.join(tmp, "site"); fs.mkdirSync(site);
  fs.writeFileSync(path.join(site, "index.html"), "<!doctype html><html><head><title>Range</title></head><body>app</body></html>");
  const db = openDb(path.join(tmp, "range.db"));
  const vault = makeVault(crypto.randomBytes(32).toString("base64"));
  const syncer = makeSyncer({ db, vault, log: (m) => process.env.DEBUG_SYNC && console.error(m), notify: async (uid, fresh) => { pushed.push({ uid, fresh }); },
    launchBrowser: () => chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) }) });
  ctx = { db, syncer };
  range = http.createServer(createApp({ db, vault, syncer, push: { publicKey: null }, siteDir: site, secureCookies: false }));
  await new Promise((r) => range.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${range.address().port}`;
});
after(async () => { await ctx.syncer.stop(); range.close(); sw.close(); api.close(); fs.rmSync(tmp, { recursive: true, force: true }); });

// a tiny client that keeps its own session cookie
function client() {
  let cookie = "";
  const call = async (method, url, body, headers = {}) => {
    const r = await fetch(base + url, { method, headers: { ...(cookie ? { cookie } : {}), ...(method !== "GET" ? { "x-range": "1" } : {}), ...(body ? { "content-type": "application/json" } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
    const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0].endsWith("=") ? "" : sc.split(";")[0];
    const text = await r.text();
    return { status: r.status, body: text ? JSON.parse(text) : null };
  };
  return { get: (u) => call("GET", u), post: (u, b) => call("POST", u, b || {}), put: (u, b) => call("PUT", u, b), patch: (u, b) => call("PATCH", u, b), del: (u, b) => call("DELETE", u, b || {}), raw: call };
}
const A = client(), B = client();

test("accounts: sign up, sign in, sign out, guards", async () => {
  assert.equal((await A.get("/api/me")).status, 401);
  assert.equal((await A.post("/api/auth/signup", { email: "a@example.com", password: "short" })).status, 400);
  assert.equal((await A.post("/api/auth/signup", { email: "A@Example.com", password: "a-long-password" })).status, 201);
  assert.equal((await A.get("/api/me")).body.user.email, "a@example.com");
  assert.equal((await B.post("/api/auth/signup", { email: "a@example.com", password: "another-password" })).status, 409);
  assert.equal((await B.post("/api/auth/login", { email: "a@example.com", password: "wrong-password!" })).status, 401);
  assert.equal((await B.post("/api/auth/signup", { email: "b@example.com", password: "b-long-password" })).status, 201);
  // a plain username works too
  const C = client();
  assert.equal((await C.post("/api/auth/signup", { email: "x", password: "c-long-password" })).status, 400);
  assert.equal((await C.post("/api/auth/signup", { email: "Yoav_Lifts", password: "c-long-password" })).status, 201);
  assert.equal((await C.post("/api/auth/login", { email: "yoav_lifts", password: "c-long-password" })).status, 200);
  assert.equal((await C.get("/api/me")).body.user.email, "yoav_lifts");
  // changes need the X-Range header (cross-site forms can't send it)
  assert.equal((await A.raw("POST", "/api/auth/logout", null, { "x-range": "0" })).status, 403);
  // passwords are stored hashed
  const row = ctx.db.prepare("SELECT pw FROM users WHERE email = 'a@example.com'").get();
  assert.match(row.pw, /^s1\$/); assert.doesNotMatch(row.pw, /a-long-password/);
});

test("a rejected SugarWOD login is not kept", async () => {
  const r = await A.post("/api/connections", { provider: "sugarwod", fields: { email: "athlete@example.com", password: "nope" } });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /rejected the login/);
  assert.doesNotMatch(r.body.error, /nope/);
  assert.equal((await A.get("/api/connections")).body.connections.length, 0);
});

let connId;
test("connecting SugarWOD syncs straight away and stores the login encrypted", async () => {
  const r = await A.post("/api/connections", { provider: "sugarwod", fields: { email: "athlete@example.com", password: SW.password } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.connection.status, "ok");
  connId = r.body.connection.id;
  const w = (await A.get("/api/workouts")).body.workouts;
  const fran = w.find((x) => x.date === isoOf(-1)), squat = w.find((x) => x.date === isoOf(2));
  assert.match(fran.result, /3:41 RX/);
  assert.equal(squat.title, "Back Squat");
  // nothing readable on disk: not the password, not the session cookie
  ctx.db.exec("PRAGMA wal_checkpoint(FULL)");
  const disk = fs.readFileSync(path.join(tmp, "range.db"));
  assert.equal(disk.includes(Buffer.from(SW.password)), false);
  assert.equal(disk.includes(Buffer.from("sess=ok")), false);
});

test("later syncs reuse the saved session and a new score sends a recover reminder", async () => {
  const before = SW.logins;
  SW.results.push({ swId: "x", dateInt: dayInt(0), title: "Deadlift", description: "5-5-5", result: "140kg", rx: true, pr: true, createdAt: new Date().toISOString() });
  const r = await A.post(`/api/connections/${connId}/sync`);
  assert.equal(r.body.result.ok, true);
  assert.equal(SW.logins, before, "should not log in again");
  const today = (await A.get("/api/workouts")).body.workouts.find((x) => x.date === isoOf(0));
  assert.match(today.result, /140kg RX · PR/);
  assert.equal(pushed.length, 1);
  assert.equal(pushed[0].fresh[0].date, isoOf(0));
});

test("people only ever see their own data", async () => {
  assert.equal((await B.get("/api/connections")).body.connections.length, 0);
  assert.equal((await B.get("/api/workouts")).body.workouts.length, 0);
  assert.equal((await B.del(`/api/connections/${connId}`)).status, 404);
  assert.equal((await B.post(`/api/connections/${connId}/sync`)).status, 404);
  assert.equal((await A.get("/api/connections")).body.connections.length, 1);
});

test("a login SugarWOD starts rejecting is paused, not retried", async () => {
  SW.password = "changed-by-the-athlete";
  ctx.db.prepare("UPDATE connections SET state = NULL, next_sync = 0 WHERE id = ?").run(connId); // session expired
  await ctx.syncer.tick();
  const c = (await A.get("/api/connections")).body.connections[0];
  assert.equal(c.status, "auth_failed");
  const n = SW.logins; await ctx.syncer.tick();
  assert.equal(SW.logins, n, "no retry until the login is updated");
  // updating the login resumes it
  const u = await A.patch(`/api/connections/${connId}`, { fields: { email: "athlete@example.com", password: "changed-by-the-athlete" } });
  assert.equal(u.body.connection.status, "ok");
});

test("gym owners can connect through SugarWOD's official API", async () => {
  assert.equal((await B.post("/api/connections", { provider: "sugarwod-gym", fields: { apiKey: "bad" } })).status, 400);
  const r = await B.post("/api/connections", { provider: "sugarwod-gym", fields: { apiKey: "gym-key" } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const w = (await B.get("/api/workouts")).body.workouts;
  assert.deepEqual(w.map((x) => [x.date, x.title]), [[isoOf(1), "Murph"]]);
});

test("Range data follows the person between devices", async () => {
  assert.equal((await A.get("/api/data")).body.data, null);
  await A.put("/api/data", { data: { scores: { hips: 52 }, sessions: [1, 2] } });
  assert.deepEqual((await A.get("/api/data")).body.data, { scores: { hips: 52 }, sessions: [1, 2] });
  assert.equal((await B.get("/api/data")).body.data, null);
});

test("the app is served with the API address", async () => {
  const r = await fetch(base + "/");
  assert.match(await r.text(), /window\.RANGE_API="\/api"/);
  // a path that tries to climb out of the app folder (sent raw: fetch would tidy it up first)
  const status = await new Promise((resolve) => http.get({ host: "127.0.0.1", port: range.address().port, path: "/..%2f..%2f..%2fetc%2fpasswd" }, (r) => { r.resume(); resolve(r.statusCode); }));
  assert.equal(status, 403);
});

test("deleting an account removes everything", async () => {
  assert.equal((await A.del("/api/me", { password: "wrong" })).status, 401);
  assert.equal((await A.del("/api/me", { password: "a-long-password" })).status, 200);
  for (const t of ["users", "connections", "workouts", "app_state", "sessions"])
    assert.equal(ctx.db.prepare(`SELECT COUNT(*) n FROM ${t} WHERE ${t === "users" ? "email = 'a@example.com'" : "user_id NOT IN (SELECT id FROM users)"}`).get().n, 0, t);
  assert.equal((await A.get("/api/me")).status, 401);
});
