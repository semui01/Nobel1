# Craft notes for motion videos

Contents: 1 Pacing · 2 Visual system · 3 Transitions (recipes) · 4 Data scenes · 5 Simulations ·
6 Polish · 7 Pitfalls · 8 Performance · 9 Other aspect ratios

## 1. Pacing

- A viewer reads about 3–4 words per second of attention. A 6-word headline needs ~0.8 s fully
  visible after its reveal finishes. Budget a scene as: 0.3 s reveal, ≥0.8 s readable hold, the
  rest for the visual payoff and the transition.
- 15 s ≈ 6–7 scenes. 30 s ≈ 10–12. Beyond ~2.5 s a static scene feels slow; below ~1.5 s text is
  unreadable. If the story has more beats than time, merge beats into one scene with a montage
  (the Nobel film shows three brain-circuit findings in 1.1 s by lighting regions one after
  another and listing them in a sidebar).
- Open on motion and the subject. End on a held card (≥2.3 s) with title, credit and link,
  with a slow push-in (scale 1 → 1.02) so it is not dead.
- Let one element carry across each cut (a point of light, a shape, a line). Continuity is what
  makes 7 scenes feel like one film.

## 2. Visual system

- Take colour tokens, fonts and motifs from the source so the video reads as part of it. Give each
  colour one meaning and keep it (in the Nobel film blue = light/activation, amber = silencing,
  green = algae, gold = recognition).
- Layout at 1080p: 140 px side margins; eyebrow at y≈120–150; headline baseline 80–100 px below
  it; keep the bottom ~60 px for a progress rail or nothing. Display face light (300) at 64–120 px,
  italic for the one emphasised word, in the accent colour with a soft glow.
- Legibility over moving artwork, in order of preference:
  1. compose so artwork avoids the text block;
  2. a scrim: linear gradient of the background colour from the text side (alpha ~0.85 → 0);
  3. fade the crossing element out before it reaches the text (gradient mask at its end);
  4. `T.line(..., {halo: C.bg})` knock-out stroke behind the letters.
- Labels and callouts: mono, uppercase, letter-spaced titles plus a sans subline. Point at things
  rather than explaining them in the headline.

## 3. Transitions (recipes)

All of these are pure functions of `t`, so they render identically on any frame.

**Zoom-through (into a detail, and out the other side into the next scene).** Camera with an
exponential scale (perceptually even zoom) whose focus eases to the frame centre:
```js
const p = prog(t, Z0, Z1);
const s = M.cam.zoom(250, p, E.inCubic);                 // 1 → 250×, accelerating
const f = focusPoint(t);                                   // world point you are diving into (can move)
const e = E.inOutCubic(prog(t, Z0, Z0 + .8));
const c = {fx: f.x, fy: f.y, s, ax: lerp(f.x, 960, e), ay: lerp(f.y, 640, e), rot: -angle * E.inOutCubic(p)};
M.cam.apply(ctx, c);  // draw the world; line widths: px / s
```
Fade out detail that would look wrong when huge (fills, other objects) as `s` grows, keep the
outline of what you dive into, and land the camera so the next scene's main shape is exactly where
the zoom ends (Nobel: the alga's cell edge above its eyespot lands on the y of the next scene's
membrane, rotated horizontal). Start the next scene at scale ~1.3 easing to 1 so the momentum
continues. Faint radial "warp" streaks during the last 40% sell the speed.

**Zoom-out into a map (match on a shared transform).** Scene A (detail, e.g. a neuron at S) and
scene B (map, region R) share one camera:
```js
const p = E.inOutCubic(prog(t, A, B)), Z = Math.exp(Math.log(ZEND) * p);    // ZEND ≈ .03
const ax = lerp(S.x, R.x, p), ay = lerp(S.y, R.y, p);
// scene A: translate(ax,ay) scale(Z) translate(-S)        scene B: translate(ax,ay) scale(Z/ZEND) translate(-R)
```
Anything that should stay continuous (a fibre, a beam) must be drawn so both scenes place it at the
same screen position at the hand-off.

**Gather into a point.** Each element flies on a quadratic Bézier to the target with an
accelerating ease and a staggered start (`hash` per item), shrinking and whitening as it arrives;
the arrival point blooms into the next scene's light source.
```js
const k = E.inCubic(prog(t, ts_i, ts_i + .5)), m = {x: mid.x + (hash(i,1)-.5)*500, y: mid.y + (hash(i,2)-.5)*380};
x = (1-k)**2*x0 + 2*(1-k)*k*m.x + k*k*P.x;  // same for y
```

**Whip pan (fallback).** One shared easing for both scenes, and fade the outgoing scene so its edges
never show:
```js
const wp = prog(t, W0, W1), pan = E.inOutCubic(wp) * W;
// outgoing: ctx.globalAlpha *= 1 - E.inCubic(wp); ctx.translate(-pan, 0)   (draw backgrounds wider than the frame)
// incoming: ctx.globalAlpha *= E.outCubic(wp);    ctx.translate(W - pan, 0)
```
Motion blur turns this into a proper streak. Pair it with a stereo whoosh.

