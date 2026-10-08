// Render chosen moments as JPEG stills and an optional contact sheet, for the review loop.
// usage: node tools/stills.mjs [--film film.html] [--out stills] --times 0.5,1.2,2.6 | --every 0.5  [--sheet sheet.jpg] [--sub 1]
// Prints page errors and console errors; exits non-zero if the film throws.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { launch, openFilm } from '../render.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const here = path.dirname(fileURLToPath(import.meta.url));
const film = path.resolve(arg('film', path.join(here, '..', 'film.html')));
const out = path.resolve(arg('out', 'stills')), sheet = arg('sheet', null), sub = +arg('sub', 1);
fs.mkdirSync(out, { recursive: true });

const browser = await launch();
const errors = [];
const page = await openFilm(browser, film);
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const { DUR, FPS } = await page.evaluate(() => ({ DUR: window.FILM.DUR, FPS: window.FILM.FPS }));
let times = arg('times', null)?.split(',').map(Number);
if (!times) { const every = +arg('every', 1); times = []; for (let t = every / 2; t < DUR; t += every) times.push(+t.toFixed(3)); }

const cols = 4, cw = 480, ch = Math.round(480 * 9 / 16);
await page.evaluate(([n, cols, cw, ch]) => {
  const s = document.createElement('canvas'); s.width = cols * cw; s.height = Math.ceil(n / cols) * ch; s.id = 'sheet'; document.body.appendChild(s);
  const g = s.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, s.width, s.height);
}, [times.length, cols, cw, ch]);
for (const [k, t] of times.entries()) {
  const url = await page.evaluate(([t, k, FPS, sub, cols, cw, ch]) => {
    window.FILM.renderFrame(Math.round(t * FPS), sub);
    const c = document.getElementById('c'), g = document.getElementById('sheet').getContext('2d'), x = (k % cols) * cw, y = Math.floor(k / cols) * ch;
    g.drawImage(c, x, y, cw, ch); g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(x, y, 74, 24); g.fillStyle = '#fff'; g.font = '15px monospace'; g.fillText(t.toFixed(2) + ' s', x + 6, y + 17);
    return c.toDataURL('image/jpeg', .9);
  }, [t, k, FPS, sub, cols, cw, ch]);
  fs.writeFileSync(path.join(out, `t${t.toFixed(2)}.jpg`), Buffer.from(url.split(',')[1], 'base64'));
}
if (sheet) {
  const url = await page.evaluate(() => document.getElementById('sheet').toDataURL('image/jpeg', .9));
  fs.writeFileSync(path.resolve(sheet), Buffer.from(url.split(',')[1], 'base64'));
  console.log('sheet →', path.resolve(sheet));
}
console.log(`${times.length} stills → ${out}`);
if (errors.length) console.log('console errors:\n' + [...new Set(errors)].slice(0, 10).join('\n'));
await browser.close();
