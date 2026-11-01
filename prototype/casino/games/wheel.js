'use strict';
Casino.register({
  id: 'wheel', name: 'Money Wheel', desc: 'Big Six style wheel. Bet on a number — it pays that many times over.', multi: true, isNew: true,
  mount(root, opts) {
    const C = Casino, SEG = Shared.WHEEL, N = SEG.length, STEP = Math.PI * 2 / N, VALS = [1, 2, 5, 10, 20, 40];
    const COL = { 1: '#f5c451', 2: '#60a5fa', 5: '#a78bfa', 10: '#34d399', 20: '#f472b6', 40: '#f0605d' };
    const count = v => SEG.filter(x => x === v).length;
    const payout = (b, v) => (b[v] || 0) * (v + 1);
    let bets = {}, last = null, ang = 0, dead = false, spinning = false;
    const hist = [], total = () => Object.values(bets).reduce((a, b) => a + b, 0);
    const label = b => Object.keys(b).map(k => k + '×').join(', ');
    const G = {
      myBets: () => total() ? { bets: Object.assign({}, bets), stake: total(), label: label(bets) } : null,
      onBet() { $('#msg').textContent = 'Place your bets'; root.querySelectorAll('.spot').forEach(s => s.classList.remove('win')); },
      onState() { $('#go').hidden = T.multi; $('#go').disabled = T.busy; },
      async run(r, my) {
        const idx = Shared.wheelIndex(r.seed), v = SEG[idx]; spinning = true; $('#msg').textContent = 'Spinning…';
        const start = ang, target = -idx * STEP + Math.PI * 2 * 6 + (C.rnd() - .5) * STEP * .6, t0 = performance.now(), D = 5000; let lastSeg = -1;
        await new Promise(res => { const tick = now => { if (dead) return res(); const t = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - t, 4); ang = start + (target - (start % (Math.PI * 2))) * e; draw(); const sg = Math.floor(ang / STEP); if (sg !== lastSeg) { lastSeg = sg; C.sfx('tick'); } if (t < 1) requestAnimationFrame(tick); else res(); }; requestAnimationFrame(tick); });
        spinning = false; if (dead) return null;
        hist.unshift(v); if (hist.length > 18) hist.pop();
        $('#hist').innerHTML = hist.map(x => `<span style="background:${COL[x]}33;border-color:${COL[x]};color:${COL[x]}">${x}</span>`).join('');
        root.querySelectorAll('.spot').forEach(s => s.classList.toggle('win', +s.dataset.k === v));
        if (!my) { $('#msg').textContent = `${v}× wins`; return null; }
        last = my.bets; const ret = payout(my.bets, v);
        $('#msg').textContent = ret ? `${v}× — you win ${C.fmt(ret - my.stake)}!` : `${v}× — no luck`;
        return { wagered: my.stake, returned: ret, p: Object.keys(my.bets).reduce((a, k) => a + my.bets[k] * count(+k) / N, 0) / my.stake };
      },
      resolve: (r, b) => payout(b, SEG[Shared.wheelIndex(r.seed)]),
      botBets(rng) { const v = [1, 1, 1, 2, 2, 5, 10, 20, 40][Math.floor(rng() * 9)], s = T.botStake(rng); return { bets: { [v]: s }, stake: s, label: v + '×' }; },
      clear() { bets = {}; paint(); }
    };
    const XR = (nx, cr, fn) => [cr && cr.seed && fn(cr, 'This round'), nx && fn(nx, 'Next round')].filter(Boolean).join('');
    G.xray = (nx, cr) => XR(nx, cr, (r, l) => Table.xl(l, `lands on ${SEG[Shared.wheelIndex(r.seed)]}×`));
    const T = Table.attach(root, this, opts, G), $ = s => T.main.querySelector(s);
    T.main.innerHTML = `<div class="table wheelbox2"><div class="wheel-wrap"><canvas id="cv" width="400" height="400"></canvas><div class="wpointer"></div></div>
        <div class="wright"><div class="msg" id="msg">Place your bets</div><div class="t-status pill-status"></div>
        <div class="spots wspots">${VALS.map(v => `<button class="spot" data-k="${v}" style="--sc:${COL[v]}"><b style="color:${COL[v]}">${v}×</b><small>pays ${v + 1}× · ${count(v)}/${N}</small><span class="amt"></span></button>`).join('')}</div></div></div>
      <div class="controls"><div id="chips"></div><div>Total bet <b id="tot" class="gold-num">$0</b></div><div class="btnrow"><button class="btn sec" id="clear">Clear</button><button class="btn sec" id="rebet">Rebet</button><button class="btn big gold" id="go">Spin</button></div></div>
      <div class="sidebox" style="margin-top:14px"><h3>Last results</h3><div class="pills" id="hist"></div></div>`;
    const picker = C.chipPicker($('#chips'), 5), g = $('#cv').getContext('2d');
    function draw() {
      const R = 186, cx = 200, cy = 200; g.clearRect(0, 0, 400, 400);
      g.beginPath(); g.arc(cx, cy, R + 10, 0, 7); g.fillStyle = '#2a1f12'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#c9a54a'; g.stroke(); g.lineWidth = 1;
      SEG.forEach((v, i) => {
        const a0 = ang + i * STEP - Math.PI / 2 - STEP / 2;
        g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R, a0, a0 + STEP); g.closePath(); g.fillStyle = i % 2 ? COL[v] : COL[v] + 'dd'; g.fill(); g.strokeStyle = '#0006'; g.stroke();
        g.save(); g.translate(cx, cy); g.rotate(a0 + STEP / 2); g.textAlign = 'right'; g.fillStyle = '#111'; g.font = '800 13px Inter,sans-serif'; g.fillText(v, R - 10, 5); g.restore();
      });
      g.beginPath(); g.arc(cx, cy, 46, 0, 7); g.fillStyle = '#0f151c'; g.fill(); g.lineWidth = 4; g.strokeStyle = '#c9a54a'; g.stroke(); g.lineWidth = 1;
      g.fillStyle = '#f5c451'; g.font = '800 14px Inter,sans-serif'; g.textAlign = 'center'; g.fillText('MONEY', cx, cy - 2); g.fillText('WHEEL', cx, cy + 14);
    }
    function paint() { root.querySelectorAll('.spot').forEach(s => s.querySelector('.amt').textContent = bets[s.dataset.k] ? C.fmt(bets[s.dataset.k]) : ''); $('#tot').textContent = C.fmt(total()); }
    const canBet = () => !spinning && T.canBet();
    root.querySelectorAll('.spot').forEach(b => b.onclick = () => { if (!canBet()) return T.multi && C.toast('Betting is closed'); const v = picker.get(); if (!C.wager(v)) return; bets[b.dataset.k] = (bets[b.dataset.k] || 0) + v; paint(); C.sfx('click'); T.changed(); });
    $('#clear').onclick = () => { if (!canBet()) return; C.refund(total()); bets = {}; paint(); T.changed(); };
    $('#rebet').onclick = () => { if (!canBet() || !last) return; C.refund(total()); bets = {}; const need = Object.values(last).reduce((a, b) => a + b, 0); if (C.wager(need)) bets = Object.assign({}, last); paint(); T.changed(); };
    $('#go').onclick = () => { if (!total()) return C.toast('Place a bet first'); T.playSolo(); };
    draw(); T.start();
    return () => { dead = true; T.cleanup(); };
  }
});
