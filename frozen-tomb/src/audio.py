import json, sys, numpy as np, soundfile as sf
NOVO = 'novo' in sys.argv
from scipy.signal import butter, sosfilt, fftconvolve

SR = 48000; DUR = 74.0; N = int(DUR * SR)
rng = np.random.default_rng(4)
EV = json.load(open('events.json'))['ev']
TL = json.load(open('timeline.json'))

mus = np.zeros((N, 2)); sfx = np.zeros((N, 2))
def mf(m): return 440 * 2 ** ((m - 69) / 12)
def put(buf, t0, sig, pan=0.0, g=1.0):
    i = int(t0 * SR)
    if sig.ndim == 1:
        L = np.cos((pan + 1) * np.pi / 4); R = np.sin((pan + 1) * np.pi / 4)
        sig = np.stack([sig * L * 1.414, sig * R * 1.414], 1)
    if i < 0: sig = sig[-i:]; i = 0
    n = min(len(sig), N - i)
    if n > 0: buf[i:i + n] += sig[:n] * g
def lp(x, f, o=2): return sosfilt(butter(o, f, 'low', fs=SR, output='sos'), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, 'high', fs=SR, output='sos'), x)
def bp(x, a, b, o=2): return sosfilt(butter(o, [a, b], 'band', fs=SR, output='sos'), x)
def env(n, a, r, curve=1.0):
    e = np.ones(n); na = max(1, int(a * SR)); nr = max(1, int(r * SR))
    e[:na] = np.linspace(0, 1, na) ** curve
    e[-nr:] *= np.linspace(1, 0, nr) ** curve
    return e
def tt(d): return np.arange(int(d * SR)) / SR
def noise(d): return rng.standard_normal(int(d * SR))
def sweep_lp(x, f0, f1, blk=480):
    out = np.zeros_like(x); zi = None; nb = len(x) // blk + 1
    for k in range(nb):
        f = f0 * (f1 / f0) ** (k / max(1, nb - 1))
        sos = butter(2, min(f, SR / 2.2), 'low', fs=SR, output='sos')
        if zi is None: zi = np.zeros((sos.shape[0], 2))
        seg = x[k * blk:(k + 1) * blk]
        if len(seg) == 0: break
        y, zi = sosfilt(sos, seg, zi=zi); out[k * blk:k * blk + len(seg)] = y
    return out

# ------------------------------------------------------------ music
def pad(notes, t0, d, g, bright=1800, att=1.2, rel=1.6, pan_spread=.5):
    t = tt(d); L = np.zeros(len(t)); R = np.zeros(len(t))
    for j, m in enumerate(notes):
        for k, det in enumerate((-.09, 0, .09)):
            f = mf(m) * 2 ** (det / 12); s = np.zeros(len(t)); ph = rng.random() * 6.28
            for h in range(1, 8): s += np.sin(2 * np.pi * f * h * t + ph * h) / h
            p = (k - 1) * pan_spread
            L += s * (1 - p) ; R += s * (1 + p)
    e = env(len(t), att, rel, 1.5)
    L = lp(L, bright) * e; R = lp(R, bright) * e
    put(mus, t0, np.stack([L, R], 1) / (len(notes) * 6), g=g)
def pluck(m, t0, d, g, cut=1200, pan=0):
    t = tt(d); f = mf(m)
    s = sum(np.sin(2 * np.pi * f * h * t) / h for h in range(1, 10))
    s = lp(s, cut) * np.exp(-t * 7)
    put(mus, t0, s, pan, g)
def bell(m, t0, g, pan=0, d=2.5):
    t = tt(d); f = mf(m)
    s = np.sin(2 * np.pi * f * t) + .5 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 3) + .3 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 6)
    s *= np.exp(-t * 1.6) * env(len(t), .004, .2)
    put(mus, t0, s, pan, g)
def kick(t0, g):
    t = tt(.5); f = 45 + 90 * np.exp(-t * 30)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 8)
    put(mus, t0, s, 0, g)
