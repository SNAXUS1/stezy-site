'use strict';
/* Lucky Gambit core: wallet, stats, rating, boosts, profile state, router, shared UI helpers, effects */
const Casino = (() => {
  const KEY = 'luckygambit.v1';
  const games = {}, order = [], pages = {}, listeners = {};
  const blank = () => ({
    name: 'Player' + (1000 + Math.floor(Math.random() * 9000)),
    balance: 1000, rating: 1000, stats: {}, history: [], refills: 0, sound: true, lastBet: {}, joined: Date.now(),
    profile: { avatar: { style: 'adventurer', seed: '' }, color: '#34d399', banner: 'aurora', title: 'Newcomer', bio: '', fav: '', showcase: [] },
    inv: { cards: [], chests: { bronze: 1, silver: 0, gold: 0, diamond: 0 }, boosts: [] }, active: {},
    daily: { last: '', streak: 0, best: 0 }, ads: { day: '', n: 0 }, cool: {}, friends: [], earned: 0, uid: 1,
    howHidden: {}, plans: {}, tipsy: { on: true }, cheats: { xray: false }
  });
  let S;
  function migrate(o) {
    const s = Object.assign(blank(), o || {});
    for (const k of ['profile', 'inv', 'daily', 'ads', 'tipsy', 'cheats']) s[k] = Object.assign(blank()[k], (o || {})[k] || {});
    s.inv.chests = Object.assign({ bronze: 0, silver: 0, gold: 0, diamond: 0 }, s.inv.chests);
    if (!s.profile.avatar || !s.profile.avatar.style) s.profile.avatar = { style: 'adventurer', seed: '' };
    return s;
  }
  try { S = migrate(JSON.parse(localStorage.getItem(KEY))); } catch (e) { S = blank(); }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };

  /* ---------- utils ---------- */
  const buf = new Uint32Array(2);
  function rnd() { crypto.getRandomValues(buf); return (buf[0] * 2097152 + (buf[1] >>> 11)) / 9007199254740992; }
  const rint = n => Math.floor(rnd() * n);
  const rnd32 = () => 1 + rint(2 ** 31 - 1);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const r2 = n => Math.round(n * 100) / 100;
  const fmt = n => { const v = Math.abs(r2(n)); return (n < 0 ? '-$' : '$') + v.toLocaleString('en-US', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }); };
  const fmtS = n => (n > 0 ? '+' : '') + fmt(n);
  const fmtK = n => Math.abs(n) >= 1e6 ? '$' + (n / 1e6).toFixed(2) + 'M' : Math.abs(n) >= 1e4 ? '$' + (n / 1e3).toFixed(1) + 'k' : fmt(n);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rint(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const mulberry32 = Shared.mulberry32;
  const today = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const ago = t => { const s = (Date.now() - t) / 1000; return s < 60 ? 'just now' : s < 3600 ? Math.floor(s / 60) + 'm ago' : s < 86400 ? Math.floor(s / 3600) + 'h ago' : Math.floor(s / 86400) + 'd ago'; };
  const on = (e, f) => { (listeners[e] = listeners[e] || []).push(f); return () => { listeners[e] = listeners[e].filter(x => x !== f); }; };
  const emit = (e, ...a) => (listeners[e] || []).slice().forEach(f => { try { f(...a); } catch (x) { console.error(x); } });
  const uid = () => (S.uid = (S.uid || 1) + 1) + '-' + rint(1e6);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- sound ---------- */
  let actx;
  function sfx(kind) {
    if (!S.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const seq = { win: [[523, .09], [659, .09], [784, .16]], lose: [[300, .12], [220, .2]], click: [[600, .03]], tick: [[900, .015]], big: [[523, .08], [659, .08], [784, .08], [1047, .25]], open: [[392, .07], [523, .07], [659, .07], [784, .07], [1047, .3]], coin: [[1318, .05], [1760, .09]], pop: [[440, .04], [880, .06]] }[kind] || [];
      let t = actx.currentTime;
      for (const [f, d] of seq) {
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(.07, t); g.gain.exponentialRampToValueAtTime(.001, t + d);
        o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + d); t += d;
      }
    } catch (e) {}
  }

  /* ---------- effects: confetti, flying coins, floating numbers ---------- */
  const fx = (() => {
    let cv, g, parts = [], raf = 0;
    const COLS = ['#f5c451', '#34d399', '#60a5fa', '#f472b6', '#a78bfa', '#fb923c', '#ffffff'];
    function ensure() {
      if (cv) return;
      cv = document.createElement('canvas'); cv.id = 'fxc'; document.body.append(cv); g = cv.getContext('2d');
      const rs = () => { cv.width = innerWidth * devicePixelRatio; cv.height = innerHeight * devicePixelRatio; g.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); };
      rs(); addEventListener('resize', rs);
    }
    function loop() {
      g.clearRect(0, 0, innerWidth, innerHeight);
      parts = parts.filter(p => p.life-- > 0 && p.y < innerHeight + 40);
      for (const p of parts) {
        p.vx *= .99; p.vy += p.g; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.globalAlpha = Math.min(1, p.life / 40); g.fillStyle = p.c;
        if (p.round) { g.beginPath(); g.arc(0, 0, p.w / 2, 0, 7); g.fill(); } else g.fillRect(-p.w / 2, -p.h / 2 * Math.abs(Math.cos(p.rot * 2)), p.w, p.h * Math.abs(Math.cos(p.rot * 2)) + 1);
        g.restore();
      }
      raf = parts.length ? requestAnimationFrame(loop) : (g.clearRect(0, 0, innerWidth, innerHeight), 0);
    }
    function confetti(n = 150, x = innerWidth / 2, y = innerHeight * .32, gold) {
      if (reduced) return; ensure();
      for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2, sp = 4 + rnd() * 11;
        parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 6, g: .28, w: 6 + rnd() * 6, h: 9 + rnd() * 8, rot: rnd() * 6, vr: (rnd() - .5) * .3, c: gold ? ['#f5c451', '#fde68a', '#d4a017'][rint(3)] : COLS[rint(COLS.length)], life: 150 + rint(60), round: rnd() < .25 });
      }
      if (!raf) raf = requestAnimationFrame(loop);
    }
    function coins(n = 10, from) {
      const to = document.getElementById('balpill'); if (reduced || !to) return;
      const tr = to.getBoundingClientRect(), src = from || document.querySelector('#gbody .msg') || document.querySelector('#view');
      const fr = src ? src.getBoundingClientRect() : { left: innerWidth / 2 - 20, top: innerHeight / 2 - 20, width: 40, height: 40 };
      for (let i = 0; i < n; i++) {
        const c = document.createElement('i'); c.className = 'fxcoin';
        const x0 = fr.left + fr.width / 2 + (rnd() - .5) * Math.min(fr.width, 260), y0 = fr.top + Math.min(fr.height, 120) / 2 + (rnd() - .5) * 40;
        c.style.left = x0 + 'px'; c.style.top = y0 + 'px'; document.body.append(c);
        const dx = tr.left + 22 - x0, dy = tr.top + tr.height / 2 - y0;
        const an = c.animate([{ transform: 'translate(0,0) scale(.4)', opacity: 0 }, { transform: `translate(${(rnd() - .5) * 90}px,${-50 - rnd() * 70}px) scale(1)`, opacity: 1, offset: .32 }, { transform: `translate(${dx}px,${dy}px) scale(.45)`, opacity: .85 }], { duration: 800 + rnd() * 300, delay: i * 40, easing: 'cubic-bezier(.45,0,.2,1)', fill: 'forwards' });
        an.onfinish = () => { c.remove(); if (i === n - 1) { to.classList.remove('pulse'); void to.offsetWidth; to.classList.add('pulse'); sfx('coin'); } };
      }
    }
    function float(text, el, kind = 'pos') {
      if (!el) return; const r = el.getBoundingClientRect(), f = document.createElement('span');
      f.className = 'fxfloat ' + kind; f.textContent = text; f.style.left = (r.left + r.width / 2) + 'px'; f.style.top = (r.bottom - 6) + 'px';
      document.body.append(f); setTimeout(() => f.remove(), 1400);
    }
    function burst(el, color = '#f5c451') {
      if (reduced || !el) return; const r = el.getBoundingClientRect();
      confetti(40, r.left + r.width / 2, r.top + r.height / 2, color === '#f5c451');
    }
    return { confetti, coins, float, burst };
  })();

  /* ---------- wallet / stats / rating / boosts ---------- */
  function stat(id) { return S.stats[id] || (S.stats[id] = { w: 0, l: 0, p: 0, wagered: 0, profit: 0, best: 0, rating: 1000 }); }
  function wager(amount) {
    amount = r2(amount);
    if (!Number.isFinite(amount) || amount <= 0) return false;
    if (amount > S.balance + 1e-9) { toast('Not enough balance. Click your balance to earn more coins', 'bad', { label: 'Get coins', fn: () => typeof Rewards !== 'undefined' && Rewards.openCoins() }); return false; }
    S.balance = r2(S.balance - amount); save(); emit('change'); return true;
  }
  function refund(amount) { if (amount > 0) { S.balance = r2(S.balance + amount); save(); emit('change'); } }
  function credit(amount, why) { S.balance = r2(S.balance + amount); S.earned = r2((S.earned || 0) + amount); save(); emit('change'); if (why) toast(`${fmtS(amount)} · ${why}`, 'gold'); sfx('win'); fx.coins(Math.min(16, 6 + Math.round(amount / 150)), document.querySelector('.modal') || null); }
  const BOOST_NAMES = { charm: 'Lucky Charm', shield: 'Safety Net', clover: 'Treasure Hunter', guard: 'Rating Guard', xp: 'Hot Streak' };
  /** wagered = stake already deducted, returned = total paid back, p = estimated win probability */
  function settle(id, wagered, returned, p = .5) {
    returned = r2(returned);
    const A = S.active, base = r2(returned - wagered);
    if (base > 0 && A.charm) returned += base * A.charm.pct;
    if (base < 0 && A.shield) returned += -base * .5;
    returned = r2(returned);
    S.balance = r2(S.balance + returned);
    const profit = r2(returned - wagered), res = profit > 0 ? 'w' : profit < 0 ? 'l' : 'p';
    p = Math.min(.97, Math.max(.03, p));
    let delta = res === 'w' ? 20 * (1 - p) : res === 'l' ? -20 * p : 0;
    if (A.guard && delta < 0) delta = 0;
    if (A.xp && delta > 0) delta *= 2;
    for (const x of [stat(id), stat('_all')]) { x[res]++; x.wagered = r2(x.wagered + wagered); x.profit = r2(x.profit + profit); if (profit > x.best) x.best = profit; }
    stat(id).rating = Math.max(100, stat(id).rating + delta);
    S.rating = Math.max(100, S.rating + delta);
    S.history.unshift({ t: Date.now(), g: id, wager: wagered, ret: returned, profit });
    if (S.history.length > 60) S.history.length = 60;
    for (const k of Object.keys(A)) if (--A[k].left <= 0) { delete A[k]; toast(`${BOOST_NAMES[k] || k} expired`); }
    save(); emit('change'); emit('settled', { id, wagered, returned, profit });
    const big = profit >= wagered * 5 && profit >= 50;
    if (profit > 0) { sfx(big ? 'big' : 'win'); fx.coins(big ? 18 : Math.min(10, 3 + Math.round(profit / Math.max(1, wagered)))); if (big) { toast(`Big win! ${fmtS(profit)}`, 'gold'); fx.confetti(170); } }
    else if (profit < 0) sfx('lose');
    return profit;
  }
  const tiers = [[800, 'Rookie'], [950, 'Bronze'], [1075, 'Silver'], [1200, 'Gold'], [1350, 'Platinum'], [1550, 'Diamond'], [1e9, 'Grandmaster']];
  const tierOf = r => tiers.find(t => r < t[0])[1];
  const TIER_COL = { Rookie: ['#cbd5e1', '#64748b'], Bronze: ['#f6b27a', '#a35d2a'], Silver: ['#f1f5f9', '#8a97aa'], Gold: ['#fde68a', '#d49b0c'], Platinum: ['#a7f3d0', '#0d9488'], Diamond: ['#bae6fd', '#6366f1'], Grandmaster: ['#fecdd3', '#e11d48'] };
  /** shield emblem for a rating tier: chevrons for the lower tiers, star / gem / crown at the top */
  function tierBadge(r, s = 22) {
    const t = tierOf(r), i = tiers.findIndex(x => x[1] === t), [a, b] = TIER_COL[t], id = 'tb' + i, ink = 'rgba(15,20,28,.72)';
    const inner = i === 0 ? `<circle cx="16" cy="15" r="3.2" fill="${ink}"/>`
      : i <= 3 ? Array.from({ length: i }, (_, k) => `<path d="M10.5 ${10.5 + k * 4.2} 16 ${14 + k * 4.2} 21.5 ${10.5 + k * 4.2}" fill="none" stroke="${ink}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`).join('')
      : i === 4 ? `<path d="M16 8.6l2.1 4.3 4.7.7-3.4 3.3.8 4.7-4.2-2.2-4.2 2.2.8-4.7-3.4-3.3 4.7-.7z" fill="${ink}"/>`
      : i === 5 ? `<path d="M11 12.5 13.4 9.2h5.2L21 12.5 16 20.4z" fill="${ink}"/><path d="M11 12.5h10M13.4 9.2 16 20.4l2.6-11.2" stroke="${a}" stroke-width=".9" fill="none"/>`
      : `<path d="M10 19.5V11.5l3.2 2.8L16 9.5l2.8 4.8 3.2-2.8v8z" fill="${ink}"/><rect x="10" y="20.6" width="12" height="2" rx="1" fill="${ink}"/>`;
    return `<svg class="tierb" width="${s}" height="${s}" viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><path d="M16 2 28 6.6v8.1c0 7.4-5 12.6-12 15.3C9 27.3 4 22.1 4 14.7V6.6z" fill="url(#${id})"/><path d="M16 4.7 25.5 8.3v6.4c0 6-4 10.4-9.5 12.7-5.5-2.3-9.5-6.7-9.5-12.7V8.3z" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="1"/>${inner}</svg>`;
  }
  const tierTag = r => `<em class="tier t-${tierOf(r).toLowerCase()}">${tierOf(r)}</em>`;

  /* ---------- UI helpers ---------- */
  function toast(msg, kind = '', action) {
    const t = document.createElement('div'); t.className = 'toast ' + kind;
    t.innerHTML = `<span class="tico">${icon(kind === 'bad' ? 'info' : kind === 'gold' ? 'coins' : 'check', 18)}</span><span class="tmsg">${esc(msg)}</span>`;
    if (action) { const b = document.createElement('button'); b.className = 'btn small'; b.textContent = action.label; b.onclick = () => { action.fn(); t.remove(); }; t.append(b); }
    const box = document.getElementById('toasts'); box.append(t);
    while (box.children.length > 5) box.firstChild.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 260); }, action ? 9000 : 3400);
  }
  function modal(html, opt = {}) {
    const w = document.createElement('div'); w.className = 'modal-wrap';
    w.innerHTML = `<div class="modal ${opt.cls || ''}">${opt.noClose ? '' : `<button class="mclose" aria-label="Close">${icon('x', 18)}</button>`}${html}</div>`;
    document.body.append(w);
    let closed = false;
    const close = () => { if (closed) return; closed = true; w.classList.add('out'); setTimeout(() => w.remove(), 170); opt.onClose && opt.onClose(); };
    if (!opt.noClose) { w.querySelector('.mclose').onclick = close; w.addEventListener('mousedown', e => { if (e.target === w) close(); }); }
    return { el: w.querySelector('.modal'), wrap: w, close };
  }
  function ask(text, ok = 'Confirm', sub = '') {
    return new Promise(res => {
      const m = modal(`<h2>${esc(text)}</h2>${sub ? `<p class="muted">${esc(sub)}</p>` : ''}<div class="btnrow" style="justify-content:flex-end;margin-top:18px"><button class="btn sec" data-a="no">Cancel</button><button class="btn" data-a="yes">${esc(ok)}</button></div>`, { onClose: () => res(false) });
      m.el.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b) { res(b.dataset.a === 'yes'); m.close(); } });
    });
  }
  const CHIPS = [1, 5, 25, 100, 500];
  function betControl(host, gameId, opt = {}) {
    host.classList.add('betctl');
    host.innerHTML = `<label>${opt.label || 'Bet amount'}</label><div class="betrow"><span class="betin">${icon('coin', 16)}<input type="number" min="1" step="1" inputmode="numeric" aria-label="${opt.label || 'Bet amount'}"></span><button data-a="half" title="Halve">½</button><button data-a="dbl" title="Double">2×</button><button data-a="max" title="Bet everything">Max</button></div><div class="chips">${CHIPS.map(c => `<button class="chip c${c}" data-c="${c}">${c}</button>`).join('')}</div>`;
    const inp = host.querySelector('input');
    inp.value = S.lastBet[gameId] || opt.def || 10;
    const get = () => { const v = Math.floor(Number(inp.value)); return v >= 1 ? v : 1; };
    const set = v => { inp.value = Math.max(1, Math.floor(v)); S.lastBet[gameId] = get(); save(); };
    host.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b || b.disabled) return;
      if (b.dataset.c) set(+b.dataset.c); else if (b.dataset.a === 'half') set(get() / 2); else if (b.dataset.a === 'dbl') set(get() * 2); else if (b.dataset.a === 'max') set(S.balance);
      sfx('click');
    });
    inp.addEventListener('change', () => set(get()));
    return { get, set, lock(b) { host.querySelectorAll('button,input').forEach(x => x.disabled = !!b); host.classList.toggle('locked', !!b); } };
  }
  function chipPicker(host, def = 5) {
    let cur = def; host.classList.add('betctl');
    host.innerHTML = `<label>Chip value <small>click a spot to place</small></label><div class="chips">${CHIPS.map(c => `<button class="chip c${c}${c === cur ? ' sel' : ''}" data-c="${c}">${c}</button>`).join('')}</div>`;
    host.addEventListener('click', e => { const b = e.target.closest('.chip'); if (!b) return; cur = +b.dataset.c; host.querySelectorAll('.chip').forEach(x => x.classList.toggle('sel', x === b)); sfx('click'); });
    return { get: () => cur };
  }
  function newShoe(decks = 1) { return Shared.deck(rnd, decks); }
  const cardFace = c => `<b>${c.r}</b><i>${c.s}</i><b class="br">${c.r}</b>`;
  function cardEl(c, down, cls = '') {
    const e = document.createElement('div');
    e.className = 'card ' + cls + (down ? ' down' : '') + (c && (c.s === '♥' || c.s === '♦') ? ' red' : '');
    if (!down && c) e.innerHTML = cardFace(c);
    return e;
  }
  function flipCard(e, c) { e.classList.remove('down'); e.classList.add('flip'); e.classList.toggle('red', c.s === '♥' || c.s === '♦'); e.innerHTML = cardFace(c); }
  const AV_STYLES = ['adventurer', 'avataaars', 'lorelei', 'notionists', 'micah', 'big-smile', 'fun-emoji', 'pixel-art', 'thumbs', 'bottts'];
  const avatarUrl = a => `https://api.dicebear.com/9.x/${a.style}/svg?seed=${encodeURIComponent(a.seed)}`;
  function avatarSrc(p) {
    const a = p.avatar || {};
    if (a.style === 'custom') return a.img || (a.v ? `${window.CASINO_SERVER || ''}/avatar/${encodeURIComponent(p.name)}?v=${encodeURIComponent(a.v)}` : '');
    return a.style && a.style !== 'initials' ? avatarUrl({ style: a.style, seed: a.seed || p.name || 'x' }) : '';
  }
  function avatar(p, size = 36) {
    p = p || {}; const init = esc(((p.name || '?')[0] || '?').toUpperCase()), src = avatarSrc(p), custom = (p.avatar || {}).style === 'custom';
    return `<span class="avatar ${custom ? 'custom' : ''}" style="width:${size}px;height:${size}px;font-size:${Math.round(size * .42)}px;--c:${p.color || '#f59e0b'}"><b>${init}</b>${src ? `<img src="${esc(src)}" alt="" loading="lazy" onerror="this.remove()">` : ''}</span>`;
  }
  const plink = (name, inner) => `<a class="plink" href="#/profile/${encodeURIComponent(name)}">${inner || esc(name)}</a>`;
  function myProfile() {
    const a = stat('_all'), stats = {};
    for (const id of order) if (S.stats[id]) { const s = S.stats[id]; stats[id] = { w: s.w, l: s.l, p: s.p, profit: s.profit, rating: Math.round(s.rating) }; }
    const col = typeof Eco !== 'undefined' ? Eco.summary() : { count: 0, score: 0, value: 0 }, av = S.profile.avatar;
    const avatarOut = av.style === 'custom' ? { style: 'custom', v: av.v, img: av.img } : { style: av.style, seed: av.seed || S.name };
    return Object.assign({}, S.profile, { showcase: typeof Eco !== 'undefined' ? Eco.showcase() : [], name: S.name, avatar: avatarOut, rating: Math.round(S.rating), totals: { w: a.w, l: a.l, p: a.p, profit: a.profit, wagered: a.wagered, best: a.best }, stats, collection: col, joined: S.joined, streak: S.daily.streak, friends: S.friends.length, badges: typeof Profiles !== 'undefined' ? Profiles.badges().filter(b => b.got).map(b => b.id) : [] });
  }

  /* ---------- icons (Phosphor duotone, see icons.js) ---------- */
  const ALIAS = { home: 'house', users: 'users-three', chest: 'treasure-chest', chart: 'chart-line-up', spade: 'spade', flag: 'flag-checkered', cards3: 'cards-three', hilo: 'arrows-down-up', grid: 'grid-nine', volume: 'speaker-high', mute: 'speaker-slash', arrow: 'arrow-right', edit: 'pencil-simple', flame: 'fire', bolt: 'lightning', tv: 'television', calc: 'calculator', store: 'storefront', upload: 'upload-simple', chat: 'chat-circle-dots', shield: 'shield-star', rocket: 'rocket-launch', chip: 'poker-chip', trendup: 'trend-up', trenddown: 'trend-down', send: 'paper-plane-tilt' };
  const ICON_OF = { blackjack: 'cards', baccarat: 'crown', roulette: 'roulette', craps: 'dice2', slots: 'cherries', plinko: 'plinko', crash: 'rocket-launch', poker: 'poker-chip', ducks: 'bird', horses: 'horse', dogs: 'dog', videopoker: 'cards-three', hilo: 'arrows-down-up', dice: 'dice-five', mines: 'bomb', keno: 'grid-nine', wheel: 'wheel', lobby: 'house', live: 'users-three', scores: 'trophy', earn: 'gift', collection: 'treasure-chest', profile: 'user', market: 'chart-line-up' };
  const icon = (n, s = 20) => `<svg class="ico" width="${s}" height="${s}" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">${ICONS[ICON_OF[n] || ALIAS[n] || n] || ''}</svg>`;
  const ACCENT = { blackjack: '#34d399', baccarat: '#f472b6', roulette: '#f87171', craps: '#fbbf24', poker: '#2dd4bf', videopoker: '#22d3ee', hilo: '#e879f9', slots: '#a78bfa', plinko: '#60a5fa', crash: '#fb923c', dice: '#4ade80', mines: '#fb7185', keno: '#818cf8', wheel: '#facc15', ducks: '#38bdf8', horses: '#86efac', dogs: '#fdba74', live: '#f87171', scores: '#fbbf24', lobby: '#34d399', earn: '#f5c451', collection: '#a78bfa', profile: '#60a5fa', market: '#34d399' };
  const CATS = [['Table games', ['blackjack', 'poker', 'baccarat', 'roulette', 'craps', 'videopoker', 'hilo']], ['Instant games', ['slots', 'crash', 'plinko', 'mines', 'dice', 'keno', 'wheel']], ['Racing', ['ducks', 'horses', 'dogs']]];
  const head = (ic, title, desc, extra = '', ac) => `<div class="gamehead"><div class="gtile" style="--ac:${ac || ACCENT[ic] || '#34d399'}">${icon(ic, 28)}</div><div class="gtext"><h1>${title}</h1><p>${desc}</p></div>${extra}</div>`;

  /* ---------- how to play ---------- */
  const MODES_HELP = [['Solo', 'Just you and the house. Play at your own pace.'], ['Bots', 'A live-style table with 1–5 bots. Rounds run on a timer — bet before it closes.'], ['Live', 'Public table with real players and bots. Everyone shares the same outcome.'], ['Friends', 'Private room code. Invite friends and choose how many bots sit in.']];
  function howModal(g) {
    const h = g.how || {};
    const m = modal(`<div class="howm"><div class="howtop"><div class="gtile" style="--ac:${ACCENT[g.id]}">${icon(g.id, 26)}</div><div><small class="muted">How to play</small><h2>${g.name}</h2></div></div>
      ${h.goal ? `<p class="howgoal">${h.goal}</p>` : ''}
      <ol class="hsteps">${(h.steps || []).map(s => `<li><span>${s}</span></li>`).join('')}</ol>
      ${h.rules ? `<h3>Good to know</h3><ul class="hrules">${h.rules.map(r => `<li>${r}</li>`).join('')}</ul>` : ''}
      ${h.pays ? `<h3>Payouts</h3><div class="hpays">${h.pays.map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join('')}</div>` : ''}
      ${g.multi ? `<h3>Ways to play</h3><div class="hmodes">${MODES_HELP.filter(x => !(g.noBots && x[0] === 'Bots')).map(([a, b]) => `<div><b>${g.noBots && a === 'Solo' ? 'vs Bots' : a}</b><span>${g.noBots && a === 'Solo' ? 'An offline table with 1–5 bots. Play at your own pace.' : b}</span></div>`).join('')}</div>` : ''}
      <div class="btnrow" style="justify-content:flex-end;margin-top:18px"><button class="btn" data-a="ok">Let's play</button></div></div>`, { cls: 'mid', onClose: () => off() });
    const off = on('route', () => m.close());
    m.el.querySelector('[data-a="ok"]').onclick = m.close;
  }
  function guideStrip(g) {
    const h = g.how; if (!h || !h.steps || S.howHidden[g.id]) return '';
    return `<div class="guide" id="guide"><span class="gl">${icon('lightbulb', 18)}Quick start</span><ol>${h.steps.slice(0, 3).map(s => `<li><span>${s}</span></li>`).join('')}</ol><div class="gact"><button class="btn sec small" data-how="1">Full rules</button><button class="icon-btn sm" data-hide="1" title="Hide quick start">${icon('x', 14)}</button></div></div>`;
  }

  /* ---------- registry & router ---------- */
  function register(def) { games[def.id] = def; order.push(def.id); }
  function page(def) { pages[def.id] = def; }
  const newCode = () => Array.from({ length: 5 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[rint(31)]).join('');
  let cleanup = null;
  function route() {
    const parts = (location.hash.replace(/^#\/?/, '') || 'lobby').split('/').map(decodeURIComponent);
    const view = document.getElementById('view'), crumb = document.getElementById('crumb');
    if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; }
    view.innerHTML = ''; view.style.animation = 'none'; void view.offsetWidth; view.style.animation = '';
    const box = document.createElement('div'); view.append(box);
    let key = parts[0];
    try {
      if (parts[0] === 'game' && games[parts[1]]) {
        key = 'game/' + parts[1];
        const g = games[parts[1]];
        const mode = g.multi && ['bots', 'live', 'room'].includes(parts[2]) ? parts[2] : 'solo';
        if (mode === 'bots' && g.noBots) { location.replace(`#/game/${g.id}`); return; }
        // tables are the point: wait a moment for the server, and go to the live table when it's there
        if (typeof MP !== 'undefined' && g.multi && parts[2] !== 'solo' && parts[2] !== 'bots' && MP.connecting()) { box.innerHTML = '<p class="muted" style="padding:40px">Finding the casino…</p>'; MP.whenSettled().then(route); return; }
        if (typeof MP !== 'undefined' && g.multi && !parts[2] && MP.online()) { location.replace(`#/game/${g.id}/live`); return; }
        const code = mode === 'room' ? (parts[3] || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) : '';
        if (mode === 'room' && code.length < 4) { location.replace(`#/game/${g.id}/room/${newCode()}`); return; }
        const tab = (m, href, label, ic, cls = '') => `<a href="${href}" class="${cls} ${mode === m ? 'on' : ''}">${icon(ic, 15)}${label}</a>`;
        const seg = g.multi ? `<span class="modeseg">${tab('solo', `#/game/${g.id}/solo`, g.noBots ? 'vs Bots' : 'Solo', g.noBots ? 'robot' : 'user')}${g.noBots ? '' : tab('bots', `#/game/${g.id}/bots`, 'Bots', 'robot')}${tab('live', `#/game/${g.id}/live`, 'Live', 'globe', 'live')}${tab('room', `#/game/${g.id}/room/${mode === 'room' ? code : newCode()}`, 'Friends', 'users')}</span>` : '';
        const howBtn = g.how ? `<button class="btn sec small howbtn" data-how="1">${icon('question', 16)}How to play</button>` : '';
        box.innerHTML = head(g.id, g.name, g.desc, `<div class="ghright">${howBtn}${seg}</div>`) + guideStrip(g) + '<div id="gbody"></div>';
        box.addEventListener('click', e => {
          if (e.target.closest('[data-how]')) howModal(g);
          if (e.target.closest('[data-hide]')) { S.howHidden[g.id] = 1; save(); const gd = box.querySelector('#guide'); if (gd) { gd.classList.add('bye'); setTimeout(() => gd.remove(), 250); } }
        });
        crumb.innerHTML = `<span class="muted">Games</span><span class="sep">/</span><span>${g.name}</span>`;
        cleanup = g.mount(box.querySelector('#gbody'), { mode, code }) || null;
      } else {
        const pg = pages[parts[0]] || pages.lobby; if (!pages[parts[0]]) key = 'lobby';
        crumb.textContent = pg.title || 'Lobby';
        cleanup = pg.mount(box, parts.slice(1)) || null;
      }
    } catch (e) { console.error(e); box.innerHTML = `<div class="card-box">Something broke: ${esc(e.message)}</div>`; }
    document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.dataset.key === key));
    emit('route', key);
    window.scrollTo(0, 0);
  }

  /* ---------- header ---------- */
  let shownBal = null, balRaf = 0;
  function drawBal() {
    const el = document.querySelector('#balpill .bv'), pill = document.getElementById('balpill'); if (!el) return;
    const target = S.balance;
    if (shownBal == null) { shownBal = target; el.textContent = fmt(target); return; }
    const from = shownBal, d = r2(target - from); if (!d) return;
    pill.classList.remove('up', 'down'); void pill.offsetWidth; pill.classList.add(d > 0 ? 'up' : 'down');
    if (d >= 1) fx.float(fmtS(d), pill, 'pos');
    cancelAnimationFrame(balRaf);
    const t0 = performance.now(), T = reduced ? 1 : Math.min(1100, 350 + Math.log10(1 + Math.abs(d)) * 180);
    const step = now => { const t = Math.min(1, (now - t0) / T), e = 1 - Math.pow(1 - t, 3); shownBal = from + d * e; el.textContent = fmt(t < 1 ? Math.round(shownBal * 100) / 100 : target); if (t < 1) balRaf = requestAnimationFrame(step); else shownBal = target; };
    balRaf = requestAnimationFrame(step);
  }
  function header() {
    const $ = id => document.getElementById(id);
    drawBal();
    $('ratingpill').innerHTML = `${tierBadge(S.rating, 24)}<span class="rv">${Math.round(S.rating)}</span>${tierTag(S.rating)}`;
    $('ratingpill').title = `Rating ${Math.round(S.rating)} · ${tierOf(S.rating)} tier`;
    $('namebtn').innerHTML = `${avatar(myProfile(), 38)}<span class="uc"><b>${esc(S.name)}</b><small>${esc(S.profile.title || tierOf(S.rating))}</small></span>${icon('caret-right', 16)}`;
    $('refill').hidden = S.balance >= 1;
    $('snd').innerHTML = icon(S.sound ? 'volume' : 'mute', 18);
    const act = Object.keys(S.active);
    $('boostpill').hidden = !act.length;
    $('boostpill').innerHTML = `${icon('bolt', 16)}<span>${act.length} active</span>`;
    $('boostpill').title = act.map(k => `${BOOST_NAMES[k]} · ${S.active[k].left} rounds`).join('\n');
    const nb = document.querySelector('#nav a[data-key="earn"] .dot'); if (nb) nb.hidden = S.daily.last === today();
  }

  function start() {
    const nav = document.getElementById('nav');
    const link = (key, ic, name, extra = '') => `<a href="#/${key}" data-key="${key}" style="--ac:${ACCENT[ic] || '#34d399'}"><span class="ic">${icon(ic, 20)}</span><span class="t">${name}</span>${extra}</a>`;
    nav.innerHTML = '<div class="sep">Menu</div>' + link('lobby', 'lobby', 'Lobby') + link('live', 'live', 'Multiplayer', '<span class="dot live">LIVE</span>') +
      link('earn', 'earn', 'Earn & Daily', '<span class="dot">1</span>') + link('collection', 'collection', 'Collection') + link('market', 'market', 'Card Market') + link('scores', 'scores', 'Leaderboard') +
      CATS.map(([t, ids]) => `<div class="sep">${t}</div>` + ids.filter(id => games[id]).map(id => link('game/' + id, id, games[id].name, games[id].isNew ? '<span class="dot new">NEW</span>' : '')).join('')).join('');
    const bp = document.getElementById('balpill');
    bp.innerHTML = `<span class="coinico">${icon('coin', 18)}</span><span class="bv"></span><span class="bplus" title="Get more coins">${icon('plus', 14)}</span>`;
    bp.onclick = () => typeof Rewards !== 'undefined' && Rewards.openCoins();
    document.getElementById('refill').onclick = () => { S.balance = 1000; S.refills++; save(); emit('change'); toast('Here is a fresh $1,000. Play smart!', 'gold'); };
    document.getElementById('snd').onclick = () => { S.sound = !S.sound; save(); header(); };
    document.getElementById('namebtn').onclick = () => { location.hash = '#/profile'; };
    document.getElementById('boostpill').onclick = () => { location.hash = '#/collection/boosts'; };
    on('change', header); header();
    window.addEventListener('hashchange', route);
    route();
  }

  /* ---------- Lobby & Leaderboard ---------- */
  function overall() { const a = stat('_all'); return { a, rate: a.w + a.l ? a.w / (a.w + a.l) : 0 }; }
  const LIVE_ROOMS = ['crash', 'roulette', 'blackjack', 'poker', 'mines', 'ducks', 'horses', 'dogs'];
  page({
    id: 'lobby', title: 'Lobby', mount(root) {
      const { a, rate } = overall();
      const ti = tiers.findIndex(t => S.rating < t[0]), lo = ti > 0 ? tiers[ti - 1][0] : 500, hi = tiers[ti][0];
      const pct = ti === tiers.length - 1 ? 100 : Math.max(2, Math.min(100, (S.rating - lo) / (hi - lo) * 100));
      const toNext = ti === tiers.length - 1 ? 'Top tier reached' : `${Math.ceil(hi - S.rating)} rating points to ${tiers[ti + 1][1]}`;
      const wheelReady = S.daily.last !== today(), chests = Object.values(S.inv.chests).reduce((x, y) => x + y, 0);
      let gi = 0;
      root.innerHTML = `<section class="hero"><div class="hero-l"><div class="eyebrow">Welcome back</div><div class="hero-id">${tierBadge(S.rating, 64)}<div><h1>${esc(S.name)}</h1>
        <div class="rankline">${tierTag(S.rating)}<b>${Math.round(S.rating)}</b> rating</div></div></div>
        <div class="progress"><i style="width:${pct}%"></i></div><small>${toNext}</small>
        <div class="btnrow"><a class="btn" href="#/live">${icon('users', 18)}Play multiplayer</a><button class="btn sec" id="getcoins">${icon('coins', 18)}Get coins</button></div></div>
        <div class="kpis"><div class="kpi"><small>${icon('wallet', 14)}Balance</small><b style="color:var(--gold)">${fmt(S.balance)}</b></div>
        <div class="kpi"><small>${icon('trophy', 14)}Record</small><b><span class="pos">${a.w}</span> <span class="muted">–</span> <span class="neg">${a.l}</span></b></div>
        <div class="kpi"><small>${icon('percent', 14)}Win rate</small><b>${a.w + a.l ? Math.round(rate * 100) + '%' : '—'}</b></div>
        <div class="kpi"><small>${icon('cards', 14)}Collection value</small><b>${typeof Eco !== 'undefined' ? fmtK(Eco.summary().value) : '$0'}</b></div></div></section>
        <div class="promos">
          <a class="promo" href="#/earn" style="--i:0"><div class="gtile" style="--ac:#f5c451">${icon('gift', 24)}</div><div><b>${wheelReady ? 'Daily wheel is ready!' : 'Daily wheel claimed'}</b><small>${S.daily.streak}-day streak · prizes grow every day</small></div>${wheelReady ? '<span class="ping"></span>' : ''}</a>
          <a class="promo" href="#/collection" style="--i:1"><div class="gtile" style="--ac:#a78bfa">${icon('chest', 24)}</div><div><b>${chests ? `${chests} chest${chests > 1 ? 's' : ''} to open` : 'Lucky chests'}</b><small>Win chests in any game · open for meme cards</small></div></a>
          <button class="promo" id="promo-coins" style="--i:2"><div class="gtile" style="--ac:#34d399">${icon('hand-coins', 24)}</div><div><b>Low on coins?</b><small>Pick a coin plan and beat a few minigames</small></div></button>
        </div>
        <div class="secthead"><h2>Live tables</h2><span id="livenote"></span></div><div class="livestrip" id="live"></div>
        ${CATS.map(([t, ids]) => `<div class="secthead"><h2>${t}</h2><span>${ids.filter(id => games[id]).length} games</span></div><div class="gamegrid">${ids.filter(id => games[id]).map(id => {
        const g = games[id], s = S.stats[id] || { w: 0, l: 0, rating: 1000 };
        return `<a class="gcard" style="--ac:${ACCENT[id]};--i:${gi++}" href="#/game/${id}"><div class="gart"><span class="gglow"></span>${icon(id, 56)}${g.isNew ? '<span class="badge-new">NEW</span>' : ''}${g.multi ? '<span class="badge-live"><i></i>MULTIPLAYER</span>' : ''}</div><div class="gbody"><h3>${g.name}</h3><p>${g.desc}</p><div class="rec"><span><b class="pos">${s.w}</b> W · <b class="neg">${s.l}</b> L</span><span class="rr">${icon('star', 13)}${Math.round(s.rating)}</span></div></div><span class="gplay">${icon('play', 16)}Play</span></a>`;
      }).join('')}</div>`).join('')}`;
      const coinsBtn = () => typeof Rewards !== 'undefined' && Rewards.openCoins();
      root.querySelector('#getcoins').onclick = coinsBtn; root.querySelector('#promo-coins').onclick = coinsBtn;
      const drawLive = () => {
        const onl = typeof MP !== 'undefined' && MP.online(), list = onl ? MP.state().rooms : [];
        root.querySelector('#livenote').textContent = onl ? `${MP.state().players.length} players online` : 'Server offline — bot tables still work';
        root.querySelector('#live').innerHTML = LIVE_ROOMS.filter(id => games[id]).map(id => {
          const r = list.find(x => x.game === id);
          return `<a class="lroom" style="--ac:${ACCENT[id]}" href="#/game/${id}${onl ? '/live' : (games[id].noBots ? '' : '/bots')}"><div class="gtile">${icon(id, 20)}</div><div><b>${games[id].name}</b><div class="phase ${r ? r.phase : ''}">${r ? `${r.humans} player${r.humans === 1 ? '' : 's'} · ${r.bots} bots` : onl ? 'Open table · join now' : 'Play vs bots'}</div></div>${r ? '<span class="lpulse"></span>' : ''}</a>`;
        }).join('');
      };
      drawLive(); const tm = setInterval(drawLive, 2000);
      return () => clearInterval(tm);
    }
  });

  page({
    id: 'scores', title: 'Leaderboard', mount(root) {
      const { a, rate } = overall();
      const rows = CATS.flatMap(c => c[1]).filter(id => games[id] && S.stats[id]).map(id => ({ id, s: S.stats[id] }));
      root.innerHTML = head('scores', 'Leaderboard', 'Global rankings and your results across every game') + `
      <div class="card-box" style="margin-bottom:20px"><h3>Global ranking</h3><div id="board"></div></div>
      <div class="stat-grid">
        <div class="stat"><small>Rating</small><div class="statrow">${tierBadge(S.rating, 30)}<b>${Math.round(S.rating)}</b></div></div>
        <div class="stat"><small>Total wins</small><b class="pos">${a.w}</b></div>
        <div class="stat"><small>Total losses</small><b class="neg">${a.l}</b></div>
        <div class="stat"><small>Win rate</small><b>${a.w + a.l ? Math.round(rate * 100) + '%' : '—'}</b></div>
        <div class="stat"><small>Net profit</small><b class="${a.profit >= 0 ? 'pos' : 'neg'}">${fmtS(a.profit)}</b></div>
        <div class="stat"><small>Biggest win</small><b class="pos">${fmt(a.best)}</b></div></div>
      <div class="layout"><div class="card-box"><h3>Your results by game</h3><div style="overflow:auto"><table class="tbl"><tr><th>Game</th><th class="num">Wins</th><th class="num">Losses</th><th class="num">Push</th><th>Win rate</th><th class="num">Net</th><th class="num">Rating</th></tr>
      ${rows.length ? rows.map(({ id, s }) => { const wr = s.w + s.l ? s.w / (s.w + s.l) : 0; return `<tr><td><div class="gname" style="--ac:${ACCENT[id]}">${icon(id, 18)}${games[id].name}</div></td><td class="num pos">${s.w}</td><td class="num neg">${s.l}</td><td class="num">${s.p}</td><td><div class="bar"><i style="width:${Math.round(wr * 100)}%"></i></div></td><td class="num ${s.profit >= 0 ? 'pos' : 'neg'}">${fmtS(s.profit)}</td><td class="num">${Math.round(s.rating)}</td></tr>`; }).join('') : '<tr><td colspan="7" class="muted">Play a game to see stats.</td></tr>'}
      </table></div></div>
      <div class="card-box"><h3>Recent results</h3><div class="feed" style="max-height:360px">${S.history.slice(0, 25).map(h => `<div><b>${games[h.g] ? games[h.g].name : h.g}</b> <span class="${h.profit > 0 ? 'pos' : h.profit < 0 ? 'neg' : ''}">${h.profit > 0 ? 'Win' : h.profit < 0 ? 'Loss' : 'Push'} ${fmtS(h.profit)}</span> <span class="muted">${ago(h.t)}</span></div>`).join('') || '<span class="muted">Nothing yet.</span>'}</div></div></div>
      <p style="margin-top:18px"><button class="btn sec small" id="reset">Reset all stats &amp; balance</button></p>`;
      const drawBoard = () => {
        const onl = typeof MP !== 'undefined' && MP.online(), b = onl ? MP.state().board : [];
        root.querySelector('#board').innerHTML = onl ?
          `<table class="tbl"><tr><th>#</th><th>Player</th><th class="num">Rating</th><th class="num">Wins</th><th class="num">Losses</th><th class="num">Net</th></tr>${b.map((p, i) => `<tr class="${p.name === S.name ? 'me' : ''}"><td class="rank r${i + 1}">${i < 3 ? icon('medal', 18) : i + 1}</td><td><div class="who">${avatar(p, 30)}${plink(p.name)}${p.bot ? '<em class="bot">BOT</em>' : ''}${tierBadge(p.rating, 18)}${tierTag(p.rating)}</div></td><td class="num">${Math.round(p.rating)}</td><td class="num pos">${p.w}</td><td class="num neg">${p.l}</td><td class="num ${p.profit >= 0 ? 'pos' : 'neg'}">${fmtS(p.profit)}</td></tr>`).join('')}</table>` :
          '<span class="muted">The casino is closed right now. The leaderboard is back when the host opens it.</span>';
      };
      drawBoard();
      const un = typeof MP !== 'undefined' ? MP.on(drawBoard) : null;
      root.querySelector('#reset').onclick = async () => { if (await ask('Erase everything?', 'Reset', 'All stats, rating, collection and balance will be lost.')) { const n = S.name; S = Object.assign(blank(), { name: n }); save(); emit('change'); route(); } };
      return () => un && un();
    }
  });

  return {
    get S() { return S; }, save, register, page, start, route, on, emit, rnd, rint, rnd32, sleep, shuffle, mulberry32, r2, fmt, fmtS, fmtK, esc, sfx, toast, modal, ask, today, ago, uid,
    wager, refund, credit, settle, stat, tierOf, tiers, tierBadge, tierTag, betControl, chipPicker, newShoe, cardEl, flipCard, avatar, avatarUrl, avatarSrc, AV_STYLES, plink, myProfile, newCode,
    icon, head, howModal, fx, ACCENT, CATS, BOOST_NAMES, games: () => games, order: () => order
  };
})();
