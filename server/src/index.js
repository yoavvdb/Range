// Starts Range's server. Settings come from the environment:
//   RANGE_MASTER_KEY   required. 32 random bytes, base64 (openssl rand -base64 32). Encrypts connected logins.
//                      Keep it safe and never change it: without it stored logins can't be read.
//   PORT               default 8080
//   RANGE_DB           SQLite file, default ./data/range.db (put it on a persistent volume)
//   RANGE_SITE         the built app folder, default ../site
//   CHROMIUM_PATH      optional: a Chromium binary for the SugarWOD connector
//   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT   optional: recover reminders as push notifications
//   RANGE_SECURE_COOKIES   "always" behind an HTTPS proxy that doesn't set x-forwarded-proto; "0" for plain-http local testing
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { openDb } from "./db.js";
import { makeVault } from "./security.js";
import { makeSyncer } from "./sync.js";
import { makePush } from "./push.js";
import { createApp } from "./app.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const env = process.env;
const dbFile = env.RANGE_DB || path.join(here, "..", "data", "range.db");
fs.mkdirSync(path.dirname(dbFile), { recursive: true });

const db = openDb(dbFile);
const vault = makeVault(env.RANGE_MASTER_KEY);
const push = makePush({ db, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY, subject: env.VAPID_SUBJECT });
const syncer = makeSyncer({
  db, vault, notify: push.notify,
  launchBrowser: () => chromium.launch({ headless: true, ...(env.CHROMIUM_PATH ? { executablePath: env.CHROMIUM_PATH } : {}) }),
});
const app = createApp({
  db, vault, syncer, push,
  siteDir: env.RANGE_SITE || path.join(here, "..", "..", "site"),
  secureCookies: env.RANGE_SECURE_COOKIES === "0" ? false : env.RANGE_SECURE_COOKIES === "always" ? "always" : true,
});

const server = http.createServer(app);
server.listen(+(env.PORT || 8080), () => console.log(`Range is running on port ${server.address().port}`));
if (env.RANGE_NO_SYNC !== "1") syncer.start();

const shutdown = async () => { server.close(); await syncer.stop(); db.close(); process.exit(0); };
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