def hat(t0, g, pan=0):
    s = hp(noise(.06), 7000) * np.exp(-tt(.06) * 70); put(mus, t0, s, pan, g)

BAR = 60 / 90 * 4; BEAT = BAR / 4
Dm = [50, 53, 57, 62]; Bb = [46, 53, 58, 62]; F = [48, 53, 57, 60]; C = [48, 52, 55, 60]; Eb = [51, 55, 58, 63]; Gm = [50, 55, 58, 62]
roots = {id(Dm): 38, id(Bb): 34, id(F): 41, id(C): 36, id(Eb): 39, id(Gm): 43}
# A: intro / map / toilet
t = 0.0
for ch in [Dm, Bb, Dm, C, Dm]:
    pad(ch, t, BAR + 1.6, .55, bright=1300); t += BAR
pad([26, 38], 0, 12.6, .5, bright=300, att=2, rel=1.5)
for k in range(14):
    bell(rng.choice([74, 77, 81, 84, 86]), .8 + k * .85 + rng.random() * .3, .05, pan=rng.uniform(-.8, .8))
# B: drinking water / repurpose / sewage (12.15–42.6)
t0 = 12.15; t = t0; prog = [Dm, Bb, F, C]; i = 0
while t < 42.6:
    ch = prog[i % 4]; pad(ch, t, BAR + 1.4, .5, bright=1600 + 600 * (t > 30)); r = roots[id(ch)]
    for b in range(8):
        tb = t + b * BEAT / 2
        if tb >= 42.6: break
        pluck(r, tb, .4, .30 if b % 2 == 0 else .2, cut=700 + 500 * ((t - t0) / 30))
        if tb > 14.3 and b % 2 == 0: kick(tb, .45)
        if tb > 23 : hat(tb + BEAT / 4, .05, pan=.3)
        if tb > 30 and b % 4 == 2: pluck(r + 24 + [0, 3, 7, 10][(b + i) % 4], tb, .5, .07, cut=3000, pan=-.4)
    t += BAR; i += 1
# C: threat (42.6–53.2)
t = 42.6; i = 0
while t < 50.36:
    ch = [Dm, Eb][i % 2]; pad(ch, t, BAR + 1.0, .6, bright=2400); r = roots[id(ch)]
    for b in range(16):
        tb = t + b * BEAT / 4
        if tb >= 50.36: break
        pluck(r, tb, .25, .28, cut=900 + 120 * (tb - 42.6))
        if b % 4 == 0: kick(tb, .55)
        if b % 2 == 1: hat(tb, .06)
    t += BAR; i += 1
pad([26, 33, 38], 50.36, 3.4, .7, bright=500, att=.05, rel=1.5)
# D: cooling + freeze (53.2–61)
pad([62, 69, 72, 76], 53.18, 8.2, .45, bright=3500, att=1.5, rel=2.5)
pad([38, 45], 53.18, 8.2, .4, bright=400, att=1, rel=2.5)
arp = [74, 77, 81, 84, 88, 84, 81, 77]
for k in range(int((61 - 54.2) / (BEAT / 2))):
    bell(arp[k % 8], 54.2 + k * BEAT / 2, .07 + .05 * (k / 20), pan=np.sin(k * .7) * .6, d=2)
# E/F: final (65.2–74)
pad([38, 45, 50, 52, 57, 62], 65.4, 8.6, .7, bright=2200, att=.4, rel=4)
pad([26, 38], 65.4, 8.6, .7, bright=250, att=.2, rel=4)
for k in range(10): bell([74, 81, 76, 69, 74, 86, 81, 77, 74, 69][k], 66.2 + k * .55, .06, pan=np.sin(k) * .7, d=3)

# rewind: reversed + pitched-up music snippet, fast-forward chirp
def resample(x, ratio):
    idx = np.arange(0, len(x) - 1, ratio); i0 = idx.astype(int); fr = idx - i0
    return x[i0] * (1 - fr[:, None]) + x[i0 + 1] * fr[:, None]
