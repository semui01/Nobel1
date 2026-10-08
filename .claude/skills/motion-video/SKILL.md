---
name: motion-video
description: Make a polished motion-graphics video (MP4 with synced sound design) about a topic, website, interactive visualization, dataset, article, paper or repo — explainer trailers, promo teasers, animated data stories, social clips (Reels, Shorts, TikTok), lecture openers, launch videos, "15-second video for X". Use this skill whenever the user asks for a video, motion graphics, an animation to export, a trailer, teaser, reel, explainer clip, or to "turn this page/site/chart/story into a video", even if they never say "motion graphics". It covers storyboarding from real source material, a deterministic canvas animation engine rendered frame by frame in headless Chromium with motion blur, a numpy-synthesised score timed to on-screen events, ffmpeg encoding, and automatic checks for readability, grey flashes, low-end and sync.
---

# Motion video

You produce a finished video file, not a description of one. The approach that works:
a **deterministic canvas film** (one HTML page whose draw functions depend only on time `t`),
rendered **frame by frame in headless Chromium** with sub-frame **motion blur**, a **score
synthesised in numpy** from cue times the film exports (so sound lands on the frame), an
**ffmpeg** encode, and **automatic checks** that measure what reviewers otherwise catch by eye.

Read `references/craft.md` before designing scenes: it has the pacing and text budgets, the
transition recipes and the pitfalls table. Read `references/sound.md` before writing the score.
`references/example-nobel.md` is a complete worked example (15 s, seven scenes).

## 0. Check the toolchain

```bash
ffmpeg -version | head -1 && python3 -c "import numpy; print('numpy', numpy.__version__)" && node -v && (node -e "import('playwright')" 2>/dev/null || ls "$(npm root -g)/playwright" >/dev/null) && echo playwright ok
```

You need Node 18+, Playwright with a Chromium build (set `CHROMIUM_PATH` if it is somewhere
unusual), ffmpeg with libx264 and AAC, and Python 3 with numpy. Your first stills run (step 5)
is the real browser test. If something is missing, install it (`npm i -g playwright`,
`pip install numpy`) rather than switching approach.

## 1. Gather the source and its visual system

The video should look like it belongs to its source and say only true things.

- **Source given** (URL, repo, file): read it fully. For a website, screenshot it with Playwright
  (hero plus each major section) and look at the images. Extract colour tokens (CSS custom
  properties), fonts, recurring motifs and the **real data**; reuse that data rather than retyping it.
- **Source unreachable** (a 403 from a proxy, a login wall): check once (`curl -sSI <url>`; in a
  sandbox also `curl -sS "$HTTPS_PROXY/__agentproxy/status"`). If the user is around, ask them to
  paste or upload it. Otherwise search for it (restricted to its domain where possible), confirm each
  fact with a second source, note which facts came only from search snippets, and say plainly in
  your summary that the page itself was not read.
- **Source with no visual identity of its own** (Wikipedia, a paper, a plain README): design a
  neutral, subject-appropriate system yourself (dark navy or deep space for science, for example);
  do not imitate the host site's branding.
- **Topic only**: research it from primary sources and keep a facts list with a source for each.
  Leave out anything you cannot verify.
- Keep the facts list; you will hand it over with the video.

## 2. Storyboard

Write a scene table before any code:

| # | Time | Visual (what moves) | On-screen text (≤7-word headline) | Transition out | Sound |
|---|------|---------------------|-----------------------------------|----------------|-------|

Budgets that keep it watchable (reasons and recipes in `references/craft.md`):
- About **2–2.5 s per scene**; 15 s holds 5–7 scenes. One idea and one headline per scene.
- **Text:** every text element, labels included, must be sharp for at least `0.4 s + words/4.5`.
  Keep the **whole film under ~3.5 words per second** (a 12 s film: ~40 words, not 150). Cut
  secondary labels before you shorten hold times.
- **First 1.5 s** shows motion and the subject. The **end card** is complete at least **1.5 s
  before the last frame**.
- Transitions come **out of the content**: zoom into a detail, match a shape, gather elements into
  a point, pull back to a map, or one continuous camera through a single world. Whip pans are the
  fallback.
- **Format and venue now:** 16:9 1920×1080 for screens and projection; 9:16 1080×1920 for
  Reels/Shorts/TikTok (text ≥30 px, out of the top 11% and bottom 20%, at most ~4 text elements per
  scene; 30 fps is enough since the apps play at 30); 1:1 1080×1080. Layouts do not survive cropping.
- **Explainers:** keep the actor the headline names visible while it acts, make the *motion* agree
  with the science (not just the captions), make the key event big enough to read from the back of a
  room, and end on the outcome the labels claim.

Show the storyboard to the user and wait for an OK; it is the cheapest point to change direction.
If they said to go ahead (or nobody can answer), proceed and include it in your summary.

## 3. Scaffold

```bash
SK=<this skill's directory>
mkdir -p video && cp -r "$SK"/scripts/engine/. video/ && chmod +x video/build.sh
python3 "$SK"/scripts/fetch_fonts.py video/fonts "Family:ital,wght@0,300;1,300" "Other Family:wght@400;500"
```

`fetch_fonts.py` writes `video/fonts/fonts.css` (already linked by `film.html`) and lists glyphs the
fonts lack. `video/film.html` is a working 9-second starter film that passes every check; keep its
structure and replace its scenes:

