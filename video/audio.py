"""Sound design for the 15 s optogenetics film.

Everything is synthesised with numpy from the cue times that motion.html exports
(cues.json): each timeline event, light pulse and spike lands on its frame.
usage: python3 audio.py cues.json out.wav
"""
import json
import sys
import wave

import numpy as np

SR = 48000
cues = json.load(open(sys.argv[1]))
DUR = cues['dur']
N = int(SR * DUR)
rng = np.random.default_rng(1866)

dry = np.zeros((2, N))
wet = np.zeros((2, N))  # reverb send


def tt(d):
    return np.arange(int(d * SR)) / SR


def add(sig, t, gain=1.0, pan=0.0, rev=0.0):
    """Place a mono or stereo signal at time t (equal-power pan, optional reverb send)."""
    i = int(round(t * SR))
    if sig.ndim == 1:
        a = np.cos((pan + 1) * np.pi / 4)
        b = np.sin((pan + 1) * np.pi / 4)
        sig = np.vstack([sig * a, sig * b])
    s0 = max(0, -i)
    i = max(0, i)
    n = min(sig.shape[1] - s0, N - i)
    if n <= 0:
        return
    dry[:, i:i + n] += sig[:, s0:s0 + n] * gain
    if rev:
        wet[:, i:i + n] += sig[:, s0:s0 + n] * gain * rev


def fft_filter(x, gain_fn):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(X * gain_fn(np.maximum(f, 1e-3)), len(x))


def lowpass(x, fc, order=2):
    return fft_filter(x, lambda f: 1 / np.sqrt(1 + (f / fc) ** (2 * order)))


def highpass(x, fc, order=2):
    return fft_filter(x, lambda f: 1 / np.sqrt(1 + (fc / f) ** (2 * order)))


def stft_filter(x, gain_tf, n=2048, hop=512):
    """Time-varying filter: gain_tf(t_seconds, freqs) -> gain per bin."""
    win = np.hanning(n)
    pad = np.concatenate([np.zeros(n), x, np.zeros(n)])
    frames = (len(pad) - n) // hop + 1
    out = np.zeros(len(pad))
    norm = np.zeros(len(pad))
    f = np.fft.rfftfreq(n, 1 / SR)
    for k in range(frames):
        s = k * hop
        seg = pad[s:s + n] * win
        tc = (s + n / 2 - n) / SR
        y = np.fft.irfft(np.fft.rfft(seg) * gain_tf(tc, np.maximum(f, 1)), n)
        out[s:s + n] += y * win
        norm[s:s + n] += win ** 2
    out = out / np.maximum(norm, 1e-6)
    return out[n:n + len(x)]


def env_ar(d, a, r):
    t = tt(d)
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) / r)


def bell(f, d=2.0, tau=.6, ratio=3.5, idx=1.6):
    t = tt(d)
    mod = idx * np.exp(-t / (tau * .45)) * np.sin(2 * np.pi * f * ratio * t)
    return np.sin(2 * np.pi * f * t + mod) * np.exp(-t / tau) * np.minimum(1, t / .003)


def mallet(f, d=.5, tau=.14):
    t = tt(d)
    s = np.sin(2 * np.pi * f * t) + .4 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t / .05) + .2 * np.sin(2 * np.pi * 3.98 * f * t) * np.exp(-t / .018)
    return s * np.exp(-t / tau) * np.minimum(1, t / .0015)


def sweep(f0, f1, d, curve='exp'):
    t = tt(d)
    if curve == 'exp':
        f = f0 * (f1 / f0) ** (t / d)
    else:
        f = f0 + (f1 - f0) * t / d
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def noise(d):
    return rng.standard_normal(int(d * SR))


def whoosh(d, f0, f1, q=.45, peak=.55):
    x = noise(d)
    y = stft_filter(x, lambda tc, f: np.exp(-(np.log(f / (f0 * (f1 / f0) ** np.clip(tc / d, 0, 1))) / q) ** 2))
    t = tt(d) / d
    e = np.where(t < peak, (t / peak) ** 2, ((1 - t) / (1 - peak)) ** 1.5)
    return y * e / (np.abs(y).max() + 1e-9)


def boom(d=1.6, f0=72, f1=34, tau=.5):
    t = tt(d)
    f = f1 + (f0 - f1) * np.exp(-t / .18)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / tau) * np.minimum(1, t / .004)
    hit = lowpass(noise(d), 1800) * np.exp(-t / .05)
    return s + .35 * hit / (np.abs(hit).max() + 1e-9)


