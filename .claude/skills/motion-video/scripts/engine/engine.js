/* Motion-video engine: a deterministic canvas film you can render frame by frame.
 *
 * A film is a list of scenes drawn onto one canvas. Every draw function receives the
 * film time t (seconds) and must depend on nothing else: no Math.random, no wall clock,
 * no state carried between calls. That is what lets render.mjs render any frame, in any
 * order, across parallel browser pages, and what lets motion blur sample sub-frames.
 *
 * Minimal film:
 *   const film = Film.create({W:1920, H:1080, FPS:60, DUR:10, bg:'#0a0d18'});
 *   film.scene(0, 4, (ctx, t) => { ... });          // drawn while 0 <= t < 4
 *   film.overlay((ctx, t) => { ... });              // drawn over every scene (chrome, flashes)
 *   film.cues = {hit: 2.5, pops: [...]};            // exported to cues.json for the score
 *   film.start(['300 40px "Spectral"', ...]);       // load fonts, then preview or await render
 *
 * Helpers are on the global `M` (maths, easing, colour, glow, sims, camera) and `T` (type).
 */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ maths */
  const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const prog = (t, a, b) => clamp((t - a) / (b - a));           // 0→1 as t goes a→b
  const bell = (t, a, b) => Math.sin(Math.PI * prog(t, a, b));  // 0→1→0 over [a,b]
  const E = {
    linear: x => x,
    inQuad: x => x * x, outQuad: x => 1 - (1 - x) * (1 - x),
    inCubic: x => x * x * x, outCubic: x => 1 - Math.pow(1 - x, 3),
    inOutCubic: x => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    inOutSine: x => -(Math.cos(Math.PI * x) - 1) / 2,
    outQuint: x => 1 - Math.pow(1 - x, 5),
    inOutQuint: x => (x < .5 ? 16 * x ** 5 : 1 - Math.pow(-2 * x + 2, 5) / 2),
    inExpo: x => (x <= 0 ? 0 : Math.pow(2, 10 * x - 10)),
    outExpo: x => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
    outBack: x => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
  };
  // Seeded RNG for precomputation (never call it inside a draw function).
  function rng(seed) { let a = seed | 0; return function () { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  // Stateless hash in [0,1): use inside draw functions for per-item "randomness".
  function hash(a, b = 0) { let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x632be5ab, 0xc2b2ae35); h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; return (h >>> 0) / 4294967296; }
  // Binary-search the time at which a monotonic function f(t) reaches value v (e.g. when a playhead passes an item).
  function solveTime(f, v, a, b) { for (let k = 0; k < 40; k++) { const m = (a + b) / 2; if (f(m) < v) a = m; else b = m; } return b; }

  /* ------------------------------------------------------------------ colour */
  const _rgb = {};
  // Accepts '#rrggbb' or [r,g,b]. Passing an rgba() string is the classic bug (it yields black), so it throws instead.
  function rgb(c) {
    if (Array.isArray(c)) return c;
    if (_rgb[c]) return _rgb[c];
    if (typeof c !== 'string' || c[0] !== '#' || c.length !== 7) throw new Error('colour must be #rrggbb or [r,g,b], got ' + c);
    const n = parseInt(c.slice(1), 16); return (_rgb[c] = [n >> 16 & 255, n >> 8 & 255, n & 255]);
  }
  const rgba = (c, a) => { const p = rgb(c); return `rgba(${p[0]},${p[1]},${p[2]},${clamp(a)})`; };
  const mixRGB = (a, b, t) => { const p = rgb(a), q = rgb(b); return p.map((v, i) => v + (q[i] - v) * t); }; // returns [r,g,b] for chaining
  const mix = (a, b, t, alpha = 1) => { const m = mixRGB(a, b, t); return `rgba(${m.map(Math.round).join(',')},${alpha})`; };
  // Soft radial light. Use with ctx.globalCompositeOperation='lighter' for additive glow.
  function glow(ctx, x, y, r, c, a, mid = .42) {
    if (a <= .002 || r <= .5) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(c, a)); g.addColorStop(.22, rgba(c, a * mid)); g.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  // Additive block: M.add(ctx, () => { glow(...); ... })
  function add(ctx, fn) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; fn(); ctx.restore(); }

  /* ------------------------------------------------------------------ simulations */
  // Precompute a particle system at a fixed tick rate, then sample it by time with interpolation.
  //   const swarm = M.sim({n:150, dur:4, hz:240, seed:7,
  //     init: (i, r) => ({x: r()*1920, y: r()*1080, a: r()*6.28}),
  //     step: (p, t, dt, r, i) => { p.x += ...; }});      // mutate p in place
  //   const p = swarm.at(i, t);  // {x, y, a, ...} interpolated; wrap: {x:[-40,1960]} avoids lerping across wraps
  function sim({ n, dur, hz = 240, seed = 1, init, step, wrap = {} }) {
    const r = rng(seed), ps = Array.from({ length: n }, (_, i) => init(i, r));
    const keys = Object.keys(ps[0]), K = keys.length, ticks = Math.ceil(dur * hz) + 2, st = new Float32Array(ticks * n * K);
    for (let k = 0; k < ticks; k++) {
      for (let i = 0; i < n; i++) {
        if (k > 0) step(ps[i], k / hz, 1 / hz, r, i);
        for (let j = 0; j < K; j++) st[(k * n + i) * K + j] = ps[i][keys[j]];
      }
    }
    return {
      n, keys,
      at(i, t) {
        const kf = clamp(t * hz, 0, ticks - 1.001), k0 = Math.floor(kf), f = kf - k0, o = (k0 * n + i) * K, q = o + n * K, out = {};
        for (let j = 0; j < K; j++) {
          const a = st[o + j], b = st[q + j], key = keys[j], w = wrap[key];
          out[key] = w && Math.abs(b - a) > (w[1] - w[0]) / 2 ? a : a + (b - a) * f;
        }
        return out;
      },
    };
  }

  /* ------------------------------------------------------------------ camera */
  // A 2D camera: world point (fx,fy) appears at screen (ax,ay), scaled by s, rotated by rot.
  // Zoom through something: s = exp(log(S) * ease(p)), and ease (ax,ay) from the focus's own
  // screen position to the frame centre so the zoom feels anchored.
  const cam = {
    apply(ctx, c) { ctx.translate(c.ax, c.ay); ctx.rotate(c.rot || 0); ctx.scale(c.s, c.s); ctx.translate(-c.fx, -c.fy); },
    point(c, x, y) { const dx = (x - c.fx) * c.s, dy = (y - c.fy) * c.s, co = Math.cos(c.rot || 0), si = Math.sin(c.rot || 0); return { x: c.ax + dx * co - dy * si, y: c.ay + dx * si + dy * co }; },
    zoom(S, p, ease = E.inCubic) { return Math.exp(Math.log(S) * ease(clamp(p))); },
  };
  function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

  window.M = { clamp, lerp, prog, bell, E, rng, hash, solveTime, rgb, rgba, mix, mixRGB, glow, add, sim, cam, rrect };

  /* ------------------------------------------------------------------ typography */
  // Font strings are plain canvas fonts: `${style} ${weight} ${px}px ${family}`.
  // Web-font subsets from Google cover Latin + general punctuation (– — ’ “ ” · …) but NOT
  // arrows (→), superscripts (⁺ ²) or most symbols: draw those (T.arrow) or the fallback font shows.
  const GLY = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  function setFont(ctx, f, ls = '0px') { ctx.font = f; ctx.letterSpacing = ls; }
  function label(ctx, s, x, y, font, col, a = 1, align = 'left', ls = '0px') {
    if (a <= 0) return; ctx.save(); ctx.globalAlpha *= a; setFont(ctx, font, ls); ctx.fillStyle = col; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(s, x, y); ctx.restore();
  }
  function arrow(ctx, x, y, w, size, col) {
    const m = y - size * .3, lw = Math.max(1.5, size * .07), hs = size * .24;
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
    ctx.moveTo(x + size * .08, m); ctx.lineTo(x + w - size * .12, m); ctx.moveTo(x + w - size * .12 - hs, m - hs); ctx.lineTo(x + w - size * .12, m); ctx.lineTo(x + w - size * .12 - hs, m + hs);
    ctx.stroke(); ctx.restore();
  }
  // Mono label that decodes from scrambled glyphs, one character at a time.
  //   T.eyebrow(ctx, [{s:'1866', c:blue}, {s:' · ST PETERSBURG', c:muted}], x, y, t, t0, {size:20, out:[t1, .3]})
  function eyebrow(ctx, parts, x, y, t, t0, o = {}) {
    const size = o.size || 20, cps = o.cps || .016, font = o.font || `500 ${size}px ${T.MONO}`;
    let a = 1; if (o.out) a = 1 - E.inCubic(prog(t, o.out[0], o.out[0] + o.out[1])); if (a <= 0 || t < t0 - .1) return;
    ctx.save(); ctx.globalAlpha *= a; setFont(ctx, font, (size * .14).toFixed(2) + 'px'); ctx.textBaseline = 'alphabetic';
    const chars = []; for (const p of parts) for (const ch of p.s) chars.push({ ch, c: p.c });
    const adv = ctx.measureText('0000000000').width / 10, tw = adv * chars.length;
    const ox = o.align === 'right' ? x - tw : o.align === 'center' ? x - tw / 2 : x;
    const dy = o.out ? -14 * E.inCubic(prog(t, o.out[0], o.out[0] + o.out[1])) : 0;
    chars.forEach((c, i) => {
      const ti = t0 + i * cps; if (t < ti - .14) return; let ch = c.ch, col = c.c;
      if (t < ti && ch !== ' ') { ch = GLY[Math.floor(hash(i * 7 + 3, Math.floor(t * 36)) * GLY.length)]; col = o.scrambleColor || T.faint; }
      ctx.fillStyle = col; ctx.fillText(ch, ox + i * adv, y + dy);
    });
    ctx.restore();
  }
  function layout(ctx, segs) {
    const words = []; let cx = 0;
    for (const sg of segs) {
      setFont(ctx, sg.f, sg.ls); const size = parseFloat(sg.f.match(/(\d+(?:\.\d+)?)px/)[1]);
      for (const tk of sg.s.split(/(\s+)/)) {
        if (!tk) continue;
        if (/^\s+$/.test(tk)) { cx += ctx.measureText(tk).width; continue; }
        if (tk === '→') { const w = size * .95; words.push({ tk, x: cx, w, sg, arrow: size }); cx += w; continue; }
        const w = ctx.measureText(tk).width; words.push({ tk, x: cx, w, sg }); cx += w;
      }
    }
    ctx.letterSpacing = '0px'; return { words, width: cx };
  }
  // Rich line: segments {s, f, c, glow?:[colour, alpha, blur] | (t)=>[...], ls?}. Words rise in with a blur,
  // staggered; o.out = [start, duration] makes them exit. o.halo = colour draws a knock-out stroke behind
  // the letters so the line stays legible over moving artwork. Returns the line width.
  function line(ctx, segs, x, y, t, o = {}) {
    const t0 = o.t0 || 0, st = o.st ?? .06, d = o.d || .55, rise = o.rise ?? 34, blur = o.blur ?? 14;
    if (t < t0) return 0;
    const L = layout(ctx, segs), ox = o.align === 'center' ? x - L.width / 2 : o.align === 'right' ? x - L.width : x;
    L.words.forEach((wd, i) => {
      const p = E.outCubic(prog(t, t0 + i * st, t0 + i * st + d)); if (p <= 0) return;
      let a = p, dy = (1 - p) * rise, bl = (1 - p) * blur;
      if (o.out) { const q = E.inCubic(prog(t, o.out[0] + i * st * .4, o.out[0] + i * st * .4 + o.out[1])); a *= 1 - q; dy -= q * rise * .7; bl += q * blur; }
      if (a <= .004) return;
      ctx.save(); ctx.globalAlpha *= a; if (bl > .4) ctx.filter = `blur(${bl.toFixed(1)}px)`;
      if (wd.arrow) { arrow(ctx, ox + wd.x, y + dy, wd.w, wd.arrow, wd.sg.c); ctx.restore(); return; }
      setFont(ctx, wd.sg.f, wd.sg.ls); ctx.textBaseline = 'alphabetic';
      if (o.halo) { ctx.strokeStyle = o.halo; ctx.lineWidth = o.haloWidth || 10; ctx.lineJoin = 'round'; ctx.strokeText(wd.tk, ox + wd.x, y + dy); }
      ctx.fillStyle = wd.sg.c;
      if (wd.sg.glow) { const g = typeof wd.sg.glow === 'function' ? wd.sg.glow(t) : wd.sg.glow; if (g && g[1] > 0) { ctx.shadowColor = rgba(g[0], g[1]); ctx.shadowBlur = g[2] || 28; } }
      ctx.fillText(wd.tk, ox + wd.x, y + dy); ctx.restore();
    });
    return L.width;
  }
  // Fixed-width digit cells so changing counters do not jitter (most display faces have proportional figures).
  function tabular(ctx, str, x, y, font, col, cell, align = 'left') {
    ctx.save(); setFont(ctx, font); ctx.fillStyle = col; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'center';
    const ws = [...str].map(ch => (/[0-9]/.test(ch) ? cell : ctx.measureText(ch).width + cell * .08)), tw = ws.reduce((a, b) => a + b, 0);
    let cx = align === 'right' ? x - tw : align === 'center' ? x - tw / 2 : x;
    [...str].forEach((ch, i) => { ctx.fillText(ch, cx + ws[i] / 2, y); cx += ws[i]; }); ctx.restore(); return tw;
  }
  // Base text with a drawn superscript, e.g. T.sup(ctx, 'Ca', '2+', x, y, col, 16).
  function sup(ctx, base, s, x, y, col, size = 16, family = T.MONO) {
    ctx.save(); setFont(ctx, `500 ${size}px ${family}`); ctx.fillStyle = col; ctx.fillText(base, x, y); const w = ctx.measureText(base).width;
    setFont(ctx, `500 ${size * .68}px ${family}`); ctx.fillText(s, x + w + 1, y - size * .42); ctx.restore();
  }
  // Callout: anchor dot + ripple, elbow leader drawn on, then a mono title and an optional sans subline.
  // p is 0→1 progress (e.g. prog(t, t0, t0+.7)). o.left puts the label to the left of its elbow.
  function callout(ctx, ax, ay, lx, ly, p, title, sub, col, o = {}) {
    if (p <= 0) return; ctx.save(); ctx.globalAlpha *= o.a ?? 1;
    const ex = lx + (o.left ? 18 : -18), pts = [[ax, ay], [ex, ly], [lx + (o.left ? 6 : -6), ly]];
    const seg = [Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]), Math.abs(pts[2][0] - pts[1][0])];
    let rem = (seg[0] + seg[1]) * E.outCubic(clamp(p * 1.6));
    ctx.strokeStyle = rgba(col, .8); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(ax, ay);
    for (let i = 0; i < 2; i++) { const f = clamp(rem / seg[i]); ctx.lineTo(lerp(pts[i][0], pts[i + 1][0], f), lerp(pts[i][1], pts[i + 1][1], f)); rem -= seg[i]; if (rem <= 0) break; }
    ctx.stroke(); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(ax, ay, 4.5 * E.outBack(clamp(p * 3)), 0, 7); ctx.fill();
    ctx.strokeStyle = rgba(col, .5 * (1 - clamp(p * 1.4))); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(ax, ay, 4 + 26 * E.outCubic(clamp(p * 1.4)), 0, 7); ctx.stroke();
    const q = E.outCubic(prog(p, .45, 1));
    if (q > 0) {
      label(ctx, title, lx, ly + 6 + (1 - q) * 10, `500 17px ${T.MONO}`, T.fg, q, o.left ? 'right' : 'left', '2.2px');
      if (sub) label(ctx, sub, lx, ly + 34 + (1 - q) * 10, `400 19px ${T.BODY}`, T.muted, q, o.left ? 'right' : 'left');
    }
    ctx.restore();
  }
  // T.DISP/BODY/MONO and T.fg/muted/faint are defaults; a film overrides them to match its source.
  window.T = { DISP: 'Georgia, serif', BODY: 'system-ui, sans-serif', MONO: 'ui-monospace, monospace', fg: '#e8ebf5', muted: '#9aa3bf', faint: '#6a7393',
    label, arrow, eyebrow, line, layout, tabular, sup, callout, setFont };

  /* ------------------------------------------------------------------ film */
  window.Film = {
    create(cfg) {
      const film = Object.assign({ W: 1920, H: 1080, FPS: 60, DUR: 10, bg: '#0a0d18', grain: .09, vignette: .5, fadeIn: .35 }, cfg);
      const scenes = [], overlays = [];
      film.cues = {};
      film.scene = (from, to, draw) => { scenes.push({ from, to, draw }); return film; };
      film.overlay = draw => { overlays.push(draw); return film; };

      const cv = document.getElementById('c'); cv.width = film.W; cv.height = film.H; const out = cv.getContext('2d');
      const mk = () => { const c = document.createElement('canvas'); c.width = film.W; c.height = film.H; return c; };
      const sub = mk(), sctx = sub.getContext('2d'), acc = mk(), actx = acc.getContext('2d');
      // Film grain plates: dithers 8-bit gradients so H.264 does not band, and adds texture.
      const grain = [...Array(6)].map((_, k) => {
        const c = document.createElement('canvas'); c.width = film.W / 2; c.height = film.H / 2; const g = c.getContext('2d'), im = g.createImageData(c.width, c.height), r = rng(99 + k);
        for (let i = 0; i < im.data.length; i += 4) { const v = Math.floor(r() * 256); im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
        g.putImageData(im, 0, 0); return c;
      });
      function drawScene(ctx, t) {
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none'; ctx.setLineDash([]); ctx.letterSpacing = '0px';
        ctx.fillStyle = film.bg; ctx.fillRect(0, 0, film.W, film.H);
        for (const s of scenes) if (t >= s.from && t < s.to) { ctx.save(); s.draw(ctx, t); ctx.restore(); }
        for (const o of overlays) { ctx.save(); o(ctx, t); ctx.restore(); }
        const fb = 1 - E.outCubic(prog(t, 0, film.fadeIn)); if (fb > 0) { ctx.fillStyle = `rgba(0,0,0,${fb})`; ctx.fillRect(0, 0, film.W, film.H); }
      }
      function post(ctx, frame) {
        if (film.grain > 0) { ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = film.grain; ctx.drawImage(grain[frame % grain.length], 0, 0, film.W, film.H); ctx.restore(); }
        if (film.vignette > 0) { const v = ctx.createRadialGradient(film.W / 2, film.H / 2, film.H * .45, film.W / 2, film.H / 2, film.H * 1.05); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(0,0,0,${film.vignette})`); ctx.fillStyle = v; ctx.fillRect(0, 0, film.W, film.H); }
      }
      // Motion blur: average `S` sub-frames spread over `shutter` of a frame (0.5 = 180° shutter).
      film.renderFrame = (i, S = 4, shutter = .5) => {
        for (let k = 0; k < S; k++) {
          const tk = clamp(i / film.FPS + (S > 1 ? ((k + .5) / S - .5) * shutter / film.FPS : 0), 0, film.DUR - 1e-4);
          drawScene(sctx, tk); actx.globalAlpha = 1 / (k + 1); actx.globalCompositeOperation = 'source-over'; actx.drawImage(sub, 0, 0);
        }
        actx.globalAlpha = 1; out.globalAlpha = 1; out.drawImage(acc, 0, 0); post(out, i);
      };
      film.drawAt = t => { drawScene(out, t); post(out, Math.floor(t * film.FPS)); };

      film.start = fontSpecs => {
        film.ready = (async () => { await Promise.all((fontSpecs || []).map(s => document.fonts.load(s, 'Aa1’–·'))); await document.fonts.ready; })();
        window.FILM = { W: film.W, H: film.H, FPS: film.FPS, DUR: film.DUR, renderFrame: film.renderFrame, drawAt: film.drawAt, get CUES() { return Object.assign({ dur: film.DUR, fps: film.FPS }, film.cues); }, ready: film.ready };
        if (/[?&]render/.test(location.search)) { document.body.classList.add('render'); return; }
        // Live preview: space = play/pause, ←/→ = ±1 frame (shift: ±0.5 s), scrubber and timecode if present.
        const pp = document.getElementById('pp'), sc = document.getElementById('scrub'), tc = document.getElementById('tc');
        let playing = true, t0 = performance.now(), tt = 0;
        const frame = () => { film.drawAt(tt); if (sc) sc.value = tt; if (tc) tc.textContent = tt.toFixed(2) + ' s'; };
        const seek = v => { tt = clamp(v, 0, film.DUR - 1e-4); t0 = performance.now() - tt * 1000; frame(); };
        if (sc) { sc.max = film.DUR; sc.oninput = () => seek(+sc.value); }
        if (pp) pp.onclick = () => { playing = !playing; pp.textContent = playing ? 'Pause' : 'Play'; t0 = performance.now() - tt * 1000; };
        addEventListener('keydown', e => {
          if (e.key === ' ') { e.preventDefault(); pp && pp.click(); }
          if (e.key === 'ArrowRight') seek(tt + (e.shiftKey ? .5 : 1 / film.FPS));
          if (e.key === 'ArrowLeft') seek(tt - (e.shiftKey ? .5 : 1 / film.FPS));
        });
        film.ready.then(() => { (function loop(now) { if (playing) { tt = ((now - t0) / 1000) % film.DUR; frame(); } requestAnimationFrame(loop); })(performance.now()); });
      };
      return film;
    },
  };
})();
