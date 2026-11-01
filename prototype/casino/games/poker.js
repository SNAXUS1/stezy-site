'use strict';
/* Texas Hold'em, 6-max no-limit (betting rules in Shared.pkApply). Offline: a local engine seats you with 1–5 bots. Live / Friends: server-run tables (humans + bots).
   Both produce the same table state, so one renderer draws every mode. */
Casino.register({
  id: 'poker', name: "Texas Hold'em", desc: 'Six-seat no-limit hold\'em against bots or real players. Pick your bet size, raise and bluff. Best five cards out of seven wins.', multi: true, noBots: true,
  mount(root, opts) { return pokerTable(root, opts); }
});

/** local engine: same rules as the server tables (ante, no-limit bets with up to 4 raises per street; min bet doubles on turn/river) */
function localPoker(cfg, onState) {
  const C = Casino, R = { ante: cfg.ante, seats: Array(6).fill(null), hand: null, button: 5, handId: 0 };
  const SPREAD = { 1: [3], 2: [2, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5] };
  const pool = Table.BOTS.slice().sort((a, b) => Shared.hash(a + 'pk6') - Shared.hash(b + 'pk6'));
  let timer = null, dead = false, paid = 0, nBots = cfg.bots;
  const meSeat = () => ({ kind: 'human', name: C.S.name, avatar: C.myProfile().avatar, color: C.S.profile.color, rating: C.S.rating });
  const botOf = name => { const b = Table.botSeat(name); return { kind: 'bot', name, avatar: b.avatar, rating: b.rating, color: b.color }; };
  function seatBots() { const want = SPREAD[nBots] || []; for (let i = 1; i < 6; i++) R.seats[i] = want.includes(i) ? (R.seats[i] && R.seats[i].name === pool[i - 1] ? R.seats[i] : botOf(pool[i - 1])) : null; }
  R.seats[0] = meSeat(); seatBots();
  const H = () => R.hand;
  const order = (from, incl = true) => { const out = []; for (let k = 1; k <= (incl ? 6 : 5); k++) { const i = (from + k) % 6; if (H().players[i] && !H().players[i].folded) out.push(i); } return out; };
  const active = () => Object.keys(H().players).map(Number).filter(i => !H().players[i].folded);
  function start() {
    if (dead || (R.hand && !R.hand.results)) return false;
    R.seats[0] = meSeat(); seatBots();
    const idx = R.seats.map((s, i) => s ? i : -1).filter(i => i >= 0);
    if (idx.length < 2 || !C.wager(R.ante)) return false;
    paid = R.ante; R.handId++; R.button = idx.find(i => i > R.button) ?? idx[0];
    const deck = Shared.deck(C.rnd), players = {};
    for (const i of idx) players[i] = { hole: [deck.pop(), deck.pop()], folded: false, contrib: R.ante, last: 'Ante' };
    R.hand = { id: R.handId, deck, players, board: [], pot: R.ante * idx.length, street: 0, turn: -1, bet: false, toAct: [], results: null };
    C.sfx('open'); street(); return true;
  }
  function street() {
    const h = H(); if (dead || !h) return;
    if (h.street === 1) h.board.push(h.deck.pop(), h.deck.pop(), h.deck.pop()); else if (h.street > 1) h.board.push(h.deck.pop());
    Shared.pkStreet(h, h.street < 2 ? R.ante : R.ante * 2); h.toAct = order(R.button);
    for (const i of h.toAct) h.players[i].last = h.street ? '' : 'Ante';
    next();
  }
  function next() {
    const h = H(); clearTimeout(timer);
    if (active().length <= 1) return end();
    while (h.toAct.length && h.players[h.toAct[0]].folded) h.toAct.shift();
    if (!h.toAct.length) { h.street++; h.turn = -1; if (h.street > 3) return end(); emit(); timer = setTimeout(street, 700); return; }
    h.turn = h.toAct.shift();
    if (R.seats[h.turn].kind === 'bot') timer = setTimeout(() => bot(h.turn), h.players[0] && !h.players[0].folded ? 650 + C.rnd() * 900 : 260);
    emit();
  }
  function act(i, a, amt) {
    const h = H(), p = h && h.players[i]; if (!p || p.folded || h.results || h.turn !== i) return;
    const raising = a === 'bet' || a === 'raise';
    // you can't bet more than your wallet holds
    if (i === 0 && raising) amt = Math.min(+amt || 0, p.sc + C.S.balance);
    if (i === 0 && (a === 'call' || raising)) { const owe = raising ? Math.max(h.cur + h.minR, Math.round(amt)) - p.sc : h.cur - p.sc; if (owe > C.S.balance) return; }
    const pay = Shared.pkApply(h, p, a, amt); if (pay < 0) return;
    if (i === 0 && pay > 0 && C.wager(pay)) paid += pay;
    if (raising) h.toAct = order(i, false);
    C.sfx(a === 'fold' || a === 'check' ? 'click' : 'pop');
    next();
  }
  function bot(i) {
    const h = H(); if (dead || !h || h.turn !== i) return;
    const p = h.players[i], opps = active().length - 1, eq = Shared.equity(p.hole, h.board, Math.max(1, opps), 110, C.rnd);
    const [a, amt] = Shared.pkBot(h, p, eq, opps, C.rnd); act(i, a, amt);
  }
  function end() {
    const h = H(); if (!h || h.results) return; clearTimeout(timer); h.turn = -1;
    const live = active(), scores = {}; let winners;
    if (live.length === 1) winners = live;
    else { while (h.board.length < 5) h.board.push(h.deck.pop()); live.forEach(i => scores[i] = Shared.best7(h.players[i].hole.concat(h.board))); const top = Math.max(...Object.values(scores)); winners = live.filter(i => scores[i] === top); }
    const share = h.pot / winners.length;
    h.results = Object.keys(h.players).map(Number).map(i => ({ seat: i, contrib: h.players[i].contrib, won: winners.includes(i) ? share : 0, hand: scores[i] != null ? Shared.catName(scores[i]) : '', show: live.length > 1 && !h.players[i].folded }));
    const r0 = h.results.find(x => x.seat === 0);
    if (r0) { C.settle('poker', paid, r0.won, 1 / h.results.length); paid = 0; }
    emit();
    if (cfg.auto()) timer = setTimeout(() => { if (!dead && !start()) emit(); }, 4200);
  }
  function snapshot() {
    const h = H(), xrOn = typeof Cheats !== 'undefined' && Cheats.xray();
    return {
      ante: R.ante, button: R.button, you: 0, now: Date.now(),
      seats: R.seats.map((s, i) => s && Object.assign({}, s, { inHand: !!(h && h.players[i]), folded: !!(h && h.players[i] && h.players[i].folded), contrib: h && h.players[i] ? h.players[i].contrib : 0, sc: h && h.players[i] ? h.players[i].sc || 0 : 0, last: h && h.players[i] ? h.players[i].last : '',
        cards: h && h.players[i] ? ((h.results && h.results.find(x => x.seat === i && x.show)) || i === 0 ? h.players[i].hole : 2) : 0,
        xr: xrOn && h && h.players[i] && i !== 0 && !h.results ? h.players[i].hole : null })),
      hand: h && { id: h.id, board: h.board.slice(), pot: h.pot, street: h.street, turn: h.turn, bet: h.bet, unit: h.unit, cur: h.cur, minR: h.minR, raises: h.raises, deadline: 0, results: h.results,
        upcoming: xrOn && !h.results ? h.deck.slice(h.deck.length - (5 - h.board.length)).reverse() : null }
    };
  }
  const emit = () => { if (!dead) onState(snapshot()); };
  return {
    start, emit, act: (a, amt) => act(0, a, amt), busy: () => !!(R.hand && !R.hand.results),
    setBots(n) { nBots = n; if (!(R.hand && !R.hand.results)) seatBots(); emit(); },
    setAnte(a) { R.ante = a; emit(); },
    cleanup() { dead = true; clearTimeout(timer); if (R.hand && !R.hand.results && paid > 0) C.settle('poker', paid, 0, .3); }
  };
}