def hz(note):
    names = {'C': -9, 'C#': -8, 'D': -7, 'D#': -6, 'E': -5, 'F': -4, 'F#': -3, 'G': -2, 'G#': -1, 'A': 0, 'A#': 1, 'Bb': 1, 'B': 2}
    n, o = note[:-1], int(note[-1])
    return 440 * 2 ** ((names[n] + 12 * (o - 4)) / 12)


# ------------------------------------------------------------------ pad
def pad_note(f, t0, t1, bright, att=.35, rel=.6, gain=1.0):
    """Additive saw-like voice with a time-varying brightness (harmonic roll-off)."""
    d = t1 - t0 + rel
    t = tt(d)
    tg = t + t0
    fc = bright(tg)
    out = np.zeros(len(t))
    for det in (-.0025, .0, .0031):
        ph = rng.random() * 6.28
        for n in range(1, 13):
            a = (1 / n) / np.sqrt(1 + (n * f / fc) ** 4)
            out += a * np.sin(2 * np.pi * n * f * (1 + det) * t + ph * n)
    e = np.minimum(1, t / att) * np.clip((t1 - t0 + rel - t) / rel, 0, 1) ** 1.5
    e *= 1 + .08 * np.sin(2 * np.pi * .7 * t + rng.random() * 6)
    return out * e * gain / 3


def bright_curve(points):
    xs, ys = zip(*points)
    return lambda t: np.interp(t, xs, ys)


amber0, amber1 = cues['amber']
B = bright_curve([(0, 380), (2.7, 900), (4.85, 1100), (6.9, 1700), (7.7, 1400), (amber0, 1300), (amber0 + .1, 520), (amber1, 520), (amber1 + .15, 1300),
                  (10.55, 1500), (12.5, 2600), (12.6, 3400), (15, 1600)])
chords = [
    (0.05, 4.95, ['D2', 'A2', 'D3', 'E3', 'F3', 'A3'], .55),
    (4.85, 7.75, ['Bb1', 'F2', 'Bb2', 'D3', 'F3', 'A3'], .5),
    (7.65, 10.6, ['G1', 'D2', 'G2', 'D3', 'F3', 'A3', 'Bb3'], .48),
    (10.5, 12.5, ['A1', 'E2', 'A2', 'D3', 'E3', 'A3'], .5),
    (12.12, 12.55, ['A1', 'E2', 'A2', 'C#3', 'E3', 'A3'], .5),
    (12.55, 15.2, ['D1', 'D2', 'A2', 'D3', 'F#3', 'A3', 'D4', 'F#4'], .62),
]
for t0, t1, notes, g in chords:
    for nt in notes:
        f = hz(nt)
        add(pad_note(f, t0, t1, B, att=.05 if t0 == 12.55 else .35, rel=.5, gain=g * (.7 if f < 100 else 1)), t0, gain=.062, pan=rng.uniform(-.35, .35), rev=.25)

# underwater bed under the algae
bed = lowpass(noise(3.2), 500, 2)
bed = bed / np.abs(bed).max() * env_ar(3.2, .6, .9)
add(bed, 0, gain=.05, rev=.2)

# ------------------------------------------------------------------ scene 1
add(bell(hz('E6'), 3, .9, 2.0, 1.2), cues['lightOn'], .16, .35, rev=.6)
add(bell(hz('B6'), 2.5, .7, 2.0, .9), cues['lightOn'] + .03, .07, .45, rev=.6)
for i in range(150):
    t = .15 + 2.5 * rng.random() ** .8
    d = .03
    g = np.sin(2 * np.pi * rng.uniform(1800, 5200) * tt(d)) * np.hanning(int(d * SR))
    add(g, t, .015 + .02 * rng.random(), rng.uniform(-.8, .8), rev=.4)
add(mallet(hz('A5'), .3, .05), cues['callout'], .06, .2, rev=.3)
add(mallet(hz('E6'), .3, .05), cues['callout'] + .07, .05, .25, rev=.3)
z0, z1 = cues['zoom']
w = whoosh(z1 - z0 + .1, 180, 3800, q=.5, peak=.92)
add(w, z0, .26, rev=.25)
add(sweep(140, 900, z1 - z0) * np.linspace(0, 1, int((z1 - z0) * SR)) ** 3, z0, .06)
add(boom(1.2, 90, 40, .25), z1 - .02, .32, rev=.3)

