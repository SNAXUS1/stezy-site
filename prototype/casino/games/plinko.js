'use strict';
Casino.register({
  id: 'plinko', name: 'Plinko', desc: 'Drop the ball, chase the big multipliers on the edges.', multi: true,
  mount(root, opts) {
    const C = Casino, W = 640, H = 560, SHAPE = { low: [.5, 2], med: [.2, 3], high: [.03, 5] };
    const binom = n => { const a = [1]; for (let k = 1; k <= n; k++) a.push(a[k - 1] * (n - k + 1) / k); const t = 2 ** n; return a.map(x => x / t); };
    const cache = {};
    function table(rows, risk) {
      const key = rows + risk; if (cache[key]) return cache[key];
      const probs = binom(rows), [floor, pow] = SHAPE[risk], raw = probs.map((_, k) => floor + Math.pow(Math.abs(k - rows / 2) / (rows / 2), pow));
      const scale = .97 / raw.reduce((a, r, k) => a + r * probs[k], 0), mults = raw.map(r => Math.round(r * scale * 100) / 100);
      return (cache[key] = { probs, mults, pwin: probs.reduce((a, p, k) => a + (mults[k] >= 1 ? p : 0), 0) });
    }
    const pathOf = (seed, key, rows) => { const r = Shared.rngFor(seed, key + ':plinko'); return Array.from({ length: rows }, () => r() < .5 ? 0 : 1); };
    let rows = 12, risk = 'med', balls = [], raf = 0, dead = false, pend = null, flash = {};
    const G = {
      myBets: () => pend ? { bets: { s: pend.s, risk: pend.risk }, stake: pend.s, label: pend.risk + ' risk' } : null,
      onBet() { if (rows !== 12) { rows = 12; $('#rows').value = 12; $('#rv').textContent = 12; draw(0); } },
      onState: () => ui(),
      run(r, my, ctx) {
        const out = new Promise(res => {
          const t = table(rows, my ? my.bets.risk : risk);
          if (ctx.solo) { const path = pathOf(r.seed, 'you', rows); const ball = drop(path, '#ff4d6d', true, k => res({ wagered: my.stake, returned: my.stake * table(rows, my.bets.risk).mults[k], p: table(rows, my.bets.risk).pwin })); ball.solo = my; ball.risk = my.bets.risk; return; }
          for (const s of ctx.seats()) if (!s.me && s.bets && s.bets.risk) drop(pathOf(r.seed, s.key, 12), s.bot ? '#8b98a8' : '#60a5fa', false);
          if (my) drop(pathOf(r.seed, ctx.key, 12), '#ff4d6d', true, k => res({ wagered: my.stake, returned: my.stake * table(12, my.bets.risk).mults[k], p: table(12, my.bets.risk).pwin }));
          else setTimeout(() => res(null), 3200);
          void t;
        });
        return out;
      },
      resolve(r, b, key) { const k = pathOf(r.seed, key, 12).reduce((a, x) => a + x, 0); return b.s * table(12, b.risk).mults[k]; },
      botBets(rng) { const risk = ['low', 'med', 'med', 'high'][Math.floor(rng() * 4)], s = T.botStake(rng); return { bets: { s, risk }, stake: s, label: risk + ' risk' }; },
      clear() { if (T.multi) pend = null; ui(); }
    };
    const XR = (nx, cr, fn) => [cr && cr.seed && fn(cr, 'This round'), nx && fn(nx, 'Next round')].filter(Boolean).join('');
    G.xray = (nx, cr) => XR(nx, cr, (r, l) => { const n = T.multi ? 12 : rows, rk = T.multi && pend ? pend.risk : risk, k = pathOf(r.seed, 'you', n).reduce((a, x) => a + x, 0), m = table(n, rk).mults[k]; return Table.xl(l, `ball lands on ${m}×`, `slot ${k + 1} of ${n + 1} · ${rk} risk`); });
    const T = Table.attach(root, this, opts, G), $ = s => T.main.querySelector(s);
    T.main.innerHTML = `<div class="plinko-wrap"><div class="table plinkobox"><canvas id="cv" width="${W}" height="${H}"></canvas><div class="t-status pill-status floating"></div></div>
      <div class="card-box plinko-side"><div id="bet"></div>
      <label class="lbl">Rows <b id="rv">12</b></label><input type="range" id="rows" min="8" max="16" value="12">
      <label class="lbl">Risk</label><div class="seg3" id="risk"><button data-r="low">Low</button><button data-r="med" class="on">Medium</button><button data-r="high">High</button></div>
      <button class="btn big gold" id="drop" style="width:100%;margin-top:18px">Drop ball</button>
      <p class="muted" id="info" style="font-size:12px;margin-top:10px"></p><div class="pills" id="last"></div></div></div>`;
    const bet = C.betControl($('#bet'), 'plinko'), cv = $('#cv'), g = cv.getContext('2d');
    const lay = () => { const top = 40, bottom = H - 60, dy = (bottom - top) / rows, dx = Math.min(44, (W - 40) / (rows + 1)); return { top, dy, dx, cx: W / 2, binY: top + rows * dy + 6 }; };
    const color = k => { const d = Math.abs(k - rows / 2) / (rows / 2); return `hsl(${50 - d * 50},90%,${55 - d * 8}%)`; };
    function draw(now) {
      const L = lay(), t = table(rows, pend && T.multi ? pend.risk : risk); g.clearRect(0, 0, W, H); g.fillStyle = '#fff';
      for (let i = 0; i < rows; i++) for (let j = 0; j <= i; j++) { g.beginPath(); g.arc(L.cx + (j - i / 2) * L.dx, L.top + i * L.dy, 3.5, 0, 7); g.fill(); }
      const bw = L.dx - 3;
      for (let k = 0; k <= rows; k++) {
        const x = L.cx + (k - rows / 2) * L.dx, f = flash[k] && now - flash[k] < 400;
        g.fillStyle = color(k); g.globalAlpha = f ? 1 : .85; g.beginPath(); g.roundRect(x - bw / 2, L.binY + (f ? 4 : 0), bw, 30, 6); g.fill(); g.globalAlpha = 1;
        g.fillStyle = '#111'; g.font = `bold ${rows > 13 ? 9 : 11}px Inter,sans-serif`; g.textAlign = 'center'; g.fillText(t.mults[k] + '×', x, L.binY + 19 + (f ? 4 : 0));
      }
      for (const b of balls) { g.beginPath(); g.arc(b.x, b.y, b.mine ? 7 : 5.5, 0, 7); g.fillStyle = b.col; g.shadowColor = b.col; g.shadowBlur = b.mine ? 12 : 4; g.fill(); g.shadowBlur = 0; }
    }
    function drop(path, col, mine, onLand) {
      const L = lay(), pts = [{ x: L.cx + (mine ? 0 : (C.rnd() - .5) * 10), y: L.top - 28 }]; let k = 0;
      for (let i = 0; i < rows; i++) { pts.push({ x: L.cx + (k - i / 2) * L.dx, y: L.top + i * L.dy - 11 }); k += path[i]; }
      pts.push({ x: L.cx + (k - rows / 2) * L.dx, y: L.binY + 14 });
      const ball = { pts, t0: performance.now() + (mine ? 0 : C.rnd() * 500), dur: 2300 / rows + 40, k, col, mine, onLand, x: -50, y: -50 };
      balls.push(ball); if (!raf) raf = requestAnimationFrame(loop); return ball;
    }
    function loop(now) {
      raf = 0; if (dead) return;
      for (const b of balls) {
        const seg = Math.max(0, (now - b.t0) / b.dur), i = Math.min(b.pts.length - 2, Math.floor(seg)), f = Math.min(1, seg - i);
        if (seg >= b.pts.length - 1) { b.done = true; continue; }
        const a = b.pts[i], c = b.pts[i + 1]; b.x = a.x + (c.x - a.x) * f; b.y = a.y + (c.y - a.y) * f * f - Math.sin(f * Math.PI) * 9;
        if (b.mine && b.lastSeg !== i) { b.lastSeg = i; if (i > 0 && i < 6) C.sfx('tick'); }
      }
      for (const b of balls.filter(b => b.done)) {
        flash[b.k] = now;
        if (b.mine) { const m = table(rows, T.multi && pend ? pend.risk : (b.risk || risk)).mults[b.k]; const p = document.createElement('span'); p.textContent = m + '×'; p.className = m >= 1 ? 'hi' : 'lo'; $('#last').prepend(p); if ($('#last').children.length > 14) $('#last').lastChild.remove(); }
        b.onLand && b.onLand(b.k);
      }
      balls = balls.filter(b => !b.done); draw(now);
      if (balls.length || Object.values(flash).some(t => now - t < 400)) raf = requestAnimationFrame(loop);
    }
    function ui() {
      const b = $('#drop'); if (!b) return;
      const t = table(rows, risk); $('#info').textContent = `Return ≈ 97% · profit chance ${(t.pwin * 100).toFixed(0)}% · max ${t.mults[0]}×`;
      $('#rows').disabled = T.multi || balls.length > 0;
      if (!T.multi) { b.textContent = 'Drop ball'; b.disabled = false; bet.lock(false); return; }
      if (T.canBet()) { b.textContent = pend ? 'Cancel ball' : 'Join round'; b.className = 'btn big ' + (pend ? 'sec' : 'gold'); b.disabled = false; }
      else { b.textContent = T.busy ? 'Balls dropping…' : 'Waiting for next round'; b.disabled = true; }
      bet.lock(!!pend);
    }
    $('#drop').onclick = () => {
      if (T.multi) {
        if (!T.canBet()) return;
        if (pend) { C.refund(pend.s); pend = null; } else { const s = bet.get(); if (!C.wager(s)) return; pend = { s, risk }; }
        T.changed(); ui(); return;
      }
      const s = bet.get(); if (!C.wager(s)) return;
      pend = { s, risk }; const my = pend; T.playSolo({}, true); if (pend === my) pend = null;
    };
    $('#rows').oninput = e => { if (balls.length || T.multi) { e.target.value = rows; return; } rows = +e.target.value; $('#rv').textContent = rows; draw(0); ui(); };
    $('#risk').onclick = e => { const b = e.target.closest('button'); if (!b || (T.multi && pend)) return; risk = b.dataset.r; root.querySelectorAll('#risk button').forEach(x => x.classList.toggle('on', x === b)); draw(0); ui(); };
    draw(0); T.start(); ui();
    return () => { dead = true; cancelAnimationFrame(raf); for (const b of balls) if (b.solo) { const t = table(rows, b.solo.bets.risk); C.settle('plinko', b.solo.stake, b.solo.stake * t.mults[b.k], t.pwin); } T.cleanup(); };
  }
});