rw0 = EV['rewind'][0]; ff0 = EV['ff'][0]
mus[int(rw0 * SR):int(65.4 * SR)] *= np.linspace(1, .25, int(65.4 * SR) - int(rw0 * SR))[:, None] ** 0
mus[int(rw0 * SR):int(65.3 * SR)] *= .15
snip = mus[int(30 * SR):int(52 * SR)][::-1]; rr = resample(snip, 22 / 2.3)
put(mus, rw0, rr[:int(2.3 * SR)] * env(len(rr[:int(2.3 * SR)]), .05, .2)[:, None], g=1.0)
snip2 = mus[int(23 * SR):int(60 * SR)]; r2 = resample(snip2, 37 / .85)
put(mus, ff0, r2[:int(.85 * SR)] * env(len(r2[:int(.85 * SR)]), .05, .1)[:, None], g=.9)

# ------------------------------------------------------------ sfx
def whoosh(t0, d=.9, g=.5, up=True, pan=0):
    n = noise(d); f0, f1 = (300, 6000) if up else (6000, 200)
    s = sweep_lp(n, f0, f1) * np.sin(np.linspace(0, np.pi, len(n))) ** 2
    L = s * np.linspace(1.2 - pan, .8 + pan, len(s)); R = s * np.linspace(.8 + pan, 1.2 - pan, len(s))
    put(sfx, t0, np.stack([L, R], 1), g=g)
def boom(t0, g=1.0, d=2.5):
    t = tt(d); f = 32 + 60 * np.exp(-t * 6)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.2)
    s += lp(noise(d), 400) * np.exp(-t * 5) * .6
    put(sfx, t0, s * env(len(s), .002, .3), g=g)
def click(t0, g=.3, f=2500, d=.03, pan=0):
    t = tt(d); s = np.sin(2 * np.pi * f * t) * np.exp(-t * 200) + hp(noise(d), 3000) * np.exp(-t * 300) * .5
    put(sfx, t0, s, pan, g)
def blip(t0, g=.15, f=1320, d=.12, pan=.2):
    t = tt(d); s = (np.sin(2 * np.pi * f * t) + .4 * np.sin(2 * np.pi * f * 2 * t)) * np.exp(-t * 35)
    put(sfx, t0, s, pan, g)

# wind bed (intro + map)
w = lp(noise(12.5), 900) ; w *= (0.6 + .4 * np.sin(tt(12.5) * .9)) * env(len(w), 1.5, 2)
put(sfx, 0, w, 0, .25)
for t0 in EV['whoosh']: whoosh(t0 - .45, .9, .55)
whoosh(EV['dive'][0] - .2, 1.9, .7, up=False)
put(sfx, EV['dive'][0], lp(noise(2.2), 150) * env(int(2.2 * SR), .5, 1.2), 0, .6)
# sewage word appear + disperse
blip(EV['pop'][0], .25, 660, .4, 0); blip(EV['pop'][0] + .05, .15, 990, .4, .3)
for k in range(140):
    tk = EV['disperse'][0] + rng.random() ** 1.5 * 1.3
    blip(tk, .03, rng.uniform(2500, 7000), .05, rng.uniform(-.9, .9))
whoosh(EV['disperse'][0], 1.3, .35)
# map: counter ticks
tk = EV['tick'][0]; tb = EV['boom'][0]
k = 0
while tk < tb:
    click(tk, .12, 3200, pan=.5); k += 1; tk += max(.035, .16 * .93 ** k)
