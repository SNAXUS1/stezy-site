'use strict';
Casino.register({
  id: 'roulette', name: 'Roulette', desc: 'European single-zero wheel. Straight-up pays 35:1.', multi: true,
  mount(root, opts) {
    const C = Casino;
    const ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
    const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
    const colorOf = n => n === 0 ? 'green' : REDS.has(n) ? 'red' : 'black', hex = { green: '#1f8a4c', red: '#c0392b', black: '#1d1d1d' };
    const NAMES = { red: 'Red', black: 'Black', odd: 'Odd', even: 'Even', low: '1-18', high: '19-36', d1: '1st 12', d2: '2nd 12', d3: '3rd 12', c1: 'Col 1', c2: 'Col 2', c3: 'Col 3' };
    const RULES = {
      red: [n => REDS.has(n), 2, 18 / 37], black: [n => n > 0 && !REDS.has(n), 2, 18 / 37], odd: [n => n > 0 && n % 2 === 1, 2, 18 / 37], even: [n => n > 0 && n % 2 === 0, 2, 18 / 37],
      low: [n => n >= 1 && n <= 18, 2, 18 / 37], high: [n => n >= 19, 2, 18 / 37], d1: [n => n >= 1 && n <= 12, 3, 12 / 37], d2: [n => n >= 13 && n <= 24, 3, 12 / 37], d3: [n => n >= 25, 3, 12 / 37],
      c1: [n => n > 0 && n % 3 === 1, 3, 12 / 37], c2: [n => n > 0 && n % 3 === 2, 3, 12 / 37], c3: [n => n > 0 && n % 3 === 0, 3, 12 / 37]
    };
    const rule = k => k[0] === 'n' ? [n => n === +k.slice(1), 36, 1 / 37] : RULES[k];
    const payout = (b, n) => Object.keys(b).reduce((a, k) => a + (rule(k)[0](n) ? b[k] * rule(k)[1] : 0), 0);
    const label = b => { const ks = Object.keys(b); return ks.slice(0, 2).map(k => k[0] === 'n' ? '#' + k.slice(1) : NAMES[k]).join(', ') + (ks.length > 2 ? ` +${ks.length - 2}` : ''); };
    let bets = {}, last = null, wAng = 0, ball = null, dead = false, spinning = false;
    const hist = [], total = () => Object.values(bets).reduce((a, b) => a + b, 0);
    const G = {
      myBets: () => total() ? { bets: Object.assign({}, bets), stake: total(), label: label(bets) } : null,
      onBet() { $('#res').textContent = '–'; $('#res').style.background = ''; $('#msg').textContent = 'Place your bets'; root.querySelectorAll('.rc.win').forEach(x => x.classList.remove('win')); },
      onState() { $('#spin').hidden = T.multi; $('#spin').disabled = T.busy; },
      async run(r, my) {
        const n = Shared.rouletteNumber(r.seed); spinning = true; $('#msg').textContent = 'No more bets'; $('#res').textContent = '…';
        await animate(n); spinning = false; if (dead) return null;
        $('#res').textContent = n; $('#res').style.background = hex[colorOf(n)];
        hist.unshift(n); if (hist.length > 18) hist.pop();
        $('#hist').innerHTML = hist.map(x => `<span style="background:${hex[colorOf(x)]};border-color:transparent">${x}</span>`).join('');
        if (!my) { $('#msg').textContent = `${n} ${colorOf(n)}`; return null; }
        last = my.bets;
        const ret = payout(my.bets, n), pw = Object.keys(my.bets).reduce((a, k) => a + my.bets[k] * rule(k)[2], 0) / my.stake;
        root.querySelectorAll('.rc').forEach(b => { if (my.bets[b.dataset.k] && rule(b.dataset.k)[0](n)) b.classList.add('win'); });
        $('#msg').textContent = ret > my.stake ? `${n} — you win ${C.fmt(ret - my.stake)}!` : ret === my.stake ? `${n} — break even` : `${n} — no luck`;
        return { wagered: my.stake, returned: ret, p: pw };
      },
      resolve: (r, b) => payout(b, Shared.rouletteNumber(r.seed)),
      botBets(rng) {
        const keys = Object.keys(RULES), b = {}, n = 1 + Math.floor(rng() * 3);
        for (let i = 0; i < n; i++) { const k = rng() < .25 ? 'n' + Math.floor(rng() * 37) : keys[Math.floor(rng() * keys.length)]; b[k] = (b[k] || 0) + T.botStake(rng); }
        return { bets: b, stake: Object.values(b).reduce((a, x) => a + x, 0), label: label(b) };
      },
      clear() { bets = {}; paint(); }
    };
    const XR = (nx, cr, fn) => [cr && cr.seed && fn(cr, 'This round'), nx && fn(nx, 'Next round')].filter(Boolean).join('');
    G.xray = (nx, cr) => XR(nx, cr, (r, l) => { const n = Shared.rouletteNumber(r.seed), c = colorOf(n); return Table.xl(l, `<span class="xn x-${c}">${n}</span>`, c); });
    const T = Table.attach(root, this, opts, G), $ = s => T.main.querySelector(s);
    let nums = '';
    for (let r = 0; r < 3; r++) for (let c = 0; c < 12; c++) { const n = c * 3 + 3 - r; nums += `<button class="rc ${colorOf(n)}" data-k="n${n}" style="grid-column:${c + 2};grid-row:${r + 1}">${n}</button>`; }
    const cols = [['c3', 1], ['c2', 2], ['c1', 3]].map(([k, r]) => `<button class="rc out" data-k="${k}" style="grid-column:14;grid-row:${r}">2:1</button>`).join('');
    const doz = ['d1', 'd2', 'd3'].map((k, i) => `<button class="rc out" data-k="${k}" style="grid-column:${2 + i * 4}/span 4;grid-row:4">${NAMES[k]}</button>`).join('');
    const outs = [['low', ''], ['even', ''], ['red', 'red'], ['black', 'black'], ['odd', ''], ['high', '']].map(([k, c], i) => `<button class="rc ${c || 'out'}" data-k="${k}" style="grid-column:${2 + i * 2}/span 2;grid-row:5">${NAMES[k].toUpperCase()}</button>`).join('');
    T.main.innerHTML = `<div class="table felt"><div class="wheelbox"><canvas id="wheel" width="320" height="320"></canvas>
        <div style="text-align:center"><div class="bigres" id="res">–</div><div class="msg" id="msg">Place your bets</div><div class="t-status pill-status"></div></div></div>
        <div class="rgrid"><button class="rc green" data-k="n0" style="grid-column:1;grid-row:1/span 3">0</button>${nums}${cols}${doz}${outs}</div></div>
      <div class="controls"><div id="chips"></div><div>Total bet <b id="tot" class="gold-num">$0</b></div><div class="btnrow"><button class="btn sec" id="undo">Clear</button><button class="btn sec" id="rebet">Rebet</button><button class="btn big" id="spin">Spin</button></div></div>
      <div class="sidebox" style="margin-top:14px"><h3>Last numbers</h3><div class="pills" id="hist"><span class="muted" style="border:0;background:none">No spins yet</span></div></div>`;
    const picker = C.chipPicker($('#chips'), 5), cv = $('#wheel'), g = cv.getContext('2d'), STEP = Math.PI * 2 / 37;
    function drawWheel() {
      const cx = 160, cy = 160, R = 150; g.clearRect(0, 0, 320, 320);
      g.beginPath(); g.arc(cx, cy, R + 8, 0, 7); g.fillStyle = '#5d4326'; g.fill();
      for (let i = 0; i < 37; i++) {
        const n = ORDER[i], a0 = wAng + (i - .5) * STEP - Math.PI / 2;
        g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R, a0, a0 + STEP); g.closePath(); g.fillStyle = hex[colorOf(n)]; g.fill(); g.strokeStyle = '#c9a54a'; g.lineWidth = 1; g.stroke();
        g.save(); g.translate(cx, cy); g.rotate(wAng + i * STEP - Math.PI / 2); g.translate(R - 16, 0); g.rotate(Math.PI / 2); g.fillStyle = '#fff'; g.font = 'bold 12px sans-serif'; g.textAlign = 'center'; g.fillText(n, 0, 4); g.restore();
      }
      g.beginPath(); g.arc(cx, cy, R * .62, 0, 7); g.fillStyle = '#3b2a1a'; g.fill();
      g.beginPath(); g.arc(cx, cy, R * .5, 0, 7); g.fillStyle = '#c9a54a'; g.fill();
      g.beginPath(); g.arc(cx, cy, R * .12, 0, 7); g.fillStyle = '#fff'; g.fill();
      if (ball) { g.beginPath(); g.arc(cx + Math.cos(ball.a) * ball.r * R, cy + Math.sin(ball.a) * ball.r * R, 7, 0, 7); g.fillStyle = '#fff'; g.shadowColor = '#000'; g.shadowBlur = 6; g.fill(); g.shadowBlur = 0; }
    }
    const animate = n => new Promise(res => {
      const idx = ORDER.indexOf(n), D = 5200, t0 = performance.now(), w0 = wAng % (Math.PI * 2);
      const tick = now => {
        if (dead) return res();
        const t = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - t, 3);
        wAng = w0 + Math.PI * 6 * e;
        ball = { a: wAng + idx * STEP + (1 - e) * Math.PI * 12 - Math.PI / 2, r: t < .7 ? .93 : .93 - (t - .7) / .3 * .27 };
        drawWheel(); if (t < 1) requestAnimationFrame(tick); else res();
      };
      requestAnimationFrame(tick);
    });
    function paint() {
      root.querySelectorAll('.rc').forEach(b => { const s = b.querySelector('.stack'); if (s) s.remove(); const a = bets[b.dataset.k]; if (a) b.insertAdjacentHTML('beforeend', `<span class="stack">${a}</span>`); });
      $('#tot').textContent = C.fmt(total());
    }
    const canBet = () => !spinning && T.canBet();
    T.main.querySelectorAll('.rc').forEach(b => b.onclick = () => {
      if (!canBet()) { if (T.multi) C.toast('Betting is closed — wait for the next round'); return; }
      const v = picker.get(); if (!C.wager(v)) return; bets[b.dataset.k] = (bets[b.dataset.k] || 0) + v; paint(); C.sfx('click'); T.changed();
    });
    $('#undo').onclick = () => { if (!canBet()) return; C.refund(total()); bets = {}; paint(); T.changed(); };
    $('#rebet').onclick = () => { if (!canBet() || !last) return; C.refund(total()); bets = {}; const need = Object.values(last).reduce((a, b) => a + b, 0); if (C.wager(need)) bets = Object.assign({}, last); paint(); T.changed(); };
    $('#spin').onclick = () => { if (!total()) return C.toast('Place a bet first'); T.playSolo(); };
    drawWheel(); T.start();
    return () => { dead = true; T.cleanup(); };
  }
});
