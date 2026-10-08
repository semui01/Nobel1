"""Score for the starter films. Rewrite per film: one layer per kind of on-screen event.

usage: python3 score.py frames/cues.json soundtrack.wav
Every time comes from cues.json (exported by film.cues), so sound lands on the frame. Missing cues are
skipped, so a draft of a new film can be built before this file is rewritten for it.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sound import Score, bell, boom, curve, hz, mallet, riser, tick, whip  # noqa: E402

cues = json.load(open(sys.argv[1]))
dur = cues['dur']
phone = os.environ.get('VENUE') == 'phone' or cues.get('H', 1080) > cues.get('W', 1920)
sc = Score(dur, seed=7, profile='phone' if phone else 'speakers')   # phone: no sub-bass, presence lift
flash = cues.get('flash', dur - 2.5)
fin = cues.get('fin', flash + .05)
split = cues['whips'][0][0] if cues.get('whips') else flash * .45   # where the bed moves to its second chord

# Bed: D minor → B♭ major 7 → D major on the end card; brightness opens over the film.
bright = curve([(0, 400), (split, 900), (flash - .1, 2200), (flash, 3200), (dur, 1500)])
sc.chord(['D2', 'A2', 'D3', 'E3', 'F3', 'A3'], .05, split + .5, bright)
sc.chord(['F2', 'Bb2', 'D3', 'F3', 'A3'], split, flash, bright)
sc.chord(['D2', 'A2', 'D3', 'F#3', 'A3', 'D4', 'F#4'], flash, dur + .2, bright, gain=.07, att=.05)

if 'lightOn' in cues:   # a light turns on: a glassy ping
    sc.add(bell(hz('E6'), 3, .9, 2.0, 1.2), cues['lightOn'], .16, .35, rev=.6)
for a, b in cues.get('whips', []):   # whip pans whoosh across the stereo field
    sc.add(whip(b - a + .15), a - .05, .3, rev=.15)
# Data points: D minor pentatonic (no semitone clash with the D minor or B♭ beds). Pitch follows the
# value when the film exports popVals, otherwise the order. A quiet high tick on each gives the ear a
# clear attack and gives check.py an onset to measure (low mallets have little energy above 1.5 kHz).
scale = ['D4', 'F4', 'G4', 'A4', 'C5', 'D5', 'F5', 'G5', 'A5']
pops, vals = cues.get('pops', []), cues.get('popVals')
lo, hi = (min(vals), max(vals)) if vals else (0, 1)
for i, t in enumerate(pops):
    deg = round((vals[i] - lo) / ((hi - lo) or 1) * (len(scale) - 1)) if vals else i % len(scale)
    pan = -.5 + i / max(1, len(pops) - 1)
    sc.add(mallet(hz(scale[deg]), .6, .16), t, .12, pan, rev=.45)
    sc.add(tick(4200, .008, .0015), t, .03, pan)
if 'callout' in cues:
    sc.add(tick(3000, .03, .006), cues['callout'], .1, .4, rev=.3)
# Build into the end card, hit, then chimes as the title and link appear.
sc.add(riser(.9), flash - .9, .3, rev=.3)
sc.add(boom(2.4, 80, 42, .7), flash, .55, rev=.4)
for k, nt in enumerate(['D5', 'F#5', 'A5', 'D6']):
    sc.add(bell(hz(nt), 2.4, .9, 2.0, 1.1), fin + .22 + k * .2, .085, -.4 + .25 * k, rev=.7)
if 'url' in cues:
    sc.add(bell(hz('D6'), 2.4, .9, 3.5, 1.2), cues['url'], .08, .5, rev=.8)

sc.write(sys.argv[2])