1. palette `C` and type tokens `T.DISP/BODY/MONO`,
2. `Film.create({W, H, FPS, DUR, bg})`,
3. a master timing table `TM` (every beat in one place),
4. precomputed data and simulations (`M.sim`),
5. `film.scene(from, to, draw)` per scene, `film.overlay(draw)` for chrome and flashes,
6. `film.blur = [[t0, t1, 12], ...]` for fast camera moves,
7. `film.cues = {...}`: every audible event in film seconds, plus `transitions: [[t0, t1], ...]`,
8. `film.start([font specs])`.

## 4. Build the scenes

Engine API (full docs in comments at the top of `engine.js`):

| Helper | Use |
|---|---|
| `M.prog(t,a,b)`, `M.E.*`, `M.bell`, `M.lerp`, `M.clamp` | all animation is `ease(prog(t, start, end))`; gate on `prog > 0`, not on the eased value |
| `M.sim({n,dur,seed,init,step,wrap})` → `.at(i,t)` | swarms, particles, flows: precomputed, interpolated, deterministic |
| `M.hash(a,b)` | per-item variation inside draw functions (never `Math.random`) |
| `M.solveTime(f, v, a, b)` | when a moving playhead reaches item v (for pops and their cues) |
| `M.cam.apply / point / zoom / path` | zoom-throughs, push-ins, rotation; `path(keys)` for one-world films |
| `M.flash(ctx, t, at, x, y, {mode})` | transition light: `'bloom'` (local, default) or `'whiteout'` |
| `M.glow`, `M.add(ctx, fn)`, `M.rgba`, `M.mix`, `M.mixRGB` | additive light; colours from `#rrggbb` or `[r,g,b]` |
| `T.eyebrow`, `T.line`, `T.callout` | mono kicker; headline/subline with word reveal, glow, halo, exit; pointer labels |
| `T.tabular`, `T.label`, `T.arrow`, `T.sup` | jitter-free counters, labels, drawn arrows and superscripts |

Rules that keep the film renderable and checkable:
- A draw function reads only `t` and precomputed constants: no `Math.random`, `Date`,
  `performance.now`, or state carried between frames (frames render out of order on parallel pages).
- Draw all text through `T.*`: that is what the text check measures.
- Scenes overlap for crossfades; the incoming scene's text starts only after the outgoing text has
  finished exiting.
- Sizes at 1080p screen: headline 64–120 px, subline 26–30 px, eyebrow 20–22 px mono, labels ≥15 px
  (≥22 px for projection). Side margins 140 px.

## 5. Review (where the quality comes from)

**Look at stills.** Check every scene and 3–4 moments inside every transition:
```bash
cd video && node tools/stills.mjs --every 0.5 --sheet sheet.jpg --out stills
node tools/stills.mjs --times 2.62,2.7,2.76 --sheet transitions.jpg --out stills
node tools/stills.mjs --times 5.6 --crop 1100,200,800,450 --out stills     # small labels, thin lines, blur copies
```
Read the sheets, then full-size stills of anything doubtful. Look for: text overlapping art or text;
hard edges sliding through a transition; shapes that came out black or grey; washes that go
grey; things appearing before their beat; fallback-font glyphs; thin lines or text duplicated into
separate copies in fast moves (raise `film.blur` there).

**Measure the text** with a quick draft render (about 30 s for 12 s of film):
```bash
node render.mjs --frames /tmp/draft --sub 1 --fmt jpeg && python3 tools/textcheck.py /tmp/draft/text.jsonl /tmp/draft/cues.json
```
It reports every text element that is not readable long enough, overlapping text, the end-card hold,
the words per second, sizes and safe zones. Fix what it marks **high**; treat medium as advice.
Repeat stills and checks until both are clean. Expect several passes.

## 6. Score

Rewrite `video/score.py` for this film (read `references/sound.md`). One layer per kind of on-screen
event, every time read from `cues.json` (`node render.mjs --cues-only --frames /tmp/draft` writes it
without rendering). Use `Score(dur, profile='phone')` for social video. Silent film: `NO_AUDIO=1`.

## 7. Build and verify

```bash
cd video && ./build.sh /tmp/frames film.mp4    # env: SUB WORKERS CRF LUFS FROM TO SKIP_RENDER SYNC VENUE NO_AUDIO
```
Rendering takes 150–500 ms per 1080p frame depending on cores, so 900 frames can take 2–8 minutes:
in an agent, run it in the background (or with a long timeout) and poll the log, which prints ETA.
After a local fix, re-render only the affected frames (`FROM=150 TO=470 ./build.sh ...`) or reuse
frames (`SKIP_RENDER=1`). Frames are ~2.5 MB each; keep them outside the repo.

`build.sh` ends by running `tools/check.py`, which writes `film-sheet.jpg`, `film-transitions.jpg`
and `film-spec.png` and reports: format; **grey washes** (frames where the picture lifts to grey with
little colour); loudness; **low-frequency energy** for the venue; **sync** per cue list; and the text
check. Look at both sheets and the spectrogram, fix high findings, and rebuild.

You cannot hear the result. Say so, and tell the user what the checks measured.

## 8. Deliver

- Send the MP4 and poster with whatever file-delivery tool is available.
- Save `video/NOTES.md`: the storyboard as built, each on-screen fact with its source, and the
  check results with anything still open.
- Summarise for the user: length, format, scenes, what was verified and how, what was not (listening),
  and anything simplified for clarity that an expert might question.
- Keep `video/` with the output so the film can be rebuilt or edited. In a git repo, commit it on a
  branch when the user wants it kept.
