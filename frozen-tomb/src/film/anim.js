// "The Frozen Tomb" — South Pole sewage motion graphic. render(t) is a pure function of time.
const V = new URLSearchParams(location.search).has('v');
const W = V ? 1080 : 1920, H = V ? 1920 : 1080, DUR = 74;
const O = (h, v) => V ? v : h;
const cv = document.getElementById('c');
cv.width = W; cv.height = H;
const ctx = cv.getContext('2d');
const TL = window.TL;

// ---------------------------------------------------------------- utils
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const P = (t, a, b) => clamp((t - a) / (b - a));
const E = {
  io: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  io2: t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  o3: t => 1 - Math.pow(1 - t, 3),
  i2: t => t * t,
  i3: t => t * t * t,
  oExp: t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t),
  iExp: t => t <= 0 ? 0 : Math.pow(2, 10 * t - 10),
  oBack: t => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
};
function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const NP = (() => { const r = rng(7), a = []; for (let i = 0; i < 1024; i++) a.push(r()); return a; })();
function noise(x) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(NP[i & 1023], NP[(i + 1) & 1023], u) * 2 - 1; }
function fbm(x) { return noise(x) * .6 + noise(x * 2.1 + 17) * .3 + noise(x * 4.3 + 41) * .1; }
const TAU = Math.PI * 2;

const F = { d: '"Inter Display","Inter",sans-serif', m: '"DejaVu Sans Mono","Liberation Mono",monospace' };
const font = (w, s, fam = F.d) => `${w} ${s}px ${fam}`;
const C = {
  bg: '#040a14', navy: '#0a1a2e', ice: '#bfefff', cyan: '#5fd4ff', cyan2: '#9be7ff', white: '#eef7ff',
  hot: '#ff6a2b', amber: '#ffb340', sewage: '#6e4f22', sewHi: '#a8823f', red: '#ff3d3d', water: '#2f9dff',
};
function txt(s, x, y, f, col, align = 'left', ls = 0, base = 'alphabetic') {
  ctx.font = f; ctx.fillStyle = col; ctx.textAlign = align; ctx.textBaseline = base;
  ctx.letterSpacing = ls + 'px'; ctx.fillText(s, x, y); ctx.letterSpacing = '0px';
}
function rrect(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// ---------------------------------------------------------------- captions + timing
const CAP = [
  "The South Pole station has a *genius* method for making *sewage* *disappear.*",
  "With *no* *ocean,* flying *millions* *of* *gallons* of wastewater out is *physically* *impossible.*",
  "So, follow a *single* *toilet* *flush* deep beneath the ice.",
  "It starts with *drinking* *water.*",
  "Engineers pump *heated* *water* underground, melting out a massive pool of fresh water called a *Rodriguez* *well.*",
  "Over time, pumping out this water makes the cavity *deeper* and *wider.*",
  "Eventually, it requires *too* *much* *fuel* to prevent freezing.",
  "So they *abandon* it, but they immediately *repurpose* this exhausted drinking water cavity.",
  "All the station's *raw* *sewage* is ground into a slurry and rerouted straight down into the *empty* *ice* *void.*",
  "This massive *thermal* *load* is incredibly *dangerous.*",
  "If the warm sewage melts upward through the *porous* *snow,* it can completely *collapse* the multi-million dollar buildings above.",
  "But the *−50°* ice eventually *neutralizes* the threat.",
  "Once the bulb fills up, the entire cavity *freezes* *solid.*",
  "So, what actually happens to that *single* *toilet* *flush* we tracked from the beginning?",
  "It is permanently locked inside an *impenetrable* *frozen* *tomb,* slowly creeping toward the coast.",
];
const CAPHOT = [1, 0, 0, 0, 1, 0, 1, 0, 1, 1, 1, 0, 0, 0, 0];
const capWords = CAP.map((s, i) => {
  const ws = s.split(' ').map(w => ({ hl: w.startsWith('*'), txt: w.replace(/\*/g, '') }));
  let tot = 0; ws.forEach(w => { w.wt = (w.txt === '−50°' ? 15 : w.txt.length + 2.6); tot += w.wt; });
  let c = 0; ws.forEach(w => { w.t = TL[i].s + (TL[i].e - TL[i].s) * c / tot; c += w.wt; });
  return ws;
});
function wt(li, str) { const w = capWords[li].find(w => w.txt.toLowerCase().replace(/[^a-z−0-9°]/g, '').startsWith(str.toLowerCase())); return w ? w.t : TL[li].s; }

const B = TL.map(l => l.s - 0.25); B[0] = 0;
const T = {
  map: B[1], toilet: B[2], world: wt(2, 'deep') - 0.45, drink: B[3], melt: B[4], deep: B[5], fuel: B[6],
  aband: B[7], sew: B[8], therm: B[9], coll: B[10], cool: B[11], freeze: B[12], rewind: B[13],
  ans: TL[14].s, sheet: 67.4, end: DUR,
};
const EV = {}; // sound events, exported for the audio mix
function ev(k, t) { (EV[k] = EV[k] || []).push(+t.toFixed(3)); return t; }

// ---------------------------------------------------------------- precomputed assets
const STARS = (() => { const r = rng(3), a = []; for (let i = 0; i < 420; i++) a.push({ x: r() * W, y: r() * H * .8, s: r() * 1.7 + .3, p: r() * TAU, b: r() }); return a; })();
let AUR1, AUR2, GRAIN = [], VIG, SEWP = [], FIRN = [], BUBBLES = [], CRYST = [], SNOWP = [], BUF, BUF2;

function makeAuroraSprite(c1, c2) {
  const c = mkCanvas(8, 256), g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(.55, c2); gr.addColorStop(.92, c1); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 8, 256); return c;
}
function init() {
  AUR1 = makeAuroraSprite('rgba(90,255,170,0.55)', 'rgba(60,200,255,0.18)');
  AUR2 = makeAuroraSprite('rgba(120,180,255,0.45)', 'rgba(170,90,255,0.15)');
  for (let k = 0; k < 4; k++) {
    const c = mkCanvas(512, 512), g = c.getContext('2d'), id = g.createImageData(512, 512), r = rng(100 + k);
    for (let i = 0; i < id.data.length; i += 4) { const v = r() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
    g.putImageData(id, 0, 0); GRAIN.push(c);
  }
  VIG = mkCanvas(W, H); { const g = VIG.getContext('2d'); const gr = g.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, H * 1.05); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.72)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
  BUF = mkCanvas(W, H); BUF2 = mkCanvas(W, H);
  // particle word
  { const c = mkCanvas(1400, 320), g = c.getContext('2d'); g.font = font(900, 250); g.textAlign = 'center'; g.textBaseline = 'middle'; g.letterSpacing = '12px'; g.fillStyle = '#fff'; g.fillText('SEWAGE', 700, 165);
    const d = g.getImageData(0, 0, 1400, 320).data, r = rng(11);
    for (let y = 0; y < 320; y += 5) for (let x = 0; x < 1400; x += 5) if (d[(y * 1400 + x) * 4 + 3] > 128) {
      const a = r() * TAU, sp = 120 + r() * 520; SEWP.push({ x: x - 700, y: y - 165, vx: Math.cos(a) * sp + 260, vy: Math.sin(a) * sp - 140, d: (x / 1400) * .45 + r() * .15, s: 2 + r() * 2.5, w: r() });
    } }
  { const r = rng(21); for (let i = 0; i < 5200; i++) FIRN.push({ x: -420 + r() * 840, y: r() * 52, r: .12 + r() * .4, a: .25 + r() * .55 }); }
  { const r = rng(22); for (let i = 0; i < 900; i++) BUBBLES.push({ x: -420 + r() * 840, y: 52 + r() * 380, r: .08 + r() * .25 }); }
  { const r = rng(23); for (let i = 0; i < 260; i++) SNOWP.push({ x: r() * W, y: r() * H, s: .6 + r() * 2.4, v: .5 + r(), p: r() * TAU }); }
  // ice crystal dendrites in normalised bulb space (unit circle-ish), threshold = growth order
  { const r = rng(31);
    const grow = (x, y, a, len, depth, t0) => {
      let px = x, py = y;
      const steps = 6 + Math.floor(r() * 5);
      for (let i = 0; i < steps; i++) {
        a += (r() - .5) * .35;
        const nx = px + Math.cos(a) * len, ny = py + Math.sin(a) * len;
        const t1 = t0 + len * 1.1;
        CRYST.push({ x1: px, y1: py, x2: nx, y2: ny, t0, t1, w: Math.max(.5, 2.2 - depth * .7) });
        if (depth < 2 && r() < .45) grow(nx, ny, a + (r() < .5 ? 1 : -1) * (0.9 + r() * .3), len * .6, depth + 1, t1);
        px = nx; py = ny; t0 = t1;
        if (px * px + py * py < .01) break;
      }
    };
    for (let i = 0; i < 40; i++) { const th = i / 40 * TAU + r() * .05; const k = 1 - .5 * Math.pow(Math.max(0, Math.cos(th)), 3); const x = Math.sin(th) * k, y = -Math.cos(th); grow(x, y, Math.atan2(-y, -x) + (r() - .5) * .5, .07, 0, r() * .08); }
  }
}
window.ready = document.fonts.load(font(900, 100)).then(() => document.fonts.load(font(400, 20, F.m))).then(init);

// ---------------------------------------------------------------- shared drawing
function drawStars(t, a = 1) {
  for (const s of STARS) { const tw = .55 + .45 * Math.sin(t * 2.3 + s.p * 3); ctx.fillStyle = `rgba(220,240,255,${a * tw * (.25 + .75 * s.b)})`; ctx.fillRect(s.x, s.y, s.s, s.s); }
}
function drawAurora(t, a, yBase) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 3; k++) {
    const spr = k === 1 ? AUR2 : AUR1;
    for (let x = -10; x < W + 10; x += 6) {
      const y = yBase + 90 * fbm(x * .0022 + t * .12 + k * 9) + 30 * Math.sin(x * .004 + t * .35 + k * 2);
      const h = 220 + 160 * fbm(x * .006 + k * 5 + t * .2);
      ctx.globalAlpha = a * clamp(.35 + .65 * (fbm(x * .01 - t * .4 + k * 3) * .5 + .5)) * (k === 2 ? .5 : 1);
      ctx.drawImage(spr, x, y - h, 7, h);
    }
  }
  ctx.restore();
}
// Amundsen–Scott elevated station, drawn in metres: origin = ground centre, y down.
function drawStation(t, o = {}) {
  const lit = o.lit ?? 1;
  // stilts
  ctx.fillStyle = '#3a4656';
  for (const x of [-30, -18, -6, 6, 18, 30]) ctx.fillRect(x - .6, -5, 1.2, 5.2);
  ctx.fillStyle = '#2b3442'; ctx.fillRect(-33, -5.4, 66, .8);
  // body
  ctx.beginPath(); ctx.moveTo(-36, -7.5); ctx.lineTo(-32.5, -5.2); ctx.lineTo(32.5, -5.2); ctx.lineTo(36, -7.5); ctx.lineTo(36, -15.2); ctx.lineTo(34.5, -16); ctx.lineTo(-34.5, -16); ctx.lineTo(-36, -15.2); ctx.closePath();
  const g = ctx.createLinearGradient(0, -16, 0, -5); g.addColorStop(0, '#dde6ee'); g.addColorStop(.5, '#a9b8c6'); g.addColorStop(1, '#6d7f92');
  ctx.fillStyle = g; ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(-36, -10.9, 72, .35);
  // panels
  ctx.fillStyle = 'rgba(40,55,70,.35)'; for (let x = -34; x < 34; x += 4.25) ctx.fillRect(x, -15.6, .12, 10);
  // windows
  const r = rng(5);
  for (const wy of [-14.2, -9.6]) for (let x = -33; x < 32.5; x += 2.15) {
    const on = r() < .78; const fl = on ? (0.75 + .25 * Math.sin(t * 3 + x)) * lit : .08;
    ctx.fillStyle = on ? `rgba(255,${190 + r() * 40 | 0},110,${fl})` : 'rgba(30,40,55,.8)';
    ctx.fillRect(x, wy, 1.2, 1.5);
  }
  // roof gear
  ctx.fillStyle = '#596879'; ctx.fillRect(-20, -17.2, 6, 1.2); ctx.fillRect(10, -17.6, 3, 1.6);
  ctx.fillStyle = '#7a8796'; ctx.fillRect(24, -24, .3, 8);
  const bl = (Math.sin(t * 5) > .3) ? 1 : .15; ctx.fillStyle = `rgba(255,60,60,${bl})`; ctx.beginPath(); ctx.arc(24.15, -24.2, .55, 0, TAU); ctx.fill();
  if (bl > .5) { ctx.fillStyle = 'rgba(255,60,60,.15)'; ctx.beginPath(); ctx.arc(24.15, -24.2, 2.4, 0, TAU); ctx.fill(); }
}

