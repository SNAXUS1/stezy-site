"""Builds the small share pages (prototype/p/<slug>/index.html), sitemap.xml and robots.txt.

Discord, Messenger and the like don't run JavaScript and ignore #hashes, so every project gets
its own tiny page carrying its title, description and card image, which then forwards visitors
straight to the project on the main page. Run this after adding or renaming a project:

    python tools/make-share-pages.py

Card images live in prototype/img/share/<slug>.jpg (1200x630).
"""
import html, json, os, re

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'prototype')
SITE = 'https://stezy.lt'
src = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()


def field(block, name):
    m = re.search(name + r""":\s*(['"])(.*?)(?<!\\)\1""", block, re.S)
    return m.group(2).replace("\\'", "'") if m else None


projects = []
for m in re.finditer(r"\{\s*slug: '([a-z0-9-]+)'", src):
    block = src[m.start():m.start() + 2500]
    block = block[:block.find('\n    }') + 1] or block
    projects.append({
        'slug': m.group(1), 'name': field(block, 'name'), 'cat': field(block, 'cat'),
        'kind': field(block, 'kind'), 'blurb': field(block, 'blurb'), 'page': field(block, 'page') or '#050509',
        'game': field(block, 'game'),
    })

for p in projects:
    e = {k: html.escape(v or '', quote=True) for k, v in p.items()}
    url, target = f"{SITE}/p/{p['slug']}/", f"/#{p['slug']}"
    image = f"{SITE}/img/share/{p['slug']}.jpg"
    kind = 'VideoGame' if p['cat'] == 'games' else 'SoftwareApplication'
    ld = {
        '@context': 'https://schema.org', '@type': kind, 'name': p['name'], 'description': p['blurb'],
        'operatingSystem': 'Windows', 'image': image, 'url': f"{SITE}/#{p['slug']}",
        'applicationCategory': 'GameApplication' if p['cat'] != 'apps' else 'UtilitiesApplication',
        'author': {'@type': 'Person', 'name': 'STEZY', 'url': SITE + '/'},
        'offers': {'@type': 'Offer', 'price': '0', 'priceCurrency': 'EUR'},
    }
    page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e['name']} by STEZY</title>
<meta name="description" content="{e['blurb']}">
<link rel="canonical" href="{SITE}/#{e['slug']}">
<meta name="theme-color" content="{e['page']}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="STEZY">
<meta property="og:title" content="{e['name']}">
<meta property="og:description" content="{e['blurb']}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="{e['name']}, a {e['kind'].lower()} by STEZY">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<script type="application/ld+json">{json.dumps(ld)}</script>
<meta http-equiv="refresh" content="0; url={target}">
<script>location.replace('{target}');</script>
<style>body{{margin:0;min-height:100vh;display:grid;place-items:center;background:#050509;color:#a9a6c4;font:16px system-ui,sans-serif}}a{{color:#f2f0ff}}</style>
</head>
<body><p>Opening <a href="{target}">{e['name']}</a> on stezy.lt...</p></body>
</html>
"""
    out = os.path.join(ROOT, 'p', p['slug'])
    os.makedirs(out, exist_ok=True)
    open(os.path.join(out, 'index.html'), 'w', encoding='utf-8', newline='\n').write(page)

urls = [SITE + '/'] + [f"{SITE}/p/{p['slug']}/" for p in projects]
open(os.path.join(ROOT, 'sitemap.xml'), 'w', encoding='utf-8', newline='\n').write(
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + ''.join(f'  <url><loc>{u}</loc></url>\n' for u in urls) + '</urlset>\n')
open(os.path.join(ROOT, 'robots.txt'), 'w', encoding='utf-8', newline='\n').write(
    f'User-agent: *\nAllow: /\nSitemap: {SITE}/sitemap.xml\n')
print('share pages:', ', '.join(p['slug'] + ' (' + (p['name'] or '?') + ')' for p in projects))
