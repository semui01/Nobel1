"""Download Google Fonts locally so renders are deterministic and work offline.

usage:
  python3 fetch_fonts.py OUT_DIR "Spectral:ital,wght@0,300;1,300" "IBM Plex Sans:wght@400;500;600" ...
  python3 fetch_fonts.py OUT_DIR "https://fonts.googleapis.com/css2?family=...&display=swap"

Writes OUT_DIR/fonts.css (link it from film.html as fonts/fonts.css) plus the woff2 files.
Also warns about characters the downloaded subsets do not cover (arrows, superscripts),
which would otherwise silently render in a fallback font.
"""
import os
import re
import subprocess
import sys
import urllib.parse

UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
out = sys.argv[1]
specs = sys.argv[2:]
if not specs:
    sys.exit(__doc__)
if specs[0].startswith('http'):
    url = specs[0]
else:
    url = 'https://fonts.googleapis.com/css2?' + '&'.join('family=' + urllib.parse.quote(s, safe=':,;@') for s in specs) + '&display=swap'
os.makedirs(out, exist_ok=True)
css = subprocess.run(['curl', '-sSfL', '-A', UA, url], check=True, capture_output=True, text=True).stdout
files = sorted(set(re.findall(r'url\((https://fonts\.gstatic\.com/[^)]+)\)', css)))
for u in files:
    fn = u.split('/s/', 1)[1].replace('/', '_')
    if not os.path.exists(os.path.join(out, fn)):
        subprocess.run(['curl', '-sSfL', '-o', os.path.join(out, fn), u], check=True)
    css = css.replace(u, fn)
open(os.path.join(out, 'fonts.css'), 'w').write(css)

ranges = re.findall(r'unicode-range:\s*([^;]+);', css)
covered = []
for r in ranges:
    for part in r.split(','):
        a, _, b = part.strip()[2:].partition('-')
        covered.append((int(a, 16), int(b or a, 16)))
probe = {'→': 'arrows', '⁺': 'superscript +', '²': 'superscript 2', 'μ': 'Greek mu', '×': 'multiply', '−': 'minus', '’': 'apostrophe', '–': 'en dash'}
missing = [f'{ch} ({name})' for ch, name in probe.items() if not any(a <= ord(ch) <= b for a, b in covered)]
print(f'{len(files)} font files + fonts.css → {out}')
if missing:
    print('not covered by these fonts (draw them or avoid them):', ', '.join(missing))
