# Range server

Range for many people. Each person creates an account, connects their own training platform, and the server syncs it every hour. Their workouts, scores and Range data follow them to every device.

## What it does

- **Accounts:** email and password. Passwords are hashed with scrypt, and sessions use an HttpOnly cookie.
- **Connections:** each person connects one or more training platforms (see below). The login details are encrypted with AES-256-GCM using the server's master key, and bound to that person and connection. They're only decrypted in memory while a sync runs.
- **Hourly sync:** every connection syncs about once an hour.
  - Errors back off up to 12 hours.
  - If a platform rejects a login, that connection stops until the person updates it. Retrying a wrong password could get their account locked.
  - New scores trigger a recover reminder by push notification.
- **The app:** the server serves the Range app (`../site`), which detects it is on a Range server and switches to account mode:
  - sign-in screen;
  - Connected platforms (in Training and in Profile);
  - data saved to the account;
  - push reminders without GitHub.
- **Privacy controls:** removing a connection deletes its stored login and synced workouts. Deleting the account deletes everything.

## Platforms

| Platform | How | Status |
|---|---|---|
| SugarWOD (athlete) | The person's own SugarWOD login, read the way their browser would. SugarWOD has no official per-athlete API. | Works. Programming plus your scores. |
| SugarWOD (gym API key) | SugarWOD's official API v2 (beta). The gym owner creates a key under Gym settings → Developer keys. | Works. Programming only; scores aren't in the API yet. |
| HWPO Training | No public API (built on Fitr). | Planned: ask contact@hwpotraining.com for partner access, or add a login-based connector after inspecting the web app with a real account. |
| Wodify | Official API (api.wodify.com, admin-created key, workouts endpoints). | Planned: needs a gym admin key to build against. |
| PushPress | Official API covers members and classes, not workouts. Gyms on PushPress + SugarWOD are covered by SugarWOD. | Not needed for now. |
| WodUp | Public API in private beta, including athlete results. | Planned: needs beta access. |

To add a platform, create `src/connectors/<name>.js` with `{ id, name, kind, available, fields, consent, sync() }` and register it in `src/connectors/index.js`. `sync({ secret, state, options, browser })` returns `{ workouts: [{date, title, text, result?, loggedAt?}], state, info }`. Throw an error with `auth = true` when the platform rejects the login.

## Run it locally

```
cd sugarwod-sync && npm ci && cd ..
ln -s ../sugarwod-sync/node_modules server/node_modules
python3 build/build.py                      # builds the app into site/
export RANGE_MASTER_KEY=$(openssl rand -base64 32)
RANGE_SECURE_COOKIES=0 node --disable-warning=ExperimentalWarning server/src/index.js
# open http://localhost:8080
```

Tests run against a stand-in SugarWOD, so no real accounts are needed: `cd server && npm test`.

## Deploy (Fly.io example)

1. Install flyctl and sign in. Then run `fly launch --copy-config` from the repo root. It uses the `Dockerfile` and `fly.toml`.
2. Create the volume: `fly volumes create range_data --size 1`.
3. Set the secrets:
   - `fly secrets set RANGE_MASTER_KEY="$(openssl rand -base64 32)"`.
     **Back this key up and never change it.** Without it, the stored logins can't be read and everyone would have to reconnect.
   - For push reminders, create keys with `node sugarwod-sync/src/cli.js vapid`, then `fly secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@yourdomain`.
4. Run `fly deploy`, then open `https://<app>.fly.dev`.

Any host that runs a Docker container with a persistent disk works the same way (Render, Railway, a VPS). It needs about 1 GB of RAM for the headless browser. Keep it always on so the hourly syncs run.

## Settings (environment)

| Variable | |
|---|---|
| `RANGE_MASTER_KEY` | **Required.** 32 random bytes, base64. Encrypts connected logins. |
| `PORT` | Default 8080. |
| `RANGE_DB` | SQLite file. Put it on a persistent volume. |
| `RANGE_SITE` | The built app folder. |
| `CHROMIUM_PATH` | Optional Chromium binary. The Docker image has one built in. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Optional push reminders. |
| `RANGE_SECURE_COOKIES` | `0` for plain-HTTP local testing. `always` if your HTTPS proxy doesn't send `x-forwarded-proto`. |

## Before opening it to the public

- **SugarWOD's terms:** logging in as athletes on their behalf isn't something SugarWOD offers, and their terms may not allow it. For a public launch, ask SugarWOD for partner or API access. Their official API is gym-level today, so gyms connecting with a key is the cleanest route.
- **Privacy:** you'll be storing people's logins and training data. You need:
  - a privacy policy and terms;
  - a way to contact you;
  - GDPR basics (export and deletion; deletion is built in).
- **Operations:**
  - Back up the database volume and the master key, separately.
  - Watch the logs for connector failures. A change on SugarWOD's site will break the athlete connector until it's updated.
- **Abuse:** sign-up and login are rate-limited per IP and email. Add email verification and password reset (they need an email service) before inviting strangers.
