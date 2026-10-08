---
name: motion-video
description: Make a polished motion-graphics video (MP4 with synced sound design) about a topic, website, interactive visualization, dataset, article, paper or repo — explainer trailers, promo teasers, animated data stories, social clips (Reels, Shorts, TikTok), lecture openers, launch videos, "15-second video for X". Use this skill whenever the user asks for a video, motion graphics, an animation to export, a trailer, teaser, reel, explainer clip, or to "turn this page/site/chart/story/dataset into a video", even if they never say "motion graphics". It covers storyboarding from real source material, a deterministic canvas animation engine rendered frame by frame in headless Chromium with motion blur, a numpy-synthesised score timed to on-screen events, ffmpeg encoding, and automatic checks for readability, grey flashes, low end and sync.
---

# Motion video

You produce a finished video file, not a description of one. The approach that works:
a **deterministic canvas film** (one HTML page whose draw functions depend only on time `t`),
rendered **frame by frame in headless Chromium** with sub-frame **motion blur**, a **score
synthesised in numpy** from cue times the film exports (so sound lands on the frame), an
**ffmpeg** encode, and **automatic checks** that measure what reviewers otherwise catch by eye.

Read `references/craft.md` before designing (pacing, text budgets, transitions, data and explainer
rules, pitfalls) and `references/sound.md` before writing the score. `references/example-nobel.md`
is a worked example.

## 0. Check the toolchain

```bash
ffmpeg -version | head -1 && python3 -c "import numpy; print('numpy', numpy.__version__)" && node -v && (node -e "import('playwright')" 2>/dev/null || ls "$(npm root -g)/playwright" >/dev/null) && echo playwright ok
```

You need Node 18+, Playwright with a Chromium build, ffmpeg (5.1+ preferred) with libx264 and AAC,
and Python 3 with numpy. If something is missing, install it (`npm i -g playwright && npx playwright
install chromium`, `pip install numpy`) rather than switching approach. Set `CHROMIUM_PATH` if the
browser lives somewhere unusual. Your first stills run (step 5) is the real browser test.

## 1. Gather the source and its visual system

The video should look like it belongs to its source and say only true things.

- **Source given** (URL, repo, file): read it fully. For a website, screenshot it with Playwright
  and look at the images. Extract colour tokens, fonts, motifs and the **real data**.
- **A kind of source but not which one** ("a public dataset of …"): ask which. If nobody can answer,
  choose a well-documented, openly licensed one, name it in the storyboard and the summary.
- **Data:** never fill a gap with invented or placeholder numbers. If the data cannot be fetched,
  stop and say so. How to get data into the film: `references/craft.md` §5.
- **Source unreachable** (a proxy 403, a login wall): check once (`curl -sSI <url>`). A policy denial
  is final: do not route around it with another fetcher. Ask the user to paste or upload it, or use
  search results (they are summaries: quote figures exactly, confirm each with a second source) and
  authoritative PDFs via `curl` + `pdftotext`. Record which facts rest on search excerpts and say in
  your summary that the page itself was not read.
- **No visual identity of its own** (Wikipedia, a paper, a dataset portal): design a neutral,
  subject-appropriate system; do not imitate the host site's branding.
- **Topic only:** research primary sources; leave out anything you cannot verify.
- Keep a facts list with a source for each; it goes into `NOTES.md`.

## 2. Storyboard

Write a scene table before any code:

| # | Time | Visual (what moves) | On-screen text (≤7 words) | Transition out | Sound |
|---|------|---------------------|---------------------------|----------------|-------|

Seven words take about 2 s to read, which is a whole scene. Budgets (reasons in `craft.md` §1):
- **Scenes:** about 2–2.5 s per headline scene and 3–4 s per data scene (build ~1 s, reading time,
  a ≥0.8 s hold on the key value). 15 s ≈ 6–7 scenes; 20 s ≈ 8 (5–6 if most are data); 30 s ≈ 10–12.
- **Text:** every element, labels included, sharp for at least `0.4 s + words/4.5`; the whole film
  under ~3.5 words per second.
- **Opening and end:** the first second shows motion and the subject. The end card is complete at
  least 1.5 s before the last frame, so it can be read and a looping platform doesn't cut it off.
