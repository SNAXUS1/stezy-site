'use strict';
// Demo data for running the REAPER interface in a normal browser (the website preview).
// Speaks the same message protocol as the desktop host, so the UI code is identical.
window.ReaperMock = function (deliver) {
  const GB = 1073741824, MB = 1048576;
  const ICONS = window.REAPER_DEMO_ICONS || {};
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const noise = (v, amt) => Math.max(0, v + (rand() - 0.5) * 2 * amt);

  const T0 = Date.now();
  const sec = s => T0 - s * 1000;

  // name, subtitle, section, cpu, gpu, mem, io, processes, icon, extra
  const G = [
    { k: 'spotify', n: 'Spotify', s: 'Lo-fi beats to relax to', sec: 'hung', st: 'hung', c: 0, g: 0, m: 412 * MB, d: 0, np: 8, i: 'spotify', img: 'Spotify.exe', hungAt: sec(184), w: ['Spotify Premium'] },
    { k: 'chrome', n: 'Google Chrome', s: 'YouTube · 14 processes', sec: 'apps', c: 6.2, g: 3.1, m: 2.1 * GB, d: 0.3 * MB, np: 14, i: 'chrome', img: 'chrome.exe', w: ['YouTube - Google Chrome'], kids: 'chromium' },
    { k: 'discord', n: 'Discord', s: '#general · 6 processes', sec: 'apps', c: 1.4, g: 0.6, m: 486 * MB, d: 0.1 * MB, np: 6, i: 'discord', img: 'Discord.exe', w: ['#general | Friends - Discord'], kids: 'chromium' },
    { k: 'steam', n: 'Steam', s: 'Library · 5 processes', sec: 'apps', c: 0.8, g: 0.4, m: 318 * MB, d: 0, np: 5, i: 'steam', img: 'steam.exe', w: ['Steam'] },
    { k: 'obs', n: 'OBS Studio', s: 'Recording · Scene 1', sec: 'apps', c: 4.6, g: 11.2, m: 264 * MB, d: 6.4 * MB, np: 1, i: 'obs', img: 'obs64.exe', w: ['OBS 31.0.2 - Profile: Untitled - Scenes: Untitled'] },
    { k: 'explorer', n: 'Windows Explorer', s: 'Downloads', sec: 'apps', c: 0.3, g: 0, m: 96 * MB, d: 0, np: 1, i: 'explorer', img: 'explorer.exe', w: ['Downloads'], x: 8 },
    { k: 'reaper', n: 'REAPER', s: '7 processes', sec: 'apps', c: 0.4, g: 0.2, m: 188 * MB, d: 0, np: 7, i: 'reaper', img: 'REAPER.exe', w: ['REAPER'], x: 6 },

    { k: 'wu', n: 'Windows Update', s: 'Service host · updating in background', sec: 'bg', c: 1.9, g: 0, m: 38 * MB, d: 12.5 * MB, np: 1, i: 'svchost', img: 'svchost.exe' },
    { k: 'dupd', n: 'Discord updater', s: 'Started by Discord', sec: 'bg', c: 0.2, g: 0, m: 22 * MB, d: 0, np: 1, i: 'discord', img: 'Update.exe' },
    { k: 'defender', n: 'Microsoft Defender Antivirus', s: 'Microsoft Defender antivirus', sec: 'bg', c: 0.9, g: 0, m: 214 * MB, d: 1.1 * MB, np: 1, i: 'defender', img: 'MsMpEng.exe' },
    { k: 'onedrive', n: 'Microsoft OneDrive', s: 'syncs your files', sec: 'bg', c: 0.1, g: 0, m: 74 * MB, d: 0, np: 1, i: 'onedrive', img: 'OneDrive.exe' },
    { k: 'nvc', n: 'NVIDIA Container', s: 'NVIDIA background services', sec: 'bg', c: 0.2, g: 0, m: 58 * MB, d: 0, np: 3, i: 'nvidia', img: 'nvcontainer.exe' },
    { k: 'swh', n: 'Steam Client WebHelper', s: 'Started by Steam · 4 processes', sec: 'bg', c: 0.3, g: 0.2, m: 162 * MB, d: 0, np: 4, i: 'steam', img: 'steamwebhelper.exe' },
    { k: 'medal', n: 'Medal', s: 'Medal.tv · clipping in background', sec: 'bg', c: 0.7, g: 1.4, m: 141 * MB, d: 0.2 * MB, np: 3, i: 'medal', img: 'Medal.exe' },

    { k: 'dwm', n: 'Desktop Window Manager', s: 'draws your desktop and windows', sec: 'win', c: 1.8, g: 4.2, m: 88 * MB, d: 0, np: 1, i: 'win', img: 'dwm.exe', x: 2 },
    { k: 'system', n: 'System', s: 'Windows kernel and drivers', sec: 'win', c: 0.6, g: 0, m: 0.1 * MB, d: 0.4 * MB, np: 1, i: 'win', img: 'System', x: 3 },
    { k: 'memc', n: 'Memory Compression', s: 'squeezes idle memory to save RAM', sec: 'win', c: 0, g: 0, m: 612 * MB, d: 0, np: 1, i: 'win', img: 'Memory Compression', x: 3 },
    { k: 'search', n: 'Microsoft Windows Search Indexer', s: 'indexes files for search', sec: 'win', c: 0.1, g: 0, m: 34 * MB, d: 0, np: 1, i: 'win', img: 'SearchIndexer.exe' },
    { k: 'audio', n: 'Windows Audio Device Graph Isolation', s: 'Windows audio engine', sec: 'win', c: 0.4, g: 0, m: 12 * MB, d: 0, np: 1, i: 'win', img: 'audiodg.exe' },
    { k: 'csrss', n: 'Client Server Runtime Process', s: 'core Windows runtime', sec: 'win', c: 0.1, g: 0.3, m: 2 * MB, d: 0, np: 2, i: 'win', img: 'csrss.exe', x: 3 },
    { k: 'lsass', n: 'Local Security Authority Process', s: 'passwords, sign-in and security', sec: 'win', c: 0, g: 0, m: 9 * MB, d: 0, np: 1, i: 'win', img: 'lsass.exe', x: 3 },
  ];
  // pad the Windows section with service hosts so the counts feel real
  ['DNS Client', 'Windows Audio', 'Task Scheduler', 'Network List Service', 'Windows Event Log', 'Bluetooth Support Service', 'Delivery Optimization', 'Cryptographic Services', 'Themes', 'Windows Font Cache Service']
    .forEach((name, i) => G.push({ k: 'svc' + i, n: name, s: 'Service host', sec: 'win', c: rand() < 0.3 ? 0.1 : 0, g: 0, m: (1 + rand() * 9) * MB, d: 0, np: 1, i: 'win', img: 'svchost.exe' }));

  const state = { pending: [], sel: null, expanded: new Set(), frozen: new Set(), ended: new Set(), sendHist: false, sendInit: false, interval: 1000, settings: { interval: 1000, overlay: false, overlayCorner: 'tl', overlaySize: 'm', alwaysOnTop: false, closeToTray: false, startWithWindows: false, replaceTm: false, windowsCollapsed: true, backgroundCollapsed: false, sort: 'c', sortDir: -1 } };
  const live = new Map(G.map(g => [g.k, { ...g }]));
  let pid = 4100;
  for (const g of live.values()) g.pid = g.k === 'system' ? 4 : (pid += 4 + Math.floor(rand() * 400));

  // ---- 30 minutes of history with a few stories in it
  const events = [
    { ts: sec(27 * 60 + 12), kind: 'disk', text: 'Steam spiked disk usage', detail: 'peak 84 MB/s', k: 'steam' },
    { ts: sec(19 * 60 + 40), kind: 'mem', text: 'Google Chrome memory climbed to 2.1 GB', detail: '+1.1 GB in a minute', k: 'chrome' },
    { ts: sec(11 * 60 + 5), kind: 'freeze', text: 'You froze Medal', k: 'medal' },
    { ts: sec(10 * 60 + 30), kind: 'unfreeze', text: 'You unfroze Medal', k: 'medal' },
    { ts: sec(184), kind: 'hung', text: 'Spotify stopped responding', alert: true, k: 'spotify' },
    { ts: sec(52), kind: 'disk', text: 'Discord updater spiked disk usage', detail: 'peak 64 MB/s', k: 'dupd' },
  ];
  const rec = { step: 1000, end: Math.floor(T0 / 1000) * 1000, cpu: [], disk: [], gpu: [], mem: [], top: [] };
  let c = 18, d = 3;
  for (let i = 1799; i >= 0; i--) {
    const t = rec.end - i * 1000;
    c = Math.min(90, Math.max(6, c + (rand() - 0.5) * 4 + (18 - c) * 0.04));
    let disk = Math.max(0, d + (rand() - 0.5) * 3);
    let top = 'Google Chrome';
    for (const e of events) {
      const dt = (t - e.ts) / 1000;
      if (e.kind === 'disk' && dt > -6 && dt < 14) { disk = 55 + rand() * 30; top = e.text.split(' spiked')[0]; }
      if (e.kind === 'mem' && dt > -40 && dt < 20) { c = Math.min(70, c + 1.2); }
    }
    rec.cpu.push(+c.toFixed(1)); rec.disk.push(+disk.toFixed(1)); rec.gpu.push(+(9 + rand() * 6).toFixed(1)); rec.mem.push(+(61 + rand() * 2).toFixed(1)); rec.top.push(top);
  }

  function histFor(k) {
    const g = live.get(k);
    const n = 900;
    const out = { k, step: 2000, end: T0, cpu: [], gpu: [], mem: [], disk: [] };
    let cc = g.c, mm = g.m / MB * 0.7;
    for (let i = 0; i < n; i++) {
      cc = Math.max(0, cc + (rand() - 0.5) * Math.max(0.6, g.c * 0.3) + (g.c - cc) * 0.08);
      mm = mm + (g.m / MB - mm) * 0.01 + (rand() - 0.5) * g.m / MB * 0.004;
      if (k === 'chrome' && i > 300 && i < 330) cc += 6;
      out.cpu.push(+cc.toFixed(1));
      out.gpu.push(+noise(g.g, g.g * 0.4).toFixed(1));
      out.mem.push(Math.round(mm));
      out.disk.push(+noise(g.d / MB, g.d / MB * 0.6 + 0.02).toFixed(2));
    }
    if (k === 'spotify') for (let i = n - 92; i < n; i++) { out.cpu[i] = 0; out.gpu[i] = 0; }
    return out;
  }

  function kidsFor(g) {
    const roles = g.kids === 'chromium'
      ? ['Main process', 'GPU process', 'Network service', 'Storage service', 'Audio service', 'Tab or page', 'Tab or page', 'Tab or page', 'Tab or page', 'Tab or page', 'Extension', 'Extension', 'Tab or page', 'Crash reporter']
      : Array.from({ length: g.np }, (_, i) => i ? 'Helper' : 'Main process');
    const out = [];
    let left = g.c, mem = g.m;
    for (let i = 0; i < g.np; i++) {
      const share = i === g.np - 1 ? 1 : 0.15 + rand() * 0.35;
      const cpu = +(left * share).toFixed(1), m = Math.round(mem * share);
      left -= cpu; mem -= m;
      out.push({ p: g.pid + i * 12, n: roles[i] || 'Helper', img: g.img, c: Math.max(0, cpu), g: i === 1 ? g.g : 0, m, d: 0 });
    }
    return out;
  }

  function tick() {
    const ts = Date.now();
    const groups = [];
    let totC = 0, totM = 0;
    for (const g of live.values()) {
      if (state.ended.has(g.k)) continue;
      const frozen = state.frozen.has(g.k);
      const hung = g.st === 'hung' && !frozen;
      const o = {
        k: g.k, n: g.n, sec: hung ? 'hung' : g.sec === 'hung' ? 'apps' : g.sec, st: frozen ? 'frozen' : hung ? 'hung' : 'run', i: ICONS[g.i] ? g.i : '', img: g.img, pid: g.pid,
        c: frozen || hung ? 0 : +noise(g.c, g.c * 0.35).toFixed(1), g: frozen || hung ? 0 : +noise(g.g, g.g * 0.3).toFixed(1),
        m: Math.round(g.m * (1 + (rand() - 0.5) * 0.004)), d: frozen ? 0 : Math.round(noise(g.d, g.d * 0.5)), np: g.np,
      };
      if (g.k === 'dupd' && ts - events[5].ts < 16000) { o.d = 58 * MB; o.c = 3.2; }
      if (hung) { o.hs = Math.round((ts - g.hungAt) / 1000); o.s = `Not responding for ${o.hs < 60 ? o.hs + ' s' : Math.floor(o.hs / 60) + ' min'} · ${g.s}`; }
      else if (frozen) o.s = 'Frozen by you';
      else o.s = g.s;
      if (g.x) o.x = g.x;
      if (g.w) o.w = g.w;
      if (g.np > 1 && state.expanded.has(g.k)) o.kids = kidsFor(g);
      totC += o.c; totM += o.m;
      groups.push(o);
    }
    const memT = 31.9 * GB, memU = Math.min(memT * 0.95, 9.4 * GB + totM * 0.25);
    const cpu = Math.min(100, totC + 3 + rand() * 2);
    const hung = groups.find(g => g.st === 'hung');
    const chrome = groups.find(g => g.k === 'chrome');
    const st = hung
      ? { text: `${hung.n} isn't responding. End it, or give it a moment.`, tone: 'alert', k: hung.k }
      : chrome ? { text: `All calm. ${chrome.n} is busiest: ${(chrome.m / GB).toFixed(1)} GB, 14 processes.`, tone: 'calm', k: 'chrome' }
      : { text: 'All calm.', tone: 'calm' };
    const sys = {
      cpu: +cpu.toFixed(1), ghz: +(4.62 + rand() * 0.2).toFixed(2), cores: 8, lp: 16, cpuName: 'Ryzen 7 7800X3D', procs: 268, threads: 3912, handles: 128440,
      gpu: +noise(14, 2).toFixed(1), gpuName: 'RTX 4070 SUPER', gpuTemp: 46 + Math.round(rand() * 2), vramU: 2.6 * GB, vramT: 12 * GB,
      mem: +(memU / memT * 100).toFixed(1), memU, memT, commitU: memU * 1.3, commitT: 36 * GB,
      disk: +noise(state.diskBoost ? 40 : 3, 2).toFixed(1), dR: 1.2 * MB, dW: 13.6 * MB, up: 3 * 3600e3 + 42 * 60e3 + (ts - T0), st,
    };
    const msg = { t: 'tick', ts, iv: state.interval, sys, groups };
    if (state.pending.length) msg.events = state.pending.splice(0);
    if (state.sendInit) {
      state.sendInit = false;
      msg.icons = ICONS;
      msg.rec = { ...rec, events };
    } else {
      rec.end += 1000;
      msg.recAdd = { end: rec.end, cpu: +cpu.toFixed(1), disk: sys.disk, gpu: sys.gpu, mem: sys.mem, top: 'Google Chrome' };
    }
    if (state.sel && live.has(state.sel) && !state.ended.has(state.sel)) {
      const g = live.get(state.sel);
      msg.sel = { k: g.k, path: `C:\\Program Files\\${g.n}\\${g.img}`, company: g.sec === 'win' || g.k === 'wu' ? 'Microsoft Corporation' : g.n.split(' ')[0] + ' Inc.', img: g.img, pid: g.pid, threads: 40 + g.np * 22, handles: 900 + g.np * 400, started: T0 - (2 * 3600e3 + g.pid * 1000), priority: 'Normal', gpuMem: g.g * 40 * MB, commit: g.m * 1.2, ws: g.m * 1.1, rd: g.d * 0.2, wr: g.d * 0.8 };
      if (g.img === 'svchost.exe') msg.sel.services = [g.n];
      if (state.sendHist) { state.sendHist = false; msg.hist = histFor(g.k); }
    }
    deliver(msg);
  }

  let timer = null;
  const restart = () => { clearInterval(timer); timer = setInterval(tick, state.interval); };

  function toast(text, tone = 'ok') { deliver({ t: 'toast', text, tone }); }

  function action(m) {
    const g = live.get(m.k);
    if (!g) return;
    const ts = Date.now();
    const push = (kind, text, alert) => { const e = { ts, kind, text, k: g.k, alert }; events.push(e); state.pending.push(e); return e; };
    switch (m.a) {
      case 'end': {
        if (g.x & 1) return toast(`Windows can't run without ${g.n}, so REAPER won't end it.`, 'alert');
        if (g.x & 4) return toast("That's REAPER itself. Use the close button instead.", 'info');
        if (g.x & 8) { toast(`Restarting ${g.n}…`); return; }
        state.ended.add(g.k);
        push('end', `You ended ${g.n}`, true);
        toast(`Ended ${g.n}.`);
        setTimeout(() => { state.ended.delete(g.k); if (g.st === 'hung') g.st = 'run', g.sec = 'apps'; }, 9000);
        break;
      }
      case 'freeze': state.frozen.add(g.k); push('freeze', `You froze ${g.n}`); toast(`Froze ${g.n}. It uses no CPU until you unfreeze it.`); break;
      case 'unfreeze': state.frozen.delete(g.k); push('unfreeze', `You unfroze ${g.n}`); toast(`${g.n} is running again.`); break;
      case 'priority': toast(`${g.n} now runs at ${{ high: 'High', above: 'Above normal', below: 'Below normal', low: 'Low' }[m.v] || 'Normal'} priority.`); break;
      case 'open': case 'props': case 'search': case 'focus':
        toast('That works in the desktop app. This is a live preview.', 'info'); break;
    }
    tick();
  }

  return {
    receive(m) {
      switch (m.t) {
        case 'ready':
          deliver({ t: 'init', elevated: true, version: '1.0.0', max: false, hotkey: 'Ctrl+Alt+F', settings: state.settings });
          state.sendInit = true;
          tick();
          restart();
          break;
        case 'select': state.sel = m.k || null; state.sendHist = true; setTimeout(tick, 30); break;
        case 'expanded': state.expanded = new Set(m.keys); setTimeout(tick, 30); break;
        case 'action': action(m); break;
        case 'run': toast(`Started ${m.cmd}.`); break;
        case 'set':
          state.settings[m.key] = m.v;
          if (m.key === 'interval') { state.interval = m.v; restart(); }
          if (m.key === 'overlay' && m.v) toast('The game overlay lives in the desktop app.', 'info');
          deliver({ t: 'setting', key: m.key, v: m.v });
          break;
        case 'copy': toast('Copied.'); break;
        case 'elevate': toast('Already running as administrator.', 'info'); break;
        case 'win': case 'openLog': break;
      }
    },
  };
};
