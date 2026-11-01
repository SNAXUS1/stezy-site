'use strict';
/* Hidden developer console: X-ray vision, wallet editor and a few extras.
   It opens only when the Konami code (↑↑↓↓←→←→BA) is typed while the Edit profile window is open. */
const Cheats = (() => {
  const C = Casino;
  const CODE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  const MAX = 1e12;
  const xray = () => !!(C.S.cheats && C.S.cheats.xray);
  /** listen for the code; keys typed into text fields don't count */
  function watch(onDone) {
    let buf = [];
    const h = e => {
      if (e.target.closest && e.target.closest('input, textarea, select')) return;
      buf.push(e.key.length === 1 ? e.key.toLowerCase() : e.key); if (buf.length > CODE.length) buf.shift();
      if (buf.join() === CODE.join()) { buf = []; e.preventDefault(); onDone(); }
    };
    document.addEventListener('keydown', h, true);
    return () => document.removeEventListener('keydown', h, true);
  }

  /* header pill while X-ray is on (click turns it off) */
  let pillEl = null;
  function pill() {
    if (!pillEl) {
      const rp = document.getElementById('ratingpill'); if (!rp) return;
      pillEl = document.createElement('button'); pillEl.id = 'xraypill'; pillEl.className = 'chipinfo xrpill'; pillEl.title = 'X-ray is on — click to turn it off';
      pillEl.innerHTML = `${C.icon('eye', 16)}<span>X-RAY</span>`; rp.before(pillEl);
      pillEl.onclick = () => { C.S.cheats.xray = false; C.save(); C.emit('change'); C.toast('X-ray off'); };
    }
    pillEl.hidden = !xray();
  }
  C.on('change', pill);
  setTimeout(pill, 0);

  function glitch() { document.body.classList.remove('glitch'); void document.body.offsetWidth; document.body.classList.add('glitch'); setTimeout(() => document.body.classList.remove('glitch'), 800); }
  const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return C.today(d); };

  function open() {
    glitch(); C.sfx('big');
    const m = C.modal(`<div class="dev"><div class="devhead"><i class="dd r"></i><i class="dd y"></i><i class="dd g"></i><b>root@lucky-gambit:~# ./dev_console</b></div>
      <pre class="devboot" id="boot"></pre>
      <section><h4>$ wallet --edit</h4>
        <div class="devrow"><span>Balance</span><input id="dbal" type="number" min="0" step="1"><button class="devbtn" data-a="setbal">SET</button></div>
        <div class="devchips">${[1e3, 1e4, 1e5, 1e6].map(v => `<button data-add="${v}">+${C.fmtK(v).replace('.0k', 'k')}</button>`).join('')}<button data-a="x2">×2</button><button data-a="reset">reset $1,000</button><button data-a="zero">zero</button></div></section>
      <section><h4>$ xray --toggle</h4>
        <label class="devtgl"><input type="checkbox" id="dxr" ${xray() ? 'checked' : ''}><span></span><b>X-ray vision</b></label>
        <p>Predicts how the next round ends in Solo and Bots modes: roulette numbers, crash points, dice rolls, race winners, slot spins, keno draws and more. Marks the mines, shows the dealer's hole card and the best video poker hold, and reveals the bots' poker hands. Live and Friends tables are server-protected.</p></section>
      <section><h4>$ misc</h4>
        <div class="devrow"><span>Rating</span><input id="drat" type="number" min="100" max="5000" step="1"><button class="devbtn" data-a="setrat">SET</button></div>
        <label class="devtgl"><input type="checkbox" id="dspam" ${C.S.cheats.noSpam ? 'checked' : ''}><span></span><b>Block popups & side ads</b></label>
        <div class="devchips">${Object.keys(Eco.CHESTS).map(k => `<button data-chest="${k}">+ ${k} chest</button>`).join('')}<button data-a="mythic">+ random Mythic</button><button data-a="cool">reset cooldowns</button></div></section>
      <div class="devlog" id="dlog"></div>
      <div class="devfoot"><span>This console is hidden. Reopen: Edit profile → ↑↑↓↓←→←→BA</span><button class="devbtn" data-a="exit">exit</button></div></div>`, { cls: 'mid devm', onClose: () => { clearInterval(bootT); un(); } });
    const q = s => m.el.querySelector(s);
    const sync = () => { if (document.activeElement !== q('#dbal')) q('#dbal').value = C.r2(C.S.balance); if (document.activeElement !== q('#drat')) q('#drat').value = Math.round(C.S.rating); };
    const log = t => { const l = q('#dlog'); l.insertAdjacentHTML('afterbegin', `<div>&gt; ${t}</div>`); while (l.children.length > 6) l.lastChild.remove(); C.sfx('tick'); };
    const setBal = v => { C.S.balance = C.r2(Math.max(0, Math.min(MAX, v))); C.save(); C.emit('change'); log(`balance = ${C.fmt(C.S.balance)}`); };
    const un = C.on('change', sync); sync();
    // boot text
    const BOOT = ['bypassing house edge........ OK', 'bribing the RNG............. OK', 'disabling Tipsy\'s conscience OK (it never had one)', 'access granted. welcome back, ' + C.S.name.toLowerCase()];
    let li = 0, ci = 0; const boot = q('#boot');
    const bootT = setInterval(() => { if (li >= BOOT.length) return clearInterval(bootT); ci++; boot.textContent = BOOT.slice(0, li).map(x => '> ' + x).join('\n') + (li ? '\n' : '') + '> ' + BOOT[li].slice(0, ci); if (ci >= BOOT[li].length) { li++; ci = 0; } }, 14);
    m.el.addEventListener('keydown', e => { if (e.key === 'Enter') { if (e.target.id === 'dbal') q('[data-a="setbal"]').click(); if (e.target.id === 'drat') q('[data-a="setrat"]').click(); } });
    q('#dxr').onchange = e => { C.S.cheats.xray = e.target.checked; C.save(); C.emit('change'); log(`xray ${e.target.checked ? 'ENABLED — open any game' : 'disabled'}`); };
    q('#dspam').onchange = e => { C.S.cheats.noSpam = e.target.checked; C.save(); Ads.refresh(); document.querySelectorAll('.spam, .bannerad').forEach(x => x.remove()); log(`adblock ${e.target.checked ? 'ON — popups and side ads gone' : 'off — the sponsors return'}`); };
    m.el.addEventListener('click', e => {
      const add = e.target.closest('[data-add]'); if (add) return setBal(C.S.balance + +add.dataset.add);
      const ch = e.target.closest('[data-chest]'); if (ch) { Eco.grantChest(ch.dataset.chest, 'spawned by the console'); return log(`+1 ${ch.dataset.chest} chest`); }
      const b = e.target.closest('[data-a]'); if (!b) return;
      const a = b.dataset.a;
      if (a === 'setbal') { const v = parseFloat(q('#dbal').value); if (!Number.isFinite(v)) return log('error: not a number'); setBal(v); }
      if (a === 'x2') setBal(C.S.balance * 2);
      if (a === 'reset') setBal(1000);
      if (a === 'zero') setBal(0);
      if (a === 'setrat') { const v = Math.round(parseFloat(q('#drat').value)); if (!Number.isFinite(v)) return log('error: not a number'); C.S.rating = Math.max(100, Math.min(5000, v)); C.save(); C.emit('change'); C.emit('profile'); log(`rating = ${C.S.rating} (${C.tierOf(C.S.rating)})`); }
      if (a === 'mythic') { const pool = Eco.CARDS.filter(c => c.rar.k === 'mythic'), c = pool[C.rint(pool.length)]; Eco.addItem({ kind: 'card', id: c.id, grade: 10 }); C.toast(`${c.name} (Mythic, grade 10) added`, 'gold'); log(`spawned mythic "${c.name}"`); }
      if (a === 'cool') { C.S.cool = {}; C.S.plans = {}; C.S.ads = { day: '', n: 0 }; if (C.S.daily.last === C.today()) C.S.daily.last = yesterday(); C.save(); C.emit('change'); log('cooldowns cleared: daily wheel, ads, minigames, coin plans'); }
      if (a === 'exit') m.close();
    });
  }
  return { watch, open, xray };
})();
