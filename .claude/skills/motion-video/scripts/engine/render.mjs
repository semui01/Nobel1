// Render a film frame by frame in headless Chromium and write numbered image files plus cues.json.
// usage: node render.mjs [--film film.html] [--frames frames] [--sub 4] [--workers 4] [--from 0] [--to N] [--fmt png|jpeg]
//   --sub      motion-blur sub-frames per output frame (1 = none; 4 is smooth)
//   --workers  parallel browser pages (about one per CPU core)
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const here = path.dirname(fileURLToPath(import.meta.url));
const film = path.resolve(arg('film', path.join(here, 'film.html')));
const dir = path.resolve(arg('frames', path.join(here, 'frames')));
const sub = +arg('sub', 4), workers = +arg('workers', 4), fmt = arg('fmt', 'png');

export async function loadPlaywright() {
  try { return await import('playwright'); } catch {}
  const root = execSync('npm root -g').toString().trim();
  return await import(pathToFileURL(path.join(root, 'playwright', 'index.mjs')).href);
}
export async function launch() {
  const { chromium } = await loadPlaywright();
  const opts = { args: ['--disable-gpu-vsync', '--disable-frame-rate-limit'] };
  if (process.env.CHROMIUM_PATH) opts.executablePath = process.env.CHROMIUM_PATH;
  return chromium.launch(opts);
}
export async function openFilm(browser, film) {
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => { console.error('PAGEERROR', e.message); process.exit(1); });
  await p.goto(pathToFileURL(film).href + '?render');
  await p.waitForFunction(() => window.FILM, null, { timeout: 15000 }).catch(() => { console.error('window.FILM never appeared: did film.start() run?'); process.exit(1); });
  await p.evaluate(() => window.FILM.ready);
  return p;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  fs.mkdirSync(dir, { recursive: true });
  const browser = await launch();
  const first = await openFilm(browser, film);
  const { FPS, DUR, CUES } = await first.evaluate(() => ({ FPS: window.FILM.FPS, DUR: window.FILM.DUR, CUES: window.FILM.CUES }));
  fs.writeFileSync(path.join(dir, 'cues.json'), JSON.stringify(CUES));
  const total = Math.round(FPS * DUR), from = +arg('from', 0), to = Math.min(total, +arg('to', total));
  const pages = [first];
  for (let i = 1; i < workers; i++) pages.push(await openFilm(browser, film));
  let next = from, done = 0; const t0 = Date.now();
  await Promise.all(pages.map(async p => {
    while (next < to) {
      const i = next++;
      const data = await p.evaluate(([i, sub, fmt]) => { window.FILM.renderFrame(i, sub); return document.getElementById('c').toDataURL(fmt === 'png' ? 'image/png' : 'image/jpeg', .95); }, [i, sub, fmt]);
      fs.writeFileSync(path.join(dir, `f${String(i).padStart(5, '0')}.${fmt === 'png' ? 'png' : 'jpg'}`), Buffer.from(data.slice(data.indexOf(',') + 1), 'base64'));
      if (++done % 60 === 0) console.log(`${done}/${to - from} frames · ${((Date.now() - t0) / done).toFixed(0)} ms/frame`);
    }
  }));
  console.log(`rendered ${done} frames (${FPS} fps, ${DUR} s) in ${((Date.now() - t0) / 1000).toFixed(1)} s → ${dir}`);
  await browser.close();
}
