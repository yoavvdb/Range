# Range versions

Each release has a full copy of the app in `versions/`. Restore any one:

```
cp versions/<file>.html site/index.html
git add site/index.html && git commit -m "Restore <file>" && git push
```

GitHub Pages serves it again within a minute or two. The app source lives outside this repo, so a restore only changes the live site; tell Claude which version you restored so the next change starts from it.

| Date | File | What changed | Commit |
|---|---|---|---|
| 2026-10-29 | `2026-10-29_before-design.html` | Last version before the redesign (teal on blue-black, Training tab) | 6191e81 |
| 2026-10-30 | `2026-10-30_design-plates.html` | Design pass: bumper-plate flow cards, chalk buttons, warm graphite | 6d4e80f |
| 2026-10-30 | `2026-10-30_clean-fewer-words.html` | Fewer words: no workout list on sessions, short Training | 73ae413 |
| 2026-10-30 | `2026-10-30_no-training-tab.html` | Training tab removed; 3-day load and SugarWOD moved to Profile; app updates itself when reopened | 89d1804 |
| 2026-10-30 | `2026-10-30_native-feel.html` | Native feel: sheets slide up and drag down to close, press feedback, screen slides, player rises, 16px inputs (no zoom), 11pt tab labels, status bar colour | 56097b3 |
| 2026-10-30 | `2026-10-30_steps-back.html` | Every routine asks time, then gear, then shows the exercises (auto-skip removed) | 8ba6829 |
| 2026-10-30 | `2026-10-30_warmup-for-line.html` | Session header: "Warm-up for …" / "Release after …" | cb5206e |
| 2026-10-30 | `2026-10-30_clean-home-glass-bar.html` | Today = plates + Anytime flows only, streak flame top-right, glass tab bar with sliding lens | 9d540f1 |
| 2026-10-30 | `2026-10-30_swipes-step-back.html` | Swipe between tabs and swipe right to go back; Back in a routine steps one screen back | 6e87eb0 |
| 2026-10-30 | `2026-10-30_public-feed.html` | Workouts from the gym's public feed (RX-Club), login sync removed; Activate/Recover start on a movements screen | 02f1dbc |
| 2026-10-30 | `2026-10-30_daily-hub.html` | Home = tall cards only; Daily screen (Personalized, Per body zone, Classic flows); full-page slides; score counts up | e4518b0 |
| 2026-10-30 | `2026-10-30_library-card.html` | Library is a card on Today instead of a tab (3 tabs: Today, Rebuild, Profile) | f9c36a4 |
| 2026-10-30 | `2026-10-30_fitribe-colors.html` | Fitribe colours: coal, bone, amber, ember/orange/tan/sand cards | e6306f0 |
| 2026-10-31 | `2026-10-31_no-saved-moves.html` | Fix: movements aren't saved between sessions; rest day opens an empty movements screen | 5adadfb |
| 2026-10-31 | `2026-10-31_strength-last.html` | Strength and activation come last, after every area is warmed up | 3ed256e |
| 2026-10-31 | `2026-10-31_profile-dashboard.html` | Profile = name + program switch, Dashboard / Equipment / Progress slides, settings behind the gear, history removed | 4a479f9 |
| 2026-10-31 | `2026-10-31_progress-chart.html` | Progress shows mobility tests as a line chart (overall or per area) | cae5bbe |
| 2026-10-31 | `2026-10-31_week-by-area.html` | Week by area sums to the weekly minutes; one colour scale across score, bars and chart | 0d4aafd |
| 2026-10-31 | `2026-10-31_track-switch.html` | Track switch replaces workouts instantly for Activate and Recover | 0251911 |
| 2026-10-31 | `2026-10-31_rest-day-empty.html` | Rest day opens Activate empty (no jump ahead) | e29215e |
| 2026-10-31 | `2026-10-31_today-only.html` | Activate uses only today's workout; rest day or nothing posted opens empty | 52da827 |
| 2026-10-31 | `2026-10-31_rebuild-dashboard.html` | Rebuild = dashboard with Today / Program / Progress slides and a pain chart | ee19597 |
| 2026-10-31 | `2026-10-31_ios-shell.html` | Adds ios-app/ (native iOS shell for the Simulator); web app reads the feed from the web inside it | 7511db2 |
| 2026-11-05 | `2026-11-05_launch-reveal.html` | Today opens on the first card with a one-line greeting (no jump); blueprint logo reveal on the launch screen | 98e6d72 |
| 2026-11-05 | `2026-11-05_opens-on-today.html` | Opens on Today; a half-done mobility test waits behind Resume my test instead of reopening | 4ab5849 |
| 2026-11-05 | `2026-11-05_apple-google-login.html` | Continue with Apple / Google on the front page (web and iOS app) | 78a66f7 |
| 2026-11-05 | `2026-11-05_ios-review-fixes.html` | Activate opens centred (looping cards), 44pt targets, small-phone layout, Dynamic Type, wordmark only on Today, honest Profile before the test | 68f490f |
| 2026-11-05 | `2026-11-05_circular-today.html` | Today cards go round and round in both directions | 1f9e2cd |
| 2026-11-05 | `2026-11-05_smooth-loop.html` | Today loop stays smooth across a new lap, even with quick swipes | bf869b8 |
| 2026-11-05 | `2026-11-05_sign-out-button.html` | Sign out button top left on Today, with a confirmation sheet | ae75920 |
| 2026-11-05 | `2026-11-05_apple-title-case.html` | Apple title-style capitalization for buttons, titles, tabs and names | 56fe84b |
| 2026-11-06 | `2026-11-06_lifter-protocol.html` | Lifter protocol: readiness check, Raise first, bottom-up mobilise, ramp sets and primers after Activate, breathing and recovery tips after Recover | 22ffe17 |
| 2026-11-06 | `2026-11-06_liquid-glass.html` | Liquid Glass bars, buttons, sheets and player controls; no ramp-set card or closing breathing | dc17b53 |
| 2026-11-06 | `2026-11-06_sore-areas.html` | Anything sore? step (pick areas) replaces the readiness check; between-movement primers removed | e3938ff |
| 2026-11-06 | `2026-11-06_no-double-hinge.html` | Hip hinge drill and Active hinge never in the same session; one exercise per family everywhere | cbfcb33 |
