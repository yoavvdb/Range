// Reads your gym's whiteboard from app.sugarwod.com in a real browser that you log into yourself.
// Your password is typed into SugarWOD's own login page and never seen or stored by this tool;
// only the browser's session cookies live in ~/.sugarwod-sync/browser-profile.
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { chromium } from "playwright";
import { PROFILE_DIR, todayIso, addDays } from "./store.js";
import { sniffWorkouts } from "./extract.js";

const BASE = (process.env.SUGARWOD_BASE || "https://app.sugarwod.com").replace(/\/$/, "");
const launchOpts = (headless) => ({
  headless,
  viewport: { width: 1280, height: 900 },
  ...(process.env.SUGARWOD_CHROMIUM_PATH ? { executablePath: process.env.SUGARWOD_CHROMIUM_PATH } : {}),
});

// Date-addressed whiteboard URLs to try, in order. The first one that yields workouts for the
// requested day is reused for the rest of the run.
const URL_PATTERNS = [
  (d) => `${BASE}/whiteboard?date=${d.replace(/-/g, "")}`,
  (d) => `${BASE}/whiteboard/${d.replace(/-/g, "")}`,
  (d) => `${BASE}/whiteboard?date=${d}`,
  (d) => `${BASE}/whiteboard/${d}`,
];

const isLoginUrl = (u) => /\/(login|signin|sign-in|sign_in)(\b|\/|\?|$)/i.test(new URL(u).pathname + "/");

function waitForEnter(prompt) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  return new Promise((res) => rl.question(prompt, () => { rl.close(); res(); }));
}

// Session-only cookies are dropped when a browser closes, so the login is also saved explicitly
// and put back on every run.
const STATE_FILE = path.join(PROFILE_DIR, "..", "session.json");

async function openContext(headless) {
  fs.mkdirSync(PROFILE_DIR, { recursive: true });
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, launchOpts(headless));
  try {
    const { cookies } = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    if (cookies?.length) await ctx.addCookies(cookies);
  } catch {
    /* no saved session yet */
  }
  const page = ctx.pages()[0] || (await ctx.newPage());
  return { ctx, page };
}

async function saveSession(ctx) {
  const state = await ctx.storageState();
  fs.writeFileSync(STATE_FILE, JSON.stringify({ cookies: state.cookies }), { mode: 0o600 });
}

function captureJson(page, sink, dumps) {
  page.on("response", async (res) => {
    const type = res.headers()["content-type"] || "";
    if (!type.includes("json")) return;
    try {
      const body = await res.json();
      sink.push(...sniffWorkouts(body));
      if (dumps) dumps.push({ url: res.url(), status: res.status(), body });
    } catch {
      /* not JSON after all, or body unavailable */
    }
  });
}

// Unattended login for scheduled runs: fills SugarWOD's own login form, exactly like typing it in.
// The password comes from an environment variable and is never logged or written to disk.
export async function loginWithPassword(email, password) {
  const { ctx, page } = await openContext(true);
  try {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.fill('input[name="username"]', email);
    await page.fill('input[name="password"]', password);
    const resp = page.waitForResponse((r) => r.url().includes("/api/v1/login"), { timeout: 30000 }).catch(() => null);
    await page.click('#login-button, button[type="submit"]');
    const r = await resp;
    if (r && r.status() >= 400) {
      let msg = "";
      try { msg = (await r.json()).message || ""; } catch {}
      throw new Error(`SugarWOD rejected the login (${r.status()}${msg ? `: ${msg}` : ""}). Check the SUGARWOD_EMAIL and SUGARWOD_PASSWORD secrets.`);
    }
    await page.waitForURL((u) => !isLoginUrl(u.toString()), { timeout: 30000 }).catch(() => {});
    if (isLoginUrl(page.url())) throw new Error("Still on the login page after signing in. SugarWOD may be asking for something extra (for example a verification step).");
    await saveSession(ctx);
    return true;
  } finally {
    await ctx.close();
  }
}

export async function login() {
  const { ctx, page } = await openContext(false);
  await page.goto(`${BASE}/login`).catch(() => {});
  await waitForEnter(
    "\nA browser window opened on SugarWOD. Log in there as you normally do.\n" +
      "When you can see your gym's whiteboard, come back here and press Enter… ",
  );
  const ok = !isLoginUrl(page.url());
  if (ok) await saveSession(ctx);
  await ctx.close();
  return ok;
}

// Opens a visible browser and records every workout the site loads while you click around.
// Use it if `sync` can't find your gym's whiteboard on its own.
export async function watch({ debugDir } = {}) {
  const { ctx, page } = await openContext(false);
  const found = [];
  const dumps = debugDir ? [] : null;
  captureJson(page, found, dumps);
  await page.goto(`${BASE}/whiteboard`).catch(() => {});
  await waitForEnter(
    "\nClick through the days on your whiteboard (past and upcoming) in the browser window.\n" +
      "Every workout it loads is recorded. Press Enter here when you're done… ",
  );
  await ctx.close();
  if (debugDir) writeDebug(debugDir, dumps, []);
  return dedupe(found);
}

export async function syncWhiteboard({ back = 3, ahead = 7, headless = true, delayMs = 2000, debugDir } = {}) {
  const { ctx, page } = await openContext(headless);
  const found = [];
  const dumps = debugDir ? [] : null;
  const pages = [];
  captureJson(page, found, dumps);

  const today = todayIso();
  const dates = [];
  for (let i = -back; i <= ahead; i++) dates.push(addDays(today, i));

  let pattern = null;
  const missing = [];
  try {
    for (const d of dates) {
      if (found.some((w) => w.date === d)) continue; // already came in with another day's data (week views)
      for (const p of pattern ? [pattern] : URL_PATTERNS) {
        await page.goto(p(d), { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
        if (isLoginUrl(page.url())) throw new Error("You're not logged in to SugarWOD. Run: sugarwod-sync login");
        await page.waitForTimeout(600);
        if (found.some((w) => w.date === d)) { pattern = p; break; }
      }
      if (!found.some((w) => w.date === d)) {
        missing.push(d);
        if (debugDir) pages.push({ date: d, url: page.url(), html: await page.content().catch(() => "") });
      }
      await page.waitForTimeout(delayMs); // be gentle with SugarWOD's servers
    }
    await saveSession(ctx); // keep refreshed cookies
  } finally {
    await ctx.close();
    if (debugDir) writeDebug(debugDir, dumps, pages);
  }
  const first = dates[0];
  const last = dates[dates.length - 1];
  return {
    workouts: dedupe(found).filter((w) => w.date >= first && w.date <= last),
    missingDays: missing.filter((d) => !found.some((w) => w.date === d)),
  };
}

function dedupe(list) {
  const seen = new Set();
  return list.filter((w) => {
    const k = `${w.date}|${w.title}|${w.text.slice(0, 60)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function writeDebug(dir, dumps, pages) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "responses.json"), JSON.stringify(dumps, null, 2));
  pages.forEach((p) => fs.writeFileSync(path.join(dir, `page-${p.date}.html`), p.html));
  console.error(`Debug files written to ${dir}. They contain your gym's workouts, so only share them if you're comfortable with that.`);
}
