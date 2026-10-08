# Craft notes for motion videos

Contents: 1 Pacing and text budget · 2 Visual system · 3 Transitions (recipes) · 4 One-world films ·
5 Data scenes · 6 Explainers · 7 Simulations · 8 Polish and motion blur · 9 Pitfalls ·
10 Performance · 11 Other formats and venues

## 1. Pacing and text budget

- Display text is read at roughly 4–5 words per second once it is sharp. The text check requires
  each element to be fully sharp for `0.4 s + words / 4.5` (a 6-word headline: 1.7 s; a 2-word label:
  0.85 s). A callout's text fades in from 45% of its progress and is sharp at 100%; schedule its fade
  at least `0.4 s + words/4.5` after its progress reaches 1.
- Keep the whole film under ~3.5 words per second, labels included. Tested films that failed this
  carried 12 words per second; every reviewer flagged it. Cut secondary labels, footnotes and
  citations first (citations belong in the notes file and the post, not on screen), then shorten
  sublines; do not shorten hold times.
- Scene budget: 0.3 s reveal, the readable hold, the visual payoff, then exit text 0.2–0.3 s before
  the transition. The next scene's text starts only after the previous text has finished exiting
  (overlapping eyebrows decode into garbage).
- About 2–2.5 s per headline scene and 3–4 s per data scene (build ~1 s, reading time, ≥0.8 s hold
  on the key value). 15 s ≈ 6–7 scenes; 20 s ≈ 8 (5–6 if most are data); 30 s ≈ 10–12. If the story
  has more beats than time, merge them into a montage (the Nobel film shows three brain-circuit
  findings in 1.1 s by lighting regions in turn with a sidebar list).
- For teasers over ~15 s, a pulse helps: lay beats on a tempo grid (120 BPM = 0.5 s) and build `TM`
  from it so cuts and hits land on beats (see sound.md).
- Open on motion and the subject. End on a card that is complete ≥1.5 s before the last frame, with
  a slow push-in (scale 1 → 1.02) so it is not dead.
- Let one element carry across each cut (a point of light, a shape, a line). Continuity is what makes
  seven scenes feel like one film.

## 2. Visual system

- Take colour tokens, fonts and motifs from the source. Give each colour one meaning and keep it (in
  the Nobel film blue = light/activation, amber = silencing, green = algae, gold = recognition), and
  keep meaning colours out of the decorative palette (a teal that marks one element is diluted if the
  base strands are cyan).
- Callout anchors touch the thing they name, not a neighbour. Proper names keep their casing (RuvC,
  Cas9) even in uppercase label styles.
- Layout at 1080p: 140 px side margins; eyebrow at y≈120–150; headline baseline 80–100 px below.
  The starters' house style is a light (300) display face at 64–120 px with one emphasised word in
  italic and the accent colour; take weight and emphasis from the source when it has its own.
- Legibility over moving artwork, in order of preference: compose so artwork avoids the text block;
  a scrim (background-colour gradient from the text side, alpha ~0.85 → 0); fade the crossing element
  out before it reaches the text; `T.line(..., {halo: C.bg})`.
- Thin line art at 40–60% alpha on near-black washes out on projectors and phones in daylight. Keep
  essential lines ≥2 px and ≥70% alpha, and small text at ≥4.5:1 contrast.

## 3. Transitions (recipes)

All are pure functions of `t`, so they render identically on any frame.

**Zoom-through (into a detail, out the other side into the next scene).**
```js
const p = prog(t, Z0, Z1), s = M.cam.zoom(250, p, E.inCubic);   // 1 → 250×, accelerating
const f = focusPoint(t), e = E.inOutCubic(prog(t, Z0, Z0 + .8));
const c = {fx: f.x, fy: f.y, s, ax: lerp(f.x, 960, e), ay: lerp(f.y, 640, e), rot: -angle * E.inOutCubic(p)};
M.cam.apply(ctx, c);  // draw the world; line widths = px / s
```
Fade fills and other objects as `s` grows, keep the outline you dive into, and land the camera so
the next scene's main shape sits exactly where the zoom ends. Start the next scene at scale ~1.3
easing to 1 so momentum continues. Finish the zoom before crossfading (~0.25 s); a crossfade at
mid-zoom is clutter. Add `film.blur` over the zoom window.

