'use strict';
/* Table framework: one code path for Solo, Bot tables (local clock), Live (public server room) and Friends (private room).
   Rounds are seed-driven: bet phase (betSeed) → run phase (seed). Bots' bets and results are derived from the seeds
   on every client, human players broadcast their bets/results through the server. */
const Table = (() => {
  const C = Casino;
  const BOTS = ['Lady Luck', 'Count Chipula', 'Dealer Dan', 'Roxy Rolls', 'Max Bet', 'Lucky Lou', 'Vegas Vic', 'Penny Pincher', 'Blaze', 'Nova', 'Chip Norris', 'Royal Rita', 'Big Tony', 'Snake Eyes', 'Queenie', 'Jackpot Jo'];
  const BSTY = ['bottts', 'fun-emoji', 'pixel-art', 'bottts-neutral'];
  const botSeat = name => ({ key: 'b:' + name, name, bot: true, avatar: { style: BSTY[Shared.hash(name) % BSTY.length], seed: name }, rating: 900 + Shared.hash(name + 'r') % 650, color: '#60a5fa' });
  /** stake a bot puts on the table, skewed small with the occasional high roller */
  const botStake = rng => [5, 10, 10, 25, 25, 50, 100, 250][Math.floor(rng() * 8)];

  function attach(root, def, opts, G) {
    let mode = opts.mode || 'solo';
    if ((mode === 'live' || mode === 'room') && !MP.online()) { C.toast('The casino is closed right now, so here is a bot table', 'bad'); mode = 'bots'; }
    const TM = Shared.TIMING[def.id] || { bet: 10000, run: () => 5000 };
    root.innerHTML = '<div class="layout"><div id="tmain"></div><aside class="tpanel" id="tside"></aside></div>';
    const side = root.querySelector('#tside');
    const server = mode === 'live' || mode === 'room';
    const T = { mode, multi: mode !== 'solo', main: root.querySelector('#tmain'), round: null, phase: mode === 'solo' ? 'idle' : 'wait', busy: false, dead: false, myKey: 'you', session: { n: 0, net: 0 }, spectating: false };
    let seats = [], leave = null, clock = null, ticker = null, botTimers = [], lastRun = null, isHost = mode === 'bots', code = opts.code || '', myLive = null;
    let botsN = mode === 'bots' ? 3 : 2, pendingSeed = null, lastXr = '', xrWas = false;
    // seeds are drawn one round ahead locally (Solo / Bots) so the cheat X-ray can peek; live seeds only exist on the server
    T.nextSeed = C.rnd32(); T.current = null;
    T.peek = () => mode === 'solo' ? { seed: T.nextSeed } : mode === 'bots' && T.round && T.round.phase === 'bet' && pendingSeed ? Object.assign({}, T.round, { seed: pendingSeed }) : null;
    const roomKey = mode === 'live' ? 'pub:' + def.id : 'prv:' + code + ':' + def.id;
    const now = () => server ? MP.now() : Date.now();
    T.now = now;
    T.remaining = (r = T.round) => r ? r.until - now() : 0;
    T.since = (r = T.round) => r ? now() - r.start : 0;
    T.canBet = () => mode === 'solo' ? !T.busy : !!(T.round && T.round.phase === 'bet' && T.remaining() > 400);
    T.seats = () => seats;
    const seat = k => seats.find(s => s.key === k);
    const state = () => { G.onState && G.onState(); };

    function meSeat() { return { key: T.myKey, name: C.S.name, me: true, avatar: C.myProfile().avatar, rating: C.S.rating, color: C.S.profile.color }; }
    function rebuild(humans, bots) {
      const old = Object.fromEntries(seats.map(s => [s.key, s]));
      seats = [meSeat(), ...humans, ...bots].map(s => Object.assign(s, old[s.key] ? { bet: old[s.key].bet, bets: old[s.key].bets, res: old[s.key].res, pending: old[s.key].pending, text: old[s.key].text } : {}));
    }
    function localBots() { const pool = BOTS.slice().sort((a, b) => Shared.hash(a + def.id) - Shared.hash(b + def.id)); rebuild([], pool.slice(0, botsN).map(botSeat)); }

    /* ---------- side panel ---------- */
    function draw() {
      if (T.dead) return;
      const names = { solo: 'Solo play', bots: 'Bot table', live: 'Live table', room: 'Private room' };
      const net = T.session.net;
      lastXr = '';
      side.innerHTML = `<div class="thead"><span class="mbadge m-${mode}">${names[mode]}</span><span class="tstat" id="tstat"></span></div><div class="xray" id="xray" hidden></div>
        ${mode === 'room' ? `<div class="tcode"><div><small>Room code</small><b>${code}</b></div><div class="btnrow"><button class="btn sec small" data-a="copy">${C.icon('copy', 14)}Copy</button><button class="btn small" data-a="invite">Invite</button></div></div>` : ''}
        ${mode === 'bots' || (mode === 'room' && isHost) ? `<div class="tbots"><span>Bots at table</span><div class="stepper"><button data-a="bm">−</button><b>${botsN}</b><button data-a="bp">+</button></div></div>` : ''}
        ${mode === 'solo' ? `<div class="tsolo">${C.icon('users', 18)}<span>Want company? Switch to <b>Bots</b>, <b>Live</b> or <b>Friends</b> above.</span></div>` : ''}
        <div class="seats">${seats.filter(s => mode !== 'solo' || s.me).map(s => `<div class="seat-row ${s.me ? 'me' : ''}">${C.avatar(s, 34)}
          <div class="sinfo">${s.me ? `<b>${C.esc(s.name)}</b>` : C.plink(s.name, `<b>${C.esc(s.name)}</b>`)}<small>${s.bot ? '<em class="bot">BOT</em>' : ''}${Math.round(s.rating || 1000)} · ${C.tierOf(s.rating || 1000)}</small>${!s.bot && mode !== 'solo' ? `<small class="smoney" data-n="${C.esc(s.name)}"></small>` : ''}</div>
          <div class="sbet">${s.bet ? `<b>${C.fmt(s.bet.stake)}</b><small>${C.esc(s.bet.label || '')}</small>` : `<small class="muted">${mode === 'solo' ? '' : 'no bet'}</small>`}</div>
          ${s.res != null ? `<span class="sres ${s.res > 0 ? 'pos' : s.res < 0 ? 'neg' : ''}">${s.res === 0 ? 'push' : C.fmtS(s.res)}</span>` : ''}</div>`).join('')}</div>
        <div class="tfoot"><span>This session</span><b>${T.session.n} round${T.session.n === 1 ? '' : 's'}</b><b class="${net >= 0 ? 'pos' : 'neg'}">${C.fmtS(net)}</b></div>`;
      tick();
    }
    function tick() {
      if (T.dead) return;
      side.querySelectorAll('.smoney').forEach(el => { el.textContent = C.fmt(MP.money(el.dataset.n) || 0); });
      const r = T.round; let txt;
      if (mode === 'solo') txt = T.busy ? 'Playing…' : 'Ready';
      else if (!r) txt = 'Connecting…';
      else if (r.phase === 'bet') txt = `Bets close in ${Math.max(0, Math.ceil(T.remaining() / 1000))}s`;
      else txt = T.spectating ? `Next round in ${Math.max(0, Math.ceil(T.remaining() / 1000))}s` : 'Round in progress';
      const el = side.querySelector('#tstat'); if (el) el.textContent = txt;
      T.main.querySelectorAll('.t-status').forEach(x => { x.textContent = txt; x.classList.toggle('hot', !!(r && r.phase === 'bet' && mode !== 'solo')); });
      xray();
    }
    /** cheat X-ray: the game describes the current and the upcoming round from their seeds */
    function xray() {
      const on = typeof Cheats !== 'undefined' && Cheats.xray() && G.xray, el = side.querySelector('#xray');
      if (!on) { if (xrWas) { xrWas = false; G.xrayOff && G.xrayOff(); } if (el) el.hidden = true; return; }
      xrWas = true; if (!el) return;
      let html; try { html = G.xray(T.peek(), T.current); } catch (e) { console.error(e); html = 'Signal lost.'; }
      if (!html) html = server ? '<div class="xl"><span>Blocked</span><b>Server table</b><em>Live seeds stay on the server until the round starts</em></div>' : '<div class="xl"><span>Scanning</span><b>…</b><em>waiting for the next round</em></div>';
      if (html !== lastXr) { lastXr = html; el.innerHTML = `<div class="xh">${C.icon('eye', 15)}X-RAY<i></i></div>${html}`; }
      el.hidden = false;
    }
    side.addEventListener('click', e => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      const a = b.dataset.a;
      if (a === 'copy') { navigator.clipboard && navigator.clipboard.writeText(location.href); C.toast('Room link copied — share it with friends'); }
      else if (a === 'invite') inviteDialog();
      else if (a === 'bm' || a === 'bp') {
        botsN = Math.max(mode === 'bots' ? 1 : 0, Math.min(5, botsN + (a === 'bp' ? 1 : -1)));
        if (mode === 'bots') { localBots(); if (T.round && T.round.phase === 'bet') scheduleBots(T.round); draw(); }
        else MP.send({ t: 'setbots', room: roomKey, n: botsN });
      }
    });
    function inviteDialog() {
      const onl = MP.state().players.filter(p => p !== C.S.name);
      const fr = C.S.friends.filter(f => onl.includes(f)), others = onl.filter(p => !fr.includes(p));
      const m = C.modal(`<h2>Invite to ${def.name}</h2><p class="muted">Room <b>${code}</b> · they get a notification with a Join button.</p>
        <div class="plist" style="margin-top:12px">${[...fr, ...others].map(p => `<div class="prow">${C.esc(p)}${fr.includes(p) ? '<em class="tier">Friend</em>' : ''}<button class="btn small" data-inv="${C.esc(p)}">Invite</button></div>`).join('') || '<p class="muted">Nobody else is online right now. Share the room link instead.</p>'}</div>`);
      m.el.addEventListener('click', e => { const b = e.target.closest('[data-inv]'); if (b) { MP.invite(b.dataset.inv, location.hash, def.id); b.disabled = true; b.textContent = 'Sent'; } });
    }

    /* ---------- bots ---------- */
    function scheduleBots(r) {
      botTimers.forEach(clearTimeout); botTimers = [];
      for (const s of seats) {
        if (!s.bot) continue;
        s.bet = null; s.bets = null; s.pending = null; s.res = null;
        const rng = Shared.rngFor(r.betSeed, s.key);
        if (rng() < .12) continue;
        const b = G.botBets(rng, s, r); if (!b) continue;
        s.pending = b;
        const at = Math.max(0, r.start + (.1 + rng() * .65) * (r.until - r.start) - now());
        botTimers.push(setTimeout(() => { if (T.round === r && s.pending) { s.bets = b.bets; s.bet = { stake: b.stake, label: b.label }; draw(); } }, at));
      }
    }
    function revealBots() { botTimers.forEach(clearTimeout); for (const s of seats) if (s.bot && s.pending && !s.bet) { s.bets = s.pending.bets; s.bet = { stake: s.pending.stake, label: s.pending.label }; } }
    function resolveBots(r) { for (const s of seats) if (s.bot && s.bets && s.res == null) s.res = C.r2(G.resolve(r, s.bets, s.key) - s.bet.stake); }

    /* ---------- rounds ---------- */
    function onRound(r) {
      if (T.dead) return;
      if (r.phase === 'bet') {
        if (T.round && T.round.id === r.id && T.round.phase === 'bet') { T.round = r; return; }
        T.round = r; T.phase = 'bet'; T.spectating = false;
        for (const s of seats) { s.bet = null; s.bets = null; s.res = null; s.text = ''; }
        G.onBet && G.onBet(r);
        scheduleBots(r); draw(); state();
      } else if (r.phase === 'run' && r.id !== lastRun) {
        lastRun = r.id; T.round = r; T.phase = 'run';
        revealBots();
        const my = G.myBets();
        T.spectating = !my && T.since(r) > (G.lateMs != null ? G.lateMs : 2500);
        state(); draw();
        if (T.spectating) { const left = T.remaining(r); setTimeout(() => { if (T.round === r) { resolveBots(r); draw(); } }, Math.max(0, left - 1500)); return; }
        playRound(r, my, false);
      }
    }
    async function playRound(r, my, solo, track = true) {
      if (!solo) T.busy = true;
      const live = { r, my, settled: !my }; if (track) myLive = live;
      T.current = r;
      const me = seat(T.myKey);
      if (my && me) { me.bet = { stake: my.stake, label: my.label }; me.res = null; }
      if (my && server) MP.send({ t: 'rbet', room: roomKey, round: r.id, stake: my.stake, label: my.label, bets: my.bets });
      let sent = false;
      const ctx = {
        solo, key: solo ? 'you' : T.myKey, seats: () => seats,
        deadline: solo ? Infinity : (TM.act ? r.start + TM.act : r.until), now,
        early(returned, text) { if (sent || !my) return; sent = true; if (me) me.res = C.r2(returned - my.stake); if (server) MP.send({ t: 'rres', room: roomKey, round: r.id, stake: my.stake, returned, text }); draw(); },
        botResult(s, returned) { if (s.res == null && s.bet) { s.res = C.r2(returned - s.bet.stake); draw(); } }
      };
      draw();
      let res = null;
      try { res = await G.run(r, my, ctx); } catch (e) { console.error(e); }
      if (T.dead) return res;
      if (res && !live.settled) {
        live.settled = true;
        const profit = C.settle(def.id, res.wagered, res.returned, res.p);
        T.session.n++; T.session.net = C.r2(T.session.net + profit);
        if (me) me.res = profit;
        if (!sent && server) MP.send({ t: 'rres', room: roomKey, round: r.id, stake: res.wagered, returned: res.wagered + profit, text: res.text || '' });
      }
      live.settled = true; if (myLive === live) myLive = null;
      if (!solo) { resolveBots(r); T.busy = false; }
      if (T.current === r) T.current = null;
      G.clear && G.clear(); draw(); state();
      return res;
    }
    /** Solo: game places its stake first, then calls this. `extra` can carry a betSeed chosen before betting. */
    T.playSolo = async (extra = {}, concurrent = false) => {
      if (mode !== 'solo' || (T.busy && !concurrent)) return null;
      const my = G.myBets(); if (!my) return null;
      const r = Object.assign({ id: 'solo' + C.rnd32(), phase: 'run', betSeed: C.rnd32(), seed: T.nextSeed, start: Date.now(), until: Infinity }, extra);
      T.nextSeed = C.rnd32();
      if (!concurrent) T.busy = true; state(); tick();
      const res = await playRound(r, my, true, !concurrent);
      if (!concurrent) T.busy = false;
      state(); tick();
      return res;
    };
    /** call when the player's placed bets change during the bet phase so others see them */
    let changeT = null;
    T.changed = () => {
      const my = G.myBets(), me = seat(T.myKey);
      if (me) me.bet = my ? { stake: my.stake, label: my.label } : null;
      draw();
      if (server && T.round && T.round.phase === 'bet') { clearTimeout(changeT); changeT = setTimeout(() => { const m = G.myBets(); MP.send({ t: 'rbet', room: roomKey, round: T.round.id, stake: m ? m.stake : 0, label: m ? m.label : '' }); }, 300); }
    };
    T.botStake = botStake;

    T.start = () => {
      if (mode === 'solo') { seats = [meSeat()]; draw(); state(); }
      else if (mode === 'bots') {
        localBots(); draw();
        let id = 0;
        const bet = () => { if (T.dead) return; id++; const t = Date.now(); pendingSeed = C.rnd32(); onRound({ id, phase: 'bet', betSeed: C.rnd32(), start: t, until: t + TM.bet }); clock = setTimeout(run, TM.bet); };
        const run = () => { if (T.dead) return; const t = Date.now(), seed = pendingSeed || C.rnd32(); pendingSeed = null; const r = Object.assign({}, T.round, { phase: 'run', seed, start: t, until: t + TM.run(seed) }); onRound(r); clock = setTimeout(bet, r.until - t); };
        bet();
      } else {
        T.myKey = 'c' + MP.cid(); seats = [meSeat()]; draw();
        leave = MP.joinRoom(roomKey, { bots: botsN }, m => {
          if (m.t === 'round') onRound(m);
          else if (m.t === 'seats') {
            isHost = m.host === MP.cid(); T.myKey = 'c' + MP.cid();
            rebuild(m.humans.filter(h => h.cid !== MP.cid()).map(h => ({ key: 'c' + h.cid, name: h.name, avatar: h.avatar, rating: h.rating, color: h.color })), m.bots.map(b => botSeat(b.name)));
            botsN = m.bots.length;
            if (T.round && T.round.phase === 'bet') scheduleBots(T.round);
            draw();
          } else if (m.t === 'rbet') { const s = seat('c' + m.cid); if (s) { s.bet = m.stake ? { stake: m.stake, label: m.label } : null; s.bets = m.bets; draw(); } }
          else if (m.t === 'rres') { const s = seat('c' + m.cid); if (s) { s.res = C.r2(m.returned - m.stake); draw(); } }
        });
      }
      ticker = setInterval(tick, 250);
    };
    T.cleanup = () => {
      T.dead = true; clearTimeout(clock); clearInterval(ticker); botTimers.forEach(clearTimeout); clearTimeout(changeT);
      if (leave) leave();
      const my = G.myBets && G.myBets();
      if (myLive && !myLive.settled) {          // round in progress: resolve it as if the player stood still
        myLive.settled = true; const ret = G.resolve(myLive.r, myLive.my.bets, T.myKey, true);
        C.settle(def.id, myLive.my.stake, ret, .4);
      } else if (my && my.stake && !T.busy) C.refund(my.stake);
    };
    return T;
  }
  /** X-ray helpers: a labelled line and an inline card */
  const xl = (label, value, note = '') => `<div class="xl"><span>${label}</span><b>${value}</b>${note ? `<em>${note}</em>` : ''}</div>`;
  const xc = c => `<i class="xc ${c.s === '♥' || c.s === '♦' ? 'r' : ''}">${c.r}${c.s}</i>`;
  return { attach, botSeat, botStake, BOTS, xl, xc };
})();
