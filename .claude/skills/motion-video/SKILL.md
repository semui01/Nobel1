---
name: motion-video
description: Make a polished motion-graphics video (MP4 with synced sound design) about a topic, website, interactive visualization, dataset, article, paper or repo — explainer trailers, promo teasers, animated data stories, social clips, launch videos, "15-second video for X". Use this skill whenever the user asks for a video, motion graphics, an animation to export, a trailer, teaser, reel, explainer clip, or to "turn this page/site/chart/story into a video", even if they never say "motion graphics". It covers storyboarding from real source material, a deterministic canvas animation engine rendered frame by frame in headless Chromium with motion blur, a numpy-synthesised score timed to on-screen events, ffmpeg encoding and numeric quality checks.
---

# Motion video

You produce a finished video file, not a description of one. The approach that works:
a **deterministic canvas film** (one HTML page whose draw functions depend only on time `t`),
rendered **frame by frame in headless Chromium** with sub-frame **motion blur**, a **score
synthesised in numpy** from cue times the film exports (so sound lands on the frame), and an
**ffmpeg** encode followed by numeric checks. Everything you need is in `scripts/`.

Read `references/craft.md` before designing scenes — it holds the transition recipes, layout
numbers and the pitfalls that cost the most time. Read `references/sound.md` before writing the
score. `references/example-nobel.md` is a complete worked example (15 s, seven scenes).

## 0. Check the toolchain

```bash
node -v && (node -e "import('playwright')" 2>/dev/null || ls "$(npm root -g)/playwright") && ffmpeg -version | head -1 && python3 -c "import numpy; print('numpy', numpy.__version__)"
```

You need Node 18+, Playwright with a Chromium build (set `CHROMIUM_PATH` if it lives somewhere
unusual), ffmpeg with libx264 and AAC, and Python 3 with numpy. If something is missing, say so and
install it (`npm i -g playwright`, `pip install numpy`) rather than switching approach.

## 1. Gather the source and its visual system

The video should look like it belongs to its source and say only true things.

- **Source given** (URL, repo, file): read it fully. For a website, screenshot it with Playwright
  (hero plus each major section) and look at the images. Extract colour tokens (CSS custom
  properties), font families and weights, recurring motifs, and the **real data** (arrays, tables,
  numbers). Reuse that data in the film rather than retyping it.
- **Topic only**: research it (web search, primary sources) and keep a short facts list with a
  source for each. If you cannot verify a claim, leave it out of the film.
- Note what the film must end on: title, credit line, URL or call to action.

## 2. Storyboard

Write a scene table before any code:

| # | Time | Visual (what moves) | On-screen text (≤7-word headline) | Transition out | Sound |
|---|------|---------------------|-----------------------------------|----------------|-------|

Rules of thumb (reasons in `references/craft.md`):
- About **2–2.5 s per scene**; a 15 s film holds 5–7 scenes. One idea and one headline per scene.
- The **first 1.5 s** must show motion and the subject, not a logo. The **last 2.5 s** are the end
  card (title, credits, link) and should hold still long enough to read.
- Every transition should come **out of the content**: zoom into a detail, match-cut a shape into
  the next scene's shape, gather elements into a point that becomes the next scene's light source,
  pull back out to a map. Whip pans are the fallback, not the default.
- Decide the **aspect ratio now** (16:9 1920×1080, 9:16 1080×1920, 1:1 1080×1080). Layouts do not
  survive cropping.

Show the storyboard to the user and wait for an OK — it is the cheapest point to change direction.
If they already said to just go ahead (or nobody is available to answer), proceed and include the
storyboard in your final summary.

## 3. Scaffold

```bash
SK=<this skill's directory>
mkdir -p video && cp -r "$SK"/scripts/engine/. video/ && chmod +x video/build.sh
python3 "$SK"/scripts/fetch_fonts.py video/fonts "Family:ital,wght@0,300;1,300" "Other Family:wght@400;500"
```

`fetch_fonts.py` writes `video/fonts/fonts.css` (already linked by `film.html`) and lists
characters the fonts do not contain. Then open `video/film.html`: it is a working 9-second starter
film that demonstrates every core pattern. Keep its structure, replace its scenes:

1. palette `C` and type tokens `T.DISP/BODY/MONO` from the source,
2. `Film.create({W, H, FPS, DUR, bg})`,
3. a master timing table `TM` (every beat in one place, so retiming is one edit),
4. precomputed data and simulations (`M.sim`),
5. `film.scene(from, to, draw)` per scene and `film.overlay(draw)` for chrome and flashes,
6. `film.cues = {...}` — every audible event in film seconds,
7. `film.start([font specs])`.

## 4. Build the scenes