# ------------------------------------------------------------------ scene 2
p0, hit = cues['photon']
d = hit - p0
t = tt(d)
chirp = np.sin(2 * np.pi * np.cumsum(1500 * (1.6) ** (t / d) + 120 * np.sin(2 * np.pi * 14 * t)) / SR) * (t / d) ** 1.5
add(chirp, p0, .05, .5, rev=.4)
zap = highpass(noise(.12), 3000) * np.exp(-tt(.12) / .01)
add(zap, hit, .22, 0)
add(bell(hz('A5'), 2.4, .7, 3.5, 2.2), hit, .17, 0, rev=.7)
add(bell(hz('E6'), 2.0, .5, 3.5, 1.4), hit + .01, .08, .1, rev=.7)
add(sweep(2400, 180, .22) * np.exp(-tt(.22) / .08), hit, .08)
add(boom(1.0, 120, 45, .2), hit, .18)
for i, ti in enumerate(cues['ions']):
    f = rng.uniform(700, 1500)
    add(np.sin(2 * np.pi * f * tt(.04)) * np.exp(-tt(.04) / .007), ti, .05, rng.uniform(-.4, .4), rev=.25)
# inside goes positive: a soft rising tone under the stream
add(sweep(220, 330, 1.2) * env_ar(1.2, .5, .4), hit + .4, .035, rev=.3)

for a, b in cues['whips']:
    w = whoosh(b - a + .15, 400, 2600, q=.55, peak=.5)
    st = np.vstack([w * np.linspace(.3, 1, len(w)), w * np.linspace(1, .3, len(w))])
    add(st, a - .05, .3, rev=.15)

# ------------------------------------------------------------------ scene 3 (timeline)
scale = ['D4', 'E4', 'F#4', 'A4', 'B4', 'D5', 'E5', 'F#5']
play0 = min(p['t'] for p in cues['pops'])
play1 = max(p['t'] for p in cues['pops'])
for p in cues['pops']:
    f = hz(scale[p['lane']])
    pan = -.7 + 1.4 * (p['t'] - play0) / (play1 - play0 + 1e-6)
    if p['ms']:
        add(mallet(f, .9, .28), p['t'], .13, pan, rev=.5)
        add(mallet(2 * f, .6, .15), p['t'], .06, pan, rev=.5)
    else:
        add(mallet(f, .4, .09), p['t'], .075, pan, rev=.35)
c0, c1 = cues['conv']
rs = stft_filter(noise(c1 - c0), lambda tc, f: np.exp(-(np.log(f / (300 * 20 ** np.clip(tc / (c1 - c0), 0, 1))) / .6) ** 2))
rs = rs / np.abs(rs).max() * np.linspace(0, 1, len(rs)) ** 2.5
add(rs, c0, .2, rev=.3)
for k, nt in enumerate(['D5', 'F#5', 'A5', 'D6']):
    add(bell(hz(nt), 2.2, .7, 2.0, 1.0), c1 + k * .012, .07, -.5 + k * .1, rev=.6)
add(boom(1.0, 80, 40, .22), c1, .2)

# ------------------------------------------------------------------ scene 4 (neuron)
for tp in cues['pulses']:
    add(np.sin(2 * np.pi * 5200 * tt(.012)) * np.exp(-tt(.012) / .0018), tp, .045, -.35)


def spike_pop():
    d = .09
    t = tt(d)
    s = np.zeros(len(t))
    n1, n2 = int(.0011 * SR), int(.0019 * SR)
    s[:n1] = np.sin(np.pi * np.arange(n1) / n1)
    s[n1:n1 + n2] = -.55 * np.sin(np.pi * np.arange(n2) / n2)
    body = .45 * np.sin(2 * np.pi * 170 * t) * np.exp(-t / .022)
    crack = highpass(noise(d), 2500) * np.exp(-t / .0035)
    return s + body + .35 * crack / np.abs(crack).max()


for ts in cues['spikes']:
    add(spike_pop(), ts + .004, .34, -.3, rev=.18)
    add(mallet(hz('D6'), .25, .05), ts + .004, .018, -.2, rev=.3)
d = amber1 - amber0 + .3
t = tt(d)
hum = (np.sin(2 * np.pi * 98 * t) + .5 * np.sin(2 * np.pi * 147.5 * t) + .3 * np.sin(2 * np.pi * 196.4 * t)) * (1 + .15 * np.sin(2 * np.pi * 5 * t))
hum *= np.minimum(1, t / .08) * np.clip((d - t) / .25, 0, 1)
add(hum, amber0, .07, -.2, rev=.2)
add(sweep(900, 260, .3) * env_ar(.3, .02, .12), amber0, .05, -.2, rev=.3)

zo0, zo1 = cues['zoomOut']
w = whoosh(zo1 - zo0 + .1, 3000, 250, q=.55, peak=.4)
add(w, zo0, .22, rev=.25)
add(boom(1.0, 70, 38, .25), zo1 - .03, .16, rev=.2)

