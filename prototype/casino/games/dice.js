'use strict';
Casino.register({
  id: 'dice', name: 'Dice', desc: 'Pick a target, roll over or under. You set the odds — up to 49.5×.', multi: true, isNew: true,
  mount(root, opts) {
    const C = Casino;
    let target = 50, over = true, pend = null, dead = false;
    const chance = (t, o) => o ? 100 - t : t, multOf = (t, o) => Math.floor(99 / chance(t, o) * 10000) / 10000;
    const wins = (b, roll) => b.over ? roll > b.t : roll < b.t;
    const lbl = b => `${b.over ? 'over' : 'under'} ${b.t} · ${multOf(b.t, b.over).toFixed(2)}×`;
    const G = {
      myBets: () => pend ? { bets: pend, stake: pend.s, label: lbl(pend) } : null,
      onBet() { $('#msg').textContent = 'Set your target and join the roll'; },
      onState: () => ui(),
      async run(r, my) {
        const roll = Shared.diceRoll(r.seed), t0 = performance.now(), D = 1300;
        await new Promise(res => { const tick = now => { if (dead) return res(); const t = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - t, 3), v = t < 1 ? (roll * e + C.rnd() * 100 * (1 - e)) : roll; $('#roll').textContent = v.toFixed(2); $('#marker').style.left = v + '%'; if (t < 1) requestAnimationFrame(tick); else res(); }; requestAnimationFrame(tick); });
        if (dead) return null;
        $('#marker').classList.add('show');
        const hist = $('#hist'); hist.insertAdjacentHTML('afterbegin', `<span class="${my && wins(my.bets, roll) ? 'hi' : ''}">${roll.toFixed(2)}</span>`); if (hist.children.length > 16) hist.lastChild.remove();
        if (!my) { $('#msg').textContent = `Rolled ${roll.toFixed(2)}`; return null; }
        const w = wins(my.bets, roll), ret = w ? C.r2(my.stake * multOf(my.bets.t, my.bets.over)) : 0;
        $('#roll').className = 'droll ' + (w ? 'pos' : 'neg');
        $('#msg').textContent = w ? `${roll.toFixed(2)} — you win ${C.fmt(ret - my.stake)}!` : `${roll.toFixed(2)} — missed`;
        return { wagered: my.stake, returned: ret, p: chance(my.bets.t, my.bets.over) / 100 };
      },
      resolve: (r, b) => wins(b, Shared.diceRoll(r.seed)) ? b.s * multOf(b.t, b.over) : 0,
      botBets(rng) { const t = 10 + Math.floor(rng() * 80), o = rng() < .5, s = T.botStake(rng), b = { s, t, over: o }; return { bets: b, stake: s, label: lbl(b) }; },
      clear() { pend = null; ui(); setTimeout(() => { if (!dead) { $('#roll').className = 'droll'; $('#marker').classList.remove('show'); } }, 1500); }
    };
    const XR = (nx, cr, fn) => [cr && cr.seed && fn(cr, 'This round'), nx && fn(nx, 'Next round')].filter(Boolean).join('');
    G.xray = (nx, cr) => XR(nx, cr, (r, l) => { const roll = Shared.diceRoll(r.seed), w = over ? roll > target : roll < target; return Table.xl(l, `rolls ${roll.toFixed(2)}`, `${w ? 'wins' : 'loses'} with roll ${over ? 'over' : 'under'} ${target}`); });
    const T = Table.attach(root, this, opts, G), $ = s => T.main.querySelector(s);
    T.main.innerHTML = `<div class="table dicebox2"><div class="droll" id="roll">50.00</div><div class="msg" id="msg">Set your target and roll</div><div class="t-status pill-status"></div>
        <div class="dslider"><div class="dtrack" id="track"></div><div class="dmarker" id="marker"></div><input type="range" id="tgt" min="2" max="98" value="50"></div>
        <div class="dstats"><div><small>Target</small><b id="tv">50</b></div><div><small>Win chance</small><b id="wc">50%</b></div><div><small>Multiplier</small><b id="mv" class="gold-num">1.98×</b></div>
        <div class="seg3" id="dir"><button data-o="0">Roll under</button><button data-o="1" class="on">Roll over</button></div></div></div>
      <div class="controls"><div id="bet"></div><div class="btnrow"><button class="btn big gold" id="go">Roll</button></div></div>
      <div class="sidebox" style="margin-top:14px"><h3>Recent rolls</h3><div class="pills" id="hist"></div></div>`;
    const bet = C.betControl($('#bet'), 'dice');
    function paint() {
      $('#tv').textContent = target; $('#wc').textContent = chance(target, over) + '%'; $('#mv').textContent = multOf(target, over).toFixed(2) + '×';
      $('#track').style.background = over ? `linear-gradient(90deg,#f0605d ${target}%,#34d399 ${target}%)` : `linear-gradient(90deg,#34d399 ${target}%,#f0605d ${target}%)`;
    }
    function ui() {
      const b = $('#go'); if (!b) return; const locked = !!pend || T.busy;
      $('#tgt').disabled = locked; root.querySelectorAll('#dir button').forEach(x => x.disabled = locked);
      if (!T.multi) { b.textContent = 'Roll'; b.disabled = T.busy; bet.lock(T.busy); return; }
      if (T.canBet()) { b.textContent = pend ? 'Cancel' : 'Join roll'; b.className = 'btn big ' + (pend ? 'sec' : 'gold'); b.disabled = false; } else { b.textContent = T.busy ? 'Rolling…' : 'Waiting…'; b.disabled = true; }
      bet.lock(!!pend);
    }
    $('#tgt').oninput = e => { target = +e.target.value; paint(); };
    $('#dir').onclick = e => { const b = e.target.closest('button'); if (!b || b.disabled) return; over = b.dataset.o === '1'; root.querySelectorAll('#dir button').forEach(x => x.classList.toggle('on', x === b)); paint(); };
    $('#go').onclick = () => {
      if (T.multi) { if (!T.canBet()) return; if (pend) { C.refund(pend.s); pend = null; } else { const s = bet.get(); if (!C.wager(s)) return; pend = { s, t: target, over }; } T.changed(); ui(); return; }
      if (T.busy) return; const s = bet.get(); if (!C.wager(s)) return; pend = { s, t: target, over }; T.playSolo();
    };
    paint(); T.start(); ui();
    return () => { dead = true; T.cleanup(); };
  }
});
