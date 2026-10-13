/* The shiny-things hunt. Seven little gems are hidden around stezy.lt: one in plain sight, the rest in
   places that need a lamp, an echo, a dive, a record that won't sit still, the end of the news and a page
   that doesn't exist. Find all seven and ADHD mode unlocks (js/adhd.js, only loaded once it has been).
   Progress lives in this browser only (localStorage). */
(() => {
  const S = window.__stezy;
  if (!S || window.__shiny) return;
  const { field, store, toast } = S;
  const reduce = S.reduce;
  const root = document.documentElement, body = document.body;

  const SPOTS = [
    { id: 'start', place: 'On the start screen', hint: 'It was in plain sight all along.' },
    { id: 'echo', place: 'In the dark, in Echo', hint: 'Make some noise in the dark.' },
    { id: 'record', place: 'On the Schedule Steve record', hint: 'Round and round it goes.' },
    { id: 'lamp', place: "Under Nocturne's lamp", hint: "You'll need a lamp." },
    { id: 'sea', place: 'On the sea floor, in Undertow', hint: 'Follow the bubbles down.' },
    { id: 'first', place: 'At the very end of Latest', hint: 'The news goes back further than you think.' },
    { id: 'lost', place: 'Lost in the static (404)', hint: 'Get lost.' }
  ];
  const TOTAL = SPOTS.length;
  const KEY = 'stezy-shiny', NEW = 'stezy-shiny-new';
  const read = () => { try { return JSON.parse(store.get(KEY) || '[]'); } catch (e) { return []; } };
  const found = new Set(read().filter(id => SPOTS.some(s => s.id === id)));
  const save = () => store.set(KEY, JSON.stringify([...found]));
  // A gem found on the 404 page lands here on the next visit, so it still gets its moment
  const pending = SPOTS.some(s => s.id === store.get(NEW)) && found.has(store.get(NEW)) ? store.get(NEW) : '';
  if (store.get(NEW)) store.set(NEW, '');
  let shown = found.size - (pending ? 1 : 0); // gems already on the button (the pending one is still on its way)
  const count = (path, title) => { try { if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path, title, event: true }); } catch (e) {} };
  const overlayOpen = () => ['latest', 'index'].some(id => { const el = document.getElementById(id); return el && !el.hidden; });

  // ---------- Sounds: small synthesised chimes, very quiet, and only if the visitor hasn't turned sound off ----------
  const sfx = (() => {
    let ac = null, out = null, noiseBuf = null;
    const ok = () => store.get('stezy-sound') !== 'off';
    function ctx() {
      if (!ac) {
        const C = window.AudioContext || window.webkitAudioContext;
        if (!C) return null;
        ac = new C();
        out = ac.createGain();
        out.gain.value = 0.026;
        const comp = ac.createDynamicsCompressor();
        comp.threshold.value = -16; comp.ratio.value = 4;
        out.connect(comp); comp.connect(ac.destination);
      }
      if (ac.state === 'suspended') ac.resume().catch(() => {});
      return ac;
    }
    function tone(f, o = {}) {
      if (!ok() && !o.force) return;
      const c = ctx(); if (!c) return;
      const t0 = c.currentTime + (o.at || 0), dur = o.dur || 0.35, v = o.vol == null ? 1 : o.vol;
      const osc = c.createOscillator(), g = c.createGain();
      osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(f, t0);
      if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + (o.glide || dur));
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), t0 + (o.attack || 0.004));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g); g.connect(o.dest || out);
      osc.start(t0); osc.stop(t0 + dur + 0.05);
    }
    function noise(o = {}) {
      if (!ok() && !o.force) return;
      const c = ctx(); if (!c) return;
      if (!noiseBuf) {
        noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      const t0 = c.currentTime + (o.at || 0), dur = o.dur || 0.2, v = o.vol == null ? 1 : o.vol;
      const src = c.createBufferSource(), flt = c.createBiquadFilter(), g = c.createGain();
      src.buffer = noiseBuf; src.loop = true;
      src.playbackRate.value = o.rate || 1;
      flt.type = o.type || 'bandpass'; flt.frequency.value = o.freq || 2000; flt.Q.value = o.q || 0.8;
      if (o.to) flt.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), t0 + (o.attack || 0.004));
      // crackle: the level jumps around (sand, glass, a can giving way)
      if (o.crackle) for (let k = 1; k < 14; k++) g.gain.setValueAtTime(Math.max(0.0002, v * (0.15 + Math.random() * 0.85)), t0 + (dur * k) / 14);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(flt); flt.connect(g); g.connect(o.dest || out);
      src.start(t0, Math.random() * 0.8); src.stop(t0 + dur + 0.05);
    }
    // a major pentatonic run from C5: gem by gem, the chime climbs
    const PENTA = [0, 2, 4, 7, 9];
    const note = i => 523.25 * Math.pow(2, (PENTA[((i % 5) + 5) % 5] + 12 * Math.floor(i / 5)) / 12);
    function chime(n) {
      const f = note(n + 1);
      tone(f, { dur: 1.1, vol: 0.85 });
      tone(f * 2, { dur: 0.5, vol: 0.28, at: 0.01 });
      tone(f * 3.01, { dur: 0.22, vol: 0.12 });
      tone(note(n + 3), { dur: 0.9, vol: 0.45, at: 0.085 });
    }
    function fanfare() {
      [0, 1, 2, 3, 4, 5, 6, 7].forEach((k, i) => tone(note(k + 2), { at: i * 0.065, dur: 1.3, vol: 0.5 }));
      tone(note(2) / 2, { dur: 1.9, vol: 0.5, type: 'triangle', at: 0.5 });
      tone(note(4) / 2, { dur: 1.9, vol: 0.35, type: 'triangle', at: 0.5 });
      noise({ at: 0.5, dur: 1.4, type: 'highpass', freq: 7000, vol: 0.18 });
    }
    return { ok, ctx, tone, noise, note, chime, fanfare, out: () => out };
  })();

  // ---------- Look ----------
  const css = `
  @property --gem-a { syntax: '<angle>'; inherits: false; initial-value: 0deg; }
  .gem {
    position: relative; display: block; width: 16px; height: 14px;
    clip-path: polygon(22% 0, 78% 0, 100% 34%, 50% 100%, 0 34%);
    background:
      linear-gradient(118deg, rgba(255,255,255,.95) 0 13%, transparent 32%),
      linear-gradient(180deg, transparent 0 32%, rgba(255,255,255,.6) 33% 36%, transparent 37%),
      linear-gradient(62deg, transparent 0 47%, rgba(255,255,255,.4) 49% 51%, transparent 53%),
      linear-gradient(-62deg, transparent 0 47%, rgba(255,255,255,.32) 49% 51%, transparent 53%),
      conic-gradient(from var(--gem-a) at 50% 42%, #FF9AD5, #FFE58A, #9AF0D2, #8FB8FF, #C59AFF, #FF9AD5);
    animation: gem-spin 3.6s linear infinite;
  }
  @keyframes gem-spin { to { --gem-a: 360deg; } }

  /* A shiny thing: the gem, a soft glow, and a glint that flashes now and then */
  .shiny {
    position: absolute; z-index: 4; width: 44px; height: 44px; margin: -22px 0 0 -22px; padding: 0;
    border: 0; border-radius: 50%; background: none; cursor: pointer; display: grid; place-items: center;
    -webkit-tap-highlight-color: transparent; color: inherit;
  }
  .shiny::before {
    content: ""; position: absolute; inset: 7px; border-radius: 50%; pointer-events: none;
    background: radial-gradient(closest-side, rgba(255, 244, 255, .6), rgba(200, 175, 255, .2) 55%, transparent);
    animation: shiny-breathe 3.2s ease-in-out infinite;
  }
  .shiny::after {
    content: ""; position: absolute; left: 24px; top: 9px; width: 13px; height: 13px; pointer-events: none;
    background:
      linear-gradient(90deg, transparent, #fff, transparent) center / 100% 1.5px no-repeat,
      linear-gradient(0deg, transparent, #fff, transparent) center / 1.5px 100% no-repeat;
    opacity: 0; animation: shiny-glint 4.6s var(--ease-out, ease-out) infinite var(--gd, 0s);
  }
  .shiny .gem { transition: scale .22s var(--ease-out, ease-out), opacity .3s ease; animation: gem-spin 3.6s linear infinite, gem-bob 2.8s ease-in-out infinite var(--gd, 0s); }
  @keyframes gem-bob { 50% { translate: 0 -2.5px; } }
  @keyframes shiny-breathe { 0%, 100% { opacity: .65; scale: .9; } 50% { opacity: 1; scale: 1.08; } }
  @keyframes shiny-glint { 0%, 74%, 100% { opacity: 0; transform: scale(.1) rotate(0deg); } 82% { opacity: 1; transform: scale(1) rotate(45deg); } 92% { opacity: 0; transform: scale(.2) rotate(90deg); } }
  @media (hover: hover) and (pointer: fine) { .shiny:hover .gem { scale: 1.3; } .shiny:hover::before { inset: 3px; } }
  .shiny:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
  .shiny.got { pointer-events: none; }
  .shiny.got .gem { scale: 2.1; opacity: 0; transition: scale .4s var(--ease-out, ease-out), opacity .3s ease .08s; }
  .shiny.got::before { animation: shiny-pop .55s var(--ease-out, ease-out) forwards; }
  .shiny.got::after { animation: none; opacity: 0; }
  @keyframes shiny-pop { 0% { opacity: 1; scale: 1; } 100% { opacity: 0; scale: 3.4; } }
  .scene:not(.is-active) .shiny .gem, .scene:not(.is-active) .shiny::before, .scene:not(.is-active) .shiny::after,
  .scene:not(.is-active) .shiny .bubbles i { animation-play-state: paused; }
  .intro-play .shiny { opacity: 0; }
  .shiny:not([data-reveal]) { transition: opacity .8s ease .3s; }

  /* Where each one hides */
  .shiny-start { left: 80%; top: 22%; }
  [data-theme="light"] .shiny-start::before { background: radial-gradient(closest-side, rgba(120, 90, 255, .35), rgba(120, 90, 255, .08) 55%, transparent); }
  .shiny-echo { left: 13%; top: 30%; }
  .shiny-record { left: 85%; top: 50%; pointer-events: auto; }
  .shiny-lamp { left: 13%; top: 66%; }
  .shiny-sea { left: 63%; top: 87%; }
  .shiny-sea .gem { filter: saturate(.85) brightness(.9); }
  .lt-end { position: relative; }
  .shiny-first { left: -22.5px; top: 50%; }
  .shiny[data-reveal] { opacity: 0; pointer-events: none; }
  @media (max-width: 700px) {
    .shiny-start { left: 84%; top: 16%; }
    .shiny-echo { left: 15%; top: 21%; }
    .shiny-lamp { left: 14%; top: 56%; }
    .shiny-sea { left: 80%; top: 70%; }
    .shiny-first { left: 8px; top: -16px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .shiny .gem, .shiny::before, .shiny::after, .shiny .bubbles i { animation: none !important; }
    .shiny[data-reveal] { opacity: .6 !important; pointer-events: auto !important; }
  }
  /* Bubbles rising from the sea floor, the clue for the one in Undertow */
  .shiny .bubbles { position: absolute; left: 50%; bottom: 50%; width: 30px; height: 120px; margin-left: -15px; pointer-events: none; }
  .shiny .bubbles i {
    position: absolute; bottom: 0; left: 50%; width: 7px; height: 7px; margin-left: -3.5px; border-radius: 50%;
    box-shadow: inset 0 0 0 1.2px rgba(214, 238, 255, .85), 0 0 6px rgba(160, 215, 255, .35); opacity: 0;
    animation: bubble-up 3.2s ease-in infinite;
  }
  .shiny .bubbles i:nth-child(2) { width: 4px; height: 4px; animation-delay: .65s; margin-left: 3px; }
  .shiny .bubbles i:nth-child(3) { width: 6px; height: 6px; animation-delay: 1.3s; margin-left: -7px; }
  .shiny .bubbles i:nth-child(4) { width: 4px; height: 4px; animation-delay: 1.9s; margin-left: 1px; }
  .shiny .bubbles i:nth-child(5) { width: 5px; height: 5px; animation-delay: 2.5s; margin-left: -3px; }
  .shiny .bubbles { height: 170px; }
  @keyframes bubble-up { 0% { opacity: 0; transform: translate(0, 0) scale(.6); } 10% { opacity: 1; } 45% { transform: translate(5px, -70px) scale(1); } 100% { opacity: 0; transform: translate(-4px, -165px) scale(1.1); } }

  /* The gem flying up to the button */
  .shiny-fly { position: fixed; left: 0; top: 0; z-index: 80; pointer-events: none; will-change: transform; }
  .shiny-fly .gem { width: 18px; height: 16px; filter: drop-shadow(0 0 6px rgba(255, 220, 255, .9)); }
  .shiny-fly.trail .gem { width: 7px; height: 6px; filter: none; opacity: .7; }

  /* The button that charges up: one segment of the ring per gem, a gem that becomes a bolt */
  .icon-btn.secret-btn { position: relative; box-shadow: none; }
  .secret-btn .sb-ring { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
  .secret-btn .sb-ring path { fill: none; stroke: currentColor; stroke-opacity: .26; stroke-width: 1.4; stroke-linecap: round; transition: stroke-opacity .3s ease; }
  .secret-btn .sb-ring path.on { stroke: url(#sb-grad); stroke-opacity: 1; stroke-width: 2.1; }
  .secret-btn .sb-gem { position: absolute; left: 50%; top: 50%; width: 14px; height: 12px; margin: -6px 0 0 -7px; transition: scale .4s cubic-bezier(.3, 1.5, .5, 1), opacity .25s ease; }
  .secret-btn .sb-bolt { position: absolute; left: 50%; top: 50%; translate: -50% -50%; font-size: 19px; scale: 0; opacity: 0; transition: scale .45s cubic-bezier(.3, 1.6, .5, 1) .1s, opacity .2s ease .1s; }
  .secret-btn.unlocked .sb-gem { scale: 0; opacity: 0; }
  .secret-btn.unlocked .sb-bolt { scale: 1; opacity: 1; }
  .secret-btn.fresh { scale: 0; }
  .secret-btn { transition: background-color .2s ease, transform .14s var(--ease-out, ease-out), scale .5s cubic-bezier(.3, 1.6, .5, 1); }
  .secret-btn .sb-wave { position: absolute; inset: 0; border-radius: 50%; pointer-events: none; box-shadow: 0 0 0 2px #FFE58A, 0 0 18px 4px rgba(255, 154, 213, .7); animation: sb-wave .9s var(--ease-out, ease-out) forwards; }
  @keyframes sb-wave { from { opacity: 1; scale: 1; } to { opacity: 0; scale: 2.8; } }
  .secret-btn.unlocking .sb-ring { animation: sb-spin 1.1s cubic-bezier(.5, 0, .2, 1); }
  @keyframes sb-spin { to { rotate: 360deg; } }

  /* A little bubble under the button: "Ooh, shiny. 3 of 7" */
  .shiny-say {
    position: fixed; z-index: 77; max-width: 270px; padding: 11px 15px 12px; border-radius: 14px;
    background: #F2F0FF; color: #0E0B26; font: 600 14px/1.35 'Hanken Grotesk', sans-serif;
    box-shadow: 0 18px 44px -16px rgba(0, 0, 0, .7); transform-origin: var(--ox, 90%) 0;
    animation: say-in .34s cubic-bezier(.2, 1.3, .4, 1); pointer-events: none;
  }
  .shiny-say::before { content: ""; position: absolute; top: -5px; left: var(--ax, 85%); width: 11px; height: 11px; margin-left: -5.5px; background: inherit; rotate: 45deg; border-radius: 2px; }
  .shiny-say b { font: 800 13px/1 'Unbounded', sans-serif; letter-spacing: .04em; }
  .shiny-say small { display: block; margin-top: 4px; font-weight: 500; font-size: 13px; color: #46426B; }
  .shiny-say.out { opacity: 0; translate: 0 -4px; transition: opacity .2s ease, translate .2s ease; }
  @keyframes say-in { from { opacity: 0; scale: .9; translate: 0 -6px; } }
  .shiny-say.coach { pointer-events: auto; max-width: 300px; padding: 16px 18px 16px; }
  .shiny-say.coach strong { display: block; font: 800 14px/1.2 'Unbounded', sans-serif; letter-spacing: .02em; margin-bottom: 6px; }
  .shiny-say.coach p { margin: 0; font-weight: 500; color: #3A3660; }
  .shiny-say.coach .sc-row { display: flex; align-items: center; gap: 12px; margin-top: 14px; }
  .shiny-say.coach button { height: 38px; padding: 0 16px; border: 0; border-radius: 999px; background: #0E0B26; color: #F2F0FF; font: 600 14px/1 'Hanken Grotesk', sans-serif; cursor: pointer; transition: transform .14s var(--ease-out, ease-out); }
  .shiny-say.coach button:active { transform: scale(.96); }
  .shiny-say.coach button.sc-later { background: none; color: #46426B; padding: 0 6px; }

  /* Hints, once the first gem is found */
  .shiny-log {
    position: fixed; z-index: 76; width: min(340px, calc(100vw - 32px)); padding: 18px 16px 12px; border-radius: 18px;
    background: rgba(12, 11, 20, .94); color: #F2F0FF; font: 400 14px/1.45 'Hanken Grotesk', sans-serif;
    -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px);
    box-shadow: 0 0 0 1px rgba(255, 255, 255, .1), 0 30px 60px -20px rgba(0, 0, 0, .8);
    transform-origin: 90% 0; animation: log-in .2s var(--ease-out, ease-out);
  }
  .shiny-log[hidden] { display: none; }
  @keyframes log-in { from { opacity: 0; scale: .97; translate: 0 -4px; } }
  .shiny-log .sl-head { display: flex; align-items: baseline; justify-content: space-between; padding: 0 4px; }
  .shiny-log .sl-head b { font: 800 12px/1 'Unbounded', sans-serif; letter-spacing: .24em; text-transform: uppercase; }
  .shiny-log .sl-head span { font: 800 13px/1 'Unbounded', sans-serif; letter-spacing: .06em; color: #C9C2FF; font-variant-numeric: tabular-nums; }
  .shiny-log .sl-sub { margin: 10px 4px 14px; color: #A9A6C4; }
  .shiny-log ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
  .shiny-log li { display: grid; grid-template-columns: 22px 1fr; gap: 10px; align-items: center; padding: 9px 10px; border-radius: 11px; background: rgba(255, 255, 255, .035); }
  .shiny-log li .gem { width: 14px; height: 12px; justify-self: center; }
  .shiny-log li:not(.got) .gem { filter: grayscale(1) brightness(.45); animation: none; }
  .shiny-log li b { display: block; font-weight: 600; }
  .shiny-log li:not(.got) b { color: #6F6B8C; letter-spacing: .3em; }
  .shiny-log li span { display: block; color: #B4B0D2; font-style: italic; font-size: 13.5px; }
  .shiny-log .sl-foot { display: flex; justify-content: flex-end; gap: 6px; margin-top: 10px; }
  .shiny-log .sl-foot button { background: none; border: 0; color: #8F8BAE; font: 500 12.5px/1 'Hanken Grotesk', sans-serif; cursor: pointer; padding: 8px 6px; border-radius: 8px; }
  .shiny-log .sl-foot button:hover { color: #F2F0FF; }
  .shiny-log .sl-foot .sure { color: #FF9AD5; }
  `;
  const style = document.createElement('style');
  style.id = 'shiny-css';
  style.textContent = css;
  document.head.appendChild(style);

  const GEM = '<i class="gem" aria-hidden="true"></i>';

  // ---------- The shiny things themselves ----------
  function shinyEl(id) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'shiny shiny-' + id;
    b.dataset.shiny = id;
    b.tabIndex = -1;
    b.setAttribute('aria-label', 'Something shiny');
    b.innerHTML = GEM;
    b.style.setProperty('--gd', (Math.random() * 3).toFixed(2) + 's');
    b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); collect(b); });
    // a press on it shouldn't also count as a click on whatever sits behind it
    b.addEventListener('pointerdown', e => e.stopPropagation());
    return b;
  }
  function put(id, host, extra) {
    if (found.has(id) || !host || host.querySelector(`[data-shiny="${id}"]`)) return null;
    const b = shinyEl(id);
    if (extra) extra(b);
    host.appendChild(b);
    return b;
  }
  function placeAll() {
    put('start', document.getElementById('s-intro'));
    put('echo', document.getElementById('s-echo'), b => { b.dataset.reveal = 'ping'; });
    put('record', document.querySelector('#s-schedule-steve .vinyl'));
    put('lamp', document.getElementById('s-nocturne'), b => { b.dataset.reveal = 'lamp'; });
    put('sea', document.getElementById('s-undertow'), b => { b.insertAdjacentHTML('afterbegin', '<span class="bubbles" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>'); });
    putLatest();
  }
  // Latest is filled in when it opens: the last one waits at the root of its timeline
  const ltList = document.getElementById('lt-list');
  function putLatest() {
    const end = ltList && ltList.querySelector('.lt-end');
    if (end && ltList.children.length > 1) put('first', end);
  }
  if (ltList) new MutationObserver(putLatest).observe(ltList, { childList: true });

  // Two of them only show when something lights them: an echo passing over, or the lamp
  let raf = 0, lit = 0;
  function revealPing(b) {
    const r = b.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, now = performance.now();
    let l = 0;
    for (const p of field.pings ? field.pings() : []) {
      const age = now - p.t0, life = p.life || 1100;
      if (age < 0 || age > life) continue;
      const near = 1 - Math.abs(Math.hypot(x - p.x, y - p.y) - age * (p.v || 0.62)) / 70;
      if (near > 0) l = Math.max(l, near * (1 - age / life) * 1.7);
    }
    lit = Math.max(Math.min(1, l), lit * 0.986);
    return lit;
  }
  function revealLamp(b) {
    const L = document.getElementById('s-nocturne').__lamp;
    if (!L || !(L.x || L.y)) return 0;
    const d = Math.hypot(L.x - (b.offsetLeft + 22), L.y - (b.offsetTop + 22));
    const k = Math.max(0, Math.min(1, 1 - (d - 60) / 170));
    return k * k * (3 - 2 * k);
  }
  function tick() {
    raf = 0;
    if (document.hidden || reduce) return;
    const key = body.dataset.scene;
    const b = key === 'echo' ? document.querySelector('.shiny-echo:not(.got)') : key === 'nocturne' ? document.querySelector('.shiny-lamp:not(.got)') : null;
    if (!b) return;
    const o = key === 'echo' ? revealPing(b) : revealLamp(b);
    if (Math.abs(o - (b._o || 0)) > 0.008 || (o === 0 && b._o)) {
      b._o = o;
      b.style.opacity = o.toFixed(3);
      b.style.pointerEvents = o > 0.14 ? 'auto' : 'none';
    }
    raf = requestAnimationFrame(tick);
  }
  const wake = () => { if (!raf) raf = requestAnimationFrame(tick); };
  new MutationObserver(wake).observe(body, { attributes: true, attributeFilter: ['data-scene'] });
  document.addEventListener('visibilitychange', wake);

  // ---------- The button ----------
  let btn = null;
  function ringHtml() {
    const C = 21, R = 19, n = TOTAL, gap = 10;
    let d = '';
    for (let i = 0; i < n; i++) {
      const a0 = (-90 + (i * 360) / n + gap / 2) * Math.PI / 180, a1 = (-90 + ((i + 1) * 360) / n - gap / 2) * Math.PI / 180;
      d += `<path d="M${(C + R * Math.cos(a0)).toFixed(2)} ${(C + R * Math.sin(a0)).toFixed(2)} A${R} ${R} 0 0 1 ${(C + R * Math.cos(a1)).toFixed(2)} ${(C + R * Math.sin(a1)).toFixed(2)}"/>`;
    }
    return `<svg class="sb-ring" viewBox="0 0 42 42" aria-hidden="true"><defs><linearGradient id="sb-grad" x1="4" y1="4" x2="38" y2="38" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#FF9AD5"/><stop offset=".3" stop-color="#FFE58A"/><stop offset=".55" stop-color="#9AF0D2"/><stop offset=".8" stop-color="#8FB8FF"/><stop offset="1" stop-color="#C59AFF"/></linearGradient></defs>${d}</svg>`;
  }
  function label() {
    if (btn.classList.contains('unlocked')) {
      const on = btn.classList.contains('on');
      btn.setAttribute('aria-label', on ? 'Turn ADHD mode off' : 'Turn ADHD mode on');
      btn.title = on ? 'ADHD mode: on' : 'ADHD mode';
      btn.setAttribute('aria-pressed', on);
      btn.removeAttribute('aria-expanded');
    } else {
      btn.setAttribute('aria-label', `Something is charging up: ${shown} of ${TOTAL} shiny things found. Show hints`);
      btn.title = `${shown} of ${TOTAL} shiny things`;
      btn.removeAttribute('aria-pressed');
      btn.setAttribute('aria-expanded', log && !log.hidden ? 'true' : 'false');
    }
  }
  function paintRing(animateLast) {
    const paths = [...btn.querySelectorAll('.sb-ring path')];
    paths.forEach((p, i) => p.classList.toggle('on', i < shown));
    if (animateLast && !reduce && paths[shown - 1]) {
      const p = paths[shown - 1], len = p.getTotalLength();
      p.style.strokeDasharray = len;
      p.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: 420, easing: 'cubic-bezier(.3,.7,.2,1)' }).onfinish = () => { p.style.strokeDasharray = ''; };
    }
    btn.classList.toggle('unlocked', shown >= TOTAL);
    label();
  }
  function ensureButton(fresh) {
    if (btn && btn.isConnected) return btn;
    const bar = document.querySelector('.top-right');
    btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'secret-btn';
    btn.className = 'icon-btn secret-btn' + (fresh && !reduce ? ' fresh' : '');
    btn.innerHTML = ringHtml() + '<i class="gem sb-gem" aria-hidden="true"></i><i class="ph ph-lightning sb-bolt" aria-hidden="true"></i>';
    bar.insertBefore(btn, document.getElementById('sound'));
    btn.addEventListener('click', onButton);
    paintRing(false);
    return btn;
  }
  function onButton() {
    dropCoach();
    if (shown < TOTAL) { toggleLog(); return; }
    loadAdhd().then(a => a && a.toggle());
  }

  // ---------- Picking one up ----------
  function collect(b) {
    const id = b.dataset.shiny;
    if (found.has(id)) return;
    found.add(id);
    save();
    const r = b.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    if (field.burst) field.burst(x, y, 4.5, 160);
    sfx.chime(found.size);
    b.classList.add('got');
    b.disabled = true;
    setTimeout(() => b.remove(), 650);
    count('secret/shiny-' + found.size, `Shiny thing ${found.size} of ${TOTAL}`);
    arrive(x, y);
  }
  const LINES = ['Ooh, shiny.', 'Ooh, another one.', 'Shiny number three.', 'Ooh. Sparkly.', 'Getting closer.', 'Number six.'];
  function arrive(x, y, from) {
    const first = shown === 0;
    const b = ensureButton(first);
    const inOverlay = overlayOpen();
    fly(x, y, b, inOverlay, () => {
      shown = Math.min(found.size, shown + 1);
      if (b.classList.contains('fresh')) requestAnimationFrame(() => b.classList.remove('fresh'));
      else if (!reduce) b.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.3)', offset: 0.3 }, { transform: 'scale(.95)', offset: 0.65 }, { transform: 'scale(1)' }], { duration: 520, easing: 'ease-out' });
      paintRing(true);
      const n = shown;
      if (n >= TOTAL) {
        if (inOverlay) {
          say(null, 'That’s all seven.', 'Close this page to see what they unlocked.', 4200, { x: innerWidth - 40, y: 74 });
          waitForOverlay(() => ceremony());
        } else ceremony();
        return;
      }
      const left = TOTAL - n;
      const more = from === 'lost' ? `Found in the static and brought home.${first ? ' Press the gem up here for hints.' : ''}` : first ? `${left === 1 ? 'One more is' : `${['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'][left]} more are`} hiding around stezy.lt. Press the gem up here for hints.` : left === 1 ? 'Just one left. Where could it be?' : `${left} to go.`;
      say(inOverlay ? null : b, `${LINES[n - 1] || 'Ooh, shiny.'} <b>${n}</b> / ${TOTAL}`, more, first ? 5200 : 2800, inOverlay ? { x: innerWidth - 40, y: 74 } : null);
    });
  }
  function waitForOverlay(done) {
    const els = ['latest', 'index'].map(id => document.getElementById(id)).filter(Boolean);
    const mo = new MutationObserver(() => { if (!overlayOpen()) { mo.disconnect(); setTimeout(done, 350); } });
    els.forEach(el => mo.observe(el, { attributes: true, attributeFilter: ['hidden'] }));
  }
  // The gem rises along a curve to the button, with a few sparkles trailing behind it
  function fly(x, y, target, toCorner, done) {
    const tr = target.getBoundingClientRect();
    const tx = toCorner ? innerWidth - 40 : tr.left + tr.width / 2, ty = toCorner ? 34 : tr.top + tr.height / 2;
    if (reduce) { done(); return; }
    const dist = Math.hypot(tx - x, ty - y);
    const cx = x + (tx - x) * 0.3, cy = Math.min(y, ty) - Math.max(50, Math.min(170, dist * 0.28));
    const ease = k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
    const frames = [];
    for (let i = 0; i <= 28; i++) {
      const k = i / 28, e = ease(k), m = 1 - e;
      const px = m * m * x + 2 * m * e * cx + e * e * tx, py = m * m * y + 2 * m * e * cy + e * e * ty;
      const s = toCorner ? 1.6 - k * 1.2 : 1.6 - k * 0.9;
      frames.push({ transform: `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px) translate(-50%, -50%) scale(${s.toFixed(3)}) rotate(${Math.round(e * 540)}deg)`, opacity: toCorner && k > 0.8 ? (1 - k) * 5 : 1, offset: k });
    }
    const dur = Math.max(720, Math.min(1050, 560 + dist * 0.45));
    const make = cls => { const f = document.createElement('div'); f.className = 'shiny-fly ' + cls; f.innerHTML = GEM; f.setAttribute('aria-hidden', 'true'); body.appendChild(f); return f; };
    for (let i = 1; i <= 4; i++) {
      const tr2 = make('trail');
      tr2.animate(frames.map(f => ({ ...f, opacity: (f.opacity * (1 - i * 0.18)) })), { duration: dur, delay: i * 38, easing: 'linear', fill: 'both' }).onfinish = () => tr2.remove();
    }
    const lead = make('lead');
    lead.animate(frames, { duration: dur, easing: 'linear', fill: 'forwards' }).onfinish = () => { lead.remove(); done(); };
  }

  // ---------- Little speech bubbles ----------
  let sayEl = null, sayTimer = 0;
  function say(anchor, html, small, ms, at, coach) {
    if (sayEl) sayEl.remove();
    clearTimeout(sayTimer);
    const el = document.createElement('div');
    el.className = 'shiny-say' + (coach ? ' coach' : '');
    el.setAttribute('role', 'status');
    el.innerHTML = coach || `${html}${small ? `<small>${small}</small>` : ''}`;
    body.appendChild(el);
    const ax = anchor ? anchor.getBoundingClientRect() : { left: at.x - 21, width: 42, bottom: at.y };
    const w = el.offsetWidth, cx = ax.left + ax.width / 2;
    const left = Math.max(12, Math.min(innerWidth - w - 12, cx - w + 26));
    el.style.left = left + 'px';
    el.style.top = ax.bottom + 12 + 'px';
    el.style.setProperty('--ax', Math.max(14, Math.min(w - 14, cx - left)) + 'px');
    el.style.setProperty('--ox', Math.max(14, Math.min(w - 14, cx - left)) + 'px');
    sayEl = el;
    if (ms) sayTimer = setTimeout(() => dropSay(el), ms);
    return el;
  }
  function dropSay(el) {
    if (!el || !el.isConnected) return;
    el.classList.add('out');
    setTimeout(() => el.remove(), 220);
    if (sayEl === el) sayEl = null;
  }
  const dropCoach = () => { if (sayEl && sayEl.classList.contains('coach')) dropSay(sayEl); };

  // ---------- All seven: the button lights up and the particles say so ----------
  function ceremony() {
    const b = ensureButton(false);
    shown = TOTAL;
    b.classList.add('unlocking');
    paintRing(false);
    setTimeout(() => b.classList.remove('unlocking'), 1200);
    sfx.fanfare();
    if (!reduce) {
      field.flash('UNLOCKED', 1800);
      const wave = document.createElement('i');
      wave.className = 'sb-wave';
      b.appendChild(wave);
      setTimeout(() => wave.remove(), 950);
      const r = b.getBoundingClientRect();
      loadAdhd().then(a => a && a.confetti(r.left + r.width / 2, r.top + r.height / 2, 90, 'down'));
    } else loadAdhd();
    count('secret/unlocked', 'ADHD mode unlocked');
    setTimeout(() => {
      const el = say(b, '', '', 14000, null,
        `<strong>ADHD mode unlocked</strong><p>You found all seven shiny things. The bolt turns it on, and off again when it gets too much.</p><div class="sc-row"><button type="button" class="sc-go">Turn it on</button><button type="button" class="sc-later">Later</button></div>`);
      el.querySelector('.sc-go').addEventListener('click', () => { dropSay(el); loadAdhd().then(a => a && a.on()); });
      el.querySelector('.sc-later').addEventListener('click', () => dropSay(el));
      el.querySelector('.sc-go').focus({ preventScroll: true });
    }, reduce ? 200 : 1300);
  }

  // ---------- Hints ----------
  let log = null, sure = false;
  function buildLog() {
    log = document.createElement('div');
    log.className = 'shiny-log';
    log.id = 'shiny-log';
    log.setAttribute('role', 'dialog');
    log.setAttribute('aria-label', 'Shiny things');
    log.hidden = true;
    body.appendChild(log);
    log.addEventListener('click', e => {
      const r = e.target.closest('.sl-reset');
      if (!r) return;
      if (!sure) { sure = true; r.textContent = 'Sure? Hide them all again'; r.classList.add('sure'); return; }
      closeLog();
      reset();
    });
  }
  function fillLog() {
    sure = false;
    log.innerHTML = `<div class="sl-head"><b>Shiny things</b><span>${shown} / ${TOTAL}</span></div>
      <p class="sl-sub">Seven are hidden around stezy.lt. Find them all and something unlocks.</p>
      <ol>${SPOTS.map(s => found.has(s.id) && (s.id !== pending || shown >= found.size)
        ? `<li class="got">${GEM}<div><b>${s.place}</b></div></li>`
        : `<li>${GEM}<div><b>???</b><span>${s.hint}</span></div></li>`).join('')}</ol>
      <div class="sl-foot"><button type="button" class="sl-reset">Start over</button></div>`;
  }
  function placeLog() {
    const r = btn.getBoundingClientRect(), w = log.offsetWidth;
    log.style.left = Math.max(12, Math.min(innerWidth - w - 12, r.right - w + 8)) + 'px';
    log.style.top = r.bottom + 12 + 'px';
  }
  function openLog() {
    if (!log) buildLog();
    fillLog();
    log.hidden = false;
    placeLog();
    label();
  }
  function closeLog() { if (log && !log.hidden) { log.hidden = true; label(); } }
  function toggleLog() { if (log && !log.hidden) closeLog(); else openLog(); }
  document.addEventListener('pointerdown', e => {
    if (log && !log.hidden && !log.contains(e.target) && !(btn && btn.contains(e.target))) closeLog();
  }, true);
  addEventListener('keydown', e => { if (e.key === 'Escape') { closeLog(); dropCoach(); } });
  addEventListener('resize', () => { if (log && !log.hidden) placeLog(); });

  // ---------- Starting over (hints menu, or ADHD mode's own menu) ----------
  function reset() {
    if (adhd) adhd.off(true);
    found.clear();
    save();
    store.set('stezy-adhd', 'off');
    shown = 0;
    if (btn) { btn.remove(); btn = null; }
    placeAll();
    toast('The shiny things are back in their hiding places.');
  }

  // ---------- The cheat code ----------
  const SEQ = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let seq = 0;
  addEventListener('keydown', e => {
    if (e.target && e.target.closest && e.target.closest('input, textarea, [contenteditable]')) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    seq = k === SEQ[seq] ? seq + 1 : k === SEQ[0] ? (seq === 2 ? 2 : 1) : 0;
    if (seq < SEQ.length) return;
    seq = 0;
    if (found.size >= TOTAL) { toast('You already have it. The bolt, top right.'); return; }
    SPOTS.forEach(s => found.add(s.id));
    save();
    document.querySelectorAll('.shiny').forEach(b => { b.classList.add('got'); setTimeout(() => b.remove(), 650); });
    count('secret/cheat', 'Cheat code');
    toast('Cheat code accepted. We won’t tell anyone.');
    ensureButton(false);
    setTimeout(ceremony, 400);
  });

  // ---------- ADHD mode itself loads only once it's unlocked ----------
  let adhd = null, loading = null;
  function loadAdhd() {
    if (adhd) return Promise.resolve(adhd);
    if (!loading) {
      loading = import('/js/adhd.js?v=1')
        .then(m => (adhd = m.create({ ...S, sfx, button: () => btn, reset, say, count })))
        .catch(e => { console.warn('ADHD mode could not load:', e); loading = null; return null; });
    }
    return loading;
  }

  // ---------- Start ----------
  placeAll();
  wake();
  if (shown > 0) ensureButton(false);
  const afterIntro = fn => {
    const go = () => (root.classList.contains('intro-play') ? setTimeout(go, 200) : setTimeout(fn, 500));
    go();
  };
  if (pending) afterIntro(() => { sfx.chime(found.size); arrive(innerWidth / 2, innerHeight + 24, pending); });
  else if (found.size >= TOTAL) {
    // unlocked before: get ADHD mode ready, and back on if it was left on
    afterIntro(() => {
      const idle = window.requestIdleCallback || (f => setTimeout(f, 300));
      if (store.get('stezy-adhd') === 'on') loadAdhd().then(a => a && a.on({ quiet: true }));
      else idle(() => loadAdhd(), { timeout: 4000 });
    });
  }
  window.__shiny = { sfx, found: () => [...found], reset, open: loadAdhd };
  console.log('%c✦ psst. Seven shiny things are hidden around stezy.lt.', 'font: 600 12px "Hanken Grotesk", sans-serif; color: #C59AFF;');
})();