// ---------------------------------------------------------------- SCENE 1: intro
function sceneIntro(t) {
  const sky = ctx.createLinearGradient(0, 0, 0, 760); sky.addColorStop(0, '#01040b'); sky.addColorStop(.7, '#071a33'); sky.addColorStop(1, '#16375a');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  drawStars(t, .9);
  drawAurora(t, .75, O(430, 760));
  const z = 1 + .12 * E.io2(P(t, 0, 5.4)), HZ = O(760, 1200), DY = HZ - 760;
  ctx.save(); ctx.translate(W / 2, 700 + DY); ctx.scale(z, z); ctx.translate(-W / 2, -700 - DY);
  const sky2 = ctx.createLinearGradient(0, 0, 0, HZ); if (V) { sky2.addColorStop(0, 'rgba(0,0,0,0)'); sky2.addColorStop(1, 'rgba(0,0,0,0)'); }
  ctx.translate(0, DY);
  // horizon glow
  const hg = ctx.createRadialGradient(W / 2, 760, 10, W / 2, 760, 900); hg.addColorStop(0, 'rgba(120,190,255,.35)'); hg.addColorStop(1, 'rgba(120,190,255,0)');
  ctx.fillStyle = hg; ctx.fillRect(-100, -100, W + 200, H + 200);
  // snow plain
  const sn = ctx.createLinearGradient(0, 750, 0, H); sn.addColorStop(0, '#8fb2cf'); sn.addColorStop(.3, '#c7dcec'); sn.addColorStop(1, '#eef6ff');
  ctx.fillStyle = sn; ctx.fillRect(-50, 900, W + 100, H + 100); ctx.beginPath(); ctx.moveTo(-50, 760); for (let x = -50; x <= W + 50; x += 20) ctx.lineTo(x, 760 + 2 * noise(x * .01)); ctx.lineTo(W + 50, H + 50); ctx.lineTo(-50, H + 50); ctx.fill();
  ctx.strokeStyle = 'rgba(80,120,160,.18)'; ctx.lineWidth = 2;
  for (let i = 0; i < 14; i++) { const y = 790 + i * i * 2.2; ctx.beginPath(); for (let x = -50; x <= W + 50; x += 30) ctx.lineTo(x, y + 6 * noise(x * .006 + i * 3)); ctx.stroke(); }
  // ceremonial pole + flags
  const px = O(470, 150), gy = 830, FR = O(150, 100);
  for (let i = 0; i < 9; i++) { const a = Math.PI * (i / 8), fx = px + Math.cos(a) * FR, fy = gy - 8 + Math.sin(a) * 26; ctx.fillStyle = '#556'; ctx.fillRect(fx, fy - 70, 2, 70);
    const cols = ['#d33', '#36c', '#eee', '#2a6', '#fc3', '#d33', '#36c', '#eee', '#c22'];
    ctx.fillStyle = cols[i]; ctx.beginPath(); ctx.moveTo(fx + 2, fy - 70); for (let k = 0; k <= 6; k++) ctx.lineTo(fx + 2 + k * 5, fy - 70 + 3 * Math.sin(t * 6 + k * .9 + i)); for (let k = 6; k >= 0; k--) ctx.lineTo(fx + 2 + k * 5, fy - 54 + 3 * Math.sin(t * 6 + k * .9 + i)); ctx.fill(); }
  for (let y = 0; y < 90; y += 10) { ctx.fillStyle = (y / 10) % 2 ? '#eee' : '#c22'; ctx.fillRect(px - 4, gy - 90 + y, 8, 10); }
  const sg = ctx.createRadialGradient(px - 6, gy - 108, 2, px, gy - 100, 18); sg.addColorStop(0, '#fff'); sg.addColorStop(.4, '#9ab'); sg.addColorStop(1, '#234');
  ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(px, gy - 102, 16, 0, TAU); ctx.fill();
  // station
  ctx.save(); ctx.translate(O(1180, 660), 772); ctx.scale(O(9.5, 8.6), O(9.5, 8.6)); drawStation(t); ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.ellipse(O(1180, 660), 774, O(380, 340), 10, 0, 0, TAU); ctx.fill();
  ctx.restore();
  blowingSnow(t, 1);
  // title lockup
  const a = P(t, .25, 1.0) * (1 - P(t, 2.6, 3.1));
  if (a > 0) {
    ctx.globalAlpha = a;
    const yy = O(300, 520) + 20 * (1 - E.o3(P(t, .25, 1.2)));
    txt('90° 00′ 00″ S', W / 2, yy - 118, font(500, 22, F.m), C.cyan2, 'center', 10);
    txt('THE SOUTH POLE', W / 2, yy, font(800, O(104, 80)), '#fff', 'center', O(14, 8));
    ctx.fillStyle = C.cyan; ctx.fillRect(W / 2 - 220 * E.o3(P(t, .6, 1.4)), yy + 34, 440 * E.o3(P(t, .6, 1.4)), 2);
    if (V) { txt('ELEV 2,835 m  ·  AVG −49 °C', W / 2, yy + 80, font(500, 22, F.m), 'rgba(220,240,255,.8)', 'center', 4); txt('NO OCEAN FOR 1,300 km', W / 2, yy + 116, font(500, 22, F.m), 'rgba(220,240,255,.8)', 'center', 4); }
    else txt('ELEV 2,835 m   ·   AVG −49 °C   ·   NO OCEAN FOR 1,300 km', W / 2, yy + 80, font(500, 20, F.m), 'rgba(220,240,255,.8)', 'center', 4);
    ctx.globalAlpha = 1;
  }
  // SEWAGE particle word
  const ta = wt(0, 'sewage') - .15, td = wt(0, 'disappear') - .05;
  if (t > ta) {
    const ap = E.oBack(P(t, ta, ta + .45));
    ctx.save(); ctx.translate(W / 2, O(330, 640)); if (V) ctx.scale(.72, .72);
    for (const p of SEWP) {
      const q = P(t, td + p.d, td + p.d + 1.1); const e = E.i2(q);
      const x = p.x * (.8 + .2 * ap) + p.vx * e + 30 * Math.sin(p.w * 9 + t * 4) * e;
      const y = p.y * (.8 + .2 * ap) + p.vy * e - 40 * e * e;
      const al = clamp(ap) * (1 - q);
      if (al <= 0) continue;
      ctx.fillStyle = q > 0 ? `rgba(${lerp(255, 160, q) | 0},${lerp(225, 230, q) | 0},${lerp(170, 255, q) | 0},${al})` : `rgba(255,214,150,${al})`;
      const s = p.s * (1 - q * .6); ctx.fillRect(x, y, s, s);
    }
    ctx.restore();
  }
}
function blowingSnow(t, a) {
  for (const s of SNOWP) { const x = ((s.x + t * 380 * s.v) % (W + 40)) - 20, y = (s.y + 40 * Math.sin(t * s.v + s.p) + t * 30 * s.v) % H;
    ctx.fillStyle = `rgba(240,248,255,${a * .55 * s.v})`; ctx.fillRect(x, y, s.s * 2.2, s.s * .8); }
}

