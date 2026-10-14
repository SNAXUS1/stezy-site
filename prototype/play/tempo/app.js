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
  const DEFAULT_ON = new Set(['overlay', 'autoOff', 'artBehindDial', 'boost.stepBack', 'boost.gameFirst', 'boost.gameMode', 'boost.recording', 'boost.powerPlan', 'boost.memoryRelief', 'boost.strongGpu', 'boost.smoothWindowed']);
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
      <ul class="rc-new">${fansOk ? `<li><b>Fans:</b> your graphics card's fans follow a curve you choose while you play, never past your highest speed, and go back to normal when the game closes.</li>` : ''}
      <li><b>Play checks first:</b> what could cost this match (memory, downloads, the drive, launch options, no fps limit), with one-click fixes.</li>
      <li><b>After each match:</b> how it went against your usual, how smooth it was, the one thing that held it back, and the whole match minute by minute.</li>
      <li><b>Game settings that reach the game</b> on any PC, a mouse check, and an NVIDIA driver fps limit for any game.</li></ul>
      <button type="button" class="rc-go" data-go-page="${fansOk ? 'fans' : 'sessions'}">${fansOk ? 'Set up your fans' : 'See your matches'} &rarr;</button>`;
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
  };
  const svgIcon = (name, size = 16) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name] || ''}</svg>`;
  // every settings row gets its icon (in a small tile that takes on the accent when the row is on)
  const ROW_ICON = { 'boost.stepBack': 'layers', 'boost.gameFirst': 'up', 'boost.gameMode': 'pad', 'boost.recording': 'rec', 'boost.powerPlan': 'bolt', 'boost.memoryRelief': 'chip',
    'boost.pause': 'pause', 'boost.smoothWindowed': 'window', 'boost.strongGpu': 'gpu', 'cooling.on': 'fan', overlay: 'eye', overlayStyle: 'layout', overlayBox: 'square',
    overlaySize: 'resize', overlayCorner: 'corner', overlayNumbers: 'palette', overlayHideFromCapture: 'eyeoff', artStyle: 'image', grain: 'sparkle', motion: 'wave', autoOff: 'power' };
  document.querySelectorAll('.set .rowx').forEach(r => {
    const c = r.querySelector('[data-set]'), key = c ? c.dataset.set : r.querySelector('#ov-show') ? 'show' : null;
    const name = key === 'show' ? 'list' : ROW_ICON[key];
    if (!name || r.querySelector('.ri')) return;
    const i = document.createElement('i');
    i.className = 'ri';
    i.innerHTML = svgIcon(name);
    r.prepend(i);
    r.classList.add('has-ri');
  });
  // a shimmer while something is being looked at (instead of a line of text)
  const skel = (rows = 2) => Array.from({ length: rows }, (_, i) => `<div class="skel-card"><i class="sk" style="width:${[38, 46, 30][i % 3]}%"></i><i class="sk" style="width:${[92, 84, 88][i % 3]}%"></i><i class="sk" style="width:${[64, 72, 58][i % 3]}%"></i></div>`).join('');

  // ------------------------------------------------------------------ pages
  function go(page) {
    if (page === 'fans' && S.fans && S.fans.able === false) { const b = document.querySelector('.nav [data-go="fans"]'); pop(b, b.dataset.naTitle, b.dataset.naWhy); return; }
    S.page = page;
    body.dataset.page = page;
    document.querySelectorAll('.nav button').forEach(b => b.classList.toggle('on', b.dataset.go === page));
    for (const p of ['play', 'boost', 'fans', 'tune', 'sessions', 'checkup', 'overlay', 'look']) $('page-' + p).hidden = p !== page;
    if (page === 'fans') { renderFans(); send({ t: 'fans' }); }
    if (page === 'checkup') { renderCheckup(); renderAim(); send({ t: 'checkup' }); }
    if (page !== 'checkup' && aim.on) send({ t: 'aimStop' });
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
      case 'settings': S.settings = m.settings; applyTheme(); syncControls(); renderPlay(); if (S.page === 'overlay') renderOverlaySample(); break;
      case 'toast': toast(m.text); break;
      case 'checkup': S.checkup = (m.findings || []).map(f => ({ level: f.level, title: esc(f.title), text: esc(f.text) })); S.boostStatus = m.boostStatus || S.boostStatus; renderCheckup(); break;
      case 'update': { const u = $('update'); u.hidden = false; u.dataset.url = m.url; u.textContent = `Update ${m.version}`; break; }
      case 'tune': S.tune = m; renderTune(); break;
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
      case 'listening': listenCountdown(m.seconds || 8); break;
      case 'aim': if (m.cancelled) aimResult(null); else { S.settings.lastAim = m.result; aimResult(m.result); } break;
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