for t0 in EV['boom']: boom(t0, 1.0)
# flush
d = 1.9; n = noise(d); s = bp(n, 250, 2200) * (0.6 + .4 * np.sin(2 * np.pi * np.cumsum(np.linspace(5, 16, len(n))) / SR))
s *= env(len(s), .25, .7)
put(sfx, EV['flush'][0], s, 0, .55)
put(sfx, EV['flush'][0] + 1.3, lp(noise(.8), 300) * env(int(.8 * SR), .05, .6), 0, .5)
blip(10.6, .15, 1500)
# drill hum + melt bubbles
d = 22.7 - EV['drill'][0]; t = tt(d)
s = sum(np.sin(2 * np.pi * 58 * h * t) / h for h in range(1, 6)) * (0.7 + .3 * np.sin(2 * np.pi * 7 * t))
put(sfx, EV['drill'][0], lp(s, 600) * env(len(s), .6, 1.5), 0, .18)
for k in range(70):
    tk = EV['melt'][0] + rng.random() * 5.3; bd = .08; t = tt(bd); f0 = rng.uniform(250, 700)
    put(sfx, tk, np.sin(2 * np.pi * np.cumsum(f0 * (1 + 3 * t / bd)) / SR) * np.exp(-t * 40), rng.uniform(-.5, .5), .07)
put(sfx, EV['melt'][0], bp(noise(5.5), 2000, 6000) * env(int(5.5 * SR), 1, 1), 0, .05)
# pump thumps
for k in range(7): put(sfx, EV['pump'][0] + .3 + k * .58, lp(noise(.25), 180) * np.exp(-tt(.25) * 14), 0, .45)
# fuel tension
d = 3.3; t = tt(d); f = 110 * 2 ** (t / d * 1.0)
s = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)); s = lp(s, 1200) * env(len(s), 1.5, .4)
put(sfx, EV['fuel'][0], s, .2, .06)
# abandon stamp
st = EV['stamp'][0]; boom(st, .6, 1.2); click(st, .5, 900, .08)
# split-flap
for k in range(14): click(EV['flip'][0] + k * .045 + rng.random() * .01, .14, rng.uniform(1800, 3200), pan=.5)
# grinder
d = 39.8 - EV['grind'][0]; t = tt(d)
s = np.sign(np.sin(2 * np.pi * 95 * t + 3 * np.sin(2 * np.pi * 21 * t))) * (0.6 + .4 * np.sin(2 * np.pi * 19 * t))
put(sfx, EV['grind'][0], lp(s, 900) * env(len(s), .3, .6), .4, .12)
# sludge pour + splash
d = 42.9 - EV['pour'][0]; s = lp(noise(d), 500) * (0.7 + .3 * np.sin(tt(d) * 9)) * env(int(d * SR), .4, .8)
put(sfx, EV['pour'][0], s, 0, .35)
put(sfx, 42.75, lp(noise(.6), 900) * np.exp(-tt(.6) * 8), 0, .55)
for t0 in EV['callout']: blip(t0, .12, 1760)
for t0 in [23.1, 39.3]: blip(t0, .12, 1320)
# thermal switch + hum
th = EV['therm'][0]; whoosh(th - .3, .5, .4, up=False)
d = 55.8 - th; t = tt(d); s = np.sin(2 * np.pi * 120 * t) * .5 + np.sin(2 * np.pi * 240 * t) * .2
put(sfx, th, s * env(len(s), .3, 2.0), 0, .05)
# alarms
for k in range(int((46.0 - EV['alarm'][0]) / .5)):
    t = tt(.16); put(sfx, EV['alarm'][0] + k * .5, np.sign(np.sin(2 * np.pi * 880 * t)) * env(len(t), .005, .02) * .5, .3, .07)
for k in range(int((53.1 - EV['alarm2'][0]) / .4)):
    t = tt(.38); f = 520 if k % 2 == 0 else 690
    put(sfx, EV['alarm2'][0] + k * .4, lp(np.sign(np.sin(2 * np.pi * f * t)), 2500) * env(len(t), .01, .05), -.3, .06)