function pokerTable(root, opts) {
  const C = Casino;
  let mode = opts.mode;
  if (mode !== 'solo' && !MP.online()) { C.toast('Server offline — playing against bots', 'bad'); mode = 'solo'; }
  const local = mode === 'solo', key = mode === 'live' ? 'pub:poker' : `prv:${opts.code}:poker`;
  root.innerHTML = `<div class="layout"><div><div class="ptable felt"><div class="prail"></div><div class="pcenter"><div class="potbox" id="pot"></div><div class="hand board" id="board"></div><div class="msg" id="msg"></div></div><div id="seats"></div></div>
    <div class="controls pkctl"><div class="pkinfo"><div class="betctl"><label>Stakes</label><b id="stakes" class="gold-num"></b></div><div class="pkhelp" id="help"></div></div><div class="btnrow" id="acts"></div></div></div>
    <aside class="tpanel" id="side"></aside></div>`;
  const $ = s => root.querySelector(s);
  let st = null, prev = null, isHost = false, botsN = local ? (C.S.lastBet.pokerBots || 5) : 3, ante = local ? (C.S.lastBet.pokerAnte || 10) : 10, auto = !!C.S.lastBet.pokerAuto, dead = false;
  const log = [], session = { n: 0, net: 0 }, paid = {}, settled = {};
  const say = t => { log.unshift(t); if (log.length > 9) log.length = 9; };

  /* ---------- backend ---------- */
  let eng = null, leave = null, unSettled = null;
  if (local) {
    eng = localPoker({ ante, bots: botsN, auto: () => auto }, s => onState(s));
    unSettled = C.on('settled', ({ id, profit }) => { if (id === 'poker' && !dead) { session.n++; session.net = C.r2(session.net + profit); } });
  } else {
    leave = MP.joinRoom(key, { bots: 3, ante: 10 }, m => {
      if (dead) return;
      if (m.t === 'pk:state') onState(m);
      else if (m.t === 'seats') { isHost = m.host === MP.cid(); botsN = m.bots.length; side(); }
    });
  }

  /* ---------- side panel ---------- */
  /** cheat X-ray: who wins if everyone still in reaches showdown, using the hidden cards and the coming board */
  function xrayHTML() {
    if (typeof Cheats === 'undefined' || !Cheats.xray()) return '';
    const h = st && st.hand, head = `<div class="xh">${C.icon('eye', 15)}X-RAY<i></i></div>`;
    if (!local) return `<div class="xray">${head}${Table.xl('Blocked', 'Server table', 'live hole cards never leave the server')}</div>`;
    if (!h || h.results || !h.upcoming) return `<div class="xray">${head}${Table.xl('Scanning', '…', 'deal a hand to see through the cards')}</div>`;
    const board = h.board.concat(h.upcoming), alive = st.seats.map((x, i) => x && x.inHand && !x.folded ? i : -1).filter(i => i >= 0);
    const hole = i => i === st.you ? st.seats[i].cards : st.seats[i].xr, sc = {}; alive.forEach(i => { if (hole(i)) sc[i] = Shared.best7(hole(i).concat(board)); });
    const top = Math.max(...Object.values(sc)), win = Object.keys(sc).map(Number).filter(i => sc[i] === top);
    return `<div class="xray">${head}${Table.xl('Showdown', win.map(i => i === st.you ? 'You win' : C.esc(st.seats[i].name) + ' wins').join(' & '), Shared.catName(top) + ' · if nobody folds')}${h.upcoming.length ? Table.xl('Coming board', h.upcoming.map(Table.xc).join(' ')) : ''}</div>`;
  }
  function side() {
    const names = { solo: 'Offline table', live: 'Live table', room: 'Private room' };
    $('#side').innerHTML = `<div class="thead"><span class="mbadge m-${local ? 'bots' : mode}">${names[mode]}</span><span class="tstat">${st && st.hand ? 'Hand #' + st.hand.id : 'Between hands'}</span></div>
      ${mode === 'room' ? `<div class="tcode"><div><small>Room code</small><b>${opts.code}</b></div><div class="btnrow"><button class="btn sec small" data-a="copy">${C.icon('copy', 14)}Copy</button><button class="btn small" data-a="invite">Invite</button></div></div>` : ''}
      ${local || (mode === 'room' && isHost) ? `<div class="tbots"><span>Bots at table</span><div class="stepper"><button data-a="bm">−</button><b>${botsN}</b><button data-a="bp">+</button></div></div>` : ''}
      ${local ? `<div class="tbots"><span>Ante</span><div class="seg3">${[10, 25, 100, 500].map(a => `<button data-ante="${a}" class="${ante === a ? 'on' : ''}">${a}</button>`).join('')}</div></div>
        <label class="tgl"><input type="checkbox" id="auto" ${auto ? 'checked' : ''}><span></span>Deal next hand automatically</label>` : ''}
      ${xrayHTML()}<div class="pklog"><h3>Table log</h3>${log.map(l => `<div>${l}</div>`).join('') || '<span class="muted">Hands and actions show up here.</span>'}</div>
      ${local ? `<div class="tfoot"><span>This session</span><b>${session.n} hand${session.n === 1 ? '' : 's'}</b><b class="${session.net >= 0 ? 'pos' : 'neg'}">${C.fmtS(session.net)}</b></div>` : ''}`;
  }
  $('#side').addEventListener('click', e => {
    const an = e.target.closest('[data-ante]');
    if (an) { if (eng.busy()) return C.toast('Ante changes apply between hands'); ante = +an.dataset.ante; C.S.lastBet.pokerAnte = ante; C.save(); eng.setAnte(ante); side(); return; }
    const b = e.target.closest('[data-a]'); if (!b) return;
    if (b.dataset.a === 'copy') { navigator.clipboard && navigator.clipboard.writeText(location.href); C.toast('Room link copied'); }
    if (b.dataset.a === 'invite') { const onl = MP.state().players.filter(p => p !== C.S.name); const m = C.modal(`<h2>Invite to poker</h2><div class="plist">${onl.map(p => `<div class="prow">${C.esc(p)}<button class="btn small" data-inv="${C.esc(p)}">Invite</button></div>`).join('') || '<p class="muted">Nobody else is online.</p>'}</div>`); m.el.onclick = ev => { const x = ev.target.closest('[data-inv]'); if (x) { MP.invite(x.dataset.inv, location.hash, 'poker'); x.disabled = true; x.textContent = 'Sent'; } }; }
    if (b.dataset.a === 'bm' || b.dataset.a === 'bp') {
      botsN = Math.max(local ? 1 : 0, Math.min(5, botsN + (b.dataset.a === 'bp' ? 1 : -1)));
      if (local) { C.S.lastBet.pokerBots = botsN; C.save(); eng.setBots(botsN); if (eng.busy()) C.toast('New bot count applies from the next hand'); }
      else MP.send({ t: 'setbots', room: key, n: botsN });
      side();
    }
  });
  $('#side').addEventListener('change', e => { if (e.target.id === 'auto') { auto = e.target.checked; C.S.lastBet.pokerAuto = auto; C.save(); if (auto && !eng.busy()) eng.start(); } });

  /* ---------- rendering ---------- */
  function seatHTML(s, i, pos, o) {
    const cards = Array.isArray(s.cards) ? s.cards.map(c => C.cardEl(c, false, 'sm ' + (o.dealt ? '' : 'noanim')).outerHTML).join('') : s.xr && !s.folded ? s.xr.map(c => C.cardEl(c, false, 'sm noanim xrc').outerHTML).join('') : s.cards ? `<div class="card sm down ${o.dealt ? '' : 'noanim'}"></div><div class="card sm down ${o.dealt ? '' : 'noanim'}"></div>` : '';
    const lastCls = { Bet: 'bet', Raise: 'bet', Call: 'call', Fold: 'fold', Check: 'check' }[s.last] || '';
    return `<div class="pseat pos-${pos} ${o.turn ? 'turn' : ''} ${s.folded ? 'folded' : ''} ${o.me ? 'me' : ''} ${o.win ? 'winner' : ''}" data-seat="${i}">
      <div class="pcards">${cards}</div>
      <div class="pplate">${C.avatar(s, 40)}<div class="pp-t"><b>${C.esc(s.name)}</b><small>${s.kind === 'bot' ? '<em class="bot">BOT</em>' : ''}${s.inHand === false && st.hand ? 'waiting' : s.kind !== 'bot' && MP.money(s.name) != null ? `<span class="smoney">${C.fmt(MP.money(s.name))}</span>` : C.tierOf(s.rating || 1000)}</small></div>${o.dealer ? '<span class="dbtn" title="Dealer button">D</span>' : ''}</div>
      ${s.last && s.inHand && s.last !== 'Ante' ? `<span class="pkact ${lastCls}">${C.esc(s.last)}</span>` : ''}
      ${s.contrib ? `<span class="pbet">${C.icon('poker-chip', 14)}${C.fmt(s.contrib)}</span>` : ''}
      ${o.hand ? `<div class="phand">${C.esc(o.hand)}</div>` : ''}${o.timer ? `<div class="ptimer"><i style="animation-duration:${o.timer}ms"></i></div>` : ''}</div>`;
  }
  function flyChips(from) {
    const pot = $('#pot'); if (!from || !pot) return;
    const a = from.getBoundingClientRect(), b = pot.getBoundingClientRect();
    for (let k = 0; k < 3; k++) {
      const c = document.createElement('i'); c.className = 'flychip'; c.style.left = (a.left + a.width / 2) + 'px'; c.style.top = (a.top + a.height / 2) + 'px'; document.body.append(c);
      c.animate([{ transform: 'translate(-50%,-50%) scale(.8)', opacity: 1 }, { transform: `translate(calc(-50% + ${b.left + b.width / 2 - a.left - a.width / 2}px), calc(-50% + ${b.top + b.height / 2 - a.top - a.height / 2}px)) scale(.6)`, opacity: .9 }], { duration: 520, delay: k * 70, easing: 'cubic-bezier(.5,0,.3,1)' }).onfinish = () => c.remove();
    }
  }
  let eqKey = '';
  function helper(s) {
    const h = s.hand, mine = s.you >= 0 ? s.seats[s.you] : null, el = $('#help');
    if (!h || !mine || !Array.isArray(mine.cards) || mine.folded || h.results) { el.innerHTML = h && h.results ? '' : `<span class="muted">${local ? 'Press Deal to start a hand. Everyone pays the ante.' : 'Hands start automatically when two or more players are seated.'}</span>`; return; }
    const k = h.id + ':' + h.board.length + ':' + Object.values(s.seats).filter(x => x && x.inHand && !x.folded).length;
    const cat = h.board.length >= 3 ? Shared.catName(Shared.best7(mine.cards.concat(h.board))) : (mine.cards[0].r === mine.cards[1].r ? 'Pocket pair' : mine.cards[0].s === mine.cards[1].s ? 'Suited cards' : 'High card');
    if (k === eqKey) { el.querySelector('.hcat').textContent = cat; return; }
    eqKey = k;
    const opps = s.seats.filter((x, i) => x && x.inHand && !x.folded && i !== s.you).length;
    const eq = Shared.equity(mine.cards, h.board, Math.max(1, opps), 260, C.rnd), p = Math.round(eq * 100);
    el.innerHTML = `<div class="hrow"><span>Your hand</span><b class="hcat">${cat}</b></div><div class="hrow"><span>Win chance vs ${opps}</span><b class="${p >= 50 ? 'pos' : p >= 25 ? '' : 'neg'}">${p}%</b></div><div class="eqbar"><i style="width:${p}%"></i></div>`;
  }
  function onState(s) {
    const h = s.hand, me = s.you, mySeat = me >= 0 ? s.seats[me] : null;
    // live tables: mirror the server's contributions in the local wallet
    if (!local && h && mySeat && mySeat.inHand) {
      if (paid[h.id] == null) { if (C.wager(s.ante)) paid[h.id] = s.ante; else { paid[h.id] = 0; MP.send({ t: 'pk:act', room: key, a: 'fold' }); } }
      const diff = C.r2(mySeat.contrib - (paid[h.id] || 0) - (paid[h.id] === 0 ? s.ante : 0));
      if (paid[h.id] > 0 && diff > 0) { if (C.wager(diff)) paid[h.id] += diff; }
      if (h.results && !settled[h.id] && paid[h.id] > 0) {
        settled[h.id] = true; const r = h.results.find(x => x.seat === me);
        const profit = C.settle('poker', paid[h.id], r ? r.won : 0, 1 / h.results.length); session.n++; session.net = C.r2(session.net + profit);
      }
    }
    // table log from state changes
    const ph = prev && prev.hand;
    if (h && (!ph || ph.id !== h.id)) say(`<b>Hand #${h.id}</b> · ante ${C.fmt(s.ante)}`);
    if (h) s.seats.forEach((x, i) => { const px = ph && ph.id === h.id && prev.seats[i]; if (x && x.inHand && x.last && x.last !== 'Ante' && (!px || px.last !== x.last || px.contrib !== x.contrib)) say(`${C.esc(x.name)} <span class="la ${x.last === 'Raise' ? 'bet' : x.last.toLowerCase()}">${x.last.toLowerCase()}s</span>${(x.last === 'Bet' || x.last === 'Raise') && x.sc ? (x.last === 'Raise' ? ' to ' : ' ') + C.fmt(x.sc) : x.last === 'Call' && px ? ' ' + C.fmt(x.contrib - px.contrib) : ''}`); });
    if (h && h.results && !(ph && ph.results && ph.id === h.id)) {
      const w = h.results.filter(r => r.won > 0), hn = (w.find(r => r.hand) || {}).hand;
      say(`🏆 <b>${w.map(r => C.esc((s.seats[r.seat] || {}).name || '?')).join(' & ')}</b> win${w.length === 1 ? 's' : ''} ${C.fmt(h.pot / w.length)}${hn ? ' with ' + hn : ''}`);
      if (w.some(r => r.seat === me)) setTimeout(() => C.fx.burst(root.querySelector('.pseat.me')), 50);
    }
    const newBoard = ph && h && ph.id === h.id ? ph.board.length : 0;
    st = s;
    $('#stakes').textContent = `${C.fmt(s.ante)} / ${C.fmt(s.ante * 2)}`;
    const potEl = $('#pot'); potEl.innerHTML = h ? `${C.icon('poker-chip', 18)}Pot <b>${C.fmt(h.pot)}</b>` : s.seats.filter(Boolean).length < 2 ? 'Waiting for players…' : local ? 'Ready when you are' : 'Next hand starting…';
    const board = $('#board'); board.innerHTML = '';
    (h ? h.board : []).forEach((c, i) => { const e = C.cardEl(c, false, i >= newBoard ? 'deal' : 'noanim'); if (i >= newBoard) e.style.animationDelay = ((i - newBoard) * 110) + 'ms'; board.append(e); });
    for (let i = h ? h.board.length : 0; i < 5; i++) board.insertAdjacentHTML('beforeend', '<div class="card slot noanim"></div>');
    const winners = h && h.results ? h.results.filter(r => r.won > 0).map(r => r.seat) : [];
    $('#seats').innerHTML = s.seats.map((x, i) => x ? seatHTML(x, i, me >= 0 ? (i - me + 6) % 6 : i, {
      me: i === me, turn: h && h.turn === i, win: winners.includes(i), dealer: h && s.button === i, dealt: h && (!ph || ph.id !== h.id) && x.inHand,
      hand: h && h.results ? (h.results.find(r => r.seat === i && r.show) || {}).hand : '', timer: !local && h && h.turn === i ? Math.max(0, h.deadline - MP.now()) : 0
    }) : '').join('');
    if (ph && h && ph.id === h.id) s.seats.forEach((x, i) => { if (x && prev.seats[i] && x.contrib > prev.seats[i].contrib) flyChips(root.querySelector(`.pseat[data-seat="${i}"] .pplate`)); });
    const msg = $('#msg');
    if (h && h.results) { const w = h.results.filter(r => r.won > 0).map(r => s.seats[r.seat] ? s.seats[r.seat].name : '?'); const hn = (h.results.find(r => r.won > 0 && r.hand) || {}).hand; msg.textContent = `${w.join(' & ')} win${w.length === 1 ? 's' : ''} ${C.fmt(h.pot / w.length)}${hn ? ' with ' + hn : ''}`; }
    else if (h && h.turn === me) msg.textContent = 'Your turn';
    else if (h && h.turn >= 0 && s.seats[h.turn]) msg.textContent = `${s.seats[h.turn].name} is thinking…`;
    else if (h) msg.textContent = ['Pre-flop', 'Flop', 'Turn', 'River'][Math.min(3, h.street)] + '…';
    else if (me < 0) msg.textContent = 'Table is full — watching';
    else msg.textContent = '';
    const acts = $('#acts');
    if (h && !h.results && h.turn === me && me >= 0) {
      const k = `${h.id}:${h.street}:${h.cur}:${h.raises}`;
      if (actKey !== k || !acts.querySelector('[data-a="fold"]')) { actKey = k; drawActs(h, mySeat); }
    } else if (local && !(h && !h.results)) acts.innerHTML = `<button class="btn big" data-a="deal">${C.icon('cards', 18)}${h ? 'Deal next hand' : 'Deal hand'} · ${C.fmt(ante)}</button>`;
    else acts.innerHTML = `<span class="muted waitnote">${h && mySeat && mySeat.inHand && !mySeat.folded ? 'Waiting for your turn…' : h && mySeat && mySeat.folded ? 'You folded — watching this hand' : local ? '' : 'You play from the next hand'}</span>`;
    if (!(h && !h.results && h.turn === me)) actKey = '';
    helper(s); side();
    prev = JSON.parse(JSON.stringify(s));
  }
  /* your turn: fold / check-call, plus a bet-sizing box (slider, presets, exact amount) */
  let actKey = '', rng = null;
  function drawActs(h, mine) {
    const sc = mine.sc || 0, owe = Math.max(0, (h.cur || 0) - sc), minTo = (h.cur || 0) + (h.minR || h.unit);
    const maxTo = Math.floor(Math.min(sc + C.S.balance, h.unit * 1000)), canR = (h.raises || 0) < 4 && maxTo >= minTo;
    const word = h.cur ? 'Raise to' : 'Bet', step = Math.max(1, Math.round(h.unit / 2));
    rng = { minTo, maxTo, sc, step, pot: h.pot, owe, cur: h.cur || 0, word };
    const fold = `<button class="btn red" data-a="fold">${C.icon('x', 16)}Fold</button>`;
    const cc = owe ? `<button class="btn" data-a="call" ${owe > C.S.balance ? 'disabled' : ''}>${C.icon('check', 16)}Call ${C.fmt(owe)}</button>` : `<button class="btn sec" data-a="check">${C.icon('check', 16)}Check</button>`;
    const box = canR ? `<div class="pkraise">
        <div class="pkrq">${[['min', 'Min'], ['.5', '½ Pot'], ['.75', '¾ Pot'], ['1', 'Pot'], ['all', 'All in']].map(([v, l]) => `<button data-rs="${v}">${l}</button>`).join('')}</div>
        <div class="pkrr"><button class="pkstep" data-rs="-">−</button><input type="range" id="rsl" min="${minTo}" max="${maxTo}" step="1" value="${minTo}"><button class="pkstep" data-rs="+">+</button>
          <label class="pkamt"><span>$</span><input type="number" id="ramt" min="${minTo}" max="${maxTo}" step="${step}" value="${minTo}"></label></div></div>` : '';
    $('#acts').innerHTML = `${box}<div class="pkbtns">${fold}${cc}${canR ? `<button class="btn big gold" data-a="raise" id="rbtn"></button>` : ''}</div>`;
    setRaise(minTo);
  }
  function setRaise(v) {
    if (!rng) return; v = Math.round(Math.max(rng.minTo, Math.min(rng.maxTo, +v || rng.minTo)));
    const sl = $('#rsl'), am = $('#ramt'), b = $('#rbtn'); if (!b) return;
    if (sl) { sl.value = v; sl.style.setProperty('--p', ((v - rng.minTo) / Math.max(1, rng.maxTo - rng.minTo) * 100) + '%'); }
    if (am && document.activeElement !== am) am.value = v;
    b.dataset.to = v; b.innerHTML = `${C.icon('poker-chip', 16)}${v >= rng.maxTo && rng.maxTo + 1 > rng.sc + C.S.balance ? 'All in ' : rng.word + ' '}${C.fmt(v)}`;
  }
  $('#acts').addEventListener('input', e => { if (e.target.id === 'rsl') setRaise(e.target.value); if (e.target.id === 'ramt') setRaise(e.target.value); });
  $('#acts').addEventListener('change', e => { if (e.target.id === 'ramt') { const v = e.target.value; e.target.blur(); setRaise(v); } });
  $('#acts').addEventListener('keydown', e => { if (e.target.id === 'ramt' && e.key === 'Enter') { e.target.blur(); setRaise(e.target.value); $('#rbtn').click(); } });
  $('#acts').addEventListener('click', e => {
    const q = e.target.closest('[data-rs]');
    if (q && rng) {
      const cur = +($('#rbtn') || {}).dataset.to || rng.minTo, v = q.dataset.rs;
      // pot-sized raise: call first, then raise by the pot after the call
      const potTo = f => rng.cur + (rng.pot + rng.owe) * f;
      setRaise(v === 'min' ? rng.minTo : v === 'all' ? rng.maxTo : v === '-' ? cur - rng.step : v === '+' ? cur + rng.step : potTo(+v));
      C.sfx('tick'); return;
    }
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    if (b.dataset.a === 'deal') { if (!eng.start()) C.toast('Could not start a hand — check your balance', 'bad'); return; }
    const amt = b.dataset.a === 'raise' ? +b.dataset.to : undefined;
    local ? eng.act(b.dataset.a, amt) : MP.send({ t: 'pk:act', room: key, a: b.dataset.a, amt });
    $('#acts').innerHTML = ''; actKey = ''; rng = null;
  });
  side();
  if (local) eng.emit();
  return () => {
    dead = true;
    if (local) { eng.cleanup(); unSettled(); }
    else { leave(); if (st && st.hand && paid[st.hand.id] > 0 && !settled[st.hand.id]) C.settle('poker', paid[st.hand.id], 0, .3); }
  };
}
