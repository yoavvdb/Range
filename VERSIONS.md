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