// ---------------------------------------------------------------- SCENE 2: map
const ANT = [[0, .95], [20, .97], [40, .98], [60, .93], [72, .8], [80, .9], [95, .97], [110, .99], [130, 1.0], [145, 1.0], [158, .93], [166, .74], [175, .6], [185, .57], [195, .6], [205, .72], [220, .86], [240, .87], [260, .85], [272, .82], [282, .9], [287, 1.08], [291, 1.36], [294, 1.5], [296.5, 1.42], [298.5, 1.08], [302, .84], [308, .64], [316, .56], [325, .6], [335, .78], [345, .9], [360, .95]];
function antR(lon) {
  lon = ((lon % 360) + 360) % 360;
  let i = 0; while (i < ANT.length - 2 && ANT[i + 1][0] < lon) i++;
  const [a0, r0] = ANT[i], [a1, r1] = ANT[i + 1], u = (lon - a0) / (a1 - a0), s = u * u * (3 - 2 * u);
  return lerp(r0, r1, s) * (1 + .03 * noise(lon * .25) + .015 * noise(lon * 1.4 + 5));
}
function antPt(cx, cy, R, lon, rr) { const a = lon * Math.PI / 180; return [cx + rr * R * Math.sin(a), cy - rr * R * Math.cos(a)]; }
function sceneMap(t) {
  const t0 = T.map;
  ctx.fillStyle = '#030a16'; ctx.fillRect(0, 0, W, H);
  const zin = E.io(P(t, t0, t0 + 1.3));
  const cx = O(700, 560), cy = O(560, 700), R = O(330, 300) * lerp(5, 1, zin);
  // ocean glow
  const og = ctx.createRadialGradient(cx, cy, R * .5, cx, cy, R * 2.2); og.addColorStop(0, '#0b2a4a'); og.addColorStop(1, '#030a16');
  ctx.fillStyle = og; ctx.fillRect(0, 0, W, H);
  // polar grid
  ctx.strokeStyle = 'rgba(95,212,255,.13)'; ctx.lineWidth = 1;
  for (let k = 1; k <= 4; k++) { ctx.beginPath(); ctx.arc(cx, cy, R * k * .5, 0, TAU); ctx.stroke(); }
  for (let k = 0; k < 12; k++) { const a = k * TAU / 12; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.sin(a) * R * 2.2, cy - Math.cos(a) * R * 2.2); ctx.stroke(); }
  // continent
  ctx.beginPath(); for (let l = 0; l <= 360; l += 1) { const [x, y] = antPt(cx, cy, R, l, antR(l)); l ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath();
  const cg = ctx.createRadialGradient(cx - R * .2, cy - R * .2, 10, cx, cy, R * 1.2); cg.addColorStop(0, '#ffffff'); cg.addColorStop(.7, '#cfe4f3'); cg.addColorStop(1, '#8fb5d3');
  ctx.save(); ctx.shadowColor = 'rgba(95,212,255,.8)'; ctx.shadowBlur = 30; ctx.fillStyle = cg; ctx.fill(); ctx.restore();
  ctx.strokeStyle = C.cyan2; ctx.lineWidth = 2; ctx.stroke();
  // contour rings on the ice
  ctx.save(); ctx.clip(); ctx.strokeStyle = 'rgba(70,120,170,.18)';
  for (let k = 1; k < 6; k++) { ctx.beginPath(); for (let l = 0; l <= 360; l += 3) { const [x, y] = antPt(cx, cy, R, l, antR(l) * k / 6 * (1 + .05 * noise(l * .1 + k * 7))); l ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath(); ctx.stroke(); }
  ctx.restore();
  // labels on the ocean
  const la = P(t, t0 + 1.0, t0 + 1.6);
  ctx.globalAlpha = la;
  txt('SOUTHERN OCEAN', cx + R * 1.05, cy - R * 1.12, font(500, 18, F.m), 'rgba(155,231,255,.6)', 'center', 8);
  txt('ROSS SEA', cx - R * .12, cy + R * .93, font(500, 15, F.m), 'rgba(155,231,255,.55)', 'center', 5);
  txt('WEDDELL SEA', cx - R * .66, cy - R * .5, font(500, 15, F.m), 'rgba(155,231,255,.55)', 'center', 5);
  ctx.globalAlpha = 1;
  // route to nearest open water (McMurdo)
  const [mx, my] = antPt(cx, cy, R, 166, .74);
  const rp = E.io(P(t, wt(1, 'ocean') - .2, wt(1, 'ocean') + .7));
  if (rp > 0) {
    ctx.save(); ctx.setLineDash([10, 9]); ctx.lineDashOffset = -t * 30; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(lerp(cx, mx, rp), lerp(cy, my, rp)); ctx.stroke(); ctx.restore();
    ctx.fillStyle = C.cyan; ctx.beginPath(); ctx.arc(mx, my, 7 * rp, 0, TAU); ctx.fill();
    ctx.globalAlpha = P(t, wt(1, 'ocean') + .4, wt(1, 'ocean') + .8);
    txt('McMURDO · NEAREST PORT', mx + 18, my + 34, font(600, 17, F.m), '#fff', 'left', 3);
    txt('≈ 1,360 km', (cx + mx) / 2 - 150, (cy + my) / 2 + 30, font(800, 30), '#fff', 'left', 1);
    ctx.globalAlpha = 1;
  }
  // pole marker
  const pa = P(t, t0 + .2, t0 + .8);
  for (let k = 0; k < 3; k++) { const ph = ((t * .8 + k / 3) % 1); ctx.strokeStyle = `rgba(255,179,64,${(1 - ph) * pa})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, 8 + ph * 60, 0, TAU); ctx.stroke(); }
  ctx.fillStyle = C.amber; ctx.beginPath(); ctx.arc(cx, cy, 8 * pa, 0, TAU); ctx.fill();
  ctx.globalAlpha = pa; txt('SOUTH POLE STATION', cx - 18, cy - 22, font(700, 18, F.m), C.amber, 'right', 3); ctx.globalAlpha = 1;
  // plane shuttling
  const tf = wt(1, 'flying') - .2, tx = wt(1, 'physically');
  if (t > tf) {
    const fly = (t - tf) / 1.25, k = fly % 1, back = Math.floor(fly) % 2 === 1;
    const u = E.io2(k), pu = back ? 1 - u : u;
    const x = lerp(cx, mx, pu), y = lerp(cy, my, pu);
    let ang = Math.atan2(my - cy, mx - cx) + (back ? Math.PI : 0);
    const crash = P(t, tx + .1, tx + .9);
    ctx.save(); ctx.translate(x, y + crash * crash * 120); ctx.rotate(ang + crash * 3); ctx.scale(1.25, 1.25); ctx.globalAlpha = 1 - crash;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(26, 0); ctx.lineTo(18, -3); ctx.lineTo(4, -3); ctx.lineTo(-2, -28); ctx.lineTo(-8, -28); ctx.lineTo(-6, -3); ctx.lineTo(-18, -3); ctx.lineTo(-22, -11); ctx.lineTo(-26, -11); ctx.lineTo(-24, 0);
    ctx.lineTo(-26, 11); ctx.lineTo(-22, 11); ctx.lineTo(-18, 3); ctx.lineTo(-6, 3); ctx.lineTo(-8, 28); ctx.lineTo(-2, 28); ctx.lineTo(4, 3); ctx.lineTo(18, 3); ctx.closePath(); ctx.fill();
    ctx.restore(); ctx.globalAlpha = 1;
  }
  // right panel: wastewater counter + barrel wall
  const pp = E.o3(P(t, tf - .1, tf + .5));
  if (pp > 0) {
    const X = O(1250, 120) + 60 * (1 - pp), PY = O(0, 880); ctx.globalAlpha = pp; ctx.save(); ctx.translate(0, PY);
    txt('STATION WASTEWATER', X, 260, font(600, 20, F.m), C.amber, 'left', 5);
    const cnt = Math.floor(2400000 * E.io2(P(t, tf, tx - .1)) / 1000) * 1000;
    txt(cnt.toLocaleString('en-US') + (cnt >= 2400000 ? '+' : ''), X, 345, font(800, 84), '#fff', 'left', 1);
    txt('GALLONS', X + 4, 385, font(600, 22, F.m), 'rgba(220,240,255,.7)', 'left', 8);
    const nb = Math.floor(O(128, 32) * E.io2(P(t, tf + .1, tx)));
    for (let i = 0; i < nb; i++) { const c = i % 16, r = Math.floor(i / 16); const bx = X + c * O(32, 52), by = 430 + r * 34;
      ctx.fillStyle = i % 7 === 3 ? '#c9822f' : '#8a5a22'; rrect(bx, by, 24, 28, 4); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(bx, by + 8, 24, 2); ctx.fillRect(bx, by + 18, 24, 2); }
    ctx.restore(); ctx.globalAlpha = 1;
  }
  // IMPOSSIBLE stamp
  if (t > tx) {
    const s = E.oBack(P(t, tx, tx + .35)), a = P(t, tx, tx + .12);
    const sx = (cx + mx) / 2 + 30, sy = (cy + my) / 2 - 20;
    ctx.save(); ctx.translate(sx, sy); ctx.scale(lerp(2.2, 1, s), lerp(2.2, 1, s)); ctx.globalAlpha = a;
    ctx.strokeStyle = C.red; ctx.lineWidth = 22; ctx.lineCap = 'round'; ctx.shadowColor = 'rgba(255,40,40,.8)'; ctx.shadowBlur = 30;
    ctx.beginPath(); ctx.moveTo(-120, -120); ctx.lineTo(120, 120); ctx.moveTo(120, -120); ctx.lineTo(-120, 120); ctx.stroke();
    ctx.restore();
    const a2 = P(t, tx + .2, tx + .5);
    ctx.save(); ctx.globalAlpha = a2; ctx.translate(O(1250 + 255, W / 2), O(790, 1062)); ctx.rotate(-.04); if (V) ctx.scale(.85, .85);
    ctx.strokeStyle = C.red; ctx.lineWidth = 5; ctx.strokeRect(-280, -58, 560, 100);
    txt('PHYSICALLY IMPOSSIBLE', 0, 8, font(900, 44), C.red, 'center', 2, 'middle');
    ctx.restore();
  }
}

// ---------------------------------------------------------------- SCENE 3: toilet flush
function sceneToilet(t) {
  const t0 = T.toilet, t1 = T.world;
  const p = P(t, t0, t1);
  const zoom = 1 + 7 * E.iExp(P(t, t1 - .55, t1));
  const bg = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, 1100); bg.addColorStop(0, '#16324a'); bg.addColorStop(1, '#040a14');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  // tile grid
  ctx.strokeStyle = 'rgba(155,231,255,.06)'; ctx.lineWidth = 2;
  for (let x = 0; x < W; x += 120) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 120) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  const cx = W / 2, cy = H / 2 - 10;
  ctx.save(); ctx.translate(cx, cy); ctx.scale(zoom, zoom);
  // rim
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 60;
  ctx.fillStyle = '#e9f1f7'; ctx.beginPath(); ctx.ellipse(0, 0, 330, 400, 0, 0, TAU); ctx.fill(); ctx.restore();
  const bowl = ctx.createRadialGradient(-40, -60, 20, 0, 0, 320); bowl.addColorStop(0, '#ffffff'); bowl.addColorStop(1, '#a9bccb');
  ctx.fillStyle = bowl; ctx.beginPath(); ctx.ellipse(0, 10, 270, 335, 0, 0, TAU); ctx.fill();
  // water + vortex
  const wg = ctx.createRadialGradient(0, 40, 10, 0, 40, 230); wg.addColorStop(0, '#0b3d66'); wg.addColorStop(.6, '#2c86c7'); wg.addColorStop(1, '#8fd0f5');
  ctx.fillStyle = wg; ctx.beginPath(); ctx.ellipse(0, 40, 205, 245, 0, 0, TAU); ctx.fill();
  const spin = E.i2(p) * 26 + p * 3;
  ctx.save(); ctx.beginPath(); ctx.ellipse(0, 40, 205, 245, 0, 0, TAU); ctx.clip();
  for (let k = 0; k < 7; k++) {
    ctx.strokeStyle = `rgba(220,245,255,${.18 + .2 * p})`; ctx.lineWidth = 6 - k * .5; ctx.beginPath();
    for (let i = 0; i <= 80; i++) { const u = i / 80, r = 240 * u, a = spin + k * TAU / 7 + u * (3 + 6 * p); const x = Math.cos(a) * r * .84, y = 40 + Math.sin(a) * r; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
  }
  const dg = ctx.createRadialGradient(0, 40, 0, 0, 40, 90); dg.addColorStop(0, 'rgba(0,10,25,.95)'); dg.addColorStop(1, 'rgba(0,10,25,0)');
  ctx.fillStyle = dg; ctx.beginPath(); ctx.arc(0, 40, 40 + 60 * p, 0, TAU); ctx.fill();
  ctx.restore();
  // tracked droplet
  const dr = lerp(170, 0, E.i2(P(t, t0 + .4, t1 - .25))), da = spin * 1.2 + 1;
  const dx = Math.cos(da) * dr * .84, dy = 40 + Math.sin(da) * dr;
  ctx.restore();
  const sx = cx + dx * zoom, sy = cy + dy * zoom;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const gl = ctx.createRadialGradient(sx, sy, 0, sx, sy, 40); gl.addColorStop(0, 'rgba(255,200,120,1)'); gl.addColorStop(1, 'rgba(255,140,40,0)');
  ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(sx, sy, 40, 0, TAU); ctx.fill(); ctx.restore();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sx, sy, 7, 0, TAU); ctx.fill();
  reticle(sx, sy, 46, t, 'FLUSH #001', 'TRACKING', P(t, t0 + .15, t0 + .55) * (1 - P(t, t1 - .3, t1)), C.amber);
  ctx.fillStyle = `rgba(0,0,0,${E.i2(P(t, t1 - .35, t1))})`; ctx.fillRect(0, 0, W, H);
}
function reticle(x, y, r, t, label, sub, a, col = C.amber) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y);
  const rr = r * (1 + .5 * (1 - E.o3(clamp(a * 1.5)))); ctx.rotate(Math.sin(t * 1.5) * .08);
  ctx.strokeStyle = col; ctx.lineWidth = 3; const L = rr * .45;
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { ctx.beginPath(); ctx.moveTo(sx * rr, sy * (rr - L)); ctx.lineTo(sx * rr, sy * rr); ctx.lineTo(sx * (rr - L), sy * rr); ctx.stroke(); }
  ctx.rotate(-Math.sin(t * 1.5) * .08);
  ctx.beginPath(); ctx.moveTo(rr + 6, -rr - 6); ctx.lineTo(rr + 34, -rr - 34); ctx.lineTo(rr + 60, -rr - 34); ctx.stroke();
  txt(label, rr + 66, -rr - 30, font(800, 24, F.m), col, 'left', 2);
  if (sub) { const blink = Math.floor(t * 3) % 2 ? 1 : .45; ctx.globalAlpha = a * blink; txt('● ' + sub, rr + 66, -rr - 4, font(500, 15, F.m), '#fff', 'left', 3); }
  ctx.restore();
}

// ---------------------------------------------------------------- SCENE 4+: the ice cross-section world
const NECK = 62;
function bulbDims(g) { const ry = 5 + 48 * g, rx = 3.5 + 28.5 * g; return { rx, ry, cy: NECK + ry, top: NECK, bot: NECK + 2 * ry }; }
function bulbPath(g, grow = 0) {
  const d = bulbDims(g); ctx.beginPath();
  for (let i = 0; i <= 120; i++) {
    const th = i / 120 * TAU, k = 1 - .55 * Math.pow(Math.max(0, Math.cos(th)), 3), s2 = Math.sin(th) ** 2;
    const w = 1 + .06 * noise(th * 3.2 + 4) * s2 + grow;
    const x = (d.rx * w) * Math.sin(th) * k, y = d.cy - d.ry * Math.cos(th) * (1 + .03 * noise(th * 4 + 9) * s2 + grow);
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath(); return d;
}
// world state, all functions of "state time" st
const S = {
  pipe: st => 66 * E.io2(P(st, T.drink + .2, T.melt + 1.4)),
  g: st => .48 * E.io2(P(st, T.melt + 1.2, T.deep)) + .52 * E.io2(P(st, T.deep + .2, T.fuel + .6)),
  water: st => .93 * P(st, T.melt + 1.2, T.melt + 2) * (1 - E.io2(P(st, wt(7, 'abandon') + .3, wt(7, 'repurpose') + .3))),
  sew: st => .42 * E.io2(P(st, wt(8, 'straight') - .2, T.therm + .4)) + .58 * E.io2(P(st, T.freeze + .1, wt(12, 'entire') - .1)),
  frozen: st => E.io2(P(st, wt(12, 'entire') - .1, T.rewind - .25)),
  heat: st => E.io2(P(st, T.therm - .05, T.therm + .5)) * (1 - E.io2(P(st, T.cool + .6, T.cool + 3.2))),
  plume: st => E.io2(P(st, T.coll + .5, wt(10, 'collapse') + .1)) * (1 - E.io2(P(st, T.cool + .1, T.cool + 1.1))),
  sink: st => E.oExp(P(st, wt(10, 'collapse') + .05, wt(10, 'collapse') + 1.3)) * (1 - E.io2(P(st, T.cool + .05, T.cool + .9))),
  frost: st => E.io2(P(st, T.fuel + .3, T.aband + .3)) * (1 - P(st, wt(7, 'repurpose'), wt(7, 'repurpose') + .6)),
  flow: st => {
    if (st > T.drink + .4 && st < T.deep) return ['hot', 1];
    if (st >= T.deep && st < T.fuel + 2.6) return ['up', 1 - P(st, T.fuel + 1.6, T.fuel + 2.6)];
    if (st > wt(7, 'abandon') + .3 && st < wt(7, 'repurpose') + .3) return ['up', 1];
    if (st > wt(8, 'ground') - .3 && st < T.therm + .5) return ['sew', 1];
    if (st > T.freeze && st < wt(12, 'entire')) return ['sew', 1];
    return ['none', 0];
  },
};
const DROP_REST = [7, 142];
function dropState(st) {
  const g = S.g(st), d = bulbDims(g);
  const a0 = T.deep + .3, a1 = T.deep + 1.4, a2 = T.fuel - .5;
  if (st > a0 - .3 && st < a2 + .4) {
    const vis = P(st, a0 - .3, a0) * (1 - P(st, a2, a2 + .4));
    const start = [9, d.bot - 14];
    if (st < a1) return { x: start[0] + Math.sin(st * 3) * 1, y: start[1] + Math.cos(st * 2.5), c: 'blue', vis };
    const u = E.io2(P(st, a1, a1 + .9)), v = E.io2(P(st, a1 + .8, a2));
    if (v <= 0) return { x: lerp(start[0], 0, u), y: lerp(start[1], NECK + 2, u), c: 'blue', vis };
    return { x: 0, y: lerp(NECK + 2, -6, v), c: 'blue', vis };
  }
  const b0 = wt(8, 'rerouted') - .5, b1 = wt(8, 'empty') - .2, b2 = T.therm + .2;
  if (st > b0 && st < T.sheet + 1) {
    const vis = P(st, b0, b0 + .3);
    if (st < b1) return { x: 0, y: lerp(-6, NECK, E.io2(P(st, b0 + .2, b1))), c: 'brown', vis };
    const u = E.io2(P(st, b1, b2)); return { x: lerp(0, DROP_REST[0], u), y: lerp(NECK, DROP_REST[1], u), c: 'brown', vis };
  }
  return null;
}
// camera keys: [t, x, y, scale]
const CAMK = [
  [T.world, 0, -11, 17], [T.world + .5, 0, -11, 17], [T.drink - .05, 0, 52, 6.6], [T.melt + .5, 0, 62, 6.4], [T.melt + 5.5, 0, 82, 5.6],
  [T.deep + 3.6, 0, 102, 4.5], [T.fuel + 1.2, 36, 104, 4.6], [T.aband + .3, 36, 104, 4.6], [T.aband + 4.4, 0, 100, 4.7],
  [T.sew + 1.2, 0, 72, 4.15], [T.therm + .2, 0, 84, 4.3], [T.therm + 3, 0, 88, 4.5], [T.coll + 1.0, 0, 62, 4.15], [T.cool + .5, 0, 64, 4.15],
  [T.cool + 3.6, 0, 90, 4.4], [T.freeze + 1.6, 0, 113, 5.3], [T.rewind, 0, 113, 5.4],
];
if (V) for (const k of CAMK) { k[1] = 0; k[3] = k[3] > 12 ? 13 : k[3] * 1.15; }
function camAt(st) {
  if (st <= CAMK[0][0]) return { x: CAMK[0][1], y: CAMK[0][2], s: CAMK[0][3] };
  for (let i = 0; i < CAMK.length - 1; i++) {
    const a = CAMK[i], b = CAMK[i + 1];
    if (st <= b[0]) { const u = E.io(P(st, a[0], b[0])); return { x: lerp(a[1], b[1], u), y: lerp(a[2], b[2], u), s: Math.exp(lerp(Math.log(a[3]), Math.log(b[3]), u)) }; }
  }
  const l = CAMK[CAMK.length - 1]; return { x: l[1], y: l[2], s: l[3] };
}
// rewind mapping (global t -> state time)
const RW = { a: T.rewind + .1, b: T.rewind + 2.3, c: T.rewind + 3.25, d: T.rewind + 4.05 };
function stateT(t) {
  if (t < RW.a) return t;
  if (t < RW.b) return lerp(RW.a, T.deep + 1.0, E.io2(P(t, RW.a, RW.b)));
  if (t < RW.c) return T.deep + 1.0 + (t - RW.b) * .35;
  if (t < RW.d) return lerp(T.deep + 1.0 + (RW.c - RW.b) * .35, T.rewind - .05, E.io2(P(t, RW.c, RW.d)));
  return T.rewind - .05;
}
let CAM = { x: 0, y: 0, s: 1 };
const HC = H / 2 + O(0, -145);
const sx = x => W / 2 + (x - CAM.x) * CAM.s, sy = y => HC + (y - CAM.y) * CAM.s;
function worldTf() { ctx.setTransform(CAM.s, 0, 0, CAM.s, W / 2 - CAM.x * CAM.s + SH.x, HC - CAM.y * CAM.s + SH.y); }
function screenTf() { ctx.setTransform(1, 0, 0, 1, SH.x, SH.y); }
function surfY(x, sink) { return -1.0 * fbm(x * .03 + 2) - sink * 7 * Math.exp(-(x * x) / 900); }

function drawWorld(st, t, cam) {
  CAM = cam;
  const g = S.g(st), d = bulbDims(g), sink = S.sink(st), plume = S.plume(st), heat = S.heat(st);
  const x0 = CAM.x - W / 2 / CAM.s - 5, x1 = CAM.x + W / 2 / CAM.s + 5, y0 = CAM.y - HC / CAM.s - 5, y1 = CAM.y + (H - HC) / CAM.s + 5;
  screenTf();
  // sky
  const hy = sy(0);
  if (hy > 0) {
    const sk = ctx.createLinearGradient(0, hy - 900, 0, hy); sk.addColorStop(0, '#01040b'); sk.addColorStop(1, '#173a5e');
    ctx.fillStyle = sk; ctx.fillRect(0, 0, W, hy + 2);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, hy); ctx.clip(); drawStars(t, .8); drawAurora(t, .5, Math.min(hy - 120, 520)); ctx.restore();
  }
  worldTf();
  // firn
  const fg = ctx.createLinearGradient(0, 0, 0, 55); fg.addColorStop(0, '#e6f2fb'); fg.addColorStop(1, '#93bcd9');
  ctx.fillStyle = fg; ctx.beginPath(); ctx.moveTo(x0, 52); for (let x = x0; x <= x1; x += 4) ctx.lineTo(x, surfY(x, sink)); ctx.lineTo(x1, 52); ctx.closePath(); ctx.fill();
  // deep ice
  const ig = ctx.createLinearGradient(0, 50, 0, 330); ig.addColorStop(0, '#78a9cd'); ig.addColorStop(.35, '#3d79a8'); ig.addColorStop(1, '#0d2a4a');
  ctx.fillStyle = ig; ctx.fillRect(x0, 51.5, x1 - x0, Math.max(0, y1 - 51.5));
  // firn/ice transition fuzz
  const tg = ctx.createLinearGradient(0, 44, 0, 58); tg.addColorStop(0, 'rgba(147,188,217,0)'); tg.addColorStop(.5, 'rgba(147,188,217,.9)'); tg.addColorStop(1, 'rgba(120,169,205,0)');
  ctx.fillStyle = tg; ctx.fillRect(x0, 44, x1 - x0, 14);
  // annual layers
  ctx.lineWidth = 1.2 / CAM.s;
  for (let ly = 56; ly < Math.min(y1, 420); ly += 7) {
    ctx.strokeStyle = `rgba(200,235,255,${.07 + .05 * noise(ly)})`; ctx.beginPath();
    for (let x = x0; x <= x1; x += 6) ctx.lineTo(x, ly + 1.2 * fbm(x * .02 + ly));
    ctx.stroke();
  }
  // firn grains (skip inside plume)
  const plTop = lerp(NECK, 1, plume);
  for (const f of FIRN) {
    if (f.x < x0 || f.x > x1) continue;
    if (plume > 0 && f.y > plTop && Math.abs(f.x) < plumeHalf(f.y, st) + 1) continue;
    let yy = f.y; if (sink > 0) yy += sink * 6 * Math.exp(-(f.x * f.x) / 900) * (1 - f.y / 52);
    if (yy < surfY(f.x, sink) + .3) continue;
    ctx.fillStyle = `rgba(255,255,255,${f.a})`; ctx.beginPath(); ctx.arc(f.x, yy, f.r, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = 'rgba(220,240,255,.35)';
  for (const b of BUBBLES) { if (b.x < x0 || b.x > x1 || b.y > y1) continue; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill(); }
  // plume (melt channel)
  if (plume > 0) {
    ctx.beginPath();
    for (let y = NECK; y >= plTop; y -= 1.5) ctx.lineTo(-plumeHalf(y, st), y);
    for (let y = plTop; y <= NECK; y += 1.5) ctx.lineTo(plumeHalf(y, st), y);
    ctx.closePath();
    const pg = ctx.createLinearGradient(0, plTop, 0, NECK); pg.addColorStop(0, 'rgba(120,80,40,.85)'); pg.addColorStop(1, 'rgba(90,60,30,.95)');
    ctx.fillStyle = pg; ctx.fill();
    ctx.strokeStyle = 'rgba(255,150,60,.9)'; ctx.lineWidth = 2.5 / CAM.s; ctx.stroke();
  }
  // bulb cavity
  if (g > 0.001) drawBulb(st, t, g, d);
  // pipe
  const pl = S.pipe(st);
  if (pl > 0) {
    const top = -5.2 - sink * 5, bot = Math.min(pl, NECK + 1);
    ctx.fillStyle = '#56636f'; ctx.fillRect(-1.1, top, 2.2, bot - top);
    ctx.fillStyle = '#9fb0bf'; ctx.fillRect(-1.1, top, .5, bot - top);
    const [mode, fa] = S.flow(st);
    if (mode !== 'none' && fa > 0) {
      const col = mode === 'hot' ? '255,120,40' : mode === 'up' ? '90,190,255' : '170,120,50';
      const dir = mode === 'up' ? -1 : 1;
      ctx.save(); ctx.beginPath(); ctx.rect(-.6, top, 1.2, bot - top); ctx.clip();
      ctx.fillStyle = `rgba(${col},${.35 * fa})`; ctx.fillRect(-.6, top, 1.2, bot - top);
      ctx.fillStyle = `rgba(${col},${fa})`;
      const off = ((st * 26 * dir) % 7 + 7) % 7;
      for (let y = top - 7 + off; y < bot; y += 7) { ctx.beginPath(); ctx.moveTo(-.6, y); ctx.lineTo(0, y + 3 * dir); ctx.lineTo(.6, y); ctx.lineTo(.6, y + 1.2); ctx.lineTo(0, y + 3 * dir + 1.2); ctx.lineTo(-.6, y + 1.2); ctx.fill(); }
      ctx.restore();
      if (mode === 'hot') { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,110,40,${.18 + .06 * Math.sin(st * 8)})`; ctx.fillRect(-3, top, 6, bot - top); ctx.restore(); }
    }
    // drill head
    if (st < T.melt + 1.6) { ctx.fillStyle = '#ff9a4a'; ctx.beginPath(); ctx.moveTo(-1.6, bot); ctx.lineTo(1.6, bot); ctx.lineTo(0, bot + 3); ctx.fill(); }
  }
  // frost creeping on pipe
  const fr = S.frost(st);
  if (fr > 0 && pl > 0) { ctx.strokeStyle = `rgba(240,250,255,${.9 * fr})`; ctx.lineWidth = .9; ctx.setLineDash([.6, .5]); for (const sx_ of [-1.4, 1.4]) { ctx.beginPath(); ctx.moveTo(sx_, NECK); ctx.lineTo(sx_, NECK - fr * 50); ctx.stroke(); } ctx.setLineDash([]); }
  // surface snow cap
  ctx.fillStyle = '#f4fbff'; ctx.beginPath(); ctx.moveTo(x0, 2.2); for (let x = x0; x <= x1; x += 4) ctx.lineTo(x, surfY(x, sink)); for (let x = x1; x >= x0; x -= 4) ctx.lineTo(x, surfY(x, sink) + 1.6 + .6 * noise(x * .2)); ctx.closePath(); ctx.fill();
  // station
  ctx.save(); ctx.translate(0, sink * 5.5); ctx.rotate(sink * .11); drawStation(t, { lit: 1 - sink * .6 * (Math.sin(t * 40) > 0 ? 1 : .3) });
  if (sink > .05) { ctx.strokeStyle = `rgba(20,20,20,${sink})`; ctx.lineWidth = .35; ctx.beginPath(); ctx.moveTo(-4, -16); ctx.lineTo(-2, -12); ctx.lineTo(-5, -9); ctx.lineTo(-3, -5); ctx.moveTo(12, -16); ctx.lineTo(14, -11); ctx.lineTo(11, -7); ctx.stroke(); }
  ctx.restore();
  // heat (thermal camera) + cold wave
  screenTf();
  if (heat > 0) thermalOverlay(st, t, heat, d, plume, plTop);
}
function plumeHalf(y, st) { return 7 + 5 * fbm(y * .07 + st * .7) + 4 * ((y - 0) / NECK); }
function drawBulb(st, t, g, d) {
  const water = S.water(st), sew = S.sew(st), frozen = S.frozen(st), fr = S.frost(st);
  const meltGlow = st > T.melt + 1 && st < T.deep + .5 ? 1 - P(st, T.deep - .3, T.deep + .5) : 0;
  // halo of melted/warm ice around wall
  if (meltGlow > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; bulbPath(g, .12); ctx.fillStyle = `rgba(255,140,60,${.22 * meltGlow})`; ctx.fill(); ctx.restore(); }
  bulbPath(g);
  ctx.save(); ctx.clip();
  // empty cavity
  const cg = ctx.createLinearGradient(0, d.top, 0, d.bot); cg.addColorStop(0, '#050c18'); cg.addColorStop(1, '#0d1f36');
  ctx.fillStyle = cg; ctx.fillRect(-d.rx * 1.3, d.top - 2, d.rx * 2.6, d.bot - d.top + 4);
  const H_ = d.bot - d.top;
  const waveY = (lvl) => d.bot - lvl * H_;
  const surf = (lvl, amp, col, sp) => { const y0 = waveY(lvl); ctx.beginPath(); ctx.moveTo(-d.rx * 1.3, d.bot + 3); for (let x = -d.rx * 1.3; x <= d.rx * 1.3; x += 1) ctx.lineTo(x, y0 + amp * Math.sin(x * .25 + st * sp)); ctx.lineTo(d.rx * 1.3, d.bot + 3); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); return y0; };
  if (water > 0.005) {
    const wg = ctx.createLinearGradient(0, waveY(water), 0, d.bot); wg.addColorStop(0, '#5cc2ff'); wg.addColorStop(1, '#0e4f9a');
    const y0 = surf(water, .5, wg, 2.5);
    ctx.strokeStyle = 'rgba(220,245,255,.8)'; ctx.lineWidth = 1.5 / CAM.s; ctx.beginPath(); for (let x = -d.rx * 1.3; x <= d.rx * 1.3; x += 1) ctx.lineTo(x, y0 + .5 * Math.sin(x * .25 + st * 2.5)); ctx.stroke();
    // caustic shimmer
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(140,210,255,.12)'; ctx.lineWidth = .6;
    for (let k = 0; k < 10; k++) { ctx.beginPath(); for (let x = -d.rx; x <= d.rx; x += 2) ctx.lineTo(x, y0 + 4 + k * H_ / 11 + 1.5 * Math.sin(x * .3 + st * 2 + k)); ctx.stroke(); }
    ctx.restore();
  }
  if (sew > 0.005) {
    const sg = ctx.createLinearGradient(0, waveY(sew), 0, d.bot); sg.addColorStop(0, '#8c6a32'); sg.addColorStop(1, '#3e2a10');
    const y0 = surf(sew, .45 * (1 - frozen), sg, 1.6);
    ctx.fillStyle = 'rgba(40,25,8,.55)'; const r = rng(77);
    for (let i = 0; i < 90; i++) { const px = (r() - .5) * 2 * d.rx, py = y0 + 2 + r() * (d.bot - y0); const bob = (1 - frozen) * Math.sin(st * 1.5 + i); ctx.beginPath(); ctx.arc(px + bob * .5, py + bob * .4, .3 + r() * .7, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = 'rgba(210,170,100,.7)'; ctx.lineWidth = 1.5 / CAM.s; ctx.beginPath(); for (let x = -d.rx * 1.3; x <= d.rx * 1.3; x += 1) ctx.lineTo(x, y0 + .45 * (1 - frozen) * Math.sin(x * .25 + st * 1.6)); ctx.stroke();
    // incoming slurry stream
    const [mode] = S.flow(st);
    if (mode === 'sew') { ctx.fillStyle = 'rgba(150,105,45,.9)'; ctx.beginPath(); ctx.moveTo(-.6, d.top); ctx.quadraticCurveTo(-.8 + Math.sin(st * 9) * .3, (d.top + y0) / 2, -1.6, y0); ctx.lineTo(1.6, y0); ctx.quadraticCurveTo(.8, (d.top + y0) / 2, .6, d.top); ctx.fill();
      ctx.fillStyle = 'rgba(200,160,90,.7)'; for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI + st * 3, rr = 2 + (st * 6 + k) % 3; ctx.beginPath(); ctx.arc(Math.cos(a) * rr * 1.5, y0 - Math.abs(Math.sin(a)) * rr, .4, 0, TAU); ctx.fill(); } }
  }
  // freezing crystals
  if (frozen > 0) {
    ctx.fillStyle = `rgba(190,225,248,${.62 * frozen})`; ctx.fillRect(-d.rx * 1.3, d.top - 2, d.rx * 2.6, H_ + 4);
    ctx.strokeStyle = 'rgba(245,252,255,.8)'; ctx.lineCap = 'round'; ctx.shadowColor = 'rgba(160,230,255,.9)'; ctx.shadowBlur = 6;
    const G = frozen * 1.35;
    for (const c of CRYST) { if (c.t0 > G) continue; const u = clamp((G - c.t0) / (c.t1 - c.t0)); ctx.lineWidth = c.w / CAM.s * 1.05;
      const x1 = d.rx * c.x1, y1 = d.cy + d.ry * c.y1, x2 = d.rx * lerp(c.x1, c.x2, u), y2 = d.cy + d.ry * lerp(c.y1, c.y2, u);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
  }
  ctx.restore();
  // wall rim
  bulbPath(g);
  ctx.lineWidth = 2.2 / CAM.s;
  ctx.strokeStyle = meltGlow > 0 ? `rgba(255,${lerp(220, 140, meltGlow) | 0},90,1)` : frozen > .5 ? 'rgba(235,248,255,.9)' : 'rgba(170,220,255,.8)';
  ctx.stroke();
  if (fr > 0) { ctx.save(); ctx.lineWidth = 6 * fr / CAM.s; ctx.setLineDash([2 / CAM.s, 3 / CAM.s]); ctx.strokeStyle = `rgba(250,253,255,${fr})`; ctx.stroke(); ctx.restore(); }
  // neck
  ctx.fillStyle = '#050c18'; ctx.fillRect(-1.3, NECK - 6, 2.6, 6.5);
}
function thermalOverlay(st, t, heat, d, plume, plTop) {
  ctx.save();
  ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = `rgba(${lerp(255, 55, heat) | 0},${lerp(255, 25, heat) | 0},${lerp(255, 120, heat) | 0},1)`; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter';
  const pulse = 1 + .06 * Math.sin(t * 5);
  const blob = (x, y, r, a) => { const g = ctx.createRadialGradient(sx(x), sy(y), 0, sx(x), sy(y), r * CAM.s); g.addColorStop(0, `rgba(255,255,210,${a})`); g.addColorStop(.25, `rgba(255,200,60,${a * .9})`); g.addColorStop(.55, `rgba(255,70,30,${a * .55})`); g.addColorStop(.85, `rgba(150,20,110,${a * .25})`); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(sx(x) - r * CAM.s, sy(y) - r * CAM.s, r * 2 * CAM.s, r * 2 * CAM.s); };
  const sewTop = d.bot - S.sew(st) * (d.bot - d.top);
  blob(0, (sewTop + d.bot) / 2 + 4, d.rx * 2.1 * pulse, .85 * heat);
  blob(0, d.cy, d.rx * 1.5, .3 * heat);
  if (plume > 0) for (let y = NECK; y >= plTop; y -= 5) blob(Math.sin(y * .1 + t) * 2, y, 14 + 4 * Math.sin(y * .2 + t * 3), .5 * heat * plume);
  ctx.restore();
}

// ---------------------------------------------------------------- world overlays (screen space)
function callout(wx_, wy_, dx, dy, title, sub, a, col = '#fff', dO) {
  if (a <= 0) return;
  const x = sx(wx_), y = sy(wy_), ex = x + dx, ey = y + dy, dir = dO !== undefined ? dO : dx >= 0 ? 1 : -1;
  if (dir === 0) { ctx.save(); ctx.globalAlpha = clamp(a * 2); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.shadowColor = 'rgba(0,10,25,.75)'; ctx.shadowBlur = 14; const lp = E.o3(clamp(a * 1.6));
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(lerp(x, ex, lp), lerp(y, ey, lp)); ctx.stroke(); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.fill();
    ctx.globalAlpha = clamp(a * 2 - .9); const n = Math.round(title.length * clamp(a * 1.8 - .8)), up = dy < 0;
    txt(title.slice(0, n), ex, up ? ey - 40 : ey + 36, font(800, 28), col, 'center', 2); if (sub) txt(sub, ex, up ? ey - 14 : ey + 62, font(500, 16, F.m), 'rgba(230,242,255,.8)', 'center', 3); ctx.restore(); return; }
  ctx.save(); ctx.globalAlpha = clamp(a * 2); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.shadowColor = 'rgba(0,10,25,.75)'; ctx.shadowBlur = 14;
  const lp = E.o3(clamp(a * 1.6));
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(lerp(x, ex, lp), lerp(y, ey, lp)); if (lp >= 1) ctx.lineTo(ex + dir * 40 * E.o3(clamp(a * 1.6 - 1)), ey); ctx.stroke();
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.fill();
  const ta = clamp(a * 2 - .9); ctx.globalAlpha = ta;
  const n = Math.round(title.length * clamp(a * 1.8 - .8));
  txt(title.slice(0, n), ex + dir * 52, ey + 8, font(800, 28), col, dir > 0 ? 'left' : 'right', 2);
  if (sub) txt(sub, ex + dir * 52, ey + 36, font(500, 16, F.m), 'rgba(230,242,255,.8)', dir > 0 ? 'left' : 'right', 3);
  ctx.restore();
}
function vis(t, a, b, fi = .4, fo = .3) { return P(t, a, a + fi) * (1 - P(t, b - fo, b)); }
function depthGauge(t, a) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a;
  const X = 64;
  ctx.strokeStyle = 'rgba(155,231,255,.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X, O(150, 280)); ctx.lineTo(X, O(930, H - 480)); ctx.stroke();
  const step = CAM.s > 10 ? 5 : 10;
  for (let m = 0; m <= 400; m += step) { const y = sy(m); if (y < O(150, 280) || y > O(930, H - 480)) continue; const big = m % 50 === 0;
    ctx.fillStyle = big ? C.cyan2 : 'rgba(155,231,255,.5)'; ctx.fillRect(X, y - 1, big ? 22 : 10, 2);
    if (big) { ctx.shadowColor = 'rgba(0,0,0,.7)'; ctx.shadowBlur = 8; txt(m + ' m', X + 30, y + 6, font(700, 17, F.m), '#dff6ff', 'left', 1); ctx.shadowBlur = 0; } }
  txt('DEPTH', X - 10, O(130, 260), font(700, 14, F.m), 'rgba(155,231,255,.7)', 'left', 4);
  ctx.restore();
}
function hudPanel(x, y, w, h, title, a, col = C.cyan) {
  ctx.save(); ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(4,12,24,.78)'; rrect(x, y, w, h, 14); ctx.fill();
  ctx.strokeStyle = col; ctx.globalAlpha = a * .6; ctx.lineWidth = 1.5; ctx.stroke(); ctx.globalAlpha = a;
  ctx.fillStyle = col; ctx.fillRect(x + 22, y + 22, 8, 8);
  txt(title, x + 40, y + 31, font(700, 16, F.m), col, 'left', 4);
  ctx.restore();
}
function worldOverlays(t, st) {
  const g = S.g(st), d = bulbDims(g);
  depthGauge(t, vis(t, T.world + 1.0, T.sheet - .2, .6));
  // labels
  callout(-28, -15, O(-120, 60), O(-90, -170), 'AMUNDSEN–SCOTT STATION', 'ELEVATED ON STILTS', vis(t, T.world + .1, T.world + 1.25, .7), '#fff', O(undefined, 0));
  callout(O(-62, -45), O(24, 30), O(-70, 0), O(-70, -120), 'FIRN', 'POROUS, COMPACTED SNOW', vis(t, T.world + 1.3, T.melt - .1, .8) + vis(t, wt(10, 'porous') - .2, wt(10, 'collapse') - .1, .8, .25), '#fff', O(undefined, 1));
  callout(O(-62, -45), 88, O(-70, 0), O(-20, 90), 'SOLID GLACIAL ICE', '≈ 2,700 m THICK', vis(t, T.world + 1.6, T.melt - .1, .8), '#fff', O(undefined, 1));
  // drinking water card
  const dw = vis(t, T.drink + .05, T.melt + 1.8, .4);
  if (dw > 0) { ctx.save(); ctx.globalAlpha = dw; const x = O(1440, 800), y = O(360, 1150) - 20 * (1 - E.o3(P(t, T.drink, T.drink + .5)));
    ctx.fillStyle = 'rgba(95,212,255,.15)'; ctx.beginPath(); ctx.arc(x, y, 92, 0, TAU); ctx.fill();
    ctx.fillStyle = C.water; ctx.beginPath(); ctx.moveTo(x, y - 62); ctx.bezierCurveTo(x + 18, y - 30, x + 44, y - 4, x + 44, y + 18); ctx.arc(x, y + 18, 44, 0, Math.PI); ctx.bezierCurveTo(x - 44, y - 4, x - 18, y - 30, x, y - 62); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.ellipse(x - 16, y + 10, 7, 14, -.4, 0, TAU); ctx.fill();
    ctx.shadowColor = 'rgba(0,10,25,.6)'; ctx.shadowBlur = 16; txt('STEP 1', x, y + 140, font(700, 20, F.m), '#0b4f86', 'center', 6); txt('DRINKING WATER', x, y + 182, font(800, 40), '#fff', 'center', 2); ctx.restore(); }
  callout(0, 40, O(160, 90), -40, 'HOT WATER DRILL', 'MELTS THE ICE AROUND IT', vis(t, T.melt + .2, T.melt + 3.4, .8));
  callout(d.rx * .85, d.cy - d.ry * .4, O(190, 90), O(-70, -230), 'RODRIGUEZ WELL', '"RODWELL" · THE STATION\'S WATER SUPPLY', vis(t, wt(4, 'rodriguez') - .35, T.deep + .4, .9), '#fff', O(undefined, 0));
  // deeper / wider dimension arrows
  const dd = vis(t, T.deep + .6, T.fuel + .1, .5);
  if (dd > 0) { ctx.save(); ctx.globalAlpha = dd; ctx.strokeStyle = C.cyan2; ctx.fillStyle = C.cyan2; ctx.lineWidth = 3;
    const x = sx(-d.rx - 12), ya = sy(d.top), yb = sy(d.bot); arrow(x, ya, x, yb); txt('DEEPER', x - 18, (ya + yb) / 2, font(800, 30), C.cyan2, 'right', 3, 'middle');
    const y = sy(d.bot + 10), xa = sx(-d.rx), xb = sx(d.rx); arrow(xa, y, xb, y); txt('WIDER', (xa + xb) / 2, y + 40, font(800, 30), C.cyan2, 'center', 3);
    ctx.restore(); }
  // tracked droplet
  const ds = dropState(st);
  if (ds && ds.vis > 0) {
    const x = sx(ds.x), y = sy(ds.y);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; const gl = ctx.createRadialGradient(x, y, 0, x, y, 30); gl.addColorStop(0, ds.c === 'blue' ? 'rgba(140,220,255,1)' : 'rgba(255,190,110,1)'); gl.addColorStop(1, 'rgba(0,0,0,0)'); ctx.globalAlpha = ds.vis; ctx.fillStyle = gl; ctx.fillRect(x - 30, y - 30, 60, 60); ctx.restore();
    ctx.globalAlpha = ds.vis; ctx.fillStyle = ds.c === 'blue' ? '#e8f8ff' : '#ffd9a0'; ctx.beginPath(); ctx.arc(x, y, 6, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    const sub = ds.c === 'blue' ? 'STILL DRINKING WATER' : (st > T.freeze + 2.2 ? 'LOCKED IN ICE' : 'RAW SEWAGE');
    const hideRet = t > T.cool - .1 && t < T.freeze + .5 ? .25 : 1;
    reticle(x, y, 26, t, 'FLUSH #001', sub, ds.vis * hideRet * (t > T.sheet - .6 ? 1 - P(t, T.sheet - .6, T.sheet) : 1), ds.c === 'blue' ? C.cyan2 : C.amber);
  }
  // fuel panel
  const fp = vis(t, T.fuel + .15, T.aband + .6, .5);
  if (fp > 0) {
    const X = O(1360, W / 2 - 235), Y = O(230, 250) + 30 * (1 - E.o3(P(t, T.fuel + .15, T.fuel + .7)));
    if (V) { ctx.save(); ctx.translate(W / 2, Y); ctx.scale(.8, .8); ctx.translate(-W / 2, -Y); }
    hudPanel(X, Y, 470, 420, 'HEATING FUEL BURN', fp, C.amber);
    ctx.save(); ctx.globalAlpha = fp;
    const cx = X + 235, cy = Y + 235, R = 135, k = E.io(P(t, T.fuel + .4, wt(6, 'fuel') + .4)) + .03 * Math.sin(t * 30) * P(t, wt(6, 'fuel'), wt(6, 'fuel') + .3);
    for (let i = 0; i < 40; i++) { const a = Math.PI + i / 39 * Math.PI; ctx.strokeStyle = i < 20 ? 'rgba(95,212,255,.9)' : i < 30 ? C.amber : C.red; ctx.lineWidth = 14; ctx.beginPath(); ctx.arc(cx, cy, R, a, a + Math.PI / 46); ctx.stroke(); }
    const na = Math.PI + Math.PI * clamp(.1 + .88 * k);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(na) * (R - 30), cy + Math.sin(na) * (R - 30)); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, 10, 0, TAU); ctx.fill();
    txt('LOW', cx - R - 4, cy + 34, font(600, 15, F.m), 'rgba(255,255,255,.6)', 'center', 3); txt('UNSUSTAINABLE', cx + R - 20, cy + 34, font(700, 15, F.m), C.red, 'center', 2);
    const pct = Math.round(100 + 300 * k);
    txt(pct + '%', cx, cy + 105, font(800, 60), k > .7 ? C.red : '#fff', 'center', 1);
    txt('ENERGY TO KEEP IT LIQUID', cx, cy + 150, font(600, 15, F.m), 'rgba(230,242,255,.75)', 'center', 3);
    ctx.restore(); if (V) ctx.restore();
  }
  // abandoned stamp + repurpose flip
  const ta = wt(7, 'abandon');
  if (t > ta - .05 && t < T.sew + .8) {
    const a = P(t, ta - .05, ta + .1) * (1 - P(t, wt(7, 'repurpose') - .2, wt(7, 'repurpose') + .1)), s = E.oBack(P(t, ta - .05, ta + .3));
    if (a > 0) { ctx.save(); ctx.translate(sx(0), sy(d.cy)); ctx.rotate(-.12); ctx.scale(lerp(2.5, 1, s), lerp(2.5, 1, s)); ctx.globalAlpha = a;
      ctx.strokeStyle = C.red; ctx.lineWidth = 7; ctx.strokeRect(-230, -58, 460, 116); txt('ABANDONED', 0, 4, font(900, 70), C.red, 'center', 6, 'middle'); ctx.restore(); }
  }
  const tr = wt(7, 'repurpose');
  const rp = vis(t, tr - .15, T.sew + 2.0, .3, .5);
  if (rp > 0) {
    ctx.save(); ctx.globalAlpha = rp;
    const X = O(sx(d.rx) + 120, W / 2 - 300), Y = O(sy(d.cy) - 40, sy(d.top) - 170);
    if (V) { ctx.fillStyle = 'rgba(4,12,24,.7)'; rrect(X - 20, Y - 60, 640, 110, 14); ctx.fill(); }
    const flip = E.io(P(t, tr + .15, tr + 1.0));
    ctx.save(); ctx.translate(X + 40, Y); ctx.rotate(t * 2.2);
    ctx.strokeStyle = C.green = '#7dffb0'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    for (let k = 0; k < 3; k++) { ctx.rotate(TAU / 3); ctx.beginPath(); ctx.arc(0, 0, 34, .2, 1.7); ctx.stroke(); ctx.beginPath(); const ax = Math.cos(1.7) * 34, ay = Math.sin(1.7) * 34; ctx.moveTo(ax - 9, ay - 2); ctx.lineTo(ax, ay); ctx.lineTo(ax + 3, ay - 11); ctx.stroke(); }
    ctx.restore();
    txt('REPURPOSE', X + 100, Y - 22, font(700, 18, F.m), '#7dffb0', 'left', 6);
    // split-flap label
    const words = ['DRINKING WATER WELL', 'SEWAGE BULB'];
    const sc = Math.abs(Math.cos(flip * Math.PI)); const w = flip < .5 ? words[0] : words[1];
    ctx.save(); ctx.translate(X + 100, Y + 22); ctx.scale(1, Math.max(.02, sc));
    txt(w, 0, 0, font(900, 40), flip < .5 ? C.cyan2 : C.amber, 'left', 2, 'middle'); ctx.restore();
    ctx.restore();
  }
  // grinder panel
  const gp = vis(t, wt(8, 'raw') - .2, T.therm + .2, .4);
  if (gp > 0) {
    const X = O(1400, 40), Y = O(220, 860) + 30 * (1 - E.o3(P(t, wt(8, 'raw') - .2, wt(8, 'raw') + .4)));
    ctx.save(); if (V) { ctx.translate(X, Y); ctx.scale(.72, .72); ctx.translate(-X, -Y); }
    hudPanel(X, Y, 430, 380, 'MACERATOR', gp, C.amber);
    ctx.save(); ctx.globalAlpha = gp;
    const gear = (x, y, r, rot, teeth) => { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.beginPath(); for (let i = 0; i < teeth * 2; i++) { const a = i / (teeth * 2) * TAU, rr = i % 2 ? r : r * 1.18; ctx.lineTo(Math.cos(a - .12) * rr, Math.sin(a - .12) * rr); ctx.lineTo(Math.cos(a + .12) * rr, Math.sin(a + .12) * rr); } ctx.closePath(); ctx.fillStyle = '#8796a6'; ctx.fill(); ctx.fillStyle = '#2a3442'; ctx.beginPath(); ctx.arc(0, 0, r * .35, 0, TAU); ctx.fill(); ctx.restore(); };
    gear(X + 165, Y + 170, 62, t * 6, 10); gear(X + 278, Y + 170, 62, -t * 6 + .3, 10);
    const r = rng(9); ctx.fillStyle = '#a07a3e';
    for (let i = 0; i < 14; i++) { const ph = (t * 1.6 + r()) % 1; const x = X + 221 + (r() - .5) * 60 * (1 - ph); const y = Y + 60 + ph * 260; const s = ph < .45 ? 8 + r() * 6 : 2.5; ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.fill(); }
    txt('WASTE → SLURRY', X + 215, Y + 350, font(800, 26), '#fff', 'center', 2);
    ctx.restore(); ctx.restore();
  }
  callout(-d.rx * .7, d.cy + 10, O(-220, -30), O(60, 200), 'EMPTY ICE VOID', 'NOW RECEIVING ALL STATION SEWAGE', vis(t, wt(8, 'empty') - .3, T.therm - .1, .8), C.amber, O(undefined, 0));
  // thermal HUD
  const th = vis(t, T.therm, T.cool + .7, .4, .5);
  if (th > 0) {
    ctx.save(); ctx.globalAlpha = th;
    // frame corners
    ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 3;
    for (const [x, y, dx, dy] of [[O(140, 60), O(120, 240), 1, 1], [W - O(140, 60), O(120, 240), -1, 1], [O(140, 60), H - O(220, 380), 1, -1], [W - O(140, 60), H - O(220, 380), -1, -1]]) { ctx.beginPath(); ctx.moveTo(x, y + dy * 50); ctx.lineTo(x, y); ctx.lineTo(x + dx * 50, y); ctx.stroke(); }
    txt('● THERMAL VIEW', O(170, 90), O(165, 290), font(700, 18, F.m), (Math.floor(t * 2) % 2) ? C.red : '#fff', 'left', 4);
    // scale bar
    const bx = W - O(200, 110), by = O(260, 560), bh = 420;
    const gr = ctx.createLinearGradient(0, by, 0, by + bh); gr.addColorStop(0, '#ffffd2'); gr.addColorStop(.25, '#ffc83c'); gr.addColorStop(.5, '#ff461e'); gr.addColorStop(.75, '#96146e'); gr.addColorStop(1, '#2a1660');
    ctx.fillStyle = gr; ctx.fillRect(bx, by, 22, bh);
    txt('+10 °C', bx - 12, by + 8, font(700, 17, F.m), '#fff', 'right'); txt('−50 °C', bx - 12, by + bh + 4, font(700, 17, F.m), '#fff', 'right');
    ctx.restore();
    const wa = vis(t, wt(9, 'thermal') - .1, T.cool, .2) * (Math.floor(t * 4) % 2 ? 1 : .55);
    if (wa > 0) { ctx.save(); ctx.globalAlpha = wa; const x = W / 2, y = O(150, 400); if (V) { ctx.translate(x, y); ctx.scale(.85, .85); ctx.translate(-x, -y); }
      ctx.fillStyle = 'rgba(255,61,61,.18)'; rrect(x - 290, y - 42, 580, 84, 10); ctx.fill(); ctx.strokeStyle = C.red; ctx.lineWidth = 3; ctx.stroke();
      txt('⚠  MASSIVE THERMAL LOAD', x, y + 2, font(900, 38), C.red, 'center', 3, 'middle'); ctx.restore(); }
    callout(d.rx * .6, d.bot - 18, O(200, 30), O(40, 180), '≈ +10 °C SEWAGE', 'WARM WASTE, CONSTANTLY ADDED', vis(t, wt(9, 'load') - .2, T.coll + .4, .7), '#ffd27a', O(undefined, 0));
  }
  // collapse scenario
  const cs = vis(t, T.coll + .2, T.cool + .3, .4, .25);
  if (cs > 0) {
    ctx.save(); ctx.globalAlpha = cs;
    txt('SIMULATION · IF HEAT ESCAPES UPWARD', O(170, 90), O(200, 325), font(700, 17, F.m), '#ffd27a', 'left', 4); ctx.restore();
    const ca = vis(t, wt(10, 'collapse') + .1, T.cool + .2, .2, .2);
    if (ca > 0) { ctx.save(); ctx.globalAlpha = ca; const x = O(sx(0) - 290, W / 2), y = O(sy(-30) + 200, sy(70) + 40), al = O('right', 'center');
      txt('STRUCTURAL COLLAPSE', x, y, font(900, 44), C.red, al, 2);
      const v = Math.max(1, Math.floor(150 * E.o3(P(t, wt(10, 'collapse') + .1, wt(10, 'multi') + 1.0))));
      txt('$' + v + ',000,000+', x, y + 62, font(800, 50, F.m), '#fff', al, 0);
      txt('STATION AT RISK', x, y + 96, font(600, 16, F.m), 'rgba(255,255,255,.7)', al, 5);
      ctx.restore(); }
  }
  // cooling: thermometer + frost ring
  const cl = vis(t, T.cool + .2, T.freeze + .4, .4, .5);
  if (cl > 0) {
    const rr = lerp(1500, d.rx * CAM.s * 1.2, E.io(P(t, T.cool + .8, T.cool + 3.2)));
    ctx.save(); ctx.globalAlpha = cl * (1 - P(t, T.cool + 3.0, T.freeze + .3));
    const cx = sx(0), cy = sy(d.cy);
    const g2 = ctx.createRadialGradient(cx, cy, rr * .85, cx, cy, rr * 1.25); g2.addColorStop(0, 'rgba(160,230,255,0)'); g2.addColorStop(.4, 'rgba(190,240,255,.55)'); g2.addColorStop(1, 'rgba(120,200,255,.25)');
    ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(240,252,255,.8)'; ctx.lineWidth = 2; const r = rng(3);
    for (let i = 0; i < 90; i++) { const a = r() * TAU, l = 10 + r() * 30; const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.moveTo(x + Math.cos(a) * l * .5, y + Math.sin(a) * l * .5); ctx.lineTo(x + Math.cos(a + .7) * l * .8, y + Math.sin(a + .7) * l * .8); ctx.stroke(); }
    ctx.restore();
    // thermometer
    ctx.save(); ctx.globalAlpha = cl; const X = W - O(300, 110), Y = O(240, 560), Hh = 440;
    const temp = lerp(10, -50, E.io(P(t, T.cool + .5, T.cool + 3.3)));
    ctx.fillStyle = 'rgba(4,12,24,.75)'; rrect(X - 34, Y - 20, 68, Hh + 90, 34); ctx.fill(); ctx.strokeStyle = 'rgba(155,231,255,.6)'; ctx.lineWidth = 2; ctx.stroke();
    const lvl = (temp + 60) / 75; const tc = temp > -5 ? C.hot : C.cyan;
    ctx.fillStyle = tc; rrect(X - 9, Y + Hh * (1 - lvl), 18, Hh * lvl + 10, 9); ctx.fill(); ctx.beginPath(); ctx.arc(X, Y + Hh + 30, 26, 0, TAU); ctx.fill();
    for (let k = 0; k <= 6; k++) { const yy = Y + Hh * (1 - (k * 10 - 50 + 60) / 75); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(X + 16, yy, 10, 2); }
    txt((temp > 0 ? '+' : '−') + Math.abs(Math.round(temp)) + '°C', X - 60, Y + Hh * (1 - lvl) + 12, font(900, 64), tc, 'right', 0);
    txt('SURROUNDING ICE', X - 60, Y + Hh * (1 - lvl) + 44, font(600, 16, F.m), 'rgba(230,242,255,.8)', 'right', 4);
    ctx.restore();
  }
  // frozen solid title
  const fz = vis(t, wt(12, 'freezes') - .1, T.rewind + .3, .4, .3);
  if (fz > 0) {
    ctx.save(); ctx.globalAlpha = fz; const x = O(sx(d.rx) + 90, W / 2), y = O(sy(d.cy - 30), sy(d.bot) + 120); ctx.shadowColor = 'rgba(120,220,255,.8)'; ctx.shadowBlur = 30 + 10 * Math.sin(t * 4);
    txt('FROZEN', x, y, font(900, O(110, 92)), '#ffffff', O('left', 'center'), 6); txt('SOLID', x, y + O(104, 90), font(900, O(110, 92)), C.cyan2, O('left', 'center'), 6);
    ctx.restore();
  }
}
function arrow(x1, y1, x2, y2) {
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  for (const [ax, ay, bx, by] of [[x1, y1, x2, y2], [x2, y2, x1, y1]]) { const a = Math.atan2(by - ay, bx - ax); ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + Math.cos(a + .5) * 16, ay + Math.sin(a + .5) * 16); ctx.lineTo(ax + Math.cos(a - .5) * 16, ay + Math.sin(a - .5) * 16); ctx.closePath(); ctx.fill(); }
}

