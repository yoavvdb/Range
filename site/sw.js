// Offline support: the app shell is cached on install; fonts are cached the first time they load.
const CACHE = "range-46281977";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png", "three.module.min.js"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const isFont = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (url.origin !== location.origin && !isFont) return;
  if (url.pathname.endsWith(".enc")) return; // the SugarWOD sync file always comes from the network
  if (url.pathname.startsWith("/api/")) return; // account data is never cached (it is per person and changes)
  // Network first for the page (so updates arrive), cache first for everything else.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then((res) => { caches.open(CACHE).then((c) => c.put("index.html", res.clone())); return res; })
        .catch(() => caches.match("index.html")),
    );
    return;
  }
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok || res.type === "opaque") { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    })),
  );
});

// Push from the scheduled SugarWOD sync: "Scores in, time to recover". Tapping it opens Recover for that session.
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || "Range", {
    body: d.body || "", tag: d.tag || "range", icon: "icon-192.png", badge: "icon-192.png", data: { url: d.url || "./" },
  }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "./", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
    const w = wins.find((c) => c.url.startsWith(self.registration.scope));
    if (w) return w.focus().then(() => w.postMessage({ type: "open", url }));
    return self.clients.openWindow(url);
  }));
});