- **Transitions** come out of the content (zoom into a detail, match a shape, gather into a point,
  morph one chart into the next, one continuous camera). Whip pans are the fallback.
- **Format and venue,** by where it will be posted and how it will be watched:

| Posted as | Size, fps | `VENUE` | Smallest text | Loudness |
|---|---|---|---|---|
| Laptop, TV, website, YouTube | 1920×1080, 60 | `screen` (default) | 15 px | −16 LUFS |
| Lecture or talk (projected) | 1920×1080, 60 | `projector` | 22 px | −16 LUFS |
| 16:9 in a social feed | 1920×1080, 30 | `phone` | 53 px | −14 LUFS |
| Reels, Shorts, TikTok | 1080×1920, 30 | `phone` (automatic) | 30 px | −14 LUFS |

  60 fps keeps camera moves smooth on large screens; feeds play at 30, which also halves render time.
  `VENUE=phone` makes the build use the phone sound profile and −14 LUFS.

Show the storyboard to the user and wait for an OK: it is the cheapest point to change direction.
If they said to go ahead (or nobody can answer), proceed and include it in your summary.

## 3. Scaffold

```bash
SK=<this skill's directory>
mkdir -p video && cp -r "$SK"/scripts/engine/. video/ && chmod +x video/build.sh
python3 "$SK"/scripts/fetch_fonts.py video/fonts "Spectral:ital,wght@0,300;1,300" "IBM Plex Sans:wght@400;500;600" "IBM Plex Mono:wght@400;500"
```

Those are the starters' fonts; swap in the source's. `fetch_fonts.py` reports, per family, the
characters it lacks (pass `--text "…"` to probe your own). If a family fails to load, the film
reports it in the console and a fallback face draws instead.

Two starter films pass every check: `film.html` (16:9, 9 s) and `film-vertical.html` (9:16, 8 s,
phone layout and safe zones built in; build with `FILM=film-vertical.html`). Keep the structure of
the one that matches your format and replace its content, section by section:

1. palette `C`, type `T.*`, `W/H/DUR`, `Film.create`
2. timing table `TM`: every beat lives here, and `film.blur` windows for fast motion
3. precomputed data and simulations
4. one `film.scene(from, to, draw)` per scene (ends at `DUR`, not a typed number)
5. `film.overlay(draw)` for chrome and the flash into the end card
6. `film.cues`: every audible event, plus `transitions` (windows) and `sync` (cues to check)
7. `film.start([font specs])`

## 4. Build the scenes

Engine API (full docs in comments at the top of `engine.js`):

| Helper | Use |
|---|---|
| `M.prog(t,a,b)`, `M.E.*`, `M.bell`, `M.lerp`, `M.clamp` | all animation is `ease(prog(t, start, end))`; gate on `prog > 0`, not on the eased value |
| `M.sim({n,dur,seed,init,step,wrap})` → `.at(i,t)` | swarms, particles, flows: precomputed, interpolated, deterministic |
| `M.rng(seed)`, `M.hash(a,b)` | seeded randomness for precomputation; stateless per-item variation inside draws |
| `M.frameT(t)` | the output frame's own time: compute anything discrete from it (counter values, which label shows) |
| `M.solveTime(f, v, a, b)` | when a moving playhead reaches value v (pop times and their cues) |
| `M.cam.apply / point / zoom / path` | zoom-throughs, push-ins, rotation; `path(keys)` for one-world films |
| `M.flash(ctx, t, at, x, y, {mode, color, r, strength})` | light into the next scene: `'bloom'` (local, tinted) or `'whiteout'` |
| `M.glow`, `M.add(ctx, fn)`, `M.rgba`, `M.mix`, `M.mixRGB` | additive light; colours from `#rrggbb` or `[r,g,b]` |
| `T.eyebrow`, `T.line` | mono kicker that decodes; headline/subline with word reveal, glow, halo, exit |
| `T.callout(ctx, ax, ay, lx, ly, p, title, sub, col, o)` | pointer label; size `T.calloutPx/SubPx` or `o.size/o.subSize` |
| `T.tabular`, `T.label(ctx, s, x, y, font, col, a, align, ls, kind)` | counters; labels. Text that changes as it plays (a rolling date, a name under a playhead) is a counter: `T.tabular` or `kind='number'` |
| `T.arrow`, `T.sup` | drawn arrows and superscripts (web fonts lack them) |

