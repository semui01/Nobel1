# Sound design for motion videos

Sound is synthesised in `score.py` with the instruments in `sound.py`, and every time comes from
`cues.json`, which the film exports from `film.cues`. Nothing is hand-timed, so changing the
film's timing table moves the sound with it.

## Layers

| Layer | Instrument | What triggers it | Typical gain |
|---|---|---|---|
| Bed | `Score.chord` (pad with brightness automation) | one chord per scene, crossfading at cuts | 0.06–0.07 per note |
| Data points | `mallet`, pitch from a pentatonic scale, pan from x | each item popping in | 0.07 (minor), 0.13 (milestone) |
| Reveals | `bell` (ratio 2.0 glassy, 3.5 metallic) | a light turning on, a discovery, a title | 0.08–0.17 |
| Clicks | `tick`, `pop` | pulses, UI blips, spikes, switches | 0.04–0.35 |
| Motion | `whoosh`, `whip` | zooms (rising), pull-outs (falling), whip pans | 0.22–0.3 |
| Build | `riser` | the ~0.9 s before a big cut | 0.3 |
| Impact | `boom` | landing a zoom, the end card | 0.15–0.55 |

Design rules:
- **One sound per kind of event**, consistent through the film, so the ear learns the vocabulary.
  When the picture says something stops (silencing, a pause), make the sound stop too: absence is
  a strong cue.
- **One key.** Pentatonic scales for event melodies keep any combination consonant. Move the bed
  through related chords per scene (Dm → B♭ → Gm → A in the Nobel film) and **resolve** on the end
  card (D major), with a bell arpeggio timed to the title words.
- Automate the pad's brightness with the story: closed at the start, open as things build, dip
  while something is silenced, brightest at the reveal.
- Keep low notes below ~100 Hz quieter (the `chord` helper does) and high-pass the master (done)
  or the bed turns to mud.

## Mix and loudness

`Score.write` normalises, soft-clips gently (`drive` 1.1) and fades the tail; `build.sh` then
loudness-normalises in two passes to −16 LUFS integrated, −1.5 dBTP (streaming-safe). Events
should rise clearly above the bed: if the bed is louder than ~−18 dB RMS on its own, lower the
chord gains.

## Verifying without hearing it

You cannot listen, so measure:
- `tools/check.py film.mp4 frames/cues.json --sync <cue list>` reports loudness and the median
  offset between cue times and audio transients (aim for under ±15 ms).
- A spectrogram shows whether events stand out from the bed:
  `ffmpeg -i film.mp4 -lavfi "showspectrumpic=s=1800x600:legend=1:scale=log:fscale=log:stop=12000" spec.png`
  Look for distinct marks at each event time above the pad's horizontal bands.
- Loudness range (LRA in the loudnorm output) below ~3 LU means the mix is over-compressed; raise
  event gains or lower the bed rather than adding drive.

Then tell the user the mix was checked by measurement only and that they should listen before
publishing.
