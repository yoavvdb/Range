# sugarwod-sync

Gets your SugarWOD training into the **Range** mobility app and into **Claude**, so your stretching is planned around what you did yesterday and what's on the whiteboard tomorrow.

It uses two sources, both through your own account:

| What | Where it comes from |
| --- | --- |
| **Your logged history** (results, PRs) | SugarWOD's official **Export Workouts** CSV |
| **Your gym's whiteboard** (past few days and upcoming) | app.sugarwod.com, read in a browser you log into yourself |

Your password is only ever typed into SugarWOD's own login page. This tool never sees or stores it. It saves the browser session (cookies) in `~/.sugarwod-sync/`, readable only by you.

## Setup (once)

Needs Node.js 18.17 or later.

```bash
cd sugarwod-sync
npm install
npx playwright install chromium
node src/cli.js login
```

`login` opens a browser window on SugarWOD. Log in as normal, wait until you see your gym's whiteboard, then press Enter in the terminal.

To use the short `sugarwod-sync` command everywhere, run `npm link` once in this folder.

## Everyday use

```bash
sugarwod-sync sync                 # whiteboard: 3 days back, 7 days ahead
sugarwod-sync export               # writes ~/.sugarwod-sync/range-training.json
```

Then in Range: **Training → Import → Choose a file** and pick `range-training.json`.

### Your logged history

1. On app.sugarwod.com, open your profile and click **Export Workouts**.
2. SugarWOD emails you `workouts.csv`.
3. Import it into Range directly (**Training → Import**), and/or into this tool so Claude can see it:

```bash
sugarwod-sync import-csv ~/Downloads/workouts.csv
```

If your gym uses kilos, note that SugarWOD's export reports weights in pounds.

## Use it from Claude (MCP)

**Claude Code:**

```bash
claude mcp add sugarwod -- node /full/path/to/sugarwod-sync/src/cli.js mcp
```

**Claude Desktop:** add this to `claude_desktop_config.json` and restart:

```json
{
  "mcpServers": {
    "sugarwod": {
      "command": "node",
      "args": ["/full/path/to/sugarwod-sync/src/cli.js", "mcp"]
    }
  }
}
```

Tools Claude gets:

| Tool | What it does |
| --- | --- |
| `sugarwod_upcoming` | Whiteboard for today and the next N days |
| `sugarwod_history` | Workouts and your results from the last N days |
| `sugarwod_workouts` | Everything between two dates |
| `sugarwod_sync` | Refresh the whiteboard (about 3 seconds per day) |
| `sugarwod_import_csv` | Import the SugarWOD history export |
| `sugarwod_export_for_range` | Write the file Range imports |

Try asking: *"What's on my whiteboard this week, and what should I stretch tonight given what I did yesterday?"*

## If `sync` finds nothing

`sync` opens your whiteboard one day at a time and picks the workouts out of the data SugarWOD's web app loads. It hasn't been tested against the live SugarWOD site yet, only against a stand-in. If it reports nothing for days that clearly have workouts:

1. Run `sugarwod-sync watch`. A browser opens on your whiteboard; click through the days yourself and press Enter when done. Every workout the site loads is saved.
2. Run `sugarwod-sync sync --headed --debug ./debug` to watch what happens and save what the site returned. The debug files contain your gym's programming, so only share them if you're comfortable with that. They're enough to adjust the tool to the real site.

If you get "You're not logged in", run `sugarwod-sync login` again.

## Good manners

- This reads only what your own account can already see, at human pace: one page every few seconds, a couple of weeks at a time.
- Automated access may go against SugarWOD's terms of use. Use it for your own data, don't run it on a tight schedule, and stop if SugarWOD asks you to.
- If your gym owner creates a key on SugarWOD's official API (Settings → Developer keys), that's the sanctioned route for gym programming and can replace the whiteboard reader.

## Development

```bash
npm test
```

Unit tests cover the CSV and whiteboard parsing. The end-to-end test runs the login check, the whiteboard reader and every MCP tool against a fake SugarWOD site. Set `SUGARWOD_CHROMIUM_PATH` if Playwright's own Chromium isn't installed.
