// "Scores in, time to recover" as Web Push to each of the person's devices (VAPID keys from the environment).
import webpush from "web-push";

export function makePush({ db, publicKey, privateKey, subject = "mailto:range@example.com" }) {
  if (!publicKey || !privateKey) return { publicKey: null, notify: async () => 0 };
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return {
    publicKey,
    async notify(userId, fresh) {
      const w = fresh.slice().sort((a, b) => b.date.localeCompare(a.date))[0];
      const name = (w.title || "your session").split(" · ").slice(0, 2).join(" + ");
      const payload = JSON.stringify({ title: `Scores in: ${name}`, body: "Nice work. Take 10 minutes to recover the areas it loaded, ideally within the next few hours.", url: `./#recover=${w.date}`, tag: `recover-${w.date}` });
      let sent = 0;
      for (const row of db.prepare("SELECT endpoint, sub FROM push_subs WHERE user_id = ?").all(userId)) {
        try { await webpush.sendNotification(JSON.parse(row.sub), payload, { TTL: 6 * 3600 }); sent++; }
        catch (e) { if (e.statusCode === 404 || e.statusCode === 410) db.prepare("DELETE FROM push_subs WHERE endpoint = ?").run(row.endpoint); }
      }
      return sent;
    },
  };
}
