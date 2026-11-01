'use strict';
Casino.register({
  id: 'baccarat', name: 'Baccarat', desc: 'Bet on Player, Banker or Tie — plus pair side bets. Closest to 9 wins.', multi: true,
  mount(root, opts) {
    const C = Casino;
    const SPOTS = { P: ['Player', 'pays 1:1', .446], T: ['Tie', 'pays 8:1', .095], B: ['Banker', 'pays 0.95:1', .458], PP: ['Player Pair', 'pays 11:1', .077], BP: ['Banker Pair', 'pays 11:1', .077] };
    const payout = (b, d) => (b.P || 0) * (d.w === 'P' ? 2 : d.w === 'T' ? 1 : 0) + (b.B || 0) * (d.w === 'B' ? 1.95 : d.w === 'T' ? 1 : 0) + (b.T || 0) * (d.w === 'T' ? 9 : 0) + (b.PP || 0) * (d.ppair ? 12 : 0) + (b.BP || 0) * (d.bpair ? 12 : 0);
    const label = b => Object.keys(b).map(k => SPOTS[k][0]).join(', ');
    let bets = {}, last = null, dead = false, dealing = false;
    const road = [], total = () => Object.values(bets).reduce((a, b) => a + b, 0);
    const G = {
      myBets: () => total() ? { bets: Object.assign({}, bets), stake: total(), label: label(bets) } : null,
      onBet() { $('#msg').textContent = 'Place your bets'; root.querySelectorAll('.spot').forEach(s => s.classList.remove('win')); },
      onState() { $('#deal').hidden = T.multi; $('#deal').disabled = T.busy; },
      async run(r, my) {
        const d = Shared.baccaratRound(r.seed); dealing = true; $('#msg').textContent = '';
        $('#ph').innerHTML = $('#bh').innerHTML = ''; $('#pv').textContent = $('#bv').textContent = '';
        const v = c => (['10', 'J', 'Q', 'K'].includes(c.r) ? 0 : c.r === 'A' ? 1 : +c.r), tot = cs => cs.reduce((a, c) => a + v(c), 0) % 10;
        const P = [], B = [], add = (arr, src, el, i) => { arr.push(src[i]); $(el).append(C.cardEl(src[i])); C.sfx('click'); $('#pv').textContent = P.length ? tot(P) : ''; $('#bv').textContent = B.length ? tot(B) : ''; };
        add(P, d.P, '#ph', 0); await C.sleep(350); add(B, d.B, '#bh', 0); await C.sleep(350); add(P, d.P, '#ph', 1); await C.sleep(350); add(B, d.B, '#bh', 1); await C.sleep(600);
        if (d.P[2]) { add(P, d.P, '#ph', 2); await C.sleep(600); }
        if (d.B[2]) { add(B, d.B, '#bh', 2); await C.sleep(600); }
        dealing = false; if (dead) return null;
        road.push(d.w); if (road.length > 48) road.shift();
        $('#road').innerHTML = road.map(x => `<span class="bead b${x}">${x}</span>`).join('');
        const wname = { P: 'Player', B: 'Banker', T: 'Tie' }[d.w];
        root.querySelectorAll('.spot').forEach(s => { const k = s.dataset.k; if ((k === d.w) || (k === 'PP' && d.ppair) || (k === 'BP' && d.bpair)) s.classList.add('win'); });
        if (!my) { $('#msg').textContent = `${wname} wins ${d.pt}–${d.bt}`; return null; }
        last = my.bets;
        const ret = payout(my.bets, d), pw = Object.keys(my.bets).reduce((a, k) => a + my.bets[k] * SPOTS[k][2], 0) / my.stake;
        $('#msg').textContent = `${wname} wins ${d.pt}–${d.bt}` + (ret > my.stake ? ` · +${C.fmt(ret - my.stake)}` : ret < my.stake ? ` · -${C.fmt(my.stake - ret)}` : ' · push');
        return { wagered: my.stake, returned: ret, p: pw };
      },
      resolve: (r, b) => payout(b, Shared.baccaratRound(r.seed)),
      botBets(rng) { const u = rng(), k = u < .5 ? 'B' : u < .92 ? 'P' : 'T', s = T.botStake(rng), b = { [k]: s }; if (rng() < .15) b[rng() < .5 ? 'PP' : 'BP'] = 5; return { bets: b, stake: s + (b.PP || 0) + (b.BP || 0), label: label(b) }; },
      clear() { bets = {}; paint(); }
    };
    const XR = (nx, cr, fn) => [cr && cr.seed && fn(cr, 'This round'), nx && fn(nx, 'Next round')].filter(Boolean).join('');
    G.xray = (nx, cr) => XR(nx, cr, (r, l) => { const d = Shared.baccaratRound(r.seed); return Table.xl(l, { P: 'Player wins', B: 'Banker wins', T: 'Tie' }[d.w], `Player ${d.pt} – Banker ${d.bt}${d.ppair ? ' · Player pair' : ''}${d.bpair ? ' · Banker pair' : ''}`); });
    const T = Table.attach(root, this, opts, G), $ = s => T.main.querySelector(s);
    T.main.innerHTML = `<div class="table felt">
      <div class="bac-hands"><div><div class="label">Player <span id="pv"></span></div><div class="hand" id="ph"></div></div><div><div class="label">Banker <span id="bv"></span></div><div class="hand" id="bh"></div></div></div>
      <div class="msg" id="msg">Place your bets</div><div class="t-status pill-status"></div>
      <div class="spots">${Object.keys(SPOTS).map(k => `<button class="spot ${k.length > 1 ? 'side' : ''}" data-k="${k}">${SPOTS[k][0]}<small>${SPOTS[k][1]}</small><span class="amt"></span></button>`).join('')}</div></div>
      <div class="controls"><div id="chips"></div><div>Total bet <b id="tot" class="gold-num">$0</b></div><div class="btnrow"><button class="btn sec" id="clear">Clear</button><button class="btn sec" id="rebet">Rebet</button><button class="btn big" id="deal">Deal</button></div></div>
      <div class="sidebox" style="margin-top:14px"><h3>Bead road</h3><div class="road" id="road"></div></div>`;
    const picker = C.chipPicker($('#chips'), 25);
    function paint() { root.querySelectorAll('.spot').forEach(s => s.querySelector('.amt').textContent = bets[s.dataset.k] ? C.fmt(bets[s.dataset.k]) : ''); $('#tot').textContent = C.fmt(total()); }
    const canBet = () => !dealing && T.canBet();
    root.querySelectorAll('.spot').forEach(b => b.onclick = () => { if (!canBet()) return T.multi && C.toast('Betting is closed'); const v = picker.get(); if (!C.wager(v)) return; bets[b.dataset.k] = (bets[b.dataset.k] || 0) + v; paint(); C.sfx('click'); T.changed(); });
    $('#clear').onclick = () => { if (!canBet()) return; C.refund(total()); bets = {}; paint(); T.changed(); };
    $('#rebet').onclick = () => { if (!canBet() || !last) return; C.refund(total()); bets = {}; const need = Object.values(last).reduce((a, b) => a + b, 0); if (C.wager(need)) bets = Object.assign({}, last); paint(); T.changed(); };
    $('#deal').onclick = () => { if (!total()) return C.toast('Place a bet first'); T.playSolo(); };
    T.start();
    return () => { dead = true; T.cleanup(); };
  }
});