**Zoom-out into a map (shared transform).** Scene A (detail at S) and scene B (map, region R):
```js
const p = E.inOutCubic(prog(t, A, B)), Z = Math.exp(Math.log(ZEND) * p);    // ZEND ≈ .03
const ax = lerp(S.x, R.x, p), ay = lerp(S.y, R.y, p);
// A: translate(ax,ay) scale(Z) translate(-S)        B: translate(ax,ay) scale(Z/ZEND) translate(-R)
```

**Gather into a point.** Each element flies on a quadratic Bézier with an accelerating ease and a
staggered start (`hash` per item), shrinking and whitening; the arrival point becomes the next
scene's light source.

**Whip pan (fallback).** One easing for both scenes; fade the outgoing one so its edges never show;
`film.blur` over the window; a stereo whoosh.
```js
const wp = prog(t, W0, W1), pan = E.inOutCubic(wp) * W;
// outgoing: alpha *= 1 - E.inCubic(wp); translate(-pan, 0)   incoming: alpha *= E.outCubic(wp); translate(W - pan, 0)
```

**Light into the end card: `M.flash`.** A full-frame bloom at partial opacity over a dark film reads
as a grey veil (check.py flags it as a grey wash), and a large untinted local bloom as a grey disc.
`M.flash` avoids both:
- `bloom` (default): light tinted with `color` (the halo is the colour mixed toward white, not plain
  white), radius `r` (default 0.32 × frame width), a gaussian-like falloff with no visible disc edge,
  `strength` 0–1. The incoming scene crossfades to opaque underneath by the peak.
- `whiteout`: the frame reaches pure white for 2 frames and falls away exponentially, so the grey
  passage lasts only 2–3 frames and reads as a camera flash.

**Text in and out.** `T.line` words rise with a blur, staggered 0.05–0.08 s; exits rise further.
`T.eyebrow` decodes at ~60 characters per second and shows scrambled glyphs from 0.14 s before its
start, so start it ≥0.15 s after the outgoing text has left (a whip that carries the old text
off-screen is the exception).

## 4. One-world films

When the story is one object (a molecule, a machine, a city), build a single world and move one
camera through it rather than cutting between scenes: zoom in, pan along, pull out, split into lanes.
```js
const camAt = M.cam.path([
  {t: 0,   fx: 960,  fy: 540, s: 1.5},
  {t: 2.7, fx: 1400, fy: 560, s: 4},     // zoom onto the target
  {t: 5.4, fx: 1700, fy: 560, s: 4},     // pan along to the next event
  {t: 7.6, fx: 1200, fy: 600, s: 1.4},   // pull back for the outcome
], W, H);
film.scene(0, DUR, (ctx, t) => { ctx.save(); M.cam.apply(ctx, camAt(t)); drawWorld(ctx, t); ctx.restore(); drawText(ctx, t); });
```
Scale interpolates in log space so zooms feel even. Keep text in screen space (outside the camera).

## 5. Data scenes

**Getting data in.** The film opens from `file://`, where `fetch()` fails. Download and aggregate the
raw data in a script kept with the film (`video/data/prepare.py`), reduce it to the few hundred numbers
the film shows, and write `video/data.js` as `window.DATA = {...}`; load it with
`<script src="data.js"></script>` before the film's script. Record the dataset URL, version or
retrieval date and licence in `NOTES.md`, and credit the publisher on the end card. Every number on
screen comes from that script's output.

- Use the source's real data. A playhead that sweeps an axis and makes items pop as it passes reads
  as time passing; compute each pop time with `M.solveTime(t => playheadX(t), item.x, P0, P1)` and
  export those times as cues.
