#!/usr/bin/env bash
# Full build: frames (headless Chromium) -> soundtrack (numpy) -> loudness-normalised H.264 MP4.
# usage: ./build.sh [frames_dir] [out.mp4]
set -euo pipefail
cd "$(dirname "$0")"
FR=${1:-frames}; OUT=${2:-optogenetics-15s.mp4}
node render.mjs --frames "$FR" --sub 4 --workers 4
python3 audio.py "$FR/cues.json" "$FR/soundtrack.wav"
M=$(ffmpeg -hide_banner -i "$FR/soundtrack.wav" -af loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
LN=$(echo "$M" | python3 -c "import json,sys;d=json.load(sys.stdin);print(f\"measured_I={d['input_i']}:measured_TP={d['input_tp']}:measured_LRA={d['input_lra']}:measured_thresh={d['input_thresh']}:offset={d['target_offset']}\")")
ffmpeg -loglevel error -y -framerate 60 -i "$FR/f%04d.png" -i "$FR/soundtrack.wav" \
  -af "loudnorm=I=-16:TP=-1.5:LRA=11:$LN:linear=true,aresample=48000" \
  -c:v libx264 -preset slow -crf 15 -tune film -pix_fmt yuv420p -profile:v high \
  -c:a aac -b:a 256k -movflags +faststart -shortest "$OUT"
ffmpeg -loglevel error -y -i "$FR/f0899.png" poster.png
echo "built $OUT"