function sceneWorld(t) {
  const st = stateT(t);
  let cam = camAt(st);
  // final push into the frozen droplet
  if (t > RW.d - .3) {
    const u = E.io(P(t, RW.d - .3, T.sheet - .2));
    cam = { x: lerp(cam.x, DROP_REST[0], u), y: lerp(cam.y, DROP_REST[1], u), s: Math.exp(lerp(Math.log(cam.s), Math.log(15), u)) };
  }
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  drawWorld(st, t, cam);
  worldOverlays(t, st);
  // dive speed lines
  const dv = P(t, T.world + .5, T.world + .9) * (1 - P(t, T.drink - .6, T.drink - .1));
  if (dv > 0) { ctx.save(); ctx.globalAlpha = dv * .5; ctx.strokeStyle = '#dff4ff'; ctx.lineWidth = 2; const r = rng(4); for (let i = 0; i < 40; i++) { const x = r() * W, y = ((r() * H - t * 2600 * (1 + r())) % H + H) % H; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 80 + r() * 160); ctx.stroke(); } ctx.restore(); }
  // rewind VHS
  if (t > RW.a - .1 && t < RW.d + .1) vhs(t);
  // locked label on final push
  const lk = vis(t, RW.d + .2, T.sheet + .3, .5, .4);
  if (lk > 0) { ctx.save(); ctx.globalAlpha = lk; const x = W / 2, y = H / 2;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; const s = 1 + .2 * (1 - E.oBack(P(t, RW.d + .2, RW.d + .7)));
    ctx.translate(x - 190, y - 10); ctx.scale(s, s);
    ctx.beginPath(); ctx.arc(0, -28, 22, Math.PI, 0); ctx.stroke(); ctx.fillStyle = '#fff'; rrect(-34, -28, 68, 56, 8); ctx.fill(); ctx.fillStyle = '#0d2a4a'; ctx.beginPath(); ctx.arc(0, -4, 7, 0, TAU); ctx.fill(); ctx.fillRect(-3, -2, 6, 16);
    ctx.restore(); }
}
function vhs(t) {
  const rew = t < RW.b, ff = t > RW.c && t < RW.d;
  ctx.save();
  // chroma split
  BUF2.getContext('2d').clearRect(0, 0, W, H); BUF2.getContext('2d').drawImage(cv, 0, 0);
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .18; ctx.drawImage(BUF2, 8, 0); ctx.drawImage(BUF2, -8, 0);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  // tracking bars
  const r = rng(Math.floor(t * 24));
  for (let i = 0; i < 6; i++) { const y = r() * H, h = 2 + r() * 16; ctx.drawImage(BUF2, 0, y, W, h, (r() - .5) * 60, y, W, h); ctx.fillStyle = `rgba(255,255,255,${r() * .12})`; ctx.fillRect(0, y, W, h); }
  ctx.fillStyle = 'rgba(0,0,0,.12)'; for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 2);
  const bar = (t * 300) % (H + 200) - 100; ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fillRect(0, bar, W, 70);
  const lab = rew ? '◀◀  REWIND' : ff ? '▶▶  FAST FORWARD' : '▶  PLAY';
  txt(lab, O(120, 70), O(130, 330), font(800, 44, F.m), '#fff', 'left', 4);
  const st = stateT(t), mm = Math.floor(st / 60), ss = Math.floor(st % 60), fr = Math.floor((st % 1) * 30);
  txt(`TC 00:0${mm}:${String(ss).padStart(2, '0')}:${String(fr).padStart(2, '0')}`, O(120, 70), O(175, 375), font(500, 24, F.m), 'rgba(255,255,255,.85)', 'left', 3);
  ctx.restore();
}

