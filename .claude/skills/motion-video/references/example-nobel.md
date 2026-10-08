# Worked example: "Optogenetics, 1866–2026" (15 s)

Source: an interactive single-page history of optogenetics (semui01/Nobel1, `index.html`), dark
navy theme, Spectral + IBM Plex, spectral colours as data (470 nm blue excites, 589 nm amber
silences). The film is `video/motion.html` in that repository (not bundled with this skill; the
storyboard below is the part to learn from). The engine was extracted from it.

## Storyboard as built

| # | Time | Visual | Headline | Transition out | Sound |
|---|------|--------|----------|----------------|-------|
| 1 | 0–2.7 | 170 simulated algae turn toward a blue light that switches on; a callout marks one cell's eyespot | "Algae swim toward light." | zoom-through 250× into the eyespot, rotating so the cell edge lands horizontal | glass ping, water bed, micro-bubbles, rising whoosh, soft impact |
| 2 | 2.7–5 | membrane cross-section, 7-helix channel; a 470 nm wave packet hits retinal, the channel opens, ions stream in | "A channel that light opens." | whip pan | photon chirp, zap + bell, a tick per ion |
| 3 | 5–7.7 | the site's 64 real events pop along 8 lanes as a playhead sweeps 1866→2026; big year counter | "Eight threads that converged on one protein." | all dots fly into one point, which becomes a fibre's light | a mallet per event, pitch by lane, milestones louder; reverse swell into a chord ping |
| 4 | 7.7–10 | fibre over a neuron; a leaky integrate-and-fire simulation drives the scope trace, counters and spike flashes; amber light silences it | "Blue light: on. / Yellow light: off." | shared-transform zoom-out: the soma becomes a region on a brain map | a crackle per spike, a tick per light pulse; spikes stop under amber; hum |
| 5 | 10–11.5 | brain map, three findings light regions and projections; sidebar list | "From reading the brain to writing to it." | whip pan | falling whoosh, bell per finding |
| 6 | 11.5–12.5 | eye cross-section; amber beam from goggles focuses on retinal ganglion cells | "A blind patient sees objects." | near-white flash from the focal point | shimmer, chime, riser |
| 7 | 12.5–15 | end card over faint algae and the light: prize line, title, laureates, link | "From an alga's eyespot to a switch for the brain." | — | boom, resolved D-major pad, bell arpeggio on the title, ding on the link |

A year rail along the bottom tracked each scene's place in the 160-year timeline.

## What made it work

- Real data everywhere: the timeline used the page's own event array; the neuron used a
  simulation tuned so each blue pulse fired exactly one spike and amber suppressed all of them.
- Every cut except two came out of the content (zoom into the eyespot, gather into the light, zoom
  out of the neuron, flash out of the retina).
- About five review passes on stills caught: a colour bug that turned the neuron black, a muddy
  khaki flash, a fibre running through a headline, a hard background edge in a whip pan, a cluttered
  crossfade in the zoom, and smeared rail labels.

Today's `check.py` flags its end-card flash as a grey wash (12.48–12.70 s) and 27% of its energy
below 60 Hz; those two measurements are where `M.flash` and the low-end rules came from.

## Numbers

1920×1080, 60 fps, 900 frames, 4 sub-frames: 135 s to render on 4 cores; 21.6 MB at CRF 15;
−16.0 LUFS; spike sounds within 5 ms of their frames.
