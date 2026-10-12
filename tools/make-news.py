"""
python tools/make-news.py

Builds the Latest page's data (prototype/news.json) and a small share page for each entry (prototype/n/<id>/).
Entries come from two places:
  - the GitHub releases on SNAXUS1/stezy-site (every app update and new app, with its release notes), read with gh
  - tools/news-extra.json: changes to the site itself, things without a release (Echo), and "patch" entries that
    change a generated entry (by its id)
Rerun after every release, and after adding something to news-extra.json, then commit and push.
"""
import html, json, os, re, subprocess, sys
from datetime import datetime, timedelta

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SITE = 'https://stezy.lt'
GH = r'C:\Program Files\GitHub CLI\gh.exe'
TAG_SLUG = {'minecraft-merge': 'schedule-steve'}


def when(s):
    return datetime.fromisoformat(s.replace('Z', '+00:00'))


def projects():
    s = open(os.path.join(ROOT, 'prototype', 'index.html'), encoding='utf-8').read()
    out = {}
    for m in re.finditer(r"slug: '([^']+)'(.*?)\n    \}", s, re.S):
        body = m.group(2)
        name = re.search(r"name: '([^']*)'", body)
        cat = re.search(r"cat: '([^']*)'", body)
        blurb = re.search(r"blurb: (['\"])(.*?)\1,", body)
        out[m.group(1)] = {'name': name.group(1) if name else m.group(1), 'cat': cat.group(1) if cat else 'apps',
                           'blurb': blurb.group(2).replace("\\'", "'") if blurb else ''}
    return out


def inline(t):
    t = html.escape(t, quote=False)
    t = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', t)
    t = re.sub(r'`([^`]+)`', r'<code>\1</code>', t)
    return t


BOILER = re.compile(r'(SHA-256 of the zip|^More at |Windows 10/11: unzip|^Unzip and|unzip and run)', re.I)


def notes_html(body):
    """The release notes as simple HTML: paragraphs, bullet lists, bold, code. Install boilerplate is left out."""
    out, items, para = [], [], []
    def flush():
        nonlocal items, para
        if para:
            out.append('<p>' + inline(' '.join(para)) + '</p>')
            para = []
        if items:
            out.append('<ul>' + ''.join(f'<li>{inline(i)}</li>' for i in items) + '</ul>')
            items = []
    for line in (body or '').replace('\r\n', '\n').split('\n'):
        l = line.strip()
        if not l:
            flush(); continue
        if re.match(r'^\*\*[^*]+ \d+\.\d+(\.\d+)?\*\*\s*$', l):  # the "**TEMPO 1.3.2**" heading line
            continue
        if BOILER.search(l):
            # keep what comes before a trailing checksum, drop the rest
            keep = re.split(r'\s*(SHA-256 of the zip|Windows 10/11: unzip)', l)[0].strip()
            if keep and not BOILER.search(keep):
                para.append(keep)
            continue
        if l.startswith('- '):
            if para: flush()
            items.append(l[2:])
        else:
            if items: flush()
            para.append(l)
    flush()
    return ''.join(out)


def short(line, most=150):
    """One bullet for the timeline: its first sentence, and no longer than about two lines."""
    first = re.split(r'(?<=[.!?])\s+(?=[A-Z"])', line, maxsplit=1)[0]
    if len(first.replace('**', '')) <= most:
        return first
    cut = first[:most + 4]
    cut = cut[:cut.rfind(' ')] if ' ' in cut else cut
    if cut.count('**') % 2:
        cut += '**'
    return cut.rstrip(',;:') + '…'


def summary_of(body, n=3):
    """A few short lines for the timeline: the first bullets, or the first sentences."""
    lines = [l.strip()[2:] for l in (body or '').split('\n') if l.strip().startswith('- ')]
    if lines:
        return [inline(short(l)) for l in lines[:n]]
    text = ' '.join(l.strip() for l in (body or '').split('\n') if l.strip() and not re.match(r'^\*\*[^*]+\*\*', l.strip()))
    sentences = [s for s in re.split(r'(?<=[.!?])\s+', text) if s and not BOILER.search(s)]
    return [inline(' '.join(sentences[:2]))] if sentences else []


def releases():
    out, page = [], 1
    while True:
        r = subprocess.run([GH, 'api', f'repos/SNAXUS1/stezy-site/releases?per_page=100&page={page}'], check=True, capture_output=True, text=True, encoding='utf-8')
        batch = json.loads(r.stdout)
        out += [x for x in batch if not x.get('draft')]
        if len(batch) < 100:
            return out
        page += 1


