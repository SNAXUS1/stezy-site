'use strict';
Casino.register({
  id: 'mines', name: 'Mines', desc: 'Reveal gems, avoid the mines, cash out whenever you like. Everyone shares one board.', multi: true, isNew: true,
  mount(root, opts) {
    const C = Casino;
    let mines = 3, pend = null, dead = false, cur = null;
    const G = {
      lateMs: 4000,
      myBets: () => pend ? { bets: pend, stake: pend.s, label: `${pend.m} mines` } : null,
      onBet() { resetGrid(); $('#msg').textContent = 'Pick your mine count and join the board'; },
      onState: () => ui(),
      run(r, my, ctx) {
        return new Promise(res => {
          resetGrid();
          if (!my) { $('#msg').textContent = 'Watching — next board soon'; setTimeout(() => { reveal(Shared.minesBoard(r.seed, mines), new Set()); res(null); }, 2000); return; }
          const board = Shared.minesBoard(r.seed, my.bets.m);
          cur = { r, my, board, k: 0, open: new Set(), alive: true, done: false, ctx, res };
          paintMult(); ui();
          $('#msg').textContent = ctx.solo ? 'Pick a tile' : 'Pick tiles — the round ends when the timer runs out';
          if (!ctx.solo) cur.timer = setInterval(() => { if (!cur || cur.done) return; const left = ctx.deadline - ctx.now(); $('#msg').textContent = `${Math.max(0, Math.ceil(left / 1000))}s left · ${cur.k} gem${cur.k === 1 ? '' : 's'} found`; if (left <= 300) finish(cur.k ? 'cash' : 'idle'); }, 250);
        });
      },
      resolve(r, b, key, forfeit) {
        if (forfeit && cur && cur.r === r) return cur.alive ? (cur.k ? b.s * Shared.minesMult(b.m, cur.k) : b.s) : 0;
        const board = Shared.minesBoard(r.seed, b.m), rng = Shared.rngFor(r.seed, key + ':mines'), cells = Array.from({ length: 25 }, (_, i) => i);
        for (let i = 24; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
        for (let i = 0; i < b.k; i++) if (board.has(cells[i])) return 0;
        return b.s * Shared.minesMult(b.m, b.k);
      },
      botBets(rng) { const m = [1, 3, 3, 5, 5, 10][Math.floor(rng() * 6)], k = 1 + Math.floor(rng() * (m > 5 ? 3 : 6)), s = T.botStake(rng); return { bets: { s, m, k }, stake: s, label: `${m} mines` }; },
      clear() { pend = null; ui(); }
    };
    function finish(how) {
      if (!cur || cur.done) return; cur.done = true; clearInterval(cur.timer);
      const { my, board, k, open } = cur;
      const ret = how === 'boom' ? 0 : how === 'idle' ? my.stake : C.r2(my.stake * Shared.minesMult(my.bets.m, k));
      reveal(board, open);
      $('#msg').textContent = how === 'boom' ? 'BOOM! You hit a mine.' : how === 'idle' ? 'No tiles picked — stake returned' : `Cashed out ${Shared.minesMult(my.bets.m, k)}× · ${C.fmt(ret)}`;
      const res = cur.res, out = { wagered: my.stake, returned: ret, p: how === 'cash' ? Math.min(.97, .97 / Shared.minesMult(my.bets.m, Math.max(1, k))) : .5 };
      const wait = cur.ctx.solo ? 0 : Math.max(0, cur.ctx.deadline - cur.ctx.now());
      cur.alive = how !== 'boom'; cur = null; ui();
      setTimeout(() => res(out), Math.min(wait, 20000));
    }
    let xrKey = '';
    G.xray = nx => {
      const board = cur ? cur.board : nx ? Shared.minesBoard(nx.seed, mines) : null; if (!board) return null;
      const key = [...board].join() + (cur ? 'c' : 'n'); if (key !== xrKey) { xrKey = key; T.main.querySelectorAll('.mc').forEach(c => c.classList.toggle('xr', board.has(+c.dataset.i))); }
      return Table.xl(cur ? 'This board' : 'Next board', `${board.size} mine${board.size > 1 ? 's' : ''} marked`, cur ? 'red-ringed tiles are mines — click the rest' : `for ${mines} mine${mines > 1 ? 's' : ''} · changing the count changes the board`);
    };
    G.xrayOff = () => { xrKey = ''; T.main.querySelectorAll('.mc.xr').forEach(c => c.classList.remove('xr')); };
    const T = Table.attach(root, this, opts, G), $ = s => T.main.querySelector(s);
    T.main.innerHTML = `<div class="table minesbox"><div class="mgrid">${Array.from({ length: 25 }, (_, i) => `<button class="mc" data-i="${i}"></button>`).join('')}</div>
        <div class="mside"><div class="mmult"><small>Current</small><b id="cm">1.00×</b><small>Next tile</small><b id="nm" class="gold-num">—</b></div><div class="msg" id="msg">Pick your mine count and press Play</div><div class="t-status pill-status"></div></div></div>
      <div class="controls"><div id="bet"></div><div class="betctl"><label>Mines</label><div class="seg3 wrap" id="mn">${[1, 3, 5, 10, 15, 20, 24].map(m => `<button data-m="${m}" class="${m === mines ? 'on' : ''}">${m}</button>`).join('')}</div></div>
        <div class="btnrow"><button class="btn big gold" id="go">Play</button></div></div>`;
    const bet = C.betControl($('#bet'), 'mines');
    const tile = i => T.main.querySelector(`.mc[data-i="${i}"]`);
    function resetGrid() { xrKey = ''; T.main.querySelectorAll('.mc').forEach(c => { c.className = 'mc'; c.innerHTML = ''; }); $('#cm').textContent = '1.00×'; $('#nm').textContent = '—'; }
    function reveal(board, open) { for (let i = 0; i < 25; i++) { const c = tile(i); if (board.has(i)) { c.classList.add('mine'); c.innerHTML = C.icon('bomb', 26); } else if (!open.has(i)) { c.classList.add('gem', 'dim'); c.innerHTML = C.icon('diamond', 30); } } }
    function paintMult() { if (!cur) return; const m = cur.my.bets.m; $('#cm').textContent = (cur.k ? Shared.minesMult(m, cur.k) : 1).toFixed(2) + '×'; $('#nm').textContent = cur.k < 25 - m ? Shared.minesMult(m, cur.k + 1).toFixed(2) + '×' : '—'; }
    function ui() {
      const b = $('#go'); if (!b) return;
      root.querySelectorAll('#mn button').forEach(x => x.disabled = !!pend || !!cur);
      if (cur) { b.textContent = cur.k ? `Cash out ${C.fmt(cur.my.stake * Shared.minesMult(cur.my.bets.m, cur.k))}` : 'Pick a tile'; b.className = 'btn big'; b.disabled = !cur.k; bet.lock(true); return; }
      b.className = 'btn big gold';
      if (!T.multi) { b.textContent = 'Play'; b.disabled = T.busy; bet.lock(T.busy); return; }
      if (T.canBet()) { b.textContent = pend ? 'Cancel' : 'Join board'; b.className = 'btn big ' + (pend ? 'sec' : 'gold'); b.disabled = false; } else { b.textContent = T.busy ? 'Round in play' : 'Waiting…'; b.disabled = true; }
      bet.lock(!!pend);
    }
    $('.mgrid').onclick = e => {
      const c = e.target.closest('.mc'); if (!c || !cur || cur.done) return; const i = +c.dataset.i; if (cur.open.has(i)) return;
      cur.open.add(i);
      if (cur.board.has(i)) { c.classList.add('mine', 'boom'); c.innerHTML = C.icon('bomb', 26); C.sfx('lose'); return finish('boom'); }
      cur.k++; c.classList.add('gem'); c.innerHTML = C.icon('diamond', 30); C.sfx('win'); paintMult(); ui();
      if (cur.k >= 25 - cur.my.bets.m) finish('cash');
    };
    $('#mn').onclick = e => { const b = e.target.closest('button'); if (!b || b.disabled) return; mines = +b.dataset.m; root.querySelectorAll('#mn button').forEach(x => x.classList.toggle('on', x === b)); };
    $('#go').onclick = () => {
      if (cur) { if (cur.k) finish('cash'); return; }
      if (T.multi) { if (!T.canBet()) return; if (pend) { C.refund(pend.s); pend = null; } else { const s = bet.get(); if (!C.wager(s)) return; pend = { s, m: mines }; } T.changed(); ui(); return; }
      if (T.busy) return; const s = bet.get(); if (!C.wager(s)) return; pend = { s, m: mines }; T.playSolo();
    };
    T.start(); ui();
    return () => { dead = true; if (cur) clearInterval(cur.timer); T.cleanup(); };
  }
});
