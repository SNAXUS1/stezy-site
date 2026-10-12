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
    hitches: Math.round(mins * 0.6), hitchesPerMin: 0.6,
    hitchCauses: { game: Math.round(mins * 0.3), loading: Math.round(mins * 0.15), app: Math.round(mins * 0.1) || 1, memory: Math.round(mins * 0.05) || 1 },
    worstHitches: [
      { t: mins * 9, ms: 74, cause: 'loading', detail: 'The game was loading from the drive (48 MB/s).' },
      { t: mins * 23, ms: 61, cause: 'app', detail: 'opera suddenly used 22% of your processor (usually 1.4%).' },
      { t: mins * 41, ms: 88, cause: 'memory', detail: 'Memory was nearly full (0.6 GB free) and Windows was reading 840 pages a second back from the drive.' },
      { t: mins * 52, ms: 66, cause: 'game', detail: 'Nothing outside the game stood out, so it came from the game itself: often shaders being prepared the first time something appears.' }],
    events: [`${new Date(Date.now() - ago * 3600e3 + 900e3).toTimeString().slice(0, 5)} memory ran short: opera, OneDrive handed back 640 MB`],
    blockFps: [], blockLow: [], blockJitter: [], secP10: Math.round(avg * 0.78), secP50: Math.round(avg * 1.05), experimentId: '', variant: '',
  });
  const bgApps = [{ pid: 0, name: 'opera.exe', cpu: 3.1 }, { pid: 0, name: 'Discord.exe', cpu: 1.4 }, { pid: 0, name: 'Spotify.exe', cpu: 1.2 }];
  const boostList = ['Game Mode on', 'Background recording paused', '2 apps stepped back', 'Game gets the processor first'];
  const withLow = s => { s.seriesLow = s.series.map(v => Math.round(v * (0.62 + rnd() * 0.18) * 10) / 10); return s; };
  const sessions = q.get('empty') ? [] : [
    mk('20261011-2114', 1.5, 31, 71.2, 47.3, 33.1, .62, .33, .05, bgApps, boostList),
    mk('20261010-1902', 26, 44, 66.4, 41.0, 28.6, .70, .26, .04, bgApps.concat([{ pid: 0, name: 'OneDrive.exe', cpu: 1.1 }]), []),
    mk('20261009-2040', 49, 38, 65.8, 39.5, 26.2, .71, .25, .04, bgApps, []),
  ].map(withLow);
  games.forEach(g => { g.canLaunch = true; });
  const settings = {
    accent: q.get('acc') || '#D4FF3F', background: 'graphite', artBehindDial: true, artStyle: q.get('art') || 'tinted', grain: .35, motion: 'full',
    overlay: true, overlayStyle: q.get('ov') || 'minimal', overlayBox: +(q.get('box') || 0), overlaySize: 1, overlayCorner: 'tl', overlayNumbers: 'accent',
    overlayShow: ['fps', 'low1'], overlayHideFromCapture: false, autoOff: true, selectedGame: main.id, phone: q.get('phone') === '1',
    experiments: [{ id: 'e1', label: 'Shadows: Medium → Low', aLabel: 'Medium', bLabel: 'Low' }],
    protectedApps: ['Discord.exe', 'Spotify.exe', 'TeamSpeak.exe', 'Mumble.exe', 'voicemeeterpro.exe'],
    boost: { stepBack: true, gameFirst: true, gameMode: true, recording: true, powerPlan: true, auto: true, stepBackApps: [], leaveAlone: [] },
  };
  // the Boost page's app picker: a few running apps and what the real TEMPO would decide for each (same rules, in short)
  const groups = [
    ['browsers', 'Browsers', 'step', 'Tabs and videos keep going, just behind your game.'], ['launchers', 'Launchers & stores', 'step', 'Downloads and store pages slow down a little; your game keeps talking to them.'],
    ['sync', 'Cloud & sync', 'step', 'Files still sync, a little slower.'], ['helpers', 'Updaters & helpers', 'step', "Background updaters and helper apps you don't need while you play."],
    ['lighting', 'RGB lighting & widgets', 'step', "Light effects, wallpapers and widgets. They may lag a little; your game won't."], ['work', 'Work & creative apps', 'step', 'Editors and tools left open. Exports and builds keep running, slower.'],
    ['busy', 'Anything else busy', 'step', 'Other apps that keep using the processor in the background while you play.'],
    ['calls', 'Calls & music', 'calls', 'So voice chat and music never stutter.'], ['game', 'Helps your game', 'keep', 'Anti-cheat, frame generation, overlays, recording, controllers and network tools.'],
  ].map(([id, label, kind, why]) => ({ id, label, kind, why, on: true }));
  const known = [
    ['opera.exe', 3.4, 'browsers'], ['Discord.exe', 1.5, 'calls'], ['Spotify.exe', 1.2, 'calls'], ['OneDrive.exe', 0.9, 'sync'], ['EpicGamesLauncher.exe', 0.6, 'launchers'],
    ['steamwebhelper.exe', 0.5, 'launchers'], ['steam.exe', 0.4, 'game', 'Controllers: slowing it would add input delay.'], ['LosslessScaling.exe', 0.8, 'game', 'It makes frames for your game. Slowing it would lower your fps.'],
    ['NVIDIA Overlay.exe', 0.3, 'game', 'An overlay or fps tool that runs alongside the game.'], ['Code.exe', 0.2, 'work'], ['wallpaper64.exe', 0.7, 'lighting'], ['GoogleDriveFS.exe', 0.3, 'sync'],
    ['PhoneExperienceHost.exe', 0.1, 'helpers'], ['ProjectHelper.exe', 2.6, null], ['notes-sync.exe', 0.2, null],
  ];
  const choices = {};
  const appsPayload = () => {
    const auto = settings.boost.auto !== false;
    const gOn = id => groups.find(g => g.id === id).on;
    const apps = known.map(([name, cpu, group, keepWhy]) => {
      const choice = choices[name] || '';
      const calls = group === 'calls' && choice !== 'on', kept = group === 'game' && choice !== 'on';
      const autoStep = auto && !!group && group !== 'calls' && group !== 'game' ? gOn(group) : auto && !group && gOn('busy') && cpu >= 1.5;
      const step = calls || kept ? false : choice === 'on' ? true : choice === 'off' ? false : autoStep;
      const why = calls ? 'Music and voice are left exactly as they are.' : kept ? keepWhy : choice === 'on' ? 'You picked it.' : choice === 'off' ? 'You chose to leave it alone.' : !group ? (step ? 'Busy in the background.' : 'Steps back only if it gets busy while you play.') : step ? 'Steps back automatically.' : 'This kind is switched off.';
      return { name, cpu, group: group || 'busy', step, auto: autoStep, why, locked: calls || kept, choice, calls, kept };
    }).sort((a, b) => b.cpu - a.cpu);
    return { t: 'apps', apps, groups, auto, busyPercent: 1.5, live: state !== 'off', boostStatus };
  };
  const boostStatus = { gameMode: true, recordingOff: false, powerHigh: false, powerAvailable: true, onBattery: false };
  // the Tune page: a running test, a finished one, suggestions and the game's own settings
  const L = (n, ...names) => names.slice(0, n + 1).map((nm, i) => ({ value: String(i), label: nm }));
  const gameSettings = [
    { key: 'display', label: 'Display mode', group: 'display', load: 'none', value: 'fullscreen', help: "Borderless looks the same as fullscreen on Windows 11 and lets TEMPO's fps counter show on top. Exclusive fullscreen keeps every other window off the screen.", options: [{ value: 'fullscreen', label: 'Fullscreen' }, { value: 'borderless', label: 'Borderless' }, { value: 'windowed', label: 'Windowed' }] },
    { key: 'FrameRateLimit', label: 'Fps limit', group: 'limit', load: 'none', value: '0', help: 'The most frames a second the game will draw. 0 means no limit.', options: [], min: 0, max: 1000 },
    { key: 'bUseVSync', label: 'V-Sync', group: 'limit', load: 'none', value: 'False', help: 'Waits for the screen before showing each frame. Stops tearing, adds a little delay, and caps fps at the refresh rate.', options: [{ value: 'False', label: 'Off' }, { value: 'True', label: 'On' }] },
    { key: 'sg.ShadowQuality', label: 'Shadows', group: 'quality', load: 'both', value: '1', help: 'Shadows load the graphics card a lot, and the processor a little for each thing that casts one.', options: L(3, 'Low', 'Medium', 'High', 'Epic') },
    { key: 'sg.ViewDistanceQuality', label: 'View distance', group: 'quality', load: 'both', value: '2', help: 'How far away things are still drawn in detail. More of it means more for the processor to send to the graphics card.', options: L(3, 'Low', 'Medium', 'High', 'Epic') },
    { key: 'sg.EffectsQuality', label: 'Effects', group: 'quality', load: 'both', value: '2', help: 'Particles, explosions and smoke. Busy fights get heavier with it.', options: L(3, 'Low', 'Medium', 'High', 'Epic') },
    { key: 'sg.PostProcessQuality', label: 'Post-processing', group: 'quality', load: 'gpu', value: '0', help: 'Bloom, blur, colour effects. Graphics card only.', options: L(3, 'Low', 'Medium', 'High', 'Epic') },
    { key: 'sg.AntiAliasingQuality', label: 'Anti-aliasing', group: 'quality', load: 'gpu', value: '0', help: 'Smooths jagged edges. Graphics card only.', options: L(3, 'Low', 'Medium', 'High', 'Epic') },
    { key: 'sg.TextureQuality', label: 'Textures', group: 'quality', load: 'vram', value: '2', help: 'Sharper textures need more graphics memory, not much speed. Lower them only if graphics memory runs full.', options: L(3, 'Low', 'Medium', 'High', 'Epic') },
  ];
  const meas = (a, b, lo, hi, call) => ({ a, b, diff: Math.round((b - a) * 100) / 100, lo, hi, call });
  const tunePayload = () => ({
    t: 'tune', game: settings.selectedGame, running: false, sessions: 3,
    config: { format: 'unreal', note: 'The Unreal Engine settings file. A few games keep their own copy and ignore it; a test session shows whether a change took.', file: 'GameUserSettings.ini', capKey: 'FrameRateLimit' },
    settings: gameSettings,
    suggestions: [
      { id: 'launch:-high', kind: 'launch', key: '-high', tag: 'fix', title: 'Remove -high from Steam\'s launch options', why: 'Asks Windows to put the game above almost everything, including sound and voice chat, which can make Discord and audio crackle. TEMPO\'s "Game first" does the same more gently while it\'s on. In Steam: right-click the game, Properties, Launch options.' },
      { id: 'display', kind: 'display', key: 'display', from: 'fullscreen', to: 'borderless', fromLabel: 'Fullscreen', toLabel: 'Borderless', tag: 'fix', title: 'Switch to borderless', why: "Exclusive fullscreen kept TEMPO's fps counter off your screen. On Windows 10 and 11 a borderless game gets the same fast path as fullscreen, so it usually costs nothing, and the counter can sit on top. Test it to see your own numbers." },
      { id: 'down:sg.ViewDistanceQuality', kind: 'setting', key: 'sg.ViewDistanceQuality', from: '2', to: '1', fromLabel: 'High', toLabel: 'Medium', tag: 'try', title: 'View distance: High → Medium', why: 'Your processor holds the game back on 62% of frames. View distance gives the processor work too, so lowering it is one of the few settings that can help. Worth a test.' },
      { id: 'up:sg.PostProcessQuality', kind: 'setting', key: 'sg.PostProcessQuality', from: '0', to: '1', fromLabel: 'Low', toLabel: 'Medium', tag: 'looks', title: 'Post-processing: Low → Medium', why: 'Your processor holds the game back on 62% of frames while the graphics card waits. Post-processing only uses the graphics card, so it probably looks better for free. TEMPO measures whether that\'s true on your PC.' },
    ],
    cap: { cap: 55, p10: 56, p50: 75, hz: 144, steady: false, why: 'Your fps jumps between about 56 and 75+. Capped at 55, which the game holds about 90% of the time, frames arrive evenly, which most people feel as smoother, and the graphics card runs cooler. The average goes down a little by design.' },
    experiments: [
      { exp: { id: 'e1', gameId: settings.selectedGame, kind: 'setting', key: 'sg.ShadowQuality', a: '1', b: '0', label: 'Shadows: Medium → Low', aLabel: 'Medium', bLabel: 'Low', status: 'running', verdict: '', outcome: '' },
        result: { sessionsA: 2, sessionsB: 2, minutesA: 41, minutesB: 37, fps: meas(66.2, 70.1, -0.8, 8.6, 'open'), low: meas(41.5, 44.2, -2.1, 7.5, 'open'), jitter: meas(1.6, 1.5, -0.4, 0.2, 'open'), verdict: 'collecting', moreSessions: 2, summary: 'Still measuring. Matches vary a lot, so TEMPO waits until it can tell a real difference from luck.' } },
      { exp: { id: 'e0', gameId: settings.selectedGame, kind: 'boost', key: 'boost.all', a: 'off', b: 'on', label: 'The whole boost: on or off', aLabel: 'Off', bLabel: 'On', status: 'done', verdict: 'better', outcome: '' },
        result: { sessionsA: 3, sessionsB: 3, minutesA: 92, minutesB: 88, fps: meas(64.9, 70.3, 2.9, 7.9, 'better'), low: meas(39.8, 46.1, 3.4, 9.2, 'better'), jitter: meas(1.7, 1.5, -0.5, 0.1, 'open'), verdict: 'better', moreSessions: 0, summary: 'It helps: +5.4 fps on average and +6.3 at the 1% lows.' } },
    ],
    kept: [{ gameId: settings.selectedGame, key: 'bUseVSync', label: 'V-Sync: On → Off', original: 'True', value: 'False', when: new Date(Date.now() - 86400e3 * 2).toISOString() }],
    launch: { raw: '-high -threads 6 -novid +fps_max 0', items: [
      { text: '-high', level: 'bad', what: 'Asks Windows to put the game above almost everything, including sound and voice chat, which can make Discord and audio crackle. TEMPO\'s "Game first" does the same more gently while it\'s on.' },
      { text: '-threads 6', level: 'tip', what: 'Old advice. Today\'s engines pick the number of threads themselves, and a wrong number can lower fps. Worth removing.' },
      { text: '-novid', level: 'ok', what: 'Harmless: opens the console or skips intro videos, controllers or the logo. No effect on fps once you\'re playing.' },
      { text: '+fps_max 0', level: 'ok', what: 'An fps limit set at start. A limit your PC can hold steadily feels smoother; the Tune page suggests one.' }] },
    boostOptions: settings.boost,
  });
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
      applied: st === 'off' || learn ? [] : st === 'live' ? boostList : boostList.slice(0, 3), since: st === 'live' ? new Date(Date.now() - 761e3).toISOString() : null,
      stepped: st === 'off' || learn ? [] : ['opera', 'OneDrive', 'EpicGamesLauncher', 'steamwebhelper', 'wallpaper64', 'Code'] });
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
    if (m.t === 'apps') deliver(appsPayload());
    if (m.t === 'set' && m.key === 'boost.auto') { settings.boost.auto = m.value; deliver(appsPayload()); }
    if (m.t === 'set' && m.key === 'boost.group') { groups.find(g => g.id === m.value.id).on = m.value.on; deliver(appsPayload()); }
    if (m.t === 'set' && m.key === 'boost.app') { if (m.value.choice === 'default') delete choices[m.value.name]; else choices[m.value.name] = m.value.choice; deliver(appsPayload()); }
    if (m.t === 'tune') setTimeout(() => deliver(tunePayload()), 250);
    if (m.t === 'phone' || m.t === 'phoneState') { if (m.t === 'phone') settings.phone = m.on; deliver({ t: 'phone', on: !!settings.phone, urls: settings.phone ? ['http://192.168.1.20:8735/?k=3f9a1c07be5d2a8e41', 'http://172.20.10.2:8735/?k=3f9a1c07be5d2a8e41'] : [], clients: settings.phone ? 1 : 0 }); }
    if ((m.t === 'test' || m.t === 'setNow' || m.t === 'keep' || m.t === 'putBack' || m.t === 'stopTest') && site) deliver({ t: 'toast', text: 'In the real TEMPO this sets up the test or changes the game\'s setting. This demo only shows how it looks.' });
    if (m.t === 'checkup') setTimeout(() => deliver({ t: 'checkup', boostStatus, findings: [
      { id: 'refresh-1', level: 'ok', title: 'Your screen runs at its full 144 Hz', text: '1920 × 1080, as fast as it goes.' },
      { id: 'ram-channel', level: 'tip', title: 'One memory stick: 16 GB in single channel', text: 'With one stick the processor gets its data at half the speed it could. In processor-heavy games a second matching stick (same size and speed) is often worth 10 to 30% more fps. Your PC has 2 slots.' },
      { id: 'driver', level: 'ok', title: 'Graphics driver from June 2026', text: 'NVIDIA GeForce GTX 1060 6GB is up to date enough.' },
      { id: 'disk', level: 'tip', title: 'C: is nearly full: 21 GB free', text: 'Games load and stream textures from it. A nearly full drive gets slower and games can stutter while loading.' },
      { id: 'windowed', level: 'ok', title: 'Optimizations for windowed games are on', text: 'Borderless games get the same fast path as fullscreen.' }] }), 500);
    if (m.t === 'select') settings.selectedGame = m.game;
    if (m.t === 'open' && site) window.open(m.url, '_blank', 'noopener');
    if (m.t === 'addGame' && site) deliver({ t: 'toast', text: 'In the real TEMPO this opens a file picker for any game\'s .exe.' });
    if (m.t === 'min' || m.t === 'max' || m.t === 'close') { if (site) deliver({ t: 'toast', text: 'This is a live demo in your browser. Download TEMPO for the real thing.' }); }
  };
})();