// ---------------------------------------------------------------- SCENE 6: ice sheet & coast
function sheetGeo() { return V ? { x0: 120, x1: 960, sea: 1130, Hp: 560 } : { x0: 250, x1: 1560, sea: 820, Hp: 470 }; }
function sheetSurf(u, G) { return G.sea - G.Hp * Math.pow(clamp(1 - Math.pow(clamp(u), 4 / 3)), 3 / 8) - 26; }
function sheetBed(u, G) { return G.sea + 40 + 34 * fbm(u * 7 + 3) + 70 * u * u; }
function sceneSheet(t) {
  const G = sheetGeo(), t0 = T.sheet;
  const tu = (u) => G.x0 + (G.x1 - G.x0) * u;
  const tomb = E.io2(P(t, t0 + .8, 73.6)) * .58;
  const tombK = .93;
  const tombPos = () => { const x = tu(tomb), ys = sheetSurf(tomb, G), yb = sheetBed(tomb, G); return [x, lerp(yb, ys, tombK)]; };
  const zoomIn = 1 - E.io(P(t, t0 - .4, t0 + 1.4));
  const [tx0, ty0] = tombPos();
  ctx.save();
  const z = 1 + 9 * zoomIn;
  ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-lerp(W / 2, tx0, zoomIn), -lerp(H / 2, ty0, zoomIn));
  // sky
  const sk = ctx.createLinearGradient(0, 0, 0, G.sea); sk.addColorStop(0, '#01040b'); sk.addColorStop(1, '#12304f');
  ctx.fillStyle = sk; ctx.fillRect(-200, -200, W + 400, H + 400);
  ctx.restore();
  drawStars(t, .6); drawAurora(t, .35, O(300, 520));
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-lerp(W / 2, tx0, zoomIn), -lerp(H / 2, ty0, zoomIn));
  // ocean
  const og = ctx.createLinearGradient(0, G.sea, 0, H); og.addColorStop(0, '#0f4b7a'); og.addColorStop(1, '#03121f');
  ctx.fillStyle = og; ctx.fillRect(tu(.9), G.sea, W, H);
  ctx.strokeStyle = 'rgba(150,210,255,.25)'; ctx.lineWidth = 2; for (let k = 0; k < 5; k++) { ctx.beginPath(); for (let x = tu(.95); x < W + 50; x += 10) ctx.lineTo(x, G.sea + 4 + k * 12 + 2 * Math.sin(x * .03 + t * 2 + k)); ctx.stroke(); }
  // bedrock
  ctx.fillStyle = '#2a2f3a'; ctx.beginPath(); ctx.moveTo(-100, H + 100); for (let u = -.3; u <= 1.25; u += .005) ctx.lineTo(tu(u), sheetBed(u, G)); ctx.lineTo(W + 100, H + 100); ctx.fill();
  // ice sheet
  ctx.beginPath(); ctx.moveTo(tu(-.3), sheetBed(-.3, G));
  for (let u = -.3; u <= 1; u += .004) ctx.lineTo(tu(u), sheetSurf(Math.max(0, u), G));
  // ice shelf
  ctx.lineTo(tu(1.0), G.sea - 26); ctx.lineTo(tu(1.12), G.sea - 14); ctx.lineTo(tu(1.12), G.sea + 30); ctx.lineTo(tu(1.0), G.sea + 46);
  for (let u = 1; u >= -.3; u -= .004) ctx.lineTo(tu(u), sheetBed(u, G));
  ctx.closePath();
  const ig = ctx.createLinearGradient(0, G.sea - G.Hp, 0, G.sea + 80); ig.addColorStop(0, '#e9f5ff'); ig.addColorStop(.12, '#9cc8e6'); ig.addColorStop(1, '#1d4f7d');
  ctx.fillStyle = ig; ctx.fill(); ctx.strokeStyle = 'rgba(220,245,255,.9)'; ctx.lineWidth = 2; ctx.stroke();
  // isochrone layers + flow particles
  ctx.save(); ctx.clip();
  for (let k = 1; k < 10; k++) { const kk = k / 10; ctx.strokeStyle = `rgba(230,245,255,${.08 + .04 * (k % 2)})`; ctx.lineWidth = 1.5; ctx.beginPath(); for (let u = 0; u <= 1.12; u += .01) { const uu = Math.min(u, 1); ctx.lineTo(tu(u), lerp(sheetBed(uu, G), sheetSurf(uu, G), Math.pow(kk, .8))); } ctx.stroke(); }
  const r = rng(51);
  for (let i = 0; i < 160; i++) { const kk = .1 + r() * .88, ph = r(); const sp = .05 + .03 * r(); const u = (ph + t * sp) % 1.1; const uu = Math.min(u, 1);
    const x = tu(u), y = lerp(sheetBed(uu, G), sheetSurf(uu, G), Math.pow(kk, .8)); ctx.fillStyle = `rgba(255,255,255,${.25 + .5 * u})`; ctx.fillRect(x, y, 3 + u * 6, 2); }
  ctx.restore();
  // icebergs
  for (const [u, w, h] of [[1.2, 40, 18], [1.32, 26, 12], [1.45, 60, 22]]) { const x = tu(u) + Math.sin(t * .5 + u * 9) * 4; ctx.fillStyle = '#dff1ff'; ctx.beginPath(); ctx.moveTo(x - w, G.sea); ctx.lineTo(x - w * .6, G.sea - h); ctx.lineTo(x + w * .5, G.sea - h * .8); ctx.lineTo(x + w, G.sea); ctx.closePath(); ctx.fill(); ctx.fillStyle = 'rgba(180,220,255,.25)'; ctx.beginPath(); ctx.moveTo(x - w, G.sea); ctx.lineTo(x + w, G.sea); ctx.lineTo(x + w * .6, G.sea + h * 2.4); ctx.lineTo(x - w * .7, G.sea + h * 2.2); ctx.fill(); }
  // station marker at pole
  const ps = sheetSurf(0, G);
  if (zoomIn < .3) { ctx.fillStyle = '#c9d3dc'; ctx.fillRect(tu(0) - 14, ps - 9, 28, 7); } if (zoomIn < .3) { ctx.fillStyle = '#ffb340'; ctx.fillRect(tu(0) - 12, ps - 7, 24, 2); }
  ctx.restore();
  // labels (screen)
  const la = P(t, t0 + .8, t0 + 1.6) * (1 - zoomIn);
  if (la > 0) {
    ctx.save(); ctx.globalAlpha = la;
    txt('SOUTH POLE', tu(0) - 10, ps - O(120, 70), font(800, 26), '#fff', 'left', 3); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(tu(0), ps - 14); ctx.lineTo(tu(0), ps - O(110, 60)); ctx.stroke();
    txt('COAST', O(tu(1.07), tu(.98)), G.sea - O(70, 110), font(800, 26), '#fff', 'center', 3);
    txt('ICE FLOWS ≈ 10 m / YEAR  →', W / 2 + O(40, 0), O(470, 860), font(700, 20, F.m), C.cyan2, 'center', 4);
    const yb = sheetBed(0, G); ctx.strokeStyle = C.cyan2; ctx.fillStyle = C.cyan2; ctx.lineWidth = 2; arrow(tu(0) - 50, ps, tu(0) - 50, yb);
    if (V) { ctx.save(); ctx.translate(tu(0) - 70, (ps + yb) / 2); ctx.rotate(-Math.PI / 2); txt('≈2,700 m THICK', 0, 0, font(700, 18, F.m), C.cyan2, 'center', 2, 'middle'); ctx.restore(); }
    else txt('≈2,700 m', tu(0) - 64, (ps + yb) / 2, font(700, 18, F.m), C.cyan2, 'right', 1, 'middle');
    txt('VERTICAL SCALE EXAGGERATED', W - 40, H - 30, font(500, 13, F.m), 'rgba(255,255,255,.4)', 'right', 3);
    ctx.restore();
  }
  // the tomb
  const [tx, ty] = tombPos();
  const X = W / 2 + (tx - lerp(W / 2, tx0, zoomIn)) * z, Y = H / 2 + (ty - lerp(H / 2, ty0, zoomIn)) * z;
  // trail
  ctx.save(); ctx.setLineDash([4, 8]); ctx.strokeStyle = 'rgba(255,179,64,.7)'; ctx.lineWidth = 2; ctx.beginPath();
  for (let u = 0; u <= tomb; u += .005) { const x = tu(u), y = lerp(sheetBed(u, G), sheetSurf(u, G), tombK); u ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } if (zoomIn < .05) ctx.stroke(); ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; const gl = ctx.createRadialGradient(X, Y, 0, X, Y, 36); gl.addColorStop(0, 'rgba(255,190,110,.9)'); gl.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gl; ctx.fillRect(X - 36, Y - 36, 72, 72); ctx.restore();
  ctx.save(); ctx.translate(X, Y); ctx.fillStyle = '#7a5526'; ctx.strokeStyle = '#f2fbff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 0, 9, 13, 0, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore();
  reticle(X, Y, 24, t, 'FLUSH #001', 'FROZEN TOMB', P(t, t0 + .6, t0 + 1.2) * (1 - P(t, 71.6, 72.2)), C.amber);
  // years counter
  const ya = P(t, t0 + 1.0, t0 + 1.6) * (1 - P(t, 71.6, 72.2));
  if (ya > 0) { ctx.save(); ctx.globalAlpha = ya;
    const PX = O(W - 560, W / 2 - 230), PY = O(120, 270); ctx.translate(PX - (W - 560), PY - 120);
    hudPanel(W - 560, 120, 460, 170, 'TIME IN THE ICE', ya, C.amber);
    const yrs = Math.floor(tomb * 1300000 / 10 / 100) * 100;
    txt('+' + yrs.toLocaleString('en-US'), W - 520, 240, font(800, 74, F.m), '#fff', 'left', 0); txt('YEARS', W - 150, 240, font(700, 20, F.m), C.amber, 'right', 4);
    ctx.restore(); }
  // end card
  const ec = P(t, 71.7, 72.5);
  if (ec > 0) {
    ctx.fillStyle = `rgba(2,6,12,${.72 * ec})`; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalAlpha = ec;
    const y = H / 2 - 30 + 20 * (1 - E.o3(ec));
    if (V) { txt('THE FROZEN', W / 2, y - 120, font(900, 118), '#fff', 'center', 6, 'middle'); txt('TOMB', W / 2, y, font(900, 118), '#fff', 'center', 10, 'middle'); }
    else txt('THE FROZEN TOMB', W / 2, y, font(900, 120), '#fff', 'center', 10, 'middle');
    ctx.fillStyle = C.cyan; ctx.fillRect(W / 2 - 300 * E.o3(P(t, 72, 72.8)), y + 78, 600 * E.o3(P(t, 72, 72.8)), 3);
    txt('HOW THE SOUTH POLE MAKES SEWAGE DISAPPEAR', W / 2, y + 130, font(600, 22, F.m), C.cyan2, 'center', 6);
    ctx.restore();
  }
}

