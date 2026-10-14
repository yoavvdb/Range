# Range

Your mobility and rehab app, plus automatic SugarWOD sync.

- `site/` is the installable Range app (published on GitHub Pages).
- `sugarwod-sync/` logs in to SugarWOD and reads your gym's whiteboard.
- `.github/workflows/sugarwod-sync.yml` runs that every hour and publishes the result, encrypted, next to the app.

## Range for many people (accounts)

`server/` turns Range into a multi-user app. Each person signs up, connects their own SugarWOD (or a gym's SugarWOD API key), and the server syncs everyone every hour. The same app switches to account mode when the server hosts it. See `server/README.md` for running, deploying (Docker or Fly.io) and what to check before opening it to the public.

## One-time setup

1. **Secrets:** Settings → Secrets and variables → Actions → New repository secret. Add three:
   - `SUGARWOD_EMAIL`: your SugarWOD login email
   - `SUGARWOD_PASSWORD`: your SugarWOD password
   - `RANGE_SYNC_KEY`: a long passphrase you make up (save it, you'll type it into the app once)
2. **Pages:** Settings → Pages → Source: **GitHub Actions**.
3. **First run:** Actions → SugarWOD sync → Run workflow. When it's green, the app is at `https://<your-username>.github.io/<repo-name>/`.
4. **On your phone:** open that address in Safari → Share → **Add to Home Screen**. Open Range → Training → **Connect** → enter your `RANGE_SYNC_KEY`.

## Optional: "time to recover" notifications

When the sync finds a score you just logged, it can push a notification to your phone, even with Range closed.

1. On a computer: `cd sugarwod-sync && npm install && node src/cli.js vapid`. Add the two keys it prints as secrets `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`, then run the workflow once.
2. On your phone, in the installed Range app: Profile → Notifications → turn on **Remind me to recover** → **Connect this phone**. It copies a subscription.
3. Add that text as the secret `PUSH_SUBSCRIPTION`.

On iPhone this needs iOS 16.4 or later and Range opened from the home screen icon. Notifications arrive within an hour of logging a score.

## Privacy

- Your SugarWOD password lives only in GitHub's encrypted secrets. It's never printed or saved to a file.
- The published workout file is encrypted (AES-256-GCM). Without your passphrase it's unreadable, even though the site is public.
- Workflow logs only contain counts.

## If the run says "Nothing was read from the whiteboard"

SugarWOD's pages may differ from what the reader expects. Open an issue or ask Claude to adjust `sugarwod-sync/src/whiteboard.js`.

Automated access may go against SugarWOD's terms of use. This only reads your own account, every hour.

## Demo QA

`qa/render-demos.js` renders every exercise demo in 3D, as the app shows it, into contact sheets. `.claude/agents/demo-qa.md` is a Claude Code agent that reviews those sheets the way a coach would watch a demo video. It flags demos that show the wrong exercise, wrong contact points, impossible joints, or a camera angle that hides the key detail.

To run it, open this repo in Claude Code and ask: "Use the demo-qa agent to check all exercise demos." To check only a few, list their ids, for example `h4,a_sots`.
