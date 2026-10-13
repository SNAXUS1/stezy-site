/* ADHD mode. Unlocked by finding all seven shiny things (js/shiny.js), loaded only after that.
   Everything here is extra and switches off cleanly:
   - a little feed of satisfying clips on the side (all drawn live, nothing downloaded)
   - sparkles that follow the mouse, confetti on every click, combos for clicking fast
   - the particles run faster and go rainbow, the music plays sped up
   - title letters you can flick with the mouse
   - and now and then, a thought from your brain */

const PAL = ['#FF6FB5', '#FFD23F', '#7CF2C9', '#6FA8FF', '#B98CFF', '#FF9A4D'];
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const easeIO = k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const easeOut = k => 1 - Math.pow(1 - k, 3);
const easeIn = k => k * k * k;
const TAU = Math.PI * 2;
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

export function create(B) {
  const { field, store, music, toast, sfx } = B;
  const reduce = B.reduce;
  const root = document.documentElement, body = document.body;
  const fine = matchMedia('(pointer: fine)').matches;
  addCss();
  let on = false;
  const fx = makeFx();
  const feed = makeFeed();
  const lightPage = () => ['prism', 'ledger', 'shadow'].includes(body.dataset.scene) || (root.dataset.theme === 'light' && ['intro', 'outro'].includes(body.dataset.scene));
  const btn = () => B.button();

  // ---------- The mouse leaves sparkles; clicks pop confetti and build combos ----------
  let lastX = -1, lastY = -1;
  function onMove(e) {
    if (e.pointerType !== 'mouse' || reduce) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    if (dx * dx + dy * dy < 110) return;
    lastX = e.clientX; lastY = e.clientY;
    if (e.target.closest && e.target.closest('.feed')) return;
    fx.trail(e.clientX, e.clientY, (performance.now() * 0.12) % 360, lightPage());
  }
  let combo = 0, comboAt = 0;
  const comboText = n => (n < 5 ? `x${n}` : n < 10 ? `x${n} combo` : n < 25 ? `x${n} unstoppable` : n < 50 ? `x${n} ok calm down` : n < 100 ? `x${n} touch grass` : `x${n} legend`);
  function onDown(e) {
    if (e.button > 0) return;
    if (e.target.closest && e.target.closest('.feed, .secret-btn, .shiny, .shiny-log, .shiny-say, .thought, input, textarea')) return;
    if (document.getElementById('detail').open) return;
    const x = e.clientX, y = e.clientY, now = performance.now();
    combo = now - comboAt < 650 ? combo + 1 : 1;
    comboAt = now;
    const f = 380 * Math.pow(2, Math.min(combo - 1, 24) / 12);
    sfx.tone(f, { dur: 0.09, vol: 0.45, type: 'triangle', to: f * 1.5, glide: 0.05 });
    sfx.noise({ dur: 0.05, freq: 2600, q: 1.3, vol: 0.3 });
    if (reduce) return;
    fx.confetti(x, y, 12 + Math.min(combo, 14), 'up', 0.7);
    fx.ring(x, y, lightPage() ? 'rgba(40, 20, 90, .55)' : 'rgba(255, 255, 255, .8)', 30 + Math.min(combo, 12) * 3);
    if (field.burst) field.burst(x, y, 2.6, 130);
    if (combo >= 3) fx.word(x, y - 24, comboText(combo), combo >= 10 ? 17 : 14, PAL[combo % PAL.length]);
    if ([10, 25, 50, 100].includes(combo)) {
      fx.confetti(x, y, 60, 'up', 1.25);
      [0, 4, 7].forEach((k, i) => sfx.tone(sfx.note(k + 5), { at: i * 0.05, dur: 0.6, vol: 0.4 }));
    }
  }

  // ---------- Title letters you can flick (and their copies in the living scenes move with them) ----------
  function onOver(e) {
    if (e.pointerType !== 'mouse' || reduce) return;
    const ch = e.target.closest && e.target.closest('.scene .title .ch');
    if (!ch) return;
    const title = ch.closest('.title');
    if (title.classList.contains('title-copy') || title.classList.contains('in-sky')) return;
    const now = performance.now();
    if (ch._b && now - ch._b < 520) return;
    ch._b = now;
    const sc = ch.closest('.scene'), i = [...title.querySelectorAll('.ch')].indexOf(ch), dir = Math.random() < 0.5 ? -1 : 1;
    const frames = [
      { transform: 'translateY(0) rotate(0deg) scale(1, 1)' },
      { transform: `translateY(-0.2em) rotate(${dir * 9}deg) scale(1.05, .95)`, offset: 0.28 },
      { transform: `translateY(0.03em) rotate(${-dir * 3}deg) scale(.95, 1.06)`, offset: 0.58 },
      { transform: `translateY(-0.02em) rotate(${dir}deg) scale(1.01, .99)`, offset: 0.8 },
      { transform: 'translateY(0) rotate(0deg) scale(1, 1)' }
    ];
    sc.querySelectorAll('.title').forEach(t => { const c = t.querySelectorAll('.ch')[i]; if (c) c.animate(frames, { duration: 640, easing: 'ease-out', composite: 'add' }); });
    sfx.tone(rand(520, 700), { dur: 0.12, vol: 0.12, type: 'sine', to: rand(900, 1100), glide: 0.08 });
  }

  // ---------- Thoughts from your brain, every minute or so ----------
  const THOUGHTS = [
    'Wait. What was I doing?',
    'Drink some water. Go on, I’ll wait.',
    'You were going to reply to someone. Who? No idea.',
    'Fun fact: octopuses have three hearts.',
    'Fun fact: a group of flamingos is called a flamboyance.',
    'Fun fact: bananas are berries. Strawberries aren’t.',
    'Fun fact: honey never goes off.',
    'Did you lock the door? You did. Probably.',
    'Snack?',
    'A song from 2016 is stuck in your head now. You’re welcome.',
    'Hyperfocus loading… 4%',
    'What if clouds are just the sky’s bubble wrap.',
    'You were about to look something up. It’s gone now.',
    'Unclench your jaw. Drop your shoulders.',
    'Quick, think of a colour. It was purple, wasn’t it.',
    'Somewhere, a cat is knocking something off a table.',
    'Reminder: you’re doing great.',
    'brain.exe stopped responding. Restarting…',
    'Four new hobbies this week. Finished: zero.',
    'You have 37 tabs open. In your head.',
    'That thing you said in 2019? Everyone forgot. Except you.',
    'Stretch. Yes, now.',
    'Is it lunch yet? It feels like lunch.',
    'Imagine being a pigeon. Just bobbing along.',
    'New idea: what if you made a game about this?',
    'Remember to blink.',
    'Ooh, shiny.'
  ];
  let bag = [], thoughtTimer = 0, recordTimer = 0, thoughtEl = null;
  function scheduleThought(first) {
    clearTimeout(thoughtTimer);
    thoughtTimer = setTimeout(showThought, first ? 15000 : rand(45000, 80000));
  }
  function showThought(text) {
    if (!on) return;
    if (document.hidden || document.getElementById('detail').open) { scheduleThought(); return; }
    if (!text) {
      if (!bag.length) bag = shuffle(THOUGHTS.slice());
      text = bag.pop();
    }
    dropThought();
    const el = document.createElement('div');
    el.className = 'thought';
    el.setAttribute('role', 'status');
    el.innerHTML = `<span class="th-ic"><i class="ph ph-brain" aria-hidden="true"></i></span><div><p class="th-top"><b>Your brain</b><span>now</span></p><p class="th-text"></p></div>`;
    el.querySelector('.th-text').textContent = text;
    // on the side away from the feed
    if (feed.corner()[1] === 'r') el.classList.add('left');
    el.addEventListener('click', () => dropThought());
    body.appendChild(el);
    thoughtEl = el;
    sfx.tone(988, { dur: 0.16, vol: 0.18 });
    sfx.tone(1319, { dur: 0.22, vol: 0.14, at: 0.08 });
    el._t = setTimeout(() => dropThought(el), 6500);
    if (typeof text === 'string' && !text.startsWith('You’ve been')) scheduleThought();
  }
  function dropThought(el = thoughtEl) {
    if (!el || !el.isConnected) return;
    clearTimeout(el._t);
    el.classList.add('out');
    setTimeout(() => el.remove(), 260);
    if (thoughtEl === el) thoughtEl = null;
  }

  // ---------- On and off ----------
  const writer = document.getElementById('writer-input');
  const writerPh = writer ? writer.placeholder : '';
  function turnOn(opts = {}) {
    if (on) return;
    on = true;
    store.set('stezy-adhd', 'on');
    root.classList.add('adhd');
    const b = btn();
    if (b) { b.classList.add('on'); b.setAttribute('aria-pressed', 'true'); b.setAttribute('aria-label', 'Turn ADHD mode off'); b.title = 'ADHD mode: on'; }
    feed.open(opts.quiet);
    if (field.hyper) field.hyper(true);
    if (music.setRate) music.setRate(1.12);
    if (writer) writer.placeholder = 'Write something, quick';
    addEventListener('pointermove', onMove, { passive: true });
    addEventListener('pointerdown', onDown, { passive: true });
    if (fine) document.addEventListener('pointerover', onOver, { passive: true });
    scheduleThought(true);
    clearTimeout(recordTimer);
    recordTimer = setTimeout(() => showThought('You’ve been here three whole minutes. That’s a personal record.'), 180000);
    if (!opts.quiet) {
      sfx.tone(260, { dur: 0.45, vol: 0.35, type: 'triangle', to: 1040, glide: 0.4 });
      [0, 2, 4, 7].forEach((k, i) => sfx.tone(sfx.note(k + 5), { at: 0.32 + i * 0.05, dur: 0.5, vol: 0.32 }));
      B.count('secret/adhd-on', 'ADHD mode on');
      if (!reduce) {
        if (field.flash) field.flash('ADHD MODE', 1400);
        if (b) {
          const r = b.getBoundingClientRect();
          fx.confetti(r.left + r.width / 2, r.top + r.height / 2, 70, 'down');
          fx.ring(r.left + r.width / 2, r.top + r.height / 2, '#FFD23F', 80, 0.7);
        }
      }
    }
  }
  function turnOff(silent) {
    if (!on) return;
    on = false;
    store.set('stezy-adhd', 'off');
    root.classList.remove('adhd');
    const b = btn();
    if (b) { b.classList.remove('on'); b.setAttribute('aria-pressed', 'false'); b.setAttribute('aria-label', 'Turn ADHD mode on'); b.title = 'ADHD mode'; }
    feed.close();
    if (field.hyper) field.hyper(false);
    if (music.setRate) music.setRate(1);
    if (writer) writer.placeholder = writerPh;
    removeEventListener('pointermove', onMove);
    removeEventListener('pointerdown', onDown);
    document.removeEventListener('pointerover', onOver);
    clearTimeout(thoughtTimer);
    clearTimeout(recordTimer);
    dropThought();
    if (!silent) {
      sfx.tone(1040, { dur: 0.5, vol: 0.3, type: 'triangle', to: 220, glide: 0.45 });
      toast('ADHD mode off. Calm again.');
    }
  }

  // =====================================================================================
  // Overlay canvas: sparkles, confetti, rings and combo words, drawn only while there are any
  // =====================================================================================
  function makeFx() {
    let cv = null, g = null, w = 0, h = 0, dpr = 1, raf = 0, last = 0;
    const parts = [], rings = [], words = [];
    function ensure() {
      if (cv) return;
      cv = document.createElement('canvas');
      cv.className = 'adhd-fx';
      cv.setAttribute('aria-hidden', 'true');
      body.appendChild(cv);
      g = cv.getContext('2d');
      size();
      addEventListener('resize', size);
    }
    function size() {
      if (!cv) return;
      dpr = Math.min(devicePixelRatio || 1, 1.5);
      w = innerWidth; h = innerHeight;
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    }
    function wake() { if (!raf && cv) { last = performance.now(); raf = requestAnimationFrame(loop); } }
    function star(s) {
      g.beginPath();
      g.moveTo(0, -s); g.quadraticCurveTo(0, 0, s, 0); g.quadraticCurveTo(0, 0, 0, s);
      g.quadraticCurveTo(0, 0, -s, 0); g.quadraticCurveTo(0, 0, 0, -s);
      g.fill();
    }
    function loop(t) {
      raf = 0;
      const dt = Math.min(0.05, Math.max(0, (t - last) / 1000));
      last = t;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, cv.width, cv.height);
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.age += dt;
        if (p.age >= p.life) { parts[i] = parts[parts.length - 1]; parts.pop(); continue; }
        const dr = Math.pow(p.drag, dt * 60);
        p.vx *= dr; p.vy = p.vy * dr + p.grav * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.spin * dt; p.flip += p.flipV * dt;
        const k = p.age / p.life;
        g.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
        g.fillStyle = p.c;
        if (p.kind === 'conf') {
          const c = Math.cos(p.rot), s = Math.sin(p.rot), f = Math.cos(p.flip);
          g.setTransform(dpr * c, dpr * s, -dpr * s * f, dpr * c * f, dpr * p.x, dpr * p.y);
          g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        } else {
          g.setTransform(dpr, 0, 0, dpr, dpr * p.x, dpr * p.y);
          if (p.kind === 'star') star(p.size * (1 - k * 0.6));
          else { g.beginPath(); g.arc(0, 0, p.size * (1 - k * 0.5), 0, TAU); g.fill(); }
        }
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        r.age += dt;
        const k = r.age / r.life;
        if (k >= 1) { rings.splice(i, 1); continue; }
        g.globalAlpha = (1 - k) * 0.85;
        g.strokeStyle = r.c;
        g.lineWidth = 0.6 + 2.4 * (1 - k);
        g.beginPath(); g.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * easeOut(k), 0, TAU); g.stroke();
      }
      for (let i = words.length - 1; i >= 0; i--) {
        const wd = words[i];
        wd.age += dt;
        const k = wd.age / wd.life;
        if (k >= 1) { words.splice(i, 1); continue; }
        const s = k < 0.14 ? 0.55 + (k / 0.14) * 0.6 : 1.15 - Math.min(0.15, (k - 0.14) * 0.6);
        g.setTransform(dpr * s, 0, 0, dpr * s, dpr * wd.x, dpr * (wd.y - easeOut(k) * 30));
        g.globalAlpha = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1;
        g.font = `800 ${wd.size}px Unbounded, sans-serif`;
        g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
        g.lineWidth = 4; g.strokeStyle = 'rgba(10, 8, 22, .9)';
        g.strokeText(wd.text, 0, 0);
        g.fillStyle = wd.c;
        g.fillText(wd.text, 0, 0);
      }
      g.globalAlpha = 1;
      if (parts.length || rings.length || words.length) raf = requestAnimationFrame(loop);
      else { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height); }
    }
    function cap() { if (parts.length > 460) parts.splice(0, parts.length - 460); }
    function confetti(x, y, n = 24, dir = 'up', power = 1) {
      ensure();
      for (let i = 0; i < n; i++) {
        let a, sp;
        if (dir === 'down') { a = Math.PI * rand(0.08, 0.92); sp = rand(120, 520); }
        else { a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.3; sp = rand(160, 520) * power; }
        parts.push({
          kind: Math.random() < 0.8 ? 'conf' : 'star', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, grav: 900, drag: 0.965,
          life: rand(1.1, 1.8), age: 0, rot: rand(0, TAU), spin: rand(-7, 7), flip: rand(0, TAU), flipV: rand(6, 16),
          w: rand(4, 8), h: rand(2.4, 4.4), size: rand(3, 5.5), c: pick(PAL)
        });
      }
      cap(); wake();
    }
    function trail(x, y, hue, light) {
      ensure();
      parts.push({
        kind: Math.random() < 0.6 ? 'star' : 'dot', x: x + rand(-3, 3), y: y + rand(-3, 3), vx: rand(-18, 18), vy: rand(8, 36), grav: 30, drag: 0.98,
        life: rand(0.5, 0.85), age: 0, rot: 0, spin: 0, flip: 0, flipV: 0, w: 0, h: 0, size: rand(1.6, 4.2), c: `hsl(${Math.round(hue)},100%,${light ? 46 : 74}%)`
      });
      cap(); wake();
    }
    function ring(x, y, c, r1 = 46, life = 0.5) { ensure(); rings.push({ x, y, c, r0: 4, r1, life, age: 0 }); wake(); }
    function word(x, y, text, size, c) { ensure(); words.length = 0; words.push({ x, y, text, size, c, life: 0.95, age: 0 }); wake(); }
    return { ensure, confetti, trail, ring, word };
  }

  // =====================================================================================
  // The feed: a little phone-shaped screen of satisfying clips, docked in a corner
  // =====================================================================================
  function makeFeed() {
    const ICON = {
      heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.4S3 14.9 3 9.1C3 6.3 5.2 4 8 4c1.7 0 3.1.9 4 2.2C12.9 4.9 14.3 4 16 4c2.8 0 5 2.3 5 5.1 0 5.8-9 11.3-9 11.3z"/></svg>',
      chat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h16v11H10l-5 3.5v-3.5H4z"/></svg>',
      share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 5l7 6.5-7 6.5v-4C8 14 5.5 15.5 3.5 19c.8-5.5 4-9 10-10z"/></svg>',
      next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9.5l6 6 6-6"/></svg>',
      sound: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"/><path class="w" d="M15.5 9.5c1 1.5 1 3.5 0 5M18 7c2.3 2.8 2.3 7.2 0 10"/></svg>',
      muted: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"/><path class="w" d="M16 9.5l5 5M21 9.5l-5 5"/></svg>',
      min: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 12h11"/></svg>',
      more: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18" cy="12" r="1.4"/></svg>',
      note: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 17.5V6.5l10-2v11"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/></svg>',
      play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg>'
    };
    let el = null, screen, cv, g, prog, W = 0, H = 0, dpr = 1, raf = 0, last = 0;
    let order = [], at = -1, clip = null, ct = 0, paused = false, trans = null, snaps = [], snapI = 0;
    let minimised = store.get('stezy-adhd-min') === '1';
    let muted = store.get('stezy-adhd-mute') === '1';
    let corner = /^(t|b)(l|r)$/.test(store.get('stezy-adhd-corner') || '') ? store.get('stezy-adhd-corner') : 'tl';
    const liked = new Set();
    const loud = () => !muted && !minimised;
    // What the clips can do: sounds (quieter than the rest, and silent when muted or minimised), and say they're done
    const A = {
      dpr: () => dpr,
      tone: (f, o = {}) => { if (loud()) sfx.tone(f, { ...o, vol: (o.vol == null ? 1 : o.vol) * 0.6 }); },
      noise: (o = {}) => { if (loud()) sfx.noise({ ...o, vol: (o.vol == null ? 1 : o.vol) * 0.6 }); },
      note: i => sfx.note(i),
      done() { if (clip) clip.finished = true; },
      pluck(i) { const f = sfx.note(i % 11); A.tone(f, { type: 'triangle', dur: 0.32, vol: 0.55 }); A.tone(f * 2, { dur: 0.14, vol: 0.12 }); },
      chord(n) { [0, 2, 4].forEach((k, i) => A.tone(sfx.note(n + k + 4), { dur: 0.8, vol: 0.36, at: i * 0.03 })); A.noise({ type: 'highpass', freq: 6000, dur: 0.35, vol: 0.22 }); },
      win() { [0, 2, 4, 5, 7, 9].forEach((k, i) => A.tone(sfx.note(k + 5), { at: i * 0.06, dur: 0.9, vol: 0.4 })); A.noise({ at: 0.3, type: 'highpass', freq: 7000, dur: 0.9, vol: 0.16 }); },
      crunch(d = 0.35) { A.noise({ dur: d, freq: 2800, q: 0.7, vol: 0.55, crackle: true }); A.noise({ dur: d * 0.8, type: 'lowpass', freq: 500, vol: 0.35, crackle: true }); },
      thud() { A.tone(110, { dur: 0.2, vol: 0.5, to: 48, glide: 0.18 }); A.noise({ dur: 0.1, type: 'lowpass', freq: 380, vol: 0.4 }); },
      pop() { const f = rand(1500, 2900); A.noise({ dur: 0.045, freq: f, q: 1.4, vol: 0.7 }); A.tone(rand(700, 1100), { dur: 0.03, vol: 0.25 }); },
      coin() { A.tone(1320, { dur: 0.07, vol: 0.28, type: 'square' }); A.tone(1976, { dur: 0.16, vol: 0.22, type: 'square', at: 0.06 }); },
      whoosh() { A.noise({ dur: 0.25, freq: 600, to: 2400, q: 0.9, vol: 0.25 }); },
      tick() { A.tone(2200, { dur: 0.02, vol: 0.12 }); },
      bonk() { A.tone(rand(300, 380), { dur: 0.08, vol: 0.25, type: 'square' }); }
    };

    function build() {
      el = document.createElement('div');
      el.className = 'feed';
      el.dataset.corner = corner;
      el.setAttribute('role', 'complementary');
      el.setAttribute('aria-label', 'ADHD mode: something to watch on the side');
      el.setAttribute('data-lenis-prevent', '');
      el.innerHTML = `
        <div class="fd-bar">
          <span class="fd-grip" aria-hidden="true"><i></i><i></i></span>
          <span class="fd-for">For you</span>
          <button class="fd-b fd-mute" type="button"></button>
          <button class="fd-b fd-more" type="button" aria-label="More" aria-expanded="false">${ICON.more}</button>
          <button class="fd-b fd-min" type="button" aria-label="Make it small">${ICON.min}</button>
        </div>
        <div class="fd-screen">
          <canvas class="fd-cv" aria-hidden="true"></canvas>
          <div class="fd-shade" aria-hidden="true"></div>
          <div class="fd-side">
            <button class="fd-act fd-like" type="button" aria-pressed="false" aria-label="Like">${ICON.heart}<span></span></button>
            <button class="fd-act fd-com" type="button" aria-label="Comments">${ICON.chat}<span></span></button>
            <button class="fd-act fd-share" type="button" aria-label="Share stezy.lt">${ICON.share}<span>Share</span></button>
            <button class="fd-act fd-next" type="button" aria-label="Next video">${ICON.next}</button>
          </div>
          <div class="fd-meta"><b>@stezy</b><p class="fd-cap"></p><p class="fd-snd">${ICON.note}<span><span class="fd-marq"></span></span></p></div>
          <div class="fd-prog" aria-hidden="true"><i></i></div>
          <div class="fd-play" aria-hidden="true">${ICON.play}</div>
          <div class="fd-say" aria-live="polite"></div>
        </div>
        <div class="fd-menu" hidden>
          <button type="button" data-m="skip">Skip this one</button>
          <button type="button" data-m="reset">Hide the bolt and start the hunt over</button>
        </div>`;
      body.appendChild(el);
      screen = el.querySelector('.fd-screen');
      cv = el.querySelector('.fd-cv');
      g = cv.getContext('2d');
      prog = el.querySelector('.fd-prog i');
      paintMute();
      wire();
    }
    function paintMute() {
      const m = el.querySelector('.fd-mute');
      m.innerHTML = muted ? ICON.muted : ICON.sound;
      m.setAttribute('aria-label', muted ? 'Turn the feed’s sound on' : 'Mute the feed');
      m.setAttribute('aria-pressed', muted);
    }
    function size(force) {
      if (!el || (minimised && !force)) return;
      dpr = Math.min(devicePixelRatio || 1, 2);
      const r = screen.getBoundingClientRect();
      if (!r.width) return;
      const nw = Math.round(r.width), nh = Math.round(r.height);
      if (nw === W && nh === H && cv.width === Math.round(nw * dpr)) return;
      W = nw; H = nh;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      // a clip is drawn for one size; a new size starts it again
      if (clip) { clip = CLIPS[order[at]](W, H, A); ct = 0; }
    }

    function meta() {
      const c = clip;
      el.querySelector('.fd-cap').textContent = c.cap;
      el.querySelector('.fd-marq').textContent = c.snd + '   ·   ' + c.snd;
      el.querySelector('.fd-like span').textContent = liked.has(order[at]) ? c.likesPlus || c.likes : c.likes;
      el.querySelector('.fd-com span').textContent = c.coms;
      const like = el.querySelector('.fd-like');
      like.classList.toggle('on', liked.has(order[at]));
      like.setAttribute('aria-pressed', liked.has(order[at]));
      el.classList.toggle('interactive', !!c.interactive);
    }
    function snapshot() {
      const s = snaps[snapI] || (snaps[snapI] = document.createElement('canvas'));
      snapI = 1 - snapI;
      s.width = cv.width; s.height = cv.height;
      s.getContext('2d').drawImage(cv, 0, 0);
      return s;
    }
    function go(dir = 1) {
      if (!W) return;
      if (clip && !minimised && !reduce) trans = { snap: snapshot(), p: 0, dir };
      at = (at + dir + order.length) % order.length;
      clip = CLIPS[order[at]](W, H, A);
      ct = 0;
      setPaused(false);
      meta();
    }
    function setPaused(p) {
      paused = p;
      el.classList.toggle('paused', p);
    }
    function frame(t) {
      raf = 0;
      if (!el || document.hidden) return;
      const dlg = document.getElementById('detail');
      const raw = (t - last) / 1000;
      // small and out of the way (or behind the details): a slower, cheaper frame rate
      if ((minimised || (dlg && dlg.open)) && raw < 0.034) { raf = requestAnimationFrame(frame); return; }
      last = t;
      const dt = Math.min(0.05, Math.max(0, raw));
      if (!clip) { raf = requestAnimationFrame(frame); return; }
      if (!paused) {
        try { clip.step(dt); } catch (e) { console.warn('Clip stopped:', e); clip.finished = true; }
        ct += dt;
        if (clip.finished || ct >= clip.len) go(1);
      }
      g.setTransform(1, 0, 0, 1, 0, 0);
      if (trans) {
        trans.p = Math.min(1, trans.p + dt / 0.42);
        const e = easeIO(trans.p), off = (1 - e) * H * trans.dir;
        g.clearRect(0, 0, cv.width, cv.height);
        g.drawImage(trans.snap, 0, Math.round(-e * H * trans.dir * dpr));
        g.setTransform(dpr, 0, 0, dpr, 0, off * dpr);
        drawClip();
        if (trans.p >= 1) trans = null;
      } else {
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawClip();
      }
      const p = clamp(clip.prog ? clip.prog() : ct / clip.len, 0, 1);
      if (Math.abs(p - (prog._p || 0)) > 0.002) { prog._p = p; prog.style.transform = `scaleX(${p.toFixed(4)})`; }
      raf = requestAnimationFrame(frame);
    }
    function drawClip() {
      g.save();
      g.beginPath(); g.rect(0, 0, W, H); g.clip();
      try { clip.draw(g); } catch (e) { console.warn('Clip could not draw:', e); clip.finished = true; }
      g.restore();
    }
    const wake = () => { if (el && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };

    // ----- interactions -----
    function say(text) {
      const s = el.querySelector('.fd-say');
      s.textContent = text;
      s.classList.remove('show'); void s.offsetWidth; s.classList.add('show');
      clearTimeout(s._t);
      s._t = setTimeout(() => s.classList.remove('show'), 1700);
    }
    function heart(x, y) {
      const hEl = document.createElement('i');
      hEl.className = 'fd-heart';
      hEl.innerHTML = ICON.heart;
      hEl.style.left = x + 'px'; hEl.style.top = y + 'px';
      hEl.style.setProperty('--r', rand(-18, 18).toFixed(0) + 'deg');
      screen.appendChild(hEl);
      setTimeout(() => hEl.remove(), 900);
    }
    function like(force) {
      const key = order[at];
      if (force && liked.has(key)) return;
      if (liked.has(key)) liked.delete(key); else liked.add(key);
      meta();
      if (liked.has(key)) {
        const l = el.querySelector('.fd-like');
        l.classList.remove('pop'); void l.offsetWidth; l.classList.add('pop');
        A.tone(880, { dur: 0.12, vol: 0.25 }); A.tone(1320, { dur: 0.16, vol: 0.2, at: 0.05 });
      }
    }
    function wire() {
      el.querySelector('.fd-mute').addEventListener('click', () => { muted = !muted; store.set('stezy-adhd-mute', muted ? '1' : '0'); paintMute(); });
      el.querySelector('.fd-min').addEventListener('click', () => setMin(true));
      const menu = el.querySelector('.fd-menu'), moreBtn = el.querySelector('.fd-more');
      moreBtn.addEventListener('click', () => { menu.hidden = !menu.hidden; moreBtn.setAttribute('aria-expanded', !menu.hidden); });
      menu.addEventListener('click', e => {
        const m = e.target.closest('[data-m]');
        if (!m) return;
        menu.hidden = true; moreBtn.setAttribute('aria-expanded', 'false');
        if (m.dataset.m === 'skip') go(1);
        else B.reset();
      });
      document.addEventListener('pointerdown', e => { if (el && !menu.hidden && !menu.contains(e.target) && !moreBtn.contains(e.target)) { menu.hidden = true; moreBtn.setAttribute('aria-expanded', 'false'); } }, true);
      el.querySelector('.fd-like').addEventListener('click', () => like());
      el.querySelector('.fd-com').addEventListener('click', () => say('Comments are off. Focus.'));
      el.querySelector('.fd-share').addEventListener('click', () => {
        const done = () => toast('Link copied. Send it to someone who needs a distraction.');
        if (navigator.clipboard) navigator.clipboard.writeText('https://stezy.lt').then(done, () => toast('https://stezy.lt'));
        else toast('https://stezy.lt');
      });
      el.querySelector('.fd-next').addEventListener('click', () => go(1));
      // scroll over the screen for the next or the last clip
      let wheelAt = 0;
      screen.addEventListener('wheel', e => {
        e.preventDefault();
        if (minimised || Math.abs(e.deltaY) < 4) return;
        const now = performance.now();
        if (now - wheelAt < 500) return;
        wheelAt = now;
        go(e.deltaY > 0 ? 1 : -1);
      }, { passive: false });
      // on the screen: tap to pause, double tap to like, swipe up or down to change clip.
      // Clips you can play (bubble wrap) get the taps instead.
      let down = null, tapT = 0, lastTap = 0;
      const local = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) }; };
      screen.addEventListener('pointerdown', e => {
        if (e.target.closest('.fd-side')) return;
        if (minimised) return;
        down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
        screen.setPointerCapture(e.pointerId);
        if (clip && clip.interactive && clip.down) { const p = local(e); clip.down(p.x, p.y); }
      });
      screen.addEventListener('pointermove', e => {
        if (minimised || !clip || !clip.interactive) return;
        const p = local(e);
        if (clip.move) clip.move(p.x, p.y, !!down);
      });
      const end = e => {
        if (!down || e.pointerId !== down.id) return;
        const dy = e.clientY - down.y, dx = e.clientX - down.x, quick = performance.now() - down.t < 600;
        if (clip && clip.interactive && clip.up) clip.up();
        const d0 = down;
        down = null;
        if (e.type === 'pointercancel') return;
        if (Math.abs(dy) > 40 && Math.abs(dy) > Math.abs(dx) * 1.3 && quick && !(clip && clip.interactive)) { go(dy < 0 ? 1 : -1); return; }
        if (Math.hypot(dx, dy) > 8 || (clip && clip.interactive)) return;
        const now = performance.now(), p = local(e);
        if (now - lastTap < 300) {
          clearTimeout(tapT);
          lastTap = 0;
          like(true);
          const r = screen.getBoundingClientRect();
          heart(d0.x - r.left, d0.y - r.top);
          return;
        }
        lastTap = now;
        clearTimeout(tapT);
        tapT = setTimeout(() => setPaused(!paused), 260);
        void p;
      };
      screen.addEventListener('pointerup', end);
      screen.addEventListener('pointercancel', end);
      // drag it to another corner by its top bar (or, when small, by the bubble itself)
      let drag = null;
      const startDrag = e => {
        if (e.button > 0 || (e.target.closest('button') && !minimised)) return;
        if (!minimised && !e.target.closest('.fd-bar')) return;
        const r = el.getBoundingClientRect();
        drag = { x: e.clientX, y: e.clientY, id: e.pointerId, r, moved: false };
        el.setPointerCapture(e.pointerId);
      };
      el.addEventListener('pointerdown', startDrag);
      el.addEventListener('pointermove', e => {
        if (!drag || e.pointerId !== drag.id) return;
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (!drag.moved && Math.hypot(dx, dy) < 5) return;
        drag.moved = true;
        el.classList.add('dragging');
        el.style.translate = `${dx}px ${dy}px`;
      });
      const drop = e => {
        if (!drag || e.pointerId !== drag.id) return;
        const d = drag;
        drag = null;
        el.classList.remove('dragging');
        if (!d.moved) { if (minimised) setMin(false); return; }
        const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const next = (cy < innerHeight / 2 ? 't' : 'b') + (cx < innerWidth / 2 ? 'l' : 'r');
        moveTo(next, r);
      };
      el.addEventListener('pointerup', drop);
      el.addEventListener('pointercancel', drop);
      el.addEventListener('keydown', e => {
        if (minimised && e.target === el && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setMin(false); return; }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { if (e.target.closest('.fd-screen, .fd-side')) { e.preventDefault(); e.stopPropagation(); go(e.key === 'ArrowDown' ? 1 : -1); } }
      });
      addEventListener('resize', () => { clearTimeout(el._rz); el._rz = setTimeout(size, 150); });
    }
    // FLIP: anchor to the new corner, then glide there from where it was let go
    function moveTo(next, from) {
      corner = next;
      store.set('stezy-adhd-corner', next);
      el.style.translate = '';
      el.dataset.corner = next;
      const to = el.getBoundingClientRect();
      el.style.transition = 'none';
      el.style.translate = `${from.left - to.left}px ${from.top - to.top}px`;
      void el.offsetWidth;
      el.style.transition = '';
      el.style.translate = '';
      if (thoughtEl) thoughtEl.classList.toggle('left', next[1] === 'r');
    }
    function setMin(m) {
      minimised = m;
      store.set('stezy-adhd-min', m ? '1' : '0');
      el.classList.toggle('min', m);
      el.querySelector('.fd-menu').hidden = true;
      if (m) { el.setAttribute('title', 'Bring the feed back'); el.setAttribute('role', 'button'); el.tabIndex = 0; }
      else { el.removeAttribute('title'); el.setAttribute('role', 'complementary'); el.removeAttribute('tabindex'); requestAnimationFrame(size); }
      el.classList.remove('bounce'); void el.offsetWidth; el.classList.add('bounce');
    }

    function open(quiet) {
      if (!el) build();
      if (!order.length) {
        // the bouncing rings first (the best opener), then the rest in a random order
        order = ['rings', ...shuffle(Object.keys(CLIPS).filter(k => k !== 'rings'))];
        at = -1;
      }
      el.hidden = false;
      el.classList.remove('leave');
      el.classList.toggle('min', minimised);
      el.classList.remove('enter'); void el.offsetWidth;
      if (!reduce) el.classList.add('enter');
      if (minimised) { el.setAttribute('title', 'Bring the feed back'); el.setAttribute('role', 'button'); el.tabIndex = 0; }
      requestAnimationFrame(() => {
        // measure at full size, even when it opens small
        if (minimised) { el.classList.remove('min'); size(true); el.classList.add('min'); } else size();
        if (!clip) go(1); else meta();
        wake();
      });
      void quiet;
    }
    function close() {
      if (!el) return;
      cancelAnimationFrame(raf); raf = 0;
      if (reduce) { el.hidden = true; return; }
      el.classList.add('leave');
      setTimeout(() => { if (el.classList.contains('leave')) el.hidden = true; }, 240);
    }
    document.addEventListener('visibilitychange', () => { if (on && !document.hidden) wake(); });
    return { open, close, corner: () => corner };
  }

  function addCss() {
    if (document.getElementById('adhd-css')) return;
    const s = document.createElement('style');
    s.id = 'adhd-css';
    s.textContent = `
    .adhd-fx { position: fixed; inset: 0; width: 100vw; height: 100vh; z-index: 74; pointer-events: none; }
    /* The bolt, on */
    .secret-btn.on .sb-ring { animation: sb-spin 6s linear infinite; }
    .secret-btn.on .sb-bolt { color: #FFD23F; animation: bolt-hue 3s linear infinite; }
    /* on light pages yellow would vanish: a deeper pink that still cycles through the rainbow */
    [data-theme="light"] body:is([data-scene="intro"], [data-scene="outro"]) .secret-btn.on .sb-bolt,
    body:is([data-scene="prism"], [data-scene="ledger"], [data-scene="shadow"]) .secret-btn.on .sb-bolt { color: #E0338F; }
    .secret-btn.on::before { content: ""; position: absolute; inset: -5px; border-radius: 50%; z-index: -1; pointer-events: none; background: radial-gradient(closest-side, rgba(255, 210, 63, .32), transparent); animation: shiny-breathe 2.2s ease-in-out infinite; }
    @keyframes bolt-hue { to { filter: hue-rotate(360deg); } }

    /* The feed */
    .feed {
      --fw: clamp(150px, 12.6vw, 190px);
      position: fixed; z-index: 66; width: var(--fw); border-radius: 22px;
      background: rgba(9, 8, 14, .9); color: #F4F2FF;
      -webkit-backdrop-filter: blur(16px); backdrop-filter: blur(16px);
      box-shadow: 0 0 0 1px rgba(255, 255, 255, .1), 0 26px 60px -18px rgba(0, 0, 0, .85);
      font: 500 12px/1.3 'Hanken Grotesk', sans-serif; -webkit-user-select: none; user-select: none;
      transition: translate .5s cubic-bezier(.2, 1.15, .3, 1);
    }
    .feed[hidden] { display: none; }
    .feed[data-corner="tl"] { left: 18px; top: 84px; }
    .feed[data-corner="tr"] { right: 18px; top: 84px; }
    .feed[data-corner="bl"] { left: 18px; bottom: 18px; }
    .feed[data-corner="br"] { right: 18px; bottom: 18px; }
    .feed.dragging { transition: none; cursor: grabbing; }
    .feed.enter { animation: feed-in .5s cubic-bezier(.2, 1.1, .3, 1); }
    .feed[data-corner$="r"].enter { animation-name: feed-in-r; }
    .feed.leave { animation: feed-out .22s ease-in forwards; pointer-events: none; }
    @keyframes feed-in { from { opacity: 0; transform: translateX(-36px) scale(.94) rotate(-2deg); } }
    @keyframes feed-in-r { from { opacity: 0; transform: translateX(36px) scale(.94) rotate(2deg); } }
    @keyframes feed-out { to { opacity: 0; transform: scale(.94); } }
    .feed.bounce { animation: feed-bounce .42s cubic-bezier(.2, 1.4, .4, 1); }
    @keyframes feed-bounce { from { transform: scale(.86); } }
    .fd-bar { display: flex; align-items: center; gap: 0; height: 34px; padding: 0 4px 0 10px; cursor: grab; touch-action: none; }
    .fd-grip { display: grid; gap: 2px; margin-right: 7px; opacity: .45; }
    .fd-grip i { display: block; width: 10px; height: 1.5px; border-radius: 2px; background: currentColor; }
    .fd-for { flex: 1; font-weight: 700; font-size: 11.5px; letter-spacing: .02em; }
    .fd-b { width: 26px; height: 26px; display: grid; place-items: center; padding: 0; border: 0; border-radius: 8px; background: none; color: inherit; cursor: pointer; opacity: .8; transition: opacity .15s ease, background-color .15s ease; }
    .fd-b:hover { opacity: 1; background: rgba(255, 255, 255, .08); }
    .fd-b svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    .fd-more svg { fill: currentColor; stroke: none; }
    .fd-screen { position: relative; margin: 0 6px 6px; aspect-ratio: 9 / 16; border-radius: 16px; overflow: hidden; background: #000; touch-action: none; isolation: isolate; }
    .fd-cv { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
    .fd-shade { position: absolute; left: 0; right: 0; bottom: 0; height: 42%; background: linear-gradient(transparent, rgba(0, 0, 0, .55)); pointer-events: none; }
    .feed.interactive .fd-shade { height: 26%; }
    .fd-side { position: absolute; right: 3px; bottom: 50px; display: grid; gap: 7px; justify-items: center; }
    .fd-act { display: grid; justify-items: center; gap: 1px; min-width: 30px; border: 0; background: none; color: #fff; padding: 2px; cursor: pointer; font: 700 9px/1.1 'Hanken Grotesk', sans-serif; filter: drop-shadow(0 1px 2px rgba(0, 0, 0, .7)); transition: transform .14s var(--ease-out, ease-out); }
    .fd-act:active { transform: scale(.88); }
    .fd-act svg { width: 21px; height: 21px; fill: rgba(255, 255, 255, .95); stroke: none; }
    .fd-next svg { fill: none; stroke: #fff; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; width: 18px; height: 18px; }
    .fd-like.on svg { fill: #FF3D6E; }
    .fd-like.pop svg { animation: like-pop .45s cubic-bezier(.2, 1.6, .4, 1); }
    @keyframes like-pop { 0% { transform: scale(.6); } 60% { transform: scale(1.3); } 100% { transform: scale(1); } }
    .fd-meta { position: absolute; left: 9px; right: 40px; bottom: 11px; pointer-events: none; text-shadow: 0 1px 2px rgba(0, 0, 0, .7); }
    .fd-meta b { font-weight: 700; font-size: 11.5px; }
    .fd-cap { margin: 3px 0 5px; font-size: 10.5px; line-height: 1.3; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
    .fd-snd { display: flex; align-items: center; gap: 4px; margin: 0; font-size: 10px; white-space: nowrap; }
    .fd-snd svg { flex: none; width: 11px; height: 11px; fill: none; stroke: #fff; stroke-width: 2; }
    .fd-snd > span { overflow: hidden; -webkit-mask-image: linear-gradient(90deg, #000 75%, transparent); mask-image: linear-gradient(90deg, #000 75%, transparent); }
    .fd-marq { display: inline-block; white-space: pre; animation: marq 9s linear infinite; }
    @keyframes marq { to { transform: translateX(-50%); } }
    .fd-prog { position: absolute; left: 0; right: 0; bottom: 0; height: 2px; background: rgba(255, 255, 255, .18); pointer-events: none; }
    .fd-prog i { display: block; height: 100%; background: #fff; transform-origin: left; transform: scaleX(0); }
    .fd-play { position: absolute; inset: 0; display: grid; place-items: center; opacity: 0; transition: opacity .18s ease; pointer-events: none; }
    .fd-play svg { width: 40px; height: 40px; fill: rgba(255, 255, 255, .92); filter: drop-shadow(0 2px 8px rgba(0, 0, 0, .6)); }
    .feed.paused .fd-play { opacity: 1; }
    .fd-say { position: absolute; left: 50%; top: 42%; translate: -50% 0; padding: 7px 11px; border-radius: 999px; background: rgba(0, 0, 0, .72); font-weight: 600; font-size: 11px; white-space: nowrap; opacity: 0; pointer-events: none; transition: opacity .2s ease; }
    .fd-say.show { opacity: 1; }
    .fd-heart { position: absolute; width: 54px; height: 54px; margin: -27px 0 0 -27px; pointer-events: none; animation: fd-heart .9s cubic-bezier(.2, 1, .3, 1) forwards; }
    .fd-heart svg { width: 100%; height: 100%; fill: #FF3D6E; filter: drop-shadow(0 4px 14px rgba(255, 61, 110, .6)); }
    @keyframes fd-heart { 0% { transform: scale(.3) rotate(var(--r)); opacity: 0; } 18% { transform: scale(1.15) rotate(var(--r)); opacity: 1; } 32% { transform: scale(.95) rotate(var(--r)); } 70% { opacity: 1; } 100% { transform: translateY(-46px) scale(1.1) rotate(var(--r)); opacity: 0; } }
    .fd-menu { position: absolute; left: 6px; right: 6px; top: 34px; z-index: 2; display: grid; padding: 5px; border-radius: 12px; background: rgba(22, 20, 32, .97); box-shadow: 0 0 0 1px rgba(255, 255, 255, .1), 0 16px 30px -12px rgba(0, 0, 0, .8); }
    .fd-menu[hidden] { display: none; }
    .fd-menu button { text-align: left; padding: 9px 10px; border: 0; border-radius: 8px; background: none; color: inherit; font: 500 12px/1.3 'Hanken Grotesk', sans-serif; cursor: pointer; }
    .fd-menu button:hover { background: rgba(255, 255, 255, .08); }
    .fd-menu [data-m="reset"] { color: #FF9AD5; }
    /* Small: a round bubble that keeps playing, with a rainbow rim */
    .feed.min { width: 70px; border-radius: 50%; background: none; box-shadow: none; -webkit-backdrop-filter: none; backdrop-filter: none; cursor: pointer; }
    .feed.min::before { content: ""; position: absolute; inset: -3px; border-radius: 50%; background: conic-gradient(from var(--gem-a), #FF9AD5, #FFE58A, #9AF0D2, #8FB8FF, #C59AFF, #FF9AD5); animation: gem-spin 3s linear infinite; box-shadow: 0 14px 30px -10px rgba(0, 0, 0, .8); }
    .feed.min .fd-bar, .feed.min .fd-side, .feed.min .fd-meta, .feed.min .fd-shade, .feed.min .fd-prog, .feed.min .fd-play, .feed.min .fd-say, .feed.min .fd-menu { display: none; }
    .feed.min .fd-screen { margin: 0; width: 70px; height: 70px; aspect-ratio: auto; border-radius: 50%; }
    .feed.min .fd-cv { inset: auto; left: 0; top: 50%; width: 70px; height: auto; aspect-ratio: 9 / 16; translate: 0 -50%; }
    .feed.min:focus-visible { outline: 2px solid #fff; outline-offset: 4px; }
    @media (max-width: 700px) {
      .feed { --fw: 118px; border-radius: 18px; }
      .feed[data-corner^="t"] { top: 74px; }
      .feed[data-corner$="l"] { left: 10px; } .feed[data-corner$="r"] { right: 10px; }
      .fd-for, .fd-more { display: none; }
      .fd-bar { justify-content: space-between; height: 28px; }
      .fd-screen { margin: 0 4px 4px; border-radius: 13px; }
      .fd-side { gap: 4px; bottom: 40px; } .fd-com, .fd-share { display: none; }
      .fd-meta { left: 7px; bottom: 8px; } .fd-meta b, .fd-snd { display: none; } .fd-cap { font-size: 9.5px; }
      .feed.min { width: 58px; } .feed.min .fd-screen, .feed.min .fd-cv { width: 58px; } .feed.min .fd-screen { height: 58px; }
    }
    /* Thoughts */
    .thought {
      position: fixed; z-index: 67; right: 20px; top: 84px; width: min(300px, calc(100vw - 40px));
      display: grid; grid-template-columns: 34px 1fr; gap: 11px; align-items: start; padding: 12px 14px 13px; border-radius: 16px;
      background: rgba(14, 13, 22, .92); color: #F2F0FF; font: 500 13.5px/1.4 'Hanken Grotesk', sans-serif; cursor: pointer;
      -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px);
      box-shadow: 0 0 0 1px rgba(255, 255, 255, .1), 0 20px 50px -20px rgba(0, 0, 0, .85);
      animation: th-in .5s cubic-bezier(.2, 1.15, .3, 1);
    }
    .thought.left { right: auto; left: 20px; animation-name: th-in-l; }
    .thought .th-ic { width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; font-size: 19px; color: #14101F; background: conic-gradient(from 210deg, #FF9AD5, #FFE58A, #9AF0D2, #8FB8FF, #C59AFF, #FF9AD5); }
    .thought p { margin: 0; }
    .thought .th-top { display: flex; justify-content: space-between; margin-bottom: 2px; font-size: 12px; color: #A9A6C4; }
    .thought .th-top b { color: #F2F0FF; font-weight: 700; }
    .thought.out { animation: th-out .25s ease-in forwards; }
    @keyframes th-in { from { opacity: 0; transform: translateX(40px) scale(.96); } }
    @keyframes th-in-l { from { opacity: 0; transform: translateX(-40px) scale(.96); } }
    @keyframes th-out { to { opacity: 0; transform: translateY(-8px) scale(.98); } }
    @media (max-width: 700px) { .thought, .thought.left { left: 16px; right: 16px; width: auto; top: auto; bottom: 18px; } }
    @media (prefers-reduced-motion: reduce) { .feed.enter, .feed.bounce, .thought, .thought.left { animation: none; } .feed { transition: none; } }
    `;
    document.head.appendChild(s);
  }

  return {
    on: turnOn,
    off: turnOff,
    toggle() { if (on) turnOff(); else turnOn(); },
    isOn: () => on,
    think: () => showThought(),
    confetti(x, y, n, dir) { fx.confetti(x, y, n, dir); }
  };
}