def build():
    ps = projects()
    rel = []
    for r in releases():
        m = re.match(r'^(.+?)-v(\d[\w.]*)$', r['tag_name'])
        if not m:
            continue
        slug = TAG_SLUG.get(m.group(1), m.group(1))
        if slug not in ps:
            print('  (no project for', r['tag_name'], ')')
            continue
        rel.append({'slug': slug, 'version': m.group(2), 'tag': r['tag_name'], 'date': r['published_at'], 'body': r.get('body') or ''})
    rel.sort(key=lambda r: r['date'])

    # first release of each app = it's new; later ones = updates (a quick run of updates becomes one entry)
    seen, news, updates = set(), [], []
    for r in rel:
        r['kind'] = 'update' if r['slug'] in seen else 'new'
        seen.add(r['slug'])
    for r in rel:
        if r['kind'] != 'update':
            continue
        prev = next((u for u in reversed(updates) if u['slug'] == r['slug']), None)
        if prev and when(r['date']) - when(prev['date']) <= timedelta(hours=3):
            prev['also'].append(prev['version'])
            prev.update(version=r['version'], tag=r['tag'], date=r['date'], body=r['body'])
        else:
            updates.append(dict(r, also=[]))
    for u in updates:
        news.append({'id': u['tag'], 'kind': 'update', 'slug': u['slug'], 'version': u['version'], 'also': u['also'], 'date': u['date'],
                     'summary': summary_of(u['body']), 'notes': notes_html(u['body'])})

    # new apps released close together make one "drop"
    fresh = [r for r in rel if r['kind'] == 'new']
    groups = []
    for r in fresh:
        if groups and when(r['date']) - when(groups[-1][-1]['date']) <= timedelta(minutes=90):
            groups[-1].append(r)
        else:
            groups.append([r])
    for g in groups:
        if len(g) >= 3:
            d = when(g[0]['date'])
            allapps = all(ps[r['slug']]['cat'] == 'apps' for r in g)
            news.append({'id': f'drop-{d:%Y-%m-%d-%H%M}', 'kind': 'drop', 'slugs': [r['slug'] for r in g], 'date': g[-1]['date'],
                         'title': f'{len(g)} new {"apps" if allapps else "projects"}', 'summary': []})
        else:
            for r in g:
                news.append({'id': r['tag'], 'kind': 'new', 'slug': r['slug'], 'version': r['version'], 'date': r['date'],
                             'summary': [], 'notes': notes_html(r['body'])})

    # the site's own news, and changes to generated entries
    extra = json.load(open(os.path.join(ROOT, 'tools', 'news-extra.json'), encoding='utf-8'))
    for e in extra:
        if 'patch' in e:
            target = next((n for n in news if n['id'] == e['patch']), None)
            if target:
                target.update({k: v for k, v in e.items() if k != 'patch'})
            else:
                print('  (patch for a missing entry:', e['patch'], ')')
            continue
        news.append(dict(e, summary=[inline(s) for s in e.get('summary', [])]))
    news.sort(key=lambda n: n['date'], reverse=True)
    return news, ps


def share_pages(news, ps):
    base = os.path.join(ROOT, 'prototype', 'n')
    for n in news:
        slug = n.get('slug')
        name = ps[slug]['name'] if slug else ''
        title = n.get('title') or (f"{name} {n['version']}" if n['kind'] == 'update' else f'New: {name}')
        desc = re.sub(r'<[^>]+>', '', (n['summary'] or [ps[slug]['blurb'] if slug else ''])[0]) if (n['summary'] or slug) else 'What\'s new on stezy.lt'
        img = f'{SITE}/img/share/{slug}.jpg' if slug and os.path.exists(os.path.join(ROOT, 'prototype', 'img', 'share', f'{slug}.jpg')) else f'{SITE}/og.jpg'
        target = f'/#latest/{n["id"]}'
        t, d = html.escape(title), html.escape(desc)
        os.makedirs(os.path.join(base, n['id']), exist_ok=True)
        open(os.path.join(base, n['id'], 'index.html'), 'w', encoding='utf-8', newline='\n').write(f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{t} · STEZY</title>
<meta name="description" content="{d}">
<link rel="canonical" href="{SITE}{target}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="STEZY">
<meta property="og:title" content="{t}">
<meta property="og:description" content="{d}">
<meta property="og:url" content="{SITE}/n/{n['id']}/">
<meta property="og:image" content="{img}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="article:published_time" content="{n['date']}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<meta http-equiv="refresh" content="0; url={target}">
<script>location.replace('{target}');</script>
<style>body{{margin:0;min-height:100vh;display:grid;place-items:center;background:#050509;color:#a9a6c4;font:16px system-ui,sans-serif}}a{{color:#f2f0ff}}</style>
</head>
<body><p>Opening <a href="{target}">{t}</a> on stezy.lt...</p></body>
</html>
''')


if __name__ == '__main__':
    news, ps = build()
    out = os.path.join(ROOT, 'prototype', 'news.json')
    json.dump(news, open(out, 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, separators=(',', ':'))
    share_pages(news, ps)
    print(f'{len(news)} entries -> news.json ({os.path.getsize(out) // 1024} KB) and n/<id>/ share pages')
    for n in news:
        print(f"  {n['date'][:16]} {n['kind']:6} {n['id']:24} {n.get('version', '')} {('+' + ','.join(n['also'])) if n.get('also') else ''}")
