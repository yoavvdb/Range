# Range

Your mobility and rehab app, plus automatic SugarWOD sync.

- `site/` is the installable Range app (published on GitHub Pages).
- `sugarwod-sync/` logs in to SugarWOD and reads your gym's whiteboard.
- `.github/workflows/sugarwod-sync.yml` runs that every 3 hours and publishes the result, encrypted, next to the app.

## One-time setup

1. **Secrets:** Settings → Secrets and variables → Actions → New repository secret. Add three:
   - `SUGARWOD_EMAIL`: your SugarWOD login email
   - `SUGARWOD_PASSWORD`: your SugarWOD password
   - `RANGE_SYNC_KEY`: a long passphrase you make up (save it, you'll type it into the app once)
2. **Pages:** Settings → Pages → Source: **GitHub Actions**.
3. **First run:** Actions → SugarWOD sync → Run workflow. When it's green, the app is at `https://<your-username>.github.io/<repo-name>/`.
4. **On your phone:** open that address in Safari → Share → **Add to Home Screen**. Open Range → Training → **Connect** → enter your `RANGE_SYNC_KEY`.

## Privacy

- Your SugarWOD password lives only in GitHub's encrypted secrets. It's never printed or saved to a file.
- The published workout file is encrypted (AES-256-GCM). Without your passphrase it's unreadable, even though the site is public.
- Workflow logs only contain counts.

## If the run says "Nothing was read from the whiteboard"

SugarWOD's pages may differ from what the reader expects. Open an issue or ask Claude to adjust `sugarwod-sync/src/whiteboard.js`.

Automated access may go against SugarWOD's terms of use. This only reads your own account, every 3 hours.
