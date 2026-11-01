'use strict';
Casino.register({
  id: 'craps', name: 'Craps', desc: 'One shooter per round: come-out, point, and the decision. Pass, Don\'t Pass, Field, Any 7.', multi: true,
  mount(root, opts) {
    const C = Casino, die = n => `<span class="die d${n}">${'<i></i>'.repeat(n)}</span>`;
    const SPOTS = { pass: ['Pass Line', '1:1 · 7/11 or make the point', .493], dont: ['Don\'t Pass', '1:1 · 2/3 or seven-out · 12 push', .479], field: ['Field', 'first roll · 2,12 pay 2:1 · 3,4,9,10,11 pay 1:1', .444], any7: ['Any 7', 'first roll · pays 4:1', .167] };
    const payout = (b, d) => { const f = d.first; return (b.pass || 0) * (d.res === 'pass' ? 2 : 0) + (b.dont || 0) * (d.res === 'dont' ? 2 : d.res === 'bar' ? 1 : 0) + (b.field || 0) * ([3, 4, 9, 10, 11].includes(f) ? 2 : (f === 2 || f === 12) ? 3 : 0) + (b.any7 || 0) * (f === 7 ? 5 : 0); };
    const label = b => Object.keys(b).map(k => SPOTS[k][0]).join(', ');
    let bets = {}, last = null, dead = false, rolling = false;
    const total = () => Object.values(bets).reduce((a, b) => a + b, 0);
    const G = {
      myBets: () => total() ? { bets: Object.assign({}, bets), stake: total(), label: label(bets) } : null,
      onBet() { $('#msg').textContent = 'Place your bets — new shooter coming out'; $('#pt').textContent = 'OFF'; $('#pt').classList.remove('on'); root.querySelectorAll('.spot').forEach(s => s.classList.remove('win')); },
      onState() { $('#roll').hidden = T.multi; $('#roll').disabled = T.busy; },
      async run(r, my) {
        const d = Shared.crapsRound(r.seed); rolling = true; $('#msg').textContent = 'Come-out roll…'; $('#rolls').innerHTML = ''; $('#pt').textContent = 'OFF'; $('#pt').classList.remove('on');
        await C.sleep(300);
        for (let i = 0; i < d.rolls.length; i++) {
          for (let k = 0; k < 6; k++) { $('#dice').innerHTML = die(1 + C.rint(6)) + die(1 + C.rint(6)); $('#dice').classList.add('rolling'); C.sfx('tick'); await C.sleep(70); }
          if (dead) return null;
          const [a, b] = d.rolls[i], t = a + b; $('#dice').innerHTML = die(a) + die(b); $('#dice').classList.remove('rolling');
          $('#rolls').insertAdjacentHTML('beforeend', `<span class="${t === 7 ? 'lo' : t === d.point && i ? 'hi' : ''}">${t}</span>`);
          if (i === 0 && d.point) { $('#pt').textContent = d.point; $('#pt').classList.add('on'); $('#msg').textContent = `Point is ${d.point}`; }
          await C.sleep(i === d.rolls.length - 1 ? 300 : 650);
        }
        rolling = false;
        const txt = d.res === 'pass' ? (d.point ? `Point ${d.point} made — Pass wins` : `Natural ${d.first} — Pass wins`) : d.res === 'dont' ? (d.point ? 'Seven out — Don\'t Pass wins' : `Craps ${d.first} — Don't Pass wins`) : 'Craps 12 — Pass loses, Don\'t Pass pushes';
        root.querySelectorAll('.spot').forEach(s => { const k = s.dataset.k; if ((k === 'pass' && d.res === 'pass') || (k === 'dont' && d.res === 'dont') || (k === 'field' && payout({ field: 1 }, d)) || (k === 'any7' && d.first === 7)) s.classList.add('win'); });
        if (!my) { $('#msg').textContent = txt; return null; }
        last = my.bets;
        const ret = payout(my.bets, d), pw = Object.keys(my.bets).reduce((a, k) => a + my.bets[k] * SPOTS[k][2], 0) / my.stake;
        $('#msg').textContent = txt + (ret > my.stake ? ` · +${C.fmt(ret - my.stake)}` : ret < my.stake ? ` · -${C.fmt(my.stake - ret)}` : ' · push');
        return { wagered: my.stake, returned: ret, p: pw };
      },
      resolve: (r, b) => payout(b, Shared.crapsRound(r.seed)),
      botBets(rng) { const k = rng() < .62 ? 'pass' : 'dont', s = T.botStake(rng), b = { [k]: s }; if (rng() < .3) b.field = 10; if (rng() < .1) b.any7 = 5; return { bets: b, stake: Object.values(b).reduce((a, x) => a + x, 0), label: label(b) }; },
      clear() { bets = {}; paint(); }
    };
    const XR = (nx, cr, fn) => [cr && cr.seed && fn(cr, 'This round'), nx && fn(nx, 'Next round')].filter(Boolean).join('');
    G.xray = (nx, cr) => XR(nx, cr, (r, l) => { const d = Shared.crapsRound(r.seed); return Table.xl(l, { pass: 'Pass wins', dont: "Don't Pass wins", bar: "12 — Don't Pass pushes" }[d.res], `come-out ${d.first}${d.point ? ' · point ' + d.point : ''} · ${d.rolls.length} roll${d.rolls.length > 1 ? 's' : ''} · Field ${[2, 3, 4, 9, 10, 11, 12].includes(d.first) ? 'wins' : 'loses'} · Any 7 ${d.first === 7 ? 'wins' : 'loses'}`); });
    const T = Table.attach(root, this, opts, G), $ = s => T.main.querySelector(s);
    T.main.innerHTML = `<div class="table felt">
      <div class="craps-top"><div class="dicebox" id="dice">${die(1)}${die(1)}</div><div style="text-align:center"><div class="label">Point</div><div class="puck" id="pt">OFF</div></div></div>
      <div class="msg" id="msg">Place your bets</div><div class="t-status pill-status"></div><div class="pills" id="rolls" style="justify-content:center;margin-bottom:12px"></div>
      <div class="spots">${Object.keys(SPOTS).map(k => `<button class="spot" data-k="${k}">${SPOTS[k][0]}<small>${SPOTS[k][1]}</small><span class="amt"></span></button>`).join('')}</div></div>
      <div class="controls"><div id="chips"></div><div>Total bet <b id="tot" class="gold-num">$0</b></div><div class="btnrow"><button class="btn sec" id="clear">Clear</button><button class="btn sec" id="rebet">Rebet</button><button class="btn big" id="roll">Roll</button></div></div>`;
    const picker = C.chipPicker($('#chips'), 25);
    function paint() { root.querySelectorAll('.spot').forEach(s => s.querySelector('.amt').textContent = bets[s.dataset.k] ? C.fmt(bets[s.dataset.k]) : ''); $('#tot').textContent = C.fmt(total()); }
    const canBet = () => !rolling && T.canBet();
    root.querySelectorAll('.spot').forEach(b => b.onclick = () => { if (!canBet()) return T.multi && C.toast('Betting is closed'); const v = picker.get(); if (!C.wager(v)) return; bets[b.dataset.k] = (bets[b.dataset.k] || 0) + v; paint(); C.sfx('click'); T.changed(); });
    $('#clear').onclick = () => { if (!canBet()) return; C.refund(total()); bets = {}; paint(); T.changed(); };
    $('#rebet').onclick = () => { if (!canBet() || !last) return; C.refund(total()); bets = {}; const need = Object.values(last).reduce((a, b) => a + b, 0); if (C.wager(need)) bets = Object.assign({}, last); paint(); T.changed(); };
    $('#roll').onclick = () => { if (!total()) return C.toast('Place a bet first'); T.playSolo(); };
    T.start();
    return () => { dead = true; T.cleanup(); };
  }
});