- Pop: `E.outBack` gated on `prog > 0`, plus a thin ring ≤ 20–26 px. Big rings everywhere are clutter.
- A big counter (`T.tabular`, 110–150 px) next to the chart gives the eye a number. Compute its value
  from `M.frameT(t)` (motion blur otherwise averages several values into ghosted digits), ease it
  into a hold of ≥0.8 s on the value that matters (a counter racing through 25 minutes per frame never
  shows its key number), and never let the captions contradict it (a caption announcing 2012 while the
  counter still reads 1996).
- Text that changes as it plays (a rolling month, the name under a playhead) is a counter, not a label:
  draw it with `T.tabular` or `T.label(..., kind='number')` from `M.frameT(t)`, or the text check
  treats every value as a separate label that nobody had time to read.
- Line over time: clip the line to x ≤ playheadX(t); put a glowing head dot and a `T.tabular` value at
  the playhead.
- Morph between charts: keep the same items and interpolate each mark's geometry between two layouts
  (bars → dots on a map; the line's last point → the next scene's counter). It is the data version
  of a transition that comes out of the content.
- Maps: project lon/lat once at load (equirectangular with x scaled by cos(lat0) is fine for a city).
  Draw heavy static layers (streets, coastlines) into an offscreen canvas once and `drawImage` it each
  frame; thousands of paths × 12–16 blur sub-frames otherwise dominate render time. Credit the
  geometry (e.g. © OpenStreetMap contributors).
- Density: more than ~8 pops a second reads as a texture, not as events. Animate it as a sweep and give
  sound only to milestones.
- Honesty: name the quantity as the dataset defines it (passages at counters, not riders or trips),
  state the period and coverage, start bars at zero, note gaps in `NOTES.md`.
- Nonlinear axes are fine when they match the source; mark them with a shaded band.

## 6. Explainers (science, process, how-it-works)

Reviewers check the animation, not just the captions:
- Keep the actor the headline names visible while it acts (a protein that dissolves into an
  invisible aura while "Cas9 cuts both strands" is on screen fails).