// ---------------------------------------------------------------- global HUD, captions, finishing
const CHAP = [[0, '00', 'THE PROBLEM'], [T.drink, '01', 'DRINKING WATER'], [T.aband, '02', 'REPURPOSE'], [T.therm, '03', 'THE THREAT'], [T.freeze, '04', 'THE TOMB']];
function chapter(t) {
  if (t > 71.6) return;
  let i = 0; while (i < CHAP.length - 1 && t >= CHAP[i + 1][0]) i++;
  const [t0, n, name] = CHAP[i], p = P(t, t0 + .1, t0 + .7), a = P(t, .4, 1.0) * (t < T.toilet || t > T.world + .2 || true ? 1 : 0);
  ctx.save(); ctx.globalAlpha = a;
  const CY = O(74, 170); txt('CH ' + n, 70, CY, font(700, 16, F.m), C.cyan, 'left', 4);
  ctx.fillStyle = C.cyan; ctx.fillRect(140, CY - 7, 40 * E.o3(p), 2);
  const shown = name.slice(0, Math.round(name.length * p));
  txt(shown, 194, CY + 1, font(800, 20), '#fff', 'left', 5);
  txt('90°S · AMUNDSEN–SCOTT STATION', O(W - 70, 70), O(74, 204), font(500, 15, F.m), 'rgba(220,240,255,.6)', O('right', 'left'), 3);
  ctx.restore();
}
function captions(t) {
  for (let i = 0; i < CAP.length; i++) {
    const a0 = TL[i].s - .12, a1 = i < CAP.length - 1 ? Math.min(TL[i + 1].s - .12, TL[i].e + .9) : TL[i].e + .5;
    if (t < a0 || t > a1) continue;
    const fade = P(t, a0, a0 + .1) * (1 - P(t, a1 - .2, a1));
    const ws = capWords[i];
    ctx.font = font(700, 50);
    const sp = ctx.measureText(' ').width * 1.15, maxW = O(1380, 940);
    const lines = [[]]; let lw = 0;
    for (const w of ws) { ctx.font = font(w.hl ? 850 : 700, O(50, 54)); const ww = ctx.measureText(w.txt).width; if (lw + ww > maxW && lines[lines.length - 1].length) { lines.push([]); lw = 0; } lines[lines.length - 1].push({ w, ww }); lw += ww + sp; }
    const lh = O(64, 70), baseY = H - O(92, 330) - (lines.length - 1) * lh;
    // legibility band
    const bg = ctx.createLinearGradient(0, baseY - 120, 0, H); bg.addColorStop(0, 'rgba(0,0,0,0)'); bg.addColorStop(1, `rgba(0,0,0,${.6 * fade})`);
    ctx.fillStyle = bg; ctx.fillRect(0, baseY - 120, W, H);
    lines.forEach((ln, li) => {
      const tot = ln.reduce((s, o) => s + o.ww, 0) + sp * (ln.length - 1); let x = W / 2 - tot / 2; const y = baseY + li * lh;
      for (const { w, ww } of ln) {
        const p = P(t, w.t - .06, w.t + .14), e = E.o3(p);
        ctx.save(); ctx.globalAlpha = fade * (.15 + .85 * p);
        ctx.shadowColor = 'rgba(0,0,0,.8)'; ctx.shadowBlur = 16;
        const col = w.hl ? (CAPHOT[i] ? '#ffb340' : '#7fe0ff') : '#ffffff';
        txt(w.txt, x, y + 10 * (1 - e), font(w.hl ? 850 : 700, O(50, 54)), col, 'left');
        ctx.restore();
        x += ww + sp;
      }
    });
  }
}
function shake(t) {
  let a = 0;
  const hits = [[wt(1, 'physically'), 14, .5], [wt(7, 'abandon'), 12, .45], [wt(10, 'collapse') + .05, 22, 1.6], [T.sheet - .3, 6, .4]];
  for (const [h, amp, d] of hits) if (t > h && t < h + d) a += amp * (1 - (t - h) / d);
  if (t > T.coll + 1 && t < T.cool) a += 3 * P(t, T.coll + 1, wt(10, 'collapse'));
  return { x: a * noise(t * 40), y: a * noise(t * 40 + 100) };
}
function finish(t) {
  ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = .08;
  const gi = GRAIN[Math.floor(t * 24) % 4], ox = (Math.floor(t * 24) * 137) % 512, oy = (Math.floor(t * 24) * 251) % 512;
  for (let x = -ox; x < W; x += 512) for (let y = -oy; y < H; y += 512) ctx.drawImage(gi, x, y);
  ctx.restore();
  ctx.drawImage(VIG, 0, 0);
  // progress thread
  ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(0, H - 4, W, 4); ctx.fillStyle = C.cyan; ctx.fillRect(0, H - 4, W * t / DUR, 4);
  // fades
  const fi = 1 - P(t, 0, .6), fo = P(t, DUR - .7, DUR);
  if (fi + fo > 0) { ctx.fillStyle = `rgba(0,0,0,${Math.max(fi, fo)})`; ctx.fillRect(0, 0, W, H); }
}
function flash(t) {
  const fl = [[T.map, .35], [T.world, .3], [wt(7, 'abandon'), .16], [T.sheet - .1, .45], [T.therm, .25], [T.cool, .3], [RW.d, .2]];
  for (const [h, d] of fl) if (t > h - .04 && t < h + d) { ctx.fillStyle = `rgba(220,245,255,${.55 * (1 - (t - h) / d)})`; ctx.fillRect(0, 0, W, H); }
}
const SCN = [sceneIntro, sceneMap, sceneToilet, sceneWorld, sceneSheet];
function sceneIdx(t) { return t < T.map ? 0 : t < T.toilet ? 1 : t < T.world ? 2 : t < T.sheet ? 3 : 4; }
function drawScene(t) { SCN[sceneIdx(t)](t); }
let SH = { x: 0, y: 0 };
function render(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  SH = shake(t);
  const XF = [[T.map, .6, 0, 1], [T.sheet, 1.1, 3, 4]];
  let xf = null; for (const x of XF) if (t >= x[0] - x[1] / 2 && t < x[0] + x[1] / 2) xf = x;
  ctx.save(); ctx.translate(SH.x, SH.y);
  if (xf) {
    const [b, d, i0, i1] = xf, u = P(t, b - d / 2, b + d / 2);
    SCN[i0](t);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const g = BUF.getContext('2d'); g.globalAlpha = 1; g.clearRect(0, 0, W, H); g.drawImage(cv, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.setTransform(1, 0, 0, 1, SH.x, SH.y);
    SCN[i1](t);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1 - E.io2(u); ctx.drawImage(BUF, 0, 0); ctx.globalAlpha = 1;
  } else drawScene(t);
  ctx.restore();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  flash(t);
  { const g = ctx.createLinearGradient(0, 0, 0, O(170, 280)); g.addColorStop(0, 'rgba(0,6,14,.55)'); g.addColorStop(1, 'rgba(0,6,14,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, O(170, 280)); }
  chapter(t);
  captions(t);
  finish(t);
}

// sound-event export
(function () {
  ev('whoosh', T.map - .3); ev('whoosh', T.toilet - .2); ev('dive', T.world); ev('whoosh', T.sheet - .6); ev('whoosh', RW.d - .1);
  ev('boom', wt(1, 'physically')); ev('stamp', wt(7, 'abandon')); ev('boom', wt(10, 'collapse') + .05); ev('final', 71.7);
  ev('flush', T.toilet + .2); ev('pop', wt(0, 'sewage') - .15); ev('disperse', wt(0, 'disappear') - .05);
  ev('drill', T.drink + .2); ev('melt', T.melt + 1.2); ev('pump', T.deep);
  ev('tick', wt(1, 'flying')); ev('fuel', T.fuel + .4); ev('flip', wt(7, 'repurpose') + .15);
  ev('grind', wt(8, 'raw') - .2); ev('pour', wt(8, 'straight') - .2); ev('alarm', wt(9, 'thermal') - .1); ev('alarm2', wt(10, 'collapse'));
  ev('therm', T.therm); ev('rumble', T.coll + .6); ev('cold', T.cool); ev('freeze', wt(12, 'entire') - .1); ev('rewind', RW.a); ev('ff', RW.c); ev('lock', RW.d + .2);
  ev('callout', wt(4, 'rodriguez') - .35); ev('callout', T.world + .1); ev('callout', wt(8, 'empty') - .3);
  ev('impact', wt(12, 'freezes') - .1);
  window.EVENTS = EV; window.TIMES = T; window.RW = RW;
})();
window.render = render;
