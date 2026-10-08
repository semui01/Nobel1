// Render chosen moments as JPEG stills and an optional contact sheet, for the review loop.
// usage: node tools/stills.mjs [--film film.html] [--out stills] --times 0.5,1.2,2.6 | --every 0.5
//                              [--sheet sheet.jpg] [--sub 1] [--crop x,y,w,h]
//   --crop  save only this region of each frame, scaled up to 1280 px wide: use it to check small
//           labels, thin lines and motion-blur copies that a contact-sheet thumbnail hides.
// Contact-sheet cells follow the film's aspect ratio. Exits non-zero if the film throws.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { launch, openFilm, withTimeout } from '../render.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const here = path.dirname(fileURLToPath(import.meta.url));
const film = path.resolve(arg('film', path.join(here, '..', 'film.html')));
const out = path.resolve(arg('out', 'stills')), sheet = arg('sheet', null), sub = +arg('sub', 1);
const crop = arg('crop', null)?.split(',').map(Number) || null;
fs.mkdirSync(out, { recursive: true });

const browser = await launch();
const errors = [];
const page = await openFilm(browser, film, errors);
const { DUR, FPS, W, H } = await page.evaluate(() => ({ DUR: window.FILM.DUR, FPS: window.FILM.FPS, W: window.FILM.W, H: window.FILM.H }));
let times = arg('times', null)?.split(',').map(Number);
if (!times) { const every = +arg('every', 1); times = []; for (let t = every / 2; t < DUR; t += every) times.push(+t.toFixed(3)); }

const [cx, cy, cwid, chei] = crop || [0, 0, W, H];
const cols = cwid >= chei ? 4 : 6, cw = cwid >= chei ? 480 : 300, ch = Math.round(cw * chei / cwid);
const outW = crop ? 1280 : W, outH = crop ? Math.round(1280 * chei / cwid) : H;
await page.evaluate(([n, cols, cw, ch, outW, outH]) => {
  const s = document.createElement('canvas'); s.width = cols * cw; s.height = Math.ceil(n / cols) * ch; s.id = 'sheet'; document.body.appendChild(s);
  const g = s.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, s.width, s.height);
  const o = document.createElement('canvas'); o.width = outW; o.height = outH; o.id = 'one'; document.body.appendChild(o);
}, [times.length, cols, cw, ch, outW, outH]);
for (const [k, t] of times.entries()) {
  const url = await withTimeout(page.evaluate(([t, k, FPS, sub, cols, cw, ch, c]) => {
    window.FILM.renderFrame(Math.round(t * FPS), sub);
    const src = document.getElementById('c'), one = document.getElementById('one'), o = one.getContext('2d');
    o.drawImage(src, c[0], c[1], c[2], c[3], 0, 0, one.width, one.height);
    const g = document.getElementById('sheet').getContext('2d'), x = (k % cols) * cw, y = Math.floor(k / cols) * ch;
    g.drawImage(one, x, y, cw, ch); g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(x, y, 74, 24); g.fillStyle = '#fff'; g.font = '15px monospace'; g.fillText(t.toFixed(2) + ' s', x + 6, y + 17);
    return one.toDataURL('image/jpeg', .9);
  }, [t, k, FPS, sub, cols, cw, ch, [cx, cy, cwid, chei]]), 60000, `still at ${t} s`).catch(e => { console.error(e.message); process.exit(1); });
  fs.writeFileSync(path.join(out, `t${t.toFixed(2)}${crop ? '-crop' : ''}.jpg`), Buffer.from(url.split(',')[1], 'base64'));
}
if (sheet) {
  const url = await page.evaluate(() => document.getElementById('sheet').toDataURL('image/jpeg', .9));
  fs.writeFileSync(path.resolve(sheet), Buffer.from(url.split(',')[1], 'base64'));
  console.log('sheet →', path.resolve(sheet));
}
console.log(`${times.length} stills → ${out}`);
if (errors.length) console.log('console errors:\n' + [...new Set(errors)].slice(0, 10).join('\n'));
await browser.close();