- Make the motion agree with the sources you cite (if a paper says a protein finds its target by 3D
  diffusion and stays bound after cutting, don't show it sliding along DNA and letting go).
- Size the key event for the venue: the climactic change should span ≥5% of the frame width or be
  pushed in on.
- End on the outcome the labels claim (an "edited site" must look edited, not identical to the start).
- Word headlines as carefully as a lecturer would: "Twenty bases must match" overstates a rule with
  known exceptions; "Twenty bases pair with the target" does not.
- Push in on the outcome rather than pulling away from it, unless the end card shows it large again.
- Label simplifications in the notes file ("schematic, not to scale").

## 7. Simulations

`M.sim` precomputes at 240 Hz and interpolates, so motion-blur sub-frames are smooth. Make `dur`
cover the largest `t` you sample (including offsets such as `swarm.at(i, t + 2.2)`); past the end,
particles freeze. Use `wrap` for wrapping coordinates. Give particles a `z` for depth (size, alpha).

## 8. Polish and motion blur

- `SUB=4` sub-frames over a half-frame shutter suits ordinary motion. In fast moves (camera zooms,
  pulls, whip pans, and fast objects such as a planet flyby) 4 sub-frames strobe into separate copies:
  stars become ladders of dots, rings stack, letters double. Declare those windows:
  `film.blur = [[t0, t1, 12]]` (12–16 there). `stills.mjs --times/--transitions/--crop` render with 4
  sub-frames plus those windows, like the final build, so the copies show up in stills.
- Grain (default 0.09 overlay) dithers 8-bit gradients, which otherwise band in H.264.
- Vignette 0.5; additive glows for light; a thin horizontal gradient line through a light source
  reads as an anamorphic flare.
- A persistent element (brand mark, year rail, step rail) ties scenes together. Hide its small labels
  while it moves fast; motion blur smears them.

## 9. Pitfalls (each of these happened)

| Symptom | Cause | Fix |
|---|---|---|
| Page error "Unary operator used immediately before exponentiation" | `Math.exp(-(x/s)**2)` | `Math.exp(-((x/s)**2))` |
| A shape renders black | colour helper given an `rgba()` string | pass `#rrggbb` or `[r,g,b]`; the engine throws on bad input |
| Things visible before their beat | gating on an eased value: `outBack(0)` ≈ 1e-16 | gate on `prog(...) > 0`, then ease |
| A statement silently does nothing | it ended up inside a trailing `//` comment during an edit | keep comments on their own line; re-run stills after edits |
| Grey veil at a flash (check.py: grey wash) | full-frame bloom at partial alpha | `M.flash` bloom (local) or whiteout |
| Copies of thin lines, rings or letters in fast moves | too few sub-frames | `film.blur` windows at 12–16 |
| Garbled kicker at a scene change | incoming eyebrow decodes over the outgoing one | start incoming text after the outgoing exit ends |
| Labels nobody can read (text check: reading time) | fade scheduled right after the reveal | hold ≥ 0.4 s + words/4.5 after the text is sharp |
| Beaded glowing lines | additive per-segment strokes with round caps | `lineCap = 'butt'` for glow passes |
| Hard edge sliding across a whip pan | background rect ends inside the frame | draw backgrounds wider; fade the outgoing scene |
| An element runs through a headline | layout | fade it before the text, or halo the text |
| Arrows, superscripts, Greek in a fallback font | Google subsets lack them | `fetch_fonts.py` lists gaps; `T.arrow`/`T.sup` |
| Counters jitter | proportional figures | `T.tabular` |
| Particles stop moving | sampled past the sim's `dur` | extend `dur` |
| Lines fat or vanishing while zooming | line width in world units | `lineWidth = px / s` |
| Counter digits or decoded text ghost into overlapping glyphs | each motion-blur sub-frame drew a different value | compute discrete values from `M.frameT(t)` |
| A steady band in the spectrogram with no source in score.py | display artefact of the log-frequency picture | trust check.py's measured numbers |
| Empty background after the end card | the film's length typed as a number in a scene end | end scenes at `DUR` |
| Shapes or text sized for 16:9 on a vertical film | constants instead of `W`/`H` | derive positions from `W`, `H` |

## 10. Performance

Measured: 150 ms per 1080p frame on a quiet 4-core machine with 4 workers and 4 sub-frames; 300–500
ms with 2 workers or another render running; 3–4× that inside `film.blur` windows. A `DRAFT=1` build
of 9 s takes about 40 s. `ctx.filter = 'blur()'` on single words is fine; avoid full-frame blur.
Cache static layers in an offscreen canvas. PNG frames are ~2.2 MB each.

## 11. Other formats and venues

- **9:16 (1080×1920), Reels/Shorts/TikTok:** start from `film-vertical.html`. 1080 px is the phone's
  width, so eyebrows and labels ≥30 px, sublines ≥32 px, headlines 90–104 px. Layout: eyebrow baseline
  y≈300, a two-line centred headline at y≈420 and 526, the subject in y 600–1350, numbers or labels
  at y 1400–1500, nothing above y 221 or below y 1536 (status bar, captions, app buttons; avoid the
  right-hand action rail around x > 900, y 1000–1650 too). At most ~4 text elements per scene. Make the subject big (≥60% of the
  width) and the frame bright enough for a phone (check.py warns below a median luma of 0.08). Start on
  the picture, not black (`fadeIn: 0`; the first frame is often the thumbnail), and give the first
  second motion. 30 fps is enough (the apps play at 30) and halves render time. The build switches to
  the phone sound profile and −14 LUFS for vertical films and for `VENUE=phone`.
- **16:9 in a social feed:** the frame is shown at phone width, so text must be ≥53 px (30 px per
  1080 px of width); `VENUE=phone`, 30 fps.
- **1:1 (1080×1080):** 100 px margins, headline 64–80 px.
- **Projection (lectures, talks):** labels ≥22 px, stronger contrast, no essential detail in thin
  dim lines; keep the low end moderate (room PAs rumble, laptops lose it).
- Set `W`, `H` (and `FPS`) in `Film.create`; design each layout separately.
