// Renders motion.html frame by frame in headless Chromium and writes PNG frames.
// usage: node render.mjs --frames <dir> [--sub 3] [--workers 4] [--from 0] [--to 900] [--fmt png|jpeg]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const dir = arg('frames', 'frames'), sub = +arg('sub', 3), workers = +arg('workers', 4), fmt = arg('fmt', 'png');
const here = path.dirname(fileURLToPath(import.meta.url));
const url = 'file://' + path.join(here, 'motion.html') + '?render';
fs.mkdirSync(dir, { recursive: true });

const browser = await chromium.launch({ args: ['--disable-gpu-vsync', '--disable-frame-rate-limit'] });
async function open() {
  const p = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  p.on('pageerror', e => { console.error('PAGEERROR', e.message); process.exit(1); });
  await p.goto(url);
  await p.evaluate(() => window.FILM.ready);
  return p;
}
const first = await open();
const { FPS, DUR, CUES } = await first.evaluate(() => ({ FPS: window.FILM.FPS, DUR: window.FILM.DUR, CUES: window.FILM.CUES }));
fs.writeFileSync(path.join(dir, 'cues.json'), JSON.stringify(CUES));
const total = Math.round(FPS * DUR), from = +arg('from', 0), to = Math.min(total, +arg('to', total));
const pages = [first]; for (let i = 1; i < workers; i++) pages.push(await open());

let next = from, done = 0; const t0 = Date.now();
await Promise.all(pages.map(async p => {
  while (next < to) {
    const i = next++;
    const data = await p.evaluate(([i, sub, fmt]) => { window.FILM.renderFrame(i, sub); return document.getElementById('c').toDataURL(fmt === 'png' ? 'image/png' : 'image/jpeg', .95); }, [i, sub, fmt]);
    fs.writeFileSync(path.join(dir, `f${String(i).padStart(4, '0')}.${fmt === 'png' ? 'png' : 'jpg'}`), Buffer.from(data.slice(data.indexOf(',') + 1), 'base64'));
    if (++done % 60 === 0) console.log(`${done}/${to - from} frames · ${((Date.now() - t0) / done).toFixed(0)} ms/frame`);
  }
}));
console.log(`done: ${done} frames in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
await browser.close();
