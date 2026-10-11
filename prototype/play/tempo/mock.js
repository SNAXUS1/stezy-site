'use strict';
// Stand-in for the app when the UI runs in a plain browser: design checks, and the live demo on stezy.lt.
// Not shipped inside TEMPO. ?state=off|waiting|live  ?page=…  ?acc=#hex  ?empty=1  (window.TEMPO_DEMO = site demo)
(() => {
  const q = new URLSearchParams(location.search);
  const site = !!window.TEMPO_DEMO;
  const A = site ? window.TEMPO_DEMO.art : '../../../design/art/';
  // The site demo uses STEZY's own games; design checks use the owner's library (private art, never published)
  const games = site ? [
    { id: 'demo:ghost-line', name: 'Ghost Line', source: 'custom', art: { hero: A + 'ghost-line/race.webp', header: A + 'ghost-line/race.webp', icon: A + 'icons/ghost-line.png' } },
    { id: 'demo:shadow', name: 'Shadow', source: 'custom', art: { hero: A + 'shadow/race.webp', header: A + 'shadow/intro.webp', icon: A + 'icons/shadow.png' } },
    { id: 'demo:echo', name: 'Echo', source: 'custom', art: { hero: A + 'echo/cave.webp', header: A + 'echo/title.webp', icon: A + 'icons/echo.png' } },
  ] : [
    { id: 'steam:1422450', name: 'Deadlock', source: 'steam', art: { hero: A + 'deadlock-hero.jpg', header: A + 'deadlock-header.jpg', logo: A + 'deadlock-logo.png' } },
    { id: 'steam:285900', name: 'Gang Beasts', source: 'steam', art: { header: A + 'gangbeasts-header.jpg' } },
    { id: 'steam:1557740', name: 'ROUNDS', source: 'steam', art: { header: A + 'rounds-header.jpg' } },
    { id: 'steam:3892270', name: 'Gamble With Your Friends', source: 'steam', art: { header: A + 'gwyf-header.jpg' } },
    { id: 'steam:248570', name: 'Toribash', source: 'steam', art: { header: A + 'toribash-header.jpg' } },
    { id: 'exe:ghostline', name: 'Ghost Line', source: 'custom', art: { icon: A + 'ghostline-icon.png' } },
  ];
  const main = games[0];
  let seed = 3;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const series = (n, base, amp) => Array.from({ length: n }, (_, i) => Math.round((base + (rnd() - .5) * amp * .7 + Math.sin(i / 9) * amp * .3 - (rnd() < .025 ? amp * 1.2 : 0)) * 10) / 10);
  const mk = (id, ago, mins, avg, low1, low01, cpu, gpu, cap, bg, changes) => ({
    id, gameId: main.id, gameName: main.name, started: new Date(Date.now() - ago * 3600e3).toISOString(), seconds: mins * 60, learn: false,
    frames: Math.round(avg * mins * 60), avgFps: avg, low1, low01, avgFrameMs: Math.round(10000 / avg) / 10, cpuLimited: cpu, gpuLimited: gpu, capped: cap,
    presentMode: 'Composed: Flip', avgGpu: 71, maxGpuTemp: 74, avgCpuMaxCore: 91, minRamFreeGb: 2.8, avgRamFreeGb: 4.1, avgVramGb: 4.6, vramTotalGb: 6, tempoCpu: 0.4,
    background: bg, backgroundCpu: bg.reduce((a, b) => a + b.cpu, 0), series: series(220, avg, avg * .14), changes, overlayBlocked: false,
  });
  const bgApps = [{ pid: 0, name: 'opera.exe', cpu: 3.1 }, { pid: 0, name: 'Discord.exe', cpu: 1.4 }, { pid: 0, name: 'Spotify.exe', cpu: 1.2 }];
  const boostList = ['Game Mode on', 'Background recording paused', '2 apps stepped back', 'Game gets the processor first'];
  const sessions = q.get('empty') ? [] : [
    mk('20261011-2114', 1.5, 31, 71.2, 47.3, 33.1, .62, .33, .05, bgApps, boostList),
    mk('20261010-1902', 26, 44, 66.4, 41.0, 28.6, .70, .26, .04, bgApps.concat([{ pid: 0, name: 'OneDrive.exe', cpu: 1.1 }]), []),
    mk('20261009-2040', 49, 38, 65.8, 39.5, 26.2, .71, .25, .04, bgApps, []),
  ];
  const settings = {
    accent: q.get('acc') || '#D4FF3F', background: 'graphite', artBehindDial: true, artStyle: q.get('art') || 'tinted', grain: .35, motion: 'full',
    overlay: true, overlayStyle: q.get('ov') || 'minimal', overlayBox: +(q.get('box') || 0), overlaySize: 1, overlayCorner: 'tl', overlayNumbers: 'accent',
    overlayShow: ['fps', 'low1'], overlayHideFromCapture: false, autoOff: true, selectedGame: main.id,
    protectedApps: ['Discord.exe', 'Spotify.exe', 'TeamSpeak.exe', 'Mumble.exe', 'voicemeeterpro.exe'],
    boost: { stepBack: true, gameFirst: true, gameMode: true, recording: true, powerPlan: true, stepBackApps: ['opera.exe', 'chrome.exe', 'OneDrive.exe', 'EpicGamesLauncher.exe', 'wallpaper64.exe'] },
  };
  const apps = [
    { name: 'opera.exe', cpu: 3.4 }, { name: 'Discord.exe', cpu: 1.5 }, { name: 'Spotify.exe', cpu: 1.2 }, { name: 'OneDrive.exe', cpu: 0.9 },
    { name: 'EpicGamesLauncher.exe', cpu: 0.6 }, { name: 'steam.exe', cpu: 0.4 }, { name: 'voicemeeterpro.exe', cpu: 0.9 }, { name: 'NVIDIA Overlay.exe', cpu: 0.3 },
    { name: 'Code.exe', cpu: 0.2 }, { name: 'PowerToys.exe', cpu: 0.1 },
  ];
  const boostStatus = { gameMode: true, recordingOff: false, powerHigh: false, powerAvailable: true, onBattery: false };
  const deliver = m => setTimeout(() => window.__deliver(JSON.parse(JSON.stringify(m))), 0);
  let liveTimer = 0, t0 = 0, state = 'off';
  function live() {
    const t = (Date.now() - t0) / 1000;
    const fps = 72 + Math.sin(t / 2) * 6 + (Math.random() - .5) * 3;
    const recent = Array.from({ length: 240 }, (_, i) => Math.round((1000 / (72 + Math.sin((t * 60 - 240 + i) / 40) * 6) + (Math.random() - .5) * 1.4 + (i % 61 === 0 ? 7 : 0)) * 100) / 100);
    deliver({ t: 'live', fps, low1: 48.6, frameMs: 1000 / fps, recent, limiter: 'cpu', share: .64, mode: 'Composed: Flip', overlay: 'showing',
      sys: { cpuMax: 94, cpu: 66, cores: 6, gpu: 71, temp: 72, vramUsed: 4.4e9, vramTotal: 6.44e9, ramAvail: 4.2e9, ramTotal: 17.1e9, tempo: 0.4,
        top: [{ pid: 1, name: 'opera.exe', cpu: 1.1 }, { pid: 2, name: 'Discord.exe', cpu: 1.4 }, { pid: 3, name: 'Spotify.exe', cpu: 1.2 }] } });
  }
  function setState(st, learn) {
    state = st;
    clearInterval(liveTimer);
    deliver({ t: 'state', state: st, game: st === 'off' ? null : settings.selectedGame, gameName: (games.find(g => g.id === settings.selectedGame) || main).name, learn: !!learn,
      applied: st === 'off' || learn ? [] : st === 'live' ? boostList : boostList.slice(0, 3), since: st === 'live' ? new Date(Date.now() - 761e3).toISOString() : null });
    if (st === 'live') { t0 = Date.now(); live(); liveTimer = setInterval(live, 250); }
  }
  window.__mockSend = m => {
    if (m.t === 'ready') {
      deliver({ t: 'init', version: window.TEMPO_DEMO ? window.TEMPO_DEMO.version : '1.0.0', settings, games, sessions, boostStatus,
        hw: { cpu: 'i5-8400', gpu: 'GTX 1060 6GB', vram: 6, ram: 16, hz: 144 } });
      const st = q.get('state') || 'off';
      if (st !== 'off') setState(st);
      if (q.get('page')) setTimeout(() => document.querySelector(`[data-go="${q.get('page')}"]`)?.click(), 30);
    }
    if (m.t === 'on') { setState('waiting', m.learn); setTimeout(() => setState('live', m.learn), 2600); }
    if (m.t === 'off') {
      if (state === 'live') {
        const s = mk(new Date().toISOString().replace(/\D/g, '').slice(0, 14), 0, 12, 73.4, 49.1, 34.0, .6, .34, .06, bgApps, boostList);
        deliver({ t: 'session', session: s });
      }
      setState('off');
    }
    if (m.t === 'apps') deliver({ t: 'apps', apps, boostStatus });
    if (m.t === 'select') settings.selectedGame = m.game;
    if (m.t === 'open' && site) window.open(m.url, '_blank', 'noopener');
    if (m.t === 'addGame' && site) deliver({ t: 'toast', text: 'In the real TEMPO this opens a file picker for any game\'s .exe.' });
    if (m.t === 'min' || m.t === 'max' || m.t === 'close') { if (site) deliver({ t: 'toast', text: 'This is a live demo in your browser. Download TEMPO for the real thing.' }); }
  };
})();
