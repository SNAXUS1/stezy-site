'use strict';
(() => {
  const host = window.chrome && window.chrome.webview;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const ICON = {
    chev: '<svg class="chev" viewBox="0 0 10 10"><path d="M2.5 4 5 6.5 7.5 4"/></svg>',
    end: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="5.6"/><path d="M5.9 5.9l4.2 4.2M10.1 5.9l-4.2 4.2"/></svg>',
    restart: '<svg viewBox="0 0 16 16"><path d="M12.6 6.2A5 5 0 1 0 13 9"/><path d="M13 3.4v3h-3"/></svg>',
    freeze: '<svg viewBox="0 0 16 16"><path d="M8 2v12M3 5l10 6M13 5 3 11"/><path d="M6.6 2.8 8 4.2l1.4-1.4M6.6 13.2 8 11.8l1.4 1.4"/></svg>',
    thaw: '<svg viewBox="0 0 16 16"><path d="M5.2 3.6v8.8L12.4 8 5.2 3.6Z"/></svg>',
    folder: '<svg viewBox="0 0 16 16"><path d="M2.5 4.6c0-.7.5-1.2 1.2-1.2h2.6l1.4 1.5h4.6c.7 0 1.2.5 1.2 1.2v5.4c0 .7-.5 1.2-1.2 1.2H3.7c-.7 0-1.2-.5-1.2-1.2V4.6Z"/></svg>',
    copy: '<svg viewBox="0 0 16 16"><rect x="5.5" y="5.5" width="7.5" height="7.5" rx="1.6"/><path d="M10.5 5.5V4.2c0-.7-.5-1.2-1.2-1.2H4.2C3.5 3 3 3.5 3 4.2v5.1c0 .7.5 1.2 1.2 1.2h1.3"/></svg>',
    props: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="5.6"/><path d="M8 7.4v3.4M8 5.3v.1"/></svg>',
    search: '<svg viewBox="0 0 16 16"><circle cx="7" cy="7" r="4.4"/><path d="M10.3 10.3 13.4 13.4"/></svg>',
    window: '<svg viewBox="0 0 16 16"><rect x="2.5" y="3.5" width="11" height="9" rx="1.6"/><path d="M2.5 6h11"/></svg>',
    speed: '<svg viewBox="0 0 16 16"><path d="M2.8 11.5a5.4 5.4 0 1 1 10.4 0"/><path d="M8 10.6 10.4 7"/></svg>',
    tree: '<svg viewBox="0 0 16 16"><path d="M4 3v8.5c0 .8.7 1.5 1.5 1.5H8M4 7h4"/><circle cx="10" cy="7" r="1.5"/><circle cx="10" cy="13" r="1.5"/></svg>',
    winlogo: '<svg viewBox="0 0 12 12"><path d="M1 1h4.6v4.6H1zM6.4 1H11v4.6H6.4zM1 6.4h4.6V11H1zM6.4 6.4H11V11H6.4z"/></svg>',
    arrow: '<svg viewBox="0 0 16 16"><path d="M6 3.5 10.5 8 6 12.5"/></svg>',
  };

  const SECTIONS = [
    { id: 'hung', label: 'Not responding' },
    { id: 'apps', label: 'Apps' },
    { id: 'bg', label: 'Background' },
    { id: 'win', label: 'Windows' },
  ];

  const S = {
    groups: new Map(),
    sys: null,
    sel: null,
    selPid: null,
    expanded: new Set(),
    collapsed: { win: true, bg: false, apps: false, hung: false },
    sort: { key: 'c', dir: -1 },
    filter: '',
    icons: {},
    spark: { cpu: [], gpu: [], mem: [], disk: [] },
    hist: null,
    histMetric: 'cpu',
    rec: { step: 1000, end: 0, cpu: [], disk: [], gpu: [], mem: [], top: [] },
    events: [],
    settings: {},
    elevated: false,
    version: '',
    hotkey: 'Ctrl+Alt+F',
    nodes: new Map(),
    rank: new Map(),
    ema: new Map(),
    visible: [],
    pointerInList: false,
    confirmUntil: 0,
    firstTick: true,
    lastStatusKey: '',
    statusTone: '',
  };

  // ------------------------------------------------------------------ format

  const fmtPct = v => v == null ? '—' : v < 0.05 ? '0%' : v < 10 ? v.toFixed(1) + '%' : Math.round(v) + '%';
  const fmtBytes = b => {
    if (b >= 1073741824) return (b / 1073741824).toFixed(b >= 107374182400 ? 0 : 1) + ' GB';
    if (b >= 104857600) return Math.round(b / 1048576) + ' MB';
    if (b >= 1048576) return (b / 1048576).toFixed(1) + ' MB';
    if (b > 0) return Math.max(0.1, b / 1048576).toFixed(1) + ' MB';
    return '0 MB';
  };
  const fmtRate = bps => {
    const mb = bps / 1048576;
    if (mb < 0.05) return '0 MB/s';
    return (mb >= 10 ? Math.round(mb) : mb.toFixed(1)) + ' MB/s';
  };
  const fmtGB = b => (b / 1073741824).toFixed(1);
  const fmtTime = ts => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const fmtTimeS = ts => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const fmtAgo = ts => {
    const s = Math.max(0, (Date.now() - ts) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.round(s / 60) + ' min ago';
    if (s < 86400) { const hh = Math.floor(s / 3600), mm = Math.round((s % 3600) / 60); return hh + ' h' + (mm ? ' ' + mm + ' min' : '') + ' ago'; }
    const d = Math.floor(s / 86400); return d + (d === 1 ? ' day ago' : ' days ago');
  };
  const fmtUptime = ms => {
    const s = ms / 1000, d = Math.floor(s / 86400), hh = Math.floor((s % 86400) / 3600), mm = Math.floor((s % 3600) / 60);
    return d ? `${d} d ${hh} h` : hh ? `${hh} h ${mm} min` : `${mm} min`;
  };

  // ------------------------------------------------------------------ host bridge

  let mock = null;
  let errorsSent = 0;
  const reportError = (msg) => { if (host && errorsSent++ < 20) host.postMessage({ t: 'jserror', msg: String(msg).slice(0, 2000) }); };
  window.addEventListener('error', e => reportError(`${e.message} @ ${e.lineno}:${e.colno}\n${e.error && e.error.stack || ''}`));
  window.addEventListener('unhandledrejection', e => reportError(e.reason && e.reason.stack || e.reason));

  function send(msg) {
    if (host) host.postMessage(msg);
    else if (mock) mock.receive(msg);
  }

  function onMessage(m) {
    if (!m || !m.t) return;
    switch (m.t) {
      case 'init': onInit(m); break;
      case 'tick': onTick(m); break;
      case 'toast': toast(m.text, m.tone, m.action); break;
      case 'winstate': $('#app').classList.toggle('max', !!m.max); break;
      case 'setting':
        S.settings[m.key] = m.v;
        if (m.key === 'overlay') $('#btn-overlay').classList.toggle('on', !!m.v);
        if (openPop && openPop.kind === 'settings') renderSettings(openPop.el);
        break;
    }
  }

  function onInit(m) {
    S.elevated = !!m.elevated;
    S.version = m.version || '';
    S.hotkey = m.hotkey || S.hotkey;
    S.settings = m.settings || {};
    S.sort = { key: S.settings.sort || 'c', dir: S.settings.sortDir || (S.settings.sort === 'n' ? 1 : -1) };
    S.collapsed.win = S.settings.windowsCollapsed !== false;
    S.collapsed.bg = !!S.settings.backgroundCollapsed;
    $('#app').classList.toggle('max', !!m.max);
    $('#btn-admin').hidden = S.elevated;
    $('#btn-overlay').classList.toggle('on', !!S.settings.overlay);
    $('#btn-overlay').dataset.tip = `Game overlay · ${S.hotkey}`;
    renderSortHead();
  }

  // ------------------------------------------------------------------ tick

  function onTick(m) {
    S.sys = m.sys;
    if (m.icons) Object.assign(S.icons, m.icons);

    const next = new Map();
    for (const g of m.groups) {
      const prevEma = S.ema.get(g.k);
      const ema = prevEma == null ? g.c : prevEma * 0.55 + g.c * 0.45;
      S.ema.set(g.k, ema);
      g.ec = ema;
      next.set(g.k, g);
    }
    for (const k of S.ema.keys()) if (!next.has(k)) S.ema.delete(k);
    let pruned = false;
    for (const k of S.expanded) if (!next.has(k)) { S.expanded.delete(k); pruned = true; }
    if (pruned) send({ t: 'expanded', keys: [...S.expanded] });
    S.groups = next;

    if (m.rec) {
      S.rec = { step: m.rec.step, end: m.rec.end, cpu: m.rec.cpu, disk: m.rec.disk, gpu: m.rec.gpu, mem: m.rec.mem, top: m.rec.top };
      S.events = m.rec.events || [];
      // Seed the sparklines from the recorder so they're full the moment the window appears.
      for (const key of ['cpu', 'gpu', 'mem', 'disk']) {
        const tail = S.rec[key].slice(-60).filter(v => v >= 0);
        if (tail.length > S.spark[key].length) S.spark[key] = tail;
      }
    } else if (m.recAdd) {
      const r = S.rec, a = m.recAdd;
      const steps = r.end ? Math.round((a.end - r.end) / r.step) : 1;
      for (let i = 1; i < steps && i < 60; i++) { r.cpu.push(-1); r.disk.push(-1); r.gpu.push(-1); r.mem.push(-1); r.top.push(''); }
      r.cpu.push(a.cpu); r.disk.push(a.disk); r.gpu.push(a.gpu); r.mem.push(a.mem); r.top.push(a.top);
      r.end = a.end;
      const max = 1800;
      for (const key of ['cpu', 'disk', 'gpu', 'mem', 'top']) if (r[key].length > max) r[key].splice(0, r[key].length - max);
    }
    if (m.events) {
      for (const e of m.events) S.events.push(e);
      const cutoff = Date.now() - 24 * 3600 * 1000;
      if (S.events.length && S.events[0].ts < cutoff) S.events = S.events.filter(e => e.ts >= cutoff);
      if (openPop && openPop.kind === 'events') renderEvents(openPop.el);
    }

    if (m.hist) S.hist = m.hist;
    else if (m.histAdd && S.hist && S.hist.k === m.histAdd.k) {
      const a = m.histAdd, hh = S.hist;
      if (a.end > hh.end) {
        hh.cpu.push(a.cpu); hh.gpu.push(a.gpu); hh.mem.push(a.mem); hh.disk.push(a.disk); hh.end = a.end;
        for (const key of ['cpu', 'gpu', 'mem', 'disk']) if (hh[key].length > 900) hh[key].shift();
      }
    }
    S.detail = m.sel || null;

    for (const [key, v] of [['cpu', m.sys.cpu], ['gpu', m.sys.gpu], ['mem', m.sys.mem], ['disk', m.sys.disk]]) {
      const arr = S.spark[key];
      arr.push(v);
      if (arr.length > 61) arr.shift();
    }

    if (S.firstTick) {
      S.firstTick = false;
      // Start on whatever matters most: a frozen app, otherwise the heaviest open app.
      const all = [...S.groups.values()];
      const hung = all.find(g => g.sec === 'hung');
      const app = all.filter(g => g.sec === 'apps' && !(g.x & 4)).sort((a, b) => b.m - a.m)[0];
      const pick = hung || app;
      if (pick) select(pick.k, null, { scroll: true });
    }
    if (S.sel && !S.groups.has(S.sel)) { S.sel = null; S.selPid = null; send({ t: 'select', k: '' }); }

    renderStatus();
    renderTelemetry();
    renderList();
    renderDetail();
    drawRecorder();
  }

  // ------------------------------------------------------------------ status + telemetry

  function renderStatus() {
    const st = S.sys.st || { text: '', tone: 'calm' };
    const btn = $('#status'), txt = $('#status-text');
    btn.dataset.tone = st.tone;
    btn.dataset.k = st.k || '';
    const keyChanged = (st.k || '') + st.tone !== S.lastStatusKey;
    if (txt.textContent === st.text) return;
    if (keyChanged && txt.textContent && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      S.lastStatusKey = (st.k || '') + st.tone;
      txt.classList.add('swap');
      setTimeout(() => { txt.textContent = st.text; txt.classList.remove('swap'); }, 180);
    } else {
      S.lastStatusKey = (st.k || '') + st.tone;
      txt.textContent = st.text;
    }
    btn.title = '';
  }

  function renderTelemetry() {
    const s = S.sys;
    const set = (m, val, sub) => {
      const el = $(`.meter[data-m="${m}"]`);
      const b = el.querySelector('.meter-value b');
      const txt = String(Math.round(val));
      if (b.textContent !== txt) b.textContent = txt;
      const subEl = el.querySelector('.meter-sub');
      if (subEl.innerHTML !== sub) subEl.innerHTML = sub;
      drawSpark(el.querySelector('canvas'), S.spark[m]);
    };
    const ghz = s.ghz > 0 ? `<b>${s.ghz.toFixed(2)}</b> GHz · ` : '';
    const cores = `${s.cores} cores` + (s.lp !== s.cores ? ` · ${s.lp} threads` : '');
    set('cpu', s.cpu, `${ghz}${cores}${s.cpuName ? ' · ' + esc(s.cpuName) : ''}`);

    const gparts = [];
    if (s.gpuName) gparts.push(esc(s.gpuName));
    if (s.gpuTemp != null) gparts.push(`<b class="${s.gpuTemp >= 80 ? 'hot' : ''}">${s.gpuTemp}°C</b>`);
    if (s.vramT > 0) gparts.push(`${fmtGB(s.vramU)} / ${fmtGB(s.vramT)} GB`);
    set('gpu', s.gpu, gparts.join(' · ') || 'No GPU counters');

    set('mem', s.mem, `<b>${fmtGB(s.memU)}</b> of ${fmtGB(s.memT)} GB · commit ${fmtGB(s.commitU)} GB`);
    set('disk', s.disk, `Read <b>${fmtRate(s.dR)}</b> · Write <b>${fmtRate(s.dW)}</b>`);

    $('#tot-c').textContent = fmtPct(s.cpu);
    $('#tot-g').textContent = fmtPct(s.gpu);
    $('#tot-m').textContent = Math.round(s.mem) + '%';
    $('#tot-d').textContent = Math.round(s.disk) + '%';
    $('#count-procs').textContent = `${s.procs} processes`;
  }

  // Canvas sizes come from a ResizeObserver so drawing never forces a synchronous layout.
  const canvasObserver = new ResizeObserver(entries => {
    for (const e of entries) {
      const c = e.target;
      c._cw = e.contentRect.width;
      c._ch = e.contentRect.height;
      if (c._redraw) c._redraw();
    }
  });
  function fitCanvas(c) {
    if (c._cw == null) {
      const r = c.getBoundingClientRect();
      c._cw = r.width; c._ch = r.height;
      canvasObserver.observe(c);
    }
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(c._cw * dpr)), hh = Math.max(1, Math.round(c._ch * dpr));
    if (c.width !== w || c.height !== hh) { c.width = w; c.height = hh; }
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, c._cw, c._ch);
    return { ctx, w: c._cw, h: c._ch };
  }

  function drawSpark(c, data) {
    const { ctx, w, h: H } = fitCanvas(c);
    const n = 60;
    const step = w / n;
    const pts = [];
    for (let i = 0; i < data.length; i++) {
      const x = w - (data.length - 1 - i) * step;
      const y = 2 + (H - 4) * (1 - clamp(data[i], 0, 100) / 100);
      pts.push([x, y]);
    }
    // baseline
    ctx.strokeStyle = 'rgba(236,231,221,0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, H - 0.5); ctx.lineTo(w, H - 0.5); ctx.stroke();
    if (pts.length < 2) return;
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, 'rgba(143,179,232,0.16)');
    grad.addColorStop(1, 'rgba(143,179,232,0)');
    ctx.beginPath();
    ctx.moveTo(pts[0][0], H);
    for (const [x, y] of pts) ctx.lineTo(x, y);
    ctx.lineTo(pts[pts.length - 1][0], H);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.beginPath();
    pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.strokeStyle = 'rgba(143,179,232,0.85)';
    ctx.lineWidth = 1.1;
    ctx.lineJoin = 'round';
    ctx.stroke();
    const [lx, ly] = pts[pts.length - 1];
    ctx.fillStyle = 'rgba(143,179,232,0.25)';
    ctx.beginPath(); ctx.arc(lx - 1.5, ly, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#CFE0F7';
    ctx.beginPath(); ctx.arc(lx - 1.5, ly, 1.6, 0, Math.PI * 2); ctx.fill();
  }

  // ------------------------------------------------------------------ list

  function matches(g, f) {
    if (g.n.toLowerCase().includes(f) || g.s.toLowerCase().includes(f) || (g.img || '').toLowerCase().includes(f) || String(g.pid) === f) return true;
    if (g.w && g.w.some(t => t.toLowerCase().includes(f))) return true;
    if (g.kids && g.kids.some(k => String(k.p) === f)) return true;
    return false;
  }

  function sortValue(g, key) {
    switch (key) {
      case 'n': return g.n.toLowerCase();
      case 'c': return g.ec ?? g.c;
      case 'g': return g.g;
      case 'm': return g.m;
      case 'd': return g.d;
    }
    return 0;
  }

  function sortGroups(arr) {
    const { key, dir } = S.sort;
    const frozen = S.pointerInList;
    arr.sort((a, b) => {
      if (frozen) {
        const ra = S.rank.get(a.k), rb = S.rank.get(b.k);
        if (ra != null && rb != null) return ra - rb;
        if (ra != null) return -1;
        if (rb != null) return 1;
      }
      const va = sortValue(a, key), vb = sortValue(b, key);
      if (key === 'n') return dir * va.localeCompare(vb) || b.m - a.m;
      // treat tiny differences as ties so rows don't shuffle on noise
      const diff = key === 'c' || key === 'g' ? (Math.abs(va - vb) < 0.15 ? 0 : va - vb) : va - vb;
      if (diff !== 0) return dir * diff;
      return b.m - a.m || a.n.localeCompare(b.n);
    });
  }

  function buildItems() {
    const f = S.filter.trim().toLowerCase();
    const buckets = { hung: [], apps: [], bg: [], win: [] };
    for (const g of S.groups.values()) {
      if (f && !matches(g, f)) continue;
      (buckets[g.sec] || buckets.bg).push(g);
    }
    const items = [];
    for (const sec of SECTIONS) {
      const arr = buckets[sec.id];
      if (!arr.length) continue;
      sortGroups(arr);
      const collapsed = !f && sec.id !== 'hung' && S.collapsed[sec.id];
      items.push({ id: 'sec:' + sec.id, type: 'sec', sec: sec.id, label: sec.label, count: arr.length, collapsed });
      if (collapsed) continue;
      for (const g of arr) {
        items.push({ id: 'g:' + g.k, type: 'row', g });
        if (g.kids && S.expanded.has(g.k)) {
          const kids = [...g.kids];
          kids.sort((a, b) => (Math.abs(b.c - a.c) >= 0.15 ? b.c - a.c : 0) || b.m - a.m);
          for (const kd of kids) items.push({ id: 'p:' + g.k + ':' + kd.p, type: 'kid', g, kd });
        }
      }
    }
    return items;
  }

  function renderList() {
    const items = buildItems();
    const rows = $('#rows');
    const seen = new Set();
    let prev = null;
    for (const it of items) {
      let node = S.nodes.get(it.id);
      if (!node) { node = createNode(it); S.nodes.set(it.id, node); }
      updateNode(node, it);
      seen.add(it.id);
      const want = prev ? prev.nextSibling : rows.firstChild;
      if (want !== node) rows.insertBefore(node, want);
      prev = node;
    }
    for (const [id, node] of S.nodes) if (!seen.has(id)) { node.remove(); S.nodes.delete(id); }

    S.rank.clear();
    let i = 0;
    for (const it of items) if (it.type === 'row') S.rank.set(it.g.k, i++);
    S.visible = items.filter(it => it.type !== 'sec');

    const empty = $('#empty');
    if (!items.length && S.filter.trim()) {
      empty.hidden = false;
      empty.innerHTML = `Nothing matches <b>“${esc(S.filter.trim())}”</b>.<br><br>Press <kbd>Enter</kbd> to run it as a new task.`;
    } else empty.hidden = true;
  }

  function createNode(it) {
    if (it.type === 'sec') {
      const n = h('div', 'sec', `${it.sec !== 'hung' ? ICON.chev : ''}<span class="lb"></span><span class="n"></span><span class="rule"></span>`);
      n.dataset.sec = it.sec;
      n.addEventListener('click', () => {
        if (it.sec === 'hung' || S.filter.trim()) return;
        S.collapsed[it.sec] = !S.collapsed[it.sec];
        if (it.sec === 'win') send({ t: 'set', key: 'windowsCollapsed', v: S.collapsed.win });
        if (it.sec === 'bg') send({ t: 'set', key: 'backgroundCollapsed', v: S.collapsed.bg });
        renderList();
      });
      return n;
    }
    const kid = it.type === 'kid';
    const n = h('div', 'row' + (kid ? ' kid' : ''));
    n.innerHTML =
      `<div class="name">${kid ? '' : `<button class="twisty" type="button" tabindex="-1">${ICON.chev}</button>`}<div class="ico"></div>` +
      `<div class="label"><div class="t"><span class="nm"></span></div><div class="sub"></div></div></div>` +
      ['c', 'g', 'm', 'd'].map(k => `<div class="num" data-c="${k}"><span class="v"></span><span class="bar"><i></i></span></div>`).join('');
    n._c = {};
    n.addEventListener('mousedown', e => {
      if (e.button !== 0 && e.button !== 2) return;
      const target = n._it;
      if (e.target.closest('.twisty')) return;
      select(target.g.k, target.type === 'kid' ? target.kd.p : null);
    });
    n.addEventListener('dblclick', e => {
      const target = n._it;
      if (target.type !== 'row' || e.target.closest('.twisty')) return;
      if (target.g.w && target.g.w.length) send({ t: 'action', a: 'focus', k: target.g.k });
      else if (target.g.np > 1) toggleExpand(target.g.k);
    });
    n.addEventListener('contextmenu', e => {
      e.preventDefault();
      const target = n._it;
      openContextMenu(target.g, target.type === 'kid' ? target.kd : null, e.clientX, e.clientY);
    });
    const tw = n.querySelector('.twisty');
    if (tw) tw.addEventListener('click', e => { e.stopPropagation(); toggleExpand(n._it.g.k); });
    return n;
  }

  function iconHtml(key, name, sec, size) {
    if (key && S.icons[key]) return `<img src="${S.icons[key]}" alt="" draggable="false">`;
    if (sec === 'win') return `<span class="mono win">${ICON.winlogo}</span>`;
    const ch = (name || '?').replace(/^[^A-Za-z0-9]+/, '').charAt(0).toUpperCase() || '·';
    return `<span class="mono">${esc(ch)}</span>`;
  }

  function setText(el, cache, key, text) {
    if (cache[key] === text) return;
    cache[key] = text;
    el.textContent = text;
  }

  function updateNode(n, it) {
    n._it = it;
    if (it.type === 'sec') {
      n.querySelector('.lb').textContent = it.label;
      n.querySelector('.n').textContent = it.count;
      n.classList.toggle('collapsed', !!it.collapsed);
      return;
    }
    const c = n._c;
    const kid = it.type === 'kid';
    const g = it.g;
    const src = kid ? it.kd : g;
    const st = kid ? (it.kd.st || 'run') : g.st;
    const sel = kid ? (S.sel === g.k && S.selPid === it.kd.p) : (S.sel === g.k && S.selPid == null);

    if (c.cls !== st + sel + (g.np > 1 ? 1 : 0) + S.expanded.has(g.k)) {
      c.cls = st + sel + (g.np > 1 ? 1 : 0) + S.expanded.has(g.k);
      n.classList.toggle('sel', sel);
      n.classList.toggle('st-hung', st === 'hung');
      n.classList.toggle('st-frozen', st === 'frozen');
      n.classList.toggle('st-susp', st === 'susp');
      n.classList.toggle('has-kids', !kid && g.np > 1);
      n.classList.toggle('open', !kid && S.expanded.has(g.k));
    }

    const iconKey = kid ? g.i : g.i;
    const iconSig = (iconKey && S.icons[iconKey] ? iconKey : '-') + (kid ? '' : g.n.charAt(0)) + g.sec;
    if (c.icon !== iconSig) { c.icon = iconSig; n.querySelector('.ico').innerHTML = iconHtml(iconKey, g.n, g.sec); }

    const name = kid ? it.kd.n : g.n;
    setText(n.querySelector('.nm'), c, 'nm', name);

    let badge = '';
    if (st === 'hung') badge = 'hung';
    else if (st === 'frozen') badge = 'frozen';
    else if (st === 'susp' && !kid) badge = 'susp';
    if (c.badge !== badge) {
      c.badge = badge;
      const t = n.querySelector('.t');
      t.querySelector('.badge')?.remove();
      if (badge) t.appendChild(h('span', 'badge ' + badge, badge === 'hung' ? 'Not responding' : badge === 'frozen' ? 'Frozen' : 'Suspended'));
    }

    const sub = kid ? `PID ${it.kd.p}${it.kd.img && it.kd.img !== g.img ? ' · ' + it.kd.img : ''}` : (g.s || '');
    setText(n.querySelector('.sub'), c, 'sub', sub);

    const memT = S.sys ? S.sys.memT : 1;
    const cells = n.querySelectorAll('.num');
    const vals = [
      [fmtPct(src.c), src.c / 100, src.c >= 25, src.c < 0.05],
      [fmtPct(src.g), src.g / 100, src.g >= 40, src.g < 0.05],
      [fmtBytes(src.m), src.m / memT, src.m / memT >= 0.15, false],
      [fmtRate(src.d), Math.log10(1 + src.d / 1048576) / Math.log10(501), src.d >= 20 * 1048576, src.d < 0.05 * 1048576],
    ];
    for (let i = 0; i < 4; i++) {
      const [txt, frac, hot, zero] = vals[i];
      const cell = cells[i];
      const v = cell.firstChild;
      const sig = txt + hot + zero;
      if (c['v' + i] !== sig) {
        c['v' + i] = sig;
        v.textContent = txt;
        v.className = 'v' + (zero ? ' zero' : hot ? ' hot' : '');
      }
      if (!kid) {
        const f = clamp(frac, 0, 1);
        const fr = f > 0 && f < 0.025 ? 0.025 : f;
        const q = Math.round(fr * 400) / 400;
        if (c['b' + i] !== q + '' + hot) {
          c['b' + i] = q + '' + hot;
          const bar = cell.querySelector('.bar i');
          bar.style.transform = `scaleX(${q})`;
          bar.classList.toggle('hot', hot);
        }
      }
    }
  }

  function toggleExpand(k) {
    if (S.expanded.has(k)) S.expanded.delete(k); else S.expanded.add(k);
    send({ t: 'expanded', keys: [...S.expanded] });
    if (S.sel === k && S.selPid != null && !S.expanded.has(k)) select(k, null);
    renderList();
  }

  function select(k, pid, opts = {}) {
    const changed = S.sel !== k;
    S.sel = k;
    S.selPid = pid ?? null;
    if (changed) {
      S.hist = null;
      send({ t: 'select', k });
      detailBuiltFor = null;
    }
    const g = S.groups.get(k);
    if (g && opts.scroll) {
      if (g.sec !== 'hung' && S.collapsed[g.sec]) S.collapsed[g.sec] = false;
    }
    renderList();
    renderDetail();
    if (opts.scroll) {
      const node = S.nodes.get(pid != null ? `p:${k}:${pid}` : 'g:' + k);
      if (node) node.scrollIntoView({ block: 'nearest' });
    }
  }

  function moveSelection(delta) {
    const list = S.visible;
    if (!list.length) return;
    let idx = list.findIndex(it => it.g.k === S.sel && (it.type === 'kid' ? it.kd.p === S.selPid : S.selPid == null));
    idx = idx < 0 ? (delta > 0 ? 0 : list.length - 1) : clamp(idx + delta, 0, list.length - 1);
    const it = list[idx];
    select(it.g.k, it.type === 'kid' ? it.kd.p : null, { scroll: true });
  }

  // sort header
  function renderSortHead() {
    for (const b of $$('.list-head .col')) {
      const on = b.dataset.sort === S.sort.key;
      b.classList.toggle('active', on);
      b.classList.toggle('asc', on && S.sort.dir > 0);
    }
  }
  for (const b of $$('.list-head .col')) {
    b.addEventListener('click', () => {
      const key = b.dataset.sort;
      if (S.sort.key === key) S.sort.dir = -S.sort.dir;
      else S.sort = { key, dir: key === 'n' ? 1 : -1 };
      S.rank.clear();
      renderSortHead();
      const was = S.pointerInList; S.pointerInList = false; renderList(); S.pointerInList = was;
      send({ t: 'set', key: 'sort', v: S.sort.key, dir: S.sort.dir });
    });
  }

  const listEl = $('#list');
  listEl.addEventListener('pointerenter', () => { S.pointerInList = true; });
  listEl.addEventListener('pointerleave', () => { S.pointerInList = false; });

  // ------------------------------------------------------------------ detail

  let detailBuiltFor = null;

  function renderDetail() {
    const scroll = $('#detail-scroll'), actions = $('#detail-actions');
    const g = S.sel ? S.groups.get(S.sel) : null;
    if (!g) {
      if (detailBuiltFor !== 'empty') {
        detailBuiltFor = 'empty';
        actions.innerHTML = '';
        scroll.innerHTML = `
          <div class="d-empty">
            <svg viewBox="0 0 132 44"><path d="M4 41 C 18 18, 52 4, 92 3.2 C 108 2.9, 121 4.6, 129 8.4 C 116 6.4, 104 6.2, 92 6.9 C 56 9, 24 22, 4 41 Z" fill="rgba(236,231,221,0.5)"/></svg>
            <h3>Pick something to inspect</h3>
            <p>Select an app to see its last 30 minutes,<br>where it lives, and what it is doing.</p>
            <div class="d-facts sysfacts" id="sysfacts"></div>
          </div>`;
      }
      const s = S.sys;
      if (s) $('#sysfacts').innerHTML = factRows([
        ['Up for', fmtUptime(s.up)],
        ['Processes', s.procs.toLocaleString()],
        ['Threads', s.threads.toLocaleString()],
        ['Handles', s.handles.toLocaleString()],
        ['Processor', s.cpuName || '—'],
        ['Graphics', s.gpuName || '—'],
      ]);
      return;
    }

    const kid = S.selPid != null && g.kids ? g.kids.find(k => k.p === S.selPid) : null;
    if (S.selPid != null && !kid) S.selPid = null;
    const sig = g.k + ':' + (kid ? kid.p : '');
    const d = S.detail && S.detail.k === g.k ? S.detail : null;

    if (detailBuiltFor !== sig) {
      detailBuiltFor = sig;
      scroll.innerHTML = `
        <div class="d-head">
          <div class="d-tile"><div class="d-icon"></div></div>
          <div class="d-title"><div class="d-name"></div><div class="d-sub"></div><div class="d-chips"></div></div>
        </div>
        <div class="d-stats">
          <div class="stat" data-s="c"><div class="k">CPU</div><div class="vv"></div><div class="s"></div></div>
          <div class="stat" data-s="g"><div class="k">GPU</div><div class="vv"></div><div class="s"></div></div>
          <div class="stat" data-s="m"><div class="k">Memory</div><div class="vv"></div><div class="s"></div></div>
          <div class="stat" data-s="d"><div class="k">I/O</div><div class="vv"></div><div class="s"></div></div>
        </div>
        <div class="d-hist">
          <div class="d-hist-head"><span class="k">${kid ? 'App · last 30 min' : 'Last 30 min'}</span>
            <div class="seg" id="hist-seg">${['cpu', 'gpu', 'mem', 'disk'].map(m => `<button type="button" data-m="${m}" class="${S.histMetric === m ? 'on' : ''}">${{ cpu: 'CPU', gpu: 'GPU', mem: 'Memory', disk: 'I/O' }[m]}</button>`).join('')}</div>
          </div>
          <div class="hist-box" id="hist-box"><canvas id="hist-canvas"></canvas><div class="hist-hover" id="hist-hover" hidden><span></span></div></div>
          <div class="hist-axis"><span>30 min ago</span><span>15 min</span><span>now</span></div>
        </div>
        <div class="d-facts" id="d-facts"></div>`;
      for (const b of $$('#hist-seg button')) b.addEventListener('click', () => {
        S.histMetric = b.dataset.m;
        for (const x of $$('#hist-seg button')) x.classList.toggle('on', x === b);
        drawHist();
      });
      const box = $('#hist-box');
      box.addEventListener('mousemove', e => histHover(e));
      box.addEventListener('mouseleave', () => { $('#hist-hover').hidden = true; });
      actions.dataset.sig = '';
    }

    // header
    const icon = iconHtml(g.i, g.n, g.sec);
    const iconEl = $('.d-icon', scroll);
    if (iconEl._v !== icon) { iconEl._v = icon; iconEl.innerHTML = icon; }
    const name = kid ? kid.n : g.n;
    const sub = kid ? `Process ${kid.p} inside ${g.n}` : (g.s || (g.img || ''));
    const nameEl = $('.d-name', scroll), subEl = $('.d-sub', scroll);
    if (nameEl.textContent !== name) nameEl.textContent = name;
    if (subEl.textContent !== sub) subEl.textContent = sub;

    const st = kid ? (kid.st || 'run') : g.st;
    const chips = [];
    chips.push(st === 'hung' ? `<span class="chip hung">Not responding${g.hs ? ' · ' + (g.hs < 60 ? g.hs + ' s' : Math.floor(g.hs / 60) + ' min') : ''}</span>`
      : st === 'frozen' ? '<span class="chip frozen">Frozen by you</span>'
      : st === 'susp' ? '<span class="chip">Suspended</span>'
      : '<span class="chip ok">Running</span>');
    if (!kid) {
      chips.push(`<span class="chip">${{ hung: 'App', apps: 'App', bg: 'Background', win: 'Windows' }[g.sec]}</span>`);
      if (g.np > 1) chips.push(`<span class="chip">${g.np} processes</span>`);
    } else chips.push(`<span class="chip">PID ${kid.p}</span>`);
    const chipsHtml = chips.join('');
    const chipsEl = $('.d-chips', scroll);
    if (chipsEl._v !== chipsHtml) { chipsEl._v = chipsHtml; chipsEl.innerHTML = chipsHtml; }

    // stats
    const src = kid || g;
    const s = S.sys;
    const stat = (k, vv, sub2) => {
      const el = $(`.stat[data-s="${k}"]`, scroll);
      const a = el.querySelector('.vv'), b = el.querySelector('.s');
      if (a._v !== vv) { a._v = vv; a.innerHTML = vv; }
      if (b._v !== sub2) { b._v = sub2; b.textContent = sub2; }
    };
    const pctParts = v => { const t = fmtPct(v); return `${t.slice(0, -1)}<i>%</i>`; };
    const bytesParts = b => { const t = fmtBytes(b); const [n, u] = t.split(' '); return `${n}<i>${u}</i>`; };
    const rateParts = b => { const t = fmtRate(b); const [n, u] = t.split(' '); return `${n}<i>${u}</i>`; };
    stat('c', pctParts(src.c), `of all ${s.lp} threads`);
    stat('g', pctParts(src.g), d && d.gpuMem > 0 && !kid ? `${fmtBytes(d.gpuMem)} video memory` : 'busiest engine');
    stat('m', bytesParts(src.m), `${(src.m / s.memT * 100).toFixed(1)}% of ${fmtGB(s.memT)} GB`);
    stat('d', rateParts(src.d), d && !kid ? `R ${fmtRate(d.rd)} · W ${fmtRate(d.wr)}` : 'files, pipes, devices');

    // facts
    const facts = [];
    if (d) {
      facts.push(['PID', kid ? String(kid.p) : (g.np > 1 ? `${d.pid} (+${g.np - 1} more)` : String(d.pid))]);
      if (d.started) facts.push(['Started', `${fmtTime(d.started)} · ${fmtAgo(d.started)}`]);
      facts.push(['Priority', d.priority]);
      facts.push(['Threads', `${d.threads.toLocaleString()} · ${d.handles.toLocaleString()} handles`]);
      if (d.company) facts.push(['Publisher', d.company]);
      if (d.services && d.services.length) facts.push(['Services', d.services.slice(0, 6).join(', ') + (d.services.length > 6 ? ` +${d.services.length - 6}` : '')]);
      facts.push(['Location', d.path ? { path: d.path } : 'Hidden by Windows' + (S.elevated ? '' : ' · run as admin to see')]);
      if (d.cmd && !kid) facts.push(['Command', { mono: d.cmd }]);
    }
    const factsHtml = factRows(facts);
    const factsEl = $('#d-facts');
    if (factsEl._v !== factsHtml) {
      factsEl._v = factsHtml;
      factsEl.innerHTML = factsHtml;
      const cp = factsEl.querySelector('.copy');
      if (cp) cp.addEventListener('click', () => send({ t: 'copy', text: d.path }));
    }

    renderActions(g, kid);
    drawHist();
  }

  function factRows(rows) {
    return rows.map(([k, v]) => {
      if (v && typeof v === 'object' && v.path) return `<div class="fact"><span class="k">${esc(k)}</span><span class="v path"><span>${esc(v.path)}</span><button class="copy" type="button" data-tip="Copy path">${ICON.copy}</button></span></div>`;
      if (v && typeof v === 'object' && v.mono) return `<div class="fact"><span class="k">${esc(k)}</span><span class="v mono">${esc(v.mono)}</span></div>`;
      return `<div class="fact"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`;
    }).join('');
  }

  function renderActions(g, kid) {
    const actions = $('#detail-actions');
    const x = g.x || 0;
    const untouchable = (x & 1) !== 0, noFreeze = (x & 2) !== 0, self = (x & 4) !== 0, restartable = (x & 8) !== 0;
    const st = kid ? (kid.st || 'run') : g.st;
    const frozen = st === 'frozen' || st === 'susp';
    const confirming = S.confirmUntil > Date.now() && S.confirmKey === g.k + (kid ? ':' + kid.p : '');
    const needsConfirm = g.sec === 'win' || restartable;

    const endLabel = confirming ? (restartable ? 'Confirm restart' : 'Confirm: end Windows process')
      : restartable && !kid ? 'Restart' : kid ? 'End process' : 'End task';
    const sig = [g.k, kid && kid.p, untouchable, noFreeze, self, restartable, frozen, confirming, !!(g.w && g.w.length), S.elevated].join('|');
    if (actions.dataset.sig === sig) return;
    actions.dataset.sig = sig;

    let note = '';
    if (untouchable) note = 'Windows can’t run without this, so REAPER keeps its hands off.';
    else if (self) note = 'This is REAPER. Close it from the title bar.';

    actions.innerHTML = `
      <button class="pill danger${confirming ? ' confirm' : ''}" id="act-end" type="button" ${untouchable || self ? 'disabled' : ''}>${restartable && !kid ? ICON.restart : ICON.end}<span>${endLabel}</span></button>
      <div class="pill-row">
        <button class="pill ghost${frozen ? ' on' : ''}" id="act-freeze" type="button" ${noFreeze && !frozen ? 'disabled' : ''}>${frozen ? ICON.thaw : ICON.freeze}<span>${frozen ? 'Unfreeze' : 'Freeze'}</span></button>
        <button class="pill ghost" id="act-open" type="button">${ICON.folder}<span>Open file location</span></button>
      </div>
      ${note ? `<div class="pill-note">${note}</div>` : ''}`;

    $('#act-end').addEventListener('click', () => {
      const ck = g.k + (kid ? ':' + kid.p : '');
      if (needsConfirm && !(S.confirmUntil > Date.now() && S.confirmKey === ck)) {
        S.confirmKey = ck;
        S.confirmUntil = Date.now() + 3500;
        actions.dataset.sig = '';
        renderActions(g, kid);
        setTimeout(() => { actions.dataset.sig = ''; renderDetail(); }, 3600);
        return;
      }
      S.confirmUntil = 0;
      send({ t: 'action', a: 'end', k: g.k, pid: kid ? kid.p : undefined });
    });
    $('#act-freeze').addEventListener('click', () => send({ t: 'action', a: frozen ? 'unfreeze' : 'freeze', k: g.k, pid: kid ? kid.p : undefined }));
    $('#act-open').addEventListener('click', () => send({ t: 'action', a: 'open', k: g.k }));
  }

  function niceCeil(v, steps) {
    for (const s of steps) if (v <= s) return s;
    return steps[steps.length - 1];
  }

  function histScale(metric, arr) {
    const max = arr.reduce((m, v) => Math.max(m, v), 0);
    switch (metric) {
      case 'cpu': case 'gpu': {
        const top = niceCeil(max * 1.15, [5, 10, 25, 50, 100]);
        return { top, label: v => Math.round(v) + '%', fmt: v => fmtPct(v) };
      }
      case 'mem': {
        const top = niceCeil(max * 1.15, [64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65536, 131072]);
        return { top, label: v => v >= 1024 ? (v / 1024).toFixed(v % 1024 ? 1 : 0) + ' GB' : Math.round(v) + ' MB', fmt: v => fmtBytes(v * 1048576) };
      }
      case 'disk': {
        const top = niceCeil(max * 1.15, [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000]);
        return { top, label: v => v + ' MB/s', fmt: v => fmtRate(v * 1048576) };
      }
    }
  }

  function drawHist() {
    const c = $('#hist-canvas');
    if (!c) return;
    const { ctx, w, h: H } = fitCanvas(c);
    const hh = S.hist && S.hist.k === S.sel ? S.hist : null;
    const arr = hh ? hh[S.histMetric] : [];
    const sc = histScale(S.histMetric, arr);
    const top = 8, bottom = H - 1;
    // grid
    ctx.strokeStyle = 'rgba(236,231,221,0.06)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);
    for (const f of [0, 0.5]) {
      const y = Math.round(top + (bottom - top) * f) + 0.5;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(236,231,221,0.08)';
    ctx.beginPath(); ctx.moveTo(0, bottom - 0.5); ctx.lineTo(w, bottom - 0.5); ctx.stroke();
    ctx.fillStyle = 'rgba(138,134,127,0.85)';
    ctx.font = '10px "Segoe UI Variable Small", "Segoe UI", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(sc.label(sc.top), w - 2, top - 1 + 9);

    const span = 30 * 60 * 1000;
    const now = Date.now();
    const step = hh ? hh.step : 2000;
    if (!hh || arr.length < 2) {
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(97,94,89,0.95)';
      ctx.fillText(hh ? 'Collecting history…' : 'Loading…', w / 2, H / 2 + 3);
      S.histPts = [];
      return;
    }
    const pts = [];
    for (let i = 0; i < arr.length; i++) {
      const t = hh.end - (arr.length - 1 - i) * step;
      const x = w - (now - t) / span * w;
      if (x < -4) continue;
      const y = bottom - (bottom - top) * clamp(arr[i] / sc.top, 0, 1);
      pts.push([x, y, arr[i], t]);
    }
    S.histPts = pts;
    S.histFmt = sc.fmt;
    if (pts.length < 2) return;
    const grad = ctx.createLinearGradient(0, top, 0, bottom);
    grad.addColorStop(0, 'rgba(143,179,232,0.20)');
    grad.addColorStop(1, 'rgba(143,179,232,0.0)');
    ctx.beginPath();
    ctx.moveTo(pts[0][0], bottom);
    for (const p of pts) ctx.lineTo(p[0], p[1]);
    ctx.lineTo(pts[pts.length - 1][0], bottom);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.beginPath();
    pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
    ctx.strokeStyle = 'rgba(143,179,232,0.9)';
    ctx.lineWidth = 1.25;
    ctx.lineJoin = 'round';
    ctx.stroke();
    const last = pts[pts.length - 1];
    ctx.fillStyle = 'rgba(143,179,232,0.25)';
    ctx.beginPath(); ctx.arc(last[0] - 2, last[1], 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#D7E5F8';
    ctx.beginPath(); ctx.arc(last[0] - 2, last[1], 1.8, 0, Math.PI * 2); ctx.fill();
  }

  function histHover(e) {
    const box = $('#hist-box'), hov = $('#hist-hover');
    const pts = S.histPts || [];
    if (!pts.length) { hov.hidden = true; return; }
    const r = box.getBoundingClientRect();
    const x = e.clientX - r.left;
    let best = pts[0];
    for (const p of pts) if (Math.abs(p[0] - x) < Math.abs(best[0] - x)) best = p;
    hov.hidden = false;
    hov.style.left = best[0] + 'px';
    hov.classList.toggle('flip', best[0] > r.width * 0.6);
    hov.firstChild.textContent = `${fmtTime(best[3])} · ${S.histFmt(best[2])}`;
  }

  // ------------------------------------------------------------------ flight recorder

  const REC_SPAN = 30 * 60 * 1000;

  function drawRecorder() {
    const c = $('#rec-canvas');
    const { ctx, w, h: H } = fitCanvas(c);
    const r = S.rec;
    const now = Date.now();
    const start = now - REC_SPAN;
    const X = t => (t - start) / REC_SPAN * w;
    const top = 22, bottom = H - 17;

    // time axis
    ctx.font = '10px "Segoe UI Variable Small", "Segoe UI", sans-serif';
    ctx.fillStyle = 'rgba(97,94,89,1)';
    ctx.textAlign = 'center';
    const five = 5 * 60 * 1000;
    for (let t = Math.ceil(start / five) * five; t <= now; t += five) {
      const x = X(t);
      if (x < 18 || x > w - 26) continue;
      ctx.fillText(fmtTime(t), x, H - 3);
      ctx.fillStyle = 'rgba(236,231,221,0.05)';
      ctx.fillRect(Math.round(x), top, 1, bottom - top);
      ctx.fillStyle = 'rgba(97,94,89,1)';
    }
    ctx.textAlign = 'right';
    ctx.fillText('now', w - 1, H - 3);
    ctx.fillStyle = 'rgba(236,231,221,0.07)';
    ctx.fillRect(0, bottom, w, 1);

    const n = r.cpu.length;
    let firstX = null;
    if (n > 1) {
      const series = (arr, scale) => {
        const segs = [];
        let cur = [];
        for (let i = 0; i < n; i++) {
          const t = r.end - (n - 1 - i) * r.step;
          if (t < start - r.step) continue;
          const v = arr[i];
          if (v < 0) { if (cur.length) segs.push(cur); cur = []; continue; }
          cur.push([X(t), bottom - (bottom - top) * clamp(v / scale, 0, 1)]);
        }
        if (cur.length) segs.push(cur);
        return segs;
      };
      const cpu = series(r.cpu, 100);
      if (cpu.length && cpu[0].length) firstX = cpu[0][0][0];
      const grad = ctx.createLinearGradient(0, top, 0, bottom);
      grad.addColorStop(0, 'rgba(143,179,232,0.22)');
      grad.addColorStop(1, 'rgba(143,179,232,0.02)');
      for (const seg of cpu) {
        if (seg.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(seg[0][0], bottom);
        for (const [x, y] of seg) ctx.lineTo(x, y);
        ctx.lineTo(seg[seg.length - 1][0], bottom);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.beginPath();
        seg.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
        ctx.strokeStyle = 'rgba(143,179,232,0.7)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      for (const seg of series(r.disk, 100)) {
        if (seg.length < 2) continue;
        ctx.beginPath();
        seg.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
        ctx.strokeStyle = 'rgba(236,231,221,0.22)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
    const range = $('#rec-range');
    const since = n > 1 && firstX != null && firstX > 4 ? `Since ${fmtTime(r.end - (n - 1) * r.step)}` : 'Last 30 min';
    if (range.textContent !== since) range.textContent = since;
    renderMarkers(start, w);
  }

  function renderMarkers(start, w) {
    const wrap = $('#rec-markers');
    const vis = S.events.filter(e => e.ts >= start);
    const sig = vis.map(e => e.ts).join(',') + '|' + Math.round(w) + '|' + Math.floor(Date.now() / 5000);
    if (wrap._sig === sig) return;
    wrap._sig = sig;
    wrap.innerHTML = '';
    const latest = vis[vis.length - 1];
    for (const e of vis) {
      const m = h('div', 'marker' + (e.alert ? ' alert' : '') + (['end', 'freeze', 'unfreeze'].includes(e.kind) ? ' user' : ''));
      const x = (e.ts - start) / REC_SPAN * w;
      m.style.left = x + 'px';
      m.dataset.tip = `${fmtTimeS(e.ts)} · ${e.text}${e.detail ? ' · ' + e.detail : ''}`;
      if (e === latest) {
        const lbl = h('div', 'marker-label', `<time>${fmtTime(e.ts)}</time> · ${esc(e.text)}`);
        m.appendChild(lbl);
        if (x > w * 0.62) m.classList.add('flip');
        delete m.dataset.tip;
      }
      m.addEventListener('click', () => jumpTo(e));
      wrap.appendChild(m);
    }
  }

  function jumpTo(e) {
    if (e.k && S.groups.has(e.k)) {
      if (S.filter) { S.filter = ''; $('#search').value = ''; $('#search-wrap').classList.remove('has-text'); }
      select(e.k, null, { scroll: true });
    } else toast('That process has exited since then.', 'info');
  }

  const track = $('#rec-track'), cursor = $('#rec-cursor');
  track.addEventListener('mousemove', e => {
    if (e.target.closest('.marker')) { cursor.hidden = true; return; }
    const r = track.getBoundingClientRect();
    const x = e.clientX - r.left;
    const t = Date.now() - REC_SPAN + x / r.width * REC_SPAN;
    const rec = S.rec;
    const n = rec.cpu.length;
    const i = n - 1 - Math.round((rec.end - t) / rec.step);
    if (i < 0 || i >= n || rec.cpu[i] < 0) { cursor.hidden = true; return; }
    cursor.hidden = false;
    cursor.style.left = x + 'px';
    const top = rec.top[i] ? ` · busiest: ${rec.top[i]}` : '';
    cursor.firstChild.textContent = `${fmtTimeS(t)} · CPU ${Math.round(rec.cpu[i])}% · Disk ${Math.round(rec.disk[i])}%${top}`;
    const sw = cursor.firstChild.offsetWidth;
    const shift = clamp(x, sw / 2, r.width - sw / 2) - x;
    cursor.firstChild.style.transform = `translateX(calc(-50% + ${shift}px))`;
  });
  track.addEventListener('mouseleave', () => { cursor.hidden = true; });

  // ------------------------------------------------------------------ popovers

  let openPop = null;

  function closePop(instant) {
    if (!openPop) return;
    const p = openPop;
    openPop = null;
    p.onClose && p.onClose();
    if (instant) { p.el.remove(); return; }
    p.el.classList.add('leave');
    setTimeout(() => p.el.remove(), 110);
  }

  function showPop(el, kind, x, y, origin) {
    closePop(true);
    el.classList.add('pop', 'enter');
    el.style.setProperty('--origin', origin || 'top left');
    $('#layer').appendChild(el);
    const r = el.getBoundingClientRect();
    const vw = innerWidth, vh = innerHeight;
    let left = x, top = y;
    if (origin && origin.includes('right')) left = x - r.width;
    if (left + r.width > vw - 8) left = vw - r.width - 8;
    if (top + r.height > vh - 8) { top = Math.max(8, y - r.height); el.style.setProperty('--origin', (origin || 'top left').replace('top', 'bottom')); }
    el.style.left = Math.max(8, left) + 'px';
    el.style.top = Math.max(8, top) + 'px';
    requestAnimationFrame(() => el.classList.remove('enter'));
    openPop = { el, kind };
    return openPop;
  }

  document.addEventListener('mousedown', e => {
    if (openPop && !openPop.el.contains(e.target) && !e.target.closest('[data-pop-anchor]')) closePop();
  }, true);
  window.addEventListener('blur', () => closePop(true));
  window.addEventListener('resize', () => { closePop(true); drawRecorder(); drawHist(); });

  function menuItem(label, icon, onClick, opts = {}) {
    const b = h('button', 'mi' + (opts.danger ? ' danger' : '') + (opts.on ? ' on' : ''), `${icon || ''}<span>${esc(label)}</span>${opts.kb ? `<span class="kb">${esc(opts.kb)}</span>` : ''}`);
    b.type = 'button';
    if (opts.disabled) b.disabled = true;
    b.addEventListener('click', () => { closePop(); onClick(); });
    return b;
  }

  function openContextMenu(g, kid, x, y) {
    const el = h('div', 'menu');
    const x2 = g.x || 0;
    const untouchable = (x2 & 1) !== 0, noFreeze = (x2 & 2) !== 0, self = (x2 & 4) !== 0, restartable = (x2 & 8) !== 0;
    const st = kid ? (kid.st || 'run') : g.st;
    const frozen = st === 'frozen' || st === 'susp';
    const pid = kid ? kid.p : undefined;
    el.appendChild(h('div', 'mhead', esc(kid ? `${kid.n} · ${kid.p}` : g.n)));
    if (!kid && g.w && g.w.length) el.appendChild(menuItem('Switch to', ICON.window, () => send({ t: 'action', a: 'focus', k: g.k })));
    if (!kid && g.np > 1) el.appendChild(menuItem(S.expanded.has(g.k) ? 'Collapse processes' : `Show ${g.np} processes`, ICON.tree, () => toggleExpand(g.k)));
    if (el.children.length > 1) el.appendChild(h('div', 'msep'));
    el.appendChild(menuItem(restartable && !kid ? 'Restart' : kid ? 'End process' : 'End task', restartable && !kid ? ICON.restart : ICON.end, () => {
      if (g.sec === 'win' && !restartable) {
        select(g.k, kid ? kid.p : null, { scroll: true });
        S.confirmKey = g.k + (kid ? ':' + kid.p : '');
        S.confirmUntil = Date.now() + 3500;
        $('#detail-actions').dataset.sig = '';
        renderDetail();
        setTimeout(() => { $('#detail-actions').dataset.sig = ''; renderDetail(); }, 3600);
        return;
      }
      send({ t: 'action', a: 'end', k: g.k, pid });
    }, { danger: true, disabled: untouchable || self, kb: 'Del' }));
    el.appendChild(menuItem(frozen ? 'Unfreeze' : 'Freeze', frozen ? ICON.thaw : ICON.freeze, () => send({ t: 'action', a: frozen ? 'unfreeze' : 'freeze', k: g.k, pid }), { disabled: noFreeze && !frozen }));
    const pri = h('button', 'mi', `${ICON.speed}<span>Priority</span><span class="kb">${esc(S.detail && S.detail.k === g.k ? S.detail.priority : '')}</span>`);
    pri.type = 'button';
    pri.disabled = untouchable;
    pri.addEventListener('click', () => {
      const r = pri.getBoundingClientRect();
      const sub = h('div', 'menu');
      sub.appendChild(h('div', 'mhead', 'Priority'));
      const cur = S.detail && S.detail.k === g.k ? S.detail.priority : '';
      for (const [v, label] of [['high', 'High'], ['above', 'Above normal'], ['normal', 'Normal'], ['below', 'Below normal'], ['low', 'Low']])
        sub.appendChild(menuItem(label, '', () => send({ t: 'action', a: 'priority', k: g.k, pid, v }), { on: cur === label }));
      showPop(sub, 'menu', r.right + 4, r.top - 6, 'top left');
    });
    el.appendChild(pri);
    el.appendChild(h('div', 'msep'));
    el.appendChild(menuItem('Open file location', ICON.folder, () => send({ t: 'action', a: 'open', k: g.k })));
    el.appendChild(menuItem('Properties', ICON.props, () => send({ t: 'action', a: 'props', k: g.k })));
    el.appendChild(menuItem('Copy name', ICON.copy, () => send({ t: 'copy', text: kid ? `${kid.n} (${kid.p})` : g.n })));
    el.appendChild(menuItem('Search online', ICON.search, () => send({ t: 'action', a: 'search', k: g.k })));
    showPop(el, 'menu', x, y, 'top left');
  }

  // settings
  const settingsBtn = $('#btn-settings');
  settingsBtn.dataset.popAnchor = '1';
  settingsBtn.addEventListener('click', () => {
    if (openPop && openPop.kind === 'settings') { closePop(); return; }
    const el = h('div', 'settings');
    renderSettings(el);
    const r = settingsBtn.getBoundingClientRect();
    showPop(el, 'settings', r.right, r.bottom + 8, 'top right');
    settingsBtn.classList.add('on');
    openPop.onClose = () => settingsBtn.classList.remove('on');
  });

  function renderSettings(el) {
    const st = S.settings;
    const iv = st.interval || 1000;
    el.innerHTML = `
      <div class="set-row"><div class="tx"><b>Update speed</b><span>How often numbers refresh.</span></div>
        <div class="seg wide" data-k="interval">${[[500, 'Fast'], [1000, 'Normal'], [2000, 'Slow']].map(([v, l]) => `<button type="button" data-v="${v}" class="${iv === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      <div class="set-row"><div class="tx"><b>Game overlay</b><span>${esc(S.hotkey)} · FPS, 1% lows and temps${S.elevated ? '' : '<br>FPS needs administrator'}</span></div>
        <div style="display:flex;gap:10px;align-items:center"><div class="corner-pick" data-k="overlayCorner">${['tl', 'tr', 'bl', 'br'].map(c => `<button type="button" data-v="${c}" class="${(st.overlayCorner || 'tl') === c ? 'on' : ''}" aria-label="${c}"></button>`).join('')}</div>
        <button type="button" class="toggle ${st.overlay ? 'on' : ''}" data-k="overlay" aria-label="Game overlay"></button></div></div>
      <div class="set-row"><div class="tx"><b>Overlay size</b><span>Bigger is easier to read.</span></div>
        <div class="seg wide" data-k="overlaySize">${[['s', 'Small'], ['m', 'Medium'], ['l', 'Large']].map(([v, l]) => `<button type="button" data-v="${v}" class="${(st.overlaySize || 'm') === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      <div class="set-row"><div class="tx"><b>Always on top</b><span>Keep REAPER above other windows.</span></div><button type="button" class="toggle ${st.alwaysOnTop ? 'on' : ''}" data-k="alwaysOnTop"></button></div>
      <div class="set-row"><div class="tx"><b>Close to tray</b><span>The close button hides REAPER instead of quitting.</span></div><button type="button" class="toggle ${st.closeToTray ? 'on' : ''}" data-k="closeToTray"></button></div>
      <div class="set-row"><div class="tx"><b>Start with Windows</b><span>Waits quietly in the tray.</span></div><button type="button" class="toggle ${st.startWithWindows ? 'on' : ''}" data-k="startWithWindows"></button></div>
      <div class="set-row"><div class="tx"><b>Open with Ctrl+Shift+Esc</b><span>Replace Task Manager’s shortcut.${S.elevated ? '' : ' Needs administrator.'} Switch this off before you move or delete REAPER.</span></div><button type="button" class="toggle ${st.replaceTm ? 'on' : ''}" data-k="replaceTm"></button></div>
      <div class="set-foot"><span>REAPER ${esc(S.version)}${S.elevated ? ' · administrator' : ''}</span><button type="button" id="open-log">Open recorder log</button></div>`;
    for (const t of $$('.toggle', el)) t.addEventListener('click', () => {
      const k = t.dataset.k, v = !t.classList.contains('on');
      t.classList.toggle('on', v);
      S.settings[k] = v;
      send({ t: 'set', key: k, v });
      if (k === 'overlay') $('#btn-overlay').classList.toggle('on', v);
    });
    for (const b of $$('.seg[data-k="interval"] button', el)) b.addEventListener('click', () => {
      S.settings.interval = +b.dataset.v;
      for (const x of $$('.seg[data-k="interval"] button', el)) x.classList.toggle('on', x === b);
      send({ t: 'set', key: 'interval', v: +b.dataset.v });
    });
    for (const b of $$('.seg[data-k="overlaySize"] button', el)) b.addEventListener('click', () => {
      S.settings.overlaySize = b.dataset.v;
      for (const x of $$('.seg[data-k="overlaySize"] button', el)) x.classList.toggle('on', x === b);
      send({ t: 'set', key: 'overlaySize', v: b.dataset.v });
    });
    for (const b of $$('.corner-pick button', el)) b.addEventListener('click', () => {
      S.settings.overlayCorner = b.dataset.v;
      for (const x of $$('.corner-pick button', el)) x.classList.toggle('on', x === b);
      send({ t: 'set', key: 'overlayCorner', v: b.dataset.v });
    });
    $('#open-log', el).addEventListener('click', () => send({ t: 'openLog' }));
  }

  // events list
  const recAll = $('#rec-all');
  recAll.dataset.popAnchor = '1';
  recAll.addEventListener('click', () => {
    if (openPop && openPop.kind === 'events') { closePop(); return; }
    const el = h('div', 'events');
    const r = recAll.getBoundingClientRect();
    showPop(el, 'events', r.right, r.top - 8, 'bottom right');
    renderEvents(el);
    const r2 = el.getBoundingClientRect();
    el.style.top = Math.max(8, r.top - 8 - r2.height) + 'px';
  });

  function renderEvents(el) {
    const evs = [...S.events].reverse();
    if (!evs.length) {
      el.innerHTML = `<div class="events-empty">Nothing worth noting yet.<br>REAPER logs spikes, hangs and memory surges here as they happen.</div>`;
      return;
    }
    const list = h('div', 'events-list');
    let day = '';
    for (const e of evs) {
      const d = new Date(e.ts).toDateString();
      if (d !== day) {
        day = d;
        const today = new Date().toDateString() === d;
        list.appendChild(h('div', 'ev-day', today ? 'Today' : new Date(e.ts).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })));
      }
      const b = h('button', 'ev' + (e.alert ? ' alert' : '') + (['end', 'freeze', 'unfreeze'].includes(e.kind) ? ' user' : ''),
        `<time>${fmtTime(e.ts)}</time><span class="dot"></span><span>${esc(e.text)}${e.detail ? `<small>${esc(e.detail)}</small>` : ''}</span>`);
      b.type = 'button';
      b.addEventListener('click', () => { closePop(); jumpTo(e); });
      list.appendChild(b);
    }
    const keep = el.querySelector('.events-list')?.scrollTop || 0;
    el.innerHTML = '';
    el.appendChild(list);
    list.scrollTop = keep;
  }

  // ------------------------------------------------------------------ toasts + tooltips

  function toast(text, tone = 'info', action) {
    if (!text) return;
    const wrap = $('#toasts');
    const t = h('div', 'toast enter ' + (tone || 'info'), `<span class="dot"></span><span>${esc(text)}</span>`);
    if (action === 'elevate') {
      const b = h('button', 'act', 'Restart as admin');
      b.type = 'button';
      b.addEventListener('click', () => send({ t: 'elevate' }));
      t.appendChild(b);
    }
    wrap.appendChild(t);
    while (wrap.children.length > 3) wrap.firstChild.remove();
    requestAnimationFrame(() => t.classList.remove('enter'));
    let ms = tone === 'alert' || action ? 7000 : 3600;
    let timer;
    const arm = () => { timer = setTimeout(() => { t.classList.add('leave'); setTimeout(() => t.remove(), 180); }, ms); };
    t.addEventListener('mouseenter', () => clearTimeout(timer));
    t.addEventListener('mouseleave', () => { ms = 1600; arm(); });
    arm();
  }

  const tip = $('#tip');
  let tipTimer = 0, tipShownAt = 0, tipTarget = null;
  document.addEventListener('pointerover', e => {
    const t = e.target.closest('[data-tip]');
    if (t === tipTarget) return;
    tipTarget = t;
    clearTimeout(tipTimer);
    if (!t) { if (tip.classList.contains('show')) tipShownAt = Date.now(); tip.classList.remove('show'); return; }
    const instant = Date.now() - tipShownAt < 600 || tip.classList.contains('show');
    const show = () => {
      tip.textContent = t.dataset.tip;
      tip.classList.toggle('instant', instant);
      const r = t.getBoundingClientRect();
      const tr = tip.getBoundingClientRect();
      let x = r.left + r.width / 2 - tr.width / 2;
      let y = r.bottom + 8;
      if (y + tr.height > innerHeight - 6) y = r.top - tr.height - 8;
      tip.style.left = clamp(x, 8, innerWidth - tr.width - 8) + 'px';
      tip.style.top = y + 'px';
      tip.classList.add('show');
      tipShownAt = Date.now();
    };
    if (instant) show(); else tipTimer = setTimeout(show, 450);
  });
  document.addEventListener('pointerdown', () => { clearTimeout(tipTimer); tip.classList.remove('show'); });

  // ------------------------------------------------------------------ header controls

  for (const b of $$('[data-win]')) b.addEventListener('click', () => send({ t: 'win', a: b.dataset.win }));
  // Fallback for runtimes without app-region support: when the native drag region works, these never fire.
  const top = $('.top');
  top.addEventListener('mousedown', e => {
    if (e.button !== 0 || e.target.closest('button, input, label, .status')) return;
    if (e.detail === 2) send({ t: 'win', a: 'max' });
    else send({ t: 'win', a: 'drag' });
  });
  $('#status').addEventListener('click', () => {
    const k = $('#status').dataset.k;
    if (k && S.groups.has(k)) {
      if (S.filter) clearSearch();
      select(k, null, { scroll: true });
    }
  });
  $('#btn-admin').addEventListener('click', () => send({ t: 'elevate' }));
  $('#btn-overlay').addEventListener('click', () => {
    const on = !$('#btn-overlay').classList.contains('on');
    $('#btn-overlay').classList.toggle('on', on);
    S.settings.overlay = on;
    send({ t: 'set', key: 'overlay', v: on });
  });

  const search = $('#search'), searchWrap = $('#search-wrap');
  function clearSearch() {
    search.value = '';
    S.filter = '';
    searchWrap.classList.remove('has-text');
    renderList();
  }
  search.addEventListener('input', () => {
    S.filter = search.value;
    searchWrap.classList.toggle('has-text', !!search.value);
    S.rank.clear();
    renderList();
    const first = S.visible[0];
    if (S.filter.trim() && first && !S.visible.some(it => it.g.k === S.sel)) select(first.g.k, null);
  });
  search.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!S.visible.length && S.filter.trim()) { send({ t: 'run', cmd: S.filter.trim() }); clearSearch(); search.blur(); return; }
      const first = S.visible.find(it => it.g.k === S.sel) || S.visible[0];
      if (first) { select(first.g.k, first.type === 'kid' ? first.kd.p : null, { scroll: true }); listEl.focus(); }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (search.value) clearSearch(); else { search.blur(); listEl.focus(); }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault(); listEl.focus(); moveSelection(1);
    }
  });
  $('#search-clear').addEventListener('click', () => { clearSearch(); search.focus(); });

  document.addEventListener('keydown', e => {
    const inInput = e.target === search;
    if ((e.ctrlKey && (e.key === 'f' || e.key === 'F')) || (e.key === '/' && !inInput)) {
      e.preventDefault(); search.focus(); search.select(); return;
    }
    if (e.key === 'Escape' && openPop) { closePop(); return; }
    if (inInput) return;
    if (e.ctrlKey && (e.key === 'r' || e.key === 'R' || e.key === 'p' || e.key === 'P')) { e.preventDefault(); return; }
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); moveSelection(1); return;
      case 'ArrowUp': e.preventDefault(); moveSelection(-1); return;
      case 'PageDown': e.preventDefault(); moveSelection(10); return;
      case 'PageUp': e.preventDefault(); moveSelection(-10); return;
      case 'Home': e.preventDefault(); moveSelection(-1e6); return;
      case 'End': e.preventDefault(); moveSelection(1e6); return;
      case 'ArrowRight': {
        const g = S.groups.get(S.sel);
        if (g && g.np > 1 && !S.expanded.has(g.k)) { e.preventDefault(); toggleExpand(g.k); }
        return;
      }
      case 'ArrowLeft': {
        const g = S.groups.get(S.sel);
        if (!g) return;
        e.preventDefault();
        if (S.selPid != null) select(g.k, null, { scroll: true });
        else if (S.expanded.has(g.k)) toggleExpand(g.k);
        return;
      }
      case 'Enter': {
        const g = S.groups.get(S.sel);
        if (g && g.np > 1 && S.selPid == null) toggleExpand(g.k);
        return;
      }
      case 'Delete': {
        const btn = $('#act-end');
        if (btn && !btn.disabled) btn.click();
        return;
      }
      case 'Escape':
        if (S.filter) clearSearch();
        return;
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey && /\S/.test(e.key)) {
      search.focus();
    }
  });

  document.addEventListener('contextmenu', e => {
    if (!e.target.closest('input')) e.preventDefault();
  });

  // ------------------------------------------------------------------ boot

  setInterval(() => { if (S.sys) drawRecorder(); }, 5000);

  if (host) {
    host.addEventListener('message', e => onMessage(e.data));
    send({ t: 'ready' });
  } else {
    const start = () => { mock = window.ReaperMock(onMessage); mock.receive({ t: 'ready' }); };
    if (window.ReaperMock) start();
    else {
      const s = document.createElement('script');
      s.src = 'mock.js';
      s.onload = start;
      document.body.appendChild(s);
    }
  }
})();
