// Push notifications for the installed Range app: when the scheduled sync finds a score you just logged,
// it nudges you to recover. Standard Web Push (VAPID), so it works on Android and on iPhone (iOS 16.4+,
// app added to the home screen). The payload is end-to-end encrypted to your phone by web-push.
import webpush from "web-push";
import { addDays, todayIso } from "./store.js";

export function generateKeys() {
  return webpush.generateVAPIDKeys();
}

// Days whose scores are new since the last sync. Only recent days count, so a first sync or a
// backfill of old results doesn't send a pile of notifications.
export function newlyScored(previous, current, { days = 3 } = {}) {
  if (!previous.length) return [];
  const had = new Set(previous.filter((w) => w.result).map((w) => w.date));
  const from = addDays(todayIso(), -days);
  // judged by when the score was logged, so catching up on an older day's programme still counts as just done
  const doneOn = (w) => (w.loggedAt && w.loggedAt.slice(0, 10) > w.date ? w.loggedAt.slice(0, 10) : w.date);
  return current.filter((w) => w.result && doneOn(w) >= from && !had.has(w.date));
}

function subscriptions(raw) {
  if (!raw) return [];
  const t = raw.trim();
  const list = t.startsWith("[") ? JSON.parse(t) : t.split(/\n(?=\s*\{)/).map((s) => JSON.parse(s));
  return list.filter((s) => s && s.endpoint && s.keys);
}

export function recoverMessage(w) {
  const name = (w.title || "your session").split(" · ").slice(0, 2).join(" + ");
  return {
    title: `Scores in: ${name}`,
    body: "Nice work. Take 10 minutes to recover the areas it loaded, ideally within the next few hours.",
    url: `./#recover=${w.date}`,
    tag: `recover-${w.date}`,
  };
}

// Returns how many pushes were delivered. Never throws: a failed notification mustn't fail the sync.
export async function sendPushes(workouts, env = process.env) {
  const { VAPID_PUBLIC_KEY: pub, VAPID_PRIVATE_KEY: priv, PUSH_SUBSCRIPTION: subs } = env;
  if (!workouts.length || !pub || !priv || !subs) return 0;
  let list;
  try { list = subscriptions(subs); } catch { console.log("PUSH_SUBSCRIPTION isn't valid JSON. Copy it again from Range → Profile → Notifications."); return 0; }
  webpush.setVapidDetails(env.VAPID_SUBJECT || "mailto:range-sync@users.noreply.github.com", pub, priv);
  let sent = 0;
  // one notification for the latest session (several at once would just be noise)
  const latest = workouts.slice().sort((a, b) => b.date.localeCompare(a.date))[0];
  for (const s of list) {
    try { await webpush.sendNotification(s, JSON.stringify(recoverMessage(latest)), { TTL: 6 * 3600 }); sent++; }
    catch (e) { console.log(`Push failed (${e.statusCode || e.message}).${e.statusCode === 410 || e.statusCode === 404 ? " The phone unsubscribed: copy a new subscription from Range." : ""}`); }
  }
  return sent;
}
