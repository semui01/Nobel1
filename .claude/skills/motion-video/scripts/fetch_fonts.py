"""Download Google Fonts locally so renders are deterministic and work offline.

usage:
  python3 fetch_fonts.py OUT_DIR "Spectral:ital,wght@0,300;1,300" "IBM Plex Sans:wght@400;500;600" ... [--text "chars to check"]
  python3 fetch_fonts.py OUT_DIR "https://fonts.googleapis.com/css2?family=...&display=swap"

Writes OUT_DIR/fonts.css (the starter films link it as fonts/fonts.css) plus the woff2 files, then
reports, per family, which characters it lacks (arrows, superscripts, Greek and anything passed with
--text): those would silently render in a fallback face. Draw them (T.arrow, T.sup) or avoid them.
"""
import os
import re
import subprocess
import sys
import urllib.parse

UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
args = sys.argv[1:]
extra = ''
if '--text' in args:
    i = args.index('--text')
    extra = args[i + 1]
    del args[i:i + 2]
if len(args) < 2:
    sys.exit(__doc__)
out, specs = args[0], args[1:]
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
print(f'{len(files)} font files + fonts.css → {out}')

cover = {}
for block in re.findall(r'@font-face\s*{([^}]*)}', css):
    fam = re.search(r"font-family:\s*'?\"?([^;'\"]+)", block)
    rng = re.search(r'unicode-range:\s*([^;]+);', block)
    if not fam:
        continue
    spans = cover.setdefault(fam.group(1).strip(), [])
    if rng:
        for part in rng.group(1).split(','):
            a, _, b = part.strip()[2:].partition('-')
            spans.append((int(a, 16), int(b or a, 16)))
    else:
        spans.append((0, 0x10FFFF))
probe = {'→': 'arrow', '⁺': 'superscript +', '²': 'superscript 2', 'μ': 'Greek mu', '×': 'multiply', '−': 'minus', '’': 'apostrophe', '–': 'en dash'}
probe.update({ch: repr(ch) for ch in extra if not ch.isspace() and ch not in probe})
for fam, spans in cover.items():
    missing = [f'{ch} ({name})' for ch, name in probe.items() if not any(a <= ord(ch) <= b for a, b in spans)]
    print(f'{fam}: ' + ('covers every probed character' if not missing else 'lacks ' + ', '.join(missing)))