Rules that keep the film renderable and checkable:
- A draw function reads only `t` and precomputed constants: no `Math.random`, `Date`, `fetch`,
  or state carried between frames (frames render out of order on parallel pages).
- Draw all text through `T.*`; that is what the text check measures.
- `film.blur` windows cover anything that moves fast (camera moves, flybys, quick pans).
- The incoming scene's text starts after the outgoing text has finished exiting.
- Width and height must be even.

## 5. Review: where the quality comes from

**Stills.** Look at every scene and inside every transition:
```bash
cd video && node tools/stills.mjs --every 0.5 --sheet sheet.jpg --out stills       # overview, no blur
node tools/stills.mjs --transitions --sheet transitions.jpg --out stills            # 3 moments in each cues.transitions window, with motion blur
node tools/stills.mjs --times 5.6 --crop 1100,200,800,450 --out stills              # zoom into small labels, thin lines, blur copies
```
Read the sheets, then full-size stills of anything doubtful. Look for text overlapping art or text,
hard edges sliding through a transition, shapes that came out black or grey, things appearing
before their beat, fallback-font glyphs, and copies of lines or text in fast motion.

**Checks.** Run them on a quick draft (1 sub-frame, JPEG frames, fast encode; about 40 s for 9 s):
```bash
DRAFT=1 NO_AUDIO=1 ./build.sh /tmp/draft draft.mp4     # add FILM=film-vertical.html, VENUE=… as needed
```
Use `NO_AUDIO=1` until you have written the film's `score.py` (step 6); after that, draft with sound.
The text check reports text not readable long enough or never readable, overlaps, headings that
arrive before the previous ones left, the end-card hold, words per second, sizes and safe zones;
`check.py` adds grey washes, darkness on phones, and (with audio) loudness, low end and sync. Fix
every **high** finding; read medium ones as strong advice.

**Expert read.** For every headline and label: is it true as worded ("must", "always", "scans")?
Soften absolutes your sources qualify. Does each callout's anchor touch the thing it names? Are names
in their proper case (RuvC, Cas9, iPhone)? Is every number you will mention in your summary readable
on screen? Does the animation, not just the text, agree with the sources?

Repeat until stills, checks and the read are clean. Expect several passes.

## 6. Score

Rewrite `video/score.py` for this film (read `references/sound.md`): one layer per kind of on-screen
event, every time read from `cues.json`. `node render.mjs --film film.html --cues-only --frames
/tmp/draft` writes `cues.json` without rendering. The build picks the phone profile from `VENUE` or
a vertical frame. Silent film: `NO_AUDIO=1`.

## 7. Build and verify

```bash
cd video && ./build.sh /tmp/frames film.mp4      # env: FILM VENUE SUB WORKERS CRF FMT LUFS SYNC FROM TO SKIP_RENDER DRAFT NO_AUDIO
```
Frames = FPS × DUR (20 s at 60 fps = 1200). At 150–500 ms each, plus 3–4× inside `film.blur`
windows, expect 3–10 minutes; PNG frames are ~2.2 MB each (check free space). In an agent, run the
build in the background or with a long timeout and read the log, which prints an ETA. After a local
fix, re-render only the affected frames (`FROM=150 TO=470 ./build.sh …`) or reuse frames with
`SKIP_RENDER=1`. Keep frames outside the repo.

`build.sh` ends with `tools/check.py`, which writes `<film>-sheet.jpg`, `<film>-transitions.jpg` and
`<film>-spec.png` and reports format, grey washes, loudness, low end for the venue, sync per cue
list and the text check. Look at both sheets, fix high findings, rebuild. You cannot hear the result:
say so, and say what the checks measured.

## 8. Deliver

- If a user is present, send the MP4 and poster with whatever file-delivery tool is available;
  otherwise leave them next to `video/` and say where.
- Save `video/NOTES.md`: the storyboard as built, each on-screen fact or number with its source
  (dataset, version or date, licence), simplifications, and the final check results.
- Summarise: length, format, scenes, what was verified and how, what was not (listening), and
  anything simplified that an expert might question.
- Keep `video/` with the output so the film can be rebuilt. In a git repo, commit it on a branch when
  the user wants it kept.
