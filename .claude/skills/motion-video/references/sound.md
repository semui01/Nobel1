# Sound design for motion videos

Sound is synthesised in `score.py` with the instruments in `sound.py`, and every time comes from
`cues.json`, which the film exports from `film.cues`. Nothing is hand-timed, so retiming the film
moves the sound with it. `node render.mjs --cues-only --frames <dir>` writes `cues.json` without
rendering, so you can work on the score early.

## Layers

| Layer | Instrument | What triggers it | Typical gain |
|---|---|---|---|
| Bed | `Score.chord` (pad with brightness automation) | one chord per scene, crossfading at cuts | 0.06–0.07 per note |
| Data points | `mallet` on a pentatonic scale whose notes sit in the bed's chords; pitch from the value (low → low), pan from x; a quiet `tick` on top | each item popping in | 0.07 minor, 0.13 milestone |
| Reveals | `bell` (ratio 2.0 glassy, 3.5 metallic) | a light turning on, a discovery, a title | 0.08–0.17 |
| Clicks | `tick`, `pop` | pulses, UI blips, spikes, switches, letters pairing | 0.04–0.35 |
| Motion | `whoosh`, `whip` | zooms (rising), pull-outs (falling), whip pans | 0.22–0.3 |
| Build | `riser` | the ~0.9 s before a big cut | 0.3 |
| Impact | `boom` (low thump + 1–4 kHz click) | landing a zoom, the end card | 0.15–0.55 |

Design rules:
- **One sound per kind of event**, consistent through the film, so the ear learns the vocabulary.
  When the picture says something stops (silencing, a failed match), make the sound stop or turn
  dull: absence and contrast are strong cues.
- **One key.** Pentatonic scales keep event melodies consonant. Move the bed through related chords
  per scene (Dm → B♭ → Gm → A in the Nobel film) and **resolve** on the end card, with a bell
  arpeggio timed to the title words.
- Automate the pad's brightness with the story: closed at the start, open as things build, dimmed
  while something is silenced, brightest at the reveal.
- **Hierarchy:** the loudest accents belong to the events the headline names (the cut, the
  crossing, the reveal), not to incidental ticks. Keep repeated small events (counters, ticks)
  well below the hits.
- **Pulse** for teasers over ~15 s: a soft tick or low mallet on a tempo grid (120 BPM = 0.5 s);
  build `TM` from `beat(n) = n * 0.5` so cuts and hits land on beats. Slow pads alone drift.

## Low end and venues

Laptop, TV, lecture-room and phone speakers reproduce little or nothing below 60–150 Hz; energy down
there only eats headroom (and makes room PAs rumble). Tested films that put 30–50% of their energy
below 60–120 Hz lost their impacts on small speakers.
- Voice pad roots at E1–A1 only quietly (`chord` scales notes below 100 Hz to 0.35); prefer roots in
  octave 2. The master high-passes at 40 Hz.
- `boom` carries a 1–4 kHz click layer so impacts still land without sub-bass.
- **Social video:** `Score(dur, profile='phone')` high-passes at 110 Hz and lifts presence around
  3 kHz; build with `LUFS=-14`. check.py warns when more than 35% of the energy sits below 120 Hz
  (phone) or 25% below 60 Hz (other venues).

## Mix and loudness

`Score.write` normalises, soft-clips gently (`drive` 1.1) and fades the tail; `build.sh` then
loudness-normalises in two passes (−16 LUFS by default, −1.5 dBTP). Events should rise clearly above
the bed. A loudness range (LRA) under ~2.5 LU means the mix is squashed: lower the bed or raise the
events rather than adding drive.

## Verifying without hearing it

`tools/check.py` (run by `build.sh`) reports loudness and LRA, low-frequency energy for the venue,
and sync, and writes `<film>-spec.png`.
- **Sync** finds the onset of high-frequency energy near each cue (the search window never reaches a
  neighbouring cue) and reports the median offset per cue list. Sounds are placed from the same cue
  times, so only a *consistent* offset across several cues is an error (a wrong fps, a shifted list).
  Soft or tonal sounds (pads, slow bells) have no sharp onset and show scattered or no readings;
  that is expected. A cue list named in `sync` needs energy above 1.5 kHz in its first milliseconds:
  low mallets have none and read 30–50 ms late, so layer a quiet `tick` on them (the template does).
- **Spectrogram:** an overview only. Each event should show as a distinct mark above the pad's
  horizontal bands. Low frequencies smear on its log axis, and test agents have chased bands that the
  audio did not contain, so trust check.py's measured numbers and measure with numpy before
  acting on anything that only the picture shows.

Then tell the user the mix was checked by measurement only and that they should listen before
publishing.
