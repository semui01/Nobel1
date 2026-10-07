# The Frozen Tomb

A 1:14 motion graphic about how Amundsen–Scott South Pole Station disposes of its sewage: the drinking-water Rodriguez well (Rodwell), its reuse as a sewage bulb, and the bulb freezing into the ice sheet.

## Videos

| File | Format | Audio |
|---|---|---|
| `video/frozen_tomb_16x9_VO.mp4` | 1920×1080, 30 fps | Narration, music, sound effects |
| `video/frozen_tomb_16x9_noVO.mp4` | 1920×1080, 30 fps | Music and sound effects only |
| `video/frozen_tomb_9x16_VO.mp4` | 1080×1920, 30 fps | Narration, music, sound effects |
| `video/frozen_tomb_9x16_noVO.mp4` | 1080×1920, 30 fps | Music and sound effects only |

Each file is H.264 at about 9.5 Mbps with AAC audio normalized to −14 LUFS. They are kept under GitHub's 100 MB file limit, so they are compressed copies, not the lossless masters.

The no-VO versions still carry the on-screen captions, timed to the original narration.

`audio/` holds the narration on its own (`narration.wav`) and both final mixes as MP3.

## Notes on the content

- Three typos in the original script were corrected for the narration: "prevent free" → "prevent freezing", "porest snow" → "porous snow", "the50° ice" → "the minus fifty degree ice".
- Some on-screen figures are illustrative, not sourced: the 2,400,000+ gallon wastewater counter, the fuel-burn percentage, the $150M station figure and the "years in the ice" counter (which assumes a constant 10 m/year ice flow).
- The station-collapse sequence is labelled as a simulation, matching the script's "if".

## Source

`src/film/` is the animation: `anim.js` draws every frame on a canvas as a pure function of time, `render(t)`. Open `src/film/index.html?t=30` to see a still at 30 s, `?play` to play in real time, and add `&v` (or `?v`) for the vertical layout.

| File | Purpose |
|---|---|
| `src/tts.py` | Narration, synthesized line by line with [Kokoro](https://github.com/thewh1teagle/kokoro-onnx) (voice `am_michael`, 1.2× speed) |
| `src/layout.py` | Trims each line and places it on the 74 s timeline; writes `timeline.json` and `vo_full.wav` |
| `src/audio.py` | Synthesizes the music and sound effects, syncs them to `events.json` and mixes. `python3 audio.py novo` makes the no-narration mix |
| `src/renderseg.js` | Renders a frame range with Playwright and pipes it to ffmpeg |
| `src/stills.js` | Renders single frames for checking (`VERT=1` for vertical; `EV=1` re-exports `events.json`) |

### Re-rendering

Requirements: Node with Playwright and Chromium, ffmpeg with libx264, Python 3 with numpy, scipy and soundfile (plus `kokoro-onnx` to regenerate the narration).

The Kokoro model files are not in the repo (about 350 MB). Download `kokoro-v1.0.onnx` and `voices-v1.0.bin` from the kokoro-onnx `model-files-v1.0` release into `src/voices/`.

From `src/`, with `film/timeline.js` generated from `timeline.json`:

```sh
# frames → video (split the 2,220 frames across workers; add VERT=1 for 9:16)
node renderseg.js 0 740 a.mp4 & node renderseg.js 740 1480 b.mp4 & node renderseg.js 1480 2220 c.mp4 & wait
printf "file 'a.mp4'\nfile 'b.mp4'\nfile 'c.mp4'\n" > list.txt
ffmpeg -f concat -safe 0 -i list.txt -c copy video.mp4

# audio, then mux
python3 audio.py            # needs vo_full.wav from layout.py; writes mix.wav
ffmpeg -i video.mp4 -i mix.wav -map 0:v -map 1:a -c:v copy -af loudnorm=I=-14:TP=-1 -c:a aac -b:a 256k out.mp4
```

The renderer writes near-lossless segments (CRF 15), so a full-quality master can be rebuilt at any time.
