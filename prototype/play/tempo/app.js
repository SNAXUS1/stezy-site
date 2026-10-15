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
  const DEFAULT_ON = new Set(['overlay', 'autoOff', 'intro', 'artBehindDial', 'boost.stepBack', 'boost.gameFirst', 'boost.gameMode', 'boost.recording', 'boost.powerPlan', 'boost.memoryRelief', 'boost.strongGpu', 'boost.smoothWindowed']);
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
  const hasStutters = s => s.hitches != null && !s.noStutterData;
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
  // A match was saved: a card with what happened, against this game's usual, and what held it back
  function receipt(s) {
    const box = $('receipt');
    if (!box || !s) return;
    clearTimeout(receipt.t);
    const u = usualOf(s), sm = smoothOf(s), why = heldBack(s);
    const d = (v, base, unit = '') => base == null || v == null ? '' : (() => { const x = v - base; const r = Math.round(x); return `<em class="${Math.abs(x) < 0.5 ? '' : x > 0 ? 'up' : 'down'}">${r > 0 ? '+' : ''}${r}${unit} vs usual</em>`; })();
    box.innerHTML = `<div class="rc-top"><span class="rc-k">MATCH SAVED</span><span class="rc-g">${esc(s.gameName)} · ${dur(s.seconds)}</span><button type="button" class="rc-x" aria-label="Close">&#10005;</button></div>
      <p class="rc-say">${matchSay(s, u)}${delayLine(s, u)}</p>
      <div class="rc-nums four"><div><b id="rc-a">0</b><small>FPS AVERAGE</small>${d(s.avgFps, u && u.avg)}</div><div title="The 1% low: the slowest 1% of frames"><b id="rc-l">0</b><small>WORST MOMENTS</small>${d(s.low1, u && u.low)}</div>
        <div><b id="rc-s">${sm == null ? '&#8211;' : '0'}</b><small>SMOOTH %</small>${sm == null ? '' : d(sm, u && u.smooth)}</div><div><b id="rc-h">0</b><small>STUTTERS</small></div></div>
      ${why ? `<div class="rc-why"><span class="k">WHAT HELD YOU BACK</span><b>${why.k}</b> ${why.v}</div>` : ''}
      ${coolLine(s)}
      ${freezeGone(s)}
      ${tryIt(s)}
      ${testSide(s)}
      <button type="button" class="rc-go" data-see="${esc(s.gameId)}|${esc(s.id)}">See the whole match &rarr;</button>`;
    box.hidden = false;
    if (!still()) box.animate([{ opacity: 0, transform: 'translateY(14px) scale(.98)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: EASE });
    countUp($('rc-a'), s.avgFps); countUp($('rc-l'), s.low1, 1000); countUp($('rc-h'), s.hitches ?? 0, 700);
    if (sm != null) countUp($('rc-s'), sm, 900);
    const hide = () => { receipt.t = setTimeout(() => { box.hidden = true; }, 30000); };
    box.onmouseenter = () => clearTimeout(receipt.t);
    box.onmouseleave = () => { clearTimeout(receipt.t); hide(); };
    hide();
  }
  // what TEMPO's fans did, against the same game's matches on the card's own control
  function coolLine(s) {
    if (!s.fanCurve || !(s.maxGpuTemp > 0)) return '';
    const before = S.sessions.filter(x => x.gameId === s.gameId && x !== s && !x.fanCurve && x.maxGpuTemp > 0 && x.seconds >= 300).slice(0, 5);
    const peak = before.length ? before.reduce((a, x) => a + x.maxGpuTemp, 0) / before.length : null;
    const heldMin = x => x.gpuSlowSeconds / 60;
    const usualHeld = before.length ? before.reduce((a, x) => a + heldMin(x), 0) / before.length : null;
    const cooler = peak != null && peak - s.maxGpuTemp >= 2;
    return `<div class="rc-why rc-cool"><span class="k">FANS</span><b>${cooler ? `${Math.round(peak - s.maxGpuTemp)}° cooler.` : `Peaked at ${fmt(s.maxGpuTemp)} °C.`}</b> ${cooler ? `Peaked at ${fmt(s.maxGpuTemp)} °C, usually ${fmt(peak)} °C, ` : ''}fans ${fmt(s.avgFan)}% on average${s.maxFan > 0 ? `, ${fmt(s.maxFan)}% at most` : ''}. ${s.gpuSlowSeconds >= 60 ? `Held back for heat ${dur(s.gpuSlowSeconds)}${usualHeld != null ? ` (usually ${Math.round(usualHeld)} min)` : ''}.` : usualHeld >= 1 ? `Never held back for heat (usually ${Math.round(usualHeld)} min).` : 'Never held back for heat.'}</div>`;
  }
  // after an update: what's new, once, in the same card as the session receipt
  function whatsNew(version) {
    const box = $('receipt');
    if (!box) return;
    if (!S.fans && !whatsNew.waited) { whatsNew.waited = true; setTimeout(() => whatsNew(version), 1200); return; } // knows first whether this PC has fan control
    const fansOk = !(S.fans && S.fans.able === false);
    box.innerHTML = `<div class="rc-top"><span class="rc-k">NEW IN ${esc(String(version).split('.').slice(0, 2).join('.'))}</span><span class="rc-g">TEMPO updated</span><button type="button" class="rc-x" aria-label="Close">&#10005;</button></div>
      <ul class="rc-new"><li><b>Calibrate, built for Deadlock:</b> TEMPO plays a fight from a real Deadlock match again and again, one change at a time, and keeps only what's proven faster on your PC.</li>
      <li><b>Your screen's real speed in each game:</b> TEMPO notices when a game runs your screen slower than it can go (Deadlock at 50 Hz on a 144 Hz screen, say), and fixes it in one click.</li>
      <li>Everything from 2.0 stays: Aim, Fans, the check before you play, the match card.</li></ul>
      <button type="button" class="rc-go" data-go-page="calibrate">Calibrate TEMPO to your PC &rarr;</button>`;
    box.hidden = false;
    if (!still()) box.animate([{ opacity: 0, transform: 'translateY(14px) scale(.98)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: EASE });
  }
  document.addEventListener('click', e => {
    if (e.target.closest('[data-go-page]') && e.target.closest('#receipt')) $('receipt').hidden = true;
    if (e.target.closest('.rc-x')) { $('receipt').hidden = true; return; }
    const see = e.target.closest('[data-see]');
    if (see) { const [gid, id] = see.dataset.see.split('|'); S.sessSel = S.sessions.find(x => x.gameId === gid && x.id === id) || null; $('receipt').hidden = true; go('sessions'); }
  });


  // ------------------------------------------------------------------ icons: one line set, drawn for TEMPO (24 px grid, 1.7 stroke)
  const ICON = {
    layers: '<path d="M12 3.5 3.5 8 12 12.5 20.5 8Z"/><path d="m3.5 12.2 8.5 4.5 8.5-4.5"/><path d="m3.5 16.2 8.5 4.5 8.5-4.5" opacity=".45"/>',
    up: '<path d="M12 20V6"/><path d="m6 11.5 6-6 6 6"/><path d="M5 3.5h14" opacity=".45"/>',
    pad: '<rect x="2.5" y="7" width="19" height="11" rx="5.5"/><path d="M7.5 10.6v3.8M5.6 12.5h3.8"/><circle cx="15.4" cy="11.2" r="1" fill="currentColor" stroke="none"/><circle cx="17.6" cy="13.8" r="1" fill="currentColor" stroke="none"/>',
    rec: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.3" fill="currentColor" stroke="none"/>',
    bolt: '<path d="M13.2 2.5 5 13.5h6.2l-.9 8 8.2-11h-6.2Z"/>',
    chip: '<rect x="6" y="6" width="12" height="12" rx="2.2"/><rect x="9.5" y="9.5" width="5" height="5" rx="1" opacity=".5"/><path d="M9.5 2.8V6M14.5 2.8V6M9.5 18v3.2M14.5 18v3.2M2.8 9.5H6M2.8 14.5H6M18 9.5h3.2M18 14.5h3.2"/>',
    pause: '<rect x="6.2" y="5" width="3.8" height="14" rx="1.4"/><rect x="14" y="5" width="3.8" height="14" rx="1.4"/>',
    window: '<rect x="3" y="4.5" width="18" height="15" rx="3"/><path d="M3 9h18"/><path d="M6 6.8h.01M8.4 6.8h.01"/>',
    gpu: '<rect x="2.5" y="6.5" width="19" height="10.5" rx="2.2"/><circle cx="8.6" cy="11.75" r="2.6"/><circle cx="15.4" cy="11.75" r="2.6"/><path d="M5 17v3"/>',
    fan: '<circle cx="12" cy="12" r="9.2" opacity=".45"/><circle cx="12" cy="12" r="1.5"/><path d="M12 10.3c-.2-2.9.9-5.3 3.1-5.3 1.7 0 2.4 1.7 1.3 3.1-1 1.2-2.5 1.8-4.4 2.2Z"/><g transform="rotate(120 12 12)"><path d="M12 10.3c-.2-2.9.9-5.3 3.1-5.3 1.7 0 2.4 1.7 1.3 3.1-1 1.2-2.5 1.8-4.4 2.2Z"/></g><g transform="rotate(240 12 12)"><path d="M12 10.3c-.2-2.9.9-5.3 3.1-5.3 1.7 0 2.4 1.7 1.3 3.1-1 1.2-2.5 1.8-4.4 2.2Z"/></g>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
    eyeoff: '<path d="M3 3l18 18"/><path d="M10.6 5.6c.5-.1.9-.1 1.4-.1 6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.6 3.4M6.4 6.5C3.9 8.2 2.5 12 2.5 12s3.5 6.5 9.5 6.5c1.6 0 3-.4 4.2-1.1"/>',
    layout: '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M3.5 9.5h17M9.5 9.5v11"/>',
    square: '<rect x="4" y="4" width="16" height="16" rx="3.5" fill="currentColor" fill-opacity=".18"/>',
    resize: '<path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/>',
    corner: '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><rect x="6.5" y="6.5" width="5" height="3.5" rx="1" fill="currentColor" stroke="none"/>',
    palette: '<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.7-.9 1.4-1.8-.4-1.2.3-2.2 1.6-2.2h1.8a3.7 3.7 0 0 0 3.7-3.7C20.5 7.1 16.7 3.5 12 3.5Z"/><circle cx="7.8" cy="11" r="1" fill="currentColor" stroke="none"/><circle cx="10.5" cy="7.5" r="1" fill="currentColor" stroke="none"/><circle cx="14.8" cy="7.8" r="1" fill="currentColor" stroke="none"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.8" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="4.8" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="4.8" cy="18" r="1" fill="currentColor" stroke="none"/>',
    image: '<rect x="3" y="4.5" width="18" height="15" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="m21 16-5-5-9.5 8.5"/>',
    sparkle: '<path d="M12 3.5c.7 4.3 2.4 6 6.5 6.6-4.1.7-5.8 2.4-6.5 6.6-.7-4.2-2.4-5.9-6.5-6.6 4.1-.6 5.8-2.3 6.5-6.6Z"/><path d="M18.5 15.5c.3 1.8 1 2.5 2.7 2.8-1.7.3-2.4 1-2.7 2.7-.3-1.7-1-2.4-2.7-2.7 1.7-.3 2.4-1 2.7-2.8Z" opacity=".55"/>',
    wave: '<path d="M2.5 12c2.4 0 2.4-5 4.75-5S9.6 17 12 17s2.4-10 4.75-10S19.1 12 21.5 12"/>',
    power: '<path d="M12 3v8.5"/><path d="M6.6 6.6a7.5 7.5 0 1 0 10.8 0"/>',
    play: '<path d="M8 5.2v13.6a.8.8 0 0 0 1.2.7l10.6-6.8a.8.8 0 0 0 0-1.4L9.2 4.5A.8.8 0 0 0 8 5.2Z"/>',
  };
  const svgIcon = (name, size = 16) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name] || ''}</svg>`;
  // every settings row gets its icon (in a small tile that takes on the accent when the row is on)
  ICON.desktop = '<rect x="2.5" y="4" width="19" height="12.5" rx="2.2"/><path d="M8.5 20h7M12 16.5V20"/>';
  ICON.start = '<rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.6"/><rect x="13" y="3.5" width="7.5" height="7.5" rx="1.6"/><rect x="3.5" y="13" width="7.5" height="7.5" rx="1.6"/><rect x="13" y="13" width="7.5" height="7.5" rx="1.6"/>';
  const ROW_ICON = { 'boost.stepBack': 'layers', 'boost.gameFirst': 'up', 'boost.gameMode': 'pad', 'boost.recording': 'rec', 'boost.powerPlan': 'bolt', 'boost.memoryRelief': 'chip',
    'boost.pause': 'pause', 'boost.smoothWindowed': 'window', 'boost.strongGpu': 'gpu', 'cooling.on': 'fan', overlay: 'eye', overlayStyle: 'layout', overlayBox: 'square',
    overlaySize: 'resize', overlayCorner: 'corner', overlayNumbers: 'palette', overlayHideFromCapture: 'eyeoff', artStyle: 'image', grain: 'sparkle', motion: 'wave', autoOff: 'power', intro: 'play' };
  document.querySelectorAll('.set .rowx').forEach(r => {
    const c = r.querySelector('[data-set]'), sc = r.querySelector('[data-sc]');
    const key = c ? c.dataset.set : r.querySelector('#ov-show') ? 'show' : null;
    const name = sc ? sc.dataset.sc : key === 'show' ? 'list' : ROW_ICON[key];
    if (!name || r.querySelector('.ri')) return;
    const i = document.createElement('i');
    i.className = 'ri';
    i.innerHTML = svgIcon(name);
    r.prepend(i);
    r.classList.add('has-ri');
  });
  // a shimmer while something is being looked at (instead of a line of text)
  const skel = (rows = 2) => Array.from({ length: rows }, (_, i) => `<div class="skel-card"><i class="sk" style="width:${[38, 46, 30][i % 3]}%"></i><i class="sk" style="width:${[92, 84, 88][i % 3]}%"></i><i class="sk" style="width:${[64, 72, 58][i % 3]}%"></i></div>`).join('');

  // ------------------------------------------------------------------ shortcuts: TEMPO on the desktop and in Start
  function syncShortcuts() {
    const sc = S.shortcuts || {};
    document.querySelectorAll('.tog[data-sc]').forEach(t => t.classList.toggle('on', !!sc[t.dataset.sc]));
  }
  document.addEventListener('click', e => {
    const t = e.target.closest('.tog[data-sc]');
    if (t) { const on = !t.classList.contains('on'); t.classList.toggle('on', on); send({ t: 'shortcut', where: t.dataset.sc, on }); return; }
    const a = e.target.closest('[data-sc-offer]');
    if (!a) return;
    if (a.dataset.scOffer === 'add') { send({ t: 'shortcut', where: 'desktop', on: true }); send({ t: 'shortcut', where: 'start', on: true }); a.closest('#receipt').querySelector('.rc-say').innerHTML = '<b>Done.</b> TEMPO is on your desktop and in Start. You can change it on the Look page.'; a.parentElement.remove(); setTimeout(() => $('receipt').hidden = true, 2600); }
    else { send({ t: 'shortcutAsked' }); $('receipt').hidden = true; }
  });
  // once, the first time TEMPO opens: offer the shortcuts (in the same card as the match receipt)
  function offerShortcuts() {
    const sc = S.shortcuts;
    if (!sc || sc.asked || sc.desktop || !$('receipt').hidden || S.st.state !== 'off') return;
    const box = $('receipt');
    box.innerHTML = `<div class="rc-top"><span class="rc-k">WELCOME</span><span class="rc-g">One click to keep TEMPO close</span><button type="button" class="rc-x" aria-label="Close" data-sc-offer="no">&#10005;</button></div>
      <p class="rc-say">Put TEMPO on your desktop and in the Start menu? ${sc.temporary ? `It's running from inside the zip right now, so it first copies itself to a lasting place (${esc(sc.home)}).` : 'The shortcuts open this TEMPO, and follow it to newer versions.'}</p>
      <div class="tc-act"><button type="button" class="btn acc" data-sc-offer="add">Add shortcuts</button><button type="button" class="btn" data-sc-offer="no">Not now</button></div>`;
    box.hidden = false;
    if (!still()) box.animate([{ opacity: 0, transform: 'translateY(14px) scale(.98)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: EASE });
  }

  // ------------------------------------------------------------------ the intro
  // Shown from the first frame (so the app never flashes before it); played or skipped once TEMPO says how it's set.
  (() => {
    const g = document.querySelector('.in-ticks');
    if (!g) return;
    let h = '';
    for (let i = 0; i <= 18; i++) {
      const a = (135 + i * 15) * Math.PI / 180, r1 = i % 3 ? 94 : 91, r2 = 99;
      h += `<line x1="${(110 + Math.cos(a) * r1).toFixed(1)}" y1="${(110 + Math.sin(a) * r1).toFixed(1)}" x2="${(110 + Math.cos(a) * r2).toFixed(1)}" y2="${(110 + Math.sin(a) * r2).toFixed(1)}" style="--i:${i}"${i % 3 ? '' : ' class="major"'}/>`;
    }
    g.innerHTML = h;
  })();
  // if TEMPO never answers (it always does), the intro still gets out of the way
  setTimeout(() => { if (!intro.started && $('intro')) { $('intro').remove(); body.classList.remove('intro-on'); } }, 4000);
  function intro(skip) {
    const el = $('intro');
    if (!el || intro.started) return;
    intro.started = true;
    const done = () => { el.remove(); body.classList.remove('intro-on'); };
    if (skip || S.settings.intro === false || still()) { done(); return; }
    const end = fast => {
      if (el.dataset.out) return;
      el.dataset.out = '1';
      el.classList.add('out');
      if (fast) el.classList.add('fast');
      body.classList.add('arriving');
      body.classList.remove('intro-on');
      setTimeout(() => { el.remove(); body.classList.remove('arriving'); }, fast ? 260 : 620);
    };
    setTimeout(() => end(false), 1500);
    addEventListener('pointerdown', () => end(true), { once: true });
    addEventListener('keydown', () => end(true), { once: true });
  }

  // ------------------------------------------------------------------ pages
  function go(page) {
    if (page === 'fans' && S.fans && S.fans.able === false) { const b = document.querySelector('.nav [data-go="fans"]'); pop(b, b.dataset.naTitle, b.dataset.naWhy); return; }
    S.page = page;
    body.dataset.page = page;
    document.querySelectorAll('.nav button').forEach(b => b.classList.toggle('on', b.dataset.go === page));
    for (const p of ['play', 'calibrate', 'boost', 'fans', 'tune', 'aim', 'sessions', 'checkup', 'overlay', 'look']) $('page-' + p).hidden = p !== page;
    if (page === 'calibrate') { renderLab(); requestLab(); }
    if (page === 'aim') { renderAimPage(); renderAim(); send({ t: 'aimState' }); const g = sel(); if (g) send({ t: 'tune', game: g.id }); }
    if (page === 'fans') { renderFans(); send({ t: 'fans' }); }
    if (page === 'checkup') { renderCheckup(); send({ t: 'checkup' }); }
    if (page !== 'aim' && aim.on) send({ t: 'aimStop' });
    if (page === 'tune') { renderTune(); requestTune(); }
    if (page === 'overlay') send({ t: 'phoneState' });
    movePill();
    if (page === 'boost') { renderBoost(); send({ t: 'apps' }); }
    if (page === 'sessions') renderSessions();
    if (page === 'overlay') renderOverlayPage();
    if (page === 'look') renderLook();
    if (page === 'play') { renderPlay(); drawStrip(); } // redraw charts in the current colours
  }
  $('nav').addEventListener('click', e => {
    const b = e.target.closest('[data-go]');
    if (!b) return;
    if (b.classList.contains('na')) { pop(b, b.dataset.naTitle || 'Not on this PC', b.dataset.naWhy || ''); return; }
    go(b.dataset.go);
  });
  // a small note under a control (why a tab is greyed out); goes away by itself or on the next click
  function pop(anchor, title, text) {
    let p = $('pop');
    if (!p) { p = document.createElement('div'); p.id = 'pop'; p.className = 'pop'; p.setAttribute('role', 'status'); document.body.appendChild(p); }
    p.innerHTML = `<b>${esc(title)}</b>${text ? `<p>${esc(text)}</p>` : ''}`;
    const r = anchor.getBoundingClientRect();
    p.hidden = false;
    const w = p.offsetWidth;
    p.style.left = Math.max(12, Math.min(innerWidth - w - 12, r.left + r.width / 2 - w / 2)) + 'px';
    p.style.top = (r.bottom + 12) + 'px';
    p.style.setProperty('--ax', (r.left + r.width / 2 - parseFloat(p.style.left)) + 'px');
    p.classList.remove('in'); void p.offsetWidth; p.classList.add('in');
    clearTimeout(pop.t);
    pop.t = setTimeout(() => { p.hidden = true; }, 6000);
    setTimeout(() => document.addEventListener('click', function off(ev) { if (!p.contains(ev.target)) { p.hidden = true; document.removeEventListener('click', off); } }), 0);
  }
  // the Fans tab: greyed out on a PC whose card or driver doesn't let apps set the fans (never a switch that does nothing)
  function applyFanTab() {
    const b = document.querySelector('.nav [data-go="fans"]');
    if (!b) return;
    const na = !!(S.fans && S.fans.able === false);
    b.classList.toggle('na', na);
    b.setAttribute('aria-disabled', na ? 'true' : 'false');
    b.dataset.naTitle = S.fans && S.fans.kind === 'refused' ? 'The driver said no' : 'Fans aren\'t available on this PC';
    b.dataset.naWhy = (S.fans && S.fans.why) || '';
    b.title = na ? b.dataset.naWhy : '';
    if (na && S.page === 'fans') go('play');
  }
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
    hidePre();
    renderPlay();
  });
  $('add-game').addEventListener('click', () => send({ t: 'addGame' }));

  // ------------------------------------------------------------------ play
  const MODES = [
    [/Legacy/i, 'Old-style exclusive fullscreen', 'Windows lets nothing sit on top in this mode, so the overlay can\'t show. Your fps is still measured. The game\'s borderless option (or its other fullscreen setting) lets the overlay through.'],
    [/Hardware Composed/i, 'Fast path, with the overlay on its own layer', 'Your graphics card draws the overlay on a layer of its own, so the game keeps fullscreen speed.'],
    [/Independent Flip/i, 'Fullscreen, on Windows\' fast path', 'As fast as exclusive fullscreen, and the overlay can show on top.'],
    [/Composed: Copy/i, 'Windowed, on Windows\' old copy path', 'An older way of drawing that adds delay. Next time, TEMPO turns on Windows\' optimizations for windowed games for it (Boost page), which puts it on the fast path.'],
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
    const preN = st === 'off' ? preItems().length : 0;
    $('chips').innerHTML = (preN ? `<button type="button" class="chip pre-chip" data-pre-open><span class="d"></span>${preN === 1 ? '1 thing' : `${preN} things`} to know before you play</button>` : '') +
      (st === 'off'
      ? `<button type="button" class="chip" data-go-page="boost"><span class="d"></span>${bc ? `Boost · ${bc} change${bc === 1 ? '' : 's'}` : 'Boost off'}</button>`
      : '') +
      `<button type="button" class="chip${auto ? '' : ' offc'}" id="chip-auto"><span class="ck">${auto ? '&#10003;' : '&#9675;'}</span>Turns off with the game</button>` +
      `<button type="button" class="chip" data-go-page="overlay">Overlay · ${S.settings.overlay === false ? 'off' : ovs}</button>`;
    $('left-off').hidden = st !== 'off';
    $('left-on').hidden = st === 'off';
    $('learn').hidden = st !== 'off' || !boostCount();
    const launchable = !!(g && g.canLaunch);
    $('power-b').textContent = launchable ? 'PLAY' : 'TURN ON';
    $('power-s').textContent = launchable ? ('OPENS ' + g.name.toUpperCase()).slice(0, 24) + (g.name.length > 18 ? '…' : '') : 'CTRL ALT T';
    $('play').hidden = st !== 'off' || !launchable;
    if (launchable) $('play').textContent = 'Turn on only, I\'ll open it myself';
    if (st !== 'off') hidePre();
    else requestPre();
    const stepped = S.st.stepped || [];
    const applied = (S.st.applied || []).filter(a => !/ stepped back$/.test(a)).concat(stepped.length ? [`Apps stepped back · ${stepped.slice(0, 4).join(', ')}${stepped.length > 4 ? ` +${stepped.length - 4}` : ''}`] : (S.st.applied || []).filter(a => / stepped back$/.test(a)));
    if ((S.st.paused || []).length) applied.push(`Paused · ${S.st.paused.slice(0, 3).join(', ')}${S.st.paused.length > 3 ? ` +${S.st.paused.length - 3}` : ''}${S.st.pausedMb >= 50 ? ` (${(S.st.pausedMb / 1024).toFixed(1)} GB back)` : ''}`);
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
  $('power').addEventListener('click', () => startPlay(!!(sel() && sel().canLaunch)));
  $('learn').addEventListener('click', () => send({ t: 'on', game: S.settings.selectedGame || 'any', learn: true }));
  $('play').addEventListener('click', () => startPlay(false));
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
    if (s.culprit && s.culprit.freezes >= 2) out.push(`<b>${esc(s.culprit.label)} spiked at ${s.culprit.freezes} freezes</b> (it suddenly took a big share of the processor each time). ${esc(s.culprit.fix)}`);
    if (s.overlayBlocked) out.push(blockedText(gameOf(s.gameId)));
    const prot = new Set((S.settings.protectedApps || []).map(x => x.toLowerCase()));
    const left = new Set(((S.settings.boost || {}).leaveAlone || []).map(x => x.toLowerCase()));
    const shell = new Set(['explorer.exe', 'searchhost.exe', 'shellexperiencehost.exe', 'startmenuexperiencehost.exe']);
    const movable = (s.background || []).filter(b => !prot.has(b.name.toLowerCase()) && !left.has(b.name.toLowerCase()) && !shell.has(b.name.toLowerCase()));
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
      <div class="trio"><div><div class="k">1% LOW</div><div class="v">${fmt(s.low1)}</div></div><div><div class="k">0.1% LOW</div><div class="v">${fmt(s.low01)}</div></div><div><div class="k">STUTTERS</div><div class="v">${hasStutters(s) ? s.hitches : '–'}${hasStutters(s) ? `<small>${fmt(s.hitchesPerMin, 1)}/min</small>` : ''}</div></div></div>
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

  // a smooth line through points (midpoint curves), for every chart
  function smooth(g, pts) {
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) { const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2; g.quadraticCurveTo(pts[i][0], pts[i][1], mx, my); }
    const L = pts[pts.length - 1]; g.lineTo(L[0], L[1]);
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
    c._y = y; c._n = series.length;
    const rgb = getComputedStyle(document.documentElement).getPropertyValue('--acc-rgb').trim();
    // faint guides at round fps values
    const step = hi - lo > 120 ? 40 : hi - lo > 60 ? 20 : 10;
    g.font = '9px "Geist Mono"'; g.textAlign = 'left';
    for (let v = Math.ceil(lo / step) * step; h >= 120 && v < hi; v += step) {
      g.strokeStyle = 'rgba(255,255,255,.045)'; g.lineWidth = 1; g.setLineDash([]);
      g.beginPath(); g.moveTo(0, Math.round(y(v)) + .5); g.lineTo(w, Math.round(y(v)) + .5); g.stroke();
      g.fillStyle = 'rgba(162,169,179,.45)'; g.fillText(String(v), 2, y(v) - 3);
    }
    const P = arr => arr.map((v, i) => [i / (arr.length - 1) * w, y(v)]);
    const line = (arr, color, width, dash) => { g.beginPath(); smooth(g, P(arr)); g.setLineDash(dash || []); g.strokeStyle = color; g.lineWidth = width; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); };
    if (before && before.length > 1) line(before, 'rgba(162,169,179,.38)', 1.2, [3, 3]);
    if (low) line(low, `rgba(${rgb}, .3)`, 1, null);
    // the fps line: a light fill fading down, and a soft glow under the line
    const pts = P(series);
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, `rgba(${rgb}, .18)`); grad.addColorStop(1, `rgba(${rgb}, 0)`);
    g.beginPath(); smooth(g, pts); g.lineTo(w, h); g.lineTo(0, h); g.closePath(); g.fillStyle = grad; g.fill();
    g.save(); g.shadowColor = `rgba(${rgb}, .55)`; g.shadowBlur = 8;
    g.beginPath(); smooth(g, pts); g.setLineDash([]); g.strokeStyle = ACC(); g.lineWidth = 1.7; g.lineJoin = 'round'; g.stroke();
    g.restore();
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

  // heat (a line coloured by how hot) and fan speed (dashed) along the match; shaded where the card held itself back for heat
  function drawHeat(c, s) {
    if (!c) return;
    const t = s.seriesTemp, f = s.seriesFan || [], hh = s.seriesHeat || [];
    const dpr = window.devicePixelRatio || 1, w = c.clientWidth, h = c.clientHeight;
    c.width = w * dpr; c.height = h * dpr;
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    const n = t.length, X = i => i / (n - 1) * w;
    // held back for heat: soft red columns
    g.fillStyle = 'rgba(255,107,87,.13)';
    hh.forEach((v, i) => { if (v >= 0.5) g.fillRect(X(i) - w / n / 2, 0, w / n + 0.5, h); });
    const valid = t.filter(v => v > 0);
    if (!valid.length) return;
    const lo = Math.min(40, Math.min(...valid) - 3), hi = Math.max(90, Math.max(...valid) + 2);
    const Y = v => h - 4 - (v - lo) / (hi - lo) * (h - 10);
    g.font = '9px "Geist Mono"'; g.fillStyle = 'rgba(162,169,179,.45)'; g.textAlign = 'left';
    [60, 80].forEach(v => { if (v > lo && v < hi) { g.strokeStyle = 'rgba(255,255,255,.045)'; g.beginPath(); g.moveTo(0, Math.round(Y(v)) + .5); g.lineTo(w, Math.round(Y(v)) + .5); g.stroke(); g.fillText(v + '°', 2, Y(v) - 3); } });
    // fans: dashed, on their own 0-100% scale
    const fv = f.filter(v => v >= 0);
    if (fv.length > 3 && f.length === n) {
      const FY = v => h - 4 - v / 100 * (h - 10);
      g.beginPath(); smooth(g, f.map((v, i) => [X(i), FY(Math.max(0, v))])); g.setLineDash([3, 3]); g.strokeStyle = 'rgba(111,227,255,.7)'; g.lineWidth = 1.2; g.stroke(); g.setLineDash([]);
    }
    // heat: blue when cool, amber when warm, red when hot
    const grad = g.createLinearGradient(0, Y(lo), 0, Y(hi));
    const stop = v => Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
    grad.addColorStop(stop(55), '#6FE3FF'); grad.addColorStop(stop(72), '#FFB547'); grad.addColorStop(stop(84), '#FF6B57');
    g.beginPath(); smooth(g, t.map((v, i) => [X(i), Y(v > 0 ? v : valid[0])])); g.strokeStyle = grad; g.lineWidth = 1.6; g.lineJoin = 'round'; g.stroke();
  }
  // pointing at the chart: that moment's fps, its dips, heat, fans, and any stutter nearby
  function xray(s) {
    const wrap = $('xray'), c = $('sd-chart'), line = $('xr-line'), tip = $('xr-tip');
    if (!wrap || !c || !s.series || s.series.length < 2) return;
    const n = s.series.length;
    const mmss = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
    wrap.onpointermove = e => {
      const r = wrap.getBoundingClientRect();
      const x = Math.max(0, Math.min(r.width, e.clientX - r.left));
      const i = Math.round(x / r.width * (n - 1)), t = i / (n - 1) * s.seconds;
      const temp = s.seriesTemp && s.seriesTemp[i] > 0 ? s.seriesTemp[i] : null, fan = s.seriesFan && s.seriesFan[i] >= 0 ? s.seriesFan[i] : null;
      const hot = s.seriesHeat && s.seriesHeat[i] >= 0.5;
      const near = (s.worstHitches || []).filter(hh => Math.abs(hh.t - t) <= s.seconds / n * 1.5).sort((a, b) => b.ms - a.ms)[0];
      line.hidden = false; tip.hidden = false;
      line.style.transform = `translateX(${x}px)`;
      tip.innerHTML = `<b>${mmss(t)}</b><span><em>${fmt(s.series[i])}</em> fps</span>${s.seriesLow ? `<span class="lo">dips to ${fmt(s.seriesLow[i])}</span>` : ''}${temp != null ? `<span class="tp">${fmt(temp)} °C</span>` : ''}${fan != null ? `<span class="fn">fans ${fmt(fan)}%</span>` : ''}${hot ? '<span class="hot">held back for heat</span>' : ''}${near ? `<span class="st">stutter ${Math.round(near.ms)} ms${near.detail ? `: ${esc(near.detail.split('.')[0])}` : ''}</span>` : ''}`;
      const tw = tip.offsetWidth;
      tip.style.transform = `translateX(${Math.max(0, Math.min(r.width - tw, x + 14 > r.width - tw ? x - tw - 14 : x + 14))}px)`;
    };
    wrap.onpointerleave = () => { line.hidden = true; tip.hidden = true; };
  }

  // ------------------------------------------------------------------ live
  let sinceTimer = 0;
  function onLive(l) {
    S.live = l;
    if (S.st.state !== 'live') { if (l.sys) $('self-cost').textContent = `${fmt(l.sys.tempo, 1)}% processor`; return; }
    dial.target = l.fps || 0;
    $('big').textContent = l.fps ? Math.round(l.fps) : '–';
    $('big-low').textContent = l.low1 ? Math.round(l.low1) : '–';
    $('big-lat').hidden = !(l.latency > 0);
    if (l.latency > 0) $('big-lat').innerHTML = `FRAME DELAY <em>${Math.round(l.latency)} MS</em>`;
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
        (s.temp != null ? m('Graphics card heat', `${fmt(s.temp)} °C`, (s.temp - 30) / 60 * 100, s.temp > 83) : '') +
        (s.fan != null ? m(`Graphics card fans${l.cool && l.cool.state === 'on' ? '<em class="m-tag">TEMPO</em>' : ''}`, `${fmt(s.fan)}%`, s.fan, l.cool && l.cool.state === 'on') : '');
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
    $('mode-note').hidden = !mo && l.overlay !== 'blocked' && l.overlayPath !== 'costs';
    if (l.overlay === 'blocked') $('mode-note').innerHTML = blockedText(gameOf(S.st.game));
    else if (l.overlayPath === 'costs') $('mode-note').innerHTML = `<b>The counter costs a frame here.</b> Without it the game goes straight to the screen; with it, Windows has to draw it on top (about one refresh more delay). Ctrl Alt O hides it for ranked.`;
    else if (mo) $('mode-note').innerHTML = `<b>${mo[1]}.</b> ${mo[2]}`;
    if (l.overlay === 'blocked' && !S.blockedTold) { S.blockedTold = true; toast('The game\'s exclusive fullscreen is hiding the fps counter. Your fps is still measured.'); }
    const pace = paceOf(l.recent || []);
    $('strip-now').textContent = l.frameMs ? `${fmt(1000 / Math.max(l.fps, 1), 1)} ms now${pace != null ? ` · ${pace}% smooth` : ''}` : '';
    drawStrip();
    if (S.page === 'fans') drawFanGraph();
  }

  // share of recent frames on pace (within a quarter of the ones just before), like the match card's Smooth
  function paceOf(fr) {
    let ema = 0, n = 0, off = 0;
    for (const f of fr) { if (ema > 0) { n++; if (Math.abs(f - ema) > 0.25 * ema) off++; } ema = ema ? ema + (Math.min(f, ema * 3) - ema) * 0.05 : f; }
    return n > 30 ? Math.round((1 - off / n) * 100) : null;
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
    const pts = fr.map((v, i) => [i / Math.max(1, fr.length - 1) * w, y(v)]);
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, `rgba(${rgb.trim()}, .14)`); grad.addColorStop(1, `rgba(${rgb.trim()}, 0)`);
    g.beginPath(); smooth(g, pts); g.lineTo(w, h); g.lineTo(0, h); g.closePath(); g.fillStyle = grad; g.fill();
    g.save(); g.shadowColor = `rgba(${rgb.trim()}, .5)`; g.shadowBlur = 6;
    g.beginPath(); smooth(g, pts); g.strokeStyle = ACC(); g.lineWidth = 1.4; g.lineJoin = 'round'; g.stroke();
    g.restore();
    // the newest frame: a bright point at the end of the line
    const L = pts[pts.length - 1];
    g.beginPath(); g.arc(L[0] - 2, L[1], 2.6, 0, Math.PI * 2); g.fillStyle = '#fff'; g.shadowColor = ACC(); g.shadowBlur = 10; g.fill(); g.shadowBlur = 0;
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
      <p class="sd-say">${matchSay(s, usualOf(s))}${(() => { const w = heldBack(s); return w ? `<small>What held it back: <b>${w.k}</b> ${w.v}</small>` : ''; })()}</p>
      ${freezeGone(s)}
      ${tryIt(s)}
      ${coolLine(s) ? `<div class="sd-cool">${coolLine(s)}</div>` : ''}
      <div class="sd-grid five">
        <div><div class="k">AVERAGE</div><div class="v">${fmt(s.avgFps)}<small>fps</small></div></div>
        <div><div class="k">1% LOW</div><div class="v">${fmt(s.low1)}<small>fps</small></div></div>
        <div><div class="k">0.1% LOW</div><div class="v">${fmt(s.low01)}<small>fps</small></div></div>
        <div><div class="k">STUTTERS</div><div class="v">${hasStutters(s) ? s.hitches : '–'}<small>${hasStutters(s) ? fmt(s.hitchesPerMin, 1) + '/min' : 'not counted yet'}</small></div></div>
        <div title="Frames that came at the same pace as the ones before"><div class="k">SMOOTH</div><div class="v">${smoothOf(s) == null ? '–' : smoothOf(s)}<small>${smoothOf(s) == null ? 'new in 2.0' : '% on pace'}</small></div></div>
      </div>
      ${s.overlayPath === 'costs' ? `<p class="facts" style="margin:-8px 0 16px"><b>The fps counter cost a frame here:</b> with it showing, Windows drew the game through its compositor instead of straight to the screen, about one screen refresh more delay. Ctrl Alt O hides it.</p>` : ''}
      <div class="xray" id="xray">
        <canvas class="sd-chart" id="sd-chart"></canvas>
        ${s.seriesTemp && s.seriesTemp.length === (s.series || []).length ? `<canvas class="sd-heat" id="sd-heat"></canvas>` : ''}
        <i class="xr-line" id="xr-line" hidden></i><div class="xr-tip" id="xr-tip" hidden></div>
      </div>
      <div class="axis"><span>0</span><span>${dur(s.seconds / 2)}</span><span>${dur(s.seconds)}</span></div>
      <p class="facts" style="margin-bottom:12px">${s.seriesTemp && s.seriesTemp.length ? '<span class="xr-legend"><i class="t"></i>heat <i class="f"></i>fans <i class="h"></i>held back for heat</span> Point at the chart to see any moment. ' : ''}${s.seriesLow ? 'The faint line is the slowest moment of each stretch, the dips you feel.' : ''}${s.worstHitches && s.worstHitches.length ? ' Orange marks are the worst stutters.' : ''}${prev ? ` Dashed: the session before (${fmt(prev.avgFps)} fps average).` : ''}</p>
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
          TEMPO itself <b>${fmt(s.tempoCpu, 1)}%</b> of your processor${s.medianLatencyMs > 0 ? `<br>Frame delay <b>${fmt(s.medianLatencyMs)} ms</b> typical, <b>${fmt(s.p95LatencyMs)} ms</b> at the slowest 5% (from the game starting a frame to it on screen)` : ''}</p>
          ${s.background && s.background.length ? `<div class="lab" style="margin-top:16px">Other apps using the processor</div><div class="bg-apps" style="margin-top:0">` + s.background.map(b => `<div class="row${(S.settings.protectedApps || []).some(p => p.toLowerCase() === b.name.toLowerCase()) ? ' kept' : ''}"><span>${esc(b.label || b.name.replace(/\.exe$/i, ''))}</span><b>${fmt(b.cpu, 1)}%</b></div>`).join('') + '</div>' : ''}
        </div>
      </div>`;
    drawSeries($('sd-chart'), s.series, prev && prev.series, s);
    drawHeat($('sd-heat'), s);
    xray(s);
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
    if (key.startsWith('cooling')) renderFans();
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
  const TAG = { fix: 'Fix', try: 'Worth a test', looks: 'Free looks', feel: 'Less delay' };
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
    if (!T) { $('tune-sugs').innerHTML = skel(2); $('tune-settings').innerHTML = skel(3); ['tune-missed', 'tune-test', 'tune-cap', 'tune-boost', 'tune-past', 'tune-kept'].forEach(id => $(id).innerHTML = ''); return; }
    const missed = (T.kept || []).filter(k => k.missed);
    $('tune-missed').innerHTML = missed.length ? `<div class="missed"><div class="sug-top"><span class="pill fix">MISSED</span><b>${missed.length === 1 ? '1 change' : missed.length + ' changes'} never reached ${esc(g.name)}</b></div>
      <p>${esc(g.name)} moved its settings to your Steam account's own folder, and TEMPO was still changing the old copy, which the game no longer reads. So these were never applied, and the matches since were played without them. TEMPO now uses the right file.</p>
      <ul class="ms-list">${missed.map(k => `<li>${esc(k.label)}</li>`).join('')}</ul>
      <div class="sug-act">${T.running ? `<span class="note" style="margin:0">Close ${esc(g.name)} first.</span>` : `<button type="button" class="btn acc" data-missed="apply">Apply them now</button><button type="button" class="btn" data-missed="forget">Forget them</button>`}</div></div>` : '';
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
          <div class="sug-act">${s.id === 'refresh' ? (s.kind === 'setting' && closed ? `<button type="button" class="btn acc" data-setnow='${esc(JSON.stringify({ key: s.key, value: s.to, label: s.title }))}'>Set it to ${esc(s.toLabel)}</button>` : '') : s.kind === 'launch' ? `<span class="note" style="margin:0">TEMPO can't change these for you: Steam rewrites them while it runs.</span>` : testBtn(s) + (closed ? `<button type="button" class="btn" data-setnow='${esc(JSON.stringify({ key: s.key, value: s.to, label: s.title }))}'>Change now</button>` : '')}</div></div>`).join('');

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
      $('tune-settings').innerHTML = `<div class="empty"><b>Not readable yet</b>TEMPO can read and change settings for Deadlock, Counter-Strike 2, Apex Legends, Minecraft, Schedule I, games made with Unreal Engine (Fortnite, Marvel Rivals and many more), and the display mode of Unity games. ${esc(g.name)} keeps its settings somewhere else, so change them in its own menu; the suggestions on the left still apply.</div>`;
      $('tune-kept').innerHTML = '';
    } else {
      const groups = [['display', 'Display'], ['limit', 'Limits'], ['quality', 'Quality'], ['driver', 'NVIDIA driver']];
      const seen = T.config.seen === 'yes' ? `<span class="cfg-seen ok">&#10003; ${esc(g.name)} saved this file during a match, so it's the one it reads.</span>`
        : T.config.seen === 'no' ? `<span class="cfg-seen">Not confirmed yet: ${esc(g.name)} hasn't saved this file during a match. Some games only save it when you change a setting in their own menu.</span>` : '';
      $('tune-settings').innerHTML = `<div class="cfg-where"><p class="note">${esc(T.config.note)}</p>${T.config.place ? `<span class="mono cfg-path" title="${esc(T.config.place)}">${esc(T.config.place)}</span>` : `<span class="mono">${esc(T.config.file)}</span>`}${seen}</div>` + busy +
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
      const kept = (T.kept || []).filter(k => !k.missed);
      const nowNote = k => k.now != null && String(k.now).toLowerCase() !== String(k.value).toLowerCase() ? ` · <span class="warn-t">the game has it at ${esc(k.now)} now</span>` : '';
      $('tune-kept').innerHTML = kept.length ? `<div class="lab" style="margin:22px 0 6px">Changed for good by TEMPO</div>` + kept.map(k => `<div class="brow"><div><b>${esc(k.label)}</b><small>${when(k.when)} · was ${esc(k.original)}${nowNote(k)}</small></div><button type="button" class="btn" data-putback="${esc(k.key)}">Put back</button></div>`).join('') : '';
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
    const ms = e.target.closest('[data-missed]');
    if (ms) { ms.disabled = true; send({ t: 'missed', game: tuneGame().id, do: ms.dataset.missed }); return; }
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

  // ------------------------------------------------------------------ fans page
  const FAN_PRESETS = [
    ['quiet', 'Quiet', 'Barely heard. Runs a little warmer.'],
    ['balanced', 'Balanced', 'About 60 to 70% in a long match.'],
    ['cool', 'Cool', "Cooler, and you'll hear it."],
    ['custom', 'Your own', 'Drag the points on the graph.'],
  ];
  const FAN_FALLBACK = { quiet: [[50, 30], [65, 45], [75, 58], [83, 70]], balanced: [[45, 35], [60, 50], [70, 62], [78, 72]], cool: [[40, 40], [55, 55], [65, 68], [72, 80]] };
  const FG = { w: 640, h: 340, l: 46, r: 16, t: 16, b: 34, t0: 30, t1: 95 };
  const fgX = t => FG.l + (t - FG.t0) / (FG.t1 - FG.t0) * (FG.w - FG.l - FG.r);
  const fgY = f => FG.t + (1 - f / 100) * (FG.h - FG.t - FG.b);
  const coolOpts = () => S.settings.cooling || {};
  const fanLimit = () => Math.max(40, Math.min(90, Math.round(coolOpts().max || 75)));
  const presetPts = name => ((S.fans && S.fans.presets) || FAN_FALLBACK)[name] || FAN_FALLBACK.balanced;
  function curvePts() {
    const c = coolOpts();
    const own = c.points && c.points.length >= 2 ? c.points : null;
    return (c.preset === 'custom' && own ? own : presetPts(c.preset || 'balanced')).map(p => p.slice());
  }
  function curveAt(pts, t, max, min = 0, exact = false) {
    let s;
    if (t <= pts[0][0]) s = pts[0][1];
    else if (t >= pts[pts.length - 1][0]) s = pts[pts.length - 1][1];
    else { let i = 1; while (pts[i][0] < t) i++; const k = (t - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]); s = pts[i - 1][1] + k * (pts[i][1] - pts[i - 1][1]); }
    const v = Math.max(min, Math.min(max, s));
    return exact ? v : Math.round(v);
  }
  // what the fans are doing, in a few words (the chip) and in a sentence (the card)
  const COOL_CHIP = { off: '', ready: 'ready for your game', on: 'cooling now', learn: 'measure only', tool: 'another app in charge', unsupported: 'not on this card', denied: 'not allowed', handed: 'handed back', nosensor: 'no heat reading', listen: 'listening' };
  function coolState() { return (S.live && S.live.cool && S.st.state === 'live' ? S.live.cool : S.st.cool) || { state: coolOpts().on ? 'ready' : 'off' }; }
  function fanCardHtml() {
    const F = S.fans, c = coolState(), hw = S.hw.gpu || 'Your graphics card';
    if (!F) return skel(1);
    const sys = S.live && S.live.sys;
    if (c.state === 'tool' || F.tool) {
      const tool = c.tool || F.tool;
      return `<div class="fc-row warn"><span class="fc-dot"></span><div><b>${esc(tool)} is running and sets your fans itself</b><p>TEMPO leaves the fans to it while it runs, so the two never fight. To let TEMPO cool while you play, close ${esc(tool)} (and untick its Start with Windows), or switch its fan control off.</p></div></div>`;
    }
    if (!F.ready || c.state === 'unsupported') return `<div class="fc-row off"><span class="fc-dot"></span><div><b>Not on this graphics card</b><p>TEMPO sets fans through NVIDIA's own driver library, on cards and drivers that allow it. ${esc(hw)} doesn't offer it here, so nothing is changed. Your card keeps its own fan control.</p></div></div>`;
    if (c.state === 'denied') return `<div class="fc-row warn"><span class="fc-dot"></span><div><b>The driver didn't allow it</b><p>NVIDIA's driver said no when TEMPO asked to set the fans, so nothing was changed. A newer driver may allow it.</p></div></div>`;
    if (c.state === 'handed') return `<div class="fc-row warn"><span class="fc-dot"></span><div><b>Another app changed the fans mid-game</b><p>So TEMPO handed them back and stayed out of it for the rest of the session, rather than fight over them. It tries again next time.</p></div></div>`;
    if (c.state === 'nosensor') return `<div class="fc-row warn"><span class="fc-dot"></span><div><b>No heat reading from the card</b><p>Without it TEMPO can't follow a curve, so the card keeps its own fan control.</p></div></div>`;
    const temp = sys && sys.temp != null ? sys.temp : F.temp, fan = sys && sys.fan != null ? sys.fan : F.speed;
    const mode = c.state === 'on' ? `on TEMPO's curve` : c.state === 'listen' ? 'for a moment, so you can hear it' : F.policy === 1 ? 'a fixed speed someone set' : "the card's own control";
    return `<div class="fc-row ${c.state === 'on' || c.state === 'listen' ? 'live' : ''}"><span class="fc-dot"></span><div><b>${esc(hw)} · ${F.count === 1 ? '1 fan' : F.count + ' fans'}</b>
      <p>Now <em>${fan != null ? fmt(fan) + '%' : '–'}</em> at <em>${temp != null ? fmt(temp) + '°C' : '–'}</em>, ${mode}. It runs between ${F.min}% and ${F.max}%.${c.state === 'learn' ? ' This is a measure-only session, so the fans are left alone.' : ''}</p></div></div>`;
  }
  function presetsHtml() {
    const cur = coolOpts().preset || 'balanced', max = fanLimit();
    return FAN_PRESETS.map(([id, name, line]) => {
      const pts = id === 'custom' ? (coolOpts().points && coolOpts().points.length >= 2 ? coolOpts().points : null) : presetPts(id);
      const spark = pts ? (() => {
        const X = t => 4 + (t - 30) / 65 * 72, Y = f => 30 - Math.min(f, max) / 100 * 26;
        const d = [[30, pts[0][1]], ...pts, [95, pts[pts.length - 1][1]]].map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)} ${Y(p[1]).toFixed(1)}`).join(' ');
        return `<svg viewBox="0 0 80 34" aria-hidden="true"><path d="${d} L76 32 L4 32 Z" class="sp-fill"/><path d="${d}" class="sp-line"/></svg>`;
      })() : `<svg viewBox="0 0 80 34" aria-hidden="true"><path d="M4 26 C 24 26, 30 10, 44 14 S 66 6, 76 6" class="sp-line dash"/></svg>`;
      return `<button type="button" class="preset${cur === id ? ' on' : ''}" data-preset="${id}">${spark}<b>${name}</b><small>${line}</small></button>`;
    }).join('');
  }
  function renderFans() {
    if (S.page !== 'fans') return;
    const c = coolState(), max = fanLimit();
    const chip = $('fan-chip');
    chip.textContent = c.state === 'on' && c.speed >= 0 ? `cooling · ${c.speed}%` : COOL_CHIP[c.state] || '';
    chip.className = 'st-chip' + (c.state === 'on' || c.state === 'listen' ? ' new' : c.state === 'tool' || c.state === 'denied' || c.state === 'handed' ? ' warn' : '');
    $('fan-card').innerHTML = fanCardHtml();
    $('fan-presets').innerHTML = presetsHtml();
    const r = $('fan-max');
    if (document.activeElement !== r) r.value = max;
    paintFanMax();
    const can = S.fans && S.fans.ready && !S.fans.tool && c.state !== 'on' && !S.listenLeft;
    $('fan-hear').disabled = !can;
    $('fan-hear').textContent = S.listenLeft ? `Listening · ${S.listenLeft}` : 'Hear it';
    $('fan-hear').title = can ? `Runs the fans at ${max}% for 8 seconds, then hands them back` : '';
    drawFanGraph();
    renderFanHistory();
  }
  function paintFanMax() {
    const r = $('fan-max'), v = +r.value;
    r.style.setProperty('--p', ((v - 40) / 50 * 100) + '%');
    $('fan-max-v').textContent = v + '%';
    const w = $('fan-warn');
    w.className = 'fan-warn' + (v > 80 ? ' hot' : v < 55 ? ' low' : '');
    w.textContent = v >= 90 ? "90% is as far as TEMPO goes. It's loud, and only a degree or two cooler than 80%."
      : v > 80 ? 'Above 80% the fans get loud and wear faster, for a few degrees at most. Most cards are happiest between 60 and 75%.'
      : v < 55 ? 'Low: in a long match your card may run hotter than it would by itself. It still protects itself.'
      : 'Around 60 to 75% keeps most cards cool without much noise.';
  }
  $('fan-max').addEventListener('input', () => { paintFanMax(); putSet('cooling.max', +$('fan-max').value); drawFanGraph(); $('fan-presets').innerHTML = presetsHtml(); });
  $('fan-max').addEventListener('change', () => set('cooling.max', +$('fan-max').value));
  $('fan-hear').addEventListener('click', () => { if (!$('fan-hear').disabled) { $('fan-hear').disabled = true; send({ t: 'fanListen', percent: fanLimit() }); } });
  function listenCountdown(sec) {
    S.listenLeft = sec;
    clearInterval(listenCountdown.t);
    listenCountdown.t = setInterval(() => { S.listenLeft--; if (S.listenLeft <= 0) { clearInterval(listenCountdown.t); S.listenLeft = 0; send({ t: 'fans' }); } renderFans(); }, 1000);
    renderFans();
  }
  document.addEventListener('click', e => {
    const p = e.target.closest('[data-preset]');
    if (!p) return;
    const id = p.dataset.preset;
    if (id === 'custom' && !(coolOpts().points && coolOpts().points.length >= 2)) { set('cooling.points', curvePts()); return; } // start from the curve you see
    set('cooling.preset', id);
  });

  // the graph: heat across, fan speed up; your highest speed, the loud band, the card's heat limit, where it spent the last match
  function lastTemps() {
    const s = S.sessions.find(x => x.seriesTemp && x.seriesTemp.some(v => v > 0));
    return s ? s.seriesTemp.filter(v => v > 0) : null;
  }
  function drawFanGraph() {
    const svg = $('fan-svg');
    if (!svg || S.page !== 'fans') return;
    const pts = S.fanDrag ? S.fanDrag.pts : curvePts(), max = fanLimit();
    const F = S.fans || {}, min = F.min || 0, hot = F.hot || 87;
    const rgb = getComputedStyle(document.documentElement).getPropertyValue('--acc-rgb').trim();
    const x0 = FG.l, x1 = FG.w - FG.r, y0 = FG.t, y1 = FG.h - FG.b;
    let h = `<defs><linearGradient id="fg-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgb(${rgb})" stop-opacity=".26"/><stop offset="1" stop-color="rgb(${rgb})" stop-opacity="0"/></linearGradient>
      <pattern id="fg-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7" stroke="rgba(255,107,87,.22)" stroke-width="2"/></pattern>
      <filter id="fg-glow" x="-10%" y="-30%" width="120%" height="160%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;
    // zones: never (90-100), loud (80-90), above your limit
    h += `<rect x="${x0}" y="${fgY(100)}" width="${x1 - x0}" height="${fgY(90) - fgY(100)}" fill="url(#fg-hatch)"/><text x="${x1 - 6}" y="${fgY(95) + 3.5}" class="fg-z" text-anchor="end">TEMPO never goes here</text>`;
    h += `<rect x="${x0}" y="${fgY(90)}" width="${x1 - x0}" height="${fgY(80) - fgY(90)}" fill="rgba(255,181,71,.06)"/><text x="${x1 - 6}" y="${fgY(85) + 3.5}" class="fg-z amber" text-anchor="end">loud</text>`;
    // grid
    for (let f = 0; f <= 100; f += 20) h += `<line x1="${x0}" x2="${x1}" y1="${fgY(f)}" y2="${fgY(f)}" class="fg-grid"/><text x="${x0 - 8}" y="${fgY(f) + 3.5}" class="fg-ax" text-anchor="end">${f}%</text>`;
    for (let t = 30; t <= 90; t += 10) h += `<line x1="${fgX(t)}" x2="${fgX(t)}" y1="${y0}" y2="${y1}" class="fg-grid v"/><text x="${fgX(t)}" y="${y1 + 18}" class="fg-ax" text-anchor="middle">${t}°</text>`;
    // where the card spent the last match: a soft histogram on the floor
    const temps = lastTemps();
    if (temps && temps.length > 4) {
      const bins = new Array(33).fill(0);
      temps.forEach(v => { const i = Math.max(0, Math.min(32, Math.floor((v - 30) / 2))); bins[i]++; });
      const top = Math.max(...bins);
      bins.forEach((n, i) => { if (!n) return; const bh = n / top * 52; h += `<rect x="${fgX(30 + i * 2) + 1}" y="${y1 - bh}" width="${fgX(32) - fgX(30) - 2}" height="${bh}" rx="2" class="fg-hist"/>`; });
    }
    // the heat limit: from here, your highest speed straight away
    h += `<line x1="${fgX(hot)}" x2="${fgX(hot)}" y1="${y0}" y2="${y1}" class="fg-hot"/><text x="${fgX(hot) + 5}" y="${y1 - 8}" class="fg-z amber">heat limit</text>`;
    // your highest speed
    h += `<line x1="${x0}" x2="${x1}" y1="${fgY(max)}" y2="${fgY(max)}" class="fg-max"/><text x="${x0 + 8}" y="${fgY(max) - 7}" class="fg-maxt">YOUR HIGHEST · ${max}%</text>`;
    // the curve, as the fans will follow it (flat before the first point and after the last, never above your highest)
    const at = t => t >= hot ? max : curveAt(pts, t, max, min);
    const exact = t => t >= hot ? max : curveAt(pts, t, max, min, true);
    const line = [];
    for (let t = FG.t0; t <= FG.t1 + 0.01; t += 0.5) { if (t > hot - 0.5 && t < hot) { line.push([fgX(hot), fgY(exact(hot - 0.01))]); } line.push([fgX(t), fgY(exact(t))]); }
    const d = line.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
    h += `<path d="${d} L${x1} ${y1} L${x0} ${y1} Z" fill="url(#fg-fill)"/>`;
    // where your own points ask for more than your highest: shown faint, so it's clear what's cut off
    const raw = pts.map(p => [fgX(p[0]), fgY(p[1])]);
    if (pts.some(p => p[1] > max)) h += `<path d="${raw.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')}" class="fg-raw"/>`;
    h += `<path d="${d}" class="fg-line" filter="url(#fg-glow)"/>`;
    pts.forEach((p, i) => { h += `<g class="fg-pt${S.fanDrag && S.fanDrag.i === i ? ' drag' : ''}" data-i="${i}"><circle cx="${fgX(p[0])}" cy="${fgY(Math.min(p[1], 100))}" r="14" class="fg-hit"/><circle cx="${fgX(p[0])}" cy="${fgY(Math.min(p[1], 100))}" r="6" class="fg-dot"/></g>`; });
    // now: the card's heat and its fans
    const sys = S.live && S.live.sys, cs = coolState();
    const temp = sys && sys.temp != null ? sys.temp : F.temp, fan = sys && sys.fan != null ? sys.fan : F.speed;
    if (temp != null && temp > 0) {
      const nx = fgX(Math.max(FG.t0, Math.min(FG.t1, temp))), ny = fgY(fan != null ? fan : at(temp));
      h += `<line x1="${nx}" x2="${nx}" y1="${ny}" y2="${y1}" class="fg-now-l"/><line x1="${x0}" x2="${nx}" y1="${ny}" y2="${ny}" class="fg-now-l"/>`;
      h += `<circle cx="${nx}" cy="${ny}" r="12" class="fg-now-ring${cs.state === 'on' || cs.state === 'listen' ? ' live' : ''}"/><circle cx="${nx}" cy="${ny}" r="5" class="fg-now"/>`;
      h += `<text x="${nx + (nx > x1 - 120 ? -12 : 12)}" y="${ny - 12}" class="fg-nowt" text-anchor="${nx > x1 - 120 ? 'end' : 'start'}">NOW ${fmt(temp)}° · ${fan != null ? fmt(fan) : at(temp)}%</text>`;
    }
    // hover: what the fans would do at any heat
    if (S.fanHover != null && !S.fanDrag) {
      const t = S.fanHover, hx = fgX(t), hy = fgY(at(t));
      h += `<line x1="${hx}" x2="${hx}" y1="${y0}" y2="${y1}" class="fg-hover"/><circle cx="${hx}" cy="${hy}" r="4" class="fg-hdot"/>`;
    }
    svg.innerHTML = h;
    const tRead = S.fanDrag ? S.fanDrag.pts[S.fanDrag.i][0] : S.fanHover;
    $('fg-read').innerHTML = tRead != null ? `At <b>${Math.round(tRead)} °C</b> the fans run at <b>${at(tRead)}%</b>` : `<span>Drag a point to make the curve your own</span>`;
    $('fg-note').innerHTML = (temps ? `The soft bars along the bottom are where your card spent your last match${temps.length ? `, up to <b>${fmt(Math.max(...temps))} °C</b>` : ''}. ` : '') +
      `From the heat limit (<b>${hot} °C</b>) the fans go straight to your highest speed. Below the card's lowest (${min}%) they never go.`;
  }
  // dragging a point: across for heat, up for speed (it becomes your own curve)
  (() => {
    const svg = $('fan-svg');
    const toData = e => {
      const r = svg.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width * FG.w, y = (e.clientY - r.top) / r.height * FG.h;
      return [FG.t0 + (x - FG.l) / (FG.w - FG.l - FG.r) * (FG.t1 - FG.t0), (1 - (y - FG.t) / (FG.h - FG.t - FG.b)) * 100];
    };
    svg.addEventListener('pointerdown', e => {
      const g = e.target.closest('.fg-pt');
      if (!g) return;
      svg.setPointerCapture(e.pointerId);
      S.fanDrag = { i: +g.dataset.i, pts: curvePts() };
      body.classList.add('fan-dragging');
      drawFanGraph();
    });
    svg.addEventListener('pointermove', e => {
      const [t, f] = toData(e);
      if (!S.fanDrag) { S.fanHover = t >= FG.t0 && t <= FG.t1 ? t : null; drawFanGraph(); return; }
      const { i, pts } = S.fanDrag;
      const lo = i > 0 ? pts[i - 1][0] + 3 : 25, hi = i < pts.length - 1 ? pts[i + 1][0] - 3 : 95;
      pts[i] = [Math.round(Math.max(lo, Math.min(hi, t))), Math.round(Math.max(0, Math.min(100, f)))];
      drawFanGraph();
    });
    const end = () => {
      if (!S.fanDrag) return;
      const pts = S.fanDrag.pts;
      S.fanDrag = null;
      body.classList.remove('fan-dragging');
      putSet('cooling.preset', 'custom');
      set('cooling.points', pts);
    };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
    svg.addEventListener('pointerleave', () => { if (!S.fanDrag) { S.fanHover = null; drawFanGraph(); } });
  })();
  // the last matches, any game: how hot, how loud, how long the card held itself back
  function renderFanHistory() {
    const list = S.sessions.filter(s => s.maxGpuTemp > 0).slice(0, 6);
    const box = $('fg-hist');
    if (!list.length) { box.innerHTML = `<p class="note" style="margin:0">After a match, its heat and fan speed show here, so you can see what the curve did.</p>`; return; }
    const spark = s => {
      const t = (s.seriesTemp || []).filter(v => v > 0);
      if (t.length < 4) return '';
      const lo = 40, hi = 95, X = i => i / (t.length - 1) * 96 + 2, Y = v => 24 - (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo) * 20;
      const fan = (s.seriesFan || []).filter(v => v >= 0);
      const fx = i => i / (fan.length - 1) * 96 + 2, fy = v => 24 - v / 100 * 20;
      return `<svg viewBox="0 0 100 26" class="fh-spark" aria-hidden="true">${fan.length > 3 ? `<path d="${fan.map((v, i) => `${i ? 'L' : 'M'}${fx(i).toFixed(1)} ${fy(v).toFixed(1)}`).join(' ')}" class="fh-fan"/>` : ''}<path d="${t.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(' ')}" class="fh-temp"/></svg>`;
    };
    box.innerHTML = list.map(s => {
      const heat = s.maxGpuTemp >= 83 ? 'hot' : s.maxGpuTemp >= 76 ? 'warm' : 'ok';
      const held = s.gpuSlowSeconds >= 60 ? `held back ${dur(s.gpuSlowSeconds)}` : 'never held back';
      return `<div class="fh-row"><div class="fh-g"><b>${esc(s.gameName)}</b><small>${when(s.started)} · ${dur(s.seconds)}${s.fanCurve ? ` · <em>TEMPO's curve</em>` : ''}</small></div>
        ${spark(s)}<div class="fh-n ${heat}"><b>${fmt(s.maxGpuTemp)}°</b><small>peak</small></div><div class="fh-n"><b>${s.avgFan >= 0 ? fmt(s.avgFan) + '%' : '–'}</b><small>fans</small></div><div class="fh-held ${s.gpuSlowSeconds >= 60 ? 'warn' : ''}">${held}</div></div>`;
    }).join('');
  }

  // ------------------------------------------------------------------ aim page
  // Smoother aim: what gets in its way on this PC (mouse, frames, screen sync, freezes, sensitivity), the sensitivity in
  // real numbers, a finder that measures the sensitivity the hand is best at, and a curve set through Raw Accel.
  const AIM = { st: null, open: null, draft: null, drag: null };
  const ENGINES = [['deadlock', 'Deadlock', 0.022], ['cs2', 'Counter-Strike 2', 0.022], ['apex', 'Apex Legends', 0.022], ['valorant', 'Valorant', 0.07], ['overwatch', 'Overwatch 2', 0.0066], ['tf2', 'Team Fortress 2', 0.022]]
    .map(([id, name, yaw]) => ({ id, name, yaw }));
  const aimOpts = () => S.settings.aim || {};
  const engines = () => (AIM.st && AIM.st.engines && AIM.st.engines.length ? AIM.st.engines : ENGINES);
  const sensFmt = v => !isFinite(v) || v <= 0 ? '–' : v >= 10 ? v.toFixed(1) : v >= 0.5 ? v.toFixed(2) : v.toFixed(3);
  const cmOf = c360 => { const d = aimOpts().dpi; return d > 0 && c360 > 0 ? c360 / d * 2.54 : 0; };
  /** The sensitivity everything starts from: a game TEMPO read, or one typed in. */
  function aimBase() {
    const o = aimOpts(), list = (AIM.st && AIM.st.sens) || [];
    let b = null;
    if (o.base === 'manual' || (!list.length && o.manualSens > 0)) {
      const e = engines().find(x => x.id === (o.manualEngine || 'deadlock')) || engines()[0];
      if (o.manualSens > 0) b = { gameId: 'manual:' + e.id, name: e.name, sens: o.manualSens, yaw: e.yaw, manual: true, engine: e.id };
    } else {
      const g = list.find(x => x.gameId === o.base) || list.find(x => x.gameId === S.settings.selectedGame) || list[0];
      if (g) b = Object.assign({}, g, { engine: (engines().find(e => e.name === g.name) || {}).id || '' });
    }
    if (b) { b.c360 = 360 / (b.sens * b.yaw); b.cm = cmOf(b.c360); }
    return b;
  }
  const lastFind = b => (aimOpts().finds || []).find(f => b && f.baseGame === b.gameId) || null;

  // ---- what gets in the way of smooth aim
  function saFactors() {
    const out = [], g = sel(), b = aimBase();
    const ss = (g ? sessionsOf(g.id) : S.sessions).slice(0, 3), gname = g ? esc(g.name) : 'your';
    // the mouse
    const la = S.settings.lastAim;
    if (la && la.verdict && la.verdict !== 'none' && la.verdict !== 'error') {
      const on = Math.round(la.onTime * 100);
      out.push(la.verdict === 'ok'
        ? { id: 'mouse', name: 'Your mouse', st: 'good', short: `${la.nominal} Hz · ${on}% on time`, text: `It sends ${la.nominal} reports a second and ${on}% arrive right on time, so the mouse itself isn't what makes aim feel rough.`, act: [['Check again', 'mouse']] }
        : { id: 'mouse', name: 'Your mouse', st: 'fix', short: la.verdict === 'slow' ? `only ${la.nominal} Hz` : `${100 - on}% off beat`, text: AIM_SAY[la.verdict](la).replace(/<[^>]+>/g, ''), act: [['Check again', 'mouse']] });
    } else out.push({ id: 'mouse', name: 'Your mouse', st: 'unknown', short: 'not checked yet', text: 'Eight seconds of moving your mouse in circles shows whether its reports arrive evenly: the same reports games read.', act: [['Check my mouse', 'mouse']] });
    // even frames
    const sm = ss.map(smoothOf).filter(v => v != null), withFps = ss.filter(s => s.avgFps > 0 && s.low1 > 0);
    if (!withFps.length) out.push({ id: 'frames', name: 'Even frames', st: 'unknown', short: 'play a match first', text: `Play one match with TEMPO on${g ? ` (${gname})` : ''}, and this shows how evenly your frames came.` });
    else {
      const avg = withFps.reduce((a, s) => a + s.avgFps, 0) / withFps.length, low = withFps.reduce((a, s) => a + s.low1, 0) / withFps.length;
      const smooth = sm.length ? Math.round(sm.reduce((a, v) => a + v, 0) / sm.length) : null, ratio = low / avg;
      const good = ratio >= 0.68 && (smooth == null || smooth >= 92);
      const T = S.tune && g && S.tune.game === g.id ? S.tune : null, cap = T && T.cap && T.cap.cap > 0 ? Math.round(T.cap.cap) : 0;
      const capKey = T && (T.config && T.config.capKey || ((T.settings || []).some(x => x.key === 'nv.frl') ? 'nv.frl' : null));
      const act = cap && capKey && !T.running ? [[`Set a limit of ${cap}`, 'cap', `${capKey}|${cap}`]] : [['Open Tune', 'tune']];
      out.push(good
        ? { id: 'frames', name: 'Even frames', st: 'good', short: smooth != null ? `${smooth}% on pace` : 'steady', text: `In your last ${withFps.length === 1 ? 'match' : withFps.length + ' matches'} the slowest moments stayed at ${Math.round(ratio * 100)}% of your ${Math.round(avg)} fps average. Steady frames, so every hand movement turns the view the same way.` }
        : { id: 'frames', name: 'Even frames', st: 'fix', short: `${Math.round(avg)} fps, dips to ${Math.round(low)}`, act,
            text: `Your fps averaged ${Math.round(avg)} but dropped to ${Math.round(low)} in the busiest moments${smooth != null ? `, and ${100 - smooth}% of frames came off pace` : ''}. When the fps jumps, the same hand movement turns the view a different amount from frame to frame, which feels like rough aim. A limit just under what your PC holds makes every frame take the same time${cap ? `: TEMPO suggests ${cap}` : ''}.` });
    }
    // the screen following the frames
    const sy = AIM.st && AIM.st.sync;
    if (!AIM.st) out.push({ id: 'sync', name: 'Screen sync', st: 'unknown', short: 'reading your screen…', text: '' });
    else if (!sy) out.push({ id: 'sync', name: 'Screen sync', st: 'unknown', short: 'no screen found', text: 'TEMPO couldn\'t read your screen.' });
    else out.push({ id: 'sync', name: 'Screen sync', st: { cable: 'fix', turnon: 'check', maybe: 'check', none: 'info' }[sy.kind] || 'info',
      short: { cable: 'FreeSync unused (HDMI)', turnon: 'make sure it\'s on', maybe: 'check your screen', none: 'fixed refresh' }[sy.kind] || '', text: `<b>${esc(sy.title)}.</b> ${esc(sy.text)}` });
    // the screen's own speed in the game (Deadlock's setting can run a 144 Hz screen at 50 Hz)
    const rf = AIM.st && AIM.st.refresh && b ? AIM.st.refresh.find(x => x.gameId === b.gameId) || AIM.st.refresh[0] : null;
    if (rf && rf.hz > 0 && rf.desktopHz > 0) {
      const slow = rf.fullscreen && rf.hz < rf.desktopHz - 1;
      out.push(slow ? { id: 'refresh', name: 'Screen speed in the game', st: 'fix', short: `only ${rf.hz} Hz`, act: [[`Set ${esc(rf.name)} to ${rf.desktopHz} Hz`, 'hz', rf.gameId]],
          text: `${esc(rf.name)} is set to run your screen at ${rf.hz} Hz, but it can do ${rf.desktopHz}. So you see only ${rf.hz} pictures a second: every mouse movement looks steppy and reaches your eyes later. This is the biggest smoothing you can get for your mouse, for free.` }
        : { id: 'refresh', name: 'Screen speed in the game', st: 'good', short: `${rf.fullscreen ? rf.hz : rf.desktopHz} Hz`, text: `${esc(rf.name)} uses your screen at its full ${rf.fullscreen ? rf.hz : rf.desktopHz} Hz.` });
    }
    // freezes from other apps
    if (!ss.length) out.push({ id: 'freezes', name: 'No freezes', st: 'unknown', short: 'play a match first', text: 'After a match, TEMPO names any app that froze the game.' });
    else {
      const c = ss.map(s => s.culprit).find(c => c && c.freezes >= 2);
      out.push(c ? { id: 'freezes', name: 'No freezes', st: 'fix', short: `${c.label} froze it ${c.freezes}×`, text: `Each freeze stops your view for a moment, often mid-aim. ${esc(c.fix)}` }
        : { id: 'freezes', name: 'No freezes', st: 'good', short: 'none from other apps', text: 'No other app froze the game in your last matches.' });
    }
    // the sensitivity itself
    const f = lastFind(b);
    if (!b) out.push({ id: 'sens', name: 'Sensitivity that fits', st: 'unknown', short: 'add your sensitivity', text: 'Pick your game\'s sensitivity on the right, then the finder can measure what suits your hand.' });
    else if (!f) out.push({ id: 'sens', name: 'Sensitivity that fits', st: 'unknown', short: 'not measured yet', text: 'The finder measures, in about two and a half minutes, which sensitivity your hand tracks and flicks best with.', act: [['Find mine', 'finder']] });
    else if (Math.abs(f.baseSens - b.sens) / b.sens > 0.01) out.push({ id: 'sens', name: 'Sensitivity that fits', st: 'check', short: 'changed since the test', text: `You changed ${esc(b.name)} to ${sensFmt(b.sens)} since the last test, which suggested ${sensFmt(f.baseSens * f.best)}. Run it again to see how the new one suits you.`, act: [['Run it again', 'finder']] });
    else if (f.curve) {
      const on = AIM.st && AIM.st.rawAccel && AIM.st.rawAccel.ours;
      out.push(on ? { id: 'sens', name: 'Sensitivity that fits', st: 'good', short: `curve on · ×${fmt(on.max, 2)}`, text: `${esc(f.say)} The curve is set in Raw Accel.` }
        : { id: 'sens', name: 'Sensitivity that fits', st: 'fix', short: 'a curve would help', text: esc(f.say), act: [['See the curve', 'curve']] });
    }
    else if (f.close || Math.abs(Math.log(f.best)) < Math.log(1.06)) out.push({ id: 'sens', name: 'Sensitivity that fits', st: 'good', short: 'fits your hand', text: esc(f.say || 'Your sensitivity is close to where your hand did best.') });
    else out.push({ id: 'sens', name: 'Sensitivity that fits', st: 'fix', short: `try ${sensFmt(b.sens * f.best)}`, text: esc(f.say || ''), act: [['See the result', 'result']] });
    return out;
  }
  const SA_ICON = { refresh: 'M4 6.5h16v11H4zM8 12h2l1.5-3 2 6 1.5-3h1', mouse: 'M12 3.5a5 5 0 0 1 5 5v7a5 5 0 0 1-10 0v-7a5 5 0 0 1 5-5ZM12 7v3', frames: 'M3 17l4-5 4 3 4-7 6 9', sync: 'M4 7.5h16v10H4zM9 21h6M12 17.5V21', freezes: 'M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9', sens: 'M12 3v3M12 18v3M3 12h3M18 12h3M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z' };
  function renderSA() {
    const box = $('sa');
    if (!box || S.page !== 'aim') return;
    const f = saFactors(), good = f.filter(x => x.st === 'good').length, fix = f.filter(x => x.st === 'fix').length, check = f.filter(x => x.st === 'check').length;
    const known = f.filter(x => x.st !== 'unknown' && x.st !== 'info').length;
    if (AIM.open == null || !f.some(x => x.id === AIM.open)) AIM.open = (f.find(x => x.st === 'fix') || f.find(x => x.st === 'check') || f.find(x => x.st === 'unknown') || {}).id || null;
    const words = ['Nothing', 'One thing', 'Two things', 'Three things', 'Four things', 'Five things'];
    const title = fix ? `${words[fix]} in the way` : check ? `Almost there` : known ? 'Nothing in the way' : 'Let\'s see what\'s in the way';
    const sub = fix ? 'Fix these first; they make aim feel rough whatever your sensitivity.' : check ? `${check === 1 ? 'One thing' : words[check] + 's'} to check yourself.` : known ? 'Your PC isn\'t what\'s holding your aim back.' : 'A match with TEMPO on and an 8-second mouse check fill this in.';
    const R = 26, C = 2 * Math.PI * R, frac = known ? good / f.length : 0;
    box.innerHTML = `<div class="sa-top">
        <div class="sa-ring"><svg viewBox="0 0 64 64" width="64" height="64"><circle cx="32" cy="32" r="${R}" class="sa-tr"/><circle cx="32" cy="32" r="${R}" class="sa-pr" style="stroke-dasharray:${(C * frac).toFixed(1)} ${C.toFixed(1)}"/></svg><b>${good}</b><small>OF ${f.length}</small></div>
        <div><div class="sa-k">SMOOTH AIM</div><div class="sa-t">${title}</div><p class="sa-p">${sub}</p></div></div>
      <div class="sa-list">${f.map(x => `<div class="sa-item st-${x.st}${AIM.open === x.id ? ' open' : ''}">
        <button type="button" class="sa-row" data-sa="${x.id}"><i class="sa-ic"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${SA_ICON[x.id]}"/></svg></i><span class="sa-n">${x.name}</span><span class="sa-s">${esc(x.short)}</span><i class="sa-dot"></i><i class="sa-chev"></i></button>
        <div class="sa-more"><div><p>${x.text}</p>${x.act ? `<div class="sa-act">${x.act.map(([label, what, arg], i) => `<button type="button" class="btn${i ? '' : ' acc'}" data-sa-do="${what}"${arg ? ` data-arg="${esc(arg)}"` : ''}>${esc(label)}</button>`).join('')}</div>` : ''}</div></div></div>`).join('')}</div>`;
  }
  document.addEventListener('click', e => {
    const r = e.target.closest('[data-sa]');
    if (r) { AIM.open = AIM.open === r.dataset.sa ? '' : r.dataset.sa; renderSA(); return; }
    const d = e.target.closest('[data-sa-do]');
    if (!d) return;
    const what = d.dataset.saDo, g = sel();
    if (what === 'mouse') { $('aim').scrollIntoView({ behavior: still() ? 'auto' : 'smooth', block: 'center' }); if (!aim.on) aimStart(); }
    if (what === 'tune') go('tune');
    if (what === 'finder') trainerOpen();
    if (what === 'hz') { send({ t: 'aimHz', game: d.dataset.arg }); d.disabled = true; d.textContent = 'Set'; }
    if (what === 'curve') $('cv-card').scrollIntoView({ behavior: still() ? 'auto' : 'smooth', block: 'start' });
    if (what === 'result') { const f = lastFind(aimBase()); if (f) trainerResult(f, false); }
    if (what === 'cap' && g) { const [key, v] = d.dataset.arg.split('|'); send({ t: 'setNow', game: g.id, key, value: v, label: `Fps limit at ${v}` }); d.disabled = true; d.textContent = `Limit ${v} set`; }
  });

  // ---- the sensitivity in real numbers
  const BANDS = [[0, 15, 'very fast'], [15, 25, 'fast · wrist'], [25, 40, 'medium'], [40, 60, 'slow · arm'], [60, 999, 'very slow']];
  function renderSens() {
    const box = $('as-card');
    if (!box || S.page !== 'aim') return;
    const o = aimOpts(), b = aimBase(), list = (AIM.st && AIM.st.sens) || [];
    const manual = o.base === 'manual' || !list.length;
    const opts = list.map(x => `<option value="${esc(x.gameId)}"${!manual && b && b.gameId === x.gameId ? ' selected' : ''}>${esc(x.name)} · ${sensFmt(x.sens)}</option>`).join('') + `<option value="manual"${manual ? ' selected' : ''}>Another game…</option>`;
    const eopts = engines().map(e => `<option value="${e.id}"${(o.manualEngine || 'deadlock') === e.id ? ' selected' : ''}>${esc(e.name)}</option>`).join('');
    let big = '', sub = '', scale = '';
    if (b) {
      const cm = b.cm;
      big = cm ? `<b class="as-big">${cm.toFixed(1)}</b><span class="as-u">cm per 360°</span>` : `<b class="as-big">${Math.round(b.c360).toLocaleString()}</b><span class="as-u">mouse counts per 360°</span>`;
      sub = `${esc(b.name)} ${sensFmt(b.sens)}${o.dpi > 0 ? ` · ${o.dpi} DPI · eDPI ${Math.round(b.sens * o.dpi * (b.yaw / 0.022))}` : ''}${b.place ? ` · <span class="mono" title="${esc(b.place)}">from its settings</span>` : ''}`;
      if (cm) {
        const lo = Math.log(8), hi = Math.log(90), x = v => Math.max(0, Math.min(100, (Math.log(v) - lo) / (hi - lo) * 100));
        const band = BANDS.find(([a, z]) => cm >= a && cm < z);
        scale = `<div class="as-scale">${BANDS.map(([a, z, n]) => `<i class="${band && band[2] === n ? 'on' : ''}" style="left:${x(Math.max(a, 8))}%;width:${x(Math.min(z, 90)) - x(Math.max(a, 8))}%"><span>${n}</span></i>`).join('')}<b class="as-mark" style="left:${x(cm)}%"></b></div>
          <p class="as-note">${band && cm < 25 ? 'On the fast side: big turns are easy, steady tracking takes a light touch. Most wrist aimers sit between 20 and 35 cm.' : band && cm < 40 ? 'In the middle: room for both wrist and arm.' : 'On the slow side: precise tracking, big turns use the whole arm.'}</p>`;
      }
    }
    const conv = b ? engines().filter(e => e.name !== b.name).map(e => { const v = b.sens * b.yaw / e.yaw; return `<button type="button" class="as-chip" data-copy="${sensFmt(v)}" title="Copy">${esc(e.name)} <b>${sensFmt(v)}</b></button>`; }).join('') : '';
    box.innerHTML = `<div class="ac-h"><span class="ac-k">YOUR SENSITIVITY</span><label class="as-pick"><select id="as-base">${opts}</select></label></div>
      ${manual ? `<div class="as-manual"><label><span>Game</span><select id="as-engine">${eopts}</select></label><label><span>Its sensitivity</span><input id="as-sens" type="number" min="0.01" max="200" step="0.01" value="${o.manualSens > 0 ? o.manualSens : ''}" placeholder="1.15"></label></div>` : ''}
      ${b ? `<div class="as-main">${big}</div><div class="as-sub">${sub}</div>${scale}` : `<p class="note">Pick a game and type its sensitivity: it's in the game's mouse settings.</p>`}
      <div class="as-dpi"><label><span>Mouse DPI</span><input id="as-dpi" type="number" min="100" max="64000" step="50" value="${o.dpi > 0 ? o.dpi : ''}" placeholder="800"></label><small>${o.dpi > 0 ? 'From your mouse\'s own app (Razer Synapse, G HUB…). TEMPO can\'t read it from the mouse.' : 'Add it to see centimetres. It\'s in your mouse\'s own app (Razer Synapse, G HUB…), often 800 or 1600.'}</small></div>
      ${conv ? `<div class="as-conv"><div class="lab" style="margin:0 0 8px">The same feel in</div><div class="as-chips">${conv}</div></div>` : ''}`;
  }
  document.addEventListener('change', e => {
    const id = e.target.id;
    if (id === 'as-base') { const v = e.target.value; putSet('aim.base', v); send({ t: 'aimSet', base: v }); renderAimPage(); }
    if (id === 'as-engine') { putSet('aim.manualEngine', e.target.value); putSet('aim.base', 'manual'); send({ t: 'aimSet', engine: e.target.value, base: 'manual' }); renderAimPage(); }
    if (id === 'as-sens') { const v = +e.target.value || 0; putSet('aim.manualSens', v); putSet('aim.base', 'manual'); send({ t: 'aimSet', sens: v, base: 'manual' }); renderAimPage(); }
    if (id === 'as-dpi') { const v = Math.round(+e.target.value || 0); putSet('aim.dpi', v); send({ t: 'aimSet', dpi: v }); renderAimPage(); }
  });
  document.addEventListener('click', e => {
    const c = e.target.closest('[data-copy]');
    if (!c) return;
    try { navigator.clipboard.writeText(c.dataset.copy).catch(() => { }); } catch { }
    toast(`Copied ${c.dataset.copy}`);
  });

  // ---- the finder card on the page
  function renderFinderCard() {
    const box = $('fd-card');
    if (!box || S.page !== 'aim') return;
    const b = aimBase(), f = lastFind(b);
    box.innerHTML = `<div class="ac-h"><span class="ac-k">SENSITIVITY FINDER</span><span class="ac-meta">about 3 minutes</span></div>
      <div class="fd-hero">
        <svg class="fd-art" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="50" class="fd-a1"/><circle cx="60" cy="60" r="33" class="fd-a2"/><path d="M60 38v10M60 72v10M38 60h10M72 60h10" class="fd-x"/><circle cx="60" cy="60" r="2.4" class="fd-c"/><circle cx="88" cy="40" r="6" class="fd-o"/><circle cx="34" cy="82" r="4" class="fd-o2"/></svg>
        <div><b>Find the sensitivity your hand is best at</b>
        <p>Track a moving target, then flick to targets, at a few sensitivities around yours without knowing which is which. TEMPO measures how steadily you track and how quickly you land, and finds where each is best: if they're far apart, a curve can give you both.</p>
        <div class="fd-act"><button type="button" class="btn acc" data-fd="start"${b ? '' : ' disabled'}>${f ? 'Run it again' : 'Find mine'}</button>${f ? `<button type="button" class="btn" data-fd="result">See the last result</button>` : ''}${f && testPair(f) ? `<button type="button" class="btn" data-fd="check">Check it blind</button><button type="button" class="btn" data-fd="practice">Practise</button>` : ''}${b ? '' : '<span class="note" style="margin:0">Pick your sensitivity first.</span>'}</div></div>
      </div>
      ${f ? `<div class="fd-last"><div class="fd-l-k">${when(f.when)} · ${esc(f.baseName)} ${sensFmt(f.baseSens)}</div><p>${esc(f.say)}</p>${lastCheck(f) ? `<p class="fd-check">${esc(lastCheck(f).say)}</p>` : ''}</div>` : ''}`;
  }
  document.addEventListener('click', e => {
    const d = e.target.closest('[data-fd]');
    if (!d) return;
    if (d.dataset.fd === 'start') trainerOpen();
    if (d.dataset.fd === 'result') { const f = lastFind(aimBase()); if (f) trainerResult(f, false); }
    if (d.dataset.fd === 'check' || d.dataset.fd === 'practice') trTest(d.dataset.fd, lastFind(aimBase()));
  });

  // ---- the curve: slow for tracking, quick for big turns (through Raw Accel)
  const CG = { w: 520, h: 230, l: 40, r: 12, t: 14, b: 30 };
  // counts per ms for a hand speed in cm/s (Raw Accel measures in counts per ms); 800 DPI when the DPI isn't known
  const cps = cm => cm / 2.54 * (aimOpts().dpi > 0 ? aimOpts().dpi : 800) / 1000;
  const gentle = max => ({ start: +cps(8).toFixed(2), top: +cps(45).toFixed(2), max, src: max > 1.4 ? 'draft' : 'gentle' });
  function curveNow() {
    const o = aimOpts(), f = lastFind(aimBase());
    if (AIM.draft) return AIM.draft;
    if (o.curve) return { start: o.curve.start, top: o.curve.top, max: o.curve.max, src: 'set' };
    if (f && f.curve) return { start: f.curve.start, top: f.curve.top, max: f.curve.max, src: 'finder' };
    return gentle(1.3);
  }
  const niceStep = v => { const p = Math.pow(10, Math.floor(Math.log10(v))), m = v / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; };
  function renderCurve() {
    const box = $('cv-card');
    if (!box || S.page !== 'aim') return;
    const ra = AIM.st && AIM.st.rawAccel, o = aimOpts(), f = lastFind(aimBase()), c = curveNow(), dpi = o.dpi;
    // the graph: hand speed across, sensitivity up (room for the fastest flicks of the last finder run)
    const peaks = f && f.speeds && f.speeds.flick || [];
    const xMax = Math.max(c.top * 1.45, peaks.length ? trPct(peaks, 0.92) * 1.1 : 0, cps(40)), yMax = Math.max(1.5, c.max + 0.2);
    const k = dpi > 0 ? 2540 / dpi : 0; // cm/s per count/ms
    const X = v => CG.l + v / xMax * (CG.w - CG.l - CG.r), Y = m => CG.t + (1 - (m - 0.8) / (yMax - 0.8)) * (CG.h - CG.t - CG.b);
    const rgb = getComputedStyle(document.documentElement).getPropertyValue('--acc-rgb').trim();
    let g = `<defs><linearGradient id="cv-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgb(${rgb})" stop-opacity=".22"/><stop offset="1" stop-color="rgb(${rgb})" stop-opacity="0"/></linearGradient></defs>`;
    for (let m = 1; m <= yMax + 1e-9; m += 0.25) g += `<line x1="${CG.l}" x2="${CG.w - CG.r}" y1="${Y(m)}" y2="${Y(m)}" class="fg-grid"/><text x="${CG.l - 6}" y="${Y(m) + 3.5}" class="fg-ax" text-anchor="end">×${m.toFixed(2).replace(/0$/, '')}</text>`;
    // ticks at round hand speeds: cm/s when the DPI is known, counts per ms otherwise
    const unitMax = k ? xMax * k : xMax, step = niceStep(unitMax / 4);
    for (let u = 0; u <= unitMax + 1e-9; u += step) { const v = k ? u / k : u; g += `<line x1="${X(v)}" x2="${X(v)}" y1="${CG.t}" y2="${CG.h - CG.b}" class="fg-grid v"/><text x="${X(v)}" y="${CG.h - 10}" class="fg-ax" text-anchor="middle">${u === 0 ? '0' : `${+u.toFixed(1)} ${k ? 'cm/s' : 'c/ms'}`}</text>`; }
    // where the hand moved in the last finder run: tracking speeds and flick peaks
    if (f && f.speeds) {
      const bar = (vals, cls) => { const n = 24, bins = new Array(n).fill(0); vals.forEach(v => { const i = Math.min(n - 1, Math.floor(v / xMax * n)); if (i >= 0) bins[i]++; }); const top = Math.max(1, ...bins); return bins.map((k, i) => k ? `<rect x="${X(i * xMax / n) + 1}" y="${CG.h - CG.b - k / top * 34}" width="${(CG.w - CG.l - CG.r) / n - 2}" height="${k / top * 34}" rx="2" class="${cls}"/>` : '').join(''); };
      g += bar(f.speeds.track || [], 'cv-ht') + bar(f.speeds.flick || [], 'cv-hf');
    }
    const at = v => v <= c.start ? 1 : v >= c.top ? c.max : 1 + (c.max - 1) * (v - c.start) / (c.top - c.start);
    const pts = [[0, 1], [c.start, 1], [c.top, c.max], [xMax, c.max]];
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)} ${Y(p[1]).toFixed(1)}`).join(' ');
    g += `<path d="${d} L${X(xMax)} ${CG.h - CG.b} L${X(0)} ${CG.h - CG.b} Z" fill="url(#cv-fill)"/><path d="${d}" class="fg-line"/>`;
    g += `<line x1="${CG.l}" x2="${CG.w - CG.r}" y1="${Y(1)}" y2="${Y(1)}" class="cv-one"/>`;
    g += `<g class="fg-pt" data-cv="start"><circle cx="${X(c.start)}" cy="${Y(1)}" r="14" class="fg-hit"/><circle cx="${X(c.start)}" cy="${Y(1)}" r="6" class="fg-dot"/></g>`;
    g += `<g class="fg-pt" data-cv="top"><circle cx="${X(c.top)}" cy="${Y(c.max)}" r="14" class="fg-hit"/><circle cx="${X(c.top)}" cy="${Y(c.max)}" r="6" class="fg-dot"/></g>`;
    AIM.cg = { X, Y, xMax, yMax };
    // Raw Accel: what's there, and what TEMPO can do with it
    let raHtml = '';
    if (!ra) raHtml = `<p class="note">Looking for Raw Accel…</p>`;
    else if (!ra.driver) raHtml = `<div class="ra-row"><i class="ra-dot off"></i><div><b>Games read the mouse directly, so a curve needs Raw Accel</b><p>A free, open-source driver many players use for exactly this; it works in every game. Most games allow it, but check your game's rules. TEMPO never installs drivers itself: install Raw Accel, open it once and press Apply, then come back.</p>
        <div class="sa-act"><button type="button" class="btn acc" data-ra="open">Get Raw Accel</button><button type="button" class="btn" data-ra="locate">I have it: find its folder</button></div></div></div>`;
    else if (!ra.dir) raHtml = `<div class="ra-row"><i class="ra-dot"></i><div><b>Raw Accel is installed</b><p>TEMPO couldn't find its folder (the one with writer.exe).</p><div class="sa-act"><button type="button" class="btn acc" data-ra="locate">Find its folder</button></div></div></div>`;
    else if (!ra.hasSettings) raHtml = `<div class="ra-row"><i class="ra-dot"></i><div><b>Open Raw Accel once and press Apply</b><p>That makes its settings file, which TEMPO then sets the curve in.</p></div></div>`;
    else {
      const manual = `Mode Classic · Gain off · Acceleration ${(c.top > c.start ? (c.max - 1) / (c.top - c.start) : 0).toFixed(4)} · Exponent 2 · Input offset ${c.start.toFixed(2)} · Cap (output) ${c.max.toFixed(2)}`;
      const other = !ra.ours && ra.mode && ra.mode !== 'noaccel' ? `<p class="ra-warn">Raw Accel already shapes your mouse (${esc(ra.mode)}${ra.mode === 'classic' && !ra.gain ? `, up to ×${fmt(ra.cap, 2)}` : ''}). The finder measures you as you play now, with it.</p>` : '';
      raHtml = ra.ours
        ? `<div class="ra-row on"><i class="ra-dot"></i><div><b>On: TEMPO's curve, up to ×${fmt(ra.ours.max, 2)}</b><p>Set ${when(ra.ours.applied).replace(/^\w/, ch => ch.toLowerCase())}. Slow aiming is exactly as before; fast moves speed up. Put it back any time.</p>
            <div class="sa-act">${AIM.draft ? `<button type="button" class="btn acc" data-ra="apply">Use this curve</button>` : ''}<button type="button" class="btn" data-ra="putback">Put back</button></div></div></div>`
        : ra.editable
          ? `<div class="ra-row"><i class="ra-dot"></i><div><b>Raw Accel is ready</b><p>TEMPO sets this curve in it (keeping a copy of its settings first) and can put them back any time. Then set ${aimBase() ? `${esc(aimBase().name)} to ${sensFmt(aimBase().sens * (f ? f.trackBest : 1))}` : 'your game'} for tracking.</p>${other}
              <div class="sa-act"><button type="button" class="btn acc" data-ra="apply">Use this curve</button>${o.rawAccelBackup ? '<button type="button" class="btn" data-ra="putback">Put back</button>' : ''}</div></div></div>`
          : `<div class="ra-row"><i class="ra-dot"></i><div><b>Type these into Raw Accel</b><p>Its settings file isn't the shape TEMPO knows, so TEMPO leaves it alone.</p><p class="mono ra-vals">${manual}</p>${other}</div></div>`;
    }
    const srcText = { set: 'The curve TEMPO set', finder: 'From your finder result', gentle: 'A gentle start', draft: 'Your own' }[c.src] || '';
    box.innerHTML = `<div class="ac-h"><span class="ac-k">CURVE</span><span class="ac-meta">slow for tracking, quick for big turns</span></div>
      <p class="cv-say">Below the first point your sensitivity stays exactly as it is, for steady tracking. Faster than that it rises, up to ×${fmt(c.max, 2)} for big, fast turns. Drag the points to shape it. <span class="cv-src">${srcText}${dpi > 0 ? '' : ' · speeds in mouse counts per ms (add your DPI for cm/s)'}${!f ? ' · run the finder first: it measures your own hand speeds and tests a curve against none' : ''}</span></p>
      <div class="cv-presets"><button type="button" class="seg-b${c.src === 'gentle' && !AIM.draft ? ' on' : ''}" data-cvp="gentle">Gentle ×1.3</button>${f && f.curve ? `<button type="button" class="seg-b${c.src === 'finder' ? ' on' : ''}" data-cvp="finder">Yours ×${fmt(f.curve.max, 2)}</button>` : ''}<button type="button" class="seg-b" data-cvp="strong">Strong ×1.6</button></div>
      <div class="fg-wrap cv-wrap"><svg id="cv-svg" viewBox="0 0 ${CG.w} ${CG.h}">${g}</svg></div>
      ${f && f.speeds ? `<div class="cv-leg"><span><i class="t"></i>your tracking speeds</span><span><i class="f"></i>your flicks</span></div>` : ''}
      ${raHtml}`;
  }
  document.addEventListener('click', e => {
    const p = e.target.closest('[data-cvp]');
    if (p) {
      const f = lastFind(aimBase()), base = AIM.draft || curveNow();
      if (p.dataset.cvp === 'finder' && f && f.curve) AIM.draft = Object.assign({}, f.curve, { src: 'finder' });
      else if (p.dataset.cvp === 'gentle') AIM.draft = f && f.curve ? { start: f.curve.start, top: f.curve.top, max: 1.3, src: 'gentle' } : gentle(1.3);
      else AIM.draft = f && f.curve ? { start: f.curve.start, top: f.curve.top, max: 1.6, src: 'draft' } : gentle(1.6);
      renderCurve();
      return;
    }
    const r = e.target.closest('[data-ra]');
    if (!r) return;
    const c = curveNow();
    if (r.dataset.ra === 'apply') { r.disabled = true; send({ t: 'rawAccel', do: 'apply', start: c.start, top: c.top, max: c.max }); AIM.draft = null; }
    else send({ t: 'rawAccel', do: r.dataset.ra });
  });
  (() => {
    // dragging the curve's two points: where it starts rising, and how far up it goes
    const host = $('cv-card');
    if (!host) return;
    const at = e => { const svg = $('cv-svg'), r = svg.getBoundingClientRect(), g = AIM.cg; const x = (e.clientX - r.left) / r.width * CG.w, y = (e.clientY - r.top) / r.height * CG.h; return [(x - CG.l) / (CG.w - CG.l - CG.r) * g.xMax, 0.8 + (1 - (y - CG.t) / (CG.h - CG.t - CG.b)) * (g.yMax - 0.8)]; };
    host.addEventListener('pointerdown', e => { const p = e.target.closest('[data-cv]'); if (!p) return; e.preventDefault(); AIM.drag = p.dataset.cv; AIM.draft = Object.assign({}, curveNow(), { src: 'draft' }); host.setPointerCapture(e.pointerId); });
    host.addEventListener('pointermove', e => {
      if (!AIM.drag) return;
      const [v, m] = at(e), c = AIM.draft;
      if (AIM.drag === 'start') c.start = Math.round(Math.max(0, Math.min(c.top - 1, v)) * 10) / 10;
      else { c.top = Math.round(Math.max(c.start + 1, Math.min(AIM.cg.xMax, v)) * 10) / 10; c.max = Math.round(Math.max(1.05, Math.min(2.5, m)) * 100) / 100; }
      renderCurve();
    });
    const end = () => { AIM.drag = null; };
    host.addEventListener('pointerup', end);
    host.addEventListener('pointercancel', end);
  })();

  function renderAimPage() { if (S.page !== 'aim') return; renderSA(); renderSens(); renderFinderCard(); renderCurve(); }

  // ------------------------------------------------------------------ the sensitivity finder
  // A small first-person range inside TEMPO. The mouse turns the view exactly as in the game the sensitivity comes from
  // (degrees per count from its sensitivity), read raw through pointer lock. Sets at blind sensitivities around yours:
  // tracking a strafing target, then flicking to targets on screen, near and far. Tracking error and flick speed
  // (Fitts throughput) are fitted against the sensitivity; where each peaks is the answer, and if flicks want a lot more
  // than tracking, a curve is tried against a flat sensitivity.
  const TR = { on: false };
  const MULTS = [0.75, 0.87, 1.0, 1.15, 1.33, 1.0];
  // flicks stay on screen, like an aim trainer's: 5° to 40° from where you aim (the view is 100° wide)
  const TRACK_S = 9, FLICKS = [5, 7, 9, 12, 15, 18, 22, 26, 31, 36, 40], R_TRACK = 1.5, R_FLICK = 2.0, FOV = 100;
  const trSim = new URLSearchParams(location.search).get('trsim'); // design checks only: a made-up player
  if (trSim) window.__tr = TR;
  function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  const shuffle = (a, r) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const rad = d => d * Math.PI / 180;
  // great-circle distance between two view directions (degrees)
  function angDist(y1, p1, y2, p2) {
    const c = Math.sin(rad(p1)) * Math.sin(rad(p2)) + Math.cos(rad(p1)) * Math.cos(rad(p2)) * Math.cos(rad(y1 - y2));
    return Math.acos(Math.max(-1, Math.min(1, c))) * 180 / Math.PI;
  }
  // the strafing path the tracking target follows (the same every set, mirrored on every other one)
  function trackPath(seed, len = TRACK_S + 1) {
    const r = rng(seed), segs = [];
    let t = 0, v = 0;
    while (t < len) { const d = 0.35 + r() * 0.8; const sp = (12 + r() * 48) * (r() < 0.5 ? -1 : 1); segs.push([t, d, sp]); t += d; }
    // velocity eased between segments (a strafing player doesn't change direction instantly)
    const vel = tt => { let cur = 0, prev = 0; for (const [t0, d, sp] of segs) { if (tt < t0) break; prev = cur; cur = sp; if (tt < t0 + d) { const k = Math.min(1, (tt - t0) / 0.16); return prev + (cur - prev) * (k * k * (3 - 2 * k)); } } return cur; };
    const tab = [], dt = 1 / 240;
    let yaw = 0;
    // long practice paths drift back towards the middle, so the orb never wanders off for good
    for (let k = 0; k <= len / dt; k++) { tab.push(yaw); yaw += vel(k * dt) * dt - (len > 60 ? yaw * 0.25 * dt : 0); }
    return tt => { const i = Math.max(0, Math.min(tab.length - 1, Math.floor(tt / dt))); return [tab[i], 2.6 * Math.sin(tt * 1.3) + 1.2 * Math.sin(tt * 3.1 + 1)]; };
  }

  // mode: 'find' (the finder), 'check' (the suggestion against yours, blind), 'practice' (free play at either)
  function trainerOpen(opts) {
    const b = aimBase();
    if (!b) { toast('Pick your game\'s sensitivity first.'); return; }
    const mode = (opts && opts.mode) || 'find', pair = opts && opts.pair;
    const sets = shuffle(MULTS, rng(Date.now() & 0xffff));
    Object.assign(TR, {
      on: true, mode, pair: pair || null, base: b, degPerCount: 360 / b.c360, sets, plan: [], i: -1, phase: 'intro', results: [], yaw: 0, pitch: 0, curve: null, analysis: null, result: null, part: null, cur: null, native: false,
      locked: false, raw: true, events: 0, lastT: 0, simT: 0, paused: false, path: trackPath(7), check: null, prac: null, drill: 'wall', burst: null, flash: null,
    });
    if (mode === 'check') {
      // a warm-up at the suggestion, then two rounds each, blind, in a mirrored order (A B B A) so warming up favours neither
      const seq = rng(Date.now() & 0xff)() < 0.5 ? ['mine', 'sug', 'sug', 'mine'] : ['sug', 'mine', 'mine', 'sug'];
      const side = s => ({ mult: (s === 'sug' ? pair.sug : pair.mine) / b.sens, curve: s === 'sug' ? pair.curve : null });
      TR.plan = [Object.assign({ kind: 'warm' }, side('sug'))].concat(seq.map((s, j) => Object.assign({ kind: 'check', side: s, mirror: j % 2 ? -1 : 1, seed: 500 + j }, side(s))));
    } else if (mode === 'practice') TR.plan = [];
    // the finder's plan: a warm-up, the six sets, and (decided later) the curve trial
    else TR.plan = [{ kind: 'warm', mult: 1 }].concat(sets.map((m, k) => ({ kind: 'set', mult: m, mirror: k % 2 ? -1 : 1, seed: 100 + k })));
    $('trainer').hidden = false;
    body.classList.add('tr-on');
    trCard('intro');
    trResize();
    if (!TR.raf) TR.raf = requestAnimationFrame(trFrame);
  }
  function trainerClose() {
    if (TR.native && TR.locked) send({ t: 'trCapture', on: false });
    TR.locked = false;
    body.classList.remove('tr-capture');
    TR.on = false;
    TR.mode = 'find';
    if (document.pointerLockElement) document.exitPointerLock();
    $('trainer').hidden = true;
    body.classList.remove('tr-on');
    if (TR.raf) { cancelAnimationFrame(TR.raf); TR.raf = 0; }
    renderAimPage();
  }
  const trCanvas = () => $('tr-canvas');
  function trResize() {
    const c = trCanvas(), dpr = window.devicePixelRatio || 1;
    c.width = c.clientWidth * dpr; c.height = c.clientHeight * dpr;
  }
  addEventListener('resize', () => { if (TR.on) trResize(); });

  // ---- the cards over the range: intro, between sets, paused, results
  function trCard(kind, extra) {
    const box = $('tr-card'), b = TR.base;
    box.hidden = !kind;
    if (!kind) return;
    box.className = 'tr-card k-' + kind;
    if (kind === 'intro' && TR.mode !== 'find') { box.innerHTML = trTestIntro(); return; }
    if (kind === 'intro') box.innerHTML = `<div class="tr-k">SENSITIVITY FINDER</div><h3>Find the sensitivity your hand is best at</h3>
      <ul class="tr-steps"><li><b>Track</b> the orb as it strafes: keep the crosshair on it.</li><li><b>Flick</b> to each new orb and click it, as fast as you can land it. They pop up on screen around your crosshair, near and far, like in an aim trainer.</li><li>A warm-up, then six short rounds, each at a different sensitivity (four more if a curve looks promising). TEMPO doesn't say which: just aim as well as you can.</li></ul>
      <p class="tr-base">Starting from <b>${esc(b.name)} ${sensFmt(b.sens)}</b>${b.cm ? ` (${b.cm.toFixed(1)} cm per 360°)` : ''}. Use the grip and the arm you play with. Esc pauses.</p>
      <div class="tr-act"><button type="button" class="btn acc tr-go" data-tr="go">Start</button><button type="button" class="btn" data-tr="close">Not now</button></div>`;
    if (kind === 'pause' && TR.mode === 'practice') { box.innerHTML = trPracticePause(); return; }
    if (kind === 'pause') box.innerHTML = `<div class="tr-k">PAUSED</div><h3>Take a breath</h3><p>Your mouse is free again. The round you were in starts over when you continue.</p>
      <div class="tr-act"><button type="button" class="btn acc" data-tr="resume">Continue</button><button type="button" class="btn" data-tr="close">Stop</button></div>`;
    if (kind === 'gap') box.innerHTML = `<div class="tr-gap"><div class="tr-k">${esc(extra.k)}</div><div class="tr-gap-t">${esc(extra.t)}</div><div class="tr-gap-s">${esc(extra.s)}</div></div>`;
  }
  document.addEventListener('click', e => {
    const d = e.target.closest('[data-tr]');
    if (!d) return;
    const w = d.dataset.tr;
    if (w === 'close') trainerClose();
    if (w === 'go' || w === 'resume') trLock(() => { if (w === 'go') trNext(); else trRestartPart(); });
    if (w === 'again') { trainerClose(); trainerOpen(); }
    if (w === 'use') trUse(d);
    if (w === 'check' || w === 'practice') { const r = TR.result || lastFind(aimBase()); trainerClose(); trTest(w, r); }
    if (w === 'drill') { TR.drill = d.dataset.drill; trLock(() => trStartPractice()); }
    if (w === 'switchdrill') { TR.drill = TR.drill === 'wall' ? 'track' : 'wall'; trLock(() => trStartPractice()); }
  });
  // raw mouse counts: pointer lock without Windows' pointer speed or acceleration (unadjusted movement)
  function trLock(then) {
    const c = trCanvas();
    if (trSim) { TR.locked = true; TR.paused = false; trCard(null); then(); return; }
    if (host) {
      // TEMPO pins the cursor to the middle of its window and streams the mouse's own reports (see 'raw')
      Object.assign(TR, { native: true, locked: true, paused: false, lastT: 0, rawT: performance.now() });
      body.classList.add('tr-capture');
      send({ t: 'trCapture', on: true });
      trCard(null);
      then();
      return;
    }
    const done = () => { TR.locked = true; TR.paused = false; trCard(null); then(); };
    let p;
    try { p = c.requestPointerLock({ unadjustedMovement: true }); } catch { p = null; }
    if (p && p.then) p.then(done, () => { TR.raw = false; const q = c.requestPointerLock(); if (q && q.then) q.then(done, () => toast('Windows didn\'t let TEMPO hold the mouse. Click the range and try again.')); else setTimeout(done, 50); });
    else setTimeout(() => { if (document.pointerLockElement === c) done(); }, 80);
  }
  // the mouse let go (Esc, another window in front): pause, and the round starts over on Continue
  function trLetGo() {
    if (!TR.on || !TR.locked) return;
    TR.locked = false;
    body.classList.remove('tr-capture');
    if (TR.native) send({ t: 'trCapture', on: false });
    if (TR.phase !== 'done' && TR.phase !== 'intro') { TR.paused = true; trCard('pause'); }
  }
  // the mouse's own reports from TEMPO: [dx, dy, microseconds since the one before, ...]
  function trRaw(r) {
    if (!TR.on || !TR.locked || TR.paused || !r) return;
    for (let i = 0; i + 2 < r.length; i += 3) { TR.rawT += r[i + 2] / 1000; trMove(r[i], r[i + 1], TR.rawT); }
  }
  document.addEventListener('pointerlockchange', () => {
    if (!TR.on || trSim || TR.native) return;
    if (document.pointerLockElement !== trCanvas() && TR.locked && TR.phase !== 'done') { TR.locked = false; TR.paused = true; trCard('pause'); }
  });

  // ---- input: every report moves the view (curve applied per report, as Raw Accel does)
  function trMove(dx, dy, t) {
    if (!TR.on || TR.paused || !TR.locked) return;
    const dt = Math.max(0.5, Math.min(40, t - (TR.lastT || t - 1)));
    TR.lastT = t;
    const speed = Math.hypot(dx, dy) / dt; // counts per ms
    const part = TR.part;
    let m = part ? part.mult : 1;
    if (part && part.curve) { const c = part.curve; m *= speed <= c.start ? 1 : speed >= c.top ? c.max : 1 + (c.max - 1) * (speed - c.start) / (c.top - c.start); }
    const k = TR.degPerCount * m;
    TR.yaw += dx * k;
    TR.pitch = Math.max(-80, Math.min(80, TR.pitch - dy * k));
    if (part && part.rec) {
      if (part.type === 'track' && speed > 0.04) part.rec.speeds.push(speed);
      if (part.type === 'flick' && part.target) part.target.peak = Math.max(part.target.peak || 0, speed);
    }
  }
  const onRaw = e => { if (TR.on && TR.locked && !TR.native) { trMove(e.movementX, e.movementY, e.timeStamp); TR.events++; } };
  if ('onpointerrawupdate' in window) document.addEventListener('pointerrawupdate', onRaw);
  else document.addEventListener('mousemove', onRaw);
  document.addEventListener('mousedown', e => { if (TR.on && TR.locked && !TR.paused && e.button === 0) trShoot(); });
  // Esc: pause while playing (the lock lets go), close on the cards
  document.addEventListener('keydown', e => {
    if (TR.on && TR.mode === 'practice' && e.key === 'Tab') { e.preventDefault(); trPracticeSwitch(); return; }
    if (!TR.on || e.key !== 'Escape') return;
    if ((TR.native || trSim) && TR.locked) trLetGo();
    else if (document.pointerLockElement) document.exitPointerLock();
    else if (TR.phase === 'intro' || TR.phase === 'done') trainerClose();
  });

  // ---- the plan, part by part
  const trNow = () => trSim ? TR.simT : performance.now() / 1000;
  function trNext() {
    TR.i++;
    if (TR.i >= TR.plan.length) { trFinish(); return; }
    const p = TR.plan[TR.i], n = TR.plan.filter(x => x.kind !== 'warm').indexOf(p) + 1, total = TR.plan.filter(x => x.kind !== 'warm').length;
    TR.cur = p;
    p.rec = { err: [], on: 0, n: 0, speeds: [], flicks: [] };
    const label = p.kind === 'warm' ? 'WARM-UP' : `ROUND ${n} OF ${total}`;
    const first = p.kind === 'trial' && TR.plan.indexOf(p) === TR.plan.findIndex(x => x.kind === 'trial');
    trCard('gap', { k: label, t: p.kind === 'warm' ? 'Get the feel' : first ? 'One more test' : 'Track',
      s: p.kind === 'warm' ? 'Not scored. Track the orb, then flick.' : first ? 'Your flicks wanted more speed than your tracking: four short rounds try a curve against none' : 'Keep the crosshair on the orb' });
    TR.gapUntil = trNow() + (p.kind === 'warm' ? 1.8 : first ? 3.2 : 1.3);
    TR.part = null;
    TR.phase = 'gap';
  }
  function trStartTrack() {
    const p = TR.cur;
    trCard(null);
    p.mirror = p.mirror || 1;
    TR.part = { type: 'track', mult: p.mult, curve: p.curve || null, rec: p.rec, t0: trNow(), mirror: p.mirror };
    const [ty, tp] = TR.path(0);
    TR.yaw = ty * p.mirror; TR.pitch = tp; // the crosshair starts on the orb
    TR.phase = 'track';
  }
  function trStartFlicks() {
    const p = TR.cur, r = rng(p.seed || 3);
    p.queue = p.kind === 'warm' ? shuffle(FLICKS, r).slice(0, 4) : shuffle(FLICKS, r);
    TR.part = { type: 'flick', mult: p.mult, curve: p.curve || null, rec: p.rec, n: 0, r, target: null, next: trNow() + 0.35 };
    TR.phase = 'flick';
  }
  function trSpawn() {
    const part = TR.part, p = TR.cur, d = p.queue[part.n];
    // anywhere around the crosshair, flatter than tall (as on a screen, and as in games); always in view, and as far
    // as planned (a direction that would leave the screen's height is tried again)
    let dy = d, dp = 0;
    for (let k = 0; k < 8; k++) {
      const a = part.r() * Math.PI * 2, y = d * Math.cos(a), q = Math.max(-22 - TR.pitch, Math.min(22 - TR.pitch, d * Math.sin(a) * 0.62));
      [dy, dp] = [y, q];
      if (angDist(TR.yaw, TR.pitch, TR.yaw + y, TR.pitch + q) >= d * 0.8) break;
      [dy, dp] = [(y >= 0 ? 1 : -1) * d, 0];
    }
    part.target = { yaw: TR.yaw + dy, pitch: TR.pitch + dp, t0: trNow(), misses: 0, peak: 0 };
    part.target.d = angDist(TR.yaw, TR.pitch, part.target.yaw, part.target.pitch);
  }
  function trShoot() {
    const part = TR.part;
    if (part && part.type === 'wall') { trWallShoot(); return; }
    if (!part || part.type !== 'flick' || !part.target) return;
    const t = part.target;
    if (angDist(TR.yaw, TR.pitch, t.yaw, t.pitch) <= R_FLICK) trHit(false);
    else { t.misses++; TR.flash = { t: trNow(), miss: true }; }
  }
  function trHit(timeout) {
    const part = TR.part, t = part.target, now = trNow();
    const T = timeout ? 3.6 : now - t.t0 + 0.12 * t.misses;
    const id = Math.log2(t.d / (2 * R_FLICK) + 1);
    part.rec.flicks.push({ d: t.d, t: T, tp: id / T, misses: t.misses, peak: t.peak, timeout });
    TR.burst = { yaw: t.yaw, pitch: t.pitch, t: now, ok: !timeout };
    if (!timeout) trTick();
    part.target = null;
    part.n++;
    part.next = now + 0.25;
  }
  // a soft click on each hit (quiet, synthesized; nothing to load)
  function trTick() {
    if (trSim || still()) return;
    try {
      const a = TR.audio || (TR.audio = new (window.AudioContext || window.webkitAudioContext)());
      const o = a.createOscillator(), g = a.createGain(), t = a.currentTime;
      o.type = 'sine'; o.frequency.setValueAtTime(1320, t); o.frequency.exponentialRampToValueAtTime(880, t + 0.06);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      o.connect(g).connect(a.destination); o.start(t); o.stop(t + 0.1);
    } catch { }
  }
  function trRestartPart() {
    if (TR.mode === 'practice') { trStartPractice(true); return; }
    // after a pause the round starts over (a pause mid-round would skew it)
    const p = TR.cur;
    if (!p) { trNext(); return; }
    p.rec = { err: [], on: 0, n: 0, speeds: [], flicks: [] };
    TR.i--;
    trNext();
  }

  // ---- every frame: move the target, measure, draw
  function trFrame() {
    TR.raf = TR.on ? requestAnimationFrame(trFrame) : 0;
    if (!TR.on) return;
    if (trSim) { TR.simT += (1 / 60) * (+trSim || 1); trBot(); }
    const now = trNow();
    if (TR.phase === 'gap' && now >= TR.gapUntil && TR.locked && !TR.paused) trStartTrack();
    const part = TR.part;
    if (part && !TR.paused && TR.locked) {
      if (part.type === 'track') {
        const t = now - part.t0;
        const [ty, tp] = TR.path(t);
        part.ty = ty * part.mirror; part.tp = tp;
        if (t > 0.7) { const err = angDist(TR.yaw, TR.pitch, part.ty, part.tp); part.rec.err.push(err); part.rec.n++; if (err <= R_TRACK) part.rec.on++; }
        if (t >= (TR.cur.kind === 'warm' ? 6 : TRACK_S)) trStartFlicks();
      } else if (part.type === 'flick') {
        if (!part.target && now >= part.next) { if (part.n >= TR.cur.queue.length) { trNext(); } else trSpawn(); }
        else if (part.target && now - part.target.t0 > 3) trHit(true);
      } else if (part.type === 'ptrack') trPracticeTrack(now);
    }
    trDraw(now);
  }

  // ---- the range itself: a floor grid to the horizon, pillars all round, the orbs, a crosshair
  function trDraw(now) {
    const c = trCanvas(), g = c.getContext('2d'), W = c.width, H = c.height, dpr = window.devicePixelRatio || 1;
    const f = (W / 2) / Math.tan(rad(FOV / 2)), cx = W / 2, cy = H / 2;
    const cyw = Math.cos(rad(TR.yaw)), syw = Math.sin(rad(TR.yaw)), cp = Math.cos(rad(TR.pitch)), sp = Math.sin(rad(TR.pitch));
    // world → camera (yaw around up, then pitch), and onto the screen
    const cam = (x, y, z) => { const x1 = x * cyw - z * syw, z1 = x * syw + z * cyw; return [x1, y * cp - z1 * sp, y * sp + z1 * cp]; };
    const proj = ([x, y, z]) => [cx + x / z * f, cy - y / z * f];
    const dir = (yaw, pitch) => [Math.sin(rad(yaw)) * Math.cos(rad(pitch)), Math.sin(rad(pitch)), Math.cos(rad(yaw)) * Math.cos(rad(pitch))];
    const rgb = getComputedStyle(document.documentElement).getPropertyValue('--acc-rgb').trim() || '212,255,63';
    // sky and horizon glow
    const hy = cy - Math.tan(rad(-TR.pitch)) * f * 1;
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#050608'); sky.addColorStop(Math.max(0.01, Math.min(0.99, hy / H)), '#0E1116'); sky.addColorStop(1, '#07080A');
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    const glow = g.createRadialGradient(cx, hy, 0, cx, hy, W * 0.6);
    glow.addColorStop(0, `rgba(${rgb}, .07)`); glow.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = glow; g.fillRect(0, 0, W, H);
    // the floor grid (lines clipped at the camera's near plane)
    g.lineWidth = 1 * dpr;
    const seg = (a, b, style) => {
      let A = cam(...a), B = cam(...b);
      const near = 0.1;
      if (A[2] < near && B[2] < near) return;
      if (A[2] < near) { const k = (near - A[2]) / (B[2] - A[2]); A = [A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k, near]; }
      if (B[2] < near) { const k = (near - B[2]) / (A[2] - B[2]); B = [B[0] + (A[0] - B[0]) * k, B[1] + (A[1] - B[1]) * k, near]; }
      const [x1, y1] = proj(A), [x2, y2] = proj(B);
      g.strokeStyle = style; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    };
    for (let k = -40; k <= 40; k += 4) { seg([k, -1.7, -40], [k, -1.7, 40], 'rgba(255,255,255,.045)'); seg([-40, -1.7, k], [40, -1.7, k], 'rgba(255,255,255,.045)'); }
    // pillars all round, so a big turn has something to turn past
    for (let a = 0; a < 360; a += 15) {
      const x = Math.sin(rad(a)) * 34, z = Math.cos(rad(a)) * 34;
      seg([x, -1.7, z], [x, a % 45 === 0 ? 9 : 5, z], a % 90 === 0 ? `rgba(${rgb}, .22)` : 'rgba(255,255,255,.08)');
    }
    const part = TR.part;
    // the orb: a glowing sphere, brighter while the crosshair is on it
    const orb = (yaw, pitch, r, on, pop) => {
      const v = cam(...dir(yaw, pitch));
      if (v[2] <= 0.05) return null;
      const [x, y] = proj(v), rr = Math.tan(rad(r)) / v[2] * f * (pop || 1);
      const halo = g.createRadialGradient(x, y, rr * 0.2, x, y, rr * 3.2);
      halo.addColorStop(0, `rgba(${rgb}, ${on ? .38 : .2})`); halo.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = halo; g.beginPath(); g.arc(x, y, rr * 3.2, 0, Math.PI * 2); g.fill();
      const body = g.createRadialGradient(x - rr * .35, y - rr * .35, rr * .1, x, y, rr);
      body.addColorStop(0, on ? '#FFFFFF' : `rgba(${rgb}, 1)`); body.addColorStop(1, `rgba(${rgb}, ${on ? .95 : .7})`);
      g.fillStyle = body; g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fill();
      return [x, y];
    };
    let off = null;
    if (part && part.type === 'track' && part.ty != null) {
      const on = angDist(TR.yaw, TR.pitch, part.ty, part.tp) <= R_TRACK;
      if (!orb(part.ty, part.tp, R_TRACK, on)) off = [part.ty, part.tp];
    }
    if (part && part.type === 'ptrack' && part.ty != null) {
      const on = angDist(TR.yaw, TR.pitch, part.ty, part.tp) <= R_TRACK;
      if (!orb(part.ty, part.tp, R_TRACK, on)) off = [part.ty, part.tp];
    }
    if (part && part.type === 'wall') for (const t of part.targets) { const age = now - t.t0; orb(t.yaw, t.pitch, R_WALL, false, age < 0.12 ? 0.6 + age / 0.12 * 0.4 : 1); }
    if (part && part.type === 'flick' && part.target) {
      const t = part.target, age = now - t.t0, pop = age < 0.12 ? 0.6 + age / 0.12 * 0.4 : 1;
      if (!orb(t.yaw, t.pitch, R_FLICK, false, pop)) off = [t.yaw, t.pitch];
      else { const v = proj(cam(...dir(t.yaw, t.pitch))); if (v[0] < 0 || v[0] > W || v[1] < 0 || v[1] > H) off = [t.yaw, t.pitch]; }
    }
    // a hit: a ring that opens out
    if (TR.burst && now - TR.burst.t < 0.35) {
      const v = cam(...dir(TR.burst.yaw, TR.burst.pitch));
      if (v[2] > 0.05) { const [x, y] = proj(v), k = (now - TR.burst.t) / 0.35, rr = Math.tan(rad(R_FLICK)) / v[2] * f * (1 + k * 2.2); g.strokeStyle = TR.burst.ok ? `rgba(${rgb}, ${1 - k})` : `rgba(255,107,87,${1 - k})`; g.lineWidth = 2 * dpr; g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.stroke(); }
    }
    // an orb off screen: an arrow at the edge pointing to it
    if (off) {
      let dyaw = ((off[0] - TR.yaw) % 360 + 540) % 360 - 180, dp = off[1] - TR.pitch;
      const a = Math.atan2(-dp, dyaw), R = Math.min(W, H) * 0.36;
      const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
      g.save(); g.translate(x, y); g.rotate(a);
      g.fillStyle = `rgba(${rgb}, .9)`; g.beginPath(); g.moveTo(14 * dpr, 0); g.lineTo(-8 * dpr, -9 * dpr); g.lineTo(-3 * dpr, 0); g.lineTo(-8 * dpr, 9 * dpr); g.closePath(); g.fill();
      g.restore();
    }
    // the crosshair
    const miss = TR.flash && TR.flash.miss && now - TR.flash.t < 0.15;
    g.strokeStyle = miss ? '#FF6B57' : 'rgba(255,255,255,.95)'; g.lineWidth = 2 * dpr;
    const s = 7 * dpr, gap = 4 * dpr;
    g.beginPath(); g.moveTo(cx - s - gap, cy); g.lineTo(cx - gap, cy); g.moveTo(cx + gap, cy); g.lineTo(cx + s + gap, cy); g.moveTo(cx, cy - s - gap); g.lineTo(cx, cy - gap); g.moveTo(cx, cy + gap); g.lineTo(cx, cy + s + gap); g.stroke();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(cx, cy, 1.4 * dpr, 0, Math.PI * 2); g.fill();
    trHud(now);
  }
  function trHud(now) {
    const h = $('tr-hud'), part = TR.part, p = TR.cur;
    if (TR.mode === 'practice') { h.innerHTML = part && TR.phase !== 'done' ? trPracticeHud(now) : ''; return; }
    if (!part || !p || TR.phase === 'done') { h.innerHTML = ''; return; }
    const total = TR.plan.filter(x => x.kind !== 'warm').length, n = TR.plan.filter(x => x.kind !== 'warm').indexOf(p) + 1;
    const label = p.kind === 'warm' ? 'WARM-UP' : `ROUND ${n} OF ${total}`;
    let what = '', prog = 0;
    if (part.type === 'track') { const len = p.kind === 'warm' ? 6 : TRACK_S; prog = Math.min(1, (now - part.t0) / len); what = `TRACK · ${part.rec.n ? Math.round(part.rec.on / part.rec.n * 100) : 0}% ON`; }
    else { prog = part.n / p.queue.length; what = `FLICK · ${part.n} / ${p.queue.length}`; }
    h.innerHTML = `<div class="tr-h"><span>${label}</span><b>${what}</b></div><i class="tr-bar"><i style="width:${(prog * 100).toFixed(1)}%"></i></i><div class="tr-dots">${TR.plan.filter(x => x.kind !== 'warm').map((x, k) => `<i class="${k + 1 < n ? 'done' : k + 1 === n ? 'now' : ''}"></i>`).join('')}</div>`;
  }

  // ---- the answer
  // Each round gives two scores on a log scale: tracking = -ln(average error), flicks = ln(median Fitts throughput).
  // Against x = ln(multiplier) they're fitted with y = a x² + b x + c + d·(round order), a ridge regression with gentle
  // priors: a typical curvature, no lean either way, and little learning per round. With few, noisy rounds the answer
  // stays near the current sensitivity unless the rounds clearly say otherwise; the order term takes out warming up.
  const LO = Math.log(0.7), HI = Math.log(1.45), TESTED = [Math.log(0.75), Math.log(1.33)];
  const trMedian = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
  const trPct = (a, q) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * q))] : 0; };
  function solve(A, v) {
    const n = v.length, M = A.map((r, i) => r.concat([v[i]]));
    for (let i = 0; i < n; i++) {
      let p = i; for (let k = i + 1; k < n; k++) if (Math.abs(M[k][i]) > Math.abs(M[p][i])) p = k;
      [M[i], M[p]] = [M[p], M[i]];
      for (let k = i + 1; k < n; k++) { const q = M[k][i] / (M[i][i] || 1e-12); for (let j = i; j <= n; j++) M[k][j] -= q * M[i][j]; }
    }
    const r = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) { let s = M[i][n]; for (let j = i + 1; j < n; j++) s -= M[i][j] * r[j]; r[i] = s / (M[i][i] || 1e-12); }
    return r;
  }
  // rows: [x², x, 1, order]; noise: the scatter of one round's score (log units)
  function fitRidge(xs, os, ys, noise) {
    const prior = [-2.2, 0, 0, 0], sd = [2.0, 1.5, Infinity, 0.04];
    const A = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], v = [0, 0, 0, 0];
    xs.forEach((x, i) => { const r = [x * x, x, 1, os[i]]; for (let p = 0; p < 4; p++) { v[p] += r[p] * ys[i]; for (let q = 0; q < 4; q++) A[p][q] += r[p] * r[q]; } });
    for (let p = 0; p < 4; p++) if (isFinite(sd[p])) { const w = (noise * noise) / (sd[p] * sd[p]); A[p][p] += w; v[p] += w * prior[p]; }
    const [a, b, c, d] = solve(A, v);
    return { a, b, c, d, f: x => a * x * x + b * x + c };
  }
  const peakX = fit => fit.a < -1e-6 ? Math.max(LO, Math.min(HI, -fit.b / (2 * fit.a))) : (fit.b > 0 ? HI : LO);
  const beyond = x => x < TESTED[0] - 0.03 || x > TESTED[1] + 0.03;
  function scoreOf(rec) {
    const errs = (rec && rec.err) || [], tps = ((rec && rec.flicks) || []).map(f => f.tp);
    // losing the orb entirely counts, but not without limit (one bad reversal shouldn't decide a round)
    const err = errs.length ? errs.reduce((x, y) => x + Math.min(6, y), 0) / errs.length : 6;
    return { err: Math.max(0.05, err), on: rec && rec.n ? rec.on / rec.n : 0, tp: Math.max(0.05, tps.length ? trMedian(tps) : 0.05) };
  }
  const yT = s => -Math.log(s.err), yF = s => Math.log(s.tp);
  function trFinish() {
    if (TR.mode === 'check') { trCheckFinish(); return; }
    if (!TR.analysis) {
      const sets = TR.plan.filter(p => p.kind === 'set' && p.rec);
      const xs = sets.map(p => Math.log(p.mult)), order = sets.map((p, i) => i - (sets.length - 1) / 2);
      const sc = sets.map(p => scoreOf(p.rec)), ty = sc.map(yT), fy = sc.map(yF);
      // the round repeated at today's sensitivity says how much a round wobbles on its own
      const ones = sets.map((p, i) => p.mult === 1 ? i : -1).filter(i => i >= 0);
      const wob = (ys, dflt) => ones.length >= 2 ? Math.sqrt((dflt * dflt + Math.pow((ys[ones[0]] - ys[ones[1]]) / Math.SQRT2, 2)) / 2) : dflt;
      const nT = Math.max(0.05, Math.min(0.3, wob(ty, 0.12))), nF = Math.max(0.05, Math.min(0.3, wob(fy, 0.12)));
      const ft = fitRidge(xs, order, ty, nT), ff = fitRidge(xs, order, fy, nF);
      const pt = peakX(ft), pf = peakX(ff);
      // one sensitivity for both skills: the peak of the two fits added together
      const a = ft.a + ff.a, b = ft.b + ff.b, best = a < -1e-6 ? Math.max(LO, Math.min(HI, -b / (2 * a))) : 0;
      const speedsT = sets.flatMap(p => p.rec.speeds), peaks = sets.flatMap(p => p.rec.flicks.filter(f => f.peak > 0 && f.d >= 18).map(f => f.peak));
      TR.analysis = { xs, order, ty, fy, ft, ff, pt, pf, best, nT, nF, speedsT, peaks, mults: sets.map(p => p.mult) };
      const ratio = Math.exp(pf - pt);
      const ra = AIM.st && AIM.st.rawAccel;
      // flicks want clearly more than tracking: a curve (tracking's sensitivity, rising for fast moves) is tried
      // against flat, two rounds each in a mirrored order (A B B A) so warming up doesn't favour either
      if (ratio >= 1.15 && !beyond(pt) && peaks.length >= 6 && !(ra && ra.mode && ra.mode !== 'noaccel' && !ra.ours)) {
        const tb = Math.exp(pt), start = Math.max(0.4, trPct(speedsT, 0.85)), top = Math.max(start * 1.6, trMedian(peaks) * 0.7);
        const curve = { start: +start.toFixed(2), top: +top.toFixed(2), max: +Math.min(2.2, ratio).toFixed(2) };
        TR.analysis.curve = curve;
        const seq = rng(Date.now() & 0xff)() < 0.5 ? [0, 1, 1, 0] : [1, 0, 0, 1];
        seq.forEach((k, j) => TR.plan.push({ kind: 'trial', mult: tb, curve: k ? curve : null, flat: !k, mirror: j % 2 ? -1 : 1, seed: 300 + j }));
        trNext();
        return;
      }
    }
    TR.phase = 'done';
    TR.part = null;
    if (TR.native && TR.locked) { send({ t: 'trCapture', on: false }); TR.locked = false; body.classList.remove('tr-capture'); }
    if (document.pointerLockElement) document.exitPointerLock();
    const r = trResultOf();
    TR.result = r;
    trainerResult(r, true);
  }
  // what to tell the player, and what's kept
  function trResultOf() {
    const A = TR.analysis, b = TR.base, bm = Math.exp(A.best), tb = Math.exp(A.pt), fb = Math.exp(A.pf);
    const gain = Math.exp((A.ft.f(A.best) - A.ft.f(0)) + (A.ff.f(A.best) - A.ff.f(0))) - 1;
    const trials = TR.plan.filter(p => p.kind === 'trial' && p.rec);
    let curveRes = null;
    if (trials.length >= 2 && trials.some(p => p.flat) && trials.some(p => !p.flat)) {
      const mean = (list, f) => list.reduce((s, p) => s + f(scoreOf(p.rec)), 0) / list.length;
      const flat = trials.filter(p => p.flat), cur = trials.filter(p => !p.flat);
      curveRes = { track: Math.exp(mean(cur, yT) - mean(flat, yT)) - 1, flick: Math.exp(mean(cur, yF) - mean(flat, yF)) - 1 };
    }
    const useCurve = !!(curveRes && curveRes.flick >= 0.05 && curveRes.track >= -0.05);
    const close = !useCurve && (Math.abs(A.best) < Math.log(1.06) || gain < 0.04);
    const edge = !useCurve && !close && beyond(A.best);
    const sTrack = sensFmt(b.sens * tb), sBest = sensFmt(b.sens * bm), cmBest = b.cm ? (b.cm / bm).toFixed(1) : '';
    let say;
    if (useCurve) say = `Slow for tracking, quick for big turns: set ${b.name} to ${sTrack} for tracking, and let a curve speed up fast moves to ×${A.curve.max.toFixed(2)}. In the test, the curve made your flicks ${pctTxt(curveRes.flick)} and kept your tracking (${pctTxt(curveRes.track)}).`;
    else if (close) say = `Your ${b.name} sensitivity already suits your hand: nothing around it did clearly better. Keep ${sensFmt(b.sens)}${curveRes ? '; the curve didn\'t beat it either' : ''}.`;
    else say = `Try ${sBest} in ${b.name}${cmBest ? ` (${cmBest} cm per 360°)` : ''}, ${bm < 1 ? 'a little slower' : 'a little faster'} than now. You tracked best around ${sTrack} and flicked best around ${sensFmt(b.sens * fb)}; ${sBest} suits both, about ${Math.max(1, Math.round(gain * 100))}% better overall in the test.${curveRes ? ' A curve didn\'t clearly help.' : ''}`;
    if (edge) say += ' Your best was at the edge of what was tested: run it again from the new sensitivity to look a little further.';
    // the points as they'd be without warming up (for the chart)
    const det = (ys, fit) => ys.map((y, i) => y - fit.d * A.order[i]);
    const pts = {}; A.mults.forEach((m, i) => { (pts[m] = pts[m] || { m, t: [], f: [] }); pts[m].t.push(det(A.ty, A.ft)[i]); pts[m].f.push(det(A.fy, A.ff)[i]); });
    return {
      when: new Date().toISOString(), baseGame: b.gameId, baseName: b.name, baseSens: b.sens, baseYaw: b.yaw, raw: TR.raw,
      best: +bm.toFixed(3), trackBest: +tb.toFixed(3), flickBest: +fb.toFixed(3), gain: +gain.toFixed(3), close, edge,
      say,
      points: Object.values(pts).sort((p, q) => p.m - q.m).map(p => ({ m: p.m, track: +(p.t.reduce((s, v) => s + v, 0) / p.t.length).toFixed(4), flick: +(p.f.reduce((s, v) => s + v, 0) / p.f.length).toFixed(4) })),
      fit: { t: [A.ft.a, A.ft.b, A.ft.c], f: [A.ff.a, A.ff.b, A.ff.c] },
      curve: useCurve ? A.curve : null, curveTest: curveRes, noise: { t: +A.nT.toFixed(3), f: +A.nF.toFixed(3) },
      speeds: { track: thin(A.speedsT, 240), flick: thin(A.peaks, 120) },
    };
  }
  const pctTxt = v => `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`;
  const thin = (a, n) => { if (a.length <= n) return a.map(v => +v.toFixed(2)); const out = []; for (let i = 0; i < n; i++) out.push(+a[Math.floor(i * a.length / n)].toFixed(2)); return out; };

  // the result: a chart of both skills against the sensitivity, the advice, and what to set
  function trainerResult(r, fresh) {
    if (!TR.on) { Object.assign(TR, { on: true, phase: 'done', part: null, plan: [], base: aimBase() || { name: r.baseName, sens: r.baseSens } }); $('trainer').hidden = false; body.classList.add('tr-on'); trResize(); if (!TR.raf) TR.raf = requestAnimationFrame(trFrame); }
    const box = $('tr-card');
    box.hidden = false;
    box.className = 'tr-card k-result';
    const W = 460, H = 190, L = 34, R = 14, T = 16, B = 30;
    const ms = r.points.map(p => p.m), lo = Math.log(Math.min(0.7, ...ms)), hi = Math.log(Math.max(1.45, ...ms));
    const X = x => L + (x - lo) / (hi - lo) * (W - L - R);
    const norm = (key, fitk) => { const f = r.fit[fitk], at = x => f[0] * x * x + f[1] * x + f[2]; const base = at(0); return { at: x => Math.exp(at(x) - base), pts: r.points.map(p => [Math.log(p.m), Math.exp(p[key] - base)]) }; };
    const tN = norm('track', 't'), fN = norm('flick', 'f');
    const all = tN.pts.concat(fN.pts).map(p => p[1]).concat([tN.at(Math.log(r.trackBest)), fN.at(Math.log(r.flickBest)), 1]);
    const yLo = Math.min(0.7, ...all) - 0.03, yHi = Math.max(1.3, ...all) + 0.03;
    const Y = v => T + (1 - (v - yLo) / (yHi - yLo)) * (H - T - B);
    const line = n => { let d = ''; for (let x = lo; x <= hi + 1e-9; x += (hi - lo) / 60) d += `${d ? 'L' : 'M'}${X(x).toFixed(1)} ${Y(n.at(x)).toFixed(1)}`; return d; };
    let svg = `<line x1="${L}" x2="${W - R}" y1="${Y(1)}" y2="${Y(1)}" class="fg-grid"/><text x="${L - 6}" y="${Y(1) + 3.5}" class="fg-ax" text-anchor="end">now</text>`;
    for (const m of [0.75, 1, 1.33]) svg += `<text x="${X(Math.log(m))}" y="${H - 10}" class="fg-ax" text-anchor="middle">${sensFmt(r.baseSens * m)}</text>`;
    svg += `<line x1="${X(0)}" x2="${X(0)}" y1="${T}" y2="${H - B}" class="tr-now"/>`;
    svg += `<path d="${line(tN)}" class="tr-lt"/><path d="${line(fN)}" class="tr-lf"/>`;
    svg += tN.pts.map(([x, y]) => `<circle cx="${X(x)}" cy="${Y(y)}" r="3.2" class="tr-pt"/>`).join('') + fN.pts.map(([x, y]) => `<circle cx="${X(x)}" cy="${Y(y)}" r="3.2" class="tr-pf"/>`).join('');
    // the sensitivity to set: the best of both, or with a curve, the one for tracking (the curve does the rest)
    const mark = r.curve ? r.trackBest : r.best, bx = X(Math.log(mark));
    svg += `<line x1="${bx}" x2="${bx}" y1="${T}" y2="${H - B}" class="tr-best"/><text x="${bx}" y="${T + 2}" class="tr-bt" text-anchor="middle">${r.curve ? 'SET' : 'BEST'} ${sensFmt(r.baseSens * mark)}</text>`;
    const b = aimBase(), sameBase = b && b.gameId === r.baseGame;
    const setTo = r.curve ? r.trackBest : r.best;
    box.innerHTML = `<div class="tr-k">YOUR SENSITIVITY${fresh ? '' : ` · ${when(r.when).toUpperCase()}`}</div>
      <h3>${r.close && !r.curve ? `${esc(r.baseName)} ${sensFmt(r.baseSens)} suits you` : `${esc(r.baseName)} ${sensFmt(r.baseSens * setTo)}${r.curve ? ' + a curve' : ''}`}</h3>
      <p class="tr-say">${esc(r.say)}</p>
      <div class="tr-chart"><svg viewBox="0 0 ${W} ${H}" width="100%">${svg}</svg>
        <div class="tr-leg"><span><i class="t"></i>tracking (steadier is higher)</span><span><i class="f"></i>flicks (faster landing is higher)</span></div></div>
      <div class="tr-nums"><div><small>TRACKING BEST</small><b>${sensFmt(r.baseSens * r.trackBest)}</b></div><div><small>FLICKS BEST</small><b>${sensFmt(r.baseSens * r.flickBest)}</b></div>${r.curveTest ? `<div><small>WITH THE CURVE</small><b class="${r.curveTest.flick >= 0 ? 'up' : ''}">${pctTxt(r.curveTest.flick)}</b><em>flicks · ${pctTxt(r.curveTest.track)} tracking</em></div>` : ''}</div>
      ${r.raw === false ? '<p class="note">Windows\' own pointer speed may have shaped this test (the raw mouse wasn\'t available).</p>' : ''}
      ${testPair(r) ? `<div class="tr-test"><div><b>Not sure yet?</b><span>Try ${sensFmt(r.baseSens * setTo)} before you change anything in ${esc(r.baseName)}.</span></div><button type="button" class="btn" data-tr="check">Check it blind</button><button type="button" class="btn" data-tr="practice">Practise with it</button></div>` : ''}
      <div class="tr-act">${fresh ? `<button type="button" class="btn acc" data-tr="use">${r.close && !r.curve ? 'Keep it' : `Use ${sensFmt(r.baseSens * setTo)}`}</button>` : ''}<button type="button" class="btn" data-tr="again">Run again</button><button type="button" class="btn" data-tr="close">${fresh ? 'Not now' : 'Close'}</button></div>`;
    if (fresh) TR.result = r;
    if (!sameBase && !fresh) box.querySelector('.tr-say').insertAdjacentHTML('afterend', `<p class="note">This was measured from ${esc(r.baseName)} ${sensFmt(r.baseSens)}.</p>`);
  }
  // keeping it: saved for the page (and the curve), and the number to type in the game
  function trUse(btn) {
    const r = TR.result;
    if (!r) return;
    send({ t: 'aimFind', result: r });
    const finds = (aimOpts().finds || []).slice();
    finds.unshift(r);
    putSet('aim.finds', finds.slice(0, 12));
    const v = sensFmt(r.baseSens * (r.curve ? r.trackBest : r.best));
    if (!r.close || r.curve) { try { navigator.clipboard.writeText(v).catch(() => { }); } catch { } }
    btn.closest('.tr-act').innerHTML = r.close && !r.curve
      ? `<p class="tr-done"><b>Kept.</b> Your aim page shows it now.</p><button type="button" class="btn acc" data-tr="close">Done</button>`
      : `<p class="tr-done"><b>${v} is copied.</b> In ${esc(r.baseName)}: Settings, Mouse, Sensitivity, paste it.${r.curve ? ' Then set the curve on the Aim page.' : ''} Give it a few matches: a new sensitivity feels odd for a day.</p><button type="button" class="btn acc" data-tr="close">Done</button>`;
    if (r.curve) AIM.draft = null;
  }

  // ---- design checks only: a made-up player with a sweet spot, so the whole flow can be checked headless
  function trBot() {
    const part = TR.part;
    if (!part || !TR.locked || TR.paused) return;
    if (part.type === 'wall' && part.targets.length) part.target = part.targets[0];
    const flick = part.type === 'flick' || part.type === 'wall';
    if (flick ? !part.target : part.ty == null) return;
    const ty = flick ? part.target.yaw : part.ty, tp = flick ? part.target.pitch : part.tp;
    const m = part.mult * (part.curve && flick ? part.curve.max : 1), dpc = TR.degPerCount * m, dt = 1 / 60 * (+trSim || 1);
    const dy = ((ty - TR.yaw) % 360 + 540) % 360 - 180, dp = tp - TR.pitch, dist = Math.hypot(dy, dp);
    // a hand: so many counts a second at most (slow sensitivity lags behind fast strafes), and a shake that grows with sensitivity
    const L = flick ? 14000 : 3000, maxStep = L * dpc * dt;
    const k = Math.min(1, maxStep / Math.max(1e-6, dist)) * (flick ? 0.9 : 0.92), wob = flick ? 0.5 * m * m * m : 0.7 * m * m;
    const n = () => (Math.random() - 0.5) * wob;
    const sy = dy * k + n(), sp = dp * k + n();
    TR.yaw += sy; TR.pitch += sp;
    const speed = Math.hypot(sy, sp) / dpc / (dt * 1000);
    if (!flick && part.rec && speed > 0.04) part.rec.speeds.push(speed);
    if (flick) { part.target.peak = Math.max(part.target.peak || 0, speed); if (dist < R_FLICK * 0.7 && Math.random() < 0.6) trShoot(); }
    if (part.type === 'wall') part.target = null;
  }

  // ---- testing the finder's answer: blind against yours, or free practice with either
  const R_WALL = 2.0, WALL_N = 3;
  // the two sensitivities to compare: the suggestion, and yours now (or, if you already switched to it, the one before)
  function testPair(r) {
    const b = aimBase();
    if (!b || !r || !r.baseSens || b.gameId !== r.baseGame) return null;
    const setTo = r.curve ? r.trackBest : r.best, sug = r.baseSens * setTo;
    let mine = b.sens, mineLabel = 'Yours';
    if (Math.abs(sug / mine - 1) < 0.02) { mine = r.baseSens; mineLabel = 'Your old one'; }
    if (Math.abs(sug / mine - 1) < 0.02) return null;
    const ra = AIM.st && AIM.st.rawAccel;
    // a curve already set in Raw Accel is in the mouse's own reports; otherwise TEMPO applies it here
    return { sug, mine, mineLabel, curve: r.curve && !(ra && ra.ours) ? r.curve : null, hasCurve: !!r.curve, find: r.when };
  }
  const lastCheck = f => (aimOpts().checks || []).find(c => f && c.find === f.when) || null;
  function trTest(kind, r) {
    const pair = testPair(r);
    if (!pair) { toast('Nothing to compare: the suggestion is the sensitivity you have now.'); return; }
    trainerOpen({ mode: kind === 'check' ? 'check' : 'practice', pair });
  }
  function trTestIntro() {
    const p = TR.pair;
    const sens = `<div class="tr-sens"><div><small>${esc(p.mineLabel.toUpperCase())}</small><b>${sensFmt(p.mine)}</b></div><div class="sug"><small>SUGGESTED${p.hasCurve ? ' + CURVE' : ''}</small><b>${sensFmt(p.sug)}</b></div></div>`;
    if (TR.mode === 'check') return `<div class="tr-k">BLIND CHECK</div><h3>Does the suggestion hold up?</h3>${sens}
      <ul class="tr-steps"><li>A short warm-up, then <b>four rounds</b>: two at each sensitivity, in an order TEMPO keeps to itself.</li><li>Each round: track the orb, then flick to the orbs that pop up around your crosshair.</li><li>About two minutes. Then you see which one you aimed better with.</li></ul>
      <div class="tr-act"><button type="button" class="btn acc tr-go" data-tr="go">Start</button><button type="button" class="btn" data-tr="close">Not now</button></div>`;
    return `<div class="tr-k">PRACTICE</div><h3>Get the feel of it</h3>${sens}
      <div class="tr-modes"><button type="button" class="tr-mode" data-tr="drill" data-drill="wall"><b>Flick wall</b><span>Three orbs on a wall: hit one and another appears, like Gridshot.</span></button><button type="button" class="tr-mode" data-tr="drill" data-drill="track"><b>Tracking</b><span>The orb strafes left and right without stopping. Stay on it.</span></button></div>
      <p class="tr-base">It starts at the suggested ${sensFmt(p.sug)}. <b>Tab</b> switches between the two any time. Esc pauses and shows how you did with each.</p>
      <div class="tr-act"><button type="button" class="btn" data-tr="close">Not now</button></div>`;
  }

  // the blind check's answer: the same scores as the finder, the suggestion against yours
  function trCheckFinish() {
    TR.phase = 'done';
    TR.part = null;
    if (TR.native && TR.locked) { send({ t: 'trCapture', on: false }); TR.locked = false; body.classList.remove('tr-capture'); }
    if (document.pointerLockElement) document.exitPointerLock();
    const p = TR.pair, rounds = TR.plan.filter(x => x.kind === 'check' && x.rec);
    const side = s => rounds.filter(x => x.side === s);
    const A = side('mine').map(x => scoreOf(x.rec)), B = side('sug').map(x => scoreOf(x.rec));
    const mean = (l, f) => l.reduce((a, x) => a + f(x), 0) / Math.max(1, l.length);
    const land = s => trMedian(side(s).flatMap(x => x.rec.flicks.filter(f => !f.timeout).map(f => f.t)));
    const track = Math.exp(mean(B, yT) - mean(A, yT)) - 1, flick = Math.exp(mean(B, yF) - mean(A, yF)) - 1, both = (track + flick) / 2;
    const verdict = both >= 0.04 && track >= -0.04 && flick >= -0.04 ? 'better' : both <= -0.04 ? 'worse' : 'same';
    const say = verdict === 'better' ? `The suggestion held up: blind, ${sensFmt(p.sug)} beat ${sensFmt(p.mine)} (tracking ${pctTxt(track)}, flicks ${pctTxt(flick)}).`
      : verdict === 'worse' ? `Blind, you aimed better with ${sensFmt(p.mine)} (the suggestion: tracking ${pctTxt(track)}, flicks ${pctTxt(flick)}). Keep it, or run the finder again another day.`
      : `About the same blind (tracking ${pctTxt(track)}, flicks ${pctTxt(flick)}): four rounds can't split them. Go by feel: practise with both.`;
    const res = { when: new Date().toISOString(), find: p.find, mine: p.mine, sug: p.sug, track: +track.toFixed(3), flick: +flick.toFixed(3), verdict, say,
      onMine: +mean(A, s => s.on).toFixed(3), onSug: +mean(B, s => s.on).toFixed(3), landMine: +land('mine').toFixed(3), landSug: +land('sug').toFixed(3) };
    send({ t: 'aimCheck', result: res });
    const checks = (aimOpts().checks || []).slice();
    checks.unshift(res);
    putSet('aim.checks', checks.slice(0, 12));
    const box = $('tr-card');
    box.hidden = false;
    box.className = 'tr-card k-result';
    const hi = (x, y) => x > y + 0.01 ? 'cw' : '', lo = (x, y) => x > 0 && x < y - 0.02 ? 'cw' : '';
    box.innerHTML = `<div class="tr-k">BLIND CHECK</div><h3>${verdict === 'better' ? `${sensFmt(p.sug)} it is` : verdict === 'worse' ? `${sensFmt(p.mine)} suits you better` : 'Too close to call'}</h3>
      <p class="tr-say">${esc(say)}</p>
      <div class="tr-cmp"><div><small>${esc(p.mineLabel.toUpperCase())} · ${sensFmt(p.mine)}</small></div><div><small>SUGGESTED · ${sensFmt(p.sug)}</small></div>
        <div class="${hi(res.onMine, res.onSug)}"><b>${Math.round(res.onMine * 100)}%</b><em>on the orb while tracking</em></div><div class="${hi(res.onSug, res.onMine)}"><b>${Math.round(res.onSug * 100)}%</b><em>on the orb while tracking</em></div>
        <div class="${lo(res.landMine, res.landSug)}"><b>${res.landMine ? res.landMine.toFixed(2) + ' s' : '–'}</b><em>to land a flick</em></div><div class="${lo(res.landSug, res.landMine)}"><b>${res.landSug ? res.landSug.toFixed(2) + ' s' : '–'}</b><em>to land a flick</em></div></div>
      <div class="tr-act">${verdict !== 'worse' ? `<button type="button" class="btn acc" data-tr="usecheck">Use ${sensFmt(p.sug)}</button>` : ''}<button type="button" class="btn" data-tr="practice">Practise with both</button><button type="button" class="btn" data-tr="close">Close</button></div>`;
  }
  document.addEventListener('click', e => {
    const d = e.target.closest('[data-tr="usecheck"]');
    if (!d || !TR.pair) return;
    const v = sensFmt(TR.pair.sug);
    try { navigator.clipboard.writeText(v).catch(() => { }); } catch { }
    d.closest('.tr-act').innerHTML = `<p class="tr-done"><b>${v} is copied.</b> In ${esc(TR.base.name)}: Settings, Mouse, Sensitivity, paste it.${TR.pair.hasCurve ? ' Then set the curve on the Aim page.' : ''} Give it a few matches: a new sensitivity feels odd for a day.</p><button type="button" class="btn acc" data-tr="close">Done</button>`;
  });

  // free practice: a flick wall (three orbs, hit one and another appears) or endless tracking; Tab switches the sensitivity
  function trStartPractice(resume) {
    trCard(null);
    const p = TR.pair;
    if (!TR.prac) {
      const blank = () => ({ hits: 0, shots: 0, times: [], on: 0, n: 0 });
      TR.prac = { side: 'sug', stats: { mine: blank(), sug: blank() } };
    }
    const s = TR.prac.side, mult = (s === 'sug' ? p.sug : p.mine) / TR.base.sens, curve = s === 'sug' ? p.curve : null;
    TR.cur = { kind: 'practice' };
    if (TR.drill === 'wall') {
      TR.yaw = 0; TR.pitch = 0;
      TR.part = { type: 'wall', mult, curve, rec: null, targets: [], r: rng(Date.now() & 0xffff), last: trNow() };
      for (let i = 0; i < WALL_N; i++) trWallSpawn();
    } else {
      TR.ppath = TR.ppath || trackPath(11, 600);
      TR.part = { type: 'ptrack', mult, curve, rec: null, t0: trNow(), recent: [] };
      const [ty, tp] = TR.ppath(0);
      TR.yaw = ty; TR.pitch = tp;
    }
    TR.phase = 'practice';
  }
  function trWallSpawn() {
    const part = TR.part, pick = () => ({ yaw: (part.r() * 2 - 1) * 26, pitch: (part.r() * 2 - 1) * 14, t0: trNow() });
    for (let k = 0; k < 40; k++) {
      const t = pick();
      if (part.targets.every(o => angDist(o.yaw, o.pitch, t.yaw, t.pitch) > 8) && angDist(TR.yaw, TR.pitch, t.yaw, t.pitch) > 5) { part.targets.push(t); return; }
    }
    part.targets.push(pick());
  }
  function trWallShoot() {
    const part = TR.part, st = TR.prac.stats[TR.prac.side], now = trNow();
    st.shots++;
    const i = part.targets.findIndex(t => angDist(TR.yaw, TR.pitch, t.yaw, t.pitch) <= R_WALL);
    if (i < 0) { TR.flash = { t: now, miss: true }; return; }
    const t = part.targets[i];
    st.hits++;
    st.times.push(now - part.last);
    if (st.times.length > 40) st.times.shift();
    part.last = now;
    TR.burst = { yaw: t.yaw, pitch: t.pitch, t: now, ok: true };
    trTick();
    part.targets.splice(i, 1);
    trWallSpawn();
  }
  function trPracticeTrack(now) {
    const part = TR.part, t = (now - part.t0) % 590;
    const [ty, tp] = TR.ppath(t);
    part.ty = ty; part.tp = tp;
    if (now - part.t0 < 0.7) return;
    const st = TR.prac.stats[TR.prac.side], on = angDist(TR.yaw, TR.pitch, ty, tp) <= R_TRACK;
    st.n++; if (on) st.on++;
    part.recent.push(on ? 1 : 0);
    if (part.recent.length > 300) part.recent.shift();
  }
  function trPracticeSwitch() {
    if (!TR.prac || !TR.part || TR.paused || TR.phase !== 'practice') return;
    const p = TR.pair, s = TR.prac.side = TR.prac.side === 'sug' ? 'mine' : 'sug';
    TR.part.mult = (s === 'sug' ? p.sug : p.mine) / TR.base.sens;
    TR.part.curve = s === 'sug' ? p.curve : null;
    if (TR.part.type === 'wall') TR.part.last = trNow();
    if (TR.part.recent) TR.part.recent = [];
    const old = document.querySelector('.tr-swap');
    if (old) old.remove();
    const el = document.createElement('div');
    el.className = 'tr-swap';
    el.textContent = `${s === 'sug' ? 'SUGGESTED' : p.mineLabel.toUpperCase()} ${sensFmt(s === 'sug' ? p.sug : p.mine)}`;
    $('trainer').appendChild(el);
    setTimeout(() => el.remove(), 1200);
  }
  function trPracticeHud() {
    const p = TR.pair, s = TR.prac.side, st = TR.prac.stats[s], part = TR.part;
    const lab = `${s === 'sug' ? 'SUGGESTED' : esc(p.mineLabel.toUpperCase())} ${sensFmt(s === 'sug' ? p.sug : p.mine)}`;
    let stats;
    if (part.type === 'wall') {
      const avg = st.times.length ? st.times.reduce((a, b) => a + b, 0) / st.times.length : 0;
      stats = `<span>HITS <b>${st.hits}</b></span><span>ACCURACY <b>${st.shots ? Math.round(st.hits / st.shots * 100) : 0}%</b></span><span>PER HIT <b>${avg ? avg.toFixed(2) + ' s' : '–'}</b></span>`;
    } else {
      const r = part.recent || [];
      stats = `<span>ON THE ORB <b>${r.length ? Math.round(r.reduce((a, b) => a + b, 0) / r.length * 100) : 0}%</b></span>`;
    }
    return `<div class="tr-h"><span>PRACTICE · ${part.type === 'wall' ? 'FLICK WALL' : 'TRACKING'}</span><b>${lab}</b></div><div class="tr-pstats">${stats}<span>TAB <b>SWITCH</b></span></div>`;
  }
  function trPracticePause() {
    const p = TR.pair, st = TR.prac ? TR.prac.stats : null;
    const cell = (k, v) => {
      const x = st && st[k];
      if (!x || (!x.hits && !x.n)) return `<div><b>–</b><em>not tried yet</em></div>`;
      const avg = x.times.length ? x.times.reduce((a, b) => a + b, 0) / x.times.length : 0;
      return `<div>${x.hits ? `<b>${avg.toFixed(2)} s</b><em>a hit · ${x.hits} hits · ${Math.round(x.hits / Math.max(1, x.shots) * 100)}% accuracy</em>` : ''}${x.n ? `<b>${Math.round(x.on / x.n * 100)}%</b><em>on the orb while tracking</em>` : ''}</div>`;
    };
    return `<div class="tr-k">PRACTICE · PAUSED</div><h3>How each one went</h3>
      <div class="tr-cmp"><div><small>${esc(p.mineLabel.toUpperCase())} · ${sensFmt(p.mine)}</small></div><div><small>SUGGESTED · ${sensFmt(p.sug)}</small></div>${cell('mine')}${cell('sug')}</div>
      <p class="tr-base" style="margin-top:12px">From this practice only. For a fair answer, the blind check doesn't tell you which is which.</p>
      <div class="tr-act"><button type="button" class="btn acc" data-tr="resume">Continue</button><button type="button" class="btn" data-tr="switchdrill">${TR.drill === 'wall' ? 'Tracking instead' : 'Flick wall instead'}</button><button type="button" class="btn" data-tr="close">Done</button></div>`;
  }



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
    appdisk: ['Another app on the drive', 'Another app was reading or writing the drive hard, so the game waited for it.', 'Usually a download or an update: pause it while you play, or let it finish first.'],
  };
  // which apps, by name: "NVIDIA container 41 (12 froze it) · Spotify 9"
  function appsLine(s) {
    const a = s.hitchApps || {}, f = s.freezeApps || {};
    const names = Object.keys(a).sort((x, y) => a[y] - a[x]).slice(0, 4);
    return names.length ? `<p class="mono" style="margin-top:3px">${names.map(n => `${esc(n)} ${a[n]}${f[n] ? ` (${f[n]} froze it)` : ''}`).join(' · ')}</p>` : '';
  }
  function causesHtml(s) {
    const c = s.hitchCauses || {};
    const total = Object.values(c).reduce((a, b) => a + b, 0);
    if (!total) return '';
    const order = Object.keys(c).sort((a, b) => c[b] - c[a]);
    const color = k => ({ memory: '#FF6B57', heat: '#FFB547', app: '#B79BFF', loading: '#6FE3FF', cpuclock: '#FFD15C', cpu: 'var(--acc)', game: '#59606A', appdisk: '#5CFFB5' })[k] || '#59606A';
    return `<div class="lab" style="margin:4px 0 8px">Why it stuttered <b>${total} stutter${total === 1 ? '' : 's'}</b></div>
      <div class="lbar">${order.map(k => `<i style="flex:${c[k]};background:${color(k)}"></i>`).join('')}</div>
      <div class="causes">${order.map(k => { const m = CAUSE[k] || [k, '', '']; const apps = k === 'app' || k === 'appdisk' ? appsLine(s) : ''; return `<div class="cause"><i style="background:${color(k)}"></i><div><b>${m[0]}</b> <span class="mono">${c[k]}</span><p>${m[1]} ${m[2]}</p>${apps}</div></div>`; }).join('')}</div>
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
    $('ckp-list').innerHTML = S.checkup == null ? skel(4) : items.map(f =>
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
    renderPause();
    $('bs-test').innerHTML = `<div class="brow" style="margin-top:18px"><div><b>Is it worth it on your PC?</b><small>The Tune page can test the boost, or any one part of it, over real sessions.</small></div><button type="button" class="btn" data-go-page="tune">Open Tune</button></div>`;
    renderApps();
    const g = sel();
    $('bs-compare').innerHTML = compareHtml(g && g.id);
    syncControls();
  }
  // ---------------- pausing apps while you play: the list, with running apps to add
  const PAUSE_NAMES = { 'opera.exe': 'Opera', 'chrome.exe': 'Chrome', 'msedge.exe': 'Edge', 'firefox.exe': 'Firefox', 'brave.exe': 'Brave', 'vivaldi.exe': 'Vivaldi', 'wallpaper32.exe': 'Wallpaper Engine', 'wallpaper64.exe': 'Wallpaper Engine (64-bit)' };
  function renderPause() {
    const b = S.settings.boost || {};
    const list = b.pauseApps || [];
    body.classList.toggle('pause-on', !!b.pause);
    const label = n => (S.appsData && (S.appsData.apps || []).find(a => a.name.toLowerCase() === n.toLowerCase()) || {}).label || PAUSE_NAMES[n.toLowerCase()] || bare(n);
    const running = new Set(((S.appsData && S.appsData.apps) || []).map(a => a.name.toLowerCase()));
    const extra = ((S.appsData && S.appsData.apps) || []).filter(a => !a.locked && !list.some(x => x.toLowerCase() === a.name.toLowerCase()) && !/^(steam|explorer)\.exe$/i.test(a.name));
    $('bs-pause').innerHTML = list.map(n => `<button type="button" class="ach on" data-unpause="${esc(n)}" title="Tap to take it off the list"><i></i><span>${esc(label(n))}</span>${running.has(n.toLowerCase()) ? '<small>running</small>' : ''}</button>`).join('') +
      (extra.length ? `<select id="pause-add" aria-label="Add an app to pause"><option value="">+ Add a running app</option>${extra.map(a => `<option value="${esc(a.name)}">${esc(a.label || bare(a.name))}</option>`).join('')}</select>` : '');
  }
  document.addEventListener('click', e => {
    const u = e.target.closest('[data-unpause]');
    if (u) { const list = ((S.settings.boost || {}).pauseApps || []).filter(x => x !== u.dataset.unpause); set('boost.pauseApps', list); renderPause(); }
  });
  document.addEventListener('change', e => {
    if (e.target.id === 'pause-add' && e.target.value) { const list = ((S.settings.boost || {}).pauseApps || []).concat([e.target.value]); set('boost.pauseApps', list); renderPause(); }
  });

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
    if (!A) { $('apps').innerHTML = `<div class="ag-grid">${skel(4)}</div>`; $('protected').innerHTML = ''; $('ap-note').textContent = ''; return; }
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
  const SHOW = [['fps', 'FPS'], ['low1', '1% low'], ['frametime', 'Frame time'], ['delay', 'Frame delay'], ['graph', 'Graph'], ['cpu', 'Processor'], ['gpu', 'Graphics card'], ['heat', 'Heat']];
  function renderOverlayPage() {
    const shown = new Set(S.settings.overlayShow || []);
    $('ov-show').innerHTML = SHOW.map(([k, label]) => `<button type="button" data-show="${k}" class="${shown.has(k) || k === 'fps' ? 'on' : ''}"${k === 'fps' ? ' disabled' : ''}>${label}</button>`).join('');
    const g = sel() || S.games[0];
    const hero = g && (g.art.hero || g.art.header);
    $('ov-game').style.backgroundImage = hero ? `url('${hero}')` : '';
    // what showing the counter did to each game's way to the screen, checked once per session
    const seen = {};
    for (const s of S.sessions) if (s.overlayPath && !seen[s.gameId]) seen[s.gameId] = s;
    const PATH = {
      costs: n => `<b>In ${n} the counter costs a frame.</b> Without it the game goes straight to the screen; with it showing, Windows draws the game through its compositor, about one screen refresh more delay. Fine for casual games; for ranked, Ctrl Alt O hides it.`,
      free: n => `<b>In ${n} the counter is free.</b> Your graphics card draws it on a layer of its own, so the game keeps its fast path.`,
      composed: n => `<b>In ${n} the counter adds nothing.</b> The game runs windowed through Windows' compositor anyway.`,
      blocked: n => `<b>${n} hides the counter</b> (exclusive fullscreen), so it isn't drawn at all and costs nothing. Borderless would show it; TEMPO checks whether that costs you anything.`,
    };
    const rows = Object.values(seen).slice(0, 3).map(s => `<p>${(PATH[s.overlayPath] || (() => ''))(esc(s.gameName))}</p>`).filter(x => x.length > 7);
    const worst = Object.values(seen).some(s => s.overlayPath === 'costs') ? 'costs' : 'free';
    $('ov-path').className = 'ov-path ' + worst;
    $('ov-path').innerHTML = rows.length ? `<div class="lab" style="margin-bottom:6px">What it costs, checked in your games</div>` + rows.join('') : '';
    $('ov-path').hidden = !rows.length;
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
    if (shown.has('delay')) parts.push(`DELAY ${Math.round(l.latency || 23)} ms`);
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

  // ------------------------------------------------------------------ 2.0: the match, against this game's usual
  const median = arr => { const a = arr.filter(v => v != null && isFinite(v)).sort((x, y) => x - y); return a.length ? a[Math.floor((a.length - 1) / 2)] : null; };
  const smoothOf = s => s && s.uneven != null && s.uneven >= 0 ? Math.round((1 - s.uneven) * 100) : null;
  // the usual for this game: the median of up to five matches before this one
  function usualOf(s) {
    const prev = S.sessions.filter(x => x.gameId === s.gameId && x.id !== s.id && new Date(x.started) < new Date(s.started)).slice(0, 5);
    if (!prev.length) return null;
    return { n: prev.length, avg: median(prev.map(x => x.avgFps)), low: median(prev.map(x => x.low1)), smooth: median(prev.map(smoothOf)), lat: median(prev.map(x => x.medianLatencyMs > 0 ? x.medianLatencyMs : null)) };
  }
  // the frame delay, against the usual: what a mouse movement waits for on top of the mouse itself
  function delayLine(s, u) {
    if (!(s.medianLatencyMs > 0)) return '';
    const d = u && u.lat ? s.medianLatencyMs - u.lat : null;
    return ` <span class="rc-lat">Frame delay ${Math.round(s.medianLatencyMs)} ms${d != null && Math.abs(d) >= 1 ? ` (${d > 0 ? '+' : ''}${Math.round(d)} vs usual)` : ''}.</span>`;
  }
  function matchSay(s, u) {
    const sm = smoothOf(s);
    if (!u) return `First ${esc(s.gameName)} match measured: ${fmt(s.avgFps)} fps on average, ${fmt(s.low1)} at the worst moments${sm != null ? `, ${sm}% of frames on pace` : ''}. Next time this compares with it.`;
    const dl = u.low ? (s.low1 - u.low) / u.low : 0, da = u.avg ? (s.avgFps - u.avg) / u.avg : 0, ds = sm != null && u.smooth != null ? sm - u.smooth : 0;
    const score = dl * 1.5 + da + ds / 100 * 2;
    if (score >= 0.12) return `<b>Better than usual.</b> ${dl >= 0.08 ? `The worst moments held ${fmt(s.low1)} fps, usually ${fmt(u.low)}.` : da >= 0.06 ? `${fmt(s.avgFps)} fps on average, usually ${fmt(u.avg)}.` : `Smoother: ${sm}% of frames on pace, usually ${fmt(u.smooth)}.`}`;
    if (score <= -0.12) return `<b>Rougher than usual.</b> ${dl <= -0.08 ? `The worst moments dropped to ${fmt(s.low1)} fps, usually ${fmt(u.low)}.` : da <= -0.06 ? `${fmt(s.avgFps)} fps on average, usually ${fmt(u.avg)}.` : `${sm}% of frames on pace, usually ${fmt(u.smooth)}.`}${heldBack(s) ? '' : ' Matches differ; nothing on the PC stood out.'}`;
    return `<b>About your usual.</b> ${fmt(s.avgFps)} fps on average, worst moments ${fmt(s.low1)}${u.n > 1 ? ` (usually ${fmt(u.avg)} and ${fmt(u.low)})` : ''}.`;
  }
  // the one thing that held this match back most, in a sentence, with what helps
  function heldBack(s) {
    if (s.culprit && s.culprit.freezes >= 2) return { k: `${esc(s.culprit.label)} spiked at ${s.culprit.freezes} freezes.`, v: `Each time, it had suddenly taken a big share of the processor. ${esc(s.culprit.fix)}` };
    if (s.swapSeconds >= 10) return { k: 'Memory ran out.', v: `Windows moved things to the drive for ${fmt(s.swapSeconds)} s (${fmt(s.minRamFreeGb, 1)} GB free at the lowest). Close browser tabs before you play.` };
    if (s.gpuSlowSeconds >= 60 && s.gpuLimited >= 0.4) return { k: 'Heat.', v: `The graphics card slowed itself down for ${dur(s.gpuSlowSeconds)} (${fmt(s.maxGpuTemp)} °C). A steady fps limit keeps it cooler; dust and fan curves do the rest.` };
    const hc = s.hitchCauses || {}, top = Object.keys(hc).filter(k => k !== 'game').sort((a, b) => hc[b] - hc[a])[0];
    if (top && hc[top] >= 5 && s.hitchesPerMin >= 1) {
      const w = (s.worstHitches || []).find(h => h.cause === top);
      const m = CAUSE[top] || [top, '', ''];
      return { k: m[0] + '.', v: `${hc[top]} of the stutters. ${w && w.detail ? esc(w.detail) + ' ' : ''}${m[2]}` };
    }
    if (s.cpuLimited >= 0.55) return { k: 'The processor', v: `on ${Math.round(s.cpuLimited * 100)}% of frames. Lower view distance, effects or crowds; graphics-only settings cost nothing here.` };
    if (s.gpuLimited >= 0.55) return { k: 'The graphics card', v: `on ${Math.round(s.gpuLimited * 100)}% of frames. Lower the resolution scale (or FSR/DLSS), shadows or effects.` };
    if (s.capped >= 0.5) return { k: 'Your fps limit', v: `on ${Math.round(s.capped * 100)}% of frames, which is what a limit is for.` };
    return null;
  }
  // Freezes per app in a session: the new count, or read from the worst moments of older sessions
  function freezesOf(s) {
    const out = {};
    // counted per app (by the name people know) since 2.0; an empty count means nothing froze it
    if (s.freezeApps && Object.keys(s.freezeApps).length) { for (const [l, n] of Object.entries(s.freezeApps)) out[l] = (out[l] || 0) + n; return out; }
    if (s.hitchApps) return out;
    for (const h of s.worstHitches || []) {
      if (!(h.cause === 'app' || h.cause === 'appdisk') || h.ms < 300) continue;
      const m = /^(.+?) (suddenly used|was using your drive hard)/.exec(h.detail || '');
      if (m) out[m[1]] = (out[m[1]] || 0) + 1;
    }
    return out;
  }
  // An app froze the matches before; this one it didn't: say so, it's the clearest sign a change worked
  function freezeGone(s) {
    const prev = S.sessions.filter(x => x.gameId === s.gameId && new Date(x.started) < new Date(s.started)).slice(0, 3);
    if (!prev.length || !hasStutters(s)) return '';
    const before = {};
    for (const p of prev) for (const [l, n] of Object.entries(freezesOf(p))) before[l] = (before[l] || 0) + n;
    const [label, n] = Object.entries(before).sort((a, b) => b[1] - a[1])[0] || [];
    if (!label || n < 2) return '';
    const now = freezesOf(s)[label] || (s.culprit && s.culprit.label === label ? s.culprit.freezes : 0);
    if (now > 0) return '';
    return `<div class="tryit good"><span class="k">FREEZES</span><p><b>No freezes with ${esc(label)} this match.</b> It spiked at ${n} freezes in the ${prev.length === 1 ? 'match' : `${prev.length} matches`} before, so whatever changed, it helped.</p></div>`;
  }

  // A game setting changed between matches: the matches since, against the ones before, measured per frame too
  function tryIt(s) {
    const k = (S.settings.kept || []).filter(x => x.gameId === s.gameId && !x.confirmed && !x.missed && new Date(x.when) < new Date(s.started)).sort((a, b) => new Date(b.when) - new Date(a.when))[0];
    if (!k) return '';
    const all = S.sessions.filter(x => x.gameId === s.gameId);
    const after = all.filter(x => new Date(x.started) > new Date(k.when) && new Date(x.started) <= new Date(s.started)).slice(0, 5);
    const before = all.filter(x => new Date(x.started) < new Date(k.when)).slice(0, 5);
    if (!after.length) return '';
    const m = (arr, f) => median(arr.map(f));
    const sign = v => (v > 0 ? '+' : '') + Math.round(v);
    let body;
    if (!before.length) body = `No matches from before the change to compare with, so this one sets the baseline.`;
    else {
      const fa = m(after, x => x.avgFps), fb = m(before, x => x.avgFps), la = m(after, x => x.low1), lb = m(before, x => x.low1);
      const sa = m(after, smoothOf), sb = m(before, smoothOf);
      // work per frame on the part that held the game back: far less sensitive to which map or fight it was
      const gpuBound = m(before, x => x.gpuLimited) > m(before, x => x.cpuLimited);
      const key = gpuBound ? 'medianGpuBusyMs' : 'medianCpuBusyMs', part = gpuBound ? 'graphics card' : 'processor';
      const wa = m(after, x => x[key] || null), wb = m(before, x => x[key] || null);
      const work = wa && wb ? ` The ${part}'s work per frame went from ${wb.toFixed(1)} to ${wa.toFixed(1)} ms (${sign((wa - wb) / wb * 100)}%).` : '';
      const better = (lb && la > lb * 1.05) || (fb && fa > fb * 1.05) || (wa && wb && wa < wb * 0.93) || (sb != null && sa != null && sa > sb + 3);
      const worse = (lb && la < lb * 0.93) || (sb != null && sa != null && sa < sb - 4);
      body = `${better && !worse ? '<b>It helped.</b>' : worse && !better ? '<b>It made it worse.</b>' : '<b>No clear difference yet.</b>'} ${fmt(fa)} fps on average (was ${fmt(fb)}), worst moments ${fmt(la)} (was ${fmt(lb)})${sa != null && sb != null ? `, ${Math.round(sa)}% smooth (was ${Math.round(sb)})` : ''}.${work}${after.length === 1 ? ' One match is a first look; matches differ, so TEMPO keeps comparing.' : ''}`;
    }
    return `<div class="tryit"><span class="k">SINCE YOU CHANGED ${esc(k.label.toUpperCase())}</span><p>${body}</p>
      <div class="tc-act"><button type="button" class="btn acc" data-kept-ok="${esc(s.gameId)}|${esc(k.key)}">Keep it</button><button type="button" class="btn" data-kept-back="${esc(s.gameId)}|${esc(k.key)}">Put it back (${esc(((k.label.split(': ')[1] || '').split(' → ')[0]) || limitLabel(k.original))})</button></div></div>`;
  }
  document.addEventListener('click', e => {
    const ok = e.target.closest('[data-kept-ok]'), back = e.target.closest('[data-kept-back]');
    if (ok) { const [game, key] = ok.dataset.keptOk.split('|'); send({ t: 'keepKept', game, key }); ok.closest('.tryit').innerHTML = '<p><b>Kept.</b> It stays; the Tune page can put it back any time.</p>'; }
    if (back) { const [game, key] = back.dataset.keptBack.split('|'); send({ t: 'putBack', game, key }); back.closest('.tryit').innerHTML = '<p><b>Put back</b> to how it was.</p>'; }
  });

  function testSide(s) {
    if (s.learn) return `<p class="rc-test">Measured only: TEMPO changed nothing this match, so it's a clean baseline.</p>`;
    if (!s.experimentId) return '';
    const ex = (S.settings.experiments || []).find(x => x.id === s.experimentId);
    if (!ex) return '';
    return `<p class="rc-test">Part of the test "${esc(ex.label)}": this match played ${s.variant === 'b' ? 'with the change' : 'as before'}${ex.kind === 'boost' && s.variant !== 'b' ? ' (so the boost part was off on purpose)' : ''}.</p>`;
  }

  // ------------------------------------------------------------------ 2.0: the check before you play
  // Something you've seen and played anyway doesn't stop you again for a while: three days for tips, half an hour for warnings
  const SNOOZE_KEY = 'tempo-pre-snooze';
  const snoozed = () => { try { return JSON.parse(localStorage.getItem(SNOOZE_KEY) || '{}'); } catch { return {}; } };
  const isSnoozed = (game, it) => (snoozed()[game + '|' + it.id] || 0) > Date.now();
  function snooze(game, items) {
    const all = snoozed(), now = Date.now();
    for (const k of Object.keys(all)) if (all[k] < now) delete all[k];
    for (const it of items) all[game + '|' + it.id] = now + (it.level === 'warn' ? 30 * 60e3 : 3 * 86400e3);
    try { localStorage.setItem(SNOOZE_KEY, JSON.stringify(all)); } catch { }
  }
  const preItems = () => { const p = S.pre, id = S.settings.selectedGame || 'any'; return p && p.game === id ? p.items.filter(i => !i.done && !isSnoozed(id, i)) : []; };
  let preAsked = 0;
  function requestPre(force) {
    const id = S.settings.selectedGame || 'any';
    if (!force && S.pre && S.pre.game === id && Date.now() - S.pre.at < 30000) return;
    if (!force && Date.now() - preAsked < 2500) return;
    preAsked = Date.now();
    send({ t: 'preflight', game: id, then: '' });
  }
  function startPlay(launch) {
    const id = S.settings.selectedGame || 'any';
    const fresh = S.pre && S.pre.game === id && Date.now() - S.pre.at < 30000;
    if (fresh) { if (preItems().length) showPre(launch); else goPlay(launch); return; }
    S.preWant = { launch, id };
    $('power').classList.add('busy');
    send({ t: 'preflight', game: id, then: launch ? 'play' : 'on' });
    clearTimeout(startPlay.t);
    startPlay.t = setTimeout(() => { if (S.preWant) { S.preWant = null; $('power').classList.remove('busy'); goPlay(launch); } }, 4000); // never hold anyone up
  }
  function goPlay(launch) {
    hidePre();
    send({ t: 'on', game: S.settings.selectedGame || 'any', launch: !!launch });
  }
  function showPre(launch) {
    const g = sel(), id = S.settings.selectedGame || 'any', items = ((S.pre && S.pre.items) || []).filter(i => i.done || !isSnoozed(id, i));
    const left = items.filter(i => !i.done).length;
    $('pre').innerHTML = `<div class="pre-top"><span class="pre-k">BEFORE YOU PLAY</span><span class="pre-g">${esc(g ? g.name : 'Any game')}</span><button type="button" class="rc-x" data-pre-close aria-label="Close">&#10005;</button></div>
      <div class="pre-items">${items.map(it => `<div class="pre-it ${it.level}${it.done ? ' ok' : ''}"><i></i><div><b>${esc(it.title)}</b><p>${esc(it.text)}</p></div>${it.done ? `<span class="done">&#10003; ${esc(it.doneText || 'Done')}</span>` : it.action ? `<button type="button" class="btn" data-pre-act="${S.pre.items.indexOf(it)}">${esc(it.actionLabel)}</button>` : ''}</div>`).join('')}</div>
      <p class="note" style="margin-top:6px">Play anyway and these won't stop you again for a while.</p>
      <div class="pre-act"><button type="button" class="btn acc" data-pre-go="${launch ? 1 : 0}">${left ? (launch ? 'Play anyway' : 'Turn on anyway') : (launch ? 'Play' : 'Turn on')}</button><button type="button" class="link" data-pre-close>Not now</button></div>`;
    $('pre').hidden = false;
    body.classList.add('pre-on');
    S.preLaunch = launch;
  }
  function hidePre() { $('pre').hidden = true; body.classList.remove('pre-on'); }
  document.addEventListener('click', e => {
    if (e.target.closest('[data-pre-open]')) { showPre(!!(sel() && sel().canLaunch)); return; }
    if (e.target.closest('[data-pre-close]')) { hidePre(); return; }
    const goB = e.target.closest('[data-pre-go]');
    if (goB) { if (S.pre) snooze(S.pre.game, S.pre.items.filter(i => !i.done)); goPlay(goB.dataset.preGo === '1'); return; }
    const a = e.target.closest('[data-pre-act]');
    if (a && S.pre) {
      const it = S.pre.items[+a.dataset.preAct];
      if (!it) return;
      if (it.action === 'setNow') { send({ t: 'setNow', game: S.pre.game, key: it.key, value: it.value, label: `Fps limit at ${it.value}` }); it.doneText = `Limit ${it.value}`; }
      if (it.action === 'overlayOff') { set('overlay', false); it.doneText = 'Hidden (Ctrl Alt O)'; }
      if (it.action === 'pauseOn') { set('boost.pause', true); it.doneText = 'Pausing once you\'re in'; }
      if (it.action === 'fansOn') { set('cooling.on', true); it.doneText = 'Fans on TEMPO\'s curve'; }
      it.done = true;
      showPre(S.preLaunch);
      renderPlay();
    }
  });

  // ------------------------------------------------------------------ 2.0: the mouse check
  const aim = { on: false, x: 0, y: 0, pts: [], raf: 0 };
  function aimCanvas() {
    const c = $('aim-canvas'), dpr = window.devicePixelRatio || 1, w = c.clientWidth, h = c.clientHeight;
    if (c.width !== w * dpr) { c.width = w * dpr; c.height = h * dpr; }
    const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return [g, w, h];
  }
  // the trail: the mouse's own movement, scaled to fit, fading behind
  function aimDraw(faint) {
    aim.raf = 0;
    const [g, w, h] = aimCanvas();
    g.clearRect(0, 0, w, h);
    const pts = aim.pts, fade = faint === true ? 0.3 : 1;
    if (pts.length > 1) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const [x, y] of pts) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
      const k = Math.min((w - 30) / Math.max(1, maxX - minX), (h - 30) / Math.max(1, maxY - minY));
      const ox = w / 2 - (minX + maxX) / 2 * k, oy = h / 2 - (minY + maxY) / 2 * k;
      const rgb = getComputedStyle(document.documentElement).getPropertyValue('--acc-rgb');
      for (let i = 1; i < pts.length; i++) {
        g.strokeStyle = `rgba(${rgb}, ${((0.08 + 0.7 * i / pts.length) * fade).toFixed(3)})`;
        g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(ox + pts[i - 1][0] * k, oy + pts[i - 1][1] * k); g.lineTo(ox + pts[i][0] * k, oy + pts[i][1] * k); g.stroke();
      }
    }
  }
  function aimLive(m) {
    for (const [dx, dy] of m.moves || []) { aim.x += dx; aim.y += dy; aim.pts.push([aim.x, aim.y]); }
    if (aim.pts.length > 1600) aim.pts = aim.pts.slice(-1600);
    $('aim-hz').textContent = m.moved ? Math.round(m.rate) : '0';
    $('aim-unit').textContent = m.moved ? 'REPORTS A SECOND NOW' : 'MOVE THE MOUSE';
    const done = m.moved ? (8 - m.left) / 8 * 100 : 0;
    $('aim-bar').style.width = done.toFixed(1) + '%';
    $('aim-say').innerHTML = m.moved ? `<b>Keep going</b>: big, quick circles. ${Math.ceil(m.left)} s left.` : 'Move your mouse in big, quick circles. The clock starts when you do.';
    if (!aim.raf) aim.raf = requestAnimationFrame(aimDraw);
  }
  function aimStart() {
    Object.assign(aim, { on: true, x: 0, y: 0, pts: [] });
    $('aim').classList.add('running');
    $('aim').classList.remove('done');
    $('aim-go').textContent = 'Stop';
    $('aim-stats').innerHTML = ''; $('aim-notes').innerHTML = '';
    send({ t: 'aimStart' });
  }
  const AIM_SAY = {
    ok: r => `<b>Steady.</b> Your mouse sends ${r.nominal} reports a second and ${Math.round(r.onTime * 100)}% arrive right on time, so the mouse itself isn't what makes aim feel rough.`,
    uneven: r => `<b>Uneven.</b> It's set to ${r.nominal} reports a second, but ${Math.round((1 - r.onTime) * 100)}% come late or bunched up. Try a USB port on the back of the PC (not a hub or the front panel), and test once with the mouse's own software closed.`,
    slow: r => `<b>Slow.</b> Your mouse only sends ${r.nominal} reports a second. Most gaming mice do 1000: look for "polling rate" or "report rate" in its software.`,
    none: () => `<b>Not enough movement.</b> Move the mouse in big, quick circles for the whole 8 seconds, then it can tell.`,
    error: r => `<b>The mouse couldn't be read.</b> ${esc(r.error || '')}`,
  };
  function aimResult(r) {
    aim.on = false;
    $('aim').classList.remove('running');
    $('aim-go').textContent = 'Check again';
    $('aim-bar').style.width = '0';
    if (aim.raf) { cancelAnimationFrame(aim.raf); aim.raf = 0; }
    if (!r) return;
    $('aim-dev').textContent = [r.device, r.vendor && r.vendor !== r.device ? r.vendor : ''].filter(Boolean).join(' · ');
    $('aim-hz').textContent = r.nominal || '–';
    $('aim-unit').textContent = r.nominal ? 'HZ POLLING' : 'REPORTS A SECOND';
    $('aim-say').innerHTML = (AIM_SAY[r.verdict] || AIM_SAY.none)(r) + pacingLine();
    $('aim-stats').innerHTML = r.verdict === 'none' || r.verdict === 'error' ? '' :
      `<div><div class="k">ON TIME</div><div class="v">${Math.round(r.onTime * 100)}%</div></div><div title="${r.late} came late, ${r.bunched} arrived bunched together"><div class="k">OFF BEAT</div><div class="v">${r.late + r.bunched}</div></div><div><div class="k">LONGEST GAP</div><div class="v">${fmt(r.worstGapMs, 1)} ms</div></div>`;
    $('aim-notes').innerHTML = (r.notes || []).map(n => `<div class="n"><b>${esc(n.title)}</b>${esc(n.text)}</div>`).join('');
    // the intervals as dots: steady reports sit on one line
    if (r.intervals && r.intervals.length) {
      aimDraw(true); // the movement, faint, behind
      const [g, w, h] = aimCanvas();
      const nom = 1e6 / (r.nominal || 1000), top = nom * 3;
      const y = v => h - 12 - Math.min(v, top) / top * (h * 0.42);
      g.strokeStyle = 'rgba(236,238,241,.25)'; g.setLineDash([3, 4]); g.beginPath(); g.moveTo(0, y(nom)); g.lineTo(w, y(nom)); g.stroke(); g.setLineDash([]);
      const rgb = getComputedStyle(document.documentElement).getPropertyValue('--acc-rgb');
      r.intervals.forEach((v, i) => { g.fillStyle = Math.abs(v - nom) <= nom * .25 ? `rgba(${rgb}, .55)` : 'rgba(255,181,71,.85)'; g.fillRect(i / r.intervals.length * w, y(v) - 1, 2, 2); });
      $('aim').classList.add('done');
    }
  }
  // the other half of aim: how evenly the frames came in the last match
  function pacingLine() {
    const s = S.sessions.find(x => smoothOf(x) != null);
    if (!s) return '';
    const sm = smoothOf(s);
    return ` In your last ${esc(s.gameName)} match, <b>${sm}% of frames</b> came on pace${sm < 90 ? ': uneven frames feel like rough aim too, and a steady fps limit helps there' : ''}.`;
  }
  $('aim-go').addEventListener('click', () => { if (aim.on) send({ t: 'aimStop' }); else aimStart(); });
  function renderAim() {
    if (aim.on) return;
    const r = S.settings.lastAim;
    if (r && r.verdict && r.verdict !== 'none') aimResult(r);
  }

  // ------------------------------------------------------------------ calibrate
  const LAB_VERDICT = { better: ['Faster', 'good'], worse: ['Slower', 'bad'], same: ['No difference', 'flat'], unclear: ['Too close to call', 'flat'], failed: ['Didn\'t run', 'flat'], '': ['Not measured', 'flat'] };
  const LAB_ORDER = { better: 0, worse: 1, unclear: 2, same: 3, failed: 4, '': 5 };
  // the game's own profiler groups, in plain words
  const LAB_PARTS = [
    ['Client Rendering', 'Preparing each frame to draw', 'The processor works out what the graphics card should draw.'],
    ['Frame Boundary', 'Waiting at the end of the frame', 'For the graphics card to finish and the frame to go to the screen.'],
    ['Client Simulation', 'Game logic', 'Heroes, abilities and everything moving.'],
    ['PanoramaUI', 'The game\'s interface', 'HUD, health bars, the minimap.'],
    ['Networking', 'Match data', 'In a replay, the recorded match; online, the server\'s updates.'],
    ['SoundOperators', 'Game sound', 'Mixing every sound in the fight.'],
    ['Client Physics', 'Physics', ''],
    ['Client_Animation', 'Animation', ''],
  ];
  const labGame = () => (S.lab && S.lab.game) || 'steam:1422450';
  const labPct = v => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(Math.abs(v) < 10 ? 1 : 0) + '%';
  function requestLab() { send({ t: 'lab', game: labGame() }); }

  function renderLab() {
    if (S.page !== 'calibrate') return;
    const L = S.lab;
    const dl = S.games.find(g => g.id === 'steam:1422450');
    $('cal-for-art').setAttribute('style', dl ? artStyle(dl, 'header') : '');
    $('cal-for-art').hidden = !(dl && dl.art && (dl.art.header || dl.art.capsule));
    if (!L) { $('cal-stage').innerHTML = skel(2); $('cal-side').innerHTML = ''; return; }
    if (!L.supported) {
      $('cal-stage').innerHTML = `<div class="empty"><b>Deadlock isn't installed</b>Calibrate is built specially for Deadlock: it uses Deadlock's own benchmark mode. Install Deadlock through Steam and this page comes to life.</div>`;
      $('cal-side').innerHTML = labWhy();
      return;
    }
    const s = L.session;
    if (L.running && s) $('cal-stage').innerHTML = labRunning(L, s);
    else if (s && !S.labSetup) $('cal-stage').innerHTML = labResults(L, s);
    else $('cal-stage').innerHTML = labSetup(L);
    $('cal-side').innerHTML = labWhy() + labSide(L);
    labBars();
  }
  // why it's Deadlock only (for now)
  function labWhy() {
    return `<div class="cal-why"><b>Why only Deadlock</b><p>Calibrating needs a game that can replay a real match exactly the same way every time, as fast as your PC can draw it. Deadlock has that built in. Most games don't, so for now this page is Deadlock's alone; the rest of TEMPO works with every game.</p></div>`;
  }

  // ---------- before: the fight, how thorough, what it tries
  function labSetup(L) {
    const fits = L.replays.filter(r => r.fits);
    if (!S.labDemo || !fits.find(r => r.name === S.labDemo)) S.labDemo = fits[0] && fits[0].name;
    const plan = S.labPlan || 'thorough';
    const f = L.fetch;
    const blockers = [
      !L.steam && 'Open Steam and sign in: Deadlock needs it.',
      L.gameOpen && 'Close Deadlock first: the calibration opens it by itself.',
      L.tempoOn && 'Turn TEMPO off first: the calibration needs the PC as it is.',
    ].filter(Boolean);
    const replayRows = fits.slice(0, 3).map(r => `<button type="button" class="cal-rep${r.name === S.labDemo ? ' on' : ''}" data-lab-demo="${esc(r.name)}">
        <span class="cr-dot"></span><span class="cr-t"><b>Match ${esc(r.name)}</b><small>${r.minutes.toFixed(0)} minutes · ${when(r.saved)}${r.owned ? ' · fetched by TEMPO' : ''}</small></span><span class="cr-ok">Plays in this version</span></button>`).join('');
    const old = L.replays.filter(r => !r.fits).length;
    const fetchUi = f ? `<div class="cal-fetch"><div class="cf-top"><span>${esc(f.stage)}</span><b>${Math.round((f.pct || 0) * 100)}%</b></div><div class="cf-bar"><i style="width:${Math.round((f.pct || 0) * 100)}%"></i></div></div>`
      : `<button type="button" class="btn${fits.length ? '' : ' acc'}" data-lab="fetch">${fits.length ? 'Get a newer one' : 'Get a fresh replay'}</button><span class="note cal-fetch-note">About 250 MB, from Valve's replay servers. The match is picked by deadlock-api.com (free and fan-made); nothing about you is sent.</span>`;
    const tests = L.tests.map((t, i) => `<li><span class="ct-n">${i + 1}</span><div><b>${esc(t.label)}</b><small>${esc(t.why)}</small></div></li>`).join('');
    const runs = plan === 'quick' ? L.runs.quick : L.runs.thorough, mins = plan === 'quick' ? L.runs.quickMin : L.runs.thoroughMin;
    return `<div class="cal-card setup">
      <div class="cal-step"><span class="n">1</span><div><b>The fight</b><small>One busy minute of a real match, late in the game, played exactly the same way every time.</small></div></div>
      <div class="cal-reps">${replayRows || `<div class="cal-none"><b>No replay for this version of Deadlock yet</b><small>Replays only play in the version of the game that recorded them${old ? `; the ${old} you have ${old === 1 ? 'is' : 'are'} from before an update` : ''}. TEMPO can fetch one from a match that just finished.</small></div>`}</div>
      <div class="cal-fetch-row">${fetchUi}</div>
      <div class="cal-step"><span class="n">2</span><div><b>How thorough</b><small>Your PC wobbles a little from run to run; more runs see smaller differences.</small></div></div>
      <div class="cal-plans">
        <button type="button" class="cal-plan${plan === 'quick' ? ' on' : ''}" data-lab-plan="quick"><b>Quick</b><span class="cp-t">about ${L.runs.quickMin} min</span><small>Each change once. Finds the big ones.</small></button>
        <button type="button" class="cal-plan${plan === 'thorough' ? ' on' : ''}" data-lab-plan="thorough"><b>Thorough</b><span class="cp-t">about ${L.runs.thoroughMin} min</span><small>Each change twice, and again if it's close. Catches smaller gains.</small></button>
      </div>
      <div class="cal-step"><span class="n">3</span><div><b>What it tries</b><small>One at a time, with your setup as it is in between. Nothing stays changed unless you keep it.</small></div></div>
      <ol class="cal-tests">${tests}</ol>
      ${blockers.length ? `<p class="note warn cal-block">${blockers.map(esc).join(' ')}</p>` : ''}
      <div class="cal-go">
        <button type="button" class="btn acc big" data-lab="start"${!fits.length || blockers.length || f ? ' disabled' : ''}>Start calibration</button>
        <p class="note">Deadlock opens and closes by itself ${runs} times. Leave the PC alone meanwhile: anything else you do changes the results. A good moment is while you eat. Stop any time; everything goes back as it was.</p>
      </div>
      ${S.labSetup && L.session ? `<button type="button" class="link cal-back" data-lab="results">Back to the last results</button>` : ''}
    </div>`;
  }

  // ---------- during: which run, what's happening, every run as a bar
  function labRunning(L, s) {
    const n = Math.min(s.total, s.done + 1);
    const left = Math.max(1, Math.round((s.total - s.done) * 1.75 - 0.5));
    return `<div class="cal-card run">
      <div class="run-top">
        <div class="run-n"><b>${n}</b><span>of ${s.total}</span></div>
        <div class="run-what"><div class="k">${L.stopping ? 'STOPPING AFTER THIS RUN' : 'NOW'}</div><b>${esc(L.step || 'Getting ready')}</b><small>About ${left} minute${left === 1 ? '' : 's'} left · ${s.plan === 'quick' ? 'Quick' : 'Thorough'} · match ${esc(s.demo)}</small></div>
        ${L.stopping ? '' : '<button type="button" class="btn" data-lab="stop">Stop after this run</button>'}
      </div>
      <div class="run-chart"><canvas id="lab-bars"></canvas></div>
      <div class="run-legend"><span><i class="lg base"></i>Your setup as it is</span><span><i class="lg test"></i>A change being tried</span><span><i class="lg warm"></i>Warm-up, not counted</span></div>
      ${s.tests.some(t => t.verdict) ? `<div class="run-early">${s.tests.filter(t => t.verdict && t.verdict !== 'failed').map(t => `<span class="re ${t.verdict}">${esc(t.label)} <b>${labPct(t.gain)}</b></span>`).join('')}<small>So far; the verdict waits until the end.</small></div>` : ''}
      <p class="note">TEMPO's window sleeps while Deadlock plays, so it costs the measurement nothing. If you need the PC, stop after this run; you can carry on another time.</p>
    </div>`;
  }

  // ---------- after: your PC's number, then each change, best first
  function labResults(L, s) {
    const tests = s.tests.slice().sort((a, b) => (LAB_ORDER[a.verdict] ?? 9) - (LAB_ORDER[b.verdict] ?? 9) || b.gain - a.gain);
    const head = s.baseFps ? `<div class="res-head">
        <div><div class="k">YOUR PC ON THIS FIGHT</div><div class="res-big">${fmt(s.baseFps, 0)}<small>FPS</small></div></div>
        <div class="res-facts"><div><b>${fmt(s.baseP95, 1)} ms</b><span>the slowest 5% of frames</span></div><div><b>±${fmt(s.noise, 1)}%</b><span>from run to run</span></div><div><b>${esc(s.render || 'DirectX 11')}</b><span>${s.done} runs · ${when(s.started)}</span></div></div>
      </div>` : '';
    const status = s.status === 'done' ? '' : `<div class="res-status ${s.status}"><b>${s.status === 'stopped' ? 'Stopped before the end' : 'Stopped'}</b><p>${esc(s.note || '')}${s.status === 'failed' && /replay/i.test(s.note || '') ? ' Get a fresh replay and start again.' : ''} ${s.done ? 'What was measured so far is below.' : ''}</p></div>`;
    const hz = s.gameHz && s.desktopHz && s.gameHz < s.desktopHz - 1 ? `<div class="fd fix">
        <div class="fd-top"><span class="pill fix">FOUND</span><b>Deadlock runs your screen at ${s.gameHz} Hz</b><span class="sp"></span><span class="gain hz">${s.gameHz}<i>→</i>${s.desktopHz}</span></div>
        <p>Your screen does ${s.desktopHz} Hz, but Deadlock's own setting switches it to ${s.gameHz} Hz while you play. Even at the same fps, everything moves less smoothly and reaches your eyes later. This one doesn't change fps; it's how fast the screen can show them.</p>
        <div class="fd-act"><button type="button" class="btn acc" data-lab-hz="${esc(s.id)}">Set Deadlock to ${s.desktopHz} Hz</button><span class="note" style="margin:0">Or in Deadlock: Settings, Video, Refresh rate.</span></div></div>` : '';
    const cards = tests.map(t => labFinding(s, t)).join('');
    const disturbed = s.disturbed ? `<p class="note warn" style="margin-top:12px">The PC was used during ${s.disturbed} run${s.disturbed === 1 ? '' : 's'}, which makes those numbers less steady.</p>` : '';
    return `<div class="cal-card res">${head}${status}${hz}<div class="fd-list">${cards}</div>${disturbed}
      <div class="res-foot"><button type="button" class="btn" data-lab="again">Calibrate again</button><span class="note" style="margin:0">After a Deadlock update, a new driver or new parts, or to measure more closely.</span></div></div>`;
  }

  function labFinding(s, t) {
    const [vt, vc] = LAB_VERDICT[t.verdict] || LAB_VERDICT[''];
    const gainCls = t.verdict === 'better' ? 'up' : t.verdict === 'worse' ? 'down' : '';
    const rng = t.runs ? rangeBar({ a: 100, b: 100 + t.gain, diff: t.gain, lo: t.gain - t.margin, hi: t.gain + t.margin, call: t.verdict }, '%') : '';
    let act = '';
    if (t.verdict === 'better') {
      if (t.keep === 'config') act = t.kept ? '<span class="pill good">KEPT</span><span class="note" style="margin:0">Put it back any time on the Tune page.</span>'
        : `<button type="button" class="btn acc" data-lab-keep="${esc(t.id)}" data-lab-sess="${esc(s.id)}">Keep it</button><span class="note" style="margin:0">${esc(Object.keys(t.config).map(k => labSetName(k, t)).join(', '))}</span>`;
      else if (t.keep === 'launch') act = `<div class="fd-how"><b>Keep it in Steam</b><span>${esc(t.keepText)}</span>${t.id === 'vulkan' ? '<button type="button" class="btn" data-copy="-vulkan">Copy -vulkan</button>' : ''}</div>`;
      else if (t.keep === 'boost') act = '<span class="note" style="margin:0">Turn TEMPO on before you play, and the boost is on.</span>';
    } else if (t.verdict === 'worse' && t.id === 'boost') act = `<button type="button" class="btn" data-go-page="boost">Open Boost</button><span class="note" style="margin:0">See which parts to switch off.</span>`;
    else if (t.verdict === 'worse' && t.id === 'noopts') act = `<span class="note" style="margin:0">Your launch options help: keep them.</span>`;
    return `<div class="fd ${t.verdict || 'none'}">
      <div class="fd-top"><span class="pill ${vc}">${vt.toUpperCase()}</span><b>${esc(t.label)}</b><span class="sp"></span>${t.runs ? `<span class="gain ${gainCls}">${labPct(t.gain)}</span>` : ''}</div>
      ${rng ? `<div class="fd-rng">${rng}</div>` : ''}
      <p>${esc(t.summary || t.why)}</p>
      ${t.runs && Math.abs(t.worstGain) >= 1 ? `<p class="fd-worst">Slowest frames: ${t.worstGain >= 0 ? `${fmt(t.worstGain, 0)}% faster` : `${fmt(-t.worstGain, 0)}% slower`}</p>` : ''}
      ${act ? `<div class="fd-act">${act}</div>` : ''}
    </div>`;
  }
  function labSetName(k, t) {
    const n = { 'setting.r_citadel_ssao_quality': 'Ambient occlusion', 'setting.shaderquality': 'Shader detail', 'setting.r_particle_depth_feathering': 'Soft particles', 'setting.r_citadel_fog_quality': 'Fog', 'setting.r_citadel_shadow_quality': 'Shadows', 'setting.cpu_level': 'Processor detail', 'nv.pstate': 'NVIDIA power' }[k] || k.replace('setting.', '');
    return `${n} ${t.was && t.was[k] != null ? `${t.was[k]} → ` : ''}${t.config[k]}`;
  }

  // ---------- the side: where a frame's time goes, earlier calibrations
  function labSide(L) {
    const s = L.session;
    const parts = s && s.parts || {};
    const total = parts.FrameTotal || 0;
    let frame = '';
    if (total > 0) {
      const rows = LAB_PARTS.filter(([k]) => parts[k] > 0.2).map(([k, name, help]) => ({ k, name, help, ms: parts[k] })).sort((a, b) => b.ms - a.ms).slice(0, 6);
      const top = rows[0];
      frame = `<div class="sec-h" style="margin-top:4px"><span>Where a frame's time goes</span><small>${fmt(total, 1)} ms a frame</small></div>
        <div class="cal-frame">${rows.map(r => `<div class="cfp"><div class="cfp-t"><b>${esc(r.name)}</b><span>${fmt(r.ms, 1)} ms</span></div><div class="cfp-bar"><i style="width:${Math.min(100, r.ms / total * 100)}%"></i></div>${r.help ? `<small>${esc(r.help)}</small>` : ''}</div>`).join('')}
        <p class="note">From Deadlock's own profiler, during this fight on your PC. Parts run side by side on different cores, so they add up to more than a frame.${top && top.k === 'Client Rendering' ? ' The biggest is the processor preparing what to draw: settings that lighten the graphics card help little here.' : top && top.k === 'Frame Boundary' ? ' The biggest is waiting for the graphics card: lighter graphics settings help most.' : ''}</p></div>`;
    } else frame = `<div class="sec-h" style="margin-top:4px"><span>Where a frame's time goes</span></div><div class="empty"><b>After the first run</b>Deadlock's own profiler shows where each frame's time goes on your PC: preparing the picture, game logic, the interface, waiting for the graphics card.</div>`;
    const hist = (L.history || []).filter(h => h.runs > 0);
    const history = hist.length ? `<div class="sec-h"><span>Earlier calibrations</span></div>` + hist.map(h => `<div class="cal-hist${s && h.id === s.id ? ' on' : ''}" data-lab-open="${esc(h.id)}"><div><b>${when(h.started)}</b><small>${h.plan === 'quick' ? 'Quick' : 'Thorough'} · ${h.runs} runs${h.status !== 'done' ? ' · stopped' : ''}</small></div><div class="ch-r"><b>${h.baseFps ? fmt(h.baseFps, 0) + ' fps' : '–'}</b><small>${h.best ? `${esc(h.best.label)} ${labPct(h.best.gain)}` : 'nothing faster'}</small></div></div>`).join('') : '';
    return frame + history;
  }

  // the runs as bars (done, going, to come)
  function labBars() {
    const c = $('lab-bars');
    const s = S.lab && S.lab.session;
    if (!c || !s) return;
    const dpr = devicePixelRatio || 1, w = c.clientWidth, h = c.clientHeight;
    c.width = w * dpr; c.height = h * dpr;
    const x = c.getContext('2d');
    x.scale(dpr, dpr);
    const runs = s.runs || [], queue = s.queue || [];
    const all = runs.map(r => ({ ...r, state: 'done' })).concat(queue.map((q, i) => ({ test: q.replace('warm:', ''), warmup: q.startsWith('warm:'), state: i === 0 ? 'now' : 'todo' })));
    const fpsList = runs.filter(r => r.ok && r.fps > 0).map(r => r.fps);
    const lo = fpsList.length ? Math.min(...fpsList) * 0.86 : 40, hi = fpsList.length ? Math.max(...fpsList) * 1.04 : 70;
    const n = Math.max(all.length, 8), gap = 4, bw = Math.max(6, (w - gap * (n - 1)) / n);
    const acc = getComputedStyle(body).getPropertyValue('--acc').trim() || '#D4FF3F';
    const t = performance.now();
    x.font = '500 10px "Geist Mono", monospace';
    x.textAlign = 'center';
    all.forEach((r, i) => {
      const px = i * (bw + gap), base = r.test === 'base';
      let bh;
      if (r.state === 'done' && r.ok) bh = Math.max(6, (r.fps - lo) / (hi - lo) * (h - 22));
      else if (r.state === 'done') bh = 6;
      else bh = fpsList.length ? Math.max(10, (fpsList.reduce((a, b) => a + b, 0) / fpsList.length - lo) / (hi - lo) * (h - 22)) : (h - 22) * .55;
      const y = h - 14 - bh;
      if (r.state === 'todo') { x.strokeStyle = 'rgba(255,255,255,.08)'; x.setLineDash([3, 3]); x.strokeRect(px + .5, y + .5, bw - 1, bh - 1); x.setLineDash([]); }
      else if (r.state === 'now') {
        const a = .1 + .08 * Math.sin(t / 320);
        const rgb = base ? '236,238,241' : getComputedStyle(body).getPropertyValue('--acc-rgb').trim();
        x.fillStyle = `rgba(${rgb},${a})`;
        x.fillRect(px, y, bw, bh);
        x.strokeStyle = `rgba(${rgb},${.35 + .25 * Math.sin(t / 320)})`;
        x.strokeRect(px + .5, y + .5, bw - 1, bh - 1);
      } else {
        x.fillStyle = !r.ok ? 'rgba(255,107,87,.7)' : r.warmup ? 'rgba(255,255,255,.12)' : base ? 'rgba(236,238,241,.38)' : acc;
        x.fillRect(px, y, bw, bh);
        if (r.ok && bw >= 18 && !r.warmup) { x.fillStyle = base ? 'rgba(236,238,241,.75)' : acc; x.fillText(Math.round(r.fps), px + bw / 2, y - 4); }
      }
    });
    if (S.lab.running) { cancelAnimationFrame(labBars.raf); labBars.raf = requestAnimationFrame(() => { if (S.page === 'calibrate') labBars(); }); }
  }

  $('page-calibrate').addEventListener('click', e => {
    const b = e.target.closest('button, [data-lab-open]');
    if (!b) return;
    const L = S.lab;
    if (b.dataset.labDemo) { S.labDemo = b.dataset.labDemo; renderLab(); return; }
    if (b.dataset.labPlan) { S.labPlan = b.dataset.labPlan; renderLab(); return; }
    if (b.dataset.labKeep) { send({ t: 'labKeep', id: b.dataset.labSess, test: b.dataset.labKeep }); return; }
    if (b.dataset.labHz) { send({ t: 'labHz', id: b.dataset.labHz }); return; }
    if (b.dataset.labOpen) { const h = (L.history || []).find(x => x.id === b.dataset.labOpen); if (h) { S.labSetup = false; send({ t: 'lab', game: labGame(), open: h.id }); } return; }
    if (b.dataset.copy) { navigator.clipboard && navigator.clipboard.writeText(b.dataset.copy).catch(() => { }); toast(`Copied ${b.dataset.copy}. Paste it into Deadlock's launch options in Steam.`); return; }
    switch (b.dataset.lab) {
      case 'fetch': send({ t: 'labFetch', game: labGame() }); break;
      case 'start': S.labSetup = false; send({ t: 'labStart', game: labGame(), demo: S.labDemo || '', plan: S.labPlan || 'thorough' }); break;
      case 'stop': send({ t: 'labStop' }); break;
      case 'again': S.labSetup = true; renderLab(); break;
      case 'results': S.labSetup = false; renderLab(); break;
    }
  });

  // ------------------------------------------------------------------ messages from the app
  function onMsg(m) {
    switch (m.t) {
      case 'init':
        Object.assign(S, { settings: m.settings, games: m.games, sessions: m.sessions || [], hw: m.hw || {}, version: m.version });
        $('version').textContent = 'v' + m.version;
        $('hw').textContent = [S.hw.cpu, S.hw.gpu && `${S.hw.gpu}${S.hw.vram && !/GB/i.test(S.hw.gpu) ? ` ${S.hw.vram}GB` : ''}`, S.hw.ram && `${S.hw.ram} GB`, S.hw.hz && `${S.hw.hz} Hz`].filter(Boolean).join(' · ');
        S.boostStatus = m.boostStatus || {};
        applyTheme();
        intro(!!m.noIntro);
        S.shortcuts = m.shortcuts || null;
        syncShortcuts();
        setTimeout(offerShortcuts, m.noIntro || S.settings.intro === false || still() ? 300 : 2400); // after the intro, if there is one
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
        if (S.page === 'fans') renderFans();
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
      case 'settings': S.settings = m.settings; applyTheme(); syncControls(); renderPlay(); if (S.page === 'overlay') renderOverlaySample(); renderAimPage(); break;
      case 'toast': toast(m.text); break;
      case 'checkup': S.checkup = (m.findings || []).map(f => ({ level: f.level, title: esc(f.title), text: esc(f.text) })); S.boostStatus = m.boostStatus || S.boostStatus; renderCheckup(); break;
      case 'update': { const u = $('update'); u.hidden = false; u.dataset.url = m.url; u.textContent = `Update ${m.version}`; break; }
      case 'tune': S.tune = m; renderTune(); renderSA(); break;
      case 'lab': {
        const was = S.lab;
        S.lab = m;
        if (was && was.running && !m.running) S.labSetup = false; // just finished: the results
        renderLab();
        break;
      }
      case 'labFetch': if (S.lab) { S.lab.fetch = { stage: m.stage, pct: m.pct }; renderLab(); } break;
      case 'aimState': AIM.st = m; renderAimPage(); break;
      case 'raw': trRaw(m.r); break;
      case 'trCaptureLost': if (m.why) toast(m.why); trLetGo(); break;
      case 'whatsnew': whatsNew(m.version); break;
      case 'phone': S.phone = m; renderPhone(); break;
      case 'apps': S.appsData = m; S.apps = m.apps; S.boostStatus = m.boostStatus || S.boostStatus; renderBoost(); break;
      case 'preflight': {
        S.pre = { game: m.game, at: Date.now(), items: m.items || [] };
        const want = S.preWant;
        if (want && want.id === m.game) {
          S.preWant = null; clearTimeout(startPlay.t);
          $('power').classList.remove('busy');
          if (S.pre.items.length) showPre(want.launch); else goPlay(want.launch);
        }
        if (S.page === 'play' && S.st.state === 'off') { const keep = $('pre').hidden; renderPlay(); if (!keep) showPre(S.preLaunch); }
        break;
      }
      case 'aimLive': aimLive(m); break;
      case 'fans': S.fans = m; applyFanTab(); renderFans(); break;
      case 'shortcuts': S.shortcuts = m.shortcuts; syncShortcuts(); break;
      case 'listening': listenCountdown(m.seconds || 8); break;
      case 'aim': if (m.cancelled) aimResult(null); else { S.settings.lastAim = m.result; aimResult(m.result); renderSA(); } break;
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
