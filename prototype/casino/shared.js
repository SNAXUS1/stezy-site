/* Lucky Gambit shared math — loaded by the browser (window.Shared) and by server.js (require).
   Every multiplayer round is driven by integer seeds, so all clients derive identical outcomes. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Shared = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function hash(s) { s = String(s); let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  const rngFor = (seed, salt) => mulberry32(((seed >>> 0) ^ hash(salt)) >>> 0);

  /* ---------- cards ---------- */
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'], SUITS = ['♠', '♥', '♦', '♣'];
  const card = rng => ({ r: RANKS[Math.floor(rng() * 13)], s: SUITS[Math.floor(rng() * 4)] });
  function deck(rng, n = 1) {
    const d = []; for (let k = 0; k < n; k++) for (const s of SUITS) for (const r of RANKS) d.push({ r, s });
    for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
    return d;
  }

  /* ---------- poker evaluation ---------- */
  const VAL = r => r === 'A' ? 14 : r === 'K' ? 13 : r === 'Q' ? 12 : r === 'J' ? 11 : +r;
  const CATS = ['High card', 'Pair', 'Two pair', 'Three of a kind', 'Straight', 'Flush', 'Full house', 'Four of a kind', 'Straight flush'];
  function eval5(v, s) {
    const cnt = {}; v.forEach(x => cnt[x] = (cnt[x] || 0) + 1);
    const groups = Object.keys(cnt).map(Number).sort((a, b) => cnt[b] - cnt[a] || b - a);
    const flush = s.every(x => x === s[0]), uniq = [...new Set(v)].sort((a, b) => b - a);
    let sh = 0; if (uniq.length === 5) { if (uniq[0] - uniq[4] === 4) sh = uniq[0]; else if (uniq[0] === 14 && uniq[1] === 5) sh = 5; }
    const shape = groups.map(x => cnt[x]).join(''); let cat, tb;
    if (sh && flush) { cat = 8; tb = [sh]; } else if (shape === '41') { cat = 7; tb = groups; } else if (shape === '32') { cat = 6; tb = groups; }
    else if (flush) { cat = 5; tb = uniq; } else if (sh) { cat = 4; tb = [sh]; } else if (shape === '311') { cat = 3; tb = groups; }
    else if (shape === '221') { cat = 2; tb = groups; } else if (shape === '2111') { cat = 1; tb = groups; } else { cat = 0; tb = uniq; }
    let sc = cat; for (let i = 0; i < 5; i++) sc = sc * 15 + (tb[i] || 0); return sc;
  }
  const score5 = cards => eval5(cards.map(c => VAL(c.r)), cards.map(c => c.s));
  function best7(cards) {
    const v = cards.map(c => VAL(c.r)), s = cards.map(c => c.s), n = cards.length; let best = -1;
    if (n <= 5) return eval5(v, s);
    const pick = skip => { const vv = [], ss = []; for (let i = 0; i < n; i++) if (!skip.includes(i)) { vv.push(v[i]); ss.push(s[i]); } const sc = eval5(vv, ss); if (sc > best) best = sc; };
    if (n === 6) for (let a = 0; a < 6; a++) pick([a]);
    else for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) pick([a, b]);
    return best;
  }
  const catOf = sc => Math.floor(sc / Math.pow(15, 5));
  const catName = sc => CATS[catOf(sc)];
  function equity(hole, board, opps, trials, rand) {
    const known = new Set([...hole, ...board].map(c => c.r + c.s));
    const rest = deck(rand).filter(c => !known.has(c.r + c.s)); let win = 0;
    for (let t = 0; t < trials; t++) {
      const need = 2 * opps + (5 - board.length);
      for (let i = 0; i < need; i++) { const j = i + Math.floor(rand() * (rest.length - i)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
      const bd = board.concat(rest.slice(2 * opps, 2 * opps + 5 - board.length));
      const mine = best7(hole.concat(bd)); let top = true, ties = 1;
      for (let o = 0; o < opps; o++) { const sc = best7([rest[o * 2], rest[o * 2 + 1]].concat(bd)); if (sc > mine) { top = false; break; } if (sc === mine) ties++; }
      if (top) win += 1 / ties;
    }
    return win / trials;
  }

  /* ---------- poker betting (no-limit, shared by the local engine and the server) ----------
     h.cur = highest street bet, h.minR = minimum raise size, p.sc = what a player put in this street. */
  const PK_MAXR = 4, PK_CAP = 1000;
  function pkStreet(h, unit) { h.unit = unit; h.cur = 0; h.minR = unit; h.raises = 0; h.bet = false; for (const k in h.players) h.players[k].sc = 0; }
  /** returns the chips paid (0 for check/fold), or -1 if the action is not allowed. `amt` = total street bet to raise to */
  function pkApply(h, p, a, amt) {
    const owe = h.cur - p.sc;
    if (a === 'fold') { p.folded = true; p.last = 'Fold'; return 0; }
    if (a === 'check') { if (owe > 0) return -1; p.last = 'Check'; return 0; }
    if (a === 'call') { if (owe <= 0) return -1; p.sc += owe; p.contrib += owe; h.pot += owe; p.last = 'Call'; return owe; }
    if (a === 'bet' || a === 'raise') {
      if (h.raises >= PK_MAXR) return -1;
      const to = Math.round(Math.min(h.unit * PK_CAP, Math.max(h.cur + h.minR, +amt || 0)));
      const pay = to - p.sc; h.minR = Math.max(h.minR, to - h.cur);
      p.last = h.cur ? 'Raise' : 'Bet'; h.cur = to; h.raises++; h.bet = true; p.sc = to; p.contrib += pay; h.pot += pay; return pay;
    }
    return -1;
  }
  /** a simple equity-driven bot: returns [action, amount] */
  function pkBot(h, p, eq, opps, rand) {
    const owe = h.cur - p.sc, size = f => Math.round(h.cur + Math.max(h.minR, (h.pot + owe) * f));
    const canR = h.raises < PK_MAXR;
    if (owe > 0) {
      const thr = Math.max(.15, owe / (h.pot + owe)) + (rand() - .5) * .08;
      if (canR && eq > Math.max(.55, thr + .25) && rand() < .45) return ['raise', size(.5 + rand() * .5)];
      return eq > thr || rand() < .04 ? ['call'] : ['fold'];
    }
    if (eq > Math.min(.62, 1.35 / (opps + 1)) || rand() < .08) return ['bet', size(.35 + rand() * .55)];
    return ['check'];
  }

  /* ---------- round outcomes ---------- */
  const crashPoint = seed => { const u = rngFor(seed, 'crash')(); return Math.min(1000, Math.max(1, Math.floor(97 / (1 - u)) / 100)); };
  const rouletteNumber = seed => Math.floor(rngFor(seed, 'roulette')() * 37);
  function crapsRound(seed) {
    const r = rngFor(seed, 'craps'), rolls = [];
    const roll = () => { const a = 1 + Math.floor(r() * 6), b = 1 + Math.floor(r() * 6); rolls.push([a, b]); return a + b; };
    const first = roll(); let point = 0, res;
    if (first === 7 || first === 11) res = 'pass'; else if (first === 2 || first === 3) res = 'dont'; else if (first === 12) res = 'bar';
    else { point = first; for (;;) { const x = roll(); if (x === point) { res = 'pass'; break; } if (x === 7) { res = 'dont'; break; } if (rolls.length > 30) { res = 'pass'; break; } } }
    return { rolls, point, res, first };
  }
  function baccaratRound(seed) {
    const r = rngFor(seed, 'baccarat'), v = c => (['10', 'J', 'Q', 'K'].includes(c.r) ? 0 : c.r === 'A' ? 1 : +c.r);
    const tot = cs => cs.reduce((a, c) => a + v(c), 0) % 10;
    const P = [card(r), card(r)], B = [card(r), card(r)];
    if (tot(P) < 8 && tot(B) < 8) {
      let p3 = null; if (tot(P) <= 5) { p3 = card(r); P.push(p3); }
      const bt = tot(B), x = p3 ? v(p3) : null;
      const draw = !p3 ? bt <= 5 : bt <= 2 || (bt === 3 && x !== 8) || (bt === 4 && x >= 2 && x <= 7) || (bt === 5 && x >= 4 && x <= 7) || (bt === 6 && (x === 6 || x === 7));
      if (draw) B.push(card(r));
    }
    const pt = tot(P), bt = tot(B);
    return { P, B, pt, bt, w: pt > bt ? 'P' : bt > pt ? 'B' : 'T', ppair: P[0].r === P[1].r, bpair: B[0].r === B[1].r };
  }
  const diceRoll = seed => Math.floor(rngFor(seed, 'dice')() * 10000) / 100;
  function kenoDraw(seed) { const r = rngFor(seed, 'keno'), pool = Array.from({ length: 40 }, (_, i) => i + 1), out = []; for (let i = 0; i < 10; i++) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]); return out; }
  const WHEEL = (() => { const counts = [[1, 25], [2, 15], [5, 7], [10, 4], [20, 2], [40, 1]], all = []; counts.forEach(([v, n]) => { for (let k = 0; k < n; k++) all.push(v); });
    // interleave so equal values are spread around the wheel
    const r = mulberry32(777); for (let k = all.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [all[k], all[j]] = [all[j], all[k]]; } return all; })();
  const wheelIndex = seed => Math.floor(rngFor(seed, 'wheel')() * WHEEL.length);
  function minesBoard(seed, mines) { const r = rngFor(seed, 'mines'), cells = Array.from({ length: 25 }, (_, i) => i); for (let i = 24; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; } return new Set(cells.slice(0, mines)); }
  function minesMult(m, k) { let x = .97; for (let i = 0; i < k; i++) x *= (25 - i) / (25 - m - i); return Math.floor(x * 100) / 100; }

  const TIMING = {
    roulette: { bet: 15000, run: () => 9000 },
    crash: { bet: 9000, run: s => Math.log(crashPoint(s)) / 0.09 * 1000 + 3500 },
    ducks: { bet: 15000, run: () => 16000 }, horses: { bet: 15000, run: () => 16000 }, dogs: { bet: 15000, run: () => 16000 },
    baccarat: { bet: 12000, run: () => 7500 },
    craps: { bet: 12000, run: s => 2500 + crapsRound(s).rolls.length * 1100 },
    plinko: { bet: 9000, run: () => 6000 },
    slots: { bet: 8000, run: () => 4500 },
    blackjack: { bet: 12000, run: () => 24000, act: 16000 },
    dice: { bet: 9000, run: () => 4000 },
    keno: { bet: 14000, run: () => 8500 },
    mines: { bet: 10000, run: () => 24000, act: 20000 },
    hilo: { bet: 10000, run: () => 4000 },
    wheel: { bet: 12000, run: () => 8500 },
    videopoker: { bet: 10000, run: () => 20000, act: 15000 }
  };

  return { mulberry32, hash, rngFor, RANKS, SUITS, card, deck, VAL, eval5, score5, best7, catOf, catName, equity, pkStreet, pkApply, pkBot,
    crashPoint, rouletteNumber, crapsRound, baccaratRound, diceRoll, kenoDraw, WHEEL, wheelIndex, minesBoard, minesMult, TIMING };
});
