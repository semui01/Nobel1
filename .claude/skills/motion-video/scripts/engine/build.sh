#!/usr/bin/env bash
# One-command build: frames (headless Chromium) → score (numpy) → loudness-normalised H.264 MP4 → checks.
# usage: ./build.sh [frames_dir] [out.mp4]          (relative paths are taken from where you run it)
# env:   FILM=film.html   SUB=4 (motion-blur sub-frames; film.blur raises it in fast moves)   WORKERS=4
#        CRF=15   LUFS=-16 (use -14 for phone/social)   NO_AUDIO=1 (silent film)
#        FROM=n TO=m (re-render only frames n..m-1)   SKIP_RENDER=1 (reuse existing frames)
#        SYNC=pops,hits (cues to check for sync)   VENUE=screen|projector|phone (check thresholds)
# A 15 s, 60 fps film is 900 frames; time the first 60 (render.mjs prints ms/frame) and expect
# 2–8 minutes depending on cores. In an agent, run it in the background or with a long timeout.
set -euo pipefail
abs() { case "$1" in /*) echo "$1";; *) echo "$PWD/$1";; esac; }
FR=$(abs "${1:-frames}"); OUT=$(abs "${2:-film.mp4}")
cd "$(dirname "$0")"
FILM=${FILM:-film.html}; SUB=${SUB:-4}; WORKERS=${WORKERS:-4}; CRF=${CRF:-15}; LUFS=${LUFS:--16}

if [[ "${SKIP_RENDER:-0}" != "1" ]]; then
  RANGE=(); [[ -n "${FROM:-}" ]] && RANGE+=(--from "$FROM"); [[ -n "${TO:-}" ]] && RANGE+=(--to "$TO")
  node render.mjs --film "$FILM" --frames "$FR" --sub "$SUB" --workers "$WORKERS" ${RANGE[@]+"${RANGE[@]}"}
fi
FPS=$(python3 -c "import json;print(json.load(open('$FR/cues.json'))['fps'])")
VIDEO=(-c:v libx264 -preset slow -crf "$CRF" -tune film -pix_fmt yuv420p -profile:v high -movflags +faststart)

if [[ "${NO_AUDIO:-0}" == "1" ]]; then
  ffmpeg -loglevel error -y -framerate "$FPS" -i "$FR/f%05d.png" "${VIDEO[@]}" "$OUT"
else
  python3 score.py "$FR/cues.json" "$FR/soundtrack.wav"
  # Two-pass loudnorm: measure, then apply linearly (no pumping) to the target.
  M=$(ffmpeg -hide_banner -i "$FR/soundtrack.wav" -af "loudnorm=I=$LUFS:TP=-1.5:LRA=11:print_format=json" -f null - 2>&1 | sed -n '/^{/,/^}/p')
  LN=$(echo "$M" | python3 -c "import json,sys;d=json.load(sys.stdin);print(f\"measured_I={d['input_i']}:measured_TP={d['input_tp']}:measured_LRA={d['input_lra']}:measured_thresh={d['input_thresh']}:offset={d['target_offset']}\")")
  ffmpeg -loglevel error -y -framerate "$FPS" -i "$FR/f%05d.png" -i "$FR/soundtrack.wav" \
    -af "loudnorm=I=$LUFS:TP=-1.5:LRA=11:$LN:linear=true,aresample=48000" \
    "${VIDEO[@]}" -c:a aac -b:a 256k -shortest "$OUT"
fi
LAST=$(ls "$FR"/f*.png | tail -1)
ffmpeg -loglevel error -y -i "$LAST" "${OUT%.*}-poster.png"
CHECK=(); [[ -n "${SYNC:-}" ]] && CHECK+=(--sync "$SYNC"); [[ -n "${VENUE:-}" ]] && CHECK+=(--venue "$VENUE")
python3 tools/check.py "$OUT" "$FR/cues.json" ${CHECK[@]+"${CHECK[@]}"} || echo "check.py reported high findings (see above); the MP4 was still written."