# rumble build + collapse cracks
d = EV['boom'][1] - EV['rumble'][0]; s = lp(noise(d), 140) * np.linspace(0, 1, int(d * SR)) ** 2
put(sfx, EV['rumble'][0], s, 0, 1.2)
d = 3.8; put(sfx, EV['rumble'][0], hp(noise(d), 2000) * np.linspace(0, 1, int(d * SR)) ** 3, 0, .06)
for k in range(9): put(sfx, EV['boom'][1] + rng.random() * 1.6, hp(noise(.12), 1500) * np.exp(-tt(.12) * 40), rng.uniform(-.7, .7), .35)
put(sfx, EV['boom'][1], lp(noise(2.8), 220) * np.exp(-tt(2.8) * 1.3), 0, .8)
# cold wave
c0 = EV['cold'][0]
whoosh(c0 - .4, .6, .6, up=False)
d = 3.2; s = bp(noise(d), 5000, 11000) * env(int(d * SR), 2.4, .8, 2); put(sfx, c0 + .5, s, 0, .25)
d = 4.0; put(sfx, c0, lp(noise(d), 600) * env(int(d * SR), 1.5, 2), 0, .2)
# freeze crackle + crystal hit
f0 = EV['freeze'][0]
for k in range(260):
    tk = f0 + (rng.random() ** .7) * 2.0
    put(sfx, tk, hp(noise(.008), 4000) * np.exp(-tt(.008) * 500), rng.uniform(-.9, .9), .2)
im = EV['impact'][0]
for m in [86, 93, 98]: bell(m, im, .12, pan=rng.uniform(-.5, .5), d=3)
boom(im, .35, 1.5)
# rewind tape
d = 2.3; t = tt(d); f = 600 + 400 * np.sin(2 * np.pi * 9 * t); s = bp(noise(d), 800, 5000) * (0.5 + .5 * np.sin(2 * np.pi * np.cumsum(f) / SR / 20))
put(sfx, rw0, s * env(len(s), .05, .2), 0, .12)
d = .85; put(sfx, ff0, bp(noise(d), 1500, 8000) * env(int(d * SR), .05, .1), 0, .12)
# lock
lk = EV['lock'][0]; click(lk, .5, 1400, .05); click(lk + .09, .5, 1900, .05); bell(91, lk + .09, .08, d=1.5)
# answer hit + finale
boom(TL[14]['s'] - .02, .7, 3)
fi = EV['final'][0]; boom(fi, 1.0, 3.5)
for m in [62, 69, 74, 81]: bell(m, fi, .1, pan=rng.uniform(-.6, .6), d=3.5)
whoosh(fi - .6, .7, .4)

# ------------------------------------------------------------ mix
vo, vsr = sf.read('vo_full.wav')
vo = np.interp(np.arange(N) / SR, np.arange(len(vo)) / vsr, vo)
vo = hp(vo, 70); vo = vo / np.max(np.abs(vo)) * .8
# gentle VO compression-ish + room
venv = lp(np.abs(vo), 8); duck = 1 - .55 * np.clip(venv / (venv.max() * .35), 0, 1)
ir_t = tt(2.6); ir = np.stack([rng.standard_normal(len(ir_t)) * np.exp(-ir_t * 2.4) for _ in range(2)], 1); ir[:int(.01 * SR)] = 0
ir /= np.sqrt((ir ** 2).sum(0))
def reverb(x, wet):
    y = np.stack([fftconvolve(x[:, c], ir[:, c])[:N] for c in range(2)], 1)
    return x + y * wet
mus = reverb(mus, .35); sfx = reverb(sfx, .22)
mus /= np.max(np.abs(mus)) + 1e-9; sfx /= np.max(np.abs(sfx)) + 1e-9
if NOVO: mix = mus * .62 + sfx * .6
else: mix = np.stack([vo, vo], 1) * 1.0 + mus * .32 * duck[:, None] + sfx * .55
fade = np.ones(N); fade[-int(1.2 * SR):] = np.linspace(1, 0, int(1.2 * SR)) ** 1.5; fade[:int(.05 * SR)] = np.linspace(0, 1, int(.05 * SR))
mix *= fade[:, None]
mix = np.tanh(mix * 1.1) / np.tanh(1.1)
mix *= .93 / np.max(np.abs(mix))
sf.write('mix_novo.wav' if NOVO else 'mix.wav', mix.astype(np.float32), SR, subtype='FLOAT')
print('ok', mix.shape)
