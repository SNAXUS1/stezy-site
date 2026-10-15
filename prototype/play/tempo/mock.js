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
    medianLatencyMs: +(24 + rnd() * 8).toFixed(1), p95LatencyMs: +(40 + rnd() * 10).toFixed(1), medianGpuBusyMs: +(9 + rnd() * 2).toFixed(2), medianCpuBusyMs: +(11 + rnd() * 2).toFixed(2), medianFrameMs: +(1000 / avg).toFixed(2),
    hitches: Math.round(mins * 0.6), hitchesPerMin: 0.6, uneven: +(0.04 + rnd() * 0.08).toFixed(3), swapSeconds: 0, gpuSlowSeconds: 0, overlayPath: ago < 2 ? 'costs' : '',
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
  // heat and fans along the match: the newest on TEMPO's curve (cooler), the older ones on the card's own control (hot, held back)
  const withHeat = (s, i) => {
    const n = s.series.length, curve = i === 0;
    s.seriesTemp = s.series.map((_, k) => { const warm = Math.min(1, k / 40); return Math.round(((curve ? 52 + warm * 19 : 54 + warm * 30) + Math.sin(k / 7) * 1.4 + (rnd() - .5) * 1.2) * 10) / 10; });
    s.seriesFan = s.seriesTemp.map(t => curve ? Math.round(Math.min(72, t <= 45 ? 35 : t <= 60 ? 35 + (t - 45) : t <= 70 ? 50 + (t - 60) * 1.2 : 62 + (t - 70) * 1.25)) : Math.round(Math.max(28, Math.min(58, 28 + (t - 55) * 1.1))));
    s.seriesHeat = s.seriesTemp.map(t => t >= 83 ? 1 : 0);
    s.maxGpuTemp = Math.round(Math.max(...s.seriesTemp));
    s.gpuSlowSeconds = Math.round(s.seriesHeat.filter(v => v).length / n * s.seconds);
    s.avgFan = Math.round(s.seriesFan.reduce((a, b) => a + b, 0) / n); s.maxFan = Math.max(...s.seriesFan);
    s.fanCurve = curve ? 'Balanced, up to 75%' : '';
    if (curve) s.changes = s.changes.concat(["Fans on TEMPO's Balanced curve, up to 75%"]);
    return s;
  };
  // ?freeze=1: the older matches froze while NVIDIA's container spiked (like the owner's), the new one is counted per app
  const withFreeze = s => { if (q.get('freeze')) s.worstHitches = s.worstHitches.concat([{ t: 80, ms: 938, cause: 'app', detail: 'NVIDIA container suddenly used 17% of your processor (usually 0.4%).' }, { t: 182, ms: 1072, cause: 'app', detail: 'NVIDIA container suddenly used 15% of your processor (usually 0.4%).' }]); return s; };
  const sessions = q.get('empty') ? [] : [
    mk('20261011-2114', 1.5, 31, 71.2, 47.3, 33.1, .62, .33, .05, bgApps, boostList),
    mk('20261010-1902', 26, 44, 66.4, 41.0, 28.6, .70, .26, .04, bgApps.concat([{ pid: 0, name: 'OneDrive.exe', cpu: 1.1 }]), []),
    mk('20261009-2040', 49, 38, 65.8, 39.5, 26.2, .71, .25, .04, bgApps, []),
  ].map(withLow).map(withFreeze).map(withHeat);
  games.forEach(g => { g.canLaunch = true; });
  const settings = {
    accent: q.get('acc') || '#D4FF3F', background: 'graphite', artBehindDial: true, artStyle: q.get('art') || 'tinted', grain: .35, motion: 'full',
    aim: { dpi: site ? 800 : 1600, base: site ? 'manual' : '', manualEngine: 'cs2', manualSens: site ? 1.1 : 0, finds: [], rawAccelDir: '', rawAccelBackup: '', curve: null },
    lastAim: q.get('aim') === '0' ? null : { device: 'DeathAdder V3', vendor: 'Razer', reports: 7980, movingSeconds: 7.9, rate: 998, nominal: 1000, onTime: 0.982, late: 6, bunched: 3, worstGapMs: 2.6, intervals: [], verdict: 'ok', notes: [] },
    intro: q.get('intro') === '1' || site, overlay: true, overlayStyle: q.get('ov') || 'minimal', overlayBox: +(q.get('box') || 0), overlaySize: 1, overlayCorner: 'tl', overlayNumbers: 'accent',
    overlayShow: ['fps', 'low1'], overlayHideFromCapture: false, autoOff: true, selectedGame: main.id, phone: q.get('phone') === '1',
    experiments: [{ id: 'e1', label: 'Shadows: Medium → Low', aLabel: 'Medium', bLabel: 'Low' }],
    kept: q.get('kept') ? [{ gameId: 'steam:1422450', key: 'sg.ViewDistanceQuality', label: 'View distance: High → Medium', original: '2', value: '1', when: new Date(Date.now() - 10 * 3600e3).toISOString(), confirmed: false }] : [],
    protectedApps: ['Discord.exe', 'Spotify.exe', 'TeamSpeak.exe', 'Mumble.exe', 'voicemeeterpro.exe'],
    cooling: { on: q.get('cool') !== '0', preset: 'balanced', points: null, max: +(q.get('fanmax') || 75) },
    boost: { stepBack: true, gameFirst: true, gameMode: true, recording: true, powerPlan: true, auto: true, stepBackApps: [], leaveAlone: [], pause: q.get('pause') === '1', pauseApps: ['opera.exe', 'chrome.exe', 'msedge.exe', 'firefox.exe', 'wallpaper64.exe'] },
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
      const label = { 'opera.exe': 'Opera', 'EpicGamesLauncher.exe': 'Epic Games', 'steamwebhelper.exe': 'Steam pages', 'steam.exe': 'Steam', 'LosslessScaling.exe': 'Lossless Scaling', 'NVIDIA Overlay.exe': 'NVIDIA overlay', 'Code.exe': 'VS Code', 'wallpaper64.exe': 'Wallpaper Engine', 'GoogleDriveFS.exe': 'Google Drive', 'PhoneExperienceHost.exe': 'Phone Link' }[name] || name.replace(/\.exe$/i, '');
      return { name, label, cpu, group: group || 'busy', step, auto: autoStep, why, locked: calls || kept, choice, calls, kept };
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
    { key: 'nv.frl', label: 'Driver fps limit', group: 'driver', load: 'none', value: '0', help: "NVIDIA's own limiter. It works in every game, even ones without a limit of their own, and holds frames as evenly as a game's built-in one. 0 means none.", options: [], min: 0, max: 1000 },
    { key: 'nv.prerender', label: 'Low latency mode', group: 'driver', load: 'none', value: '0', help: 'Keeps the processor from queueing frames ahead of the graphics card, which cuts input delay when the graphics card is the limit. Games with NVIDIA Reflex do this themselves.', options: [{ value: '0', label: 'Off (the game decides)' }, { value: '1', label: 'On' }] },
    { key: 'nv.pstate', label: 'Power management', group: 'driver', load: 'none', value: '5', help: "Maximum performance keeps the graphics card's clocks up between frames, so a quiet moment doesn't make the next busy one stutter. Costs a little power.", options: [{ value: '5', label: 'Normal' }, { value: '0', label: 'Adaptive' }, { value: '1', label: 'Prefer maximum performance' }] },
  ];
  const meas = (a, b, lo, hi, call) => ({ a, b, diff: Math.round((b - a) * 100) / 100, lo, hi, call });
  const tunePayload = () => ({
    t: 'tune', game: settings.selectedGame, running: false, sessions: 3,
    config: { format: 'unreal', note: 'The Unreal Engine settings file. A few games keep their own copy and ignore it; a test session shows whether a change took.', file: 'GameUserSettings.ini', place: '~\\AppData\\Local\\MarvelGame\\Saved\\Config\\Windows\\GameUserSettings.ini', seen: 'yes', capKey: 'FrameRateLimit' },
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
    kept: [{ gameId: settings.selectedGame, key: 'bUseVSync', label: 'V-Sync: On → Off', original: 'True', value: 'False', when: new Date(Date.now() - 86400e3 * 2).toISOString() }].concat(q.get('missed') ? [
      { gameId: settings.selectedGame, key: 'FrameRateLimit', label: 'Fps limit: 164 → 120', original: '164', value: '120', when: new Date(Date.now() - 86400e3).toISOString(), missed: true, now: '164' },
      { gameId: settings.selectedGame, key: 'sg.PostProcessQuality', label: 'Motion blur: On → Off', original: '1', value: '0', when: new Date(Date.now() - 86400e3).toISOString(), missed: true, now: '1' }] : []),
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
    deliver({ t: 'live', fps, low1: 48.6, frameMs: 1000 / fps, latency: 23.4, recent, limiter: 'cpu', share: .64, mode: 'Composed: Flip', overlay: 'showing',
      cool: { state: settings.cooling.on ? 'on' : 'off', tool: '', speed: settings.cooling.on ? 64 : -1 },
      sys: { cpuMax: 94, cpu: 66, cores: 6, gpu: 71, temp: 72, fan: settings.cooling.on ? 64 : 47, vramUsed: 4.4e9, vramTotal: 6.44e9, ramAvail: 4.2e9, ramTotal: 17.1e9, tempo: 0.4,
        top: [{ pid: 1, name: 'opera.exe', label: 'Opera', cpu: 1.1 }, { pid: 2, name: 'Discord.exe', label: 'Discord', cpu: 1.4 }, { pid: 3, name: 'Spotify.exe', label: 'Spotify', cpu: 1.2 }] } });
  }
  function setState(st, learn) {
    state = st;
    clearInterval(liveTimer);
    deliver({ t: 'state', state: st, game: st === 'off' ? null : settings.selectedGame, gameName: (games.find(g => g.id === settings.selectedGame) || main).name, learn: !!learn,
      applied: st === 'off' || learn ? [] : st === 'live' ? boostList : boostList.slice(0, 3), since: st === 'live' ? new Date(Date.now() - 761e3).toISOString() : null,
      stepped: st === 'off' || learn ? [] : ['Opera', 'OneDrive', 'Epic Games', 'Steam pages', 'Wallpaper Engine', 'VS Code'],
      cool: { state: !settings.cooling.on ? 'off' : st === 'live' ? (learn ? 'learn' : 'on') : 'ready', tool: '', speed: st === 'live' && settings.cooling.on ? 64 : -1 } });
    if (st === 'live') { t0 = Date.now(); live(); liveTimer = setInterval(live, 250); }
  }
  // the Aim page: a finder result (?find=1), Raw Accel (?ra=1 ready, ?ra=on with TEMPO's curve), the screen
  const sampleFind = () => {
    const tb = Math.log(0.86), fb = Math.log(1.18);
    const ft = [-2.6, -2.6 * -2 * tb, 0.2 - 2.6 * tb * tb], ff = [-1.9, -1.9 * -2 * fb, 1.1 - 1.9 * fb * fb];
    const at = (f, x) => f[0] * x * x + f[1] * x + f[2];
    const jit = [0.02, -0.03, 0.015, -0.01, 0.025];
    return { when: new Date(Date.now() - 3 * 3600e3).toISOString(), baseGame: site ? 'manual:cs2' : 'steam:1422450', baseName: site ? 'Counter-Strike 2' : 'Deadlock', baseSens: site ? 1.1 : 1.15, baseYaw: 0.022, raw: true,
      best: 0.95, trackBest: 0.86, flickBest: 1.18, gain: 0.06, close: false,
      say: `Slow for tracking, quick for big turns. Set ${site ? 'Counter-Strike 2 to 0.95' : 'Deadlock to 0.99'} for tracking, and let a curve speed up fast moves to ×1.32: in the test it kept your tracking (−1%) and made your flicks +9%.`,
      points: [0.75, 0.87, 1, 1.15, 1.33].map((m, i) => ({ m, track: at(ft, Math.log(m)) + jit[i], flick: at(ff, Math.log(m)) - jit[i] })),
      fit: { t: ft, f: ff }, curve: { start: 2.4, top: 11.5, max: 1.32 }, curveTest: { track: -0.01, flick: 0.09 },
      speeds: { track: Array.from({ length: 220 }, (_, i) => +(0.2 + Math.abs(Math.sin(i * 1.7)) * 2.6 + (i % 7) * 0.05).toFixed(2)), flick: Array.from({ length: 60 }, (_, i) => +(8 + Math.abs(Math.sin(i * 2.3)) * 9).toFixed(2)) } };
  };
  if (q.get('find')) settings.aim.finds = [sampleFind()];
  const raState = () => {
    const ra = q.get('ra');
    if (!ra) return { driver: false, dir: '', hasSettings: false, editable: false, mode: '', note: '' };
    return { driver: true, dir: 'C:\\Tools\\RawAccel', hasSettings: true, editable: true, mode: ra === 'on' ? 'classic' : 'noaccel', gain: false, offset: 2.4, accel: 0.0352, cap: 1.32, exponent: 2,
      ours: ra === 'on' ? { start: 2.4, top: 11.5, max: 1.32, applied: new Date(Date.now() - 86400e3).toISOString() } : null, note: '' };
  };
  const aimState = () => ({ t: 'aimState',
    sens: site ? [] : [{ gameId: 'steam:1422450', name: 'Deadlock', sens: 1.15, yaw: 0.022, place: 'Steam\\userdata\\…\\user_convars_0_slot0.vcfg' }],
    engines: [['deadlock', 'Deadlock', 0.022], ['cs2', 'Counter-Strike 2', 0.022], ['apex', 'Apex Legends', 0.022], ['valorant', 'Valorant', 0.07], ['overwatch', 'Overwatch 2', 0.0066], ['tf2', 'Team Fortress 2', 0.022]].map(([id, name, yaw]) => ({ id, name, yaw })),
    rawAccel: raState(), vendor: 4318,
    refresh: site ? [{ gameId: 'steam:1422450', name: 'Deadlock', hz: 144, fullscreen: true, desktopHz: 144 }] : [{ gameId: 'steam:1422450', name: 'Deadlock', hz: 50, fullscreen: true, desktopHz: 144 }],
    screen: { name: 'EI242QR', hz: 144, link: site ? 'displayport' : 'hdmi', vrr: true, vrrKind: 'freesync', vrrMin: 48, vrrMax: 144 },
    sync: site ? { kind: 'turnon', level: 'info', title: 'Your screen has FreeSync (48–144 Hz)', text: 'With it on, the screen waits for each frame instead of showing frames for uneven times, so aim stays smooth when your fps moves around. TEMPO can\'t see whether it\'s switched on: NVIDIA Control Panel, Display, Set up G-SYNC.' }
      : { kind: 'cable', level: 'tip', title: 'EI242QR has FreeSync (48–144 Hz), but not over HDMI with NVIDIA', text: 'NVIDIA cards can only follow the game\'s frames on this screen through DisplayPort. If the screen has a DisplayPort input, a DisplayPort cable lets you switch on G-SYNC Compatible (NVIDIA Control Panel, Display, Set up G-SYNC): no more tearing or judder when your fps moves around. A steady fps limit at 72 (half of 144 Hz) shows every frame for the same time instead.' } });
  // ?nofans=1: a PC whose card can't have its fans set (the tab greys out)
  const fansPayload = () => q.get('nofans')
    ? { t: 'fans', ready: false, able: false, kind: 'nonvidia', why: 'Fan control works on NVIDIA graphics cards whose driver allows it. This PC has AMD Radeon RX 6600.' }
    : Object.assign({ able: true, kind: 'ok' }, { t: 'fans', ready: true, count: 1, min: 20, max: 100, speed: state === 'live' && settings.cooling.on ? 64 : 30, policy: state === 'live' && settings.cooling.on ? 1 : 0, target: 30, temp: state === 'live' ? 72 : 46,
      tool: q.get('fantool') ? 'MSI Afterburner' : null, hardMax: 90, warnAbove: 80, minMax: 40, hot: 87,
      presets: { quiet: [[50, 30], [65, 45], [75, 58], [83, 70]], balanced: [[45, 35], [60, 50], [70, 62], [78, 72]], cool: [[40, 40], [55, 55], [65, 68], [72, 80]] } });
  // ---------- Calibrate: ?lab=setup|nofit|fetch|running|done|stopped (made-up numbers in the shape TEMPO sends)
  const labMode = q.get('lab') || 'done';
  const labTests = [
    { id: 'vulkan', label: 'Vulkan instead of DirectX 11', kind: 'args', warmup: true, config: {}, was: {}, why: 'Deadlock can also draw with Vulkan, which spreads the processor\'s drawing work differently. On some PCs it\'s clearly faster, on others slower. The first start builds its shaders, so that run doesn\'t count.' },
    { id: 'gpu', label: '3 graphics settings lower', kind: 'config', config: { 'setting.r_citadel_ssao_quality': '0', 'setting.shaderquality': '0', 'setting.r_particle_depth_feathering': 'false' }, was: { 'setting.r_citadel_ssao_quality': '2', 'setting.shaderquality': '1', 'setting.r_particle_depth_feathering': 'true' }, why: 'Ambient occlusion, Shader detail, Soft particles are above the lowest. They cost the graphics card; if it\'s what holds your PC back in fights, lowering them helps.' },
    { id: 'cpu', label: 'Processor detail lower', kind: 'config', config: { 'setting.cpu_level': '0' }, was: { 'setting.cpu_level': '1' }, why: 'Deadlock\'s processor detail level decides how much it works out for effects and physics. On a PC the processor holds back, lower can mean more fps in fights.' },
    { id: 'noopts', label: 'Without your launch options', kind: 'noopts', config: {}, was: {}, why: 'Your Steam launch options (-dev -preload -noassert -console …) come from old guides. Does the game run better without them?' },
    { id: 'nvpower', label: 'NVIDIA: prefer maximum performance', kind: 'config', config: { 'nv.pstate': '1' }, was: { 'nv.pstate': '5' }, why: 'Keeps the graphics card\'s clocks up for Deadlock instead of letting the driver lower them between frames. Only for this game.' },
    { id: 'boost', label: 'TEMPO\'s boost', kind: 'boost', config: {}, was: {}, why: 'The boost as you\'ve set it on the Boost page: background apps step back, the game goes first, Game Mode and the rest. Does it help on your PC?' },
  ];
  const labResults = {
    vulkan: ['better', 9.6, 7.8, 3.1, 'launch', 'Add -vulkan to Deadlock\'s launch options in Steam.', '+9.6% fps on average, the slowest frames faster by 8%. Measured 2 times; well beyond the wobble between runs (±3.1%).'],
    gpu: ['better', 4.4, 6.1, 3.1, 'config', '', '+4.4% fps on average, the slowest frames faster by 6%. Measured 2 times; well beyond the wobble between runs (±3.1%).'],
    cpu: ['same', 0.6, -0.4, 3.1, 'config', '', 'No difference worth having (+0.6%, within the ±3.1% your PC wobbles between runs).'],
    noopts: ['same', 1.1, 0.8, 3.1, 'launch', 'Clear Deadlock\'s launch options in Steam (right-click Deadlock, Properties, Launch options).', 'No difference worth having (+1.1%, within the ±3.1% your PC wobbles between runs).'],
    nvpower: ['unclear', 2.4, 1.0, 3.1, 'config', '', '+2.4% so far, but your PC wobbles ±3.1% between runs, so it\'s too close to call.'],
    boost: ['worse', -3.9, -2.2, 3.1, 'boost', '', '−3.9% fps on average: it costs you. Measured 2 times.'],
  };
  const labRun = (i, test, fps, warm) => ({ index: i, test, warmup: !!warm, ok: true, fps, p95: +(1000 / fps * 1.32).toFixed(1), p50: +(1000 / fps * .97).toFixed(1), secs: 104, away: 0, error: null, render: test === 'vulkan' ? 'Vulkan' : 'DirectX 11' });
  const labSeq = [['base', 55.1, 1], ['base', 57.0], ['vulkan', 52.3, 1], ['vulkan', 62.4], ['gpu', 59.4], ['base', 56.8], ['cpu', 57.3], ['noopts', 57.6], ['base', 56.1], ['nvpower', 58.0], ['boost', 54.6], ['base', 57.3], ['boost', 55.0], ['nvpower', 58.6], ['base', 56.5], ['noopts', 57.1], ['cpu', 56.9], ['base', 57.2], ['gpu', 59.8], ['vulkan', 62.0], ['base', 56.9]];
  const labSession = (done, status) => ({
    id: '20261015-214512', gameId: 'steam:1422450', demo: '117460073', demoMinutes: 36.5, plan: 'thorough', started: new Date(Date.now() - 40 * 60e3).toISOString(), finished: status === 'running' ? null : new Date().toISOString(),
    status, note: status === 'stopped' ? 'You stopped it.' : null, baseFps: 56.8, baseP50: 17.1, baseP95: 23.4, noise: 1.9, render: 'DirectX 11', gameHz: 50, desktopHz: 144, disturbed: 0,
    parts: { FrameTotal: 18.35, 'Client Rendering': 10.95, 'Frame Boundary': 6.22, 'Client Simulation': 3.56, PanoramaUI: 1.96, Networking: 1.94, 'Client Physics': 1.14, Client_Animation: 0.39 },
    done, total: labSeq.length, queue: labSeq.slice(done).map(([t, , w]) => (w ? 'warm:' : '') + t),
    runs: labSeq.slice(0, done).map(([t, f, w], i) => labRun(i, t, f, w)),
    tests: labTests.map(t => {
      const r = labResults[t.id], measured = status !== 'running' || done > 12;
      return Object.assign({}, t, measured ? { verdict: r[0], gain: r[1], worstGain: r[2], margin: r[3], runs: 2, summary: r[6], keep: r[4], keepText: r[5], kept: false, error: null }
        : { verdict: done > 4 && t.id === 'vulkan' ? 'unclear' : '', gain: done > 4 && t.id === 'vulkan' ? 9.4 : 0, worstGain: 0, margin: 0, runs: 0, summary: '', keep: r[4], keepText: r[5], kept: false, error: null });
    }),
  });
  const labPayload = () => {
    const fits = labMode !== 'nofit';
    const running = labMode === 'running';
    const session = labMode === 'done' ? labSession(labSeq.length, 'done') : labMode === 'stopped' ? labSession(9, 'stopped') : running ? labSession(7, 'running') : null;
    return {
      t: 'lab', game: 'steam:1422450', gameName: 'Deadlock', supported: true, why: '', steam: true, gameOpen: false, tempoOn: false, running, stopping: false,
      step: running ? 'Processor detail lower · Playing the fight' : '', client: 6785,
      replays: [fits && { name: '117460073', minutes: 36.5, saved: new Date(Date.now() - 50 * 60e3).toISOString(), fits: true, version: 6785, mb: 368, owned: true },
        { name: '91521097', minutes: 48, saved: '2025-07-02T11:34:00', fits: false, version: 6201, mb: 620, owned: false }].filter(Boolean),
      tests: labTests, runs: { quick: 11, thorough: 19, quickMin: 20, thoroughMin: 34 },
      session, history: session ? [{ id: session.id, started: session.started, status: session.status, baseFps: 56.8, plan: 'thorough', runs: session.done, best: { label: 'Vulkan instead of DirectX 11', gain: 9.6 } },
        { id: '20261012-201000', started: '2026-10-12T20:10:00', status: 'done', baseFps: 54.9, plan: 'quick', runs: 11, best: null }] : [],
      fetch: labMode === 'fetch' ? { stage: 'Downloading the replay', pct: 0.42 } : null,
    };
  };
  window.__mockSend = m => {
    if (m.t === 'ready') {
      deliver({ t: 'init', version: window.TEMPO_DEMO ? window.TEMPO_DEMO.version : '1.0.0', settings, games, sessions, boostStatus,
        shortcuts: { desktop: false, start: false, asked: !q.get('sc'), temporary: q.get('sc') === 'zip', home: '~\\AppData\\Local\\Programs\\TEMPO' },
        hw: { cpu: 'i5-8400', gpu: 'GTX 1060 6GB', vram: 6, ram: 16, hz: 144 } });
      const st = q.get('state') || 'off';
      if (st !== 'off') setState(st);
      deliver(fansPayload());
      if (q.get('page')) setTimeout(() => document.querySelector(`[data-go="${q.get('page')}"]`)?.click(), 30);
      if (q.get('new')) deliver({ t: 'whatsnew', version: '1.3.0' });
    }
    if (m.t === 'on') { setState('waiting', m.learn); setTimeout(() => setState('live', m.learn), 2600); }
    if (m.t === 'off') {
      if (state === 'live') {
        const s = mk(new Date().toISOString().replace(/\D/g, '').slice(0, 14), 0, 12, 73.4, 49.1, 34.0, .6, .34, .06, bgApps, boostList);
        s.hitchApps = { Opera: 2 }; s.freezeApps = {};
        withHeat(withLow(s), 0);
        deliver({ t: 'session', session: s });
      }
      setState('off');
    }
    if (m.t === 'apps') deliver(appsPayload());
    if (m.t === 'fans') setTimeout(() => deliver(fansPayload()), 120);
    if (m.t === 'aimState') setTimeout(() => deliver(aimState()), 150);
    if (m.t === 'aimSet') { if (m.dpi != null) settings.aim.dpi = m.dpi; if (m.base != null) settings.aim.base = m.base; if (m.engine) settings.aim.manualEngine = m.engine; if (m.sens != null) settings.aim.manualSens = m.sens; deliver({ t: 'settings', settings }); }
    if (m.t === 'aimFind') { settings.aim.finds.unshift(m.result); deliver({ t: 'settings', settings }); }
    if (m.t === 'aimCheck') { settings.aim.checks = [m.result].concat(settings.aim.checks || []); deliver({ t: 'settings', settings }); }
    if (m.t === 'aimHz') deliver({ t: 'toast', text: site ? 'In the real TEMPO this sets Deadlock to your screen\'s full refresh rate.' : 'Mock: aimHz ' + m.game });
    if (m.t === 'rawAccel') deliver({ t: 'toast', text: site ? 'In the real TEMPO this sets the curve in Raw Accel (if it\'s installed).' : 'Mock: Raw Accel ' + m.do });
    if (m.t === 'shortcut') { if (site) deliver({ t: 'toast', text: 'In the real TEMPO this puts a shortcut on your desktop or in Start.' }); }
    if (m.t === 'fanListen') deliver(site ? { t: 'toast', text: 'In the real TEMPO the fans run at this speed for a few seconds, so you can hear it.' } : { t: 'listening', percent: m.percent, seconds: 8 });
    if (m.t === 'set' && m.key.startsWith('cooling.')) { const k = m.key.split('.')[1]; settings.cooling[k] = m.value; if (k === 'points') settings.cooling.preset = 'custom'; }
    if (m.t === 'preflight') setTimeout(() => deliver({ t: 'preflight', game: m.game, then: m.then, items: q.get('nopre') ? [] : [
      { id: 'memory', level: 'warn', title: '2.4 GB of memory free', text: 'Games stutter when memory runs out, while Windows moves things to the drive. Last time this game ran short and Windows swapped to the drive for 18 s, which shows up as stutters. Using the most: Opera GX 3.1 GB, Wallpaper Engine 0.6 GB, Discord 0.5 GB. Closing browser tabs frees the most.', action: '' },
      { id: 'launch', level: 'tip', title: 'Steam launch options: -high -fullscreen', text: '-high can make sound and voice chat crackle when the processor is busy; -fullscreen forces exclusive fullscreen, which hides the fps counter. Steam rewrites these while it runs, so remove them there: right-click Deadlock, Properties, Launch options.', action: '' },
      { id: 'cap', level: 'tip', title: "Deadlock's fps limit is 164, more than your PC holds", text: 'Your fps usually swings between about 71 and 97. A limit of 70 holds steady: frames arrive evenly, which feels smoother, and the graphics card runs cooler. You can put it back on the Tune page any time.', action: 'setNow', actionLabel: 'Set 70', key: 'setting.fps_max', value: '70' }] }), 350);
    if (m.t === 'aimStart') {
      let n = 0, a = 0;
      clearInterval(window.__aimT);
      window.__aimT = setInterval(() => {
        n++;
        const moves = Array.from({ length: 100 }, () => { a += 0.012; return [Math.round(Math.cos(a) * 40 + (Math.random() - .5) * 6), Math.round(Math.sin(a) * 40 + (Math.random() - .5) * 6)]; });
        const left = Math.max(0, 8 - n / 10);
        deliver({ t: 'aimLive', reports: n * 100, rate: 990 + Math.random() * 20, left, moved: true, moves });
        if (left <= 0) {
          clearInterval(window.__aimT);
          const intervals = Array.from({ length: 600 }, (_, i) => Math.round(1000 + (Math.random() - .5) * 120 + (i % 97 === 0 ? 1400 : 0)));
          deliver({ t: 'aim', result: { device: 'G Pro Wireless', vendor: 'Logitech', reports: 7980, movingSeconds: 7.9, rate: 998, nominal: 1000, onTime: 0.982, late: 6, bunched: 3, worstGapMs: 2.6, intervals, verdict: 'ok',
            notes: [{ id: 'rawaccel', level: 'info', title: "Raw Accel's window is open", text: 'Its driver shapes your mouse movement, on purpose. The window itself draws a live graph as you move; you can close it while you play, the driver keeps your settings.' }], error: '' } });
        }
      }, 100);
    }
    if (m.t === 'aimStop') { clearInterval(window.__aimT); deliver({ t: 'aim', cancelled: true }); }
    if (m.t === 'set' && m.key === 'boost.auto') { settings.boost.auto = m.value; deliver(appsPayload()); }
    if (m.t === 'set' && m.key === 'boost.group') { groups.find(g => g.id === m.value.id).on = m.value.on; deliver(appsPayload()); }
    if (m.t === 'set' && m.key === 'boost.app') { if (m.value.choice === 'default') delete choices[m.value.name]; else choices[m.value.name] = m.value.choice; deliver(appsPayload()); }
    if (m.t === 'tune') setTimeout(() => deliver(tunePayload()), 250);
    if (m.t === 'lab') setTimeout(() => deliver(labPayload()), 200);
    if (m.t === 'labFetch' || m.t === 'labStart' || m.t === 'labKeep' || m.t === 'labHz') deliver({ t: 'toast', text: site ? 'In the real TEMPO this runs Deadlock\'s own benchmark on your PC. This demo only shows how it looks.' : 'Mock: ' + m.t });
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
