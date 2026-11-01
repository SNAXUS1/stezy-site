'use strict';
/* Profiles: customise your account, earn badges/titles, inspect other players (and bots) */
const Profiles = (() => {
  const C = Casino;
  const BANNERS = {
    aurora: 'linear-gradient(120deg,#0f766e,#1e3a8a 60%,#6d28d9)', sunset: 'linear-gradient(120deg,#f97316,#db2777 55%,#7c3aed)', ocean: 'linear-gradient(120deg,#0ea5e9,#1e40af)',
    royal: 'linear-gradient(120deg,#7c3aed,#c026d3 60%,#f59e0b)', ember: 'linear-gradient(120deg,#7f1d1d,#ea580c 60%,#facc15)', forest: 'linear-gradient(120deg,#14532d,#16a34a 60%,#a3e635)',
    midnight: 'linear-gradient(120deg,#0f172a,#334155 60%,#64748b)', candy: 'linear-gradient(120deg,#ec4899,#8b5cf6 50%,#06b6d4)'
  };
  const COLORS = ['#34d399', '#60a5fa', '#a78bfa', '#f472b6', '#f87171', '#fb923c', '#facc15', '#2dd4bf'];
  const BADGES = [
    { id: 'first', name: 'First Steps', desc: 'Play your first round', icon: 'play', test: a => a.w + a.l + a.p >= 1 },
    { id: 'regular', name: 'Regular', desc: 'Play 50 rounds', icon: 'clock', test: a => a.w + a.l + a.p >= 50 },
    { id: 'shark', name: 'Card Shark', desc: 'Win 100 rounds', icon: 'spade', test: a => a.w >= 100 },
    { id: 'roller', name: 'High Roller', desc: 'Wager $25,000 in total', icon: 'coin', test: a => a.wagered >= 25000 },
    { id: 'bigwin', name: 'Jackpot', desc: 'Win $5,000 in a single round', icon: 'star', test: a => a.best >= 5000 },
    { id: 'explorer', name: 'Explorer', desc: 'Play 10 different games', icon: 'grid', test: () => Object.keys(C.S.stats).filter(k => k !== '_all').length >= 10 },
    { id: 'collector', name: 'Collector', desc: 'Own 25 cards', icon: 'cards', test: () => C.S.inv.cards.length >= 25 },
    { id: 'mythic', name: 'Mythic Hunter', desc: 'Own a Mythic card', icon: 'chest', test: () => C.S.inv.cards.some(c => Eco.BY[c.id].rar.k === 'mythic') },
    { id: 'streak', name: 'Dedicated', desc: 'Reach a 7-day wheel streak', icon: 'flame', test: () => (C.S.daily.best || 0) >= 7 },
    { id: 'gold', name: 'Gold Mind', desc: 'Reach 1200 rating', icon: 'trophy', test: () => C.S.rating >= 1200 },
    { id: 'gm', name: 'Grandmaster', desc: 'Reach 1550 rating', icon: 'trophy', test: () => C.S.rating >= 1550 },
    { id: 'social', name: 'Socialite', desc: 'Have 5 friends', icon: 'users', test: () => C.S.friends.length >= 5 }
  ];
  const badges = () => { const a = C.stat('_all'); return BADGES.map(b => Object.assign({}, b, { got: !!b.test(a) })); };
  const titles = () => ['Newcomer', C.tierOf(C.S.rating) + ' Player', ...badges().filter(b => b.got).map(b => b.name)];

  function botLocal(name) {
    const r = Shared.rngFor(Shared.hash(name), 'bot'), stats = {}; let w = 0, l = 0, profit = 0;
    for (const g of C.order()) { const gw = Math.floor(r() * 60), gl = Math.floor(r() * 70), gp = Math.round((r() - .55) * 4000); stats[g] = { w: gw, l: gl, p: 0, profit: gp, rating: Math.round(900 + r() * 500) }; w += gw; l += gl; profit += gp; }
    const s = Table.botSeat(name);
    return { name, bot: true, avatar: s.avatar, color: '#60a5fa', banner: 'midnight', title: 'House Bot', bio: 'I am a house bot. I never sleep and I never tilt.', rating: s.rating, totals: { w, l, p: 0, profit, wagered: 50000, best: 3000 }, stats, collection: { count: 20, score: 300, value: 9000 }, showcase: [], joined: Date.now() - 864e5 * 90, streak: 0 };
  }

  function view(p, isMe, online) {
    const t = p.totals || {}, wr = t.w + t.l ? Math.round(t.w / (t.w + t.l) * 100) + '%' : '—', col = p.collection || {};
    const G = C.games(), rows = C.CATS.flatMap(c => c[1]).filter(id => p.stats && p.stats[id] && G[id]);
    const myBadges = isMe ? badges() : BADGES.map(b => Object.assign({}, b, { got: (p.badges || []).includes(b.id) }));
    return `<div class="pbanner" style="background:${BANNERS[p.banner] || BANNERS.aurora}"></div>
      <div class="phead"><div class="pav" style="--c:${p.color || '#34d399'}">${C.avatar(p, 112)}${isMe ? `<button class="pav-edit" id="avedit" title="Change character icon">${C.icon('camera', 18)}</button>` : ''}</div>
        <div class="pname"><h1>${C.esc(p.name)} ${p.bot ? '<em class="bot">BOT</em>' : ''}</h1><div class="ptitle" style="color:${p.color || '#34d399'}">${C.esc(p.title || 'Newcomer')}</div>
        <div class="pmeta"><em class="tier">${C.tierOf(p.rating || 1000)}</em><span>${C.icon('star', 14)} ${Math.round(p.rating || 1000)}</span>${isMe ? '' : `<span><i class="odot ${online ? 'on' : ''}"></i>${online ? 'Online' : p.lastSeen ? 'Seen ' + C.ago(p.lastSeen) : 'Offline'}</span>`}<span>${C.icon('clock', 14)} Joined ${new Date(p.joined || Date.now()).toLocaleDateString()}</span>${p.streak ? `<span>${C.icon('flame', 14)} ${p.streak}-day streak</span>` : ''}</div></div>
        <div class="pact">${isMe ? `<button class="btn" id="edit">${C.icon('edit', 16)}Edit profile</button>` : p.bot ? '' : C.S.friends.includes(p.name) ? `<button class="btn sec" id="unfriend">${C.icon('check', 16)}Friends</button>` : `<button class="btn" id="friend">${C.icon('plus', 16)}Add friend</button>`}</div></div>
      ${p.bio ? `<p class="pbio">${C.esc(p.bio)}</p>` : isMe ? '<p class="pbio muted">No bio yet — tell people who you are in Edit profile.</p>' : ''}
      <div class="stat-grid"><div class="stat"><small>Rating</small><b>${Math.round(p.rating || 1000)}</b></div><div class="stat"><small>Wins</small><b class="pos">${t.w || 0}</b></div><div class="stat"><small>Losses</small><b class="neg">${t.l || 0}</b></div><div class="stat"><small>Win rate</small><b>${wr}</b></div>
        <div class="stat"><small>Net profit</small><b class="${(t.profit || 0) >= 0 ? 'pos' : 'neg'}">${C.fmtS(t.profit || 0)}</b></div><div class="stat"><small>Biggest win</small><b>${C.fmt(t.best || 0)}</b></div><div class="stat"><small>Collection</small><b>${col.count || 0} <small class="muted" style="font-size:13px">cards</small></b></div><div class="stat"><small>Collection value</small><b style="color:var(--gold)">${C.fmtK(col.value || 0)}</b></div></div>
      <div class="layout"><div><div class="card-box" style="margin-bottom:18px"><h3>Showcase</h3><div class="cgrid">${(isMe ? Eco.showcase() : p.showcase || []).map(it => Eco.cardHTML(it)).join('') || `<span class="muted">${isMe ? 'Open a card in your Collection and choose “Add to showcase”.' : 'Nothing showcased yet.'}</span>`}</div></div>
        <div class="card-box"><h3>Games</h3><div style="overflow:auto"><table class="tbl"><tr><th>Game</th><th class="num">W</th><th class="num">L</th><th class="num">Net</th><th class="num">Rating</th></tr>${rows.map(id => { const s = p.stats[id]; return `<tr><td><div class="gname" style="--ac:${C.ACCENT[id]}">${C.icon(id, 18)}${G[id].name}${p.fav === id ? ' <em class="tier">Favorite</em>' : ''}</div></td><td class="num pos">${s.w}</td><td class="num neg">${s.l}</td><td class="num ${s.profit >= 0 ? 'pos' : 'neg'}">${C.fmtS(s.profit)}</td><td class="num">${Math.round(s.rating)}</td></tr>`; }).join('') || '<tr><td colspan="5" class="muted">No games played yet.</td></tr>'}</table></div></div></div>
        <div class="card-box"><h3>Badges · ${myBadges.filter(b => b.got).length}/${BADGES.length}</h3><div class="badges">${myBadges.map(b => `<div class="badge ${b.got ? 'got' : ''}" title="${b.desc}"><div class="bi">${C.icon(b.got ? b.icon : 'lock', 20)}</div><b>${b.name}</b><small>${b.desc}</small></div>`).join('')}</div></div></div>`;
  }

  function editor(onSave) {
    const pr = JSON.parse(JSON.stringify(C.S.profile)); let name = C.S.name;
    if (!pr.avatar.seed) pr.avatar.seed = name;
    const G = C.games();
    const m = C.modal(`<h2>Edit profile</h2><div class="editor">
      <label>Display name</label><input id="ename" maxlength="20" value="${C.esc(name)}">
      <label>Character icon</label><div class="avgrid" id="avs"></div><input type="file" id="avfile" accept="image/*" hidden>
      <div class="row" id="seedrow"><input id="eseed" maxlength="30" value="${C.esc(pr.avatar.seed || '')}" placeholder="Avatar seed"><button class="btn sec small" id="rnd">${C.icon('shuffle', 15)}Randomize</button></div>
      <p class="muted avhint">Upload your own picture (PNG, JPG, GIF or WebP) or drop it on the upload tile. It's cropped to a circle and shared with other players.</p>
      <label>Accent colour</label><div class="swatches" id="cols">${COLORS.map(c => `<button class="sw ${pr.color === c ? 'on' : ''}" data-c="${c}" style="background:${c}"></button>`).join('')}</div>
      <label>Banner</label><div class="swatches" id="bans">${Object.entries(BANNERS).map(([k, v]) => `<button class="sw wide ${pr.banner === k ? 'on' : ''}" data-b="${k}" style="background:${v}"></button>`).join('')}</div>
      <div class="row2"><div><label>Title</label><select id="etitle">${titles().map(t => `<option ${pr.title === t ? 'selected' : ''}>${C.esc(t)}</option>`).join('')}</select></div>
      <div><label>Favorite game</label><select id="efav"><option value="">—</option>${C.order().map(id => `<option value="${id}" ${pr.fav === id ? 'selected' : ''}>${G[id].name}</option>`).join('')}</select></div></div>
      <label>Bio</label><textarea id="ebio" maxlength="160" rows="3" placeholder="High roller, poker grinder, duck racing enthusiast…">${C.esc(pr.bio)}</textarea>
      <p class="muted" style="font-size:12px">Unlock more titles by earning badges.</p>
      <div class="btnrow" style="justify-content:flex-end"><button class="btn sec" id="cancel">Cancel</button><button class="btn" id="save">Save profile</button></div></div>`, { cls: 'mid', onClose: () => unwatch() });
    // the developer console only listens while this window is open
    const unwatch = Cheats.watch(() => { m.close(); Cheats.open(); });
    const q = s => m.el.querySelector(s);
    const drawAv = () => {
      const mine = pr.avatar.img ? `<button class="avopt ${pr.avatar.style === 'custom' ? 'on' : ''}" data-s="custom" title="Your picture">${C.avatar({ name, avatar: { style: 'custom', img: pr.avatar.img }, color: pr.color }, 54)}</button>` : '';
      q('#avs').innerHTML = `<button class="avopt upload" data-up="1" title="Upload your own picture">${C.icon('upload', 22)}<small>Upload</small></button>${mine}` +
        C.AV_STYLES.map(s => `<button class="avopt ${pr.avatar.style === s ? 'on' : ''}" data-s="${s}" title="${s}">${C.avatar({ name, avatar: { style: s, seed: pr.avatar.seed }, color: pr.color }, 54)}</button>`).join('');
      q('#seedrow').hidden = pr.avatar.style === 'custom';
    };
    /** crop the picked image to a 160px square JPEG so it stays small enough to share */
    function useFile(f) {
      if (!f || !/^image\//.test(f.type)) return C.toast('Pick an image file', 'bad');
      if (f.size > 8e6) return C.toast('That image is too large (max 8 MB)', 'bad');
      const url = URL.createObjectURL(f), img = new Image();
      img.onload = () => {
        const N = 160, cv = document.createElement('canvas'), g = cv.getContext('2d'), s = Math.min(img.width, img.height); cv.width = cv.height = N;
        g.fillStyle = '#1a222c'; g.fillRect(0, 0, N, N); g.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, N, N); URL.revokeObjectURL(url);
        const data = cv.toDataURL('image/jpeg', .86);
        Object.assign(pr.avatar, { style: 'custom', img: data, v: Shared.hash(data).toString(36) }); drawAv(); C.sfx('pop');
      };
      img.onerror = () => { URL.revokeObjectURL(url); C.toast('Could not read that image', 'bad'); };
      img.src = url;
    }
    drawAv();
    q('#avs').onclick = e => { if (e.target.closest('[data-up]')) return q('#avfile').click(); const b = e.target.closest('[data-s]'); if (b) { pr.avatar.style = b.dataset.s; drawAv(); } };
    q('#avfile').onchange = e => { useFile(e.target.files[0]); e.target.value = ''; };
    q('#avs').ondragover = e => { e.preventDefault(); q('#avs').classList.add('drag'); };
    q('#avs').ondragleave = () => q('#avs').classList.remove('drag');
    q('#avs').ondrop = e => { e.preventDefault(); q('#avs').classList.remove('drag'); useFile(e.dataTransfer.files[0]); };
    q('#eseed').oninput = e => { pr.avatar.seed = e.target.value || name; clearTimeout(q('#eseed').t); q('#eseed').t = setTimeout(drawAv, 300); };
    q('#rnd').onclick = () => { pr.avatar.seed = Math.random().toString(36).slice(2, 9); q('#eseed').value = pr.avatar.seed; drawAv(); };
    q('#cols').onclick = e => { const b = e.target.closest('[data-c]'); if (!b) return; pr.color = b.dataset.c; q('#cols').querySelectorAll('.sw').forEach(x => x.classList.toggle('on', x === b)); drawAv(); };
    q('#bans').onclick = e => { const b = e.target.closest('[data-b]'); if (!b) return; pr.banner = b.dataset.b; q('#bans').querySelectorAll('.sw').forEach(x => x.classList.toggle('on', x === b)); };
    q('#cancel').onclick = m.close;
    q('#save').onclick = () => {
      const nn = q('#ename').value.trim().slice(0, 20);
      pr.title = q('#etitle').value; pr.fav = q('#efav').value; pr.bio = q('#ebio').value.slice(0, 160);
      C.S.profile = Object.assign(C.S.profile, pr);
      const renamed = nn && nn !== C.S.name; if (renamed) C.S.name = nn;
      C.save(); C.emit('change'); C.emit(renamed ? 'rename' : 'profile'); m.close(); C.toast('Profile saved'); onSave();
    };
  }

  C.page({
    id: 'profile', title: 'Profile', mount(root, args) {
      const name = args[0] && args[0] !== C.S.name ? args[0] : null;
      const bind = (p, online) => {
        const isMe = !name;
        root.innerHTML = `<div class="profile">${view(p, isMe, online)}</div>`;
        const e = root.querySelector('#edit'); if (e) e.onclick = () => editor(() => bind(C.myProfile(), true));
        const ae = root.querySelector('#avedit'); if (ae) ae.onclick = () => editor(() => bind(C.myProfile(), true));
        const f = root.querySelector('#friend'); if (f) f.onclick = () => { C.S.friends.push(p.name); C.save(); C.emit('profile'); C.toast(`${p.name} added to friends`); bind(p, online); };
        const u = root.querySelector('#unfriend'); if (u) u.onclick = async () => { if (await C.ask(`Remove ${p.name} from friends?`, 'Remove')) { C.S.friends = C.S.friends.filter(x => x !== p.name); C.save(); bind(p, online); } };
      };
      if (!name) { bind(C.myProfile(), true); return; }
      root.innerHTML = '<div class="empty-state">Loading profile…</div>';
      let dead = false;
      MP.getProfile(name).then(res => {
        if (dead) return;
        if (res && res.p) bind(res.p, res.online);
        else if (Table.BOTS.includes(name)) bind(botLocal(name), true);
        else root.innerHTML = `<div class="empty-state">${MP.online() ? `No player called <b>${C.esc(name)}</b> yet.` : 'Server offline — profiles of other players need the server running.'}</div>`;
      });
      return () => { dead = true; };
    }
  });
  return { badges, BANNERS };
})();