// =====================================================================================
// The clips. Each one is drawn live into a W x H canvas (CSS pixels) and has a small story:
// a set-up, some tension and a payoff, the way these videos go.
// =====================================================================================
function caption(g, W, text, y, size) {
  g.font = `700 ${size}px "Hanken Grotesk", sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  const words = text.split(' '), lines = [];
  let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > W - 26 && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur);
  lines.forEach((l, i) => {
    const yy = y + i * size * 1.22;
    g.lineWidth = Math.max(3, size * 0.3); g.strokeStyle = 'rgba(0, 0, 0, .9)'; g.strokeText(l, W / 2, yy);
    g.fillStyle = '#fff'; g.fillText(l, W / 2, yy);
  });
}
function big(g, W, H, text, k, size, colour, y = 0.45) {
  const s = k < 0.18 ? 0.5 + (k / 0.18) * 0.7 : 1.2 - Math.min(0.2, (k - 0.18) * 0.8);
  g.save();
  g.translate(W / 2, H * y); g.scale(s, s); g.rotate(-0.06);
  g.font = `800 ${size}px Unbounded, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.lineWidth = size * 0.36; g.strokeStyle = 'rgba(0, 0, 0, .92)'; g.strokeText(text, 0, 0);
  g.fillStyle = colour; g.fillText(text, 0, 0);
  g.restore();
}
function small(g, W, text, y, size, colour = 'rgba(255,255,255,.7)') {
  g.font = `800 ${size}px Unbounded, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = colour; g.fillText(text, W / 2, y);
}
// A little confetti of its own, for payoffs inside a clip
function bits() {
  const list = [];
  return {
    burst(x, y, n, u, spread = 1) {
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.6 * spread, sp = rand(60, 220) * u;
        list.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, rot: rand(0, TAU), spin: rand(-9, 9), w: rand(2.5, 5) * u, h: rand(1.6, 3) * u, c: pick(PAL), life: rand(1, 1.6) });
      }
    },
    step(dt, u) {
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        p.life -= dt;
        if (p.life <= 0) { list.splice(i, 1); continue; }
        p.vy += 420 * u * dt; p.vx *= 0.985; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.spin * dt;
      }
    },
    draw(g) {
      for (const p of list) {
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
        g.globalAlpha = Math.min(1, p.life * 2);
        g.fillStyle = p.c; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        g.restore();
      }
      g.globalAlpha = 1;
    }
  };
}
function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

const CLIPS = {
  // ---------- A ball bouncing inside spinning rings, each with a gap: every bounce a note ----------
  rings(W, H, A) {
    const u = W / 180, c = { x: W / 2, y: H * 0.52 }, N = 8, LW = 2.6 * u, G = 330 * u;
    const base = Math.random() * 360;
    const rings = Array.from({ length: N }, (_, i) => ({ r: (22 + i * 8.8) * u, rot: rand(0, TAU), spd: (i % 2 ? 1 : -1) * (0.6 + i * 0.07), gap: 0.82 - i * 0.03, hue: (base + i * 40) % 360, alive: true, flash: 0 }));
    const ball = { x: c.x + 2 * u, y: c.y - 4 * u, vx: (Math.random() < 0.5 ? -1 : 1) * rand(70, 120) * u, vy: -40 * u, r: 3.8 * u };
    const trail = [], shards = [], fx = bits();
    let t = 0, bounces = 0, broken = 0, freeT = 0, endT = 0;
    function shatter(rg) {
      for (let k = 0; k < 40; k++) {
        const a = rg.rot + rg.gap + Math.random() * (TAU - rg.gap), sp = rand(40, 140) * u;
        shards.push({ x: c.x + Math.cos(a) * rg.r, y: c.y + Math.sin(a) * rg.r, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30 * u, a: a + Math.PI / 2, len: rand(3, 7) * u, life: 1, hue: rg.hue });
      }
    }
    return {
      cap: 'wait for the last one #satisfying #fyp', snd: 'original sound · stezy', likes: '1.4M', likesPlus: '1.4M', coms: '9,203', len: 28,
      prog: () => (endT ? 1 : broken / N),
      step(dt) {
        t += dt;
        for (const rg of rings) { rg.rot += rg.spd * dt; rg.flash = Math.max(0, rg.flash - dt * 4); if (t > 12) rg.gap = Math.min(2.6, rg.gap + dt * 0.09); }
        const sub = 5, h = dt / sub;
        for (let s = 0; s < sub; s++) {
          ball.vy += G * h; ball.x += ball.vx * h; ball.y += ball.vy * h;
          const rg = rings.find(r => r.alive);
          if (!rg) continue;
          const dx = ball.x - c.x, dy = ball.y - c.y, d = Math.hypot(dx, dy) || 1, inner = rg.r - LW / 2 - ball.r;
          if (d < inner) continue;
          let rel = (Math.atan2(dy, dx) - rg.rot) % TAU;
          if (rel < 0) rel += TAU;
          const half = (ball.r * 0.8) / rg.r;
          if (rel > half && rel < rg.gap - half) {
            // through the gap: once it's out the other side, the ring breaks
            if (d > rg.r + LW / 2 + ball.r) { rg.alive = false; broken++; shatter(rg); A.chord(broken); }
            continue;
          }
          const nx = dx / d, ny = dy / d, vn = ball.vx * nx + ball.vy * ny;
          if (vn > 0) {
            ball.vx -= 2 * vn * nx; ball.vy -= 2 * vn * ny;
            // keep it lively: a good bounce every time, with a small nudge so it never settles into a loop
            const sp = Math.hypot(ball.vx, ball.vy) || 1, want = Math.min(420 * u, Math.max(240 * u, sp)), nudge = (Math.random() - 0.5) * 60 * u;
            ball.vx = (ball.vx / sp) * want - ny * nudge; ball.vy = (ball.vy / sp) * want + nx * nudge;
            rg.flash = 1;
            A.pluck(bounces++);
          }
          const dd = Math.min(d, inner);
          ball.x = c.x + nx * dd; ball.y = c.y + ny * dd;
        }
        trail.push({ x: ball.x, y: ball.y });
        if (trail.length > 18) trail.shift();
        for (let i = shards.length - 1; i >= 0; i--) {
          const s = shards[i];
          s.x += s.vx * dt; s.y += s.vy * dt; s.vy += G * 0.5 * dt; s.life -= dt * 1.1;
          if (s.life <= 0) shards.splice(i, 1);
        }
        fx.step(dt, u);
        if (broken >= N) {
          freeT += dt;
          if (!endT && (ball.y > H + 20 || freeT > 1.2)) { endT = t; A.win(); fx.burst(W / 2, H * 0.45, 50, u); }
          if (endT && t - endT > 1.9) A.done();
        }
      },
      draw(g) {
        const bg = g.createRadialGradient(c.x, c.y, 0, c.x, c.y, H * 0.75);
        bg.addColorStop(0, '#1C1536'); bg.addColorStop(1, '#040308');
        g.fillStyle = bg; g.fillRect(0, 0, W, H);
        g.lineCap = 'round';
        for (const rg of rings) {
          if (!rg.alive) continue;
          g.beginPath(); g.arc(c.x, c.y, rg.r, rg.rot + rg.gap, rg.rot + TAU);
          g.strokeStyle = `hsla(${rg.hue},95%,62%,${0.16 + rg.flash * 0.35})`; g.lineWidth = LW * 3.4; g.stroke();
          g.strokeStyle = `hsl(${rg.hue},95%,${64 + rg.flash * 28}%)`; g.lineWidth = LW; g.stroke();
        }
        g.lineWidth = 1.6 * u;
        for (const s of shards) {
          g.strokeStyle = `hsla(${s.hue},95%,70%,${Math.max(0, s.life)})`;
          const cx = Math.cos(s.a) * s.len / 2, cy = Math.sin(s.a) * s.len / 2;
          g.beginPath(); g.moveTo(s.x - cx, s.y - cy); g.lineTo(s.x + cx, s.y + cy); g.stroke();
        }
        trail.forEach((p, i) => {
          const k = i / trail.length;
          g.fillStyle = `hsla(${Math.round(t * 90 + i * 8) % 360},100%,70%,${k * 0.5})`;
          g.beginPath(); g.arc(p.x, p.y, ball.r * (0.3 + k * 0.7), 0, TAU); g.fill();
        });
        const gl = g.createRadialGradient(ball.x, ball.y, 0, ball.x, ball.y, ball.r * 4);
        gl.addColorStop(0, 'rgba(255,255,255,.5)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gl; g.fillRect(ball.x - ball.r * 4, ball.y - ball.r * 4, ball.r * 8, ball.r * 8);
        g.fillStyle = '#fff'; g.beginPath(); g.arc(ball.x, ball.y, ball.r, 0, TAU); g.fill();
        fx.draw(g);
        caption(g, W, `can it escape all ${N}?`, 30 * u, 13.5 * u);
        small(g, W, broken >= N ? 'free' : `${N - broken} to go`, 50 * u, 7.5 * u);
        if (endT) big(g, W, H, 'IT ESCAPED', Math.min(1, (t - endT) / 1.4), 17 * u, '#FFE58A');
      }
    };
  },

  // ---------- Kinetic sand: a knife takes slice after slice off a block of coloured layers ----------
  sand(W, H, A) {
    const u = W / 180, dpr = A.dpr();
    const COLS = ['#FF9ECF', '#C7A6FF', '#8EC9FF', '#86E8C4', '#FFE08A', '#FFAD8F'];
    const tableY = H * 0.61, bh = 54 * u, top = tableY - bh, dX = 10 * u, dY = 8 * u, sw = 12 * u;
    const bx0 = W * 0.3, bw0 = W * 0.38;
    const rgbs = COLS.map(h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)));
    // the block's face: layers with gentle waves, then grain
    const tw = Math.ceil(bw0 * dpr), th = Math.ceil(bh * dpr);
    const tex = document.createElement('canvas');
    tex.width = tw; tex.height = th;
    const tg = tex.getContext('2d'), img = tg.createImageData(tw, th), D = img.data;
    const ph = COLS.map(() => rand(0, 6));
    for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
      const xu = x / dpr, yu = y / dpr;
      let band = 0;
      for (let b = 1; b < COLS.length; b++) {
        const edge = (bh * b) / COLS.length + Math.sin(xu * 0.07 + ph[b]) * 2.4 * u + Math.sin(xu * 0.19 + ph[b] * 2) * 0.9 * u;
        if (yu > edge) band = b;
      }
      const col = rgbs[band], n = (Math.random() - 0.5) * 34 + (Math.random() < 0.04 ? -40 : 0), i = (y * tw + x) * 4;
      D[i] = clamp(col[0] + n, 0, 255); D[i + 1] = clamp(col[1] + n, 0, 255); D[i + 2] = clamp(col[2] + n, 0, 255); D[i + 3] = 255;
    }
    tg.putImageData(img, 0, 0);
    const grainTile = document.createElement('canvas');
    grainTile.width = grainTile.height = 24;
    const gt = grainTile.getContext('2d');
    for (let i = 0; i < 90; i++) { gt.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.35)' : 'rgba(0,0,0,.18)'; gt.fillRect(Math.random() * 24, Math.random() * 24, 1, 1); }
    let grainPat = null;
    const topCol = `rgb(${rgbs[0].map(v => Math.round(v + (255 - v) * 0.25)).join(',')})`;
    const CYCLE = 1.45, START = 0.65;
    let t = 0, L = bx0, cycle = -1, piece = null, crunched = false, endT = 0, landed = 0;
    const fallen = [], grains = [];
    const R = bx0 + bw0;
    const colourAt = frac => COLS[clamp(Math.floor(frac * COLS.length), 0, COLS.length - 1)];
    function spill(x, y, n, spread, cFrac) {
      for (let i = 0; i < n; i++) grains.push({ x, y, vx: rand(-1, 1) * spread * u, vy: rand(-40, -5) * u, c: cFrac == null ? pick(COLS) : colourAt(cFrac + rand(-0.08, 0.08)), rest: false, life: rand(1.4, 2.4) });
    }
    return {
      cap: 'no thoughts, just sand #asmr #kineticsand', snd: 'asmr crunch · stezy', likes: '412K', likesPlus: '412K', coms: '2,118', len: 16,
      step(dt) {
        t += dt;
        const k = t < START ? -1 : ((t - START) % CYCLE) / CYCLE;
        const n = t < START ? -1 : Math.floor((t - START) / CYCLE);
        if (n !== cycle && n >= 0 && !endT) {
          // a new slice: the last one is whatever is left
          if (piece) { L += piece.w; }
          cycle = n;
          crunched = false;
          const left = R - L;
          if (left < 2 * u) { endT = t; } else {
            const w = left < sw * 1.7 ? left : sw;
            piece = { w, sx: L - bx0, pivot: L, a: 0, landed: false, last: w === left, lift: Math.min(fallen.length, 6) * 1.6 * u, jit: rand(-0.05, 0.05) };
          }
        }
        if (piece && !piece.landed && k >= 0) {
          const cutX = L + piece.w;
          if (k > 0.12 && !crunched) { crunched = true; A.crunch(0.38); }
          if (k > 0.12 && k < 0.42 && Math.random() < 0.7) spill(cutX + rand(-1, 1) * u, top + rand(0, 2) * u, 1, 18);
          if (k >= 0.5) {
            const f = clamp((k - 0.5) / 0.32, 0, 1);
            piece.a = (-Math.PI / 2 + piece.jit) * easeIn(f);
            if (f >= 1) {
              piece.landed = true;
              fallen.push(piece);
              A.thud();
              // the slice crumbles a little where it lands
              for (let i = 0; i < 26; i++) { const fr = Math.random(); spill(piece.pivot - bh + fr * bh, tableY - piece.w - piece.lift, 1, 34, fr); }
              landed++;
              if (piece.last) { endT = t; A.win(); }
            }
          }
        }
        for (let i = grains.length - 1; i >= 0; i--) {
          const p = grains[i];
          if (!p.rest) {
            p.vy += 520 * u * dt; p.x += p.vx * dt; p.y += p.vy * dt;
            if (p.y >= tableY) { p.y = tableY - rand(0, 1.2) * u; p.rest = true; }
          } else p.life -= dt;
          if (p.life <= 0) grains.splice(i, 1);
        }
        if (endT && t - endT > 1.6) A.done();
      },
      draw(g) {
        g.fillStyle = '#0E0C12'; g.fillRect(0, 0, W, H);
        const sp = g.createRadialGradient(W * 0.58, H * 0.12, 0, W * 0.58, H * 0.12, H * 0.9);
        sp.addColorStop(0, 'rgba(255,236,226,.13)'); sp.addColorStop(1, 'rgba(255,236,226,0)');
        g.fillStyle = sp; g.fillRect(0, 0, W, H);
        const tb = g.createLinearGradient(0, tableY, 0, H);
        tb.addColorStop(0, '#26212C'); tb.addColorStop(1, '#100E14');
        g.fillStyle = tb; g.fillRect(0, tableY, W, H - tableY);
        g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(0, tableY, W, 1);
        // the block slides in at the start
        const ex = t < START ? (1 - easeOut(t / START)) * W * 0.7 : 0;
        // soft shadow under it
        g.fillStyle = 'rgba(0,0,0,.35)';
        g.beginPath(); g.ellipse((L + R) / 2 + ex + dX * 0.5, tableY + 2 * u, (R - L) / 2 + 8 * u, 4 * u, 0, 0, TAU); g.fill();
        // slices already down, shingled one over the next
        for (const p of fallen) {
          g.save(); g.translate(p.pivot, tableY - p.lift); g.rotate(p.a);
          g.drawImage(tex, p.sx * dpr, 0, p.w * dpr, th, 0, -bh, p.w, bh);
          g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(0, -bh, p.w, bh);
          g.restore();
        }
        // the block that's left (the slice being cut is drawn on its own)
        const bl = piece && !piece.landed ? L + piece.w : (piece ? L + piece.w : L);
        const from = endT && piece && piece.last ? R : bl;
        if (from < R - 0.5) {
          const x0 = from + ex, x1 = R + ex;
          g.drawImage(tex, (from - bx0) * dpr, 0, (R - from) * dpr, th, x0, top, x1 - x0, bh);
          // its top
          g.beginPath(); g.moveTo(x0, top); g.lineTo(x1, top); g.lineTo(x1 + dX, top - dY); g.lineTo(x0 + dX, top - dY); g.closePath();
          g.fillStyle = topCol; g.fill();
          grainPat = grainPat || g.createPattern(grainTile, 'repeat');
          g.fillStyle = grainPat; g.globalAlpha = 0.6; g.fill(); g.globalAlpha = 1;
          // its side, in shadow
          g.save(); g.transform(dX, -dY, 0, 1, x1, top);
          g.drawImage(tex, tw - 1, 0, 1, th, 0, 0, 1, bh);
          g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(0, 0, 1, bh);
          g.restore();
        }
        // the slice being cut, and then tipping over
        if (piece && !piece.landed) {
          const x0 = piece.pivot + ex;
          g.save(); g.translate(x0, tableY); g.rotate(piece.a);
          g.drawImage(tex, piece.sx * dpr, 0, piece.w * dpr, th, 0, -bh, piece.w, bh);
          if (piece.a < -0.01) { g.fillStyle = `rgba(0,0,0,${(0.22 * -piece.a / 1.57).toFixed(3)})`; g.fillRect(0, -bh, piece.w, bh); }
          g.restore();
          if (piece.a > -0.01) {
            g.beginPath(); g.moveTo(x0, top); g.lineTo(x0 + piece.w, top); g.lineTo(x0 + piece.w + dX, top - dY); g.lineTo(x0 + dX, top - dY); g.closePath();
            g.fillStyle = topCol; g.fill();
          }
        }
        // the knife
        if (piece && t >= START && !(endT && t - endT > 0.4)) {
          const k = ((t - START) % CYCLE) / CYCLE, x = L + piece.w + ex, hi = top - 70 * u;
          const ty = k < 0.42 ? lerp(top - 60 * u, tableY, easeIO(k / 0.42)) : k < 0.55 ? tableY : k < 0.85 ? lerp(tableY, hi, easeIO((k - 0.55) / 0.3)) : hi;
          const len = 96 * u;
          g.save();
          g.beginPath(); g.rect(0, 0, W, top + 0.5); g.clip();
          g.beginPath(); g.moveTo(x, ty); g.lineTo(x, ty - len); g.lineTo(x + dX, ty - len - dY); g.lineTo(x + dX, ty - dY); g.closePath();
          const mg = g.createLinearGradient(x, 0, x + dX, 0);
          mg.addColorStop(0, '#F4F7FF'); mg.addColorStop(0.5, '#9AA3B5'); mg.addColorStop(1, '#E2E7F2');
          g.fillStyle = mg; g.fill();
          g.restore();
          rr(g, x - 2 * u, ty - len - 30 * u, dX + 4 * u, 30 * u, 3 * u);
          g.fillStyle = '#2A2733'; g.fill();
          g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(x + dX / 2 - 1 * u, ty - len - 22 * u, 2 * u, 2 * u);
          if (ty > top) { g.fillStyle = 'rgba(255,255,255,.8)'; g.fillRect(x - 0.5, top, 1, Math.min(ty, tableY) - top); }
        }
        for (const p of grains) { g.globalAlpha = Math.min(1, p.life); g.fillStyle = p.c; g.fillRect(p.x, p.y, 1.6 * u, 1.6 * u); }
        g.globalAlpha = 1;
        caption(g, W, 'the last slice is the best one', 30 * u, 13.5 * u);
      }
    };
  },

  // ---------- A hydraulic press, three things that never stood a chance ----------
  press(W, H, A) {
    const u = W / 180, baseY = H * 0.6, restY = H * 0.17;
    const kinds = shuffle(['jelly', 'crystal', 'can']);
    const T = { drop: 0.5, idle: 0.9, down: 2.7, hold: 3.15, up: 3.8, next: 4.3 };
    let idx = 0, ot = 0, t = 0, hy = restY, psi = 0, obj = null, crunchAt = 0;
    const debris = [];
    function spawn() {
      const kind = kinds[idx];
      const dims = { jelly: [54, 52], crystal: [38, 66], can: [36, 62] }[kind];
      obj = { kind, w0: dims[0] * u, h0: dims[1] * u, broken: false, cracks: kind === 'crystal' ? makeCracks() : null, fizzing: false };
      ot = 0;
    }
    function makeCracks() {
      const out = [];
      for (let i = 0; i < 4; i++) {
        let x = rand(-0.2, 0.2), y = -0.5;
        const pts = [[x, y]];
        while (y < 0.45) { y += rand(0.08, 0.16); x += rand(-0.16, 0.16); pts.push([clamp(x, -0.42, 0.42), y]); }
        out.push(pts);
      }
      return out;
    }
    spawn();
    function shatter() {
      obj.broken = true;
      const cx = W / 2, cy = baseY - obj.h0 / 2;
      for (let i = 0; i < 24; i++) {
        const a = rand(0, TAU), r = rand(4, 14) * u, sp = rand(60, 200) * u;
        debris.push({ kind: 'shard', x: cx + Math.cos(a) * rand(0, obj.w0 / 2), y: cy + Math.sin(a) * rand(0, obj.h0 / 2.5), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80 * u, rot: rand(0, TAU), spin: rand(-12, 12), r, pts: [rand(0, TAU), rand(0, TAU), rand(0, TAU)], c: pick(['#7DF9FF', '#5BC8FF', '#B9F3FF', '#4D8BFF']), life: 2.2 });
      }
      A.noise({ dur: 0.3, type: 'highpass', freq: 3200, vol: 0.6, crackle: true });
      [2100, 2650, 3150].forEach((f, i) => A.tone(f, { dur: 0.25, vol: 0.12, at: i * 0.04 }));
    }
    function splat() {
      obj.broken = true;
      for (let i = 0; i < 16; i++) {
        const side = i % 2 ? 1 : -1, sp = rand(60, 190) * u;
        debris.push({ kind: 'drop', x: W / 2 + side * obj.w0 * 0.6, y: baseY - 6 * u, vx: side * sp, vy: -rand(40, 160) * u, r: rand(2, 4.5) * u, c: '#FF5FAF', life: 2 });
      }
      A.tone(320, { dur: 0.3, vol: 0.4, to: 90, glide: 0.25 });
      A.noise({ dur: 0.25, type: 'lowpass', freq: 900, to: 200, vol: 0.5 });
    }
    return {
      cap: 'for science #hydraulicpress #satisfying', snd: 'hydraulic sounds · stezy', likes: '876K', likesPlus: '876K', coms: '5,407', len: 3 * T.next + 0.4,
      step(dt) {
        t += dt; ot += dt;
        if (ot >= T.next) {
          idx++;
          debris.length = 0;
          if (idx >= kinds.length) { A.done(); idx = kinds.length - 1; return; }
          spawn();
        }
        const contact = baseY - obj.h0;
        const crushY = obj.kind === 'crystal' ? (obj.broken ? baseY - 5 * u : contact + 9 * u) : baseY - obj.h0 * (obj.kind === 'jelly' ? 0.13 : 0.3);
        if (ot < T.idle) hy = restY;
        else if (ot < T.down) {
          const k = (ot - T.idle) / (T.down - T.idle);
          hy = k < 0.35 ? lerp(restY, contact, easeIn(k / 0.35)) : lerp(contact, crushY, easeOut((k - 0.35) / 0.65));
        } else if (ot < T.hold) hy = crushY;
        else if (ot < T.up) hy = lerp(crushY, restY, easeIO((ot - T.hold) / (T.up - T.hold)));
        else hy = restY;
        const squeeze = Math.max(0, hy - contact);
        if (obj.kind === 'crystal' && !obj.broken && squeeze > 8 * u) shatter();
        const r = obj.broken ? 0 : clamp((baseY - Math.max(hy, contact)) / obj.h0, 0, 1);
        obj.minR = Math.min(obj.minR == null ? 1 : obj.minR, r); // a crushed can stays crushed
        if (obj.kind === 'jelly' && !obj.broken && r < 0.2) splat();
        if (obj.kind === 'can' && squeeze > 0 && t - crunchAt > 0.28 && ot < T.hold) { crunchAt = t; A.crunch(0.22); A.tone(rand(140, 200), { dur: 0.08, vol: 0.2, type: 'square' }); }
        if (obj.kind === 'can' && !obj.fizzing && r < 0.78) { obj.fizzing = true; A.noise({ dur: 1.4, type: 'highpass', freq: 5200, vol: 0.28 }); }
        if (obj.kind === 'can' && obj.fizzing && ot < T.up) {
          for (let i = 0; i < 2; i++) { const side = Math.random() < 0.5 ? -1 : 1; debris.push({ kind: 'fizz', x: W / 2 + side * obj.w0 * 0.5, y: baseY - rand(0.1, 0.9) * obj.h0 * Math.max(r, 0.3), vx: side * rand(30, 110) * u, vy: -rand(20, 120) * u, r: rand(0.8, 2) * u, c: 'rgba(200,240,255,.9)', life: 0.9 }); }
        }
        const want = squeeze > 0 && ot < T.hold ? 300 + (1 - r) * 3100 + rand(-40, 40) : 0;
        psi = lerp(psi, want, want ? 0.2 : 0.08);
        for (let i = debris.length - 1; i >= 0; i--) {
          const p = debris[i];
          p.life -= dt;
          if (p.life <= 0) { debris.splice(i, 1); continue; }
          p.vy += (p.kind === 'fizz' ? 120 : 520) * u * dt; p.x += p.vx * dt; p.y += p.vy * dt;
          if (p.rot != null) p.rot += p.spin * dt;
          if (p.y > baseY && p.kind !== 'fizz') { p.y = baseY; p.vy *= -0.3; p.vx *= 0.6; if (p.spin) p.spin *= 0.5; }
        }
        this.hy = hy; this.r = r; this.squeeze = squeeze;
      },
      draw(g) {
        const bg = g.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, '#17181F'); bg.addColorStop(1, '#0B0C10');
        g.fillStyle = bg; g.fillRect(0, 0, W, H);
        g.fillStyle = 'rgba(255,255,255,.025)';
        for (let x = 30 * u; x < W; x += 24 * u) g.fillRect(x, 0, 1, baseY);
        // columns
        const col = x => { const cg = g.createLinearGradient(x, 0, x + 12 * u, 0); cg.addColorStop(0, '#3A3E4A'); cg.addColorStop(0.5, '#6E7484'); cg.addColorStop(1, '#2C2F38'); g.fillStyle = cg; g.fillRect(x, 0, 12 * u, baseY + 22 * u); };
        col(8 * u); col(W - 20 * u);
        const hy = this.hy || restY;
        // piston rod and head
        const rod = g.createLinearGradient(W / 2 - 12 * u, 0, W / 2 + 12 * u, 0);
        rod.addColorStop(0, '#5B606D'); rod.addColorStop(0.45, '#C9CED9'); rod.addColorStop(1, '#4A4E59');
        g.fillStyle = rod; g.fillRect(W / 2 - 12 * u, 0, 24 * u, hy - 30 * u);
        g.fillStyle = '#2B2E38'; g.fillRect(22 * u, hy - 30 * u, W - 44 * u, 30 * u);
        g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(22 * u, hy - 30 * u, W - 44 * u, 1.5 * u);
        const hazard = (x, y, w, h) => {
          g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
          g.fillStyle = '#FFC93C'; g.fillRect(x, y, w, h);
          g.fillStyle = '#16161A';
          for (let k = -h; k < w; k += 9 * u) { g.beginPath(); g.moveTo(x + k, y + h); g.lineTo(x + k + 4.5 * u, y + h); g.lineTo(x + k + 4.5 * u + h, y); g.lineTo(x + k + h, y); g.closePath(); g.fill(); }
          g.restore();
        };
        hazard(22 * u, hy - 7 * u, W - 44 * u, 7 * u);
        // base
        g.fillStyle = '#2B2E38'; g.fillRect(14 * u, baseY, W - 28 * u, 20 * u);
        hazard(14 * u, baseY, W - 28 * u, 6 * u);
        g.fillStyle = '#08090C'; g.fillRect(0, baseY + 20 * u, W, H - baseY - 20 * u);
        // the thing being pressed
        const r = this.r == null ? 1 : this.r, drop = ot < T.drop ? -(1 - easeOut(ot / T.drop)) * 140 * u : 0;
        const o = obj, cx = W / 2;
        if (o.kind === 'jelly') {
          if (!o.broken) {
            const h = o.h0 * r, wob = 1 + Math.sin(ot * 24) * 0.035 * (1 - r), w = (o.w0 / Math.sqrt(Math.max(r, 0.2))) * wob, y = baseY - h + drop;
            const jg = g.createLinearGradient(0, y, 0, y + h);
            jg.addColorStop(0, 'rgba(255,140,200,.9)'); jg.addColorStop(1, 'rgba(255,60,150,.92)');
            rr(g, cx - w / 2, y, w, h, Math.min(10 * u, h / 3)); g.fillStyle = jg; g.fill();
            g.fillStyle = 'rgba(255,255,255,.35)'; rr(g, cx - w / 2 + 5 * u, y + 4 * u, w * 0.18, Math.max(2, h * 0.32), 3 * u); g.fill();
            // a face, worried once the pressing starts
            g.fillStyle = '#2A0B1E'; g.strokeStyle = '#2A0B1E'; g.lineWidth = 1.6 * u; g.lineCap = 'round';
            const ey = y + h * 0.45, exs = w * 0.18;
            if (r > 0.6) { [-1, 1].forEach(s => { g.beginPath(); g.arc(cx + s * exs, ey, 2.2 * u, 0, TAU); g.fill(); }); }
            else { [-1, 1].forEach(s => { g.beginPath(); g.moveTo(cx + s * exs - s * 2.5 * u, ey - 2 * u); g.lineTo(cx + s * exs + s * 1 * u, ey); g.lineTo(cx + s * exs - s * 2.5 * u, ey + 2 * u); g.stroke(); }); }
            g.beginPath(); g.ellipse(cx, ey + Math.max(4, h * 0.18), r > 0.6 ? 2.5 * u : 3.2 * u, r > 0.6 ? 1.2 * u : 2.6 * u, 0, 0, TAU); g.fill();
          } else {
            g.fillStyle = 'rgba(255,80,165,.9)';
            g.beginPath(); g.ellipse(cx, baseY - 2 * u, o.w0 * 1.25, 4 * u, 0, 0, TAU); g.fill();
            g.fillStyle = 'rgba(255,255,255,.3)'; g.beginPath(); g.ellipse(cx - o.w0 * 0.4, baseY - 3.5 * u, o.w0 * 0.3, 1.2 * u, 0, 0, TAU); g.fill();
          }
        } else if (o.kind === 'crystal' && !o.broken) {
          const w = o.w0, h = o.h0, y = baseY - h / 2 + drop, P = [[0, -0.5], [0.5, -0.24], [0.5, 0.24], [0, 0.5], [-0.5, 0.24], [-0.5, -0.24]];
          const glow = g.createRadialGradient(cx, y, 0, cx, y, h);
          glow.addColorStop(0, 'rgba(125,249,255,.25)'); glow.addColorStop(1, 'rgba(125,249,255,0)');
          g.fillStyle = glow; g.fillRect(cx - h, y - h, h * 2, h * 2);
          g.beginPath(); P.forEach(([px, py], i) => (i ? g.lineTo(cx + px * w, y + py * h) : g.moveTo(cx + px * w, y + py * h))); g.closePath();
          const cg = g.createLinearGradient(cx - w / 2, y - h / 2, cx + w / 2, y + h / 2);
          cg.addColorStop(0, 'rgba(185,243,255,.95)'); cg.addColorStop(0.5, 'rgba(91,200,255,.9)'); cg.addColorStop(1, 'rgba(77,110,255,.9)');
          g.fillStyle = cg; g.fill();
          g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 0.8 * u;
          g.beginPath(); g.moveTo(cx, y - h / 2); g.lineTo(cx, y + h / 2); g.moveTo(cx - w / 2, y - h * 0.24); g.lineTo(cx, y); g.lineTo(cx + w / 2, y - h * 0.24); g.stroke();
          const sq = clamp((this.squeeze || 0) / (8 * u), 0, 1);
          if (sq > 0) {
            g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 0.9 * u;
            o.cracks.forEach(pts => { const n = Math.max(2, Math.round(pts.length * sq)); g.beginPath(); pts.slice(0, n).forEach(([px, py], i) => (i ? g.lineTo(cx + px * w, y + py * h) : g.moveTo(cx + px * w, y + py * h))); g.stroke(); });
          }
        } else if (o.kind === 'can') {
          const cr = o.minR == null ? 1 : o.minR, h = o.h0 * cr, w = o.w0 * (1 + (1 - cr) * 0.18), y = baseY - h + drop, a = (1 - cr) * 7 * u, folds = 6;
          const edge = side => { const pts = []; for (let i = 0; i <= folds * 2; i++) { const k = i / (folds * 2); pts.push([cx + side * (w / 2 + (i % 2 ? a * (0.6 + 0.4 * Math.sin(i * 1.7)) : 0)), y + k * h]); } return pts; };
          const L = edge(-1), R = edge(1);
          g.beginPath(); L.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py))); R.reverse().forEach(([px, py]) => g.lineTo(px, py)); g.closePath();
          const cg = g.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
          cg.addColorStop(0, '#3B22B8'); cg.addColorStop(0.42, '#9D84FF'); cg.addColorStop(0.55, '#C9BCFF'); cg.addColorStop(1, '#2E1A96');
          g.fillStyle = cg; g.fill();
          if (cr > 0.25) {
            g.save(); g.translate(cx, y + h * 0.52); g.scale(1, Math.max(0.2, cr));
            g.font = `800 ${10 * u}px Unbounded, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
            g.fillStyle = 'rgba(255,255,255,.92)'; g.fillText('FIZZ', 0, 0);
            g.restore();
          }
          g.fillStyle = '#C9CED9';
          g.beginPath(); g.ellipse(cx, y + 1 * u, w / 2 - 2 * u, 2.6 * u, 0, 0, TAU); g.fill();
          g.fillStyle = '#7C8290'; g.fillRect(cx - w / 2 + 2 * u, baseY - 3 * u, w - 4 * u, 3 * u);
        }
        for (const p of debris) {
          g.globalAlpha = Math.min(1, p.life * 1.5);
          g.fillStyle = p.c;
          if (p.kind === 'shard') {
            g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
            g.beginPath(); p.pts.forEach((a, i) => (i ? g.lineTo(Math.cos(a) * p.r, Math.sin(a) * p.r) : g.moveTo(Math.cos(a) * p.r, Math.sin(a) * p.r))); g.closePath(); g.fill();
            g.restore();
          } else { g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.fill(); }
        }
        g.globalAlpha = 1;
        // the readout and a warning light
        const pressing = (this.squeeze || 0) > 0 && ot < T.hold;
        g.fillStyle = pressing && Math.sin(t * 18) > 0 ? '#FF4545' : '#3A1414';
        g.beginPath(); g.arc(20 * u, baseY + 33 * u, 3 * u, 0, TAU); g.fill();
        g.font = `700 ${7 * u}px "Hanken Grotesk", sans-serif`; g.textAlign = 'left'; g.textBaseline = 'middle';
        g.fillStyle = 'rgba(255,255,255,.55)'; g.fillText('PRESSURE', 28 * u, baseY + 33 * u);
        g.font = `800 ${10 * u}px Unbounded, sans-serif`; g.fillStyle = '#FFC93C';
        g.fillText(`${Math.round(psi).toLocaleString('en-US')} PSI`, 18 * u, baseY + 47 * u);
        g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(18 * u, baseY + 57 * u, W - 64 * u, 3 * u);
        g.fillStyle = '#FFC93C'; g.fillRect(18 * u, baseY + 57 * u, (W - 64 * u) * clamp(psi / 3500, 0, 1), 3 * u);
        caption(g, W, 'it never stood a chance', 22 * u, 13.5 * u);
      }
    };
  },

  // ---------- A synthwave runner: three lanes, jumps, coins, and a new best ----------
  runner(W, H, A) {
    const u = W / 180, yH = H * 0.37, yG = H * 0.71, laneW = 46 * u, JV = 4.3, GJ = 15;
    let t = 0, v = 7, travelled = 0, rowIn = 0.6, score = 0, coins = 0, bestAt = 0;
    const objs = [], fx = bits(), sparks = [];
    const me = { x: 0, target: 0, jy: 0, jv: 0, phase: 0 };
    const city = [];
    for (let layer = 0; layer < 2; layer++) {
      let x = -5 * u;
      while (x < W + 5 * u) { const w = rand(8, 20) * u; city.push({ layer, x, w, h: rand(layer ? 10 : 18, layer ? 28 : 46) * u, win: Array.from({ length: 5 }, () => [Math.random(), Math.random(), Math.random() < 0.5]) }); x += w + rand(0, 3) * u; }
    }
    const lanes = [-1, 0, 1];
    function row() {
      const p = Math.random(), d0 = 16;
      if (p < 0.34) { const b = pick(lanes); objs.push({ k: 'block', lane: b, d: d0 }); const c = pick(lanes.filter(l => l !== b)); for (let i = 0; i < 5; i++) objs.push({ k: 'coin', lane: c, d: d0 + i * 0.8, h: 0.25 }); }
      else if (p < 0.6) { const b = pick(lanes); objs.push({ k: 'bar', lane: b, d: d0 }); for (let i = 0; i < 5; i++) objs.push({ k: 'coin', lane: b, d: d0 - 1.6 + i * 0.8, h: 0.25 + Math.sin((i / 4) * Math.PI) * 0.7 }); }
      else if (p < 0.82) { const free = pick(lanes); lanes.filter(l => l !== free).forEach(l => objs.push({ k: 'block', lane: l, d: d0 })); for (let i = 0; i < 4; i++) objs.push({ k: 'coin', lane: free, d: d0 + i * 0.8, h: 0.25 }); }
      else { lanes.forEach(l => objs.push({ k: 'bar', lane: l, d: d0 })); for (let i = 0; i < 5; i++) objs.push({ k: 'coin', lane: me.target, d: d0 - 1.6 + i * 0.8, h: 0.25 + Math.sin((i / 4) * Math.PI) * 0.7 }); }
    }
    function think() {
      const look = 1 + v * 0.55;
      const threats = objs.filter(o => (o.k === 'block' || o.k === 'bar') && o.d > 1.02 && o.d < look);
      const tall = l => threats.some(o => o.lane === l && o.k === 'block');
      const mine = threats.filter(o => o.lane === me.target).sort((a, b) => a.d - b.d)[0];
      if (mine && mine.k === 'block') {
        const coinsIn = l => objs.filter(o => o.k === 'coin' && o.lane === l && o.d > 1 && o.d < look + 2).length;
        const opts = lanes.filter(l => !tall(l)).sort((a, b) => Math.abs(a - me.target) - Math.abs(b - me.target) || coinsIn(b) - coinsIn(a));
        if (opts.length && opts[0] !== me.target) { me.target = opts[0]; A.tick(); }
      } else if (mine && mine.k === 'bar' && me.jy <= 0.001 && (mine.d - 1) / (v * 0.6) < 0.2) { me.jv = JV; A.whoosh(); }
      else if (!threats.length) {
        const next = objs.filter(o => o.k === 'coin' && !o.got && o.d > 1.2 && o.d < look + 3).sort((a, b) => a.d - b.d)[0];
        if (next && next.lane !== me.target && !tall(next.lane)) me.target = next.lane;
      }
    }
    return {
      cap: 'day 47 of trying to beat my score #gaming', snd: 'sped up · stezy', likes: '2.1M', likesPlus: '2.1M', coms: '14.9K', len: 14,
      step(dt) {
        t += dt;
        v = 7 + t * 0.25;
        const dd = dt * v * 0.6;
        travelled += dd;
        rowIn -= dt;
        if (rowIn <= 0) { row(); rowIn = 0.78 - Math.min(0.2, t * 0.012); }
        for (const o of objs) o.d -= dd;
        think();
        me.x += (me.target - me.x) * Math.min(1, dt * 13);
        if (me.jv || me.jy > 0) { me.jv -= GJ * dt; me.jy += me.jv * dt; if (me.jy <= 0) { me.jy = 0; me.jv = 0; } }
        me.phase += dt * (10 + v * 0.6);
        for (let i = objs.length - 1; i >= 0; i--) {
          const o = objs[i];
          if (o.k === 'coin' && !o.got && o.d <= 1.06 && o.d > 0.85 && Math.abs(o.lane - me.x) < 0.5 && Math.abs(o.h - (me.jy + 0.25)) < 0.5) {
            o.got = true; coins++; score += 10; A.coin();
            for (let k = 0; k < 6; k++) sparks.push({ x: W / 2 + me.x * laneW, y: yG - (o.h + 0.1) * laneW, vx: rand(-60, 60) * u, vy: rand(-90, -20) * u, life: 0.5 });
          }
          if (o.d < 0.45) objs.splice(i, 1);
        }
        score += dt * v * 6;
        for (let i = sparks.length - 1; i >= 0; i--) { const s = sparks[i]; s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 200 * u * dt; if (s.life <= 0) sparks.splice(i, 1); }
        if (!bestAt && t > 9.4) { bestAt = t; A.win(); fx.burst(W / 2, H * 0.3, 40, u); }
        fx.step(dt, u);
      },
      draw(g) {
        const sky = g.createLinearGradient(0, 0, 0, yH);
        sky.addColorStop(0, '#0B0420'); sky.addColorStop(0.6, '#2A0B45'); sky.addColorStop(1, '#6A1C68');
        g.fillStyle = sky; g.fillRect(0, 0, W, yH);
        // the sun, cut into stripes
        const sr = 40 * u, sx = W / 2, sy = yH - 6 * u;
        g.save();
        g.beginPath(); g.rect(0, 0, W, sy - sr * 0.1);
        for (let i = 0; i < 6; i++) { const y0 = sy - sr * 0.1 + i * sr * 0.17 + i * i * 0.4 * u; g.rect(0, y0 + 1.2 * u + i * 0.5 * u, W, sr * 0.17 - (1.2 * u + i * 0.5 * u)); }
        g.clip();
        const sg = g.createLinearGradient(0, sy - sr, 0, sy + sr);
        sg.addColorStop(0, '#FFE66D'); sg.addColorStop(0.55, '#FF7A90'); sg.addColorStop(1, '#FF3DA8');
        g.fillStyle = sg; g.beginPath(); g.arc(sx, sy, sr, 0, TAU); g.fill();
        g.restore();
        // skyline
        for (const b of city) {
          g.fillStyle = b.layer ? '#160828' : '#24103D';
          g.fillRect(b.x, yH - b.h, b.w, b.h);
          if (b.layer) for (const [wx, wy, lit] of b.win) if (lit) { g.fillStyle = wy < 0.5 ? 'rgba(255,90,200,.7)' : 'rgba(80,240,255,.6)'; g.fillRect(b.x + wx * (b.w - 2 * u), yH - b.h + 2 * u + wy * (b.h - 5 * u), 1.2 * u, 1.2 * u); }
        }
        g.fillStyle = '#0B0318'; g.fillRect(0, yH, W, H - yH);
        // the grid rushing towards us
        const span = 1.1, n = 16, off = travelled % span;
        g.lineWidth = 1;
        for (let i = 0; i < n; i++) {
          const d = 0.5 + i * span - off;
          if (d <= 0.45) continue;
          const y = yH + (yG - yH) / d;
          if (y > H) continue;
          g.strokeStyle = `rgba(255,60,200,${Math.min(0.55, 0.9 / d)})`;
          g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
        }
        for (let k = -6; k <= 6; k++) {
          const X = k + 0.5, road = Math.abs(X) <= 1.5;
          if (X > 6) continue;
          g.strokeStyle = road ? 'rgba(63,245,255,.75)' : 'rgba(255,60,200,.28)';
          g.lineWidth = road && Math.abs(X) === 1.5 ? 1.6 * u : 1;
          g.beginPath(); g.moveTo(W / 2, yH); g.lineTo(W / 2 + (X * laneW) / 0.5, yH + (yG - yH) / 0.5); g.stroke();
        }
        const glowLine = g.createLinearGradient(0, yH - 2 * u, 0, yH + 6 * u);
        glowLine.addColorStop(0, 'rgba(255,90,200,0)'); glowLine.addColorStop(0.4, 'rgba(255,90,200,.5)'); glowLine.addColorStop(1, 'rgba(255,90,200,0)');
        g.fillStyle = glowLine; g.fillRect(0, yH - 2 * u, W, 8 * u);
        // everything on the road, far to near, with the runner in its place
        const list = objs.filter(o => !o.got).sort((a, b) => b.d - a.d);
        let drawnMe = false;
        const drawMe = () => {
          drawnMe = true;
          const x = W / 2 + me.x * laneW, jy = me.jy * laneW, lean = (me.target - me.x) * 0.25;
          g.fillStyle = `rgba(255,60,200,${0.3 * (1 - Math.min(1, me.jy / 0.7))})`;
          g.beginPath(); g.ellipse(x, yG + 1 * u, 11 * u * (1 - me.jy * 0.4), 3 * u, 0, 0, TAU); g.fill();
          g.save(); g.translate(x, yG - jy); g.rotate(lean);
          const air = me.jy > 0, bob = air ? 0 : Math.abs(Math.sin(me.phase)) * 2 * u;
          const hipY = -15 * u - bob, shY = hipY - 13 * u, headY = shY - 6.5 * u;
          const lf = air ? 5 * u : Math.max(0, Math.sin(me.phase)) * 7 * u, rf = air ? 5 * u : Math.max(0, Math.sin(me.phase + Math.PI)) * 7 * u;
          const limbs = () => {
            g.beginPath();
            g.moveTo(-3 * u, hipY); g.lineTo(-4.5 * u, hipY + 8 * u - lf * 0.5); g.lineTo(-4 * u, -lf);
            g.moveTo(3 * u, hipY); g.lineTo(4.5 * u, hipY + 8 * u - rf * 0.5); g.lineTo(4 * u, -rf);
            g.moveTo(0, hipY); g.lineTo(0, shY);
            g.moveTo(-4.5 * u, shY + 1 * u); g.lineTo(-7 * u, shY + 8 * u - rf * 0.7);
            g.moveTo(4.5 * u, shY + 1 * u); g.lineTo(7 * u, shY + 8 * u - lf * 0.7);
            g.moveTo(-4.5 * u, shY + 1 * u); g.lineTo(4.5 * u, shY + 1 * u);
            g.moveTo(-3 * u, hipY); g.lineTo(3 * u, hipY);
          };
          g.lineCap = 'round'; g.lineJoin = 'round';
          limbs(); g.strokeStyle = 'rgba(255,79,216,.35)'; g.lineWidth = 6 * u; g.stroke();
          limbs(); g.strokeStyle = '#FF8AEB'; g.lineWidth = 2.4 * u; g.stroke();
          g.fillStyle = '#FFE6FA'; g.beginPath(); g.arc(0, headY, 4.3 * u, 0, TAU); g.fill();
          g.strokeStyle = 'rgba(255,79,216,.55)'; g.lineWidth = 2 * u; g.stroke();
          g.restore();
        };
        for (const o of list) {
          if (!drawnMe && o.d < 1) drawMe();
          const s = 1 / o.d, y = yH + (yG - yH) * s, x = W / 2 + o.lane * laneW * s, lw = laneW * s;
          if (o.k === 'block') {
            const w = 0.78 * lw, h = 1.1 * lw;
            g.fillStyle = 'rgba(255,46,147,.22)'; g.fillRect(x - w / 2, y - h, w, h);
            g.strokeStyle = 'rgba(255,46,147,.35)'; g.lineWidth = Math.max(1, 5 * s * u); g.strokeRect(x - w / 2, y - h, w, h);
            g.strokeStyle = '#FF5AB0'; g.lineWidth = Math.max(0.8, 1.8 * s * u); g.strokeRect(x - w / 2, y - h, w, h);
            g.beginPath(); g.moveTo(x - w / 2, y - h * 0.5); g.lineTo(x + w / 2, y - h * 0.5); g.stroke();
          } else if (o.k === 'bar') {
            const w = 0.82 * lw, h = 0.42 * lw, th = Math.max(1.5, 0.11 * lw);
            g.fillStyle = '#3FF5FF';
            g.fillRect(x - w / 2, y - h, Math.max(1, 0.06 * lw), h); g.fillRect(x + w / 2 - Math.max(1, 0.06 * lw), y - h, Math.max(1, 0.06 * lw), h);
            g.fillStyle = 'rgba(63,245,255,.3)'; g.fillRect(x - w / 2 - 2, y - h - 2, w + 4, th + 4);
            g.fillStyle = '#3FF5FF'; g.fillRect(x - w / 2, y - h, w, th);
          } else if (!o.got) {
            const r = 0.15 * lw, cy = y - o.h * lw, sxk = Math.abs(Math.cos(t * 5 + o.d));
            g.strokeStyle = 'rgba(255,210,63,.35)'; g.lineWidth = Math.max(1, 4 * s * u);
            g.beginPath(); g.ellipse(x, cy, Math.max(0.6, r * sxk), r, 0, 0, TAU); g.stroke();
            g.strokeStyle = '#FFD23F'; g.lineWidth = Math.max(0.8, 1.8 * s * u); g.stroke();
          }
        }
        if (!drawnMe) drawMe();
        for (const s of sparks) { g.globalAlpha = s.life * 2; g.fillStyle = '#FFE58A'; g.fillRect(s.x, s.y, 1.6 * u, 1.6 * u); }
        g.globalAlpha = 1;
        fx.draw(g);
        // score
        g.textBaseline = 'middle';
        g.font = `700 ${7 * u}px "Hanken Grotesk", sans-serif`; g.textAlign = 'left'; g.fillStyle = 'rgba(255,255,255,.6)';
        g.fillText('SCORE', 10 * u, 52 * u);
        g.font = `800 ${11 * u}px Unbounded, sans-serif`; g.fillStyle = '#fff';
        g.fillText(String(Math.round(score)).padStart(5, '0'), 10 * u, 64 * u);
        g.textAlign = 'right'; g.fillStyle = '#FFD23F';
        g.fillText(String(coins), W - 10 * u, 64 * u);
        g.strokeStyle = '#FFD23F'; g.lineWidth = 1.6 * u; g.beginPath(); g.arc(W - 10 * u - g.measureText(String(coins)).width - 7 * u, 64 * u, 3.4 * u, 0, TAU); g.stroke();
        caption(g, W, 'one more run', 28 * u, 13.5 * u);
        if (bestAt) {
          const k = Math.min(1, (t - bestAt) / 1.6);
          if (t - bestAt < 3) big(g, W, H, 'NEW BEST!', k, 16 * u, `hsl(${Math.round(t * 240) % 360},100%,70%)`, 0.3);
        }
      }
    };
  },

  // ---------- The old screensaver logo: it's going to hit the corner. It's going to hit the corner. ----------
  dvd(W, H, A) {
    const u = W / 180, lw = 74 * u, lh = 28 * u, RX = W - lw, RY = H - lh;
    const T = rand(7.2, 8.6), vx = rand(46, 56) * u, vy = rand(36, 44) * u;
    const nx = Math.ceil((vx * T) / RX), ny = Math.ceil((vy * T) / RY);
    const p0x = nx * RX - vx * T, p0y = ny * RY - vy * T;
    const tri = (s, R) => { const m = ((s % (2 * R)) + 2 * R) % (2 * R); return m <= R ? m : 2 * R - m; };
    const walls = ts => Math.floor((p0x + vx * ts) / RX) + Math.floor((p0y + vy * ts) / RY);
    let t = 0, ts = 0, hue = rand(0, 360), hits = walls(0), hitT = 0, flash = 0;
    const fx = bits();
    return {
      cap: 'it’s been 40 minutes #nostalgia', snd: 'original sound · stezy', likes: '3.3M', likesPlus: '3.3M', coms: '21.4K', len: T + 4,
      prog: () => Math.min(1, ts / (T + 2)),
      step(dt) {
        t += dt;
        if (!hitT) {
          // the last moment before the corner happens in slow motion
          ts = Math.min(T, ts + dt * (ts > T - 0.8 ? 0.38 : 1));
          const w = walls(ts);
          if (w !== hits) { hits = w; hue = (hue + rand(60, 120)) % 360; A.bonk(); }
          if (ts >= T) {
            hitT = t; flash = 1; A.win();
            const cx = tri(p0x + vx * T, RX) > RX / 2 ? W - 4 * u : 4 * u, cy = tri(p0y + vy * T, RY) > RY / 2 ? H - 4 * u : 4 * u;
            fx.burst(cx, cy, 70, u, 1.4);
          }
        } else if (t - hitT > 2.6) A.done();
        flash = Math.max(0, flash - dt * 2.2);
        fx.step(dt, u);
      },
      draw(g) {
        g.fillStyle = '#050507'; g.fillRect(0, 0, W, H);
        const x = tri(p0x + vx * ts, RX), y = tri(p0y + vy * ts, RY), c = `hsl(${Math.round(hue)},95%,62%)`;
        g.strokeStyle = c; g.lineWidth = 2 * u;
        rr(g, x + u, y + u, lw - 2 * u, lh - 2 * u, (lh - 2 * u) / 2); g.stroke();
        g.fillStyle = c;
        g.font = `800 ${11 * u}px Unbounded, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        if ('letterSpacing' in g) g.letterSpacing = `${(2.6 * u).toFixed(1)}px`;
        g.fillText('STEZY', x + lw / 2 + 1.3 * u, y + lh / 2 + 0.5 * u);
        if ('letterSpacing' in g) g.letterSpacing = '0px';
        // scanlines and the tape's own small print
        g.fillStyle = 'rgba(255,255,255,.028)';
        for (let yy = 0; yy < H; yy += 3) g.fillRect(0, yy, W, 1);
        const oy = 68 * u, secs = Math.floor(40 * 60 + t);
        g.font = `700 ${8 * u}px "Hanken Grotesk", sans-serif`; g.textAlign = 'left'; g.textBaseline = 'middle';
        g.fillStyle = 'rgba(255,60,60,.6)'; g.fillText('PLAY', 11.5 * u, oy + 0.5 * u);
        g.fillStyle = 'rgba(230,230,240,.85)'; g.fillText('PLAY', 11 * u, oy);
        g.beginPath(); g.moveTo(34 * u, oy - 3.5 * u); g.lineTo(39 * u, oy); g.lineTo(34 * u, oy + 3.5 * u); g.fill();
        g.textAlign = 'right';
        g.fillText(`SP ${Math.floor(secs / 3600)}:${String(Math.floor(secs / 60) % 60).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`, W - 11 * u, oy);
        fx.draw(g);
        if (flash > 0) { g.fillStyle = `rgba(255,255,255,${(flash * 0.7).toFixed(3)})`; g.fillRect(0, 0, W, H); }
        const line = hitT ? 'IT HIT THE CORNER' : ts > T - 0.75 ? 'OH MY GOD' : ts > T - 2 ? 'it’s gonna hit the corner…' : 'it’s gonna hit the corner';
        caption(g, W, line, 30 * u, (hitT || ts > T - 0.75 ? 15 : 13.5) * u);
        if (hitT) big(g, W, H, 'CORNER!', Math.min(1, (t - hitT) / 1.4), 21 * u, '#FFE58A');
      }
    };
  },

  // ---------- Bubble wrap. You can pop it yourself; if you don't, a finger does ----------
  wrap(W, H, A) {
    const u = W / 180, dpr = A.dpr(), R = 10.5 * u, gap = 24 * u;
    const bubbles = [];
    for (let row = 0, y = 70 * u; y < H - 24 * u; row++, y += gap * 0.87) {
      for (let x = 16 * u + (row % 2 ? gap / 2 : 0); x < W - 12 * u; x += gap) {
        bubbles.push({ x, y, popped: false, pt: -1, wr: Array.from({ length: 9 }, () => rand(0.55, 1.05)), rot: rand(0, TAU) });
      }
    }
    // one bubble drawn once and reused
    const sp = document.createElement('canvas'), S = Math.ceil((R * 2 + 6) * dpr);
    sp.width = sp.height = S;
    const sg = sp.getContext('2d');
    sg.scale(dpr, dpr);
    const c0 = R + 3;
    sg.fillStyle = 'rgba(0,0,0,.28)'; sg.beginPath(); sg.arc(c0 + 1.2 * u, c0 + 1.6 * u, R, 0, TAU); sg.fill();
    const bgr = sg.createRadialGradient(c0 - R * 0.35, c0 - R * 0.4, R * 0.1, c0, c0, R);
    bgr.addColorStop(0, 'rgba(255,255,255,.55)'); bgr.addColorStop(0.35, 'rgba(210,225,255,.18)'); bgr.addColorStop(1, 'rgba(190,205,255,.1)');
    sg.fillStyle = bgr; sg.beginPath(); sg.arc(c0, c0, R, 0, TAU); sg.fill();
    sg.strokeStyle = 'rgba(255,255,255,.32)'; sg.lineWidth = 0.9 * u; sg.stroke();
    sg.fillStyle = 'rgba(255,255,255,.85)'; sg.beginPath(); sg.ellipse(c0 - R * 0.38, c0 - R * 0.42, R * 0.22, R * 0.13, -0.6, 0, TAU); sg.fill();
    let t = 0, lastUser = -9, userDown = false, endT = 0, left = bubbles.length;
    const finger = { x: W * 0.5, y: H * 0.6, target: null, wait: 0.8, press: 0, on: false };
    const specks = [];
    function pop(b) {
      if (b.popped) return;
      b.popped = true; b.pt = 0; left--;
      A.pop();
      for (let i = 0; i < 4; i++) specks.push({ x: b.x, y: b.y, vx: rand(-50, 50) * u, vy: rand(-50, 20) * u, life: 0.35 });
      if (!left && !endT) { endT = t; A.win(); }
    }
    function at(x, y) { for (const b of bubbles) if (!b.popped && (b.x - x) ** 2 + (b.y - y) ** 2 < (R * 1.08) ** 2) { pop(b); return; } }
    return {
      cap: 'your turn. tap the bubbles #satisfying', snd: 'pop pop pop · stezy', likes: '658K', likesPlus: '658K', coms: '3,872', len: 30, interactive: true,
      prog: () => 1 - left / bubbles.length,
      down(x, y) { userDown = true; lastUser = t; finger.on = false; at(x, y); },
      move(x, y, pressed) { if (pressed && userDown) { lastUser = t; at(x, y); } },
      up() { userDown = false; },
      step(dt) {
        t += dt;
        for (const b of bubbles) if (b.pt >= 0 && b.pt < 1) b.pt = Math.min(1, b.pt + dt * 7);
        for (let i = specks.length - 1; i >= 0; i--) { const s = specks[i]; s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt; if (s.life <= 0) specks.splice(i, 1); }
        // nobody's popping: the finger does it
        if (t - lastUser > 1.6 && left > 0) {
          finger.on = true;
          if (!finger.target || finger.target.popped) {
            const near = bubbles.filter(b => !b.popped).sort((a, b) => ((a.x - finger.x) ** 2 + (a.y - finger.y) ** 2) - ((b.x - finger.x) ** 2 + (b.y - finger.y) ** 2));
            finger.target = near[Math.min(near.length - 1, (Math.random() * 3) | 0)];
          }
          const tg = finger.target;
          finger.x += (tg.x - finger.x) * Math.min(1, dt * 16); finger.y += (tg.y - finger.y) * Math.min(1, dt * 16);
          finger.wait -= dt;
          if (finger.wait <= 0 && Math.hypot(tg.x - finger.x, tg.y - finger.y) < 2 * u) { pop(tg); finger.press = 1; finger.wait = rand(0.16, 0.3); }
        } else finger.on = t - lastUser > 1.6 && left > 0;
        finger.press = Math.max(0, finger.press - dt * 6);
        if (endT && t - endT > 2.2) A.done();
      },
      draw(g) {
        const bg = g.createLinearGradient(0, 0, W, H);
        bg.addColorStop(0, '#1D1A2B'); bg.addColorStop(1, '#0C0B13');
        g.fillStyle = bg; g.fillRect(0, 0, W, H);
        rr(g, 6 * u, 54 * u, W - 12 * u, H - 64 * u, 8 * u);
        g.fillStyle = 'rgba(255,255,255,.035)'; g.fill();
        g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 1; g.stroke();
        for (const b of bubbles) {
          if (!b.popped) { g.drawImage(sp, b.x - c0, b.y - c0, S / dpr, S / dpr); continue; }
          if (b.pt < 1) {
            // the moment it goes: a quick squash and flash
            const s = 1 - b.pt * 0.25;
            g.globalAlpha = 1 - b.pt;
            g.drawImage(sp, b.x - c0 * s, b.y - c0 * s, (S / dpr) * s, (S / dpr) * s);
            g.globalAlpha = 1;
          }
          // flattened plastic, a little crinkled
          g.beginPath();
          b.wr.forEach((k, i) => { const a = b.rot + (i / b.wr.length) * TAU, rr2 = R * 0.9 * k; i ? g.lineTo(b.x + Math.cos(a) * rr2, b.y + Math.sin(a) * rr2) : g.moveTo(b.x + Math.cos(a) * rr2, b.y + Math.sin(a) * rr2); });
          g.closePath();
          g.fillStyle = 'rgba(255,255,255,.045)'; g.fill();
          g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 0.8 * u; g.stroke();
          g.beginPath(); g.moveTo(b.x - R * 0.4, b.y - R * 0.1); g.lineTo(b.x + R * 0.1, b.y + R * 0.15); g.lineTo(b.x + R * 0.45, b.y - R * 0.05); g.stroke();
        }
        g.fillStyle = '#fff';
        for (const s of specks) { g.globalAlpha = s.life * 2.5; g.fillRect(s.x, s.y, 1.4 * u, 1.4 * u); }
        g.globalAlpha = 1;
        if (finger.on) {
          const pr = 1 - finger.press * 0.18;
          g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.arc(finger.x + 2 * u, finger.y + 3 * u, 9 * u * pr, 0, TAU); g.fill();
          g.fillStyle = 'rgba(255,226,210,.85)'; g.beginPath(); g.arc(finger.x, finger.y, 9 * u * pr, 0, TAU); g.fill();
          g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.ellipse(finger.x - 2.5 * u, finger.y - 3 * u, 3 * u, 2 * u, -0.5, 0, TAU); g.fill();
        }
        caption(g, W, 'pop them all. I’ll wait.', 26 * u, 13.5 * u);
        small(g, W, endT ? 'every. single. one.' : `${left} left`, 44 * u, 7.5 * u);
        if (endT) big(g, W, H, 'ALL POPPED', Math.min(1, (t - endT) / 1.4), 16 * u, '#9AF0D2', 0.5);
      }
    };
  }
};
