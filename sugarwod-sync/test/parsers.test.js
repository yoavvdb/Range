import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsv, normDate, sugarwodCsvToWorkouts } from "../src/csv.js";
import { sniffWorkouts, toIsoDate, stripHtml } from "../src/extract.js";

test("parseCsv handles quotes, commas and newlines inside fields", () => {
  const rows = parseCsv('a,b\n"1, one","line1\nline2 ""quoted"""\r\n');
  assert.deepEqual(rows, [["a", "b"], ["1, one", 'line1\nline2 "quoted"']]);
});

test("normDate reads the formats SugarWOD exports use", () => {
  assert.equal(normDate("10/09/2026"), "2026-10-09");
  assert.equal(normDate("2026-10-09"), "2026-10-09");
  assert.equal(normDate("20261009"), "2026-10-09");
  assert.equal(normDate("25/10/2026"), "2026-10-25");
  assert.equal(normDate("nope"), null);
});

test("sugarwodCsvToWorkouts maps the export columns", () => {
  const csv = [
    "date,title,description,best_result_raw,best_result_display,score_type,barbell_lift,set_details,notes,rx_or_scaled,pr",
    '10/09/2026,Fran,"21-15-9\nThrusters 95/65\nPull-ups",245,4:05,Time,,,felt good,RX,true',
    ",,,,,,,,,,",
  ].join("\n");
  const [w, ...rest] = sugarwodCsvToWorkouts(csv);
  assert.equal(rest.length, 0);
  assert.equal(w.date, "2026-10-09");
  assert.equal(w.title, "Fran");
  assert.match(w.text, /Thrusters/);
  assert.equal(w.result, "4:05");
  assert.equal(w.rx, "RX");
  assert.equal(w.pr, true);
  assert.equal(w.done, true);
});

test("sugarwodCsvToWorkouts rejects files that aren't the export", () => {
  assert.throws(() => sugarwodCsvToWorkouts("name,email\nx,y"), /SugarWOD export/);
});

test("toIsoDate understands API-style dates", () => {
  assert.equal(toIsoDate(20261012), "2026-10-12");
  assert.equal(toIsoDate("2026-10-12T00:00:00.000Z"), "2026-10-12");
  assert.equal(toIsoDate({ __type: "Date", iso: "2026-10-12T00:00:00.000Z" }), "2026-10-12");
  assert.equal(toIsoDate(Date.UTC(2026, 9, 12)), "2026-10-12");
  assert.equal(toIsoDate("hello"), null);
});

test("sniffWorkouts finds workouts in nested API responses and ignores comments", () => {
  const body = {
    data: [
      {
        id: "w1",
        attributes: {
          title: "Snatch complex",
          description: "<p>Power snatch + OHS</p><p>5 RFT: 10 wall balls</p>",
          scheduled_date_int: 20261013,
          track: { name: "CrossFit" },
          score_type: "load",
        },
      },
    ],
    comments: [{ text: "Great job!", date: "2026-10-13" }],
  };
  const ws = sniffWorkouts(body);
  assert.equal(ws.length, 1);
  assert.deepEqual(ws[0], {
    date: "2026-10-13",
    title: "Snatch complex",
    text: "Power snatch + OHS\n5 RFT: 10 wall balls",
    source: "sugarwod-whiteboard",
    track: "CrossFit",
    scoreType: "load",
  });
});

test("stripHtml keeps line structure", () => {
  assert.equal(stripHtml("A<br>B<ul><li>C</li></ul>&amp;"), "A\nB- C\n&");
});