**Flash into the end card.** Short and near-white: rise 0.14 s (`E.inQuad`), fall 0.26 s
(`E.outQuad`), radial from the point the previous scene focused on, a coloured core no larger than
a third of the radius. The next scene is fully opaque by the peak. A coloured wash at partial alpha
over a dark background turns grey-brown; that is why the colour stays in the core.

**Text in and out.** `T.line` words rise 34 px with a 14 px blur, staggered 0.05–0.08 s;
exits rise further and blur. `T.eyebrow` decodes from scrambled glyphs at ~60 characters per second.
Exit text 0.2–0.3 s before a transition starts so the cut is clean.

## 4. Data scenes

- Use the source's real data. A playhead that sweeps an axis and makes items pop as it passes reads
  instantly as "time passing"; compute each item's pop time once with
  `M.solveTime(t => playheadX(t), item.x, P0, P1)` and export those times as cues.
- Pop: scale with `E.outBack` gated on `prog > 0` (not on the eased value), plus a thin ring ripple
  ≤ 20–26 px. Big rings everywhere become clutter.
- A big counter (`T.tabular`, display face 110–150 px) next to the chart gives the eye a number.
- Labels appear with their item; milestones get a leader line up to a label row.
- Nonlinear axes are fine when they match the source; say so with a subtle shaded band.

## 5. Simulations

`M.sim` precomputes at 240 Hz and interpolates, so motion blur sub-frames are smooth. Make `dur`
cover the largest `t` you will ever sample (including offsets such as `swarm.at(i, t + 2.2)`) —
past the end, particles freeze. Use `wrap` for any coordinate that wraps around the screen so
interpolation does not draw a particle crossing the whole frame. Depth: give each particle a `z`
and scale size and alpha with it.

## 6. Polish

- Motion blur: `SUB=4` sub-frames over a half-frame shutter. Cheap, and it makes zooms and pans
  look filmed.
- Grain (engine default 0.09 overlay) dithers 8-bit gradients, which otherwise band in H.264.
- Vignette 0.5 focuses the frame. Additive glows (`M.add` + `M.glow`) for light; a thin horizontal
  gradient line through a light source reads as an anamorphic flare.
- A persistent element (brand mark, a year rail, a progress line) ties scenes together. Hide its
  small labels while it moves fast; motion blur smears them into mush.

## 7. Pitfalls (each of these happened)

| Symptom | Cause | Fix |
|---|---|---|
| Page error "Unary operator used immediately before exponentiation" | `Math.exp(-(x/s)**2)` | `Math.exp(-((x/s)**2))` |
| A shape renders black | colour helper given an `rgba()` string | pass `#rrggbb` or `[r,g,b]` (`M.mixRGB` chains); the engine now throws on bad input |
| Things visible before their beat | gating on an eased value: `outBack(0)` ≈ 1e-16 | gate on `prog(...) > 0`, then ease |
| Beaded glowing lines | additive per-segment strokes with round caps overlap | `lineCap = 'butt'` for glow passes |
| Hard edge sliding across a whip pan | outgoing scene's background rect ends inside the frame | draw backgrounds wider; fade the outgoing scene |
| Grey-brown frames at a flash | warm wash at partial alpha | near-white bloom, colour only in the core, shorter |
| An element runs through a headline | layout | fade it out above the text, or halo the text |
| Arrows, superscripts, Greek in a different font | Google subsets lack them | `fetch_fonts.py` lists gaps; draw with `T.arrow`/`T.sup` |
| Counters jitter | proportional figures | `T.tabular` |
| Particles stop moving | sampled past the sim's `dur` | extend `dur` |
| Lines get fat or vanish while zooming | line width in world units | `lineWidth = px / s` |
| Crossfade looks cluttered | both scenes at ~50% while the zoom is mid-way | finish the zoom first, then crossfade over ~0.25 s |
| Rendering hangs or text wrong | fonts not loaded before frames | `film.start([...specs])` awaits them; list every weight/style used |

## 8. Performance

At 1080p with 4 sub-frames and 4 worker pages: ~150 ms per frame, so 900 frames ≈ 2.5 minutes.
`ctx.filter = 'blur()'` on individual words is fine; avoid full-frame blur. Use `--sub 1` and
`--fmt jpeg` for quick previews. PNG frames are ~2.5 MB each; render into a scratch directory.

## 9. Other aspect ratios

- 9:16 (1080×1920) for Reels/Shorts/TikTok: keep text out of the top ~220 px and bottom ~380 px
  (app UI). Stack instead of placing side by side: headline top, visual centre, labels below.
  Headlines 72–96 px, one or two lines.
- 1:1 (1080×1080): 100 px margins, headline 64–80 px.
- Set `W`, `H` in `Film.create` and the preview CSS `aspect-ratio`; design each layout separately.
