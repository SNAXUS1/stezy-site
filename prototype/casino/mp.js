'use strict';
/* Multiplayer client: WebSocket link to server.js — rooms, chat, presence, profiles, leaderboard, invites */
const MP = (() => {
  const C = Casino;
  let ws = null, isOn = false, skew = 0, retry = null, cid = 0, profT = null;
  const st = { chat: [], board: [], players: [], rooms: [], supply: {} };
  const ls = new Set(), roomH = {}, roomOpts = {}, profWait = {};
  const emit = () => ls.forEach(f => { try { f(); } catch (e) { console.error(e); } });
  /* On stezy.lt the pages and the server live apart: the host's launcher publishes the server's current address in link.json */
  const qs = new URLSearchParams(location.search);
  const away = /(^|\.)stezy\.lt$/.test(location.hostname) || qs.has('away');
  let base = qs.get('server') || '', askedAt = 0, settled = false;
  const settlers = [];
  const settle = () => { if (settled) return; settled = true; settlers.splice(0).forEach(f => f()); };
  setTimeout(settle, 6000);
  async function locate() {
    if (!away || qs.get('server') || Date.now() - askedAt < 20000) return;
    askedAt = Date.now();
    try { const r = await fetch('link.json?t=' + Date.now(), { cache: 'no-store' }); if (r.ok) base = (await r.json()).url || ''; } catch (e) {}
  }
  const url = () => base ? base.replace(/^http/, 'ws') : (location.protocol === 'http:' || location.protocol === 'https:') ? (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host : 'ws://localhost:3000';
  const send = o => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };
  /** profile as sent over the wire: an uploaded avatar travels separately (see pushAvatar) and is referenced by version */
  const wire = () => { const p = C.myProfile(); if (p.avatar && p.avatar.style === 'custom') p.avatar = { style: 'custom', v: p.avatar.v }; return p; };
  let sentAv = '';
  const pushAvatar = () => { const a = C.S.profile.avatar; if (a.style === 'custom' && a.img && a.v !== sentAv) { sentAv = a.v; send({ t: 'avatar', img: a.img }); } };

  async function connect() {
    clearTimeout(retry);
    await locate();
    if (away && !base) { settle(); emit(); return later(); }
    window.CASINO_SERVER = base;
    try { ws = new WebSocket(url()); } catch (e) { return later(); }
    ws.onopen = () => { isOn = true; sentAv = ''; sentBal = C.S.balance; send({ t: 'hello', name: C.S.name, profile: wire(), bal: C.S.balance }); pushAvatar(); for (const k in roomH) send(Object.assign({ t: 'join', room: k }, roomOpts[k])); settle(); emit(); };
    ws.onclose = () => { isOn = false; ws = null; settle(); emit(); later(); };
    ws.onerror = () => {};
    ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (_) { return; } handle(m); };
  }
  const later = () => { retry = setTimeout(connect, 5000); };

  function handle(m) {
    if (m.now) skew = m.now - Date.now();
    if (m.room && roomH[m.room]) { roomH[m.room](m); if (m.t !== 'seats') return; }
    switch (m.t) {
      case 'welcome': cid = m.cid; st.money = m.money || {}; st.chat = m.chat || []; st.board = m.board || []; st.players = m.players || []; st.supply = m.supply || {}; st.rooms = m.rooms || []; break;
      case 'chat': st.chat.push(m); if (st.chat.length > 60) st.chat.shift(); break;
      case 'players': st.players = m.players; if (m.money) st.money = m.money; break;
      case 'board': st.board = m.board; break;
      case 'rooms': st.rooms = m.list; break;
      case 'supply': st.supply = m.supply; C.emit('supply'); break;
      case 'profileData': (profWait[m.name] || []).forEach(f => f(m)); delete profWait[m.name]; return;
      case 'invited': C.toast(`${m.from} invited you to ${(C.games()[m.game] || {}).name || 'a table'}`, 'gold', { label: 'Join', fn: () => { location.hash = m.href; } }); return;
      default: return;
    }
    emit();
  }
  function pushProfile() { clearTimeout(profT); profT = setTimeout(() => { pushAvatar(); send({ t: 'profile', profile: wire() }); }, 1500); }
  C.on('settled', pushProfile); C.on('profile', pushProfile);
  C.on('rename', () => { send({ t: 'hello', name: C.S.name, profile: wire(), bal: C.S.balance }); sentAv = ''; pushAvatar(); });
  /* everyone's money: sent when it changes, shown in the top bar */
  let sentBal = null, balT = null, whoKey = '';
  function paintWho() {
    const el = document.getElementById('whohere'); if (!el) return;
    const list = isOn ? st.players.filter(p => p !== C.S.name) : [];
    const key = list.map(p => p + st.money[p]).join();
    if (key === whoKey) return; whoKey = key;
    el.innerHTML = list.map(p => `<span class="who">${C.plink(p, `<b>${C.esc(p)}</b>`)}<em>${C.fmt(st.money[p] || 0)}</em></span>`).join('');
  }
  C.on('change', () => {
    if (isOn && C.S.balance !== sentBal) { clearTimeout(balT); balT = setTimeout(() => { sentBal = C.S.balance; send({ t: 'bal', bal: sentBal }); }, 250); }
    paintWho();
    const el = document.getElementById('mpstat');
    if (el) { el.className = 'mpstat' + (isOn ? ' on' : ''); el.innerHTML = `<i></i><span>${isOn ? st.players.length + ' online' : 'Offline · bots only'}</span>`; }
  });

  const api = {
    online: () => isOn, state: () => st, cid: () => cid, connecting: () => !isOn && !settled, whenSettled: () => new Promise(res => settled ? res() : settlers.push(res)), money: n => n === C.S.name ? C.S.balance : st.money[n], now: () => Date.now() + skew, send,
    on(f) { ls.add(f); return () => ls.delete(f); },
    chat: text => send({ t: 'chat', text }),
    joinRoom(key, opts, h) { roomH[key] = h; roomOpts[key] = opts || {}; send(Object.assign({ t: 'join', room: key }, opts)); return () => { delete roomH[key]; delete roomOpts[key]; send({ t: 'leave', room: key }); }; },
    getProfile(name) {
      return new Promise(res => {
        if (!isOn) return res(null);
        (profWait[name] = profWait[name] || []).push(res); send({ t: 'getprofile', name });
        setTimeout(() => res(null), 4000);
      });
    },
    invite(to, href, game) { send({ t: 'invite', to, href, game, room: href }); C.toast(`Invite sent to ${to}`); },
    mint: ids => send({ t: 'mint', ids }), burn: id => send({ t: 'burn', id })
  };
  api.on(() => C.emit('change'));

  /* ---------- Multiplayer arena page ---------- */
  C.page({
    id: 'live', title: 'Multiplayer', mount(root) {
      const G = C.games(), multi = C.order().filter(id => G[id].multi);
      root.innerHTML = C.head('live', 'Multiplayer Arena', 'Play every game with others: public live tables, private rooms with friends, or bot tables') + `
      <div id="offline" class="notice" hidden>${C.icon('users', 20)}<div><b>The casino's closed right now.</b> The tables open when the host opens the casino. You can still play alone or with bots.</div></div>
      <div class="modes3">
        <div class="mode-card"><div class="gtile" style="--ac:#f87171">${C.icon('users', 22)}</div><h3>Live tables</h3><p>Public rooms mixing real players and house bots. Jump in any time.</p></div>
        <div class="mode-card"><div class="gtile" style="--ac:#60a5fa">${C.icon('lock', 22)}</div><h3>Private room</h3><p>Create a room code, invite friends and choose how many bots join.</p>
          <div class="row"><select id="pgame">${multi.map(id => `<option value="${id}">${G[id].name}</option>`).join('')}</select><button class="btn small" id="create">Create</button></div>
          <div class="row"><input id="pcode" maxlength="8" placeholder="Room code"><select id="jgame">${multi.map(id => `<option value="${id}">${G[id].name}</option>`).join('')}</select><button class="btn sec small" id="join">Join</button></div></div>
        <div class="mode-card"><div class="gtile" style="--ac:#a78bfa">${C.icon('bolt', 22)}</div><h3>Bot tables</h3><p>Practice against 1–5 bots with live table action. Works offline.</p></div>
      </div>
      <div class="secthead"><h2>Tables</h2><span>Live = mixed players &amp; bots</span></div>
      <div class="rooms" id="rooms"></div>
      <div class="layout"><div class="sidebox"><h3>Global chat</h3><div class="chatlog" id="log"></div><div class="chatin"><input id="msg" maxlength="200" placeholder="Say something nice…"><button class="btn small" id="go">Send</button></div></div>
      <div><div class="sidebox" style="margin-bottom:14px"><h3>Friends</h3><div id="friends"></div><div class="chatin"><input id="fadd" maxlength="20" placeholder="Add friend by name"><button class="btn sec small" id="faddb">${C.icon('plus', 14)}</button></div></div>
      <div class="sidebox"><h3>Online now</h3><div class="plist" id="ppl"></div></div></div></div>`;
      const q = s => root.querySelector(s);
      q('#create').onclick = () => { location.hash = `#/game/${q('#pgame').value}/room/${C.newCode()}`; };
      q('#join').onclick = () => { const code = q('#pcode').value.toUpperCase().replace(/[^A-Z0-9]/g, ''); if (code.length < 4) return C.toast('Enter a room code', 'bad'); location.hash = `#/game/${q('#jgame').value}/room/${code}`; };
      const addFriend = n => { n = (n || '').trim(); if (!n || n === C.S.name || C.S.friends.includes(n)) return; C.S.friends.push(n); C.save(); C.emit('profile'); draw(); C.toast(`${n} added to friends`); };
      q('#faddb').onclick = () => { addFriend(q('#fadd').value); q('#fadd').value = ''; };
      const draw = () => {
        q('#offline').hidden = isOn;
        q('#rooms').innerHTML = multi.map(id => {
          const r = st.rooms.find(x => x.game === id);
          return `<div class="room" style="--ac:${C.ACCENT[id]}"><div class="gtile">${C.icon(id, 22)}</div><div class="rinfo"><b>${G[id].name}</b><div class="phase ${r ? r.phase : ''}">${r ? `${r.humans} player${r.humans === 1 ? '' : 's'} · ${r.bots} bots` : 'Empty — be first'}</div></div>
            <div class="ractions"><a class="btn small" href="#/game/${id}/live">Live</a>${G[id].noBots ? '' : `<a class="btn sec small" href="#/game/${id}/bots">Bots</a>`}</div></div>`;
        }).join('');
        const log = q('#log'), stick = log.scrollTop + log.clientHeight >= log.scrollHeight - 30;
        log.innerHTML = st.chat.map(m => `<div>${C.plink(m.name, `<b>${C.esc(m.name)}</b>`)} ${C.esc(m.text)}</div>`).join('') || '<span class="muted">No messages yet.</span>';
        if (stick) log.scrollTop = log.scrollHeight;
        q('#ppl').innerHTML = st.players.map(p => `<div class="prow">${C.plink(p)}<b class="smoney">${C.fmt(api.money(p) || 0)}</b>${p === C.S.name ? '<em class="tier">You</em>' : C.S.friends.includes(p) ? '<em class="tier">Friend</em>' : `<button class="btn sec small" data-add="${C.esc(p)}">Add</button>`}</div>`).join('') || '<span class="muted">—</span>';
        q('#friends').innerHTML = C.S.friends.map(f => { const onl = st.players.includes(f); return `<div class="prow"><i class="odot ${onl ? 'on' : ''}"></i>${C.plink(f)}<span class="muted">${onl ? 'online' : 'offline'}</span><button class="icon-btn sm" data-rm="${C.esc(f)}" title="Remove">${C.icon('x', 14)}</button></div>`; }).join('') || '<span class="muted">No friends yet. Add players from the online list or their profile.</span>';
      };
      root.addEventListener('click', e => {
        const a = e.target.closest('[data-add]'); if (a) addFriend(a.dataset.add);
        const r = e.target.closest('[data-rm]'); if (r) { C.S.friends = C.S.friends.filter(x => x !== r.dataset.rm); C.save(); draw(); }
      });
      const sendMsg = () => { const i = q('#msg'); if (i.value.trim()) { api.chat(i.value); i.value = ''; } };
      q('#go').onclick = sendMsg; q('#msg').onkeydown = e => { if (e.key === 'Enter') sendMsg(); };
      draw(); const un = api.on(draw);
      return () => un();
    }
  });

  /* friends need to recognise each other: a real name instead of Player1234, asked once */
  function askName() {
    if (!/^Player\d{4}$/.test(C.S.name) || C.S.askedName) return;
    const m = C.modal(`<h2>What should your friends call you?</h2><p class="muted">They see this name and your money at the tables.</p><div class="row" style="margin-top:12px"><input id="nm" maxlength="20" placeholder="Your name"><button class="btn" id="nmgo">Let's gamble</button></div>`);
    const i = m.el.querySelector('#nm');
    const go = () => { const n = i.value.trim(); C.S.askedName = true; if (n) C.S.name = n; C.save(); C.emit('change'); C.emit('rename'); m.close(); };
    m.el.querySelector('#nmgo').onclick = go; i.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') go(); }; i.focus();
  }
  setTimeout(askName, 500);
  connect();
  return api;
})();