Engine API (full docs in comments at the top of `engine.js`):

| Helper | Use |
|---|---|
| `M.prog(t,a,b)`, `M.E.*` easings, `M.bell`, `M.lerp`, `M.clamp` | all animation is `ease(prog(t, start, end))` |
| `M.sim({n,dur,seed,init,step,wrap})` → `.at(i,t)` | swarms, particles, flows: precomputed, interpolated, deterministic |
| `M.hash(a,b)` | per-item variation inside draw functions (never `Math.random`) |
| `M.solveTime(f, v, a, b)` | when does a moving playhead reach item v? (for pops and their cues) |
| `M.cam.apply / point / zoom` | camera: zoom-throughs, push-ins, rotation |
| `M.glow`, `M.add(ctx, fn)` | soft additive light |
| `M.rgba`, `M.mix`, `M.mixRGB` | colours from `#rrggbb` or `[r,g,b]` |
| `T.eyebrow` | mono kicker that decodes from scrambled glyphs |
| `T.line` | headline/subline: words rise in with blur; glow, halo, exit |
| `T.callout` | anchor dot + drawn leader + label: point at a detail |
| `T.tabular`, `T.label`, `T.arrow`, `T.sup` | jitter-free counters, plain labels, drawn arrows and superscripts |

Conventions that keep the film renderable:
- A draw function may read only `t` and precomputed constants. No `Math.random`, `Date`,
  `performance.now`, or state mutated between frames — frames render out of order on parallel pages.
- Simulations run once at load (`M.sim`) and are sampled by time.
- Scenes overlap for crossfades; set `ctx.globalAlpha` from `prog()` at both ends.
- Typical sizes at 1080p: headline 64–120 px display face, subline 26–30 px, eyebrow 20–22 px mono
  with 0.14 em tracking, labels ≥15 px. Side margins 140 px.

## 5. Review with stills (the step that makes it good)

```bash
cd video && node tools/stills.mjs --every 0.5 --sheet sheet.jpg --out stills
node tools/stills.mjs --times 2.62,2.7,2.76 --sheet transitions.jpg --out stills   # zoom into any moment
```

Look at the sheet image, then at full-size stills of anything doubtful. Check every scene **and
every transition** (sample 3–4 times inside each one). What to look for, in the order it usually
goes wrong:
1. text overlapping artwork or other text; anything crossing a headline;
2. hard edges sliding through a transition (a background rectangle's border, a membrane that ends);
3. colours that came out black or grey (a colour helper fed the wrong format);
4. flashes and washes that go muddy at partial opacity;
5. elements appearing before their beat (eased values that are not exactly 0 at the start);
6. glyphs in a fallback font (arrows, superscripts, Greek);
7. headlines that are not fully readable for at least ~0.8 s.

Fix, re-render the stills, look again. Do several passes; most of the quality comes from here.
The live preview (`open video/film.html`: space plays/pauses, arrows step frames) is for you or the
user to scrub; the stills are what you can actually see.

## 6. Score

Rewrite `video/score.py` for this film (read `references/sound.md`). One layer per kind of
on-screen event, every time taken from `cues.json`. `sound.py` provides instruments (bell,
mallet, pop, tick, whoosh, whip, riser, boom, pad chords with brightness automation) and a `Score`
mixer with reverb and mastering. If the user wants a silent film, run the build with `NO_AUDIO=1`.

## 7. Build and verify

```bash
cd video && ./build.sh frames film.mp4          # env: SUB=4 WORKERS=4 CRF=15 FILM=film.html NO_AUDIO=1 LUFS=-16
```

This renders all frames (expect ~150 ms per 1080p frame with 4 workers and 4 sub-frames, so ~2–3
minutes for 15 s at 60 fps), synthesises and loudness-normalises the score to −16 LUFS, encodes
H.264, writes `film-poster.png` (last frame) and runs `tools/check.py`, which reports format,
loudness and A/V sync and writes `film-sheet.jpg` sampled from the encoded file. Look at that
sheet. Put frames in a scratch directory if disk or git cleanliness matters
(`./build.sh /tmp/frames film.mp4`); 900 PNG frames are about 2–3 GB.

You cannot hear the result. Verify the mix numerically (check.py, a spectrogram as in
`references/sound.md`) and tell the user plainly that they should listen to it.

## 8. Deliver

- Send the MP4 (and the poster) to the user with whatever file-delivery tool is available.
- Summarise: the scene-by-scene storyboard as built, length/format, what you verified and how,
  and what you could not verify (sound by ear).
- Keep `video/` (film.html, engine, score.py, build.sh, fonts) with the output so the film can be
  rebuilt or edited later. In a git repo, commit it on a branch when the user wants it kept.
