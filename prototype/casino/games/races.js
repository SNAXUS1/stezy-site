'use strict';
/* Duck, horse and dog racing share one engine. Odds come from hidden strengths; the finishing order is drawn
   with Plackett-Luce from those same strengths, so displayed odds carry an 8% house edge. */
(() => {
  const EDGE = .92, DUR = 10500, N = 6;
  const THEMES = [
    { id: 'ducks', name: 'Duck Race', ic: 'bird', desc: 'Six ducks paddle for glory. Back your bird!', lane: 'linear-gradient(#2d8fd5,#1e6fb0)', flip: -1,
      names: ['Quackers', 'Sir Waddles', 'Duck Norris', 'Webster', 'Puddles', 'Donald', 'Mallory', 'Beaky', 'Ducky Balboa', 'Feathers'] },
    { id: 'horses', name: 'Horse Racing', ic: 'horse', desc: 'Six thoroughbreds on the turf. Win or place.', lane: 'linear-gradient(#3b8f3f,#2c7a31)', flip: -1,
      names: ['Thunderbolt', 'Lucky Star', 'Shadowfax', 'Blue Moon', 'Iron Duke', 'Silver Arrow', 'Midnight Run', 'Big Easy', 'Wild Clover', 'Black Pepper'] },
    { id: 'dogs', name: 'Dog Racing', ic: 'dog', desc: 'Greyhounds out of the traps! Pick the fastest.', lane: 'linear-gradient(#b5834f,#98683a)', flip: -1,
      names: ['Rocket', 'Biscuit', 'Zoomer', 'Bolt Jr.', 'Waffles', 'Scooby', 'Pickles', 'Turbo', 'Nugget', 'Maximus'] }
  ];
  const COLORS = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6', '#ff8c42'];
  function setup(seed, theme) {
    const rnd = Shared.rngFor(seed, 'field');
    const names = theme.names.slice(); for (let i = names.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [names[i], names[j]] = [names[j], names[i]]; }
    const w = Array.from({ length: N }, () => 1 + 5 * rnd() * rnd() + rnd()), sum = w.reduce((a, b) => a + b, 0), p = w.map(x => x / sum);
    return p.map((pi, i) => {
      let pPlace = pi; for (let j = 0; j < N; j++) if (j !== i) pPlace += p[j] * pi / (1 - p[j]);
      return { i, name: names[i], color: COLORS[i], p: pi, pPlace, win: Math.max(1.1, Math.floor(EDGE / pi * 10) / 10), place: Math.max(1.05, Math.floor(EDGE / pPlace * 10) / 10) };
    });
  }
  function raceOrder(seed, field) {
    const rnd = Shared.rngFor(seed, 'order'), left = field.map(f => f.i), order = [];
    while (left.length) { let r = rnd() * left.reduce((a, i) => a + field[i].p, 0), k = 0; for (; k < left.length - 1; k++) { r -= field[left[k]].p; if (r < 0) break; } order.push(left.splice(k, 1)[0]); }
    return order;
  }
  function profiles(seed, order) {
    const rnd = Shared.rngFor(seed, 'profile'), T = []; let t = 1;
    order.forEach(i => { T[i] = t; t += .015 + rnd() * .03; });
    return T.map(Ti => ({ T: Ti, a1: .03 + rnd() * .05, k1: 1 + Math.floor(rnd() * 3), p1: rnd() * 6.28, a2: .02 + rnd() * .04, k2: 2 + Math.floor(rnd() * 3), p2: rnd() * 6.28 }));
  }
  const prog = (pr, tau) => { const s = tau / pr.T; if (s >= 1) return 1; if (s <= 0) return 0; return s + 4 * s * (1 - s) * (pr.a1 * Math.sin(6.28 * pr.k1 * s + pr.p1) + pr.a2 * Math.sin(6.28 * pr.k2 * s + pr.p2)); };
  const payout = (b, field, order) => Object.keys(b).reduce((a, k) => { const f = field[+k.slice(1)]; return a + (k[0] === 'w' ? (order[0] === f.i ? b[k] * f.win : 0) : (order[0] === f.i || order[1] === f.i ? b[k] * f.place : 0)); }, 0);

  for (const th of THEMES) {
    Casino.register({
      id: th.id, name: th.name, desc: th.desc, multi: true,
      mount(root, opts) {
        const C = Casino;
        let field = [], fieldSeed = 0, soloSeed = C.rnd32(), bets = {}, last = null, dead = false, raf = 0, running = false;
        const total = () => Object.values(bets).reduce((a, b) => a + b, 0);
        const label = b => Object.keys(b).slice(0, 2).map(k => `${k[0] === 'w' ? 'Win' : 'Place'} #${+k.slice(1) + 1}`).join(', ') + (Object.keys(b).length > 2 ? ` +${Object.keys(b).length - 2}` : '');
        const G = {
          myBets: () => total() ? { bets: Object.assign({}, bets), stake: total(), label: label(bets) } : null,
          onBet(r) { newField(r.betSeed); $('#msg').textContent = 'Place your bets!'; $('#pod').innerHTML = ''; },
          onState() { $('#go').hidden = T.multi; $('#go').disabled = T.busy; },
          async run(r, my) {
            if (fieldSeed !== r.betSeed) newField(r.betSeed);
            running = true; $('#msg').textContent = ''; $('#pod').innerHTML = ''; T.main.querySelectorAll('.rplace').forEach(e => e.remove());
            const order = raceOrder(r.seed, field), prof = profiles(r.seed, order), best = new Array(N).fill(0);
            for (const n of ['3', '2', '1']) { $('#cd').textContent = n; C.sfx('click'); await C.sleep(550); if (dead) return null; }
            $('#cd').textContent = 'GO!'; const t0 = performance.now(), fin = new Array(N).fill(0), COAST = 500 / DUR;
            await new Promise(res => {
              const tick = now => {
                if (dead) return res(); const tau = (now - t0) / DUR; let all = true, endAt = 0;
                for (let i = 0; i < N; i++) {
                  best[i] = Math.max(best[i], prog(prof[i], tau));
                  if (best[i] >= 1 && !fin[i]) { fin[i] = tau; const k = order.indexOf(i), ln = $('#r' + i); if (ln) ln.parentNode.insertAdjacentHTML('beforeend', `<b class="rplace p${k}">${['1st', '2nd', '3rd'][k] || (k + 1) + 'th'}</b>`); if (k === 0) C.sfx('pop'); }
                  if (!fin[i]) all = false; else endAt = Math.max(endAt, fin[i] + COAST);
                  // progress 1 puts the runner's nose on the finish line; finishers then coast 30px past it
                  const coast = fin[i] ? Math.min(1, (tau - fin[i]) / COAST) : 0, el = $('#r' + i);
                  if (el) el.style.left = `calc(1% + ${best[i]} * (93% - 33px) + ${coast * 30}px)`;
                }
                if (!all || tau < endAt) raf = requestAnimationFrame(tick); else res();
              }; raf = requestAnimationFrame(tick);
            });
            running = false; if (dead) return null;
            $('#cd').textContent = '';
            $('#pod').innerHTML = order.slice(0, 3).map((i, k) => `<span><b class="medal m${k}">${k + 1}</b> ${i + 1}. ${field[i].name}</span>`).join('');
            if (!my) { $('#msg').textContent = `${field[order[0]].name} wins!`; return null; }
            last = my.bets;
            const ret = payout(my.bets, field, order), pw = Object.keys(my.bets).reduce((a, k) => a + my.bets[k] * (k[0] === 'w' ? field[+k.slice(1)].p : field[+k.slice(1)].pPlace), 0) / my.stake;
            $('#msg').textContent = ret > my.stake ? `${field[order[0]].name} wins! You collect ${C.fmt(ret)}` : `${field[order[0]].name} wins. Better luck next race.`;
            return { wagered: my.stake, returned: ret, p: pw };
          },
          resolve(r, b) { const f = setup(r.betSeed, th); return payout(b, f, raceOrder(r.seed, f)); },
          botBets(rng, s, r) {
            const f = setup(r.betSeed, th), ws = f.map(x => Math.pow(x.p, .6)); let u = rng() * ws.reduce((a, b) => a + b, 0), i = 0; for (; i < N - 1; i++) { u -= ws[i]; if (u < 0) break; }
            const k = (rng() < .7 ? 'w' : 'p') + i, st = T.botStake(rng); return { bets: { [k]: st }, stake: st, label: label({ [k]: 1 }) };
          },
          clear() {
            bets = {};
            if (!T.multi) { soloSeed = C.rnd32(); setTimeout(() => { if (!dead && !T.busy) { newField(soloSeed); $('#go').textContent = 'Start race'; } }, 2500); }
            drawOdds();
          }
        };
        const XR = (nx, cr, fn) => [cr && cr.seed && fn(cr, 'This round'), nx && fn(nx, 'Next round')].filter(Boolean).join('');
    G.xray = (nx, cr) => XR(nx, cr, (r, l) => { const f = r.betSeed && T.multi ? setup(r.betSeed, th) : field, o = raceOrder(r.seed, f); return Table.xl(l, `#${o[0] + 1} ${f[o[0]].name} wins`, `2nd #${o[1] + 1} ${f[o[1]].name} · 3rd #${o[2] + 1} ${f[o[2]].name}`); });
    const T = Table.attach(root, this, opts, G), $ = s => T.main.querySelector(s);
        T.main.innerHTML = `<div class="track" id="track"></div>
          <div class="race-status"><div class="msg" id="msg">Place your bets!</div><div class="countdown" id="cd"></div><div class="t-status pill-status"></div></div>
          <div class="card-box"><div class="oddsgrid" id="odds"></div></div>
          <div class="controls"><div id="chips"></div><div>Total bet <b id="tot" class="gold-num">$0</b></div><div class="btnrow"><button class="btn sec" id="clear">Clear</button><button class="btn sec" id="rebet">Rebet</button><button class="btn big gold" id="go">Start race</button></div></div>
          <div class="pod" id="pod"></div>`;
        const picker = C.chipPicker($('#chips'), 5);
        function drawTrack() { $('#track').innerHTML = field.map(f => `<div class="lane" style="--lane:${th.lane}"><span class="lname">${f.i + 1}. ${f.name}</span><div class="runner" id="r${f.i}" style="left:1%;--flip:${th.flip};--rc:${f.color}">${C.icon(th.ic, 40)}<span class="num" style="background:${f.color}">${f.i + 1}</span></div></div>`).join('') + '<div class="finish"></div>'; }
        function drawOdds() {
          $('#odds').innerHTML = field.map(f => `<div class="nm"><span class="sw" style="background:${f.color}"></span>${f.i + 1}. ${f.name}</div>
            <button class="obtn ${bets['w' + f.i] ? 'has' : ''}" data-k="w${f.i}"><small>WIN</small>${f.win.toFixed(1)}×${bets['w' + f.i] ? `<small>${C.fmt(bets['w' + f.i])}</small>` : ''}</button>
            <button class="obtn ${bets['p' + f.i] ? 'has' : ''}" data-k="p${f.i}"><small>PLACE (top 2)</small>${f.place.toFixed(1)}×${bets['p' + f.i] ? `<small>${C.fmt(bets['p' + f.i])}</small>` : ''}</button>`).join('');
          $('#tot').textContent = C.fmt(total());
        }
        function newField(seed) { if (running) return; fieldSeed = seed; field = setup(seed, th); drawTrack(); drawOdds(); }
        const canBet = () => !running && T.canBet();
        $('#odds').onclick = e => {
          const b = e.target.closest('.obtn'); if (!b) return;
          if (!canBet()) { if (T.multi) C.toast('Betting is closed — wait for the next race'); return; }
          const v = picker.get(); if (!C.wager(v)) return; bets[b.dataset.k] = (bets[b.dataset.k] || 0) + v; drawOdds(); C.sfx('click'); T.changed();
        };
        $('#clear').onclick = () => { if (!canBet()) return; C.refund(total()); bets = {}; drawOdds(); T.changed(); };
        $('#rebet').onclick = () => { if (!canBet() || !last) return; C.refund(total()); bets = {}; const need = Object.values(last).reduce((a, b) => a + b, 0); if (C.wager(need)) bets = Object.assign({}, last); drawOdds(); T.changed(); };
        $('#go').onclick = () => { if (!total()) return C.toast('Place a bet first'); T.playSolo({ betSeed: fieldSeed }); };
        if (!T.multi) newField(soloSeed);
        T.start();
        return () => { dead = true; cancelAnimationFrame(raf); T.cleanup(); };
      }
    });
  }
})();
