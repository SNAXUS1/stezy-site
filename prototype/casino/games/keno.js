'use strict';
Casino.register({
  id: 'keno', name: 'Keno', desc: 'Pick up to 10 of 40 numbers. 10 balls are drawn — the more you hit, the more you win.', multi: true, isNew: true,
  mount(root, opts) {
    const C = Casino;
    const comb = (n, k) => { if (k < 0 || k > n) return 0; let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return r; };
    const TABLE = {};
    for (let k = 1; k <= 10; k++) {
      const P = Array.from({ length: k + 1 }, (_, h) => comb(k, h) * comb(40 - k, 10 - h) / comb(40, 10)), minHit = Math.max(1, Math.round(k * .4));
      const raw = P.map((_, h) => h >= minHit ? Math.pow(h - minHit + 1, 2.4) : 0), scale = .95 / raw.reduce((a, x, h) => a + x * P[h], 0);
      TABLE[k] = { m: raw.map(x => Math.round(x * scale * 100) / 100), P };
    }
    const payout = (b, drawn) => { const hits = b.picks.filter(n => drawn.includes(n)).length; return b.s * TABLE[b.picks.length].m[hits]; };
    let picks = [], pend = null, dead = false, drawing = false;
    const G = {
      myBets: () => pend ? { bets: pend, stake: pend.s, label: `${pend.picks.length} picks` } : null,
      onBet() { clearDraw(); $('#msg').textContent = 'Pick your numbers and join the draw'; },
      onState: () => ui(),
      async run(r, my) {
        const drawn = Shared.kenoDraw(r.seed), mine = my ? my.bets.picks : picks; drawing = true; clearDraw();
        let hits = 0;
        for (const n of drawn) {
          if (dead) return null; await C.sleep(480);
          const el = cell(n); el.classList.add('drawn'); if (mine.includes(n)) { el.classList.add('hit'); hits++; C.sfx('win'); } else C.sfx('tick');
          $('#hits').textContent = `${hits} hit${hits === 1 ? '' : 's'}`;
        }
        drawing = false; if (dead || !my) { if (!my) $('#msg').textContent = 'Draw complete'; return null; }
        const ret = C.r2(payout(my.bets, drawn));
        $('#msg').textContent = ret > 0 ? `${hits} hits — you win ${C.fmt(ret)}!` : `${hits} hit${hits === 1 ? '' : 's'} — no win`;
        return { wagered: my.stake, returned: ret, p: TABLE[my.bets.picks.length].P.reduce((a, p, h) => a + (TABLE[my.bets.picks.length].m[h] > 1 ? p : 0), 0) };
      },
      resolve: (r, b) => payout(b, Shared.kenoDraw(r.seed)),
      botBets(rng) { const k = 3 + Math.floor(rng() * 6), pool = Array.from({ length: 40 }, (_, i) => i + 1), p = []; for (let i = 0; i < k; i++) p.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]); const s = T.botStake(rng); return { bets: { s, picks: p }, stake: s, label: `${k} picks` }; },
      clear() { pend = null; ui(); }
    };
    const XR = (nx, cr, fn) => [cr && cr.seed && fn(cr, 'This round'), nx && fn(nx, 'Next round')].filter(Boolean).join('');
    let xrKey = '';
    G.xray = (nx, cr) => {
      const r = nx || cr; if (!r) return null; const drawn = Shared.kenoDraw(r.seed), key = drawn.join();
      if (key !== xrKey) { xrKey = key; T.main.querySelectorAll('.kc').forEach(c => c.classList.toggle('xr', drawn.includes(+c.dataset.n))); }
      return XR(nx, cr, (q, l) => { const d = Shared.kenoDraw(q.seed), hits = picks.filter(n => d.includes(n)).length; return Table.xl(l, `${hits} of ${picks.length} picks hit`, 'draws ' + d.slice().sort((a, b) => a - b).join(' · ')); }) + '<div class="xnote">Glowing numbers on the board get drawn next.</div>';
    };
    G.xrayOff = () => { xrKey = ''; T.main.querySelectorAll('.kc.xr').forEach(c => c.classList.remove('xr')); };
    const T = Table.attach(root, this, opts, G), $ = s => T.main.querySelector(s);
    T.main.innerHTML = `<div class="table kenobox"><div class="kgrid">${Array.from({ length: 40 }, (_, i) => `<button class="kc" data-n="${i + 1}">${i + 1}</button>`).join('')}</div>
        <div class="kinfo"><div class="msg" id="msg">Pick up to 10 numbers</div><div class="t-status pill-status"></div><div class="khits" id="hits"></div></div></div>
      <div class="controls"><div id="bet"></div><div class="btnrow"><button class="btn sec" id="auto">Random</button><button class="btn sec" id="clr">Clear</button><button class="btn big gold" id="go">Play</button></div></div>
      <div class="sidebox" style="margin-top:14px"><h3>Payouts for <span id="pk">0</span> picks</h3><div class="kpay" id="pay"></div></div>`;
    const bet = C.betControl($('#bet'), 'keno'), cell = n => T.main.querySelector(`.kc[data-n="${n}"]`);
    const clearDraw = () => { T.main.querySelectorAll('.kc').forEach(c => c.classList.remove('drawn', 'hit')); $('#hits').textContent = ''; };
    function paint() {
      T.main.querySelectorAll('.kc').forEach(c => c.classList.toggle('pick', picks.includes(+c.dataset.n)));
      $('#pk').textContent = picks.length;
      $('#pay').innerHTML = picks.length ? TABLE[picks.length].m.map((m, h) => m ? `<div class="${m >= 1 ? 'good' : ''}"><small>${h} hit${h === 1 ? '' : 's'}</small><b>${m}×</b></div>` : '').join('') : '<span class="muted">Pick numbers to see the paytable.</span>';
    }
    function ui() {
      const b = $('#go'); if (!b) return; const locked = !!pend || T.busy || drawing;
      ['#auto', '#clr'].forEach(s => $(s).disabled = locked);
      if (!T.multi) { b.textContent = 'Play'; b.disabled = T.busy; bet.lock(T.busy); return; }
      if (T.canBet()) { b.textContent = pend ? 'Cancel' : 'Join draw'; b.className = 'btn big ' + (pend ? 'sec' : 'gold'); b.disabled = false; } else { b.textContent = T.busy ? 'Drawing…' : 'Waiting…'; b.disabled = true; }
      bet.lock(!!pend);
    }
    $('.kgrid').onclick = e => {
      const c = e.target.closest('.kc'); if (!c || pend || T.busy || drawing) return; const n = +c.dataset.n;
      if (picks.includes(n)) picks = picks.filter(x => x !== n); else if (picks.length < 10) picks.push(n); else return C.toast('Maximum 10 picks');
      C.sfx('click'); clearDraw(); paint();
    };
    $('#auto').onclick = () => { const pool = Array.from({ length: 40 }, (_, i) => i + 1), k = picks.length || 6; picks = []; for (let i = 0; i < k; i++) picks.push(pool.splice(C.rint(pool.length), 1)[0]); clearDraw(); paint(); };
    $('#clr').onclick = () => { picks = []; clearDraw(); paint(); };
    $('#go').onclick = () => {
      if (!picks.length && !pend) return C.toast('Pick at least one number');
      if (T.multi) { if (!T.canBet()) return; if (pend) { C.refund(pend.s); pend = null; } else { const s = bet.get(); if (!C.wager(s)) return; pend = { s, picks: picks.slice() }; } T.changed(); ui(); return; }
      if (T.busy) return; const s = bet.get(); if (!C.wager(s)) return; pend = { s, picks: picks.slice() }; T.playSolo();
    };
    paint(); T.start(); ui();
    return () => { dead = true; T.cleanup(); };
  }
});
