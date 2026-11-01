'use strict';
Casino.register({
  id: 'crash', name: 'Crash', desc: 'The rocket climbs — cash out before it crashes.', multi: true,
  mount(root, opts) {
    const C = Casino, RATE = .09, mult = t => Math.exp(RATE * t);
    let pend = null, run = null, raf = 0, dead = false;
    const hist = [];
    const autoV = () => { const v = parseFloat($('#auto').value); return v > 1 ? Math.round(v * 100) / 100 : 0; };
    const G = {
      lateMs: Infinity,
      myBets: () => pend ? { bets: { s: pend.stake, auto: pend.auto }, stake: pend.stake, label: pend.auto ? `auto ${pend.auto}×` : 'manual' } : null,
      onBet() { cancelAnimationFrame(raf); $('#mx').textContent = '1.00×'; $('#mx').className = ''; $('#sub').textContent = 'Place your bet'; draw(0, false); },
      onState: () => ui(),
      run(r, my, ctx) {
        return new Promise(res => {
          const cp = Shared.crashPoint(r.seed), tCrash = Math.log(cp) / RATE, t0 = performance.now() - (ctx.solo ? 0 : Math.max(0, T.since(r)));
          run = { my, ctx, cashed: 0, m: 1 };
          $('#mx').className = ''; $('#sub').textContent = my ? 'Good luck…' : 'Watching this round';
          const botsLeft = () => ctx.seats().filter(s => s.bot && s.bets && s.res == null);
          const tick = () => {
            if (dead) return res(null);
            const t = (performance.now() - t0) / 1000;
            if (t >= tCrash) {
              draw(tCrash, true); $('#mx').textContent = cp.toFixed(2) + '×'; $('#mx').className = 'crashed'; if (!run.cashed) $('#sub').textContent = 'CRASHED';
              hist.unshift(cp); if (hist.length > 16) hist.pop();
              $('#hist').innerHTML = hist.map(x => `<span class="${x >= 2 ? 'hi' : 'lo'}">${x.toFixed(2)}×</span>`).join('');
              const out = my ? { wagered: my.stake, returned: run.cashed ? C.r2(my.stake * run.cashed) : 0, p: Math.min(.97, .97 / (run.cashed || my.bets.auto || 2)) } : null;
              run = null; ui(); return res(out);
            }
            const m = mult(t); run.m = m; $('#mx').textContent = m.toFixed(2) + '×'; draw(t, false);
            for (const s of botsLeft()) if (s.bets.auto && m >= s.bets.auto) ctx.botResult(s, s.bets.s * s.bets.auto);
            if (my && !run.cashed && my.bets.auto && m >= my.bets.auto) cash(my.bets.auto);
            ui(); raf = requestAnimationFrame(tick);
          };
          ui(); tick();
        });
      },
      resolve: (r, b) => b.auto && Shared.crashPoint(r.seed) >= b.auto ? b.s * b.auto : 0,
      botBets(rng) { const auto = [1.2, 1.5, 1.8, 2, 2, 2.5, 3, 5, 10][Math.floor(rng() * 9)], s = T.botStake(rng); return { bets: { s, auto }, stake: s, label: `auto ${auto}×` }; },
      clear() { pend = null; ui(); }
    };
    function cash(m) {
      if (!run || !run.my || run.cashed) return;
      run.cashed = m; const ret = C.r2(run.my.stake * m);
      $('#sub').textContent = `Cashed out at ${m.toFixed(2)}× · +${C.fmt(ret - run.my.stake)}`; C.sfx('win');
      run.ctx.early(ret, `${m.toFixed(2)}×`);
    }
    const XR = (nx, cr, fn) => [cr && cr.seed && fn(cr, 'This round'), nx && fn(nx, 'Next round')].filter(Boolean).join('');
    G.xray = (nx, cr) => XR(nx, cr, (r, l) => { const cp = Shared.crashPoint(r.seed); return Table.xl(l, `crashes at ${cp.toFixed(2)}×`, cp < 1.3 ? 'instant bust — skip it' : cp >= 10 ? 'moon shot!' : 'cash out just before'); });
    const T = Table.attach(root, this, opts, G), $ = s => T.main.querySelector(s);
    T.main.innerHTML = `<div class="table crashbox"><canvas id="cv" width="760" height="380"></canvas>
        <div class="crash-over"><div id="mx">1.00×</div><div id="sub" class="countdown"></div><div class="t-status pill-status"></div></div></div>
      <div class="controls"><div id="bet"></div><div class="betctl"><label>Auto cash-out (×)</label><div class="betrow"><input id="auto" type="number" min="1.01" step="0.1" placeholder="off"></div></div>
        <div class="btnrow"><button class="btn big gold" id="go" style="min-width:220px">Bet</button></div></div>
      <div class="sidebox" style="margin-top:14px"><h3>Previous crashes</h3><div class="pills" id="hist"><span class="muted" style="border:0;background:none">—</span></div></div>`;
    const bet = C.betControl($('#bet'), 'crash'), cv = $('#cv'), g = cv.getContext('2d'), W = 760, H = 380;
    function draw(t, crashed) {
      g.clearRect(0, 0, W, H);
      const m = mult(t), xMax = Math.max(8, t * 1.15), yMax = Math.max(2, m * 1.2);
      g.strokeStyle = '#ffffff14'; g.fillStyle = '#7d8a9b'; g.font = '12px Inter,sans-serif'; g.lineWidth = 1;
      for (let i = 1; i <= 4; i++) { const y = H - 30 - (H - 60) * (i / 4); g.beginPath(); g.moveTo(44, y); g.lineTo(W, y); g.stroke(); g.fillText((1 + (yMax - 1) * i / 4).toFixed(1) + '×', 4, y + 4); }
      const px = s => 44 + (W - 64) * (s / xMax), py = v => H - 30 - (H - 60) * ((v - 1) / (yMax - 1));
      g.beginPath(); g.moveTo(px(0), py(1));
      for (let s = 0; s <= t; s += t / 80 || 1) g.lineTo(px(s), py(mult(s)));
      g.lineTo(px(t), py(m)); g.strokeStyle = crashed ? '#f0605d' : '#34d399'; g.lineWidth = 5; g.stroke();
      g.lineTo(px(t), py(1)); g.lineTo(px(0), py(1)); g.fillStyle = crashed ? '#f0605d22' : '#34d39922'; g.fill();
      g.font = '34px sans-serif'; g.fillText(crashed ? '💥' : '🚀', px(t) - 14, py(m) - 6);
    }
    function ui() {
      const b = $('#go'); if (!b) return; b.disabled = false; b.className = 'btn big gold';
      if (run && run.my && !run.cashed) { b.textContent = `Cash out ${C.fmt(run.my.stake * run.m)}`; b.className = 'btn big'; }
      else if (run) { b.textContent = run.my ? 'Cashed out ✓' : 'Round running…'; b.disabled = true; }
      else if (T.multi) { if (T.canBet()) { b.textContent = pend ? 'Cancel bet' : 'Place bet'; b.className = pend ? 'btn big sec' : 'btn big gold'; } else { b.textContent = 'Waiting for next round'; b.disabled = true; } }
      else b.textContent = 'Bet';
      bet.lock(!!pend || !!run);
    }
    $('#go').onclick = () => {
      if (run && run.my && !run.cashed) return cash(Math.floor(run.m * 100) / 100);
      if (T.multi) {
        if (!T.canBet()) return;
        if (pend) { C.refund(pend.stake); pend = null; } else { const s = bet.get(); if (!C.wager(s)) return; pend = { stake: s, auto: autoV() }; }
        T.changed(); ui(); return;
      }
      if (T.busy) return; const s = bet.get(); if (!C.wager(s)) return; pend = { stake: s, auto: autoV() }; T.playSolo();
    };
    $('#auto').onchange = () => { if (pend && T.multi && T.canBet()) { pend.auto = autoV(); T.changed(); } };
    draw(0, false); T.start(); ui();
    const tm = setInterval(() => { if (!run) ui(); }, 400);
    return () => { dead = true; cancelAnimationFrame(raf); clearInterval(tm); T.cleanup(); };
  }
});
