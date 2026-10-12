'use strict';
// TEMPO's window. Talks to the app through window.chrome.webview; in a normal browser mock.js plays the app's part.
(() => {
  const host = window.chrome && window.chrome.webview;
  const send = msg => host ? host.postMessage(msg) : window.__mockSend && window.__mockSend(msg);
  const $ = id => document.getElementById(id);
  const body = document.body;

  const S = {
    settings: {}, games: [], sessions: [], hw: {}, version: '',
    st: { state: 'off' }, live: null, page: 'play', sessSel: null, apps: null, boostStatus: {},
  };
  // settings can be nested ("boost.stepBack")
  const getSet = k => k.split('.').reduce((o, p) => o == null ? undefined : o[p], S.settings);
  function putSet(k, v) { const ps = k.split('.'); let o = S.settings; ps.slice(0, -1).forEach(p => { o[p] = o[p] || {}; o = o[p]; }); o[ps[ps.length - 1]] = v; }
  const DEFAULT_ON = new Set(['overlay', 'autoOff', 'artBehindDial', 'boost.stepBack', 'boost.gameFirst', 'boost.gameMode', 'boost.recording', 'boost.powerPlan', 'boost.memoryRelief', 'boost.strongGpu']);
  const isOn = k => { const v = getSet(k); return v === true || (v === undefined && DEFAULT_ON.has(k)); };
  const BOOST_KEYS = ['boost.stepBack', 'boost.gameFirst', 'boost.gameMode', 'boost.recording', 'boost.powerPlan'];
  const boostCount = () => BOOST_KEYS.filter(isOn).length;

  // ------------------------------------------------------------------ helpers
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n, d = 0) => (n == null || isNaN(n)) ? '–' : Number(n).toFixed(d);
  const gb = b => (b / 1073741824).toFixed(1);
  const sel = () => S.games.find(g => g.id === S.settings.selectedGame) || null;
  const gameOf = id => S.games.find(g => g.id === id);
  const sessionsOf = id => S.sessions.filter(s => s.gameId === id);
  const dur = sec => { sec = Math.round(sec); const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60; return h ? `${h} h ${m} min` : m ? `${m} min` : `${sec} s`; };
  const when = iso => {
    const d = new Date(iso), now = new Date();
    const t = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === now.toDateString()) return 'Today ' + t;
    const y = new Date(now); y.setDate(now.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return 'Yesterday ' + t;
    return d.toLocaleDateString([], { day: 'numeric', month: 'short' }) + ' ' + t;
  };
  function toast(text) {
    const t = $('toast');
    t.textContent = text;
    t.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => t.hidden = true, 4200);
  }
  const hexRgb = h => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (!m) return [212, 255, 63]; const n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255]; };

  // ------------------------------------------------------------------ theme
  const ACCENTS = [['Volt', '#D4FF3F'], ['Violet', '#B79BFF'], ['Ice', '#6FE3FF'], ['Ember', '#FF7A3D'], ['Rose', '#FF6FAE'], ['Gold', '#FFD15C'], ['Mint', '#5CFFB5'], ['Mono', '#F2F3F5']];
  const BGS = [['graphite', 'Graphite', '#08090B'], ['black', 'True black', '#000000'], ['midnight', 'Midnight', '#070A14']];
  // contrast between two colours (WCAG), so a dark colour of your own still reads on TEMPO's dark background
  const relLum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const contrast = (a, b) => { const x = relLum(a), y = relLum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const toHex = rgb => '#' + rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
  const ACC = () => S.accUi || S.settings.accent || '#D4FF3F';
  function applyTheme() {
    const st = S.settings;
    let [r, g, b] = hexRgb(st.accent);
    const bgHex = (BGS.find(x => x[0] === (st.background || 'graphite')) || BGS[0])[2];
    // lift a too-dark accent towards white until text in it reads clearly (the overlay keeps your exact colour)
    for (let i = 0; i < 20 && contrast([r, g, b], hexRgb(bgHex)) < 4.5; i++) { r += (255 - r) * .12; g += (255 - g) * .12; b += (255 - b) * .12; }
    [r, g, b] = [r, g, b].map(Math.round);
    S.accUi = toHex([r, g, b]);
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const root = document.documentElement.style;
    root.setProperty('--acc', S.accUi);
    root.setProperty('--acc-rgb', `${r}, ${g}, ${b}`);
    root.setProperty('--acc-ink', lum > 0.45 ? `rgb(${Math.round(r * .06)}, ${Math.round(g * .06)}, ${Math.round(b * .06)})` : '#FFFFFF');
    root.setProperty('--grain', String((st.grain ?? .35) * .22));
    body.dataset.bg = st.background || 'graphite';
    body.dataset.art = st.artStyle || (st.artBehindDial === false ? 'off' : 'tinted');
    body.dataset.motion = st.motion || 'full';
    drawDialTicks();
    drawLookDial();
  }

  // grain: one random tile, drawn once
  (function grain() {
    const c = $('grain'), w = 512, h = 512;
    c.width = w; c.height = h;
    const g = c.getContext('2d'), im = g.createImageData(w, h);
    for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = Math.random() * 120; }
    g.putImageData(im, 0, 0);
    c.style.width = '100%'; c.style.height = '100%';
    c.style.imageRendering = 'pixelated';
  })();

  // ------------------------------------------------------------------ dial
  const NS = 'http://www.w3.org/2000/svg';
  const D = { C: 186, R: 158, max: 165, hz: 144 };
  const dial = { shown: 0, target: 0, ghost: 0, raf: 0 };
  const pt = (deg, r, C = D.C) => { const t = (deg - 90) * Math.PI / 180; return [C + r * Math.cos(t), C + r * Math.sin(t)]; };
  const ang = v => 225 + 270 * Math.min(Math.max(v, 0), D.max) / D.max;
  function arcPath(v0, v1, r) {
    const [x0, y0] = pt(ang(v0), r), [x1, y1] = pt(ang(v1), r);
    return `M${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 ${ang(v1) - ang(v0) > 180 ? 1 : 0} 1 ${x1.toFixed(2)},${y1.toFixed(2)}`;
  }
  function el(tag, attrs, parent) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent && parent.appendChild(e); return e; }

  function dialInto(svg, opts) {
    svg.innerHTML = '';
    const acc = ACC();
    const defs = el('defs', {}, svg);
    const lg = el('linearGradient', { id: svg.id + '-g', x1: 0, y1: 1, x2: 1, y2: 0 }, defs);
    el('stop', { offset: 0, 'stop-color': acc, 'stop-opacity': .45 }, lg);
    el('stop', { offset: 1, 'stop-color': acc }, lg);
    const f = el('filter', { id: svg.id + '-f', x: '-30%', y: '-30%', width: '160%', height: '160%' }, defs);
    el('feGaussianBlur', { stdDeviation: 8 }, f);
    el('circle', { cx: D.C, cy: D.C, r: D.R + 22, fill: 'none', stroke: 'rgba(255,255,255,.035)' }, svg);
    el('path', { d: arcPath(0, D.max, D.R), fill: 'none', stroke: 'rgba(255,255,255,.06)', 'stroke-width': 12, 'stroke-linecap': 'round' }, svg);
    const step = D.max > 200 ? 5 : 2.5, major = D.max > 200 ? 60 : 30;
    for (let v = 0; v <= D.max + .01; v += step) {
      const isMajor = v % major === 0 && v < D.hz - 8, mid = v % 10 === 0;
      const [x0, y0] = pt(ang(v), D.R - 18), [x1, y1] = pt(ang(v), D.R - (isMajor ? 30 : mid ? 25 : 22));
      el('line', { x1: x0, y1: y0, x2: x1, y2: y1, stroke: isMajor ? '#565D67' : mid ? '#30353D' : '#1F2329', 'stroke-width': isMajor ? 1.5 : 1, class: 'tk' }, svg);
      if (isMajor && opts.labels !== false) { const [tx, ty] = pt(ang(v), D.R - 44); el('text', { x: tx, y: ty + 3.5, 'text-anchor': 'middle', 'font-family': 'Geist Mono', 'font-size': 10, fill: '#7C838D' }, svg).textContent = v; }
    }
    const [h0x, h0y] = pt(ang(D.hz), D.R - 12), [h1x, h1y] = pt(ang(D.hz), D.R + 12);
    el('line', { x1: h0x, y1: h0y, x2: h1x, y2: h1y, stroke: '#ECEEF1', 'stroke-width': 2, 'stroke-linecap': 'round' }, svg);
    if (opts.labels !== false) { const [lx, ly] = pt(ang(D.hz), D.R + 22); el('text', { x: lx + 2, y: ly + 4, 'font-family': 'Geist Mono', 'font-size': 10, fill: '#A2A9B3' }, svg).textContent = `${D.hz} Hz`; }
    return svg;
  }

  function drawDialTicks() {
    D.hz = S.hw.hz || 144;
    D.max = Math.max(165, Math.ceil((D.hz + 20) / 15) * 15);
    const svg = dialInto($('dial-svg'), {});
    const acc = ACC();
    dial.glow = el('path', { d: '', fill: 'none', stroke: acc, 'stroke-width': 30, 'stroke-linecap': 'round', opacity: .12 }, svg);
    dial.glow2 = el('path', { d: '', fill: 'none', stroke: acc, 'stroke-width': 20, 'stroke-linecap': 'round', opacity: .16 }, svg);
    dial.arc = el('path', { d: '', fill: 'none', stroke: 'url(#dial-svg-g)', 'stroke-width': 12, 'stroke-linecap': 'round' }, svg);
    dial.tip = el('circle', { r: 4, fill: '#08090B', cx: -99, cy: -99 }, svg);
    dial.ghostLine = el('line', { stroke: acc, 'stroke-width': 2.2, 'stroke-linecap': 'round', opacity: 0 }, svg);
    dial.ghostText = el('text', { 'font-family': 'Geist Mono', 'font-size': 9.5, fill: acc, 'text-anchor': 'end', opacity: 0 }, svg);
    dial.needle = el('line', { x1: D.C, y1: D.C + 50, x2: D.C, y2: D.C - 104, stroke: '#ECEEF1', 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0 }, svg);
    dial.pivot = el('circle', { cx: D.C, cy: D.C + 50, r: 6, fill: '#ECEEF1', opacity: 0 }, svg);
    dial.shown = 0;
    setGhost(dial.ghost);
    kick();
  }

  function setGhost(v) {
    dial.ghost = v || 0;
    if (!dial.ghostLine) return;
    if (!v) { dial.ghostLine.setAttribute('opacity', 0); dial.ghostText.setAttribute('opacity', 0); return; }
    const live = S.st.state === 'live';
    const [x0, y0] = pt(ang(v), D.R - 9), [x1, y1] = pt(ang(v), D.R + 9), [tx, ty] = pt(ang(v), D.R + 22);
    Object.entries({ x1: x0, y1: y0, x2: x1, y2: y1, opacity: live ? .45 : .95 }).forEach(([k, val]) => dial.ghostLine.setAttribute(k, val));
    dial.ghostText.setAttribute('x', tx - 4); dial.ghostText.setAttribute('y', ty);
    dial.ghostText.setAttribute('opacity', 1);
    dial.ghostText.setAttribute('fill', live ? '#8B929C' : ACC());
    dial.ghostText.textContent = (live ? 'before ' : 'last ') + Math.round(v);
  }

  function kick() { if (!dial.raf) dial.raf = requestAnimationFrame(frame); }
  function frame(t) {
    dial.raf = 0;
    if (t - (dial.last || 0) < 31) { kick(); return; }
    dial.last = t;
    const st = S.st.state;
    const target = st === 'live' ? dial.target : 0;
    const k = body.dataset.motion === 'off' ? 1 : 0.28;
    dial.shown += (target - dial.shown) * k;
    if (Math.abs(target - dial.shown) < 0.05) dial.shown = target;
    if (dial.arc) {
      if (dial.shown > 0.3) {
        const d = arcPath(0, dial.shown, D.R);
        dial.arc.setAttribute('d', d); dial.glow.setAttribute('d', d); dial.glow2.setAttribute('d', d);
        const [nx, ny] = pt(ang(dial.shown), D.R);
        dial.tip.setAttribute('cx', nx); dial.tip.setAttribute('cy', ny);
      } else { dial.arc.setAttribute('d', ''); dial.glow.setAttribute('d', ''); dial.glow2.setAttribute('d', ''); dial.tip.setAttribute('cx', -99); }
      // waiting: a metronome needle keeps time while you open the game
      const waiting = st === 'waiting';
      dial.needle.setAttribute('opacity', waiting ? 1 : 0);
      dial.pivot.setAttribute('opacity', waiting ? 1 : 0);
      if (waiting) {
        const a = body.dataset.motion === 'off' ? 0 : Math.sin(t / 1000 * Math.PI) * 32;
        dial.needle.setAttribute('transform', `rotate(${a.toFixed(2)} ${D.C} ${D.C + 50})`);
      }
    }
    if (st === 'waiting' || dial.shown !== target) kick();
  }

  function drawLookDial() {
    const svg = $('look-dial');
    if (!svg) return;
    dialInto(svg, { labels: false });
    const last = sessionsOf(S.settings.selectedGame)[0];
    if (last) {
      const [x0, y0] = pt(ang(last.avgFps), D.R - 9), [x1, y1] = pt(ang(last.avgFps), D.R + 9);
      el('line', { x1: x0, y1: y0, x2: x1, y2: y1, stroke: ACC(), 'stroke-width': 2.2, 'stroke-linecap': 'round' }, svg);
    }
  }

  // ------------------------------------------------------------------ the moments: on, live, off, saved
  const still = () => body.dataset.motion === 'off' || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)', SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)';
  function ringAt(cls, ms) {
    const r = document.createElement('i');
    r.className = 'ring ' + cls;
    $('dial').appendChild(r);
    setTimeout(() => r.remove(), ms);
  }
  // Turning on: a light runs once round the dial, the ticks catch it one by one, and a ring goes out from the button
  function ignite() {
    if (still() || S.page !== 'play') return;
    const svg = $('dial-svg');
    const d = arcPath(0, D.max, D.R);
    const glow = el('path', { d, fill: 'none', stroke: ACC(), 'stroke-width': 30, 'stroke-linecap': 'round', opacity: .22 }, svg);
    const beam = el('path', { d, fill: 'none', stroke: ACC(), 'stroke-width': 12, 'stroke-linecap': 'round' }, svg);
    const len = beam.getTotalLength(), head = len * 0.16;
    for (const p of [glow, beam]) {
      p.style.strokeDasharray = `${head} ${len * 2}`;
      p.animate([{ strokeDashoffset: head, opacity: p === beam ? 1 : .22 }, { strokeDashoffset: -len * 0.92, opacity: p === beam ? .9 : .2, offset: .82 }, { strokeDashoffset: -len, opacity: 0 }],
        { duration: 1000, easing: 'cubic-bezier(.45,.05,.2,1)' }).onfinish = () => p.remove();
    }
    const ticks = [...svg.querySelectorAll('.tk')];
    ticks.forEach((t, i) => t.animate([{ stroke: t.getAttribute('stroke') }, { stroke: ACC(), offset: .25 }, { stroke: t.getAttribute('stroke') }],
      { duration: 520, delay: 60 + i / ticks.length * 760, easing: 'ease-out' }));
    ringAt('out', 900);
    document.querySelector('.mark-needle')?.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(-62deg)' }, { transform: 'rotate(0)' }], { duration: 700, easing: EASE });
  }
  // The game arrived: the reading blooms in
  function arrive() {
    if (still()) return;
    $('read-live').animate([{ opacity: 0, transform: 'scale(.82)', filter: 'blur(8px)' }, { opacity: 1, transform: 'scale(1)', filter: 'blur(0)' }], { duration: 520, easing: EASE });
    ringAt('out soft', 900);
  }
  // Turning off: a ring settles back into the button, which pops back in
  function windDown() {
    if (still() || S.page !== 'play') return;
    ringAt('in', 700);
    $('power').animate([{ transform: 'scale(.7)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 560, easing: SPRING });
    const ticks = [...$('dial-svg').querySelectorAll('.tk')].reverse();
    ticks.forEach((t, i) => t.animate([{ opacity: 1 }, { opacity: .15, offset: .3 }, { opacity: 1 }], { duration: 420, delay: i / ticks.length * 380, easing: 'ease-out' }));
  }
  // count a number up into an element
  function countUp(elm, to, ms = 900, dec = 0) {
    if (!elm) return;
    if (still() || !isFinite(to)) { elm.textContent = fmt(to, dec); return; }
    const t0 = performance.now();
    const step = t => { const k = Math.min(1, (t - t0) / ms), e = 1 - (1 - k) ** 3; elm.textContent = fmt(to * e, dec); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  // A session was saved: a small receipt rises under the dial with the numbers counting up
  function receipt(s) {
    const box = $('receipt');
    if (!box || !s) return;
    clearTimeout(receipt.t);
    box.innerHTML = `<div class="rc-top"><span class="rc-k">SESSION SAVED</span><span class="rc-g">${esc(s.gameName)} · ${dur(s.seconds)}</span><button type="button" class="rc-x" aria-label="Close">&#10005;</button></div>
      <div class="rc-nums"><div><b id="rc-a">0</b><small>FPS AVERAGE</small></div><div><b id="rc-l">0</b><small>1% LOW</small></div><div><b id="rc-h">0</b><small>STUTTERS</small></div></div>
      <button type="button" class="rc-go" data-see="${esc(s.gameId)}|${esc(s.id)}">See what held it back &rarr;</button>`;
    box.hidden = false;
    if (!still()) box.animate([{ opacity: 0, transform: 'translateY(14px) scale(.98)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: EASE });
    countUp($('rc-a'), s.avgFps); countUp($('rc-l'), s.low1, 1000); countUp($('rc-h'), s.hitches ?? 0, 700);
    receipt.t = setTimeout(() => { box.hidden = true; }, 14000);
  }
  // after an update: what's new, once, in the same card as the session receipt
  function whatsNew(version) {
    const box = $('receipt');
    if (!box) return;
    box.innerHTML = `<div class="rc-top"><span class="rc-k">NEW IN ${esc(String(version).split('.').slice(0, 2).join('.'))}</span><span class="rc-g">TEMPO updated</span><button type="button" class="rc-x" aria-label="Close">&#10005;</button></div>
      <ul class="rc-new"><li><b>Apps step back by themselves.</b> No more picking each one; tap any app on the Boost page to decide yourself.</li>
      <li><b>Calls, music and anything your game needs are kept</b>, from Discord to Lossless Scaling and Steam.</li>
      <li><b>Steam launch options explained</b> on the Tune page, and TEMPO stays on if the game restarts.</li></ul>
      <button type="button" class="rc-go" data-go-page="boost">See the Boost page &rarr;</button>`;
    box.hidden = false;
    if (!still()) box.animate([{ opacity: 0, transform: 'translateY(14px) scale(.98)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: EASE });
  }
  document.addEventListener('click', e => {
    if (e.target.closest('[data-go-page="boost"]') && e.target.closest('#receipt')) $('receipt').hidden = true;
    if (e.target.closest('.rc-x')) { $('receipt').hidden = true; return; }
    const see = e.target.closest('[data-see]');
    if (see) { const [gid, id] = see.dataset.see.split('|'); S.sessSel = S.sessions.find(x => x.gameId === gid && x.id === id) || null; $('receipt').hidden = true; go('sessions'); }
  });

  // ------------------------------------------------------------------ pages
  function go(page) {
    S.page = page;
    body.dataset.page = page;
    document.querySelectorAll('.nav button').forEach(b => b.classList.toggle('on', b.dataset.go === page));
    for (const p of ['play', 'boost', 'tune', 'sessions', 'checkup', 'overlay', 'look']) $('page-' + p).hidden = p !== page;
    if (page === 'checkup') { renderCheckup(); send({ t: 'checkup' }); }
    if (page === 'tune') { renderTune(); requestTune(); }
    if (page === 'overlay') send({ t: 'phoneState' });
    movePill();
    if (page === 'boost') { renderBoost(); send({ t: 'apps' }); }
    if (page === 'sessions') renderSessions();
    if (page === 'overlay') renderOverlayPage();
    if (page === 'look') renderLook();
    if (page === 'play') { renderPlay(); drawStrip(); } // redraw charts in the current colours
  }
  $('nav').addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) go(b.dataset.go); });
  function movePill() {
    const b = document.querySelector('.nav button.on'), pill = $('nav-pill');
    if (!b || !pill) return;
    pill.style.width = b.offsetWidth + 'px';
    pill.style.transform = `translateX(${b.offsetLeft}px)`;
  }
  addEventListener('resize', movePill);
  if (document.fonts) document.fonts.ready.then(movePill);
  document.querySelectorAll('[data-win]').forEach(b => b.addEventListener('click', () => send({ t: b.dataset.win })));
  document.addEventListener('click', e => { const o = e.target.closest('[data-open]'); if (o) send({ t: 'open', url: o.dataset.open }); });

  // ------------------------------------------------------------------ games
  function artStyle(g, kind) { const u = g && g.art && (g.art[kind] || (kind === 'header' && g.art.capsule)); return u ? `background-image:url('${u}')` : ''; }
  function renderGames() {
    const list = $('games');
    const id = S.settings.selectedGame;
    $('games-count').textContent = S.games.length ? `${S.games.length} found` : '';
    list.innerHTML = S.games.map(g => {
      const n = sessionsOf(g.id).length;
      const status = n ? `${n} session${n === 1 ? '' : 's'}` : g.source === 'custom' ? 'Added by you' : 'Not measured yet';
      const art = g.art.header || g.art.capsule
        ? `<span class="art" style="${artStyle(g, 'header')}"></span>`
        : `<span class="art">${g.art.icon ? `<img src="${g.art.icon}" alt="">` : ''}</span>`;
      return `<button type="button" class="g${g.id === id ? ' sel' : ''}" data-game="${esc(g.id)}">${art}<span><span class="nm">${esc(g.name)}</span><span class="st">${status}</span></span><span class="hide" data-hide="${esc(g.id)}" title="Hide from this list">&#10005;</span></button>`;
    }).join('') + `<button type="button" class="g${id === 'any' || !id ? ' sel' : ''}" data-game="any"><span class="art" style="display:grid;place-items:center;color:var(--muted);font-size:18px">&#9675;</span><span><span class="nm">Any game</span><span class="st">TEMPO picks the game in front</span></span></button>`;
  }
  $('games').addEventListener('click', e => {
    const h = e.target.closest('[data-hide]');
    if (h) { e.stopPropagation(); send({ t: 'hideGame', game: h.dataset.hide }); return; }
    const b = e.target.closest('[data-game]');
    if (!b || S.st.state !== 'off') return;
    S.settings.selectedGame = b.dataset.game;
    send({ t: 'select', game: b.dataset.game });
    renderPlay();
  });
  $('add-game').addEventListener('click', () => send({ t: 'addGame' }));

  // ------------------------------------------------------------------ play
  const MODES = [
    [/Legacy/i, 'Old-style exclusive fullscreen', 'Windows lets nothing sit on top in this mode, so the overlay can\'t show. Your fps is still measured. The game\'s borderless option (or its other fullscreen setting) lets the overlay through.'],
    [/Independent Flip/i, 'Fullscreen, on Windows\' fast path', 'As fast as exclusive fullscreen, and the overlay can show on top.'],
    [/Composed/i, 'Windowed or borderless', 'Windows draws the game through its compositor. The overlay shows on top.'],
  ];
  const modeOf = m => MODES.find(([re]) => re.test(m || ''));

  function renderPlay() {
    const st = S.st.state;
    body.dataset.state = st;
    const g = st === 'off' ? sel() : gameOf(S.st.game) || null;
    // hero art and title
    const hero = g && (g.art.hero || g.art.header);
    $('hero').style.backgroundImage = hero ? `url('${hero}')` : '';
    const name = st !== 'off' && S.st.gameName ? S.st.gameName : g ? g.name : 'Any game';
    $('title-row').innerHTML = g && g.art.logo && st !== 'live'
      ? `<img src="${g.art.logo}" alt="${esc(name)}">`
      : `<span class="tn">${esc(name)}</span>${st === 'live' && S.st.since ? `<span class="since" id="since"></span>` : ''}`;
    // dial
    $('read-off').hidden = st !== 'off';
    $('read-wait').hidden = st !== 'waiting';
    $('read-live').hidden = st !== 'live';
    $('wait-sub').textContent = g ? `OPEN ${g.name.toUpperCase().slice(0, 28)}` : 'OPEN ANY GAME';
    $('wait-t').textContent = st === 'waiting' && S.st.graceUntil ? 'GAME CLOSED' : 'WAITING';
    tickGrace();
    $('stop').hidden = st === 'off';
    $('stop').textContent = st === 'live' ? 'Turn off and save this session' : 'Turn off';
    const last = g && sessionsOf(g.id)[0];
    setGhost(st === 'live' ? (last && last.avgFps) : st === 'off' ? (last && last.avgFps) : 0);
    // chips
    const auto = S.settings.autoOff !== false;
    const ovs = { minimal: 'Minimal', detailed: 'Detailed', bar: 'Bar' }[S.settings.overlayStyle] || 'Minimal';
    const bc = boostCount();
    $('chips').innerHTML = (st === 'off'
      ? `<button type="button" class="chip" data-go-page="boost"><span class="d"></span>${bc ? `Boost · ${bc} change${bc === 1 ? '' : 's'}` : 'Boost off'}</button>`
      : '') +
      `<button type="button" class="chip${auto ? '' : ' offc'}" id="chip-auto"><span class="ck">${auto ? '&#10003;' : '&#9675;'}</span>Turns off with the game</button>` +
      `<button type="button" class="chip" data-go-page="overlay">Overlay · ${S.settings.overlay === false ? 'off' : ovs}</button>`;
    $('left-off').hidden = st !== 'off';
    $('left-on').hidden = st === 'off';
    $('learn').hidden = st !== 'off' || !boostCount();
    $('play').hidden = st !== 'off' || !(g && g.canLaunch);
    if (g && g.canLaunch) $('play').innerHTML = `<svg width="10" height="12" viewBox="0 0 10 12" aria-hidden="true"><path d="M0 0L10 6L0 12Z" fill="currentColor"/></svg>Turn on and open ${esc(g.name)}`;
    const stepped = S.st.stepped || [];
    const applied = (S.st.applied || []).filter(a => !/ stepped back$/.test(a)).concat(stepped.length ? [`Apps stepped back · ${stepped.slice(0, 4).join(', ')}${stepped.length > 4 ? ` +${stepped.length - 4}` : ''}`] : (S.st.applied || []).filter(a => / stepped back$/.test(a)));
    $('applied-lab').textContent = S.st.learn ? 'Measuring only' : applied.length ? `Boost on · ${applied.length}` : 'Boost on';
    $('applied').innerHTML = S.st.learn
      ? `<div class="ch dim"><div class="t">No changes this time<span>A clean baseline, so the boost can be measured against it.</span></div></div>`
      : applied.length ? applied.map(a => `<div class="ch"><div class="t">${esc(a)}</div><span class="ok">&#10003;</span></div>`).join('')
        : `<div class="ch dim"><div class="t">Nothing needed changing<span>Everything the boost does was already set up on this PC.</span></div></div>`;
    $('applied-note').hidden = !!S.st.learn;
    if (S.st.experiment && st !== 'off') $('applied').insertAdjacentHTML('afterbegin', `<div class="ch test"><div class="t">Test: ${esc(S.st.experiment.label)}<span>This session plays ${S.st.variant === 'b' ? `<b>with the change</b> (${esc(S.st.experiment.bLabel)})` : `<b>as before</b> (${esc(S.st.experiment.aLabel)})`}. TEMPO swaps for the next one.</span></div><span class="ok">&#9679;</span></div>`);
    $('ov-line').textContent = S.settings.overlay === false ? 'Off (Ctrl Alt O)' : `${ovs}, ${{ tl: 'top left', tr: 'top right', bc: 'bottom', bl: 'bottom left', br: 'bottom right' }[S.settings.overlayCorner] || 'top left'}`;
    $('right-off').hidden = st !== 'off';
    $('right-on').hidden = st === 'off';
    $('strip').hidden = st !== 'live';
    $('status').hidden = st === 'off';
    $('status-text').textContent = st === 'live' ? `On · ${name}` : 'On · waiting';
    if (st === 'off') renderLastSession(g);
    if (st !== 'live') { $('mode-note').hidden = true; $('holder').hidden = true; }
    if (st === 'waiting') { $('meters').innerHTML = ''; $('bg-apps').innerHTML = '<p class="note">Open the game. TEMPO starts measuring the moment it draws its first frames.</p>'; }
    renderGames();
    kick();
  }
  document.addEventListener('click', e => {
    if (e.target.closest('#chip-auto')) { S.settings.autoOff = !(S.settings.autoOff !== false); send({ t: 'set', key: 'autoOff', value: S.settings.autoOff }); renderPlay(); syncControls(); }
    const p = e.target.closest('[data-go-page]');
    if (p) go(p.dataset.goPage);
  });
  $('power').addEventListener('click', () => send({ t: 'on', game: S.settings.selectedGame || 'any' }));
  $('learn').addEventListener('click', () => send({ t: 'on', game: S.settings.selectedGame || 'any', learn: true }));
  $('play').addEventListener('click', () => send({ t: 'on', game: S.settings.selectedGame || 'any', launch: true }));
  $('update').addEventListener('click', () => send({ t: 'open', url: $('update').dataset.url }));
  $('stop').addEventListener('click', () => send({ t: 'off' }));

  function blockedText(g) {
    const name = g ? esc(g.name) : 'This game';
    const fix = g && g.forcesFullscreen
      ? `Your Steam launch options for ${name} include <b>-fullscreen</b>, which forces it. Remove it (Steam, right-click ${name}, Properties, Launch options) and the game uses its own borderless setting.`
      : `Switch the game's display mode to borderless (sometimes called fullscreen windowed) and the counter shows.`;
    return `<b>The counter is hidden by exclusive fullscreen.</b> ${name} draws straight to the screen, so Windows shows nothing on top of it. Your fps is still measured. ${fix} TEMPO will measure whether borderless costs you anything.`;
  }

  function limiterText(kind, share) {
    const pct = Math.round(share * 100);
    if (kind === 'cpu') return ['PROCESSOR', `Your graphics card waits for it on ${pct}% of frames, so lower graphics settings won't help much.`];
    if (kind === 'gpu') return ['GRAPHICS CARD', `It's flat out on ${pct}% of frames. A lower resolution or lighter settings would help.`];
    if (kind === 'cap') return ['FPS LIMIT', `${pct}% of frames wait for a limit (an fps cap or V-Sync), so neither part is maxed out.`];
    return ['', ''];
  }

  function lbar(s) {
    const parts = [['Processor', s.cpuLimited, 'var(--acc)'], ['Graphics card', s.gpuLimited, '#59606A'], ['FPS limit', s.capped, '#3D434B']];
    const top = parts.slice().sort((a, b) => b[1] - a[1])[0];
    parts.forEach(p => { if (p !== top) p[2] = p[0] === 'FPS limit' ? '#2A2F36' : '#3D434B'; else p[2] = 'var(--acc)'; });
    return `<div class="lbar">${parts.filter(p => p[1] > 0.005).map(p => `<i style="flex:${p[1]};background:${p[2]}"></i>`).join('')}</div>
      <div class="leg">${parts.map(p => `<span>${p === top ? `<b>${p[0]}</b>` : p[0]} ${Math.round(p[1] * 100)}%</span>`).join('')}</div>`;
  }

  function tips(s) {
    const out = [];
    if (s.overlayBlocked) out.push(blockedText(gameOf(s.gameId)));
    const prot = new Set((S.settings.protectedApps || []).map(x => x.toLowerCase()));
    const shell = new Set(['explorer.exe', 'searchhost.exe', 'shellexperiencehost.exe', 'startmenuexperiencehost.exe']);
    const movable = (s.background || []).filter(b => !prot.has(b.name.toLowerCase()) && !shell.has(b.name.toLowerCase()));
    if (s.cpuLimited > 0.5 && s.backgroundCpu >= 4 && s.background.length)
      out.push(`<b>Other apps</b> used ${fmt(s.backgroundCpu)}% of your processor. TEMPO never closes anything: with the boost on, ${movable.length ? `apps like ${movable.slice(0, 2).map(b => esc(b.label || b.name.replace(/\.exe$/i, ''))).join(' and ')} step back for the game while you play` : 'background apps step back while you play'}, and music and voice apps (Discord, Spotify) are left exactly as they are.`);
    const ramAvg = s.avgRamFreeGb || 0;
    if ((s.minRamFreeGb > 0 && s.minRamFreeGb < 1.2) || (ramAvg > 0 && ramAvg < 2.5))
      out.push(`<b>Memory got tight:</b> ${ramAvg ? `${fmt(ramAvg, 1)} GB free on average, ` : ''}${fmt(s.minRamFreeGb, 1)} GB at the lowest. Windows starts swapping to disk around there, which causes stutters; browser tabs are usually the biggest users.`);
    if (s.maxGpuTemp >= 83) out.push(`<b>Your graphics card got hot:</b> ${fmt(s.maxGpuTemp)} °C at the peak. Most cards slow themselves down above about 83 °C. Dust in the fans or a slow fan curve are the usual reasons.`);
    if (s.gpuLimited > 0.5) out.push(`<b>Graphics card bound:</b> a lower resolution, FSR or lighter settings would raise your fps.`);
    if (s.cpuLimited > 0.5 && s.gpuLimited < 0.3) out.push(`<b>Processor bound:</b> lowering graphics settings won't help much; fewer background apps and the game's CPU-heavy settings (view distance, physics, effects) will.`);
    if (s.capped > 0.5) out.push(`<b>Held by a limit:</b> an fps cap or V-Sync is doing its job. Raise or remove it if you want more.`);
    return out;
  }

  function renderLastSession(g) {
    const box = $('right-off');
    const list = g ? sessionsOf(g.id) : S.sessions;
    const s = list[0];
    if (!s) {
      box.innerHTML = `<div class="lab">Last session</div><div class="empty"><b>Nothing measured yet</b>Turn TEMPO on and play a normal session. You'll get your real average, the dips you feel, and what holds your fps back on this PC.</div>`;
      return;
    }
    const prev = list[1];
    const delta = prev ? Math.round(s.avgFps - prev.avgFps) : null;
    box.innerHTML = `
      <div class="lab">Last session <b>${when(s.started)} · ${dur(s.seconds)}</b></div>
      <div class="avg"><span class="n">${fmt(s.avgFps)}</span><span class="u">FPS AVERAGE</span>${delta != null ? `<span class="delta${delta < 0 ? ' neg' : ''}">${delta >= 0 ? '+' : ''}${delta} vs before</span>` : ''}</div>
      <div class="trio"><div><div class="k">1% LOW</div><div class="v">${fmt(s.low1)}</div></div><div><div class="k">0.1% LOW</div><div class="v">${fmt(s.low01)}</div></div><div><div class="k">STUTTERS</div><div class="v">${s.hitches != null ? s.hitches : '–'}${s.hitches != null ? `<small>${fmt(s.hitchesPerMin, 1)}/min</small>` : ''}</div></div></div>
      <canvas class="chart" id="last-chart"></canvas>
      <div class="axis"><span>0</span><span>${dur(s.seconds / 2)}</span><span>${dur(s.seconds)}</span></div>
      <div class="lab" style="margin-bottom:0">What held you back</div>
      ${lbar(s)}
      ${compareHtml(g && g.id)}
      ${tips(s).slice(0, 2).map(t => `<p class="facts" style="margin-bottom:8px">${t}</p>`).join('')}`;
    drawSeries($('last-chart'), s.series, prev && prev.series, s);
  }

  // boosted sessions against plain ones for the same game, weighted by how long each was played
  function compare(gameId) {
    const list = gameId ? sessionsOf(gameId) : [];
    const boosted = list.filter(s => !s.learn && s.changes && s.changes.length);
    const base = list.filter(s => !s.changes || !s.changes.length);
    if (!boosted.length || !base.length) return null;
    const w = (arr, k) => arr.reduce((a, s) => a + s[k] * s.seconds, 0) / Math.max(1, arr.reduce((a, s) => a + s.seconds, 0));
    return { n1: boosted.length, n0: base.length, fps: w(boosted, 'avgFps') - w(base, 'avgFps'), low: w(boosted, 'low1') - w(base, 'low1') };
  }
  function compareHtml(gameId) {
    const c = compare(gameId);
    if (!c) return '';
    const sign = v => (v >= 0 ? '+' : '') + v.toFixed(1);
    return `<div class="cmp"><div class="lab" style="margin:0 0 6px">Boost against no boost</div>
      <div class="cmp-row"><span><b>${sign(c.fps)}</b> fps average</span><span><b>${sign(c.low)}</b> at the 1% lows</span></div>
      <p class="note" style="margin-top:6px">${c.n1} boosted and ${c.n0} plain session${c.n0 === 1 ? '' : 's'}. Matches differ, so this gets more reliable the more you play.</p></div>`;
  }

  // Fullscreen fast path against windowed or borderless, from the user's own sessions of this game
  function modeCompareHtml(gameId) {
    const list = sessionsOf(gameId);
    const fast = list.filter(s => /^Hardware: /.test(s.presentMode || '')), comp = list.filter(s => /Composed/.test(s.presentMode || ''));
    if (!fast.length || !comp.length) return '';
    const w = (arr, k) => arr.reduce((a, s) => a + s[k] * s.seconds, 0) / Math.max(1, arr.reduce((a, s) => a + s.seconds, 0));
    const d = w(comp, 'avgFps') - w(fast, 'avgFps'), dl = w(comp, 'low1') - w(fast, 'low1');
    const sign = v => (v >= 0 ? '+' : '') + v.toFixed(1);
    return `<div class="cmp"><div class="lab" style="margin:0 0 6px">Borderless against fullscreen</div>
      <div class="cmp-row"><span><b>${sign(d)}</b> fps average</span><span><b>${sign(dl)}</b> at the 1% lows</span></div>
      <p class="note" style="margin-top:6px">${comp.length} windowed or borderless and ${fast.length} fullscreen session${fast.length === 1 ? '' : 's'}. Near zero means borderless costs you nothing, and the fps counter can sit on top.</p></div>`;
  }

  function drawSeries(c, series, before, sess) {
    if (!c || !series || series.length < 2) return;
    const low = sess && sess.seriesLow && sess.seriesLow.length === series.length ? sess.seriesLow : null;
    const dpr = window.devicePixelRatio || 1, w = c.clientWidth, h = c.clientHeight;
    c.width = w * dpr; c.height = h * dpr;
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    const all = series.concat(before || []).concat(low || []);
    const lo = Math.max(0, Math.min(...all) * 0.85), hi = Math.max(...all) * 1.08;
    const y = v => h - 3 - (v - lo) / (hi - lo || 1) * (h - 8);
    const line = (arr, color, width, dash, fill) => {
      g.beginPath();
      arr.forEach((v, i) => { const x = i / (arr.length - 1) * w; i ? g.lineTo(x, y(v)) : g.moveTo(x, y(v)); });
      g.setLineDash(dash || []);
      g.strokeStyle = color; g.lineWidth = width; g.lineJoin = 'round'; g.stroke();
      if (fill) { g.lineTo(w, h); g.lineTo(0, h); g.closePath(); g.fillStyle = fill; g.fill(); }
    };
    const rgb = getComputedStyle(document.documentElement).getPropertyValue('--acc-rgb');
    if (before && before.length > 1) line(before, '#3A4048', 1.3, [3, 2]);
    if (low) line(low, `rgba(${rgb}, .32)`, 1, null);
    line(series, ACC(), 1.6, null, `rgba(${rgb}, .08)`);
    // the worst stutters, as small marks along the bottom
    if (sess && sess.worstHitches && sess.seconds) {
      g.setLineDash([]);
      g.fillStyle = '#FFB547';
      for (const ht of sess.worstHitches) {
        const x = Math.min(w - 2, Math.max(2, ht.t / sess.seconds * w));
        g.beginPath(); g.moveTo(x, h - 0); g.lineTo(x - 3.5, h - 6); g.lineTo(x + 3.5, h - 6); g.closePath(); g.fill();
      }
    }
  }

  // ------------------------------------------------------------------ live
  let sinceTimer = 0;
  function onLive(l) {
    S.live = l;
    if (S.st.state !== 'live') { if (l.sys) $('self-cost').textContent = `${fmt(l.sys.tempo, 1)}% processor`; return; }
    dial.target = l.fps || 0;
    $('big').textContent = l.fps ? Math.round(l.fps) : '–';
    $('big-low').textContent = l.low1 ? Math.round(l.low1) : '–';
    kick();
    const s = l.sys;
    const sysKey = s ? JSON.stringify(s) : '';
    if (s && sysKey !== S.sysKey) { // system readings change once a second; skip rebuilding them in between
      S.sysKey = sysKey;
      $('self-cost').textContent = `${fmt(s.tempo, 1)}% processor`;
      const m = (label, val, pct, hot) => `<div class="meter"><div class="row"><span>${label}</span><b>${val}</b></div><div class="track"><i class="${hot ? 'a' : ''}" style="width:${Math.max(0, Math.min(100, pct))}%"></i></div></div>`;
      const vr = s.vramTotal ? s.vramUsed / s.vramTotal * 100 : 0;
      const ramUsed = s.ramTotal ? (1 - s.ramAvail / s.ramTotal) * 100 : 0;
      $('meters').innerHTML =
        m('Busiest processor core', `${fmt(s.cpuMax)}%`, s.cpuMax, l.limiter === 'cpu') +
        m('Processor overall', `${fmt(s.cpu)}%`, s.cpu, false) +
        (s.gpu != null ? m('Graphics card', `${fmt(s.gpu)}%`, s.gpu, l.limiter === 'gpu') : '') +
        (s.vramTotal ? m('Graphics memory', `${gb(s.vramUsed)} / ${gb(s.vramTotal)} GB`, vr, vr > 92) : '') +
        m('Memory free', `${gb(s.ramAvail)} GB`, ramUsed, s.ramAvail < 2.2 * 1073741824) +
        (s.temp != null ? m('Graphics card heat', `${fmt(s.temp)} °C`, (s.temp - 30) / 60 * 100, s.temp > 83) : '');
      $('bg-apps').innerHTML = s.top && s.top.length
        ? `<div class="lab" style="margin:4px 0 6px">Also using your processor</div>` + s.top.slice(0, 4).map(p => {
            const nm = p.label || p.name.replace(/\.exe$/i, ''), kept = (S.settings.protectedApps || []).some(x => x.toLowerCase() === p.name.toLowerCase());
            const down = !kept && (S.st.stepped || []).some(x => x.toLowerCase() === nm.toLowerCase());
            return `<div class="row${kept ? ' kept' : down ? ' down' : ''}"><span>${esc(nm)}</span><b>${fmt(p.cpu, 1)}%</b></div>`;
          }).join('')
        : '';
    }
    if (l.limiter) {
      const [v, p] = limiterText(l.limiter, l.share);
      $('holder').hidden = false;
      $('holder-v').textContent = v;
      $('holder-p').textContent = p;
    }
    const mo = modeOf(l.mode);
    $('mode-note').hidden = !mo && l.overlay !== 'blocked';
    if (l.overlay === 'blocked') $('mode-note').innerHTML = blockedText(gameOf(S.st.game));
    else if (mo) $('mode-note').innerHTML = `<b>${mo[1]}.</b> ${mo[2]}`;
    if (l.overlay === 'blocked' && !S.blockedTold) { S.blockedTold = true; toast('The game\'s exclusive fullscreen is hiding the fps counter. Your fps is still measured.'); }
    $('strip-now').textContent = l.frameMs ? `${fmt(1000 / Math.max(l.fps, 1), 1)} ms now` : '';
    drawStrip();
  }

  function drawStrip() {
    const c = $('strip-canvas');
    if (!c || $('strip').hidden || !S.live || !S.live.recent) return;
    const fr = S.live.recent;
    const dpr = window.devicePixelRatio || 1, w = c.clientWidth, h = c.clientHeight;
    if (!w) return;
    if (c.width !== w * dpr) { c.width = w * dpr; c.height = h * dpr; }
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const p99 = fr.slice().sort((a, b) => b - a)[Math.floor(fr.length * 0.01)] || 0;
    const hi = Math.max(34, p99 * 1.25, Math.max(...fr) * 1.05);
    const y = v => h - 2 - v / hi * (h - 6);
    const guide = (v, color, label) => {
      g.setLineDash([2, 3]); g.strokeStyle = color; g.lineWidth = 1;
      g.beginPath(); g.moveTo(0, y(v)); g.lineTo(w, y(v)); g.stroke(); g.setLineDash([]);
      g.fillStyle = color; g.font = '9px "Geist Mono"'; g.textAlign = 'right'; g.fillText(label, w, y(v) - 4);
    };
    guide(1000 / D.hz, 'rgba(236,238,241,.35)', `${D.hz} Hz · ${(1000 / D.hz).toFixed(1)} ms`);
    if (p99) guide(p99, 'rgba(255,181,71,.55)', `1% low · ${p99.toFixed(1)} ms`);
    const rgb = getComputedStyle(document.documentElement).getPropertyValue('--acc-rgb');
    g.beginPath();
    fr.forEach((v, i) => { const x = i / Math.max(1, fr.length - 1) * w; i ? g.lineTo(x, y(v)) : g.moveTo(x, y(v)); });
    g.strokeStyle = ACC(); g.lineWidth = 1.4; g.lineJoin = 'round'; g.stroke();
    g.lineTo(w, h); g.lineTo(0, h); g.closePath(); g.fillStyle = `rgba(${rgb}, .07)`; g.fill();
  }

  function tickSince() {
    const e = $('since');
    if (e && S.st.since) { const s = (Date.now() - new Date(S.st.since)) / 1000; e.textContent = `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')} in`; }
  }
  setInterval(tickSince, 1000);
  // after the game closes, TEMPO waits a moment in case it comes straight back (a launcher handing over, a restart)
  function tickGrace() {
    if (S.st.state !== 'waiting' || !S.st.graceUntil) return;
    const left = Math.max(0, Math.ceil((new Date(S.st.graceUntil) - Date.now()) / 1000));
    $('wait-sub').textContent = S.settings.autoOff !== false ? `TURNING OFF IN ${left} S` : 'WAITING FOR THE NEXT GAME';
  }
  setInterval(tickGrace, 500);

  // ------------------------------------------------------------------ sessions page
  function renderSessions() {
    const list = $('sess-list');
    if (!S.sessions.length) {
      list.innerHTML = `<div class="empty"><b>No sessions yet</b>They appear here after you play with TEMPO on.</div>`;
      $('sess-detail').innerHTML = '';
      return;
    }
    if (!S.sessSel || !S.sessions.find(s => s.id === S.sessSel.id && s.gameId === S.sessSel.gameId)) S.sessSel = S.sessions[0];
    list.innerHTML = S.sessions.map(s => {
      const g = gameOf(s.gameId);
      const on = S.sessSel && s.id === S.sessSel.id && s.gameId === S.sessSel.gameId;
      const boosted = s.changes && s.changes.length;
      const testTag = s.experimentId ? `<em class="tag t">TEST ${s.variant === 'b' ? 'B' : 'A'}</em>` : '';
      return `<button type="button" class="sess-item${on ? ' sel' : ''}" data-sid="${esc(s.gameId)}|${esc(s.id)}"><span class="art" style="${artStyle(g, 'header')}"></span><span><span class="nm">${esc(s.gameName)}<em class="tag${boosted ? ' b' : ''}">${boosted ? 'BOOST' : 'PLAIN'}</em>${testTag}</span><span class="st">${when(s.started)} · ${dur(s.seconds)}</span></span><span class="fps">${fmt(s.avgFps)}<small>FPS AVG</small></span></button>`;
    }).join('');
    renderSessionDetail(S.sessSel);
  }
  $('sess-list').addEventListener('click', e => {
    const b = e.target.closest('[data-sid]');
    if (!b) return;
    const [gid, id] = b.dataset.sid.split('|');
    S.sessSel = S.sessions.find(s => s.gameId === gid && s.id === id);
    renderSessions();
  });

  function renderSessionDetail(s) {
    const box = $('sess-detail');
    if (!s) { box.innerHTML = ''; return; }
    const same = S.sessions.filter(x => x.gameId === s.gameId);
    const prev = same[same.indexOf(s) + 1];
    const mo = modeOf(s.presentMode);
    box.innerHTML = `
      <button type="button" class="sd-del" id="sd-del">Delete</button>
      <div class="sd-head"><div class="h2">${esc(s.gameName.toUpperCase())}</div></div>
      <div class="sd-sub">${when(s.started)} · ${dur(s.seconds)} · ${Number(s.frames).toLocaleString()} frames measured</div>
      <div class="sd-grid">
        <div><div class="k">AVERAGE</div><div class="v">${fmt(s.avgFps)}<small>fps</small></div></div>
        <div><div class="k">1% LOW</div><div class="v">${fmt(s.low1)}<small>fps</small></div></div>
        <div><div class="k">0.1% LOW</div><div class="v">${fmt(s.low01)}<small>fps</small></div></div>
        <div><div class="k">STUTTERS</div><div class="v">${s.hitches != null ? s.hitches : '–'}<small>${s.hitches != null ? fmt(s.hitchesPerMin, 1) + '/min' : ''}</small></div></div>
      </div>
      <canvas class="sd-chart" id="sd-chart"></canvas>
      <div class="axis"><span>0</span><span>${dur(s.seconds / 2)}</span><span>${dur(s.seconds)}</span></div>
      <p class="facts" style="margin-bottom:12px">${s.seriesLow ? 'The faint line is the slowest moment of each stretch, the dips you feel.' : ''}${s.worstHitches && s.worstHitches.length ? ' Orange marks are the worst stutters.' : ''}${prev ? ` Dashed: the session before (${fmt(prev.avgFps)} fps average).` : ''}</p>
      ${s.hitchCauses && Object.keys(s.hitchCauses).length ? causesHtml(s) : s.worstHitches && s.worstHitches.length ? `<div class="lab" style="margin-bottom:6px">Worst stutters</div><div class="hitches">${s.worstHitches.map(h => `<span><b>${Math.round(h.ms)} ms</b> at ${Math.floor(h.t / 60)}:${String(Math.floor(h.t % 60)).padStart(2, '0')}</span>`).join('')}</div>` : ''}
      ${s.events && s.events.length ? `<div class="lab" style="margin:16px 0 6px">What TEMPO did</div>${s.events.map(ev => `<p class="facts">${esc(ev)}</p>`).join('')}` : ''}
      ${s.experimentId ? (() => { const ex = (S.settings.experiments || []).find(x => x.id === s.experimentId); return ex ? `<p class="facts" style="margin-top:10px"><b>Part of a test:</b> ${esc(ex.label)}, ${s.variant === 'b' ? 'with the change' : 'as before'}.</p>` : ''; })() : ''}
      <div class="lab" style="margin-bottom:0">What held you back</div>
      ${lbar(s)}
      <div class="sd-cols">
        <div>
          ${s.changes && s.changes.length ? `<div class="lab">The boost this session</div>${s.changes.map(c => `<p class="facts">&#10003; ${esc(c)}</p>`).join('')}<div style="height:16px"></div>` : `<div class="lab">The boost this session</div><p class="facts" style="margin-bottom:16px">Off. A plain session, useful as a baseline.</p>`}
          ${compareHtml(s.gameId)}
          ${modeCompareHtml(s.gameId)}
          <div class="lab">Worth knowing</div>
          ${tips(s).map(t => `<p class="facts" style="margin-bottom:9px">${t}</p>`).join('') || '<p class="facts">Nothing stood out. A clean session.</p>'}
          ${mo ? `<p class="facts" style="margin-top:6px"><b>${mo[1]}.</b> ${mo[2]}</p>` : ''}
        </div>
        <div>
          <div class="lab">The PC during it</div>
          <p class="facts">Graphics card <b>${fmt(s.avgGpu)}%</b> busy on average${s.maxGpuTemp ? `, up to <b>${fmt(s.maxGpuTemp)} °C</b>` : ''}<br>
          Busiest processor core <b>${fmt(s.avgCpuMaxCore)}%</b> on average<br>
          Memory free <b>${s.avgRamFreeGb ? fmt(s.avgRamFreeGb, 1) + ' GB' : '–'}</b> on average, <b>${fmt(s.minRamFreeGb, 1)} GB</b> at the lowest<br>
          Graphics memory <b>${fmt(s.avgVramGb, 1)} of ${fmt(s.vramTotalGb, 0)} GB</b><br>
          TEMPO itself <b>${fmt(s.tempoCpu, 1)}%</b> of your processor</p>
          ${s.background && s.background.length ? `<div class="lab" style="margin-top:16px">Other apps using the processor</div><div class="bg-apps" style="margin-top:0">` + s.background.map(b => `<div class="row${(S.settings.protectedApps || []).some(p => p.toLowerCase() === b.name.toLowerCase()) ? ' kept' : ''}"><span>${esc(b.label || b.name.replace(/\.exe$/i, ''))}</span><b>${fmt(b.cpu, 1)}%</b></div>`).join('') + '</div>' : ''}
        </div>
      </div>`;
    drawSeries($('sd-chart'), s.series, prev && prev.series, s);
    $('sd-del').addEventListener('click', () => {
      if ($('sd-del').dataset.armed) { send({ t: 'deleteSession', game: s.gameId, id: s.id }); return; }
      $('sd-del').dataset.armed = '1';
      $('sd-del').textContent = 'Delete this session?';
    });
  }

  // ------------------------------------------------------------------ settings controls
  function syncControls() {
    document.querySelectorAll('.tog[data-set]').forEach(t => t.classList.toggle('on', isOn(t.dataset.set)));
    document.querySelectorAll('.seg[data-set]').forEach(sg => sg.querySelectorAll('button').forEach(b => b.classList.toggle('on', (getSet(sg.dataset.set) ?? (sg.dataset.set === 'artStyle' ? 'tinted' : '')) === b.dataset.v)));
    document.querySelectorAll('input[type=range][data-set]').forEach(r => {
      const v = Math.round((S.settings[r.dataset.set] ?? 0) * (+r.dataset.scale || 1));
      r.value = v;
      paintRange(r);
    });
  }
  function paintRange(r) {
    const p = (r.value - r.min) / (r.max - r.min) * 100;
    r.style.setProperty('--p', p + '%');
    const out = r.parentElement.querySelector('output');
    if (out) out.textContent = r.dataset.set === 'overlaySize' ? `${(r.value / 100).toFixed(2).replace(/0$/, '')}×` : `${r.value}%`;
  }
  function set(key, value) {
    putSet(key, value);
    send({ t: 'set', key, value });
    if (['accent', 'background', 'artBehindDial', 'artStyle', 'grain', 'motion'].includes(key)) applyTheme();
    if (key.startsWith('boost') || key === 'protectedApps') renderBoost();
    syncControls();
    if (S.page === 'overlay') renderOverlaySample();
    if (S.page === 'look') renderLook();
    if (S.page === 'play') renderPlay();
  }
  document.addEventListener('click', e => {
    const t = e.target.closest('.tog[data-set]');
    if (t) { const k = t.dataset.set; set(k, !isOn(k)); return; }
    const b = e.target.closest('.seg[data-set] button');
    if (b) set(b.closest('.seg').dataset.set, b.dataset.v);
  });
  document.querySelectorAll('input[type=range][data-set]').forEach(r => {
    r.addEventListener('input', () => { paintRange(r); S.settings[r.dataset.set] = r.value / (+r.dataset.scale || 1); if (r.dataset.set === 'grain') applyTheme(); if (S.page === 'overlay') renderOverlaySample(); });
    r.addEventListener('change', () => set(r.dataset.set, r.value / (+r.dataset.scale || 1)));
  });


  // ------------------------------------------------------------------ tune page
  const LOAD = { gpu: 'Graphics card', cpu: 'Processor', both: 'Processor + graphics', vram: 'Graphics memory' };
  const TAG = { fix: 'Fix', try: 'Worth a test', looks: 'Free looks' };
  const BOOST_TESTS = [
    ['boost.all', 'The whole boost', 'Every part of the boost against none of it.'],
    ['boost.stepBack', 'Apps step back', 'Background apps waiting their turn, against running as usual.'],
    ['boost.gameFirst', 'Game first', 'The game ahead of other apps for the processor.'],
    ['boost.gameMode', 'Windows Game Mode', 'On against off, while you play.'],
    ['boost.powerPlan', 'High performance power', 'Full processor speed against your normal plan.'],
  ];
  const VERDICT = { better: ['It helps', 'good'], worse: ['It costs you', 'bad'], same: ['No difference', 'flat'], unclear: ['Too close to call', 'flat'], collecting: ['Measuring', 'run'] };
  const tuneGame = () => sel() || S.games[0] || null;
  function requestTune() { const g = tuneGame(); if (g) send({ t: 'tune', game: g.id }); }

  // a range bar: where the true difference most likely is (b − a), as % of a
  function rangeBar(m, unit, invert) {
    if (!m || !m.a) return '';
    const pct = v => v / Math.abs(m.a) * 100 * (invert ? -1 : 1);
    let lo = pct(m.lo), hi = pct(m.hi), d = pct(m.diff);
    if (lo > hi) [lo, hi] = [hi, lo];
    const span = Math.max(10, Math.ceil(Math.max(Math.abs(lo), Math.abs(hi)) / 5) * 5 + 5);
    const x = v => (v + span) / (2 * span) * 100;
    const cls = m.call === 'better' ? 'good' : m.call === 'worse' ? 'bad' : '';
    return `<div class="rng ${cls}"><div class="rng-axis"><i class="z" style="left:${x(0)}%"></i><i class="band" style="left:${x(lo)}%;width:${Math.max(0.8, x(hi) - x(lo))}%"></i><i class="dot" style="left:${x(d)}%"></i></div>
      <div class="rng-l"><span>−${span}%</span><span>${(m.diff >= 0 ? '+' : '') + m.diff.toFixed(1)} ${unit}</span><span>+${span}%</span></div></div>`;
  }

  function testCard(x, live) {
    const e = x.exp, r = x.result, g = gameOf(e.gameId);
    const cap = e.kind === 'cap';
    const [vt, vc] = VERDICT[r.verdict] || VERDICT.collecting;
    const prog = (n, m) => Math.min(1, Math.min(n / 3, m / 8));
    const side = (name, lab, n, m, f, l, j) => `<div class="side"><div class="k">${name}</div><div class="v">${esc(lab || '')}</div>
      <div class="pbar"><i style="width:${Math.round(prog(n, m) * 100)}%"></i></div>
      <div class="m">${n} session${n === 1 ? '' : 's'} · ${fmt(m, 0)} min</div>
      ${n ? `<div class="num">${fmt(f, 1)} fps · 1% ${fmt(l, 1)}${cap ? ` · ${fmt(j, 2)} ms jitter` : ''}</div>` : ''}</div>`;
    const keepBtn = r.verdict === 'better' && e.outcome !== 'kept' && e.kind !== 'boost' ? `<button type="button" class="btn acc" data-keep="${e.id}">Keep ${esc(e.bLabel || 'it')}</button>`
      : r.verdict === 'better' && e.kind === 'boost' && e.b === 'on' ? '' : '';
    return `<div class="test-card ${live ? 'live' : ''}">
      <div class="tc-top"><span class="pill ${vc}">${live && r.verdict === 'collecting' ? 'TESTING' : vt.toUpperCase()}</span><b>${esc(e.label)}</b>
        ${e.outcome === 'kept' ? '<span class="pill good">KEPT</span>' : ''}<span class="sp"></span>
        ${live ? `<button type="button" class="link" data-stop="${e.id}">Stop test</button>` : ''}</div>
      <div class="tc-sides">${side('AS BEFORE', e.aLabel, r.sessionsA, r.minutesA, r.fps.a, r.low.a, r.jitter.a)}${side('WITH THE CHANGE', e.bLabel, r.sessionsB, r.minutesB, r.fps.b, r.low.b, r.jitter.b)}</div>
      ${r.sessionsA && r.sessionsB ? `<div class="tc-rng">
        <div><div class="k">${cap ? 'SMOOTHNESS' : 'AVERAGE FPS'}</div>${cap ? rangeBar(r.jitter, 'ms', true) : rangeBar(r.fps, 'fps')}</div>
        <div><div class="k">1% LOWS</div>${rangeBar(r.low, 'fps')}</div></div>` : ''}
      <p class="tc-sum">${esc(r.summary)}</p>
      ${live && r.verdict === 'collecting' ? `<p class="note">Each time you turn TEMPO on before opening ${esc(g ? g.name : 'the game')}, it plays one side, and swaps for the next session. It needs at least 3 sessions and 8 minutes on each side, because matches differ a lot on their own. ${r.moreSessions ? `About ${r.moreSessions} more session${r.moreSessions === 1 ? '' : 's'} to go.` : ''} The shaded band shows where the real difference most likely is; once it clears zero, TEMPO says so.</p>` : ''}
      ${keepBtn ? `<div class="tc-act">${keepBtn}</div>` : ''}
    </div>`;
  }

  function renderTune() {
    if (S.page !== 'tune') return;
    const g = tuneGame();
    $('tune-game').innerHTML = g ? `<span class="art" style="${artStyle(g, 'header')}"></span><label><span class="k">GAME</span><select id="tune-pick">${S.games.map(x => `<option value="${esc(x.id)}"${x.id === g.id ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>` : '';
    const T = S.tune && g && S.tune.game === g.id ? S.tune : null;
    if (!T) { $('tune-sugs').innerHTML = '<p class="note">Looking at this game…</p>'; ['tune-test', 'tune-cap', 'tune-boost', 'tune-past', 'tune-settings', 'tune-kept'].forEach(id => $(id).innerHTML = ''); return; }
    const exps = T.experiments || [];
    const running = exps.find(x => x.exp.status === 'running');
    $('tune-test').innerHTML = running ? testCard(running, true) : '';
    const past = exps.filter(x => x !== running);
    $('tune-past-h').hidden = !past.length;
    $('tune-past').innerHTML = past.map(x => testCard(x, false)).join('');

    // what the suggestions are based on
    const recent = sessionsOf(g.id).slice(0, 5);
    const w = recent.reduce((a, s) => a + s.seconds, 0) || 1;
    const cpu = recent.reduce((a, s) => a + s.cpuLimited * s.seconds, 0) / w, gpu = recent.reduce((a, s) => a + s.gpuLimited * s.seconds, 0) / w;
    $('tune-why').textContent = recent.length ? `From your last ${recent.length} session${recent.length === 1 ? '' : 's'}: held back by the ${cpu >= gpu ? 'processor' : 'graphics card'} on ${Math.round(Math.max(cpu, gpu) * 100)}% of frames` : '';
    const closed = !T.running;
    const busy = T.running ? `<p class="note warn">${esc(g.name)} is running. Its settings can only change while it's closed, because it rewrites them when it exits.</p>` : '';
    const sugs = T.suggestions || [];
    const testBtn = (s) => running && running.exp.key === s.key ? '<span class="note">Being tested now</span>'
      : `<button type="button" class="btn acc" data-test='${esc(JSON.stringify({ kind: s.kind === 'cap' ? 'cap' : s.kind === 'display' ? 'display' : 'setting', key: s.key, a: s.from, b: s.to, label: s.title, aLabel: s.fromLabel, bLabel: s.toLabel }))}'>Test it</button>`;
    $('tune-sugs').innerHTML = !recent.length && !sugs.length
      ? `<div class="empty"><b>Play a session first</b>TEMPO needs one normal session of ${esc(g.name)} with TEMPO on, so it knows what holds this game back on your PC. Then the suggestions here are made for you.</div>`
      : !sugs.length ? `<div class="empty"><b>Nothing obvious to change</b>${T.config ? `${esc(g.name)}'s settings already suit what holds your PC back.` : `TEMPO doesn't know where ${esc(g.name)} keeps its settings, so it can't suggest exact changes. ${genericAdvice(cpu, gpu)}`}</div>`
      : busy + sugs.map(s => `<div class="sug ${s.tag}"><div class="sug-top"><span class="pill ${s.tag}">${TAG[s.tag] || ''}</span><b>${esc(s.title)}</b></div>
          <p>${esc(s.why)}</p>
          <div class="sug-act">${s.kind === 'launch' ? `<span class="note" style="margin:0">TEMPO can't change these for you: Steam rewrites them while it runs.</span>` : testBtn(s) + (closed ? `<button type="button" class="btn" data-setnow='${esc(JSON.stringify({ key: s.key, value: s.to, label: s.title }))}'>Change now</button>` : '')}</div></div>`).join('');

    // fps limit
    const c = T.cap, capKey = T.config && T.config.capKey;
    $('tune-cap').innerHTML = !c ? `<p class="note">After a session of at least two minutes, TEMPO works out a limit your PC can hold.</p>`
      : `<div class="capc"><div class="cap-viz">${capViz(c)}</div><p>${esc(c.why)}</p>
        ${c.cap > 0 && !c.steady ? (capKey ? `<div class="sug-act">${testBtn({ kind: 'cap', key: capKey, from: currentOf(T, capKey), to: String(c.cap), title: `Fps limit at ${c.cap}`, fromLabel: limitLabel(currentOf(T, capKey)), toLabel: String(c.cap) })}${closed ? `<button type="button" class="btn" data-setnow='${esc(JSON.stringify({ key: capKey, value: String(c.cap), label: `Fps limit at ${c.cap}` }))}'>Set it now</button>` : ''}</div>`
          : `<p class="note">Set it in ${esc(g.name)}'s own options (often called frame rate limit or max fps). If it has none: NVIDIA Control Panel, Manage 3D settings, Max Frame Rate; or AMD Software, Gaming, the game, Frame Rate Target Control.</p>`) : ''}</div>`;

    // the boost, part by part
    $('tune-boost').innerHTML = BOOST_TESTS.map(([key, lab, txt]) => {
      const now = running && running.exp.key === key;
      return `<div class="brow"><div><b>${lab}</b><small>${txt}</small></div>${now ? '<span class="pill run">TESTING</span>' : `<button type="button" class="btn" data-test='${esc(JSON.stringify({ kind: 'boost', key, a: 'off', b: 'on', label: `${lab}: on or off`, aLabel: 'Off', bLabel: 'On' }))}'>Test</button>`}</div>`;
    }).join('');

    // Steam launch options: many come from old "fps boost" guides
    const LV = { bad: ['Remove it', 'bad'], tip: ['Old advice', 'tip'], ok: ['Fine', 'ok'], unknown: ['Unknown', 'unk'] };
    const lo = T.launch && T.launch.items || [];
    $('tune-launch').innerHTML = !lo.length ? '' : `<div class="sec-h"><span>Steam launch options</span><small>${lo.filter(o => o.level === 'bad' || o.level === 'tip').length ? `${lo.filter(o => o.level === 'bad' || o.level === 'tip').length} worth removing` : 'All fine'}</small></div>
      <p class="note" style="margin:0 0 8px">Set in Steam: right-click ${esc(g.name)}, Properties, Launch options. TEMPO only reads them; change them there.</p>
      <div class="lo-raw mono">${esc(T.launch.raw)}</div>` +
      lo.map(o => `<div class="lo"><div class="lo-top"><code>${esc(o.text)}</code><span class="lv ${(LV[o.level] || LV.unknown)[1]}">${(LV[o.level] || LV.unknown)[0]}</span></div><p>${esc(o.what)}</p></div>`).join('');

    // the game's own settings
    $('tune-set-h').textContent = T.config ? `${g.name}'s own settings` : 'The game\'s own settings';
    if (!T.config) {
      $('tune-settings').innerHTML = `<div class="empty"><b>Not readable yet</b>TEMPO can read and change settings for Deadlock, Counter-Strike 2, games made with Unreal Engine, and the display mode of Unity games. ${esc(g.name)} keeps its settings somewhere else, so change them in its own menu; the suggestions on the left still apply.</div>`;
      $('tune-kept').innerHTML = '';
    } else {
      const groups = [['display', 'Display'], ['limit', 'Limits'], ['quality', 'Quality']];
      $('tune-settings').innerHTML = `<p class="note" style="margin-bottom:10px">${esc(T.config.note)} <span class="mono">${esc(T.config.file)}</span></p>` + busy +
        groups.map(([k, name]) => {
          const list = (T.settings || []).filter(s => s.group === k);
          if (!list.length) return '';
          return `<div class="lab" style="margin:14px 0 6px">${name}</div>` + list.map(s => `<div class="gs" data-gs="${esc(s.key)}">
            <div class="gs-top"><b>${esc(s.label)}</b>${LOAD[s.load] ? `<span class="load ${s.load}">${LOAD[s.load]}</span>` : ''}</div>
            <p>${esc(s.help)}</p>
            ${s.options && s.options.length ? `<div class="seg gs-seg">${s.options.map(o => `<button type="button" data-gv="${esc(o.value)}" class="${String(o.value).toLowerCase() === String(s.value).toLowerCase() ? 'on' : ''}">${esc(o.label)}</button>`).join('')}</div>`
              : `<div class="gs-num"><input type="number" min="${s.min}" max="${s.max}" step="1" value="${Math.round(parseFloat(s.value) || 0)}"><span class="note">${parseFloat(s.value) ? 'fps' : 'no limit'}</span><button type="button" class="btn" data-gnum>Use</button></div>`}
            <div class="gs-pick" hidden></div></div>`).join('');
        }).join('');
      const kept = T.kept || [];
      $('tune-kept').innerHTML = kept.length ? `<div class="lab" style="margin:22px 0 6px">Changed for good by TEMPO</div>` + kept.map(k => `<div class="brow"><div><b>${esc(k.label)}</b><small>${when(k.when)} · was ${esc(k.original)}</small></div><button type="button" class="btn" data-putback="${esc(k.key)}">Put back</button></div>`).join('') : '';
    }
  }

  function currentOf(T, key) { const s = (T.settings || []).find(x => x.key === key); return s ? s.value : ''; }
  function limitLabel(v) { const n = parseFloat(v); return !n ? 'No limit' : String(Math.round(n)); }
  function genericAdvice(cpu, gpu) {
    if (cpu >= gpu && cpu > 0.5) return 'Your processor is what holds it back, so in its menu try lowering view distance, crowds, physics and effects; graphics-only settings (anti-aliasing, ambient occlusion, post-processing) cost little.';
    if (gpu > 0.5) return 'Your graphics card is what holds it back, so in its menu try lowering shadows, lighting, reflections, or the render scale (FSR or DLSS help a lot).';
    return '';
  }
  function capViz(c) {
    const top = Math.max(c.hz || 0, c.p50 * 1.15, 60);
    const x = v => Math.min(100, v / top * 100);
    return `<div class="cv-axis"><i class="cv-range" style="left:${x(c.p10)}%;width:${Math.max(1, x(c.p50) - x(c.p10))}%"></i>${c.cap ? `<i class="cv-cap" style="left:${x(c.cap)}%"></i>` : ''}${c.hz ? `<i class="cv-hz" style="left:${x(c.hz)}%"></i>` : ''}</div>
      <div class="cv-l"><span>0</span>${c.cap ? `<span style="left:${x(c.cap)}%" class="cap">limit ${Math.round(c.cap)}</span>` : ''}<span style="left:${x((c.p10 + c.p50) / 2)}%" class="mid">most of the time ${Math.round(c.p10)} to ${Math.round(c.p50)}</span>${c.hz ? `<span style="left:${x(c.hz)}%">${c.hz} Hz</span>` : ''}</div>`;
  }

  document.addEventListener('change', e => {
    if (e.target.id === 'tune-pick') { S.settings.selectedGame = e.target.value; send({ t: 'select', game: e.target.value }); S.tune = null; renderTune(); requestTune(); renderPlay(); }
  });
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-test]');
    if (t) { const d = JSON.parse(t.dataset.test); send(Object.assign({ t: 'test', game: tuneGame().id }, d)); return; }
    const sn = e.target.closest('[data-setnow]');
    if (sn) { const d = JSON.parse(sn.dataset.setnow); send({ t: 'setNow', game: tuneGame().id, key: d.key, value: d.value, label: d.label }); return; }
    const st = e.target.closest('[data-stop]');
    if (st) { send({ t: 'stopTest', id: st.dataset.stop, game: tuneGame().id }); return; }
    const kp = e.target.closest('[data-keep]');
    if (kp) { send({ t: 'keep', id: kp.dataset.keep }); return; }
    const pb = e.target.closest('[data-putback]');
    if (pb) { send({ t: 'putBack', game: tuneGame().id, key: pb.dataset.putback }); return; }
    // a game setting: picking another value offers a test or a change for good
    const gv = e.target.closest('[data-gv]'), gn = e.target.closest('[data-gnum]');
    if (gv || gn) {
      const row = (gv || gn).closest('.gs'), key = row.dataset.gs, s = (S.tune.settings || []).find(x => x.key === key);
      if (!s) return;
      const value = gv ? gv.dataset.gv : String(Math.max(0, Math.round(+row.querySelector('input').value || 0)));
      if (String(value).toLowerCase() === String(s.value).toLowerCase()) return;
      const lab = v => (s.options || []).find(o => o.value === v)?.label || limitLabel(v);
      const title = `${s.label}: ${lab(s.value)} → ${lab(value)}`;
      const box = row.querySelector('.gs-pick');
      box.hidden = false;
      box.innerHTML = `<span>${esc(title)}</span><button type="button" class="btn acc" data-test='${esc(JSON.stringify({ kind: s.key === 'display' ? 'display' : s.group === 'limit' && !s.options.length ? 'cap' : 'setting', key: s.key, a: s.value, b: value, label: title, aLabel: lab(s.value), bLabel: lab(value) }))}'>Test it</button>${S.tune.running ? '' : `<button type="button" class="btn" data-setnow='${esc(JSON.stringify({ key: s.key, value, label: title }))}'>Change now</button>`}<button type="button" class="link" data-gcancel>Cancel</button>`;
      return;
    }
    const gc = e.target.closest('[data-gcancel]');
    if (gc) { gc.closest('.gs-pick').hidden = true; }
  });

  // ------------------------------------------------------------------ the phone view
  function renderPhone() {
    const p = S.phone || { on: !!S.settings.phone, urls: [] };
    $('phone-tog').classList.toggle('on', !!p.on);
    $('phone-on').hidden = !p.on;
    if (!p.on) return;
    const url = (p.urls || [])[0];
    $('phone-addr').innerHTML = url ? `<b>${esc(url.replace(/\?k=.*/, ''))}</b>${p.urls.length > 1 ? `<br><small>Other addresses: ${p.urls.slice(1).map(u => esc(u.replace(/\?k=.*/, ''))).join(', ')}</small>` : ''}` : (p.error ? esc(p.error) : 'No home network found. Connect this PC to Wi-Fi or a router.');
    $('phone-clients').innerHTML = p.clients ? `<b style="color:var(--acc)">● Your phone is connected</b>` : 'Waiting for your phone…';
    const c = $('phone-qr'), g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    if (!url || typeof qrcode !== 'function') return;
    const q = qrcode(0, 'M'); q.addData(url); q.make();
    const n = q.getModuleCount(), cell = Math.floor((c.width - 16) / n), off = Math.floor((c.width - cell * n) / 2);
    g.fillStyle = '#08090B';
    for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) g.fillRect(off + k * cell, off + r * cell, cell, cell);
  }
  $('phone-tog').addEventListener('click', () => { const on = !$('phone-tog').classList.contains('on'); S.phone = Object.assign(S.phone || {}, { on }); renderPhone(); send({ t: 'phone', on }); });

  // what each kind of stutter means, and what helps
  const CAUSE = {
    memory: ['Memory ran out', 'Windows had to read parts of the game back from the drive.', "Close browser tabs before you play. The boost's \u201cfree memory\u201d part helps, and more memory fixes it for good."],
    heat: ['Graphics card too hot', 'The card slowed itself down to protect itself.', 'Clean the fans and filters, give the PC room to breathe, or set a faster fan curve.'],
    app: ['Another app', 'Something else suddenly wanted the processor.', 'The app is named below. Let it step back in the boost, or close it while you play.'],
    loading: ['Loading from the drive', 'The game was reading data while you played.', 'Normal at the start of a match. If it happens all game, free up space or install the game on an SSD.'],
    cpuclock: ['Processor slowed down', 'The processor dropped below its usual speed.', 'Usually heat or power saving: check the cooler, and keep the boost\'s high performance power on.'],
    cpu: ['Processor full', 'Every core was busy at that moment.', 'Fewer background apps, and lower view distance or effects in the game.'],
    game: ['Inside the game', 'Nothing outside the game stood out.', 'Often shaders being prepared the first time something appears; they settle after a few matches.'],
  };
  function causesHtml(s) {
    const c = s.hitchCauses || {};
    const total = Object.values(c).reduce((a, b) => a + b, 0);
    if (!total) return '';
    const order = Object.keys(c).sort((a, b) => c[b] - c[a]);
    const color = k => ({ memory: '#FF6B57', heat: '#FFB547', app: '#B79BFF', loading: '#6FE3FF', cpuclock: '#FFD15C', cpu: 'var(--acc)', game: '#59606A' })[k] || '#59606A';
    return `<div class="lab" style="margin:4px 0 8px">Why it stuttered <b>${total} stutter${total === 1 ? '' : 's'}</b></div>
      <div class="lbar">${order.map(k => `<i style="flex:${c[k]};background:${color(k)}"></i>`).join('')}</div>
      <div class="causes">${order.map(k => { const m = CAUSE[k] || [k, '', '']; return `<div class="cause"><i style="background:${color(k)}"></i><div><b>${m[0]}</b> <span class="mono">${c[k]}</span><p>${m[1]} ${m[2]}</p></div></div>`; }).join('')}</div>
      ${s.worstHitches && s.worstHitches.length ? `<div class="lab" style="margin:14px 0 6px">The worst ones</div><div class="worst">${s.worstHitches.map(h => `<div class="w"><span class="mono">${Math.floor(h.t / 60)}:${String(Math.floor(h.t % 60)).padStart(2, '0')}</span><b>${Math.round(h.ms)} ms</b><span>${esc(h.detail || '')}</span></div>`).join('')}</div>` : ''}`;
  }

  // checkup page: the PC's own findings plus what the sessions showed
  function renderCheckup() {
    if (S.page !== 'checkup') return;
    const items = (S.checkup || []).slice();
    const last = S.sessions[0];
    if (last) {
      if (last.maxGpuTemp >= 83) items.push({ level: 'tip', title: `Your graphics card reached ${fmt(last.maxGpuTemp)} °C in ${esc(last.gameName)}`, text: 'Most cards slow themselves down above about 83 °C. Dust in the fans or a slow fan curve are the usual reasons.' });
      else if (last.maxGpuTemp > 0) items.push({ level: 'ok', title: `Graphics card heat: ${fmt(last.maxGpuTemp)} °C at the peak`, text: `Cool enough in your last ${esc(last.gameName)} session.` });
      if (last.vramTotalGb > 0 && last.avgVramGb / last.vramTotalGb > 0.9) items.push({ level: 'tip', title: 'Graphics memory was nearly full', text: `${fmt(last.avgVramGb, 1)} of ${fmt(last.vramTotalGb, 0)} GB on average. Lower texture quality is the setting that frees it, and stops the stutters a full card causes.` });
      if (last.hitchesPerMin >= 2) items.push({ level: 'tip', title: `${fmt(last.hitchesPerMin, 1)} stutters a minute in ${esc(last.gameName)}`, text: 'Stutters usually come from loading (a slow or full drive), memory running out, or shaders compiling the first time you see something. They often settle after a few matches.' });
    } else items.push({ level: 'info', title: 'Play a session with TEMPO on', text: 'Heat, memory and stutters from your games show up here too.' });
    const st = S.boostStatus || {};
    if (st.gameMode === false) items.push({ level: 'info', title: 'Windows Game Mode is off', text: "TEMPO's boost turns it on while you play and back off afterwards." });
    const order = { warn: 0, tip: 1, info: 2, ok: 3 };
    items.sort((a, b) => order[a.level] - order[b.level]);
    const icon = l => l === 'ok' ? '&#10003;' : l === 'warn' ? '!' : l === 'tip' ? '&#8599;' : 'i';
    $('ckp-list').innerHTML = S.checkup == null ? '<p class="note">Looking at your PC…</p>' : items.map(f =>
      `<div class="find ${f.level}"><span class="ic">${icon(f.level)}</span><div><div class="t">${f.title}</div><p>${f.text}</p></div></div>`).join('');
  }

  // boost page
  function renderBoost() {
    if (S.page !== 'boost') return;
    const st = S.boostStatus || {};
    const chip = (id, text) => { const e = $(id); if (e) { e.textContent = text || ''; e.hidden = !text; } };
    chip('bs-gm', st.gameMode ? 'already on' : '');
    chip('bs-rec', st.recordingOff ? 'already off' : '');
    chip('bs-pw', st.onBattery ? 'on battery' : st.powerHigh ? 'already on' : st.powerAvailable === false ? 'not on this PC' : '');
    $('bs-gpu-row').hidden = (S.hw.adapters || 1) < 2;
    $('bs-test').innerHTML = `<div class="brow" style="margin-top:18px"><div><b>Is it worth it on your PC?</b><small>The Tune page can test the boost, or any one part of it, over real sessions.</small></div><button type="button" class="btn" data-go-page="tune">Open Tune</button></div>`;
    renderApps();
    const g = sel();
    $('bs-compare').innerHTML = compareHtml(g && g.id);
    syncControls();
  }
  // ---------------- which apps step back: TEMPO decides by kind (automatic), or only the ones you tap
  const bare = n => String(n || '').replace(/\.exe$/i, '');
  function appChip(a) {
    const cls = a.locked && a.choice !== 'on' ? 'lock' : a.step ? 'on' : '';
    const tip = `${a.label || bare(a.name)} (${a.name}): ${a.why}`;
    return `<button type="button" class="ach ${cls}${a.choice ? ' mine' : ''}" data-ach="${esc(a.name)}" title="${esc(tip)}"><i></i><span>${esc(a.label || bare(a.name))}</span>${a.cpu >= 0.1 ? `<small>${fmt(a.cpu, 1)}%</small>` : ''}</button>`;
  }
  function renderApps() {
    const A = S.appsData;
    const auto = A ? A.auto !== false : true;
    document.querySelectorAll('#ap-mode button').forEach(b => b.classList.toggle('on', (b.dataset.mode === 'auto') === auto));
    if (!A) { $('apps').innerHTML = '<p class="note">Looking at what\'s running…</p>'; $('protected').innerHTML = ''; $('ap-note').textContent = ''; return; }
    const apps = A.apps || [];
    const stepping = apps.filter(a => a.step);
    $('apps-count').textContent = `${stepping.length} stepping back`;
    const chip = document.getElementById('bs-apps');
    if (chip) { chip.textContent = `${stepping.length} app${stepping.length === 1 ? '' : 's'}`; chip.hidden = false; }
    $('ap-note').innerHTML = auto
      ? 'TEMPO picks them by kind, plus anything else that keeps the processor busy while you play. Tap an app to decide for yourself; a dot marks your own choices. <b>Nothing is ever closed</b>, and an app you switch to gets its full speed while it\'s in front.'
      : 'Only the apps you tap step back. <b>Nothing is ever closed</b>, and an app you switch to gets its full speed while it\'s in front.';
    const isCalls = a => a.calls || a.group === 'calls', isKept = a => a.kept || a.group === 'game';
    const free = apps.filter(a => !isCalls(a) && !isKept(a));
    if (auto) {
      const groups = (A.groups || []).filter(g => g.kind === 'step');
      const inGroup = (g, a) => g.id === 'busy' ? (a.group == null || a.group === 'busy') : a.group === g.id;
      const cards = groups.map(g => ({ g, list: free.filter(a => inGroup(g, a)) }));
      const full = cards.filter(c => c.list.length), empty = cards.filter(c => !c.list.length);
      $('apps').innerHTML = `<div class="ag-grid">` + full.map(({ g, list }) => {
        const n = list.filter(a => a.step).length;
        return `<div class="agrp${g.on ? ' on' : ''}${g.id === 'busy' || list.length > 4 ? ' wide' : ''}"><div class="ag-top"><b>${esc(g.label)}</b><span class="ag-n">${g.id === 'busy' ? `${list.length} other app${list.length === 1 ? '' : 's'}` : `${n} of ${list.length}`}</span><button type="button" class="tog${g.on ? ' on' : ''}" data-grp="${g.id}" aria-label="${esc(g.label)}"></button></div>
          <p>${esc(g.why)}${g.id === 'busy' ? ` Above ${fmt(A.busyPercent || 1.5, 1)}% of the processor, on average.` : ''}</p>
          <div class="achips">${list.map(appChip).join('')}</div></div>`;
      }).join('') + `</div>` + (empty.length ? `<div class="ag-empty"><div class="ag-eh">Not running now, covered when they are</div>${empty.map(({ g }) => `<div class="ag-row"><span><b>${esc(g.label)}</b><small>${esc(g.why)}</small></span><button type="button" class="tog${g.on ? ' on' : ''}" data-grp="${g.id}" aria-label="${esc(g.label)}"></button></div>`).join('')}</div>` : '');
    } else {
      $('apps').innerHTML = free.length ? `<div class="apps">${free.map(a => `<button type="button" class="app${a.step ? ' on' : ''}" data-ach="${esc(a.name)}"><span class="nm">${esc(a.label || bare(a.name))}</span><span class="cpu">${a.cpu ? fmt(a.cpu, 1) + '%' : ''}</span><span class="pick">${a.step ? 'Steps back' : 'Leave alone'}</span></button>`).join('')}</div>` : '<p class="note">Nothing else is running.</p>';
    }
    const calls = apps.filter(isCalls), kept = apps.filter(isKept);
    const keptCard = (title, why, list, none) => `<div class="agrp kept"><div class="ag-top"><b>${title}</b><span class="ag-n">${list.length ? `${list.length} running` : ''}</span></div><p>${why}</p>${list.length ? `<div class="achips">${list.map(appChip).join('')}</div>` : `<p class="ag-none">${none}</p>`}</div>`;
    $('protected').innerHTML =
      keptCard('Calls & music', 'Discord, Spotify, TeamSpeak and the like stay exactly as they are, so voice and music never stutter. Tap one to let it step back.', calls, 'None running right now.') +
      keptCard('Helps your game', 'Anti-cheat, frame generation (like Lossless Scaling), overlays, recording, mouse and controller software, VPNs and fan tools. Slowing these would hurt your game, so they\'re kept.', kept, 'None running right now.') +
      `<div class="ag-confirm" id="ag-confirm" hidden></div>`;
  }
  function chooseApp(name, choice) {
    const A = S.appsData;
    const a = A && (A.apps || []).find(x => x.name === name);
    if (a) { // show it straight away; the app answers with the real decision a moment later
      a.choice = choice === 'default' ? '' : choice;
      a.step = choice === 'on' ? true : choice === 'off' ? false : a.auto;
      if (choice === 'on') a.locked = false;
      renderApps();
    }
    send({ t: 'set', key: 'boost.app', value: { name, choice } });
  }
  document.addEventListener('click', e => {
    const m = e.target.closest('#ap-mode [data-mode]');
    if (m) { const auto = m.dataset.mode === 'auto'; if (S.appsData) S.appsData.auto = auto; putSet('boost.auto', auto); send({ t: 'set', key: 'boost.auto', value: auto }); renderApps(); return; }
    const gt = e.target.closest('[data-grp]');
    if (gt) {
      const A = S.appsData, g = A && (A.groups || []).find(x => x.id === gt.dataset.grp);
      if (g) {
        g.on = !g.on;
        if (g.id !== 'busy') (A.apps || []).forEach(a => { if (!a.choice && !a.locked && a.group === g.id) a.step = a.auto = g.on; });
        renderApps();
        send({ t: 'set', key: 'boost.group', value: { id: g.id, on: g.on } });
      }
      return;
    }
    const yes = e.target.closest('[data-unlock]');
    if (yes) { chooseApp(yes.dataset.unlock, 'on'); return; }
    if (e.target.closest('[data-unlock-no]')) { $('ag-confirm').hidden = true; return; }
    const b = e.target.closest('[data-ach]');
    if (!b) return;
    const A = S.appsData, a = A && (A.apps || []).find(x => x.name === b.dataset.ach);
    if (!a) return;
    if (a.locked && a.choice !== 'on') {
      // music, voice, or something the game needs: ask first
      const c = $('ag-confirm');
      c.hidden = false;
      c.innerHTML = `<span><b>${esc(a.label || bare(a.name))}</b> ${esc(a.why)} Let it step back anyway?</span><button type="button" class="btn acc" data-unlock="${esc(a.name)}">Let it step back</button><button type="button" class="btn" data-unlock-no>Keep it as it is</button>`;
      c.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      return;
    }
    if (a.locked && a.choice === 'on') { chooseApp(a.name, 'default'); return; }
    const next = !a.step;
    chooseApp(a.name, next === !!a.auto ? 'default' : next ? 'on' : 'off');
  });

  // overlay page
  const SHOW = [['fps', 'FPS'], ['low1', '1% low'], ['frametime', 'Frame time'], ['graph', 'Graph'], ['cpu', 'Processor'], ['gpu', 'Graphics card'], ['heat', 'Heat']];
  function renderOverlayPage() {
    const shown = new Set(S.settings.overlayShow || []);
    $('ov-show').innerHTML = SHOW.map(([k, label]) => `<button type="button" data-show="${k}" class="${shown.has(k) || k === 'fps' ? 'on' : ''}"${k === 'fps' ? ' disabled' : ''}>${label}</button>`).join('');
    const g = sel() || S.games[0];
    const hero = g && (g.art.hero || g.art.header);
    $('ov-game').style.backgroundImage = hero ? `url('${hero}')` : '';
    syncControls();
    renderOverlaySample();
  }
  $('ov-show').addEventListener('click', e => {
    const b = e.target.closest('[data-show]');
    if (!b || b.dataset.show === 'fps') return;
    const shown = new Set(S.settings.overlayShow || []);
    shown.has(b.dataset.show) ? shown.delete(b.dataset.show) : shown.add(b.dataset.show);
    set('overlayShow', [...shown]);
    renderOverlayPage();
  });
  function renderOverlaySample() {
    const st = S.settings, box = $('ov-sample'), area = $('ov-preview');
    const l = S.live && S.live.fps ? S.live : { fps: 58, low1: 39, frameMs: 17.2, limiter: 'cpu', sys: { cpuMax: 97, gpu: 61, temp: 66 } };
    const fps = Math.round(l.fps), sys = l.sys || {};
    const shown = new Set(st.overlayShow || []);
    const color = st.overlayNumbers === 'white' ? '#F5F6F8' : st.overlayNumbers === 'byfps' ? (fps >= 60 ? st.accent : fps >= 30 ? '#FFB547' : '#FF5A3C') : st.accent;
    const parts = [];
    if (shown.has('low1')) parts.push(`1% ${Math.round(l.low1)}`);
    if (shown.has('frametime')) parts.push(`${(1000 / fps).toFixed(1)} ms`);
    if (shown.has('cpu')) parts.push(`CPU ${Math.round(sys.cpuMax ?? 0)}%`);
    if (shown.has('gpu') && sys.gpu != null) parts.push(`GPU ${Math.round(sys.gpu)}%`);
    if (shown.has('heat') && sys.temp != null) parts.push(`HEAT ${Math.round(sys.temp)}°`);
    const s = st.overlaySize || 1, a = st.overlayBox || 0;
    const boxCss = a > 0 ? `background:rgba(6,7,9,${(a * .92).toFixed(2)});border:1px solid rgba(255,255,255,${Math.min(.16, a / 4).toFixed(2)});` : '';
    const outline = a < .47 ? ' o-out' : '';
    let html;
    if (st.overlayStyle === 'detailed') {
      html = `<div class="${outline}" style="width:${250 * s}px;padding:${12 * s}px;border-radius:${14 * s}px;${boxCss}">
        <div style="display:flex;align-items:baseline;gap:${6 * s}px"><span class="o-n" style="color:${color};font-size:${40 * s}px">${fps}</span><span class="o-u" style="font-size:${9.5 * s}px">FPS</span>
        <span class="o-m" style="margin-left:auto;text-align:right;font-size:${10.5 * s}px;line-height:1.5">${parts.slice(0, 2).join('<br>')}</span></div>
        <svg width="${226 * s}" height="${30 * s}" style="display:block;margin-top:${8 * s}px"><polyline fill="none" stroke="${color}" stroke-width="${1.3 * s}" points="${Array.from({ length: 60 }, (_, i) => `${i / 59 * 226 * s},${(18 + Math.sin(i / 3) * 3 + (i % 17 === 0 ? -9 : 0)) * s}`).join(' ')}"/></svg>
        <div class="o-m" style="display:flex;gap:${18 * s}px;margin-top:${6 * s}px;font-size:${10.5 * s}px">${parts.slice(2).map(p => `<span>${p}</span>`).join('')}</div></div>`;
    } else if (st.overlayStyle === 'bar') {
      html = `<div class="${outline}" style="display:flex;align-items:center;gap:${13 * s}px;padding:${7 * s}px ${16 * s}px;border-radius:${22 * s}px;${boxCss}">
        <span class="o-n" style="color:${color};font-size:${26 * s}px">${fps}</span><span class="o-u" style="font-size:${9.5 * s}px">FPS</span>
        ${parts.map(p => `<span style="width:1px;height:${16 * s}px;background:rgba(255,255,255,.18)"></span><span class="o-m" style="font-size:${10.5 * s}px">${p}</span>`).join('')}
        ${l.limiter ? `<span style="width:1px;height:${16 * s}px;background:rgba(255,255,255,.18)"></span><span class="o-m" style="color:#FFB547;font-size:${10.5 * s}px">${{ cpu: 'processor-limited', gpu: 'graphics-limited', cap: 'at its limit' }[l.limiter]}</span>` : ''}</div>`;
    } else {
      html = `<div class="${outline}" style="padding:${6 * s}px ${10 * s}px;border-radius:${12 * s}px;${boxCss}">
        <div style="display:flex;align-items:baseline;gap:${6 * s}px"><span class="o-n" style="color:${color};font-size:${32 * s}px">${fps}</span><span class="o-u" style="font-size:${9.5 * s}px">FPS</span>${parts.map(p => `<span class="o-m" style="margin-left:${6 * s}px;font-size:${10.5 * s}px">${p}</span>`).join('')}</div>
        ${shown.has('graph') ? `<svg width="${200 * s}" height="${26 * s}" style="display:block;margin-top:${4 * s}px"><polyline fill="none" stroke="${color}" stroke-width="${1.3 * s}" points="${Array.from({ length: 60 }, (_, i) => `${i / 59 * 200 * s},${(16 + Math.sin(i / 3) * 3 + (i % 17 === 0 ? -9 : 0)) * s}`).join(' ')}"/></svg>` : ''}</div>`;
    }
    box.innerHTML = html;
    const m = 18;
    const c = st.overlayCorner || 'tl';
    box.style.left = box.style.right = box.style.top = box.style.bottom = box.style.transform = '';
    if (c === 'tr' || c === 'br') box.style.right = m + 'px'; else if (c === 'bc') { box.style.left = '50%'; box.style.transform = 'translateX(-50%)'; } else box.style.left = m + 'px';
    if (c === 'bl' || c === 'br' || c === 'bc') box.style.bottom = (m + 28) + 'px'; else box.style.top = m + 'px';
    area.dataset.on = st.overlay !== false;
    box.style.opacity = st.overlay === false ? .25 : 1;
  }

  // look page
  function renderLook() {
    const acc = (S.settings.accent || '').toUpperCase();
    const known = ACCENTS.some(([, h]) => h === acc);
    $('swatches').innerHTML = ACCENTS.map(([n, h]) => `<button type="button" class="swatch${h === acc ? ' on' : ''}" data-acc="${h}"><i style="background:${h}"></i>${n}</button>`).join('') +
      `<label class="swatch${known ? '' : ' on'}"><i class="own"${known ? '' : ` style="background:${acc}"`}></i>Own<input type="color" id="own-color" value="${known ? '#ff5ad2' : acc.toLowerCase()}"></label>`;
    $('tiles').innerHTML = BGS.map(([k, n, c]) => `<button type="button" class="tile${(S.settings.background || 'graphite') === k ? ' on' : ''}" data-bg="${k}"><div class="pv" style="background:${c}"></div>${n}</button>`).join('');
    const g = sel() || S.games[0];
    const hero = g && (g.art.hero || g.art.header);
    $('look-hero').style.backgroundImage = hero ? `url('${hero}')` : '';
    drawLookDial();
    syncControls();
  }
  $('swatches').addEventListener('click', e => { const b = e.target.closest('[data-acc]'); if (b) set('accent', b.dataset.acc); });
  $('swatches').addEventListener('input', e => { if (e.target.id === 'own-color') { S.settings.accent = e.target.value.toUpperCase(); applyTheme(); } });
  $('swatches').addEventListener('change', e => { if (e.target.id === 'own-color') set('accent', e.target.value.toUpperCase()); });
  $('tiles').addEventListener('click', e => { const b = e.target.closest('[data-bg]'); if (b) set('background', b.dataset.bg); });

  // ------------------------------------------------------------------ messages from the app
  function onMsg(m) {
    switch (m.t) {
      case 'init':
        Object.assign(S, { settings: m.settings, games: m.games, sessions: m.sessions || [], hw: m.hw || {}, version: m.version });
        $('version').textContent = 'v' + m.version;
        $('hw').textContent = [S.hw.cpu, S.hw.gpu && `${S.hw.gpu}${S.hw.vram && !/GB/i.test(S.hw.gpu) ? ` ${S.hw.vram}GB` : ''}`, S.hw.ram && `${S.hw.ram} GB`, S.hw.hz && `${S.hw.hz} Hz`].filter(Boolean).join(' · ');
        S.boostStatus = m.boostStatus || {};
        applyTheme();
        syncControls();
        renderPlay();
        movePill();
        renderPhone();
        if (m.restored) toast(`TEMPO put back ${m.restored} change${m.restored === 1 ? '' : 's'} left from last time it was on.`);
        break;
      case 'state': {
        const was = S.st.state;
        if (m.state === 'off') S.blockedTold = false;
        S.st = m;
        if (m.state !== 'live') { dial.target = 0; S.live = null; }
        if (was === 'off' && m.state !== 'off') { $('receipt').hidden = true; requestAnimationFrame(ignite); }
        if (was !== 'off' && m.state === 'off') requestAnimationFrame(windDown);
        if (was !== 'live' && m.state === 'live') { $('receipt').hidden = true; requestAnimationFrame(arrive); }
        if (m.error && m.state !== 'off') toast('Frame timing had a problem: ' + m.error);
        if (m.experimentNote && was === 'off') toast(m.experimentNote);
        if (m.pending && m.state === 'off') toast('A game setting goes back as soon as the game closes (it rewrites its settings on exit).');
        renderPlay();
        if (was === 'off' && m.state === 'waiting') toast('TEMPO is on. Open your game now.');
        break;
      }
      case 'live': onLive(m); break;
      case 'session': {
        if (S.page === 'tune') requestTune();
        const s = m.session;
        S.sessions = [s].concat(S.sessions.filter(x => !(x.id === s.id && x.gameId === s.gameId)));
        renderPlay();
        if (S.page === 'play') receipt(s);
        else toast(`Session saved: ${fmt(s.avgFps)} fps average, ${fmt(s.low1)} at the 1% lows.`);
        if (S.page === 'sessions') renderSessions();
        break;
      }
      case 'sessions': S.sessions = m.sessions; S.sessSel = null; renderSessions(); renderPlay(); break;
      case 'games': S.games = m.games; if (m.select) S.settings.selectedGame = m.select; renderPlay(); break;
      case 'settings': S.settings = m.settings; applyTheme(); syncControls(); renderPlay(); if (S.page === 'overlay') renderOverlaySample(); break;
      case 'toast': toast(m.text); break;
      case 'checkup': S.checkup = (m.findings || []).map(f => ({ level: f.level, title: esc(f.title), text: esc(f.text) })); S.boostStatus = m.boostStatus || S.boostStatus; renderCheckup(); break;
      case 'update': { const u = $('update'); u.hidden = false; u.dataset.url = m.url; u.textContent = `Update ${m.version}`; break; }
      case 'tune': S.tune = m; renderTune(); break;
      case 'whatsnew': whatsNew(m.version); break;
      case 'phone': S.phone = m; renderPhone(); break;
      case 'apps': S.appsData = m; S.apps = m.apps; S.boostStatus = m.boostStatus || S.boostStatus; renderBoost(); break;
    }
  }
  window.__deliver = onMsg;
  if (host) host.addEventListener('message', e => onMsg(e.data));

  function start() { send({ t: 'ready' }); }
  if (host) start();
  else {
    // a plain browser: load the stand-in for the app (design previews)
    const s = document.createElement('script');
    s.src = 'mock.js';
    s.onload = start;
    document.body.appendChild(s);
  }
})();
