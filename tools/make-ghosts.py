"""
python tools/make-ghosts.py [slug ...]

Makes the faint "app behind the art" layer for each app page: img/<slug>/ghost.webp.
The app's own screenshot becomes light itself (on dark pages: its bright parts glow in the page's colour and its dark
parts turn see-through; on light pages: its lines turn into ink), and it fades out towards the side where the name is,
so it never sits under the name. Rerun after a screenshot changes, or for a new app (add it to SHOTS below).
"""
import os, re, sys
from PIL import Image
import numpy as np

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'prototype')

# which screenshot shows each app best
SHOTS = {
    'echo': 'cave', 'ghost-line': 'race', 'shadow': 'race', 'reaper': 'main', 'ledger': 'main',
    'static': 'main', 'hush': 'live', 'nocturne': 'main', 'specter': 'main', 'lull': 'main', 'prism': 'main',
    'tether': 'main', 'wisp': 'main', 'afterimage': 'main', 'halo': 'main', 'veil': 'main', 'undertow': 'main',
    'poltergeist': 'main', 'phantom': 'orbital', 'linkfuse': 'main',
}
# the side the app sits on, when it isn't simply "away from the name"
SIDE = {}
# the ink on light pages, when the page's accent isn't dark
INK = {'shadow': '#160A12'}


def hexrgb(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float32)


def projects():
    s = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
    out = {}
    for m in re.finditer(r"slug: '([^']+)'(.*?)\n    \}", s, re.S):
        body = m.group(2)
        g = lambda k: (re.search(k + r": '([^']*)'", body) or [None, ''])[1]
        out[m.group(1)] = {'layout': g('layout'), 'accent': g('accent'), 'page': g('page')}
    return out


def side_of(slug, layout):
    return SIDE.get(slug) or ('left' if layout == 'at-right' else 'right')


def make(slug, p):
    src = os.path.join(ROOT, 'img', slug, SHOTS[slug] + '.webp')
    im = Image.open(src).convert('RGB')
    w = 1100
    im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    a = np.asarray(im, dtype=np.float32) / 255
    lum = 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
    page = hexrgb(p['page'] or '#08090B') / 255
    light_page = 0.2126 * page[0] + 0.7152 * page[1] + 0.0722 * page[2] > 0.5
    light_shot = lum.mean() > 0.5
    # what becomes visible: the app's light (dark screenshot) or its ink (light screenshot)
    src_a = lum if not light_shot else 1 - lum
    # a light app's paper (and a dark app's panels) stay see-through; only its lines and light show
    floor = 0.2 if light_shot else 0.05
    alpha = np.clip((src_a - floor) / (1 - floor), 0, 1) ** (0.6 if light_page and not light_shot else 0.68)
    if light_page:
        ink = hexrgb(INK.get(slug) or p['accent'] or '#16131C')
        rgb = np.broadcast_to(ink, a.shape[:2] + (3,)).copy()
    else:
        acc = hexrgb(p['accent'] or '#D6E0FF')
        mix = (lum * 0.55)[..., None]
        rgb = acc * (1 - mix) + 255 * mix
    # fade out towards the name, and softly at the top, the bottom and the far edge
    h = a.shape[0]
    x = np.linspace(0, 1, w)
    inner = np.clip(x / 0.55, 0, 1) ** 2 if side_of(slug, p['layout']) == 'right' else np.clip((1 - x) / 0.55, 0, 1) ** 2
    # the far edge fades too, so the page's rail of names stays readable over it
    outer = (np.clip((1 - x) / 0.24, 0, 1) if side_of(slug, p['layout']) == 'right' else np.clip(x / 0.24, 0, 1)) ** 1.4
    y = np.linspace(0, 1, h)
    vert = np.clip(y / 0.18, 0, 1) * np.clip((1 - y) / 0.24, 0, 1)
    alpha = alpha * (inner * outer)[None, :] * vert[:, None]
    out = np.dstack([np.clip(rgb, 0, 255), alpha * 255]).astype(np.uint8)
    dst = os.path.join(ROOT, 'img', slug, 'ghost.webp')
    Image.fromarray(out, 'RGBA').save(dst, 'WEBP', quality=70, alpha_quality=55, method=6)
    print(f'{slug:12} {side_of(slug, p["layout"]):5} {"light" if light_page else "dark"} page, {"light" if light_shot else "dark"} shot -> {os.path.getsize(dst) // 1024} KB')


if __name__ == '__main__':
    ps = projects()
    for slug in sys.argv[1:] or SHOTS:
        make(slug, ps[slug])
