"""Score for the starter film. Rewrite per film: one layer per kind of on-screen event.

usage: python3 score.py frames/cues.json soundtrack.wav
Every time comes from cues.json (exported by film.cues), so sound lands on the frame.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sound import Score, bell, boom, curve, hz, mallet, riser, tick, whip  # noqa: E402

cues = json.load(open(sys.argv[1]))
sc = Score(cues['dur'], seed=7)
flash, fin = cues['flash'], cues['fin']

# Bed: a pad whose brightness opens over the film, then resolves on the end card.
bright = curve([(0, 400), (cues['whips'][0][0], 900), (flash - .1, 2200), (flash, 3200), (cues['dur'], 1500)])
sc.chord(['D2', 'A2', 'D3', 'E3', 'F3', 'A3'], .05, cues['whips'][0][1] + .1, bright)
sc.chord(['Bb1', 'F2', 'Bb2', 'D3', 'F3', 'A3'], cues['whips'][0][0], flash, bright)
sc.chord(['D1', 'D2', 'A2', 'D3', 'F#3', 'A3', 'D4', 'F#4'], flash, cues['dur'] + .2, bright, gain=.07, att=.05)

# Light turns on: a glassy ping.
sc.add(bell(hz('E6'), 3, .9, 2.0, 1.2), cues['lightOn'], .16, .35, rev=.6)
# Each whip pan whooshes across the stereo field.
for a, b in cues['whips']:
    sc.add(whip(b - a + .15), a - .05, .3, rev=.15)
# Each data point lands with a rising note: the melody follows the numbers.
scale = ['D4', 'E4', 'F#4', 'A4', 'B4', 'D5', 'E5', 'F#5', 'A5']
for i, t in enumerate(cues['pops']):
    sc.add(mallet(hz(scale[i % len(scale)]), .6, .16), t, .12, -.5 + i / max(1, len(cues['pops']) - 1), rev=.45)
sc.add(tick(3000, .03, .006), cues['callout'], .1, .4, rev=.3)
# Build into the end card, hit, then chimes as the title and link appear.
sc.add(riser(.9), flash - .9, .3, rev=.3)
sc.add(boom(2.4, 66, 30, .7), flash, .55, rev=.4)
for k, nt in enumerate(['D5', 'F#5', 'A5', 'D6']):
    sc.add(bell(hz(nt), 2.4, .9, 2.0, 1.1), fin + .22 + k * .2, .085, -.4 + .25 * k, rev=.7)
sc.add(bell(hz('D6'), 2.4, .9, 3.5, 1.2), cues['url'], .08, .5, rev=.8)

sc.write(sys.argv[2])
