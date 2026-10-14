// Runs each connection's sync: hourly when healthy, backing off after errors, and never retrying a login the
// platform rejected (that could lock the person's account) until they update it. One sync at a time, sharing
// one headless browser.
import { CONNECTORS } from "./connectors/index.js";

const HOUR = 3600e3;
const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

export function makeSyncer({ db, vault, launchBrowser, notify = async () => {}, log = console.log }) {
  let browser = null, idle = null, chain = Promise.resolve();

  async function getBrowser() {
    clearTimeout(idle);
    if (!browser) browser = await launchBrowser();
    idle = setTimeout(() => { const b = browser; browser = null; b?.close().catch(() => {}); }, 5 * 60e3);
    idle.unref?.();
    return browser;
  }

  const aad = (c) => `${c.user_id}:${c.id}`;

  function store(conn, workouts) {
    const prev = new Map(db.prepare("SELECT date, result FROM workouts WHERE user_id = ? AND conn_id = ?").all(conn.user_id, conn.id).map((r) => [r.date, r.result]));
    const up = db.prepare(`INSERT INTO workouts (user_id, conn_id, date, title, text, result, logged_at, source) VALUES (?,?,?,?,?,?,?,?)
      ON CONFLICT (user_id, conn_id, date) DO UPDATE SET title = excluded.title, text = excluded.text,
        result = COALESCE(excluded.result, workouts.result), logged_at = COALESCE(excluded.logged_at, workouts.logged_at), source = excluded.source`);
    const fresh = [];
    for (const w of workouts) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(w.date || "")) continue;
      up.run(conn.user_id, conn.id, w.date, w.title || "", w.text || "", w.result || null, w.loggedAt || null, w.source || conn.provider);
      // a score that wasn't there last time, for a recent day: time to recover
      // (judged by when it was logged: catching up on an old day's programme still counts as just done)
      const doneOn = w.loggedAt && w.loggedAt.slice(0, 10) > w.date ? w.loggedAt.slice(0, 10) : w.date;
      if (w.result && !prev.get(w.date) && prev.size && doneOn >= daysAgo(3)) fresh.push(w);
    }
    return fresh;
  }

  async function syncNow(connId) {
    const run = chain.then(() => runOne(connId));
    chain = run.catch(() => {});
    return run;
  }

  async function runOne(connId) {
    const conn = db.prepare("SELECT * FROM connections WHERE id = ?").get(connId);
    if (!conn) return { ok: false, error: "Connection not found." };
    const c = CONNECTORS[conn.provider];
    if (!c) return { ok: false, error: "This platform isn't supported any more." };
    try {
      const secret = vault.open(conn.secret, aad(conn));
      const state = conn.state ? vault.open(conn.state, aad(conn)) : null;
      const options = conn.options ? JSON.parse(conn.options) : {};
      const r = await c.sync({ secret, state, options, browser: c.kind === "login" ? await getBrowser() : null });
      const fresh = store(conn, r.workouts || []);
      db.prepare("UPDATE connections SET status = 'ok', error = NULL, info = ?, state = ?, last_sync = ?, next_sync = ?, fails = 0 WHERE id = ?")
        .run(JSON.stringify(r.info || {}), r.state ? vault.seal(r.state, aad(conn)) : null, Date.now(), Date.now() + HOUR, conn.id);
      if (fresh.length) await notify(conn.user_id, fresh).catch(() => {});
      log(`sync ${conn.id} ${conn.provider}: ${(r.workouts || []).length} workouts, ${fresh.length} new scores`);
      return { ok: true, count: (r.workouts || []).length, fresh: fresh.length };
    } catch (e) {
      const msg = String(e.message || e).split("\n")[0].slice(0, 300);
      if (e.auth) {
        // stop here: retrying a rejected login every hour could get the person's account locked
        db.prepare("UPDATE connections SET status = 'auth_failed', error = ?, next_sync = ?, fails = fails + 1 WHERE id = ?").run(msg, Number.MAX_SAFE_INTEGER, conn.id);
      } else {
        const fails = conn.fails + 1, wait = Math.min(12 * HOUR, 15 * 60e3 * 2 ** Math.min(fails, 6));
        db.prepare("UPDATE connections SET status = 'error', error = ?, next_sync = ?, fails = ? WHERE id = ?").run(msg, Date.now() + wait, fails, conn.id);
      }
      log(`sync ${conn.id} ${conn.provider} failed${e.auth ? " (login rejected)" : ""}: ${msg}`);
      if (process.env.DEBUG_SYNC) console.error(e.stack);
      return { ok: false, auth: !!e.auth, error: msg };
    }
  }

  // every few minutes: sync whatever is due, oldest first
  async function tick() {
    const due = db.prepare("SELECT id FROM connections WHERE next_sync <= ? ORDER BY next_sync LIMIT 20").all(Date.now());
    for (const { id } of due) await syncNow(id);
  }
  let timer = null;
  return {
    syncNow, tick,
    start(every = 5 * 60e3) { timer = setInterval(() => tick().catch((e) => log("tick failed: " + e.message)), every); timer.unref?.(); tick().catch(() => {}); },
    async stop() { clearInterval(timer); clearTimeout(idle); await chain; await browser?.close().catch(() => {}); browser = null; },
  };
}
