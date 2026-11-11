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
| 2026-11-04 | `2026-11-04_fluid-gestures.html` | Fluid gestures: swipes and sheets follow the finger, flicks carry velocity, edges rubber-band; Increase Contrast support | 11cd26e |
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
| 2026-11-06 | `2026-11-06_tour-rebuild.html` | 4-step tour on Today, Rebuild off the Today cards, redesigned first Rebuild page | f4e671e |
| 2026-11-06 | `2026-11-06_rebuild-dashboard.html` | Rebuild program as one dashboard, player shows only instructions, thinner clear-glass tab bar | b341dcd |
| 2026-11-06 | `2026-11-06_rebuild-two-tabs.html` | Rebuild program dashboard split into Today and Progress segments | daa317d |
| 2026-11-06 | `2026-11-06_progress-layout.html` | Rebuild Progress: pain chart, then stages next to a smaller Unlocks card | 53e341f |
| 2026-11-06 | `2026-11-06_back-twist-flows.html` | Lower Back Pain and Twist flows in Daily › Classic Flows | 2d4987b |
| 2026-11-07 | `2026-11-07_demo-fixes.html` | 10 exercise demos fixed after demo QA (cat-cow, side plank thread-through, Pallof press and more); trunk follows the spine curve | 962b24f |
| 2026-11-07 | `2026-11-07_program-signup.html` | Sign-up asks CrossFit athletes their program (RX-Club, FBB…); tour shows how to change it | 5f81c51 |
| 2026-11-07 | `2026-11-07_wall-squat-activation.html` | Wall-facing overhead squat moves from stretches to activation (overhead squat, snatch, thruster, wall ball warm-ups) | 476066f |
| 2026-11-08 | `2026-11-08_exact-time.html` | Sessions last the time you picked (10 min is 10 min) | cd53726 |
| 2026-11-08 | `2026-11-08_equal-sides.html` | One-sided stretches hold equally long on both sides | acabd32 |
| 2026-11-08 | `2026-11-08_goodmorning-activation.html` | Good morning (PVC) moves from stretches to activation | 8e28e68 |
| 2026-11-08 | `2026-11-08_section-times.html` | Section headers show real times (40s, 1:45) instead of rounded minutes | deca9b6 |
| 2026-11-08 | `2026-11-08_describe-pain.html` | Rebuild asks you to describe your pain; it helps pick the protocol | ce1f359 |
| 2026-11-08 | `2026-11-08_rebuild-accuracy.html` | Rebuild protocol choice checked against blind clinical review (51/52); close-call note; better warnings | db2c25f |
| 2026-11-08 | `2026-11-08_login-card.html` | New login page: floating card, plate medallion, button morph and fly-in to the app | 46c67be |
| 2026-11-08 | `2026-11-08_login-reveal.html` | After login the app opens up through the plate instead of fading | 0247343 |
| 2026-11-08 | `2026-11-08_login-reveal-3d.html` | Login reveal shows the 3D figure from the first frame, 0.3 s slower, sharp rim | 6cd53f1 |
| 2026-11-08 | `2026-11-08_login-reveal-smooth.html` | Login reveal runs smoothly (clip and transform animations, 3D held still) | 714d25b |
| 2026-11-08 | `2026-11-08_tab-swipes.html` | Swipe from Profile and Rebuild to the neighbouring tab | 57294b3 |
| 2026-11-08 | `2026-11-08_smooth-swipes.html` | Smoother swipes between tabs and panes; panes follow the finger | f9565f2 |
| 2026-11-11 | `2026-11-11_orbit-home.html` | Today: hovering character with the sessions circling them on a ring; swipe to turn, tap to open with a colour burst; Activate renamed Warm-up | dd5a93b |
| 2026-11-11 | `2026-11-11_stage-rebuild-profile.html` | Rebuild and Profile get the character stage; in Rebuild tap the body where it hurts to pick the program | 8b80296 |
| 2026-11-11 | `2026-11-11_stats-around.html` | Profile stats float around the character; load panel removed; Rebuild is tap-the-body only | 45d7a6e |
| 2026-11-11 | `2026-11-11_precise-spots.html` | Same header on every tab; tapping the body names the exact spot (front/back/inside/outside); glass Equipment and Progress | 15e1a22 |
| 2026-11-11 | `2026-11-11_one-stage.html` | One stage behind Today, Rebuild and Profile: the character stays in place, only the cards around it change | e26a1ef |
| 2026-11-11 | `2026-11-11_bigger-zoom.html` | Larger character just above the stand; Rebuild zooms in on the marker (button or pinch) | f2c6612 |
