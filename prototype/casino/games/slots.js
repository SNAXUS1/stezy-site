'use strict';
const SlotsMath = (() => {
  const SYMS = ['🍒', '🍋', '🔔', '🍇', '💎', '7️⃣', '⭐', '🎁'], WILD = 6, SCAT = 7;
  const WEIGHTS = [9, 8, 7, 6, 4, 3, 2, 1.6];
  const PAY = [[0, 0, 0, 4, 11, 35], [0, 0, 0, 6, 17, 55], [0, 0, 0, 11, 26, 88], [0, 0, 0, 18, 44, 175], [0, 0, 0, 33, 88, 440], [0, 0, 0, 66, 220, 1000]];
  const SCATTER = { 3: 5, 4: 20, 5: 100 };
  const LINES = [[1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2]];
  function pick(rand, reel) {
    const w = WEIGHTS.map((x, i) => (i === WILD && (reel === 0 || reel === 4)) ? 0 : x);
    let r = rand() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < w.length; i++) { r -= w[i]; if (r < 0) return i; }
    return 0;
  }
  const spinGrid = rand => Array.from({ length: 5 }, (_, reel) => Array.from({ length: 3 }, () => pick(rand, reel)));
  /** returns payout as a multiple of the TOTAL bet */
  function evalGrid(g) {
    let units = 0; const wins = [];
    LINES.forEach((line, li) => {
      const syms = line.map((row, reel) => g[reel][row]), s = syms[0];
      if (s === SCAT) return;
      let count = 1; while (count < 5 && (syms[count] === s || syms[count] === WILD)) count++;
      const pay = PAY[s][count]; if (pay) { units += pay / 5; wins.push({ line: li, sym: s, count, pay }); }
    });
    const sc = g.flat().filter(x => x === SCAT).length, scat = SCATTER[Math.min(5, sc)] || 0;
    if (scat) units += scat;
    return { units, wins, scat, sc };
  }
  /** symbol artwork: icon tiles instead of emoji */
  const ART = [['cherries', '#ef4444'], ['orange-slice', '#f59e0b'], ['bell', '#facc15'], ['clover', '#22c55e'], ['diamond', '#38bdf8'], [null, '#f43f5e'], ['star', '#f5c451'], ['gift', '#a78bfa']];
  const symHTML = i => `<span class="sy s${i}" style="--sc:${ART[i][1]}">${ART[i][0] ? Casino.icon(ART[i][0], 46) : '<b class="seven">7</b>'}${i === WILD ? '<em>WILD</em>' : ''}</span>`;
  return { SYMS, PAY, LINES, SCATTER, spinGrid, evalGrid, WILD, SCAT, symHTML };
})();

