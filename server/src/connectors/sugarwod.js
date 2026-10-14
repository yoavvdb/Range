// SugarWOD for an athlete: there's no official per-athlete API, so this logs in with the person's own
// SugarWOD email and password (like they would in a browser), then reads their gym's programming and the
// scores they logged, through the same endpoints SugarWOD's website uses.
// The browser session is kept (encrypted) between runs, so most syncs don't log in again.
import { loginOnPage, LoginRejected, isLoginUrl } from "../../../sugarwod-sync/src/whiteboard.js";
import { fetchSugarwod } from "../../../sugarwod-sync/src/api.js";

export default {
  id: "sugarwod",
  name: "SugarWOD",
  kind: "login",
  available: true,
  blurb: "Your gym's programming and the scores you log, every hour.",
  fields: [
    { key: "email", label: "SugarWOD email", type: "email", required: true },
    { key: "password", label: "SugarWOD password", type: "password", required: true },
    { key: "track", label: "Program (optional, e.g. RX-Club)", type: "text", required: false, option: true },
  ],
  consent: "Range stores your SugarWOD login encrypted and uses it only to read your own programming and results once an hour. SugarWOD doesn't offer this officially, so it can stop working if they change their site. Remove the connection any time to delete the login.",

  async sync({ secret, state, options, browser, base = process.env.SUGARWOD_BASE || "https://app.sugarwod.com" }) {
    const ctx = await browser.newContext({
      storageState: state || undefined,
      viewport: { width: 1280, height: 900 },
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
    });
    try {
      const page = await ctx.newPage();
      await page.goto(`${base}/workouts/calendar`, { waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => {});
      if (isLoginUrl(page.url()) || !(await page.evaluate(() => !!window.CUR_ATH_ID).catch(() => false))) {
        await loginOnPage(page, secret.email, secret.password, base);
      }
      const a = await fetchSugarwod(page, { back: 14, ahead: 7, track: options?.track || undefined, base });
      return {
        workouts: a.workouts,
        state: await ctx.storageState(),
        info: { track: a.track, tracks: a.tracks, results: a.counts.results },
      };
    } catch (e) {
      if (e instanceof LoginRejected) e.auth = true;
      throw e;
    } finally {
      await ctx.close();
    }
  },
};