# ------------------------------------------------------------------ scene 5 (circuits)
for k, (tb, nt) in enumerate(zip(cues['beats'], ['A4', 'D5', 'F#5'])):
    add(bell(hz(nt), 1.8, .55, 3.0, 1.8), tb, .1, -.2 + .2 * k, rev=.6)
    add(bell(hz(nt) * 2, 1.2, .3, 3.0, 1.0), tb + .01, .03, .1, rev=.6)
    if k:
        add(sweep(500, 1600, .3) * env_ar(.3, .05, .1), tb + .05, .03, .2, rev=.4)

# ------------------------------------------------------------------ scene 6 (clinic) and the riser
b0, bh = cues['beam']
add(sum(np.sin(2 * np.pi * f * tt(bh - b0 + .05)) for f in (1320, 1980, 2640)) * np.linspace(0, 1, int((bh - b0 + .05) * SR)) ** 2, b0, .022, -.4, rev=.5)
add(bell(hz('A5'), 2, .6, 2.0, 1.2), bh, .12, .4, rev=.7)
add(bell(hz('E6'), 2, .5, 2.0, 1.0), bh + .02, .07, .5, rev=.7)
add(sweep(600, 2400, .4) * env_ar(.4, .1, .15), bh + .05, .04, .7, rev=.4)
fl = cues['flash']
rd = .95
rs = stft_filter(noise(rd), lambda tc, f: np.exp(-(np.log(f / (250 * 30 ** np.clip(tc / rd, 0, 1))) / .7) ** 2))
rs = rs / np.abs(rs).max() * np.linspace(0, 1, len(rs)) ** 3
add(rs, fl - rd, .3, rev=.3)
add(sweep(220, 880, rd) * np.linspace(0, 1, int(rd * SR)) ** 3, fl - rd, .05, rev=.3)

# ------------------------------------------------------------------ finale
add(boom(2.4, 66, 30, .7), fl, .55, rev=.4)
imp = lowpass(noise(1.5), 5000) * np.exp(-tt(1.5) / .12)
add(imp / np.abs(imp).max(), fl, .1, rev=1.0)
fin = cues['fin']
for k, nt in enumerate(['D5', 'F#5', 'A5', 'D6']):
    add(bell(hz(nt), 2.4, .9, 2.0, 1.1), fin + .22 + k * .2, .085, -.4 + .25 * k, rev=.7)
add(bell(hz('A6'), 2.0, .7, 2.0, .8), cues['names'], .045, .3, rev=.8)
add(bell(hz('D6'), 2.4, .9, 3.5, 1.2), cues['url'], .08, .5, rev=.8)
add(bell(hz('F#6'), 2.2, .8, 3.5, 1.0), cues['url'] + .04, .045, .6, rev=.8)
# the word "switch" flickers on: a light click, then a soft ping
add(highpass(noise(.02), 2000) * np.exp(-tt(.02) / .002), cues['switchGlow'], .12, -.1)
add(bell(hz('B6'), 1.5, .5, 2.0, .6), cues['switchGlow'] + .01, .05, -.1, rev=.8)

# ------------------------------------------------------------------ reverb + master
ir_d = 2.6
t = tt(ir_d)
ir = np.vstack([rng.standard_normal(len(t)), rng.standard_normal(len(t))]) * np.exp(-t / .6)
ir = np.vstack([lowpass(ir[0], 5500, 1), lowpass(ir[1], 5500, 1)])
ir[:, :int(.018 * SR)] = 0
ir /= np.sqrt((ir ** 2).sum(axis=1, keepdims=True))
L = 1 << int(np.ceil(np.log2(N + ir.shape[1])))
rev = np.vstack([np.fft.irfft(np.fft.rfft(wet[c], L) * np.fft.rfft(ir[c], L), L)[:N] for c in range(2)])
mix = dry + .55 * rev
mix = np.vstack([highpass(mix[0], 28, 2), highpass(mix[1], 28, 2)])
mix /= np.abs(mix).max()
mix = np.tanh(mix * 1.1) / np.tanh(1.1)
fade = np.ones(N)
fade[:int(.01 * SR)] = np.linspace(0, 1, int(.01 * SR))
tail = int(.45 * SR)
fade[-tail:] = np.linspace(1, 0, tail) ** 1.5
mix *= fade * .89
pcm = (np.clip(mix.T, -1, 1) * 32767).astype('<i2')
with wave.open(sys.argv[2], 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print('wrote', sys.argv[2], f'{N / SR:.2f}s')
