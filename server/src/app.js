// HTTP: the JSON API under /api and the Range app (the built site/ folder) everywhere else.
// Sign-in uses an HttpOnly session cookie. Every request that changes something must send the header
// "X-Range: 1", which a page on another site can't add without the browser asking us first (CSRF guard).
import fs from "node:fs";
import path from "node:path";
import { hashPassword, checkPassword, burnPasswordTime, newToken, tokenHash, newId } from "./security.js";
import { CONNECTORS, listProviders } from "./connectors/index.js";

const SESSION_DAYS = 30;
const COOKIE = "range_session";
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml", ".txt": "text/plain; charset=utf-8", ".ico": "image/x-icon" };
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }

export function createApp({ db, vault, syncer, push, siteDir, secureCookies = true }) {
  // simple fixed-window limits, per key (ip or email)
  const hits = new Map();
  const limit = (key, max, windowMs) => {
    const now = Date.now(), h = hits.get(key);
    if (!h || h.reset < now) { hits.set(key, { n: 1, reset: now + windowMs }); return; }
    if (++h.n > max) throw new HttpError(429, "Too many attempts. Wait a few minutes and try again.");
  };
  setInterval(() => { const now = Date.now(); for (const [k, h] of hits) if (h.reset < now) hits.delete(k); }, 60e3).unref?.();

  const send = (res, status, body, headers = {}) => {
    res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers });
    res.end(body === undefined ? "" : JSON.stringify(body));
  };
  const readJson = (req, max = 2e6) => new Promise((resolve, reject) => {
    if (!/application\/json/.test(req.headers["content-type"] || "")) return reject(new HttpError(415, "Send JSON."));
    let size = 0; const chunks = [];
    req.on("data", (c) => { size += c.length; if (size > max) { reject(new HttpError(413, "Too much data.")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")); } catch { reject(new HttpError(400, "That isn't valid JSON.")); } });
    req.on("error", reject);
  });
  const cookies = (req) => Object.fromEntries((req.headers.cookie || "").split(/;\s*/).filter(Boolean).map((c) => { const i = c.indexOf("="); return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))]; }));
  const isSecure = (req) => secureCookies && (req.socket.encrypted || req.headers["x-forwarded-proto"] === "https" || secureCookies === "always");
  const setSession = (req, token) => `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${isSecure(req) ? "; Secure" : ""}`;
  const clearSession = (req) => `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isSecure(req) ? "; Secure" : ""}`;
  const ip = (req) => String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket.remoteAddress || "?";

  function startSession(req, userId) {
    const token = newToken();
    db.prepare("INSERT INTO sessions (token, user_id, expires) VALUES (?,?,?)").run(tokenHash(token), userId, Date.now() + SESSION_DAYS * 864e5);
    db.prepare("DELETE FROM sessions WHERE expires < ?").run(Date.now());
    return setSession(req, token);
  }
  function currentUser(req) {
    const t = cookies(req)[COOKIE];
    if (!t) return null;
    const row = db.prepare("SELECT u.id, u.email, u.created FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires > ?").get(tokenHash(t), Date.now());
    return row || null;
  }
  const need = (req) => { const u = currentUser(req); if (!u) throw new HttpError(401, "Sign in first."); return u; };

  const publicConn = (c) => ({
    id: c.id, provider: c.provider, name: CONNECTORS[c.provider]?.name || c.provider, label: c.label, status: c.status, error: c.error,
    info: c.info ? JSON.parse(c.info) : null, lastSync: c.last_sync, options: c.options ? JSON.parse(c.options) : {}, created: c.created,
  });
  function splitFields(connector, fields) {
    const secret = {}, options = {};
    for (const f of connector.fields) {
      const v = typeof fields?.[f.key] === "string" ? fields[f.key].trim() : "";
      if (f.required && !v) throw new HttpError(400, `${f.label} is required.`);
      if (v.length > 500) throw new HttpError(400, `${f.label} is too long.`);
      if (v) (f.option ? options : secret)[f.key] = v;
    }
    return { secret, options };
  }

  const routes = {
    "GET /api/health": () => ({ ok: true }),
    "GET /api/providers": () => ({ providers: listProviders() }),

    "POST /api/auth/signup": async (req, res) => {
      limit("signup:" + ip(req), 10, 60 * 60e3);
      const { email, password } = await readJson(req);
      const e = String(email || "").trim().toLowerCase();
      if (!EMAIL.test(e)) throw new HttpError(400, "Enter a valid email address.");
      if (typeof password !== "string" || password.length < 10) throw new HttpError(400, "Use a password of at least 10 characters.");
      if (password.length > 200) throw new HttpError(400, "That password is too long.");
      if (db.prepare("SELECT 1 FROM users WHERE email = ?").get(e)) throw new HttpError(409, "There's already an account with this email. Sign in instead.");
      const id = newId("u");
      db.prepare("INSERT INTO users (id, email, pw, created) VALUES (?,?,?,?)").run(id, e, hashPassword(password), Date.now());
      return [201, { user: { email: e } }, { "set-cookie": startSession(req, id) }];
    },
    "POST /api/auth/login": async (req) => {
      const { email, password } = await readJson(req);
      const e = String(email || "").trim().toLowerCase();
      limit("login-ip:" + ip(req), 30, 15 * 60e3);
      limit("login:" + e, 8, 15 * 60e3);
      const u = db.prepare("SELECT id, pw FROM users WHERE email = ?").get(e);
      if (!u) { burnPasswordTime(String(password || "")); throw new HttpError(401, "Wrong email or password."); }
      if (!checkPassword(String(password || ""), u.pw)) throw new HttpError(401, "Wrong email or password.");
      return [200, { user: { email: e } }, { "set-cookie": startSession(req, u.id) }];
    },
    "POST /api/auth/logout": async (req) => {
      const t = cookies(req)[COOKIE];
      if (t) db.prepare("DELETE FROM sessions WHERE token = ?").run(tokenHash(t));
      return [200, { ok: true }, { "set-cookie": clearSession(req) }];
    },
    "GET /api/me": (req) => { const u = need(req); return { user: { email: u.email, created: u.created } }; },
    "DELETE /api/me": async (req) => {
      const u = need(req);
      const { password } = await readJson(req);
      const row = db.prepare("SELECT pw FROM users WHERE id = ?").get(u.id);
      if (!checkPassword(String(password || ""), row.pw)) throw new HttpError(401, "Wrong password.");
      db.prepare("DELETE FROM users WHERE id = ?").run(u.id); // cascades: sessions, connections (and their logins), workouts, app data, push
      return [200, { ok: true }, { "set-cookie": clearSession(req) }];
    },

    // the person's Range data (profile, tests, sessions...), so it follows them to every device
    "GET /api/data": (req) => {
      const u = need(req);
      const r = db.prepare("SELECT data, updated FROM app_state WHERE user_id = ?").get(u.id);
      return r ? { data: JSON.parse(r.data), updated: r.updated } : { data: null, updated: 0 };
    },
    "PUT /api/data": async (req) => {
      const u = need(req);
      const { data } = await readJson(req, 3e6);
      if (!data || typeof data !== "object" || Array.isArray(data)) throw new HttpError(400, "Send your data as an object.");
      const now = Date.now();
      db.prepare("INSERT INTO app_state (user_id, data, updated) VALUES (?,?,?) ON CONFLICT (user_id) DO UPDATE SET data = excluded.data, updated = excluded.updated").run(u.id, JSON.stringify(data), now);
      return { updated: now };
    },

    "GET /api/connections": (req) => {
      const u = need(req);
      return { connections: db.prepare("SELECT * FROM connections WHERE user_id = ? ORDER BY created").all(u.id).map(publicConn) };
    },
    "POST /api/connections": async (req) => {
      const u = need(req);
      limit("connect:" + u.id, 10, 60 * 60e3);
      const { provider, fields } = await readJson(req);
      const c = CONNECTORS[provider];
      if (!c || !c.available) throw new HttpError(400, "Range can't connect to that platform yet.");
      if (db.prepare("SELECT COUNT(*) n FROM connections WHERE user_id = ?").get(u.id).n >= 5) throw new HttpError(400, "You can connect up to 5 accounts.");
      const { secret, options } = splitFields(c, fields);
      const id = newId("c");
      db.prepare("INSERT INTO connections (id, user_id, provider, label, secret, options, status, next_sync, created) VALUES (?,?,?,?,?,?, 'pending', ?, ?)")
        .run(id, u.id, provider, secret.email || c.name, vault.seal(secret, `${u.id}:${id}`), JSON.stringify(options), Number.MAX_SAFE_INTEGER, Date.now());
      // check it works straight away; a rejected login isn't kept at all
      const r = await syncer.syncNow(id);
      if (!r.ok && r.auth) { db.prepare("DELETE FROM connections WHERE id = ?").run(id); throw new HttpError(400, r.error); }
      return [201, { connection: publicConn(db.prepare("SELECT * FROM connections WHERE id = ?").get(id)), result: r }];
    },
  };

  // routes with an id in the path
  const owned = (u, id) => { const c = db.prepare("SELECT * FROM connections WHERE id = ? AND user_id = ?").get(id, u.id); if (!c) throw new HttpError(404, "Connection not found."); return c; };
  const idRoutes = [
    ["PATCH", /^\/api\/connections\/([\w-]+)$/, async (req, [id]) => { // new login details or options
      const u = need(req), c = owned(u, id), con = CONNECTORS[c.provider];
      limit("connect:" + u.id, 10, 60 * 60e3);
      const { fields } = await readJson(req);
      const { secret, options } = splitFields(con, fields);
      db.prepare("UPDATE connections SET secret = ?, state = NULL, options = ?, label = ?, status = 'pending', error = NULL, fails = 0 WHERE id = ?")
        .run(vault.seal(secret, `${u.id}:${id}`), JSON.stringify(options), secret.email || c.label, id);
      const r = await syncer.syncNow(id);
      return { connection: publicConn(owned(u, id)), result: r };
    }],
    ["DELETE", /^\/api\/connections\/([\w-]+)$/, (req, [id]) => {
      const u = need(req); owned(u, id);
      db.prepare("DELETE FROM connections WHERE id = ?").run(id); // removes the stored login and its workouts
      return { ok: true };
    }],
    ["POST", /^\/api\/connections\/([\w-]+)\/sync$/, async (req, [id]) => {
      const u = need(req), c = owned(u, id);
      limit("syncnow:" + id, 1, 2 * 60e3);
      if (c.status === "auth_failed") throw new HttpError(400, "The login was rejected. Update the login details first.");
      return { result: await syncer.syncNow(id), connection: publicConn(owned(u, id)) };
    }],
  ];

  Object.assign(routes, {
    "GET /api/workouts": (req) => {
      const u = need(req);
      const rows = db.prepare(`SELECT w.date, w.title, w.text, w.result, w.logged_at, w.source, c.provider FROM workouts w JOIN connections c ON c.id = w.conn_id
        WHERE w.user_id = ? AND w.date >= ? ORDER BY w.date`).all(u.id, new Date(Date.now() - 120 * 864e5).toISOString().slice(0, 10));
      const last = db.prepare("SELECT MAX(last_sync) t FROM connections WHERE user_id = ?").get(u.id).t;
      return { syncedAt: last ? new Date(last).toISOString() : null, workouts: rows.map((r) => ({ date: r.date, title: r.title, text: r.text, result: r.result || "", loggedAt: r.logged_at, source: r.source, provider: r.provider })) };
    },
    "GET /api/push/key": () => ({ key: push.publicKey }),
    "POST /api/push/subscribe": async (req) => {
      const u = need(req);
      const { sub } = await readJson(req);
      if (!sub?.endpoint || !/^https:\/\//.test(sub.endpoint) || !sub.keys?.p256dh || !sub.keys?.auth) throw new HttpError(400, "That isn't a push subscription.");
      db.prepare("INSERT INTO push_subs (endpoint, user_id, sub) VALUES (?,?,?) ON CONFLICT (endpoint) DO UPDATE SET user_id = excluded.user_id, sub = excluded.sub").run(sub.endpoint, u.id, JSON.stringify(sub));
      return { ok: true };
    },
    "DELETE /api/push/subscribe": async (req) => {
      const u = need(req);
      const { endpoint } = await readJson(req);
      db.prepare("DELETE FROM push_subs WHERE endpoint = ? AND user_id = ?").run(String(endpoint || ""), u.id);
      return { ok: true };
    },
  });

  // the app: static files from site/, with the API address written into the page
  const root = path.resolve(siteDir);
  function serveStatic(req, res, pathname) {
    let rel = decodeURIComponent(pathname);
    if (rel.endsWith("/")) rel += "index.html";
    const file = path.resolve(root, "." + rel);
    if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404, { "content-type": "text/plain" }); return res.end("Not found"); }
      const type = TYPES[path.extname(file)] || "application/octet-stream";
      const headers = { "content-type": type, "x-content-type-options": "nosniff", "referrer-policy": "same-origin", "x-frame-options": "DENY" };
      if (file.endsWith("index.html")) {
        buf = Buffer.from(buf.toString("utf8").replace("<head>", '<head>\n<script>window.RANGE_API="/api"</script>'));
        headers["cache-control"] = "no-cache";
      } else if (/sw\.js$/.test(file)) headers["cache-control"] = "no-cache";
      res.writeHead(200, headers);
      res.end(req.method === "HEAD" ? undefined : buf);
    });
  }

  return async function handle(req, res) {
    const url = new URL(req.url, "http://x");
    if (!url.pathname.startsWith("/api/")) {
      if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405); return res.end(); }
      return serveStatic(req, res, url.pathname);
    }
    try {
      if (req.method !== "GET" && req.headers["x-range"] !== "1") throw new HttpError(403, "Missing X-Range header.");
      let handler = routes[`${req.method} ${url.pathname}`], params = [];
      if (!handler) for (const [m, re, h] of idRoutes) { const x = m === req.method && url.pathname.match(re); if (x) { handler = h; params = x.slice(1); break; } }
      if (!handler) throw new HttpError(404, "Not found.");
      const out = await handler(req, params, res);
      if (Array.isArray(out)) send(res, out[0], out[1], out[2]); else send(res, 200, out);
    } catch (e) {
      if (e instanceof HttpError) return send(res, e.status, { error: e.message });
      console.error("api error", req.method, url.pathname, e.message);
      send(res, 500, { error: "Something went wrong on the server." });
    }
  };
}
