"""Verify a finished film: format, loudness, audio/video sync, and a contact sheet of the encode.

usage: python3 tools/check.py film.mp4 frames/cues.json [--sync KEY]
  --sync KEY  a list-valued cue (e.g. pops, spikes) whose times should each have a sound transient.
              Defaults to the first list of plain numbers in cues.json.
Writes <film>-sheet.jpg (16 frames sampled evenly from the encoded file) for a last look.
"""
import json
import subprocess
import sys

import numpy as np

mp4, cues_path = sys.argv[1], sys.argv[2]
cues = json.load(open(cues_path))
key = sys.argv[sys.argv.index('--sync') + 1] if '--sync' in sys.argv else None


def run(*a):
    return subprocess.run(a, capture_output=True, text=True)


probe = json.loads(run('ffprobe', '-v', 'error', '-show_entries', 'format=duration:stream=codec_type,codec_name,width,height,r_frame_rate',
                       '-of', 'json', mp4).stdout)
dur = float(probe['format']['duration'])
v = next(s for s in probe['streams'] if s['codec_type'] == 'video')
has_audio = any(s['codec_type'] == 'audio' for s in probe['streams'])
print(f"video   {v['width']}x{v['height']} @ {v['r_frame_rate']} fps, {dur:.3f} s (film says {cues['dur']} s)")
problems = []
if abs(dur - cues['dur']) > 1.5 / cues['fps']:
    problems.append(f'duration {dur:.3f} s differs from the film ({cues["dur"]} s)')

if has_audio:
    ln = run('ffmpeg', '-hide_banner', '-i', mp4, '-af', 'loudnorm=print_format=summary', '-f', 'null', '-').stderr
    for line in ln.splitlines():
        if 'Input Integrated' in line or 'Input True Peak' in line:
            print('audio  ', line.strip())
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', mp4, '-vn', '-ac', '1', '-ar', '48000', '-f', 's16le', '-'], capture_output=True).stdout
    x = np.frombuffer(raw, '<i2').astype(float)
    if key is None:
        key = next((k for k, val in cues.items() if isinstance(val, list) and val and all(isinstance(e, (int, float)) for e in val)), None)
    if key:
        d = np.abs(np.diff(x))
        offs = []
        for t in cues[key][:12]:
            i0, i1 = int((t - .03) * 48000), int((t + .06) * 48000)
            if i1 < len(d) and i0 > 0:
                offs.append((i0 + int(np.argmax(d[i0:i1]))) / 48000 - t)
        if offs:
            ms = np.array(offs) * 1000
            print(f'sync    "{key}": sound lands {np.median(ms):+.1f} ms from the cue (median of {len(ms)}, spread {ms.min():+.0f}…{ms.max():+.0f} ms)')
            if abs(np.median(ms)) > 25:
                problems.append(f'audio for "{key}" is {np.median(ms):+.0f} ms off the picture')
else:
    print('audio   none')

sheet = mp4.rsplit('.', 1)[0] + '-sheet.jpg'
n = int(round(dur * cues['fps']))
picks = '+'.join(f'eq(n\\,{int((k + .5) * n / 16)})' for k in range(16))
run('ffmpeg', '-loglevel', 'error', '-y', '-i', mp4, '-vf', f"select='{picks}',scale=480:-2,tile=4x4", '-frames:v', '1', '-fps_mode', 'passthrough', sheet)
print('sheet  ', sheet)
print('OK' if not problems else 'PROBLEMS:\n  ' + '\n  '.join(problems))
sys.exit(1 if problems else 0)
