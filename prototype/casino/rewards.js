'use strict';
/* Earn page & coin plans: daily lucky wheel with streaks, coin plans paid for with minigames, (nonsense) rewarded ads */
const Rewards = (() => {
  const C = Casino;
  const PRIZES = [
    { t: '$100', cash: 100, w: 18, c: '#1f2a37' }, { t: '$150', cash: 150, w: 16, c: '#173049' }, { t: '$250', cash: 250, w: 14, c: '#1f2a37' },
    { t: 'Bronze', chest: 'bronze', w: 12, c: '#5b3516' }, { t: '$400', cash: 400, w: 10, c: '#173049' }, { t: 'Charm', boost: 'charm', w: 8, c: '#14462f' },
    { t: '$600', cash: 600, w: 8, c: '#1f2a37' }, { t: 'Silver', chest: 'silver', w: 6, c: '#3b4656' }, { t: '$1,000', cash: 1000, w: 4, c: '#173049' },
    { t: 'Shield', boost: 'shield', w: 5, c: '#1e3a8a' }, { t: 'Gold', chest: 'gold', w: 2, c: '#6b4a0b' }, { t: 'JACKPOT', cash: 5000, w: 1, c: '#a16207' }
  ];
  const MILESTONES = { 3: { chest: 'bronze' }, 5: { boost: 'charm' }, 7: { chest: 'silver' }, 14: { chest: 'gold' }, 30: { chest: 'diamond' } };
  const mult = s => 1 + .2 * (Math.min(Math.max(s, 1), 11) - 1);
  const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return C.today(d); };
  const nextStreak = () => C.S.daily.last === yesterday() ? C.S.daily.streak + 1 : C.S.daily.last === C.today() ? C.S.daily.streak : 1;
  const AD_SECONDS = 15;   // ads are unlimited; C.S.ads only counts today's views
  const adsToday = () => C.S.ads.day === C.today() ? C.S.ads.n : 0;
  const adReward = () => Math.round(120 * (1 + .05 * Math.min(C.S.daily.streak, 20)));
  const COOL = 3 * 60 * 1000;
  const coolLeft = k => Math.max(0, (C.S.cool[k] || 0) - Date.now());
  const fmtT = ms => { const s = Math.ceil(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = String(s % 60).padStart(2, '0'); return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}:${ss}`; };
  const fmtDur = ms => ms >= 36e5 ? `${ms / 36e5}h` : `${ms / 6e4} min`;

  function award(p, m) {
    if (p.cash) C.credit(Math.round(p.cash * m), 'Daily wheel');
    if (p.chest) Eco.grantChest(p.chest, 'from the daily wheel');
    if (p.boost) { Eco.addItem({ kind: 'boost', type: p.boost }); C.toast(`${Eco.BOOSTS[p.boost].name} bonus card added`, 'gold'); }
  }

  /* ---------- minigames: each play(goal) resolves { score, passed, text, aborted } ---------- */
  const MINI = {
    memory: { name: 'Memory Match', icon: 'brain', color: '#a78bfa', desc: 'Flip cards and find all 8 pairs. Fewer moves is better.', unit: 'moves', lower: true, goals: [24, 20, 18, 16, 14], pay: r => Math.max(60, Math.min(350, Math.round(420 - r.score * 12 - r.secs * 3))), payText: 'up to $350' },
    targets: { name: 'Target Rush', icon: 'target', color: '#f87171', desc: 'Click as many targets as you can in 20 seconds.', unit: 'hits', goals: [10, 14, 18, 22, 26], pay: r => Math.min(300, r.score * 8), payText: '$8 per hit' },
    math: { name: 'Quick Math', icon: 'calc', color: '#60a5fa', desc: 'Solve sums for 30 seconds. Type the answer and press Enter.', unit: 'correct', goals: [5, 7, 9, 11, 13], pay: r => Math.min(300, r.score * 15), payText: '$15 per answer' },
    reaction: { name: 'Reflex Test', icon: 'lightning', color: '#fbbf24', desc: 'Click the moment the panel turns green. Five tries, average time counts.', unit: 'ms', lower: true, goals: [520, 450, 400, 360, 320], pay: r => Math.max(40, Math.min(300, Math.round((650 - r.score) * .9))), payText: 'up to $300' },
    needle: { name: 'Stop the Needle', icon: 'crosshair', color: '#34d399', desc: 'Stop the sliding needle inside the gold zone. Six tries, it speeds up.', unit: 'hits', goals: [2, 3, 4, 4, 5], pay: r => r.score * 45, payText: '$45 per hit' }
  };
  /** standard minigame shell: intro → game → result. `run(body, hud, finish)` drives the game. */
  function shell(k, goal, run) {
    const M = MINI[k];
    return new Promise(resolve => {
      const m = C.modal(`<div class="mg"><div class="mghead"><div class="gtile" style="--ac:${M.color}">${C.icon(M.icon, 24)}</div><div><h2>${M.name}</h2><p class="muted">${M.desc}</p></div></div>
        ${goal != null ? `<div class="mggoal">${C.icon('flag-checkered', 16)}Goal: <b>${M.lower ? 'at most' : 'at least'} ${goal} ${M.unit}</b></div>` : ''}
        <div class="mghud" id="hud"></div><div class="mgbody" id="body"><div class="mgintro"><div class="mgbig">${C.icon(M.icon, 64)}</div><button class="btn big" id="mgstart">${C.icon('play', 18)}Start</button><button class="btn sec small" id="mgquit">Not now</button></div></div></div>`, { cls: 'mid', noClose: true });
      const q = s => m.el.querySelector(s), body = q('#body'), hud = q('#hud');
      q('#mgquit').onclick = () => { m.close(); resolve({ aborted: true }); };
      q('#mgstart').onclick = () => {
        body.innerHTML = ''; C.sfx('pop');
        run(body, h => { hud.innerHTML = h; }, r => {
          r.passed = goal == null ? true : M.lower ? r.score <= goal : r.score >= goal;
          r.text = `${r.score} ${M.unit}`;
          hud.innerHTML = '';
          body.innerHTML = `<div class="mgres ${r.passed ? 'ok' : 'no'}"><div class="mgscore">${r.score}<small>${M.unit}</small></div>
            <h3>${goal == null ? 'Nice run!' : r.passed ? 'Goal reached!' : 'Goal missed'}</h3>${goal != null ? `<p class="muted">Goal: ${M.lower ? '≤' : '≥'} ${goal} ${M.unit}</p>` : ''}
            <button class="btn big" id="mgok">Continue</button></div>`;
          C.sfx(r.passed ? 'win' : 'lose'); if (r.passed) C.fx.burst(body);
          q('#mgok').onclick = () => { m.close(); resolve(r); };
        });
      };
    });
  }
  const timerHud = (left, label, val) => `<span>${C.icon('timer', 16)}<b>${Math.max(0, Math.ceil(left))}s</b></span><span>${label} <b>${val}</b></span>`;
  MINI.memory.play = goal => shell('memory', goal, (body, hud, finish) => {
    const ics = ['spade', 'roulette', 'dice-five', 'cherries', 'rocket-launch', 'bomb', 'treasure-chest', 'crown'], deck = C.shuffle([...ics, ...ics]);
    body.innerHTML = `<div class="memgrid">${deck.map((ic, i) => `<button class="mem" data-i="${i}" style="--i:${i}"><span>${C.icon(ic, 30)}</span></button>`).join('')}</div>`;
    let open = [], moves = 0, found = 0, lock = false; const t0 = Date.now();
    const upd = () => hud(`<span>${C.icon('arrows-clockwise', 16)}Moves <b>${moves}</b></span><span>${C.icon('timer', 16)}<b>${Math.floor((Date.now() - t0) / 1000)}s</b></span><span>Pairs <b>${found}/8</b></span>`);
    const tm = setInterval(upd, 500); upd();
    body.addEventListener('click', e => {
      const b = e.target.closest('.mem'); if (!b || lock || b.classList.contains('up')) return;
      b.classList.add('up'); open.push(b); C.sfx('click');
      if (open.length < 2) return;
      moves++; const [a, c] = open; open = [];
      if (deck[a.dataset.i] === deck[c.dataset.i]) {
        a.classList.add('ok'); c.classList.add('ok'); found++; upd();
        if (found === 8) { clearInterval(tm); setTimeout(() => finish({ score: moves, secs: (Date.now() - t0) / 1000 }), 450); }
      } else { lock = true; a.classList.add('bad'); c.classList.add('bad'); setTimeout(() => { a.classList.remove('up', 'bad'); c.classList.remove('up', 'bad'); lock = false; }, 650); }
      upd();
    });
  });
  MINI.targets.play = goal => shell('targets', goal, (body, hud, finish) => {
    body.innerHTML = '<div class="tarea" id="ta"></div>'; const ta = body.querySelector('#ta'); let hits = 0; const t0 = Date.now();
    const spawn = () => { ta.innerHTML = ''; const b = document.createElement('button'); b.className = 'tgt'; const s = 34 + C.rint(26); b.style.cssText = `width:${s}px;height:${s}px;left:${C.rint(92)}%;top:${C.rint(86)}%`; b.onclick = e => { e.stopPropagation(); hits++; C.sfx('tick'); spawn(); }; ta.append(b); };
    spawn();
    const tm = setInterval(() => { const left = 20 - (Date.now() - t0) / 1000; hud(timerHud(left, 'Hits', hits)); if (left <= 0) { clearInterval(tm); finish({ score: hits }); } }, 100);
  });
  MINI.math.play = goal => shell('math', goal, (body, hud, finish) => {
    body.innerHTML = '<div class="mathq" id="mq"></div><input id="ma" type="number" inputmode="numeric" autocomplete="off" placeholder="Answer + Enter">';
    let ok = 0, ans = 0; const t0 = Date.now(), inp = body.querySelector('#ma'), mq = body.querySelector('#mq');
    const next = () => { const op = C.rint(3), a = 2 + C.rint(op === 2 ? 11 : 49), b = 2 + C.rint(op === 2 ? 11 : 49); ans = op === 0 ? a + b : op === 1 ? a - b : a * b; mq.textContent = `${a} ${['+', '−', '×'][op]} ${b} = ?`; mq.classList.remove('pop'); void mq.offsetWidth; mq.classList.add('pop'); inp.value = ''; };
    inp.onkeydown = e => { if (e.key !== 'Enter') return; if (+inp.value === ans) { ok++; C.sfx('tick'); } else { C.sfx('lose'); inp.classList.remove('shake'); void inp.offsetWidth; inp.classList.add('shake'); } next(); };
    next(); setTimeout(() => inp.focus(), 50);
    const tm = setInterval(() => { const left = 30 - (Date.now() - t0) / 1000; hud(timerHud(left, 'Correct', ok)); if (left <= 0) { clearInterval(tm); inp.disabled = true; finish({ score: ok }); } }, 100);
  });
  MINI.reaction.play = goal => shell('reaction', goal, (body, hud, finish) => {
    body.innerHTML = '<button class="rxpad wait" id="rx"><b>Wait for green…</b><small>Click as soon as it changes</small></button>';
    const pad = body.querySelector('#rx'), times = []; let state = 'wait', t0 = 0, tm = null;
    const upd = () => hud(`<span>Try <b>${Math.min(times.length + 1, 5)}/5</b></span><span>Average <b>${times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) + ' ms' : '—'}</b></span>`);
    const arm = () => { state = 'wait'; pad.className = 'rxpad wait'; pad.innerHTML = '<b>Wait for green…</b><small>Click as soon as it changes</small>'; tm = setTimeout(() => { state = 'go'; t0 = performance.now(); pad.className = 'rxpad go'; pad.innerHTML = '<b>CLICK!</b>'; }, 1100 + C.rnd() * 2400); upd(); };
    pad.onmousedown = () => {
      if (state === 'wait') { clearTimeout(tm); state = 'early'; pad.className = 'rxpad early'; pad.innerHTML = '<b>Too soon!</b><small>That try counts as 1000 ms</small>'; times.push(1000); C.sfx('lose'); }
      else if (state === 'go') { const ms = Math.round(performance.now() - t0); times.push(ms); state = 'shown'; pad.className = 'rxpad shown'; pad.innerHTML = `<b>${ms} ms</b>`; C.sfx('tick'); }
      else return;
      upd();
      if (times.length >= 5) { setTimeout(() => finish({ score: Math.round(times.reduce((a, b) => a + b, 0) / times.length) }), 700); return; }
      setTimeout(arm, 900);
    };
    arm();
  });
  MINI.needle.play = goal => shell('needle', goal, (body, hud, finish) => {
    body.innerHTML = '<div class="ndl"><div class="ntrack"><i class="nzone"></i><b class="nneedle"></b></div><button class="btn big" id="nstop">Stop!</button><small class="muted">Tip: Space works too</small></div>';
    const zone = body.querySelector('.nzone'), needle = body.querySelector('.nneedle'), btn = body.querySelector('#nstop');
    let tries = 0, hits = 0, x = 0, dir = 1, raf = 0, last = performance.now(), zl = 0, zw = 0, live = true;
    const place = () => { zw = 16 - tries * 1.2; zl = 8 + C.rnd() * (84 - zw); zone.style.left = zl + '%'; zone.style.width = zw + '%'; };
    const upd = () => hud(`<span>Try <b>${Math.min(tries + 1, 6)}/6</b></span><span>Hits <b>${hits}</b></span>`);
    const loop = now => { const dt = (now - last) / 1000; last = now; x += dir * (55 + tries * 14) * dt; if (x >= 100) { x = 100; dir = -1; } if (x <= 0) { x = 0; dir = 1; } needle.style.left = x + '%'; if (live) raf = requestAnimationFrame(loop); };
    const stop = () => {
      if (!live) return; live = false; cancelAnimationFrame(raf);
      const hit = x >= zl && x <= zl + zw; tries++; if (hit) hits++;
      needle.classList.add(hit ? 'hit' : 'miss'); C.sfx(hit ? 'coin' : 'lose'); upd();
      setTimeout(() => {
        needle.classList.remove('hit', 'miss');
        if (tries >= 6) { removeEventListener('keydown', key); return finish({ score: hits }); }
        place(); live = true; last = performance.now(); raf = requestAnimationFrame(loop);
      }, 650);
    };
    const key = e => { if (e.code === 'Space') { e.preventDefault(); stop(); } };
    addEventListener('keydown', key); btn.onclick = stop;
    place(); upd(); raf = requestAnimationFrame(loop);
  });

  /* ---------- coin plans (opened from the balance in the header) ---------- */
  const LEVELS = ['Easy', 'Normal', 'Tricky', 'Hard', 'Expert'];
  const PLANS = [
    { id: 'pocket', name: 'Pocket Change', coins: 300, games: 1, level: 0, cool: 10 * 6e4, color: '#94a3b8', icon: 'coin' },
    { id: 'starter', name: 'Starter Stack', coins: 1200, games: 2, level: 1, cool: 30 * 6e4, color: '#34d399', icon: 'coins' },
    { id: 'roller', name: 'High Roller', coins: 4000, games: 3, level: 2, cool: 2 * 36e5, color: '#60a5fa', icon: 'hand-coins', tag: 'Popular' },
    { id: 'whale', name: 'Whale Pack', coins: 12000, games: 4, level: 3, cool: 8 * 36e5, color: '#a78bfa', icon: 'piggy-bank' },
    { id: 'tycoon', name: 'Casino Tycoon', coins: 40000, games: 5, level: 4, cool: 24 * 36e5, color: '#f5c451', icon: 'crown', tag: 'Best value' }
  ];
  const planCool = p => Math.max(0, (C.S.plans[p.id] || 0) - Date.now());
  let coinsOpen = null;
  function openCoins() {
    if (coinsOpen) return;
    const m = C.modal(`<div class="coins"><div class="coinshead"><div class="gtile" style="--ac:#f5c451">${C.icon('coins', 26)}</div><div class="ch-t"><h2>Get more coins</h2><p class="muted">Pick a plan. You don't pay money — you pay with minigames. Beat every goal to unlock the coins.</p></div>
      <div class="cbal"><small>Balance</small><b id="cbal"></b></div></div><div class="plans" id="plans"></div>
      <div class="coinsfoot"><span>${C.icon('gift', 16)}More free coins:</span><a href="#/earn" data-go>Daily wheel</a><button class="linkbtn" data-ad>Watch an ad</button><a href="#/earn" data-go>Free-play minigames</a></div></div>`, { cls: 'wide', onClose: () => { clearInterval(tm); coinsOpen = null; } });
    coinsOpen = m;
    m.el.querySelector('#plans').innerHTML = PLANS.map((p, i) => `<div class="plan ${p.tag ? 'hot' : ''}" style="--pc:${p.color};--i:${i}">${p.tag ? `<span class="ptag">${p.tag}</span>` : ''}
      <div class="picon">${C.icon(p.icon, 30)}</div><h3>${p.name}</h3><div class="pcoins">${C.fmt(p.coins)}</div>
      <div class="pcost">${C.icon('game-controller', 16)}<b>${p.games}</b> minigame${p.games > 1 ? 's' : ''}</div>
      <ul class="pfeat"><li>${C.icon('target', 14)}${LEVELS[p.level]} goals</li><li>${C.icon('arrows-clockwise', 14)}1 retry if you miss</li><li>${C.icon('clock', 14)}Cooldown ${fmtDur(p.cool)}</li></ul>
      <button class="btn ${p.tag ? 'gold' : ''}" data-plan="${p.id}"></button></div>`).join('');
    const draw = () => {
      m.el.querySelector('#cbal').textContent = C.fmt(C.S.balance);
      for (const p of PLANS) { const b = m.el.querySelector(`[data-plan="${p.id}"]`), cl = planCool(p); b.disabled = !!cl; b.textContent = cl ? `Ready in ${fmtT(cl)}` : 'Start challenge'; }
    };
    draw(); const tm = setInterval(draw, 1000);
    m.el.addEventListener('click', e => {
      const b = e.target.closest('[data-plan]'); if (b) { const p = PLANS.find(x => x.id === b.dataset.plan); m.close(); runPlan(p); return; }
      if (e.target.closest('[data-go]')) m.close();
      if (e.target.closest('[data-ad]')) { m.close(); adFlow(); }
    });
  }
  function planStep(p, picks, i) {
    return new Promise(res => {
      const M = MINI[picks[i]], goal = M.goals[p.level];
      const m = C.modal(`<div class="pstep"><small class="muted">${p.name} · ${C.fmt(p.coins)}</small><h2>Game ${i + 1} of ${picks.length}</h2>
        <div class="ppath">${picks.map((k, j) => `<div class="pnode ${j < i ? 'done' : j === i ? 'cur' : ''}" style="--ac:${MINI[k].color}"><span>${C.icon(j < i ? 'check' : MINI[k].icon, 20)}</span><small>${MINI[k].name}</small></div>`).join('<i class="plink2"></i>')}<i class="plink2"></i><div class="pnode prize"><span>${C.icon('coins', 20)}</span><small>${C.fmt(p.coins)}</small></div></div>
        <div class="pnext"><div class="gtile" style="--ac:${M.color}">${C.icon(M.icon, 24)}</div><div><b>${M.name}</b><p class="muted">${M.desc}</p><div class="mggoal">${C.icon('flag-checkered', 16)}Goal: <b>${M.lower ? 'at most' : 'at least'} ${goal} ${M.unit}</b></div></div></div>
        <div class="btnrow" style="justify-content:flex-end;margin-top:16px"><button class="btn sec" data-a="quit">Give up</button><button class="btn" data-a="go">${C.icon('play', 16)}Play</button></div></div>`, { cls: 'mid', onClose: () => res(false) });
      m.el.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b) { res(b.dataset.a === 'go'); m.close(); } });
    });
  }
  async function runPlan(p) {
    if (planCool(p)) return;
    const picks = C.shuffle(Object.keys(MINI)).slice(0, p.games);
    let retries = 1;
    for (let i = 0; i < picks.length; i++) {
      if (!(await planStep(p, picks, i))) return C.toast('Challenge abandoned — no cooldown applied');
      const r = await MINI[picks[i]].play(MINI[picks[i]].goals[p.level]);
      if (r.aborted) return C.toast('Challenge abandoned — no cooldown applied');
      if (!r.passed) {
        if (retries > 0 && await C.ask(`Missed it — ${r.text}. Try ${MINI[picks[i]].name} again?`, 'Retry', 'You get one retry per challenge.')) { retries--; i--; continue; }
        return C.toast(`${p.name} challenge failed. Try an easier plan!`, 'bad');
      }
    }
    C.S.plans[p.id] = Date.now() + p.cool; C.save();
    C.credit(p.coins, `${p.name} unlocked`); C.fx.confetti(220, innerWidth / 2, innerHeight * .3, true);
  }

  /* ---------- rewarded ads live in ads.js ---------- */
  const watchAd = done => Ads.watch(done);
  function adFlow(after) {
    watchAd(() => { C.S.ads = { day: C.today(), n: (C.S.ads.day === C.today() ? C.S.ads.n : 0) + 1 }; C.credit(adReward(), 'Thanks for watching'); after && after(); });
  }

  /* ---------- Earn page ---------- */
  C.page({
    id: 'earn', title: 'Earn & Daily', mount(root) {
      let raf = 0, spinning = false, dead = false, angle = 0;
      root.innerHTML = C.head('earn', 'Earn & Daily rewards', 'Spin the daily wheel, keep your streak, unlock coin plans with minigames or watch some very real ads') + `
      <button class="planbanner" id="plansb"><div class="gtile" style="--ac:#f5c451">${C.icon('coins', 26)}</div><div><b>Coin plans — up to $40,000</b><small>Beat 1–5 minigames to unlock a coin pack. No money involved.</small></div><span class="btn gold">See plans</span></button>
      <div class="earn-grid"><div class="card-box wheelcard"><div class="wc-head"><h3>Daily lucky wheel</h3><span class="streak">${C.icon('flame', 16)}<b id="stk"></b></span></div>
        <div class="wheel-wrap"><canvas id="dw" width="380" height="380"></canvas><div class="wpointer"></div></div>
        <div class="wc-foot"><div id="wmsg" class="muted"></div><button class="btn big gold" id="spin">Spin</button></div>
        <div class="streak-track" id="track"></div></div>
      <div class="earn-side"><div class="card-box adcard"><div class="gtile" style="--ac:#34d399">${C.icon('tv', 22)}</div><div><h3 style="margin:0">Watch an ad</h3><p class="muted">${AD_SECONDS}s of premium nonsense · earn <b id="adval"></b></p></div><button class="btn" id="ad">Watch</button><small class="muted" id="adleft"></small></div>
        <div class="card-box"><h3>Your earnings</h3><div class="kv"><span>Total earned from rewards</span><b style="color:var(--gold)">${C.fmt(C.S.earned || 0)}</b></div><div class="kv"><span>Best streak</span><b>${C.S.daily.best || 0} days</b></div><div class="kv"><span>Balance</span><b id="bal"></b></div></div>
        <div class="card-box"><h3>Out of money?</h3><p class="muted" style="margin:0 0 10px">You can always claim an emergency refill when your balance hits zero.</p><button class="btn sec small" id="emer" ${C.S.balance >= 1 ? 'disabled' : ''}>Claim $1,000</button></div></div></div>
      <div class="secthead"><h2>Free-play minigames</h2><span>Paid by score · ${COOL / 60000}-minute cooldown each</span></div>
      <div class="mini-grid" id="minis"></div>`;
      const q = s => root.querySelector(s), cv = q('#dw'), g = cv.getContext('2d'), N = PRIZES.length, STEP = Math.PI * 2 / N;
      q('#plansb').onclick = openCoins;
      function drawWheel() {
        const R = 180, cx = 190, cy = 190; g.clearRect(0, 0, 380, 380);
        g.beginPath(); g.arc(cx, cy, R + 8, 0, 7); g.fillStyle = '#b8892a'; g.fill();
        PRIZES.forEach((p, i) => {
          const a0 = angle + i * STEP - Math.PI / 2 - STEP / 2;
          g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R, a0, a0 + STEP); g.closePath(); g.fillStyle = p.c; g.fill(); g.strokeStyle = '#f5c45166'; g.stroke();
          const mid = a0 + STEP / 2, flip = Math.cos(mid) < 0; g.save(); g.translate(cx, cy); g.rotate(mid + (flip ? Math.PI : 0)); g.textAlign = flip ? 'left' : 'right'; g.fillStyle = p.cash >= 1000 ? '#f5c451' : '#fff'; g.font = `800 ${p.t.length > 6 ? 13 : 15}px Inter,sans-serif`; g.fillText(p.t, flip ? -(R - 14) : R - 14, 5); g.restore();
        });
        for (let i = 0; i < N; i++) { const a = angle + i * STEP - Math.PI / 2 - STEP / 2; g.beginPath(); g.arc(cx + Math.cos(a) * (R + 2), cy + Math.sin(a) * (R + 2), 3.5, 0, 7); g.fillStyle = '#fff6d8'; g.fill(); }
        g.beginPath(); g.arc(cx, cy, 34, 0, 7); g.fillStyle = '#0f151c'; g.fill(); g.lineWidth = 4; g.strokeStyle = '#f5c451'; g.stroke(); g.lineWidth = 1;
        g.fillStyle = '#f5c451'; g.font = '800 13px Inter,sans-serif'; g.textAlign = 'center'; g.fillText('LUCKY', cx, cy + 5);
      }
      function drawState() {
        const ready = C.S.daily.last !== C.today(), ns = nextStreak();
        q('#stk').textContent = `${ready ? ns : C.S.daily.streak}-day streak`;
        q('#spin').disabled = !ready || spinning;
        q('#wmsg').innerHTML = ready ? `Today's prize multiplier: <b style="color:var(--gold)">${mult(ns).toFixed(1)}×</b> on cash` : `Come back tomorrow · next spin in <b>${fmtT(new Date(new Date().setHours(24, 0, 0, 0)) - Date.now())}</b>`;
        const cur = ready ? ns : C.S.daily.streak, startDay = Math.max(1, cur - 2);
        q('#track').innerHTML = Array.from({ length: 7 }, (_, i) => { const d = startDay + i, ms = MILESTONES[d]; return `<div class="sday ${d < cur || (d === cur && !ready) ? 'done' : ''} ${d === cur ? 'cur' : ''}"><small>Day ${d}</small><b>${mult(d).toFixed(1)}×</b>${ms ? `<span class="ms">${C.icon(ms.chest ? 'chest' : 'bolt', 13)}${ms.chest ? ms.chest : 'charm'}</span>` : ''}</div>`; }).join('');
        q('#adleft').textContent = `Unlimited · ${adsToday()} watched today`;
        q('#adval').textContent = C.fmt(adReward()); q('#bal').textContent = C.fmt(C.S.balance); q('#emer').disabled = C.S.balance >= 1;
      }
      q('#spin').onclick = () => {
        if (spinning || C.S.daily.last === C.today()) return;
        spinning = true; drawState();
        let r = C.rnd() * PRIZES.reduce((a, p) => a + p.w, 0), idx = 0; for (; idx < N - 1; idx++) { r -= PRIZES[idx].w; if (r < 0) break; }
        const start = angle, target = -idx * STEP + Math.PI * 2 * 7 + (C.rnd() - .5) * STEP * .7, T = 5200, t0 = performance.now(); let lastSeg = -1;
        const tick = now => {
          if (dead) return;
          const t = Math.min(1, (now - t0) / T), e = 1 - Math.pow(1 - t, 4);
          angle = start + (target - (start % (Math.PI * 2))) * e; drawWheel();
          const seg = Math.floor(angle / STEP); if (seg !== lastSeg) { lastSeg = seg; C.sfx('tick'); }
          if (t < 1) { raf = requestAnimationFrame(tick); return; }
          const s = nextStreak(); C.S.daily.streak = s; C.S.daily.last = C.today(); C.S.daily.best = Math.max(C.S.daily.best || 0, s); C.save();
          const p = PRIZES[idx]; award(p, mult(s)); C.fx.burst(cv);
          if (MILESTONES[s]) { const ms = MILESTONES[s]; setTimeout(() => { award(ms, 1); C.toast(`${s}-day streak bonus!`, 'gold'); }, 600); }
          spinning = false; C.emit('change'); C.emit('profile'); drawState();
        };
        raf = requestAnimationFrame(tick);
      };
      q('#ad').onclick = () => adFlow(drawState);
      q('#emer').onclick = () => { if (C.S.balance < 1) { C.S.balance = 1000; C.S.refills++; C.save(); C.emit('change'); C.toast('Emergency refill: $1,000', 'gold'); drawState(); } };
      q('#minis').innerHTML = Object.entries(MINI).map(([k, M], i) => `<div class="card-box mini" style="--i:${i}"><div class="gtile" style="--ac:${M.color}">${C.icon(M.icon, 22)}</div><h3 class="mini-t">${M.name}</h3><p class="muted">${M.desc}</p><div class="mini-foot"><span class="pay">${M.payText}</span><button class="btn small" data-mini="${k}"></button></div></div>`).join('');
      const drawMinis = () => { for (const k in MINI) { const b = q(`[data-mini="${k}"]`), cl = coolLeft(k); b.disabled = !!cl; b.textContent = cl ? fmtT(cl) : 'Play'; } };
      q('#minis').addEventListener('click', async e => {
        const b = e.target.closest('[data-mini]'), k = b && b.dataset.mini; if (!k || coolLeft(k)) return;
        const r = await MINI[k].play(null); if (r.aborted) return;
        C.S.cool[k] = Date.now() + COOL; C.save(); drawMinis();
        const pay = MINI[k].pay(r); if (pay > 0) C.credit(pay, `${MINI[k].name} · ${r.text}`); else C.toast('No coins this time — try again later');
      });
      drawWheel(); drawState(); drawMinis();
      const tm = setInterval(() => { if (!spinning) drawState(); drawMinis(); }, 1000);
      return () => { dead = true; cancelAnimationFrame(raf); clearInterval(tm); };
    }
  });
  return { watchAd, openCoins, MINI, PLANS };
})();
