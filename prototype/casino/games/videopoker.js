'use strict';
Casino.register({
  id: 'videopoker', name: 'Video Poker', desc: 'Jacks or Better. Hold your best cards and draw once. Royal flush pays 250×.', multi: true, isNew: true,
  mount(root, opts) {
    const C = Casino;
    const PAYS = [['Royal Flush', 250], ['Straight Flush', 50], ['Four of a Kind', 25], ['Full House', 9], ['Flush', 6], ['Straight', 4], ['Three of a Kind', 3], ['Two Pair', 2], ['Jacks or Better', 1]];
    function rank(cards) {
      const sc = Shared.score5(cards), cat = Shared.catOf(sc), top = Math.floor(sc / Math.pow(15, 4)) % 15;
      if (cat === 8) return top === 14 ? 0 : 1;
      return { 7: 2, 6: 3, 5: 4, 4: 5, 3: 6, 2: 7 }[cat] ?? (cat === 1 && top >= 11 ? 8 : -1);
    }
    const payOf = (cards, s) => { const r = rank(cards); return r < 0 ? 0 : s * PAYS[r][1]; };
    const deckOf = (seed, key) => Shared.deck(Shared.rngFor(seed, key + ':vp'));
    function autoHold(h) {
      if (rank(h) >= 0 && rank(h) <= 7) return [0, 1, 2, 3, 4].filter(i => rank(h) <= 5 || h.filter(c => c.r === h[i].r).length > 1);
      const cnt = {}; h.forEach(c => cnt[c.r] = (cnt[c.r] || 0) + 1);
      const pair = h.map((c, i) => cnt[c.r] > 1 ? i : -1).filter(i => i >= 0); if (pair.length) return pair;
      for (const s of Shared.SUITS) { const f = h.map((c, i) => c.s === s ? i : -1).filter(i => i >= 0); if (f.length === 4) return f; }
      return h.map((c, i) => ['J', 'Q', 'K', 'A'].includes(c.r) ? i : -1).filter(i => i >= 0).slice(0, 2);
    }
    const finalHand = (deck, held) => { const h = deck.slice(0, 5); let n = 5; return h.map((c, i) => held.includes(i) ? c : deck[n++]); };
    let pend = null, dead = false, act = null;
    const G = {
      lateMs: 3000,
      myBets: () => pend ? { bets: { s: pend }, stake: pend, label: 'in' } : null,
      onBet() { $('#msg').textContent = 'Join the next deal'; paintPay(-1); },
      onState: () => ui(),
      run(r, my, ctx) {
        return new Promise(res => {
          const deck = deckOf(r.seed, ctx.solo ? 'you' : ctx.key);
          if (!my) { $('#msg').textContent = 'Watching this deal'; setTimeout(() => res(null), 1500); return; }
          const hand = deck.slice(0, 5), held = new Set();
          renderHand(hand, held, true); paintPay(rank(hand)); $('#msg').textContent = 'Click cards to hold, then Draw';
          act = { hand, held, deck, done: false, finish: () => {
            if (act.done) return; act.done = true; clearInterval(act.timer);
            const fin = finalHand(deck, [...held]); renderHand(fin, new Set(), true, held); const rk = rank(fin), ret = payOf(fin, my.stake); paintPay(rk);
            $('#msg').textContent = rk >= 0 ? `${PAYS[rk][0]}! ${C.fmt(ret)}` : 'No win';
            act = null; ui(); res({ wagered: my.stake, returned: ret, p: .45 });
          } };
          if (!ctx.solo) act.timer = setInterval(() => { if (!act) return; const left = ctx.deadline - ctx.now(); $('#msg').textContent = `Hold & draw · ${Math.max(0, Math.ceil(left / 1000))}s`; if (left <= 300) { if (!held.size) autoHold(hand).forEach(i => held.add(i)); act.finish(); } }, 250);
          ui();
        });
      },
      resolve(r, b, key) { const d = deckOf(r.seed, key); return payOf(finalHand(d, autoHold(d.slice(0, 5))), b.s); },
      botBets(rng) { const s = T.botStake(rng); return { bets: { s }, stake: s, label: 'in' }; },
      clear() { pend = null; ui(); }
    };
    /** best hold for a known deck: the draws are fixed by the seed, so try all 32 hold patterns */
    const bestHold = deck => { let best = [0, -1, []]; for (let m = 0; m < 32; m++) { const held = [0, 1, 2, 3, 4].filter(i => m >> i & 1), p = payOf(finalHand(deck, held), 1); if (p > best[1]) best = [m, p, held]; } return best; };
    let xrKey = '';
    G.xray = nx => {
      const out = [];
      if (act && !act.done) {
        const [m, p, held] = bestHold(act.deck), fin = finalHand(act.deck, held);
        if (xrKey !== 'a' + m) { xrKey = 'a' + m; T.main.querySelectorAll('.vpcard').forEach(c => c.classList.toggle('xr', held.includes(+c.dataset.i))); }
        out.push(Table.xl('Best hold', held.length ? 'hold ' + held.map(i => i + 1).join(', ') : 'hold nothing', p ? `→ ${PAYS[rank(fin)][0]} (${p}×) · ${fin.map(Table.xc).join(' ')}` : 'no winning draw this time'));
      } else if (xrKey) { xrKey = ''; T.main.querySelectorAll('.vpcard.xr').forEach(c => c.classList.remove('xr')); }
      if (nx) { const d = deckOf(nx.seed, 'you'), [, p, held] = bestHold(d); out.push(Table.xl('Next deal', p ? `${PAYS[rank(finalHand(d, held))][0]} possible (${p}×)` : 'a losing deal', `cards ${d.slice(0, 5).map(Table.xc).join(' ')} · draws ${d.slice(5, 10).map(Table.xc).join(' ')}`)); }
      return out.join('') || null;
    };
    G.xrayOff = () => { xrKey = ''; T.main.querySelectorAll('.vpcard.xr').forEach(c => c.classList.remove('xr')); };
    const T = Table.attach(root, this, opts, G), $ = s => T.main.querySelector(s);
    T.main.innerHTML = `<div class="table vpbox"><div class="vppay" id="pay">${PAYS.map((p, i) => `<div data-r="${i}"><span>${p[0]}</span><b>${p[1]}×</b></div>`).join('')}</div>
        <div class="vphand" id="hand">${Array.from({ length: 5 }, () => '<div class="vpcard"><div class="card big down noanim"></div><span class="held">HOLD</span></div>').join('')}</div>
        <div class="msg" id="msg">Press Deal to start</div><div class="t-status pill-status"></div></div>
      <div class="controls"><div id="bet"></div><div class="btnrow"><button class="btn big gold" id="go">Deal</button></div></div>`;
    const bet = C.betControl($('#bet'), 'videopoker');
    function renderHand(h, held, faceUp, wasHeld) {
      $('#hand').innerHTML = h.map((c, i) => `<div class="vpcard ${held.has(i) ? 'on' : ''}" data-i="${i}">${C.cardEl(c, !faceUp, 'big' + (wasHeld && wasHeld.has(i) ? ' noanim' : '')).outerHTML}<span class="held">HOLD</span></div>`).join('');
    }
    const paintPay = rk => root.querySelectorAll('#pay div').forEach(d => d.classList.toggle('on', +d.dataset.r === rk));
    function ui() {
      const b = $('#go'); if (!b) return;
      if (act) { b.textContent = 'Draw'; b.className = 'btn big'; b.disabled = false; bet.lock(true); return; }
      b.className = 'btn big gold';
      if (!T.multi) { b.textContent = 'Deal'; b.disabled = T.busy; bet.lock(T.busy); return; }
      if (T.canBet()) { b.textContent = pend ? 'Cancel' : 'Join deal'; b.className = 'btn big ' + (pend ? 'sec' : 'gold'); b.disabled = false; } else { b.textContent = T.busy ? 'Hand in play' : 'Waiting…'; b.disabled = true; }
      bet.lock(!!pend);
    }
    $('#hand').onclick = e => { const c = e.target.closest('.vpcard'); if (!c || !act || act.done) return; const i = +c.dataset.i; if (act.held.has(i)) act.held.delete(i); else act.held.add(i); c.classList.toggle('on'); C.sfx('click'); };
    $('#go').onclick = () => {
      if (act) return act.finish();
      if (T.multi) { if (!T.canBet()) return; if (pend) { C.refund(pend); pend = null; } else { const s = bet.get(); if (!C.wager(s)) return; pend = s; } T.changed(); ui(); return; }
      if (T.busy) return; const s = bet.get(); if (!C.wager(s)) return; pend = s; T.playSolo();
    };
    T.start(); ui();
    return () => { dead = true; if (act) { clearInterval(act.timer); } T.cleanup(); };
  }
});
