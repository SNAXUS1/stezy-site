'use strict';
Casino.register({
  id: 'hilo', name: 'Hi-Lo', desc: 'Will the next card be higher, lower or the same? Odds shift with every card.', multi: true, isNew: true,
  mount(root, opts) {
    const C = Casino;
    const rv = c => Shared.RANKS.indexOf(c.r) + 1, red = c => c.s === '♥' || c.s === '♦';
    const baseOf = r => r.base || Shared.card(Shared.rngFor(r.betSeed, 'hilo'));
    const nextOf = r => Shared.card(Shared.rngFor(r.seed, 'hilo'));
    const odds = b => { const v = rv(b); return { hi: (13 - v) / 13, lo: (v - 1) / 13, same: 1 / 13, red: .5, black: .5 }; };
    const mult = (k, base) => { const p = odds(base)[k]; return p ? Math.floor(.97 / p * 100) / 100 : 0; };
    const win = (k, b, n) => k === 'hi' ? rv(n) > rv(b) : k === 'lo' ? rv(n) < rv(b) : k === 'same' ? rv(n) === rv(b) : k === 'red' ? red(n) : !red(n);
    const NAMES = { hi: 'Higher', lo: 'Lower', same: 'Same', red: 'Red', black: 'Black' };
    const payout = (b, base, n) => Object.keys(b).reduce((a, k) => a + (win(k, base, n) ? b[k] * mult(k, base) : 0), 0);
    let bets = {}, last = null, base = null, dead = false, flipping = false;
    const trail = [], total = () => Object.values(bets).reduce((a, b) => a + b, 0);
    const label = b => Object.keys(b).map(k => NAMES[k]).join(', ');
    const G = {
      myBets: () => total() ? { bets: Object.assign({}, bets), stake: total(), label: label(bets) } : null,
      onBet(r) { setBase(baseOf(r)); $('#next').innerHTML = '<div class="card big down noanim"></div>'; $('#msg').textContent = 'Higher or lower?'; },
      onState() { $('#go').hidden = T.multi; $('#go').disabled = T.busy; },
      async run(r, my) {
        const b = baseOf(r), n = nextOf(r); flipping = true;
        if (!base || base.r !== b.r || base.s !== b.s) setBase(b);
        $('#next').innerHTML = '<div class="card big down"></div>'; await C.sleep(700); if (dead) return null;
        $('#next').innerHTML = ''; $('#next').append(C.cardEl(n, false, 'big')); C.sfx('click'); flipping = false;
        trail.unshift(n); if (trail.length > 12) trail.pop();
        $('#trail').innerHTML = ''; trail.forEach(c => $('#trail').append(C.cardEl(c, false, 'sm noanim')));
        root.querySelectorAll('.spot').forEach(s => s.classList.toggle('win', win(s.dataset.k, b, n)));
        if (!T.multi) setTimeout(() => { if (!dead && !T.busy) { setBase(n); $('#next').innerHTML = '<div class="card big down noanim"></div>'; root.querySelectorAll('.spot').forEach(s => s.classList.remove('win')); } }, 1400);
        if (!my) { $('#msg').textContent = `${n.r}${n.s}`; return null; }
        last = my.bets;
        const ret = C.r2(payout(my.bets, b, n)), p = Object.keys(my.bets).reduce((a, k) => a + my.bets[k] * odds(b)[k], 0) / my.stake;
        $('#msg').textContent = ret > my.stake ? `${n.r}${n.s} — you win ${C.fmt(ret - my.stake)}!` : `${n.r}${n.s} — ${ret ? 'partial win' : 'no luck'}`;
        return { wagered: my.stake, returned: ret, p };
      },
      resolve: (r, b) => payout(b, baseOf(r), nextOf(r)),
      botBets(rng, s, r) { const b0 = baseOf(r), v = rv(b0), k = v <= 5 ? 'hi' : v >= 9 ? 'lo' : rng() < .5 ? 'red' : 'black', st = T.botStake(rng); return { bets: { [k]: st }, stake: st, label: NAMES[k] }; },
      clear() { bets = {}; paint(); }
    };
    const XR = (nx, cr, fn) => [cr && cr.seed && fn(cr, 'This round'), nx && fn(nx, 'Next round')].filter(Boolean).join('');
    G.xray = (nx, cr) => XR(nx, cr, (r, l) => { const b = r.base || (r.betSeed && T.multi ? baseOf(r) : base), n = nextOf(r); return Table.xl(l, `next card ${Table.xc(n)}`, b ? (rv(n) > rv(b) ? 'Higher' : rv(n) < rv(b) ? 'Lower' : 'Same') + ' · ' + (red(n) ? 'Red' : 'Black') : ''); });
    const T = Table.attach(root, this, opts, G), $ = s => T.main.querySelector(s);
    T.main.innerHTML = `<div class="table felt"><div class="hilo-cards"><div><div class="label">Current</div><div id="base"></div></div><div class="hilo-vs">${C.icon('hilo', 34)}</div><div><div class="label">Next</div><div id="next"><div class="card big down noanim"></div></div></div></div>
        <div class="msg" id="msg">Higher or lower?</div><div class="t-status pill-status"></div>
        <div class="spots">${Object.keys(NAMES).map(k => `<button class="spot" data-k="${k}">${NAMES[k]}<small id="m-${k}"></small><span class="amt"></span></button>`).join('')}</div></div>
      <div class="controls"><div id="chips"></div><div>Total bet <b id="tot" class="gold-num">$0</b></div><div class="btnrow"><button class="btn sec" id="clear">Clear</button><button class="btn sec" id="rebet">Rebet</button><button class="btn big" id="go">Reveal</button></div></div>
      <div class="sidebox" style="margin-top:14px"><h3>Card trail</h3><div class="hand" id="trail" style="min-height:76px"></div></div>`;
    const picker = C.chipPicker($('#chips'), 5);
    function setBase(c) {
      base = c; $('#base').innerHTML = ''; $('#base').append(C.cardEl(c, false, 'big'));
      for (const k of Object.keys(NAMES)) { const m = mult(k, c), el = root.querySelector(`.spot[data-k="${k}"]`); $('#m-' + k).textContent = m ? `pays ${m}×` : 'not possible'; el.disabled = !m; }
      for (const k of Object.keys(bets)) if (!mult(k, c)) { C.refund(bets[k]); delete bets[k]; }
      paint();
    }
    function paint() { root.querySelectorAll('.spot').forEach(s => s.querySelector('.amt').textContent = bets[s.dataset.k] ? C.fmt(bets[s.dataset.k]) : ''); $('#tot').textContent = C.fmt(total()); }
    const canBet = () => !flipping && T.canBet();
    root.querySelectorAll('.spot').forEach(b => b.onclick = () => { if (!canBet() || b.disabled) return T.multi && C.toast('Betting is closed'); const v = picker.get(); if (!C.wager(v)) return; bets[b.dataset.k] = (bets[b.dataset.k] || 0) + v; paint(); C.sfx('click'); T.changed(); });
    $('#clear').onclick = () => { if (!canBet()) return; C.refund(total()); bets = {}; paint(); T.changed(); };
    $('#rebet').onclick = () => { if (!canBet() || !last) return; C.refund(total()); bets = {}; const ok = Object.keys(last).filter(k => mult(k, base)), need = ok.reduce((a, k) => a + last[k], 0); if (need && C.wager(need)) ok.forEach(k => bets[k] = last[k]); paint(); T.changed(); };
    $('#go').onclick = () => { if (!total()) return C.toast('Place a bet first'); T.playSolo({ base }); };
    if (!T.multi) setBase(Shared.card(C.rnd));
    T.start();
    return () => { dead = true; T.cleanup(); };
  }
});
