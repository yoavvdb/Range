// Renders every exercise demo the way the app shows it (3D, gym-kit look) into contact sheets for review.
// Usage: node qa/render-demos.js <app-url> <out-dir> [ids,comma,separated]
// Needs Playwright with Chromium. Writes sheet-NN.png plus manifest.json (which exercises are on which sheet).
const { chromium } = require(process.env.PW || "playwright");
const fs = require("fs");
const PER_SHEET = 6;
(async () => {
  const [url, out, only] = process.argv.slice(2);
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ ...(process.env.CHROME ? { executablePath: process.env.CHROME } : {}), args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 1400, height: 400 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.addInitScript(() => { window.RANGE_THREE_URL = window.RANGE_THREE_URL || "./three.module.min.js"; });
  await p.goto(url);
  await p.waitForTimeout(800);
  const list = await p.evaluate(async (only) => {
    document.documentElement.dataset.fig = "gymkit";
    FIG3D.start();
    for (let i = 0; i < 100 && !FIG3D.ready; i++) await new Promise((r) => setTimeout(r, 100));
    const all = [...LIB, ...(typeof REHAB_LIB !== "undefined" ? REHAB_LIB.filter((r) => !LIB.includes(r)) : [])];
    const want = only ? only.split(",") : null;
    const seen = new Set();
    return all.filter((e) => (!want || want.includes(e.id)) && !seen.has(e.id) && seen.add(e.id)).map((e) => ({
      id: e.id, fig: e.fig || e.id, n: e.n, cues: e.c || [], zones: (e.z || []).map((z) => ZONES[z] || z), sides: !!e.sides,
      still: isStatic(e), eq: e.eq || [],
    }));
  }, only || "");
  const manifest = [];
  for (let s = 0; s * PER_SHEET < list.length; s++) {
    const chunk = list.slice(s * PER_SHEET, (s + 1) * PER_SHEET);
    await p.evaluate(async (chunk) => {
      const rows = chunk.map((e) => {
        // static holds are shown frozen in the end position: show it from two angles instead of three moments
        const shots = e.still ? [[1, 0], [1, 0.9], [1, -0.9]] : [[0, 0], [0.5, 0], [1, 0]];
        const imgs = shots.map(([t, y]) => `<figure><img src="${FIG3D.renderTo(e.fig, t, { zones: (LIBI[e.id] || {}).z || [], sides: e.sides, guide: false }, 420, 300, y).toDataURL()}"><figcaption>${e.still ? (y ? "other angle" : "hold position") : t === 0 ? "start" : t === 1 ? "end" : "middle"}</figcaption></figure>`).join("");
        return `<div class="r"><div class="l"><b>${e.id}</b><h3>${e.n}</h3><p>${e.still ? "Static hold" : "Movement"}${e.sides ? " · one side" : ""}${e.eq.length ? " · " + e.eq.join(", ") : ""}</p><p class="z">${e.zones.join(", ")}</p><ul>${e.cues.map((c) => `<li>${c}</li>`).join("")}</ul></div>${imgs}</div>`;
      });
      document.body.innerHTML = `<style>body{margin:0;background:#fff;font:13px system-ui;color:#111}.r{display:grid;grid-template-columns:260px repeat(3,420px);gap:6px;padding:6px;border-bottom:2px solid #ccc}h3{margin:2px 0;font-size:16px}p{margin:2px 0}.z{color:#0a7}ul{margin:4px 0;padding-left:16px}figure{margin:0}figcaption{font-size:11px;color:#666}</style>${rows.join("")}`;
    }, chunk);
    const file = `sheet-${String(s + 1).padStart(2, "0")}.png`;
    await p.screenshot({ path: `${out}/${file}`, fullPage: true });
    manifest.push({ file, exercises: chunk.map((e) => ({ id: e.id, fig: e.fig, name: e.n })) });
  }
  fs.writeFileSync(`${out}/manifest.json`, JSON.stringify(manifest, null, 1));
  console.log(`${list.length} exercises on ${manifest.length} sheets in ${out}${errs.length ? `\npage errors: ${errs.join("; ")}` : ""}`);
  await b.close();
})();
