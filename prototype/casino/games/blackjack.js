'use strict';
/* Shared-dealer blackjack: the dealer's hand comes from the round seed, each seat draws from its own seeded shoe,
   so everyone at the table plays at the same time against the same dealer. */
Casino.register({
  id: 'blackjack', name: 'Blackjack', desc: 'Shared dealer, everyone plays at once. Blackjack pays 3:2. Split & double.', multi: true,
  mount(root, opts) {
    const C = Casino, ACT = Shared.TIMING.blackjack.act;
    const cv = c => c.r === 'A' ? 11 : ['J', 'Q', 'K'].includes(c.r) ? 10 : +c.r;
    const val = cs => { let t = 0, a = 0; for (const c of cs) { t += cv(c); if (c.r === 'A') a++; } while (t > 21 && a) { t -= 10; a--; } return t; };
    const soft = cs => { let t = 0, a = 0; for (const c of cs) { t += cv(c); if (c.r === 'A') a++; } while (t > 21 && a) { t -= 10; a--; } return a > 0; };
    const natural = cs => cs.length === 2 && val(cs) === 21;
    function dealerHand(seed) { const r = Shared.rngFor(seed, 'dealer'), h = [Shared.card(r), Shared.card(r)]; while (val(h) < 17) h.push(Shared.card(r)); return h; }
    const shoe = (seed, key) => { const r = Shared.rngFor(seed, key + ':bj'), buf = [], d = () => buf.length ? buf.shift() : Shared.card(r); d.peek = () => (buf.length || buf.push(Shared.card(r)), buf[0]); return d; };
    function basic(h, up) { const v = val(h), u = cv(up) === 11 ? 11 : cv(up); if (soft(h)) return v < 18 || (v === 18 && u >= 9); if (v <= 11) return true; if (v === 12) return u < 4 || u > 6; if (v <= 16) return u >= 7; return false; }
    function settleHand(h, d, stake, split) {
      const p = val(h), dv = val(d);
      if (p > 21) return 0;
      if (natural(h) && !split) return natural(d) ? stake : stake * 2.5;
      if (natural(d)) return 0;
      if (dv > 21 || p > dv) return stake * 2;
      return p === dv ? stake : 0;
    }
    let pend = null, dead = false, act = null, holeEl = null, xr = null;
    const G = {
      lateMs: 3000,
      myBets: () => pend ? { bets: { s: pend }, stake: pend, label: 'in' } : null,
      onBet() { $('#dh').innerHTML = ''; $('#hands').innerHTML = ''; $('#dv').textContent = ''; $('#msg').textContent = 'Place your bet for the next hand'; },
      onState: () => ui(),
      async run(r, my, ctx) {
        const D = dealerHand(r.seed), draw = shoe(r.seed, ctx.solo ? 'you' : ctx.key); xr = { D, draw, live: true };
        $('#dh').innerHTML = ''; $('#hands').innerHTML = ''; $('#msg').textContent = ''; $('#dv').textContent = '';
        const add = (el, c, down) => { const e = C.cardEl(c, down); el.append(e); C.sfx('click'); return e; };
        add($('#dh'), D[0]); await C.sleep(260); holeEl = add($('#dh'), D[1], true); $('#dv').textContent = `(${val([D[0]])})`;
        let hands = [], wagered = 0;
        if (my) {
          wagered = my.stake; hands = [{ cards: [draw(), draw()], stake: my.stake, done: false, split: false }];
          renderHands(hands); await C.sleep(400);
          const dealerBJ = natural(D);
          if (natural(hands[0].cards) || (dealerBJ && (cv(D[0]) >= 10))) hands[0].done = true;
          // player actions
          for (let hi = 0; hi < hands.length; hi++) {
            const h = hands[hi];
            while (!h.done && !dead) {
              if (val(h.cards) >= 21) { h.done = true; break; }
              renderHands(hands, hi);
              const canSplit = hands.length === 1 && h.cards.length === 2 && cv(h.cards[0]) === cv(h.cards[1]) && C.S.balance >= h.stake;
              const a = await choose(h.cards.length === 2 && C.S.balance >= h.stake, canSplit, ctx.deadline, ctx.now);
              if (a === 'hit') { h.cards.push(draw()); C.sfx('click'); }
              else if (a === 'double' && C.wager(h.stake)) { wagered += h.stake; h.stake *= 2; h.cards.push(draw()); h.done = true; }
              else if (a === 'split' && C.wager(h.stake)) {
                wagered += h.stake; const c2 = h.cards.pop(); h.cards.push(draw()); h.split = true;
                hands.push({ cards: [c2, draw()], stake: h.stake, done: false, split: true });
                if (h.cards[0].r === 'A') { h.done = true; hands[1].done = true; }
              } else h.done = true;
              renderHands(hands, hi);
            }
          }
          renderHands(hands, -1);
        }
        if (dead) return null;
        // wait for the rest of the table, then reveal
        if (!ctx.solo) { $('#msg').textContent = 'Waiting for other players…'; while (ctx.now() < r.start + ACT && !dead) await C.sleep(200); }
        if (dead) return null;
        xr = null; C.flipCard(holeEl, D[1]); $('#dv').textContent = `(${val(D.slice(0, 2))})`; await C.sleep(500);
        const allBust = hands.length && hands.every(h => val(h.cards) > 21);
        for (let i = 2; i < D.length && !allBust; i++) { add($('#dh'), D[i]); $('#dv').textContent = `(${val(D.slice(0, i + 1))})`; await C.sleep(550); }
        if (dead) return null;
        if (!my) { $('#msg').textContent = `Dealer ${val(D) > 21 ? 'busts' : 'has ' + val(D)}`; return null; }
        const ret = hands.reduce((a, h) => a + settleHand(h.cards, D, h.stake, h.split), 0);
        $('#msg').textContent = ret > wagered ? `You win ${C.fmt(ret - wagered)}!` : ret === wagered ? 'Push' : val(D) > 21 ? 'Dealer busts but…' : `Dealer ${val(D)} — you lose`;
        renderHands(hands, -1, D);
        return { wagered, returned: ret, p: .45 };
      },
      resolve(r, b, key) { const D = dealerHand(r.seed), draw = shoe(r.seed, key), h = [draw(), draw()]; if (!natural(D)) while (basic(h, D[0])) h.push(draw()); return settleHand(h, D, b.s, false); },
      botBets(rng) { const s = T.botStake(rng); return { bets: { s }, stake: s, label: 'in' }; },
      clear() { pend = null; ui(); }
    };
    function choose(canDouble, canSplit, deadline, now) {
      return new Promise(res => {
        act = { res, canDouble, canSplit, deadline }; ui();
        if (deadline !== Infinity) { const t = setInterval(() => { if (!act || act.res !== res) return clearInterval(t); if (now() >= deadline - 300 || dead) { clearInterval(t); act = null; ui(); res('stand'); } }, 200); }
      });
    }
    function renderHands(hands, cur = -1, D) {
      $('#hands').innerHTML = hands.map((h, i) => `<div class="bj-hand ${i === cur ? 'cur' : ''}"><div class="label">${hands.length > 1 ? `Hand ${i + 1}` : 'You'} <span>(${val(h.cards)}${soft(h.cards) && val(h.cards) < 21 ? ' soft' : ''})</span> <em class="tier">${C.fmt(h.stake)}</em>${D ? `<em class="res ${settleHand(h.cards, D, h.stake, h.split) > h.stake ? 'pos' : settleHand(h.cards, D, h.stake, h.split) < h.stake ? 'neg' : ''}">${settleHand(h.cards, D, h.stake, h.split) > h.stake ? 'WIN' : settleHand(h.cards, D, h.stake, h.split) < h.stake ? (val(h.cards) > 21 ? 'BUST' : 'LOSE') : 'PUSH'}</em>` : ''}</div><div class="hand"></div></div>`).join('');
      [...$('#hands').querySelectorAll('.hand')].forEach((el, i) => hands[i].cards.forEach(c => el.append(C.cardEl(c, false, 'noanim'))));
    }
    G.xray = nx => {
      const out = [];
      if (xr && xr.live) out.push(Table.xl('This hand', `dealer ${val(xr.D) > 21 ? 'busts' : 'ends on ' + val(xr.D)}`, `hole card ${Table.xc(xr.D[1])} · your next card ${Table.xc(xr.draw.peek())}`));
      if (nx) { const D = dealerHand(nx.seed), d = shoe(nx.seed, 'you'), mine = [d(), d()], more = [d(), d(), d()]; out.push(Table.xl('Next hand', `dealer ${val(D) > 21 ? 'busts' : val(D)}`, `dealer ${D.map(Table.xc).join(' ')} · you get ${mine.map(Table.xc).join(' ')} (${val(mine)}) then ${more.map(Table.xc).join(' ')}`)); }
      return out.join('') || null;
    };
    const T = Table.attach(root, this, opts, G), $ = s => T.main.querySelector(s);
    T.main.innerHTML = `<div class="table felt bjtable"><div class="hand-area"><div class="label">Dealer <span id="dv"></span></div><div class="hand" id="dh"></div></div>
        <div class="bj-rule">Blackjack pays 3 to 2 · Dealer stands on 17</div><div id="hands" class="bj-hands"></div><div class="msg" id="msg"></div><div class="t-status pill-status"></div></div>
      <div class="controls"><div id="bet"></div><div class="btnrow"><button class="btn big" id="deal">Deal</button><button class="btn blue" id="hit">Hit</button><button class="btn red" id="stand">Stand</button><button class="btn gold" id="dbl">Double</button><button class="btn sec" id="split">Split</button></div></div>`;
    const bet = C.betControl($('#bet'), 'blackjack');
    function ui() {
      const deal = $('#deal'); if (!deal) return;
      const playing = !!act;
      ['#hit', '#stand'].forEach(s => $(s).disabled = !playing);
      $('#dbl').disabled = !(playing && act.canDouble); $('#split').disabled = !(playing && act.canSplit);
      if (!T.multi) { deal.textContent = 'Deal'; deal.disabled = T.busy; bet.lock(T.busy); return; }
      if (T.canBet()) { deal.textContent = pend ? 'Leave hand' : 'Join hand'; deal.className = 'btn big ' + (pend ? 'sec' : ''); deal.disabled = false; }
      else { deal.textContent = T.busy ? 'Hand in play' : 'Waiting…'; deal.disabled = true; }
      bet.lock(!!pend || T.busy);
    }
    const pick = a => () => { if (!act) return; const r = act.res; act = null; ui(); r(a); };
    $('#hit').onclick = pick('hit'); $('#stand').onclick = pick('stand'); $('#dbl').onclick = pick('double'); $('#split').onclick = pick('split');
    $('#deal').onclick = () => {
      if (T.multi) { if (!T.canBet()) return; if (pend) { C.refund(pend); pend = null; } else { const s = bet.get(); if (!C.wager(s)) return; pend = s; } T.changed(); ui(); return; }
      if (T.busy) return; const s = bet.get(); if (!C.wager(s)) return; pend = s; T.playSolo();
    };
    T.start(); ui();
    return () => { dead = true; if (act) { const r = act.res; act = null; r('stand'); } T.cleanup(); };
  }
});
