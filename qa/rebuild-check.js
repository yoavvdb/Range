// Checks Rebuild's protocol choice against an independent clinical reviewer's blind judgement.
// Each case in qa/rebuild/*.json has the person's description, their self-screen answers and the expert's call.
// Usage: node qa/rebuild-check.js <app-url>   (e.g. http://localhost:8791/range.html, serving build/)
// Needs Playwright with Chromium (PW and CHROME env vars work as in render-demos.js).
const { chromium } = require(process.env.PW || "playwright");
const fs = require("fs"), path = require("path");
(async () => {
  const url = process.argv[2];
  const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  const p = await b.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(url); await p.waitForTimeout(1500);
  let fail = 0;
  for (const f of fs.readdirSync(path.join(__dirname, "rebuild")).filter((x) => x.endsWith(".json")).sort()) {
    const cases = JSON.parse(fs.readFileSync(path.join(__dirname, "rebuild", f), "utf8"));
    const out = await p.evaluate((cases) => cases.map((c) => { RB = { r: c.region, flags: new Set(), step: 0, ans: c.answers, desc: c.description };
      const r = rbClassify(); return { id: c.id, conf: c.expert.confidence, expert: c.expert.protocol, range: r.cls, flagEx: !!c.expert.red_flags, warn: r.desc.warn, sideEx: c.expert.side, side: r.side }; }), cases);
    const agree = out.filter((r) => r.range === r.expert).length, hi = out.filter((r) => r.conf === "high"), hiOk = hi.filter((r) => r.range === r.expert).length;
    const flags = out.filter((r) => r.flagEx), caught = flags.filter((r) => r.warn.length).length, falseAl = out.filter((r) => !r.flagEx && r.warn.length).length;
    console.log(`${f}: protocol ${agree}/${out.length} (clear-cut ${hiOk}/${hi.length}), warnings ${caught}/${flags.length}, false alarms ${falseAl}`);
    out.filter((r) => r.range !== r.expert).forEach((r) => console.log(`  differs ${r.id} (${r.conf}): expert ${r.expert}, Range ${r.range}`));
    if (hiOk < hi.length || caught < flags.length || falseAl) fail = 1;
  }
  if (errs.length) { console.log("page errors:", errs.join("; ")); fail = 1; }
  await b.close(); process.exit(fail);
})();