Casino.register({
  id: 'slots', name: 'Slots', desc: '5 reels, 5 paylines, wild stars, gift scatters and a 1000× jackpot.', multi: true,
  mount(root, opts) {
    const C = Casino, M = SlotsMath;
    let pend = null, dead = false, autoLeft = 0;
    const gridOf = (seed, key) => M.spinGrid(Shared.rngFor(seed, key + ':slots'));
    const G = {
      myBets: () => pend ? { bets: { s: pend }, stake: pend, label: 'spin' } : null,
      onBet() { $('#msg').textContent = 'Join the next spin'; },
      onState: () => ui(),
      async run(r, my, ctx) {
        const grid = gridOf(r.seed, ctx.solo ? 'you' : ctx.key);
        root.querySelectorAll('.sym').forEach(s => s.classList.remove('hit')); $('#msg').textContent = '';
        const stopAt = [700, 950, 1200, 1450, 1700], t0 = performance.now(), done = [0, 0, 0, 0, 0];
        await new Promise(res => {
          const tick = () => {
            if (dead) return res(); const t = performance.now() - t0; let all = true;
            for (let rr = 0; rr < 5; rr++) {
              if (t >= stopAt[rr]) { if (!done[rr]) { done[rr] = 1; for (let k = 0; k < 3; k++) { const c = cell(rr, k); c.innerHTML = M.symHTML(grid[rr][k]); c.classList.remove('spin'); } C.sfx('click'); } }
              else { all = false; for (let k = 0; k < 3; k++) { const c = cell(rr, k); c.classList.add('spin'); c.innerHTML = M.symHTML(C.rint(8)); } }
            }
            if (all) res(); else setTimeout(tick, 70);
          }; tick();
        });
        if (dead || !my) { if (!my) $('#msg').textContent = 'Watching this spin'; return null; }
        const { units, wins, scat, sc } = M.evalGrid(grid), ret = C.r2(my.stake * units);
        wins.forEach(w => { for (let rr = 0; rr < w.count; rr++) cell(rr, M.LINES[w.line][rr]).classList.add('hit'); });
        if (scat) grid.forEach((col, rr) => col.forEach((x, k) => { if (x === M.SCAT) cell(rr, k).classList.add('hit'); }));
        $('#msg').textContent = ret > 0 ? `WIN ${C.fmt(ret)}${scat ? ` · ${sc} gifts!` : ''}${wins.length ? ` · ${wins.length} line${wins.length > 1 ? 's' : ''}` : ''}` : 'No win';
        return { wagered: my.stake, returned: ret, p: .3 };
      },
      resolve: (r, b, key) => b.s * M.evalGrid(gridOf(r.seed, key)).units,
      botBets(rng) { const s = T.botStake(rng); return { bets: { s }, stake: s, label: 'spin' }; },
      clear() { pend = null; ui(); if (!T.multi && autoLeft > 0) { autoLeft--; $('#auto').textContent = autoLeft ? `Stop (${autoLeft})` : 'Auto ×10'; setTimeout(() => { if (!dead) spin(); }, 650); } }
    };
    const XR = (nx, cr, fn) => [cr && cr.seed && fn(cr, 'This round'), nx && fn(nx, 'Next round')].filter(Boolean).join('');
    G.xray = (nx, cr) => XR(nx, cr, (r, l) => { const g = gridOf(r.seed, 'you'), ev = M.evalGrid(g); return Table.xl(l, ev.units ? `pays ${ev.units.toFixed(2)}× bet` : 'no win') + `<div class="xgrid">${[0, 1, 2].map(k => g.map(col => M.symHTML(col[k])).join('')).join('')}</div>`; });
    const T = Table.attach(root, this, opts, G), $ = s => T.main.querySelector(s);
    const cell = (r, k) => T.main.querySelector(`.sym[data-r="${r}"][data-k="${k}"]`);
    T.main.innerHTML = `<div class="table slotbox"><div class="reels">${[0, 1, 2, 3, 4].map(r => `<div class="reel">${[0, 1, 2].map(k => `<div class="sym" data-r="${r}" data-k="${k}">${M.symHTML((r + k) % 6)}</div>`).join('')}</div>`).join('')}</div>
        <div class="msg" id="msg">Good luck!</div><div class="t-status pill-status"></div></div>
      <div class="controls"><div id="bet"></div><div class="btnrow"><button class="btn sec" id="auto">Auto ×10</button><button class="btn big gold" id="spin">SPIN</button></div></div>
      <div class="sidebox" style="margin-top:14px"><h3>Paytable (× line bet · 5 lines)</h3><div class="paygrid">${M.PAY.map((p, i) => `<div><span class="pi">${M.symHTML(i)}</span><b>${p[3]} · ${p[4]} · ${p[5]}</b></div>`).join('')}
        <div><span class="pi">${M.symHTML(M.SCAT)}</span><b>3/4/5 anywhere: ${M.SCATTER[3]}× / ${M.SCATTER[4]}× / ${M.SCATTER[5]}× total bet</b></div><div><span class="pi">${M.symHTML(M.WILD)}</span><b>Wild on reels 2–4</b></div></div></div>`;
    const bet = C.betControl($('#bet'), 'slots');
    function ui() {
      const b = $('#spin'); if (!b) return; $('#auto').hidden = T.multi;
      if (!T.multi) { b.textContent = 'SPIN'; b.disabled = T.busy; bet.lock(T.busy); return; }
      if (T.canBet()) { b.textContent = pend ? 'Cancel' : 'Join spin'; b.className = 'btn big ' + (pend ? 'sec' : 'gold'); b.disabled = false; } else { b.textContent = T.busy ? 'Spinning…' : 'Waiting…'; b.disabled = true; }
      bet.lock(!!pend);
    }
    function spin() {
      if (T.multi) { if (!T.canBet()) return; if (pend) { C.refund(pend); pend = null; } else { const s = bet.get(); if (!C.wager(s)) return; pend = s; } T.changed(); ui(); return; }
      if (T.busy) return; const s = bet.get(); if (!C.wager(s)) { autoLeft = 0; $('#auto').textContent = 'Auto ×10'; return; } pend = s; T.playSolo();
    }
    $('#spin').onclick = () => { autoLeft = 0; $('#auto').textContent = 'Auto ×10'; spin(); };
    $('#auto').onclick = () => { if (autoLeft) { autoLeft = 0; $('#auto').textContent = 'Auto ×10'; } else { autoLeft = 9; $('#auto').textContent = 'Stop (9)'; spin(); } };
    T.start(); ui();
    return () => { dead = true; autoLeft = 0; T.cleanup(); };
  }
});
