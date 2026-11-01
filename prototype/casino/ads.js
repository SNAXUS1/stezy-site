'use strict';
/* Rewarded ads for products that should not exist. Seven animated layouts, meme images and GIFs,
   and a procedural soundtrack: every ad composes its own little tune in one of twelve styles. */
const Jingle = (() => {
  let ctx = null, out = null, noiseBuf = null, timer = null, song = null, muted = false;
  const VOL = .16, mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], penta: [0, 2, 4, 7, 9], blues: [0, 3, 5, 6, 7, 10], dorian: [0, 2, 3, 5, 7, 9, 10], harm: [0, 2, 3, 5, 7, 8, 11] };
  // prog = chord roots as scale degrees, one per bar; dens = how busy the melody is
  const STYLES = {
    elevator: { bpm: 88, scale: 'major', root: 60, lead: 'sine', bass: 'triangle', prog: [0, 5, 3, 4], dens: .45, drums: 'brush', swing: .18, chord: 'pad' },
    polka: { bpm: 152, scale: 'major', root: 62, lead: 'square', bass: 'triangle', prog: [0, 4, 0, 4], dens: .75, drums: 'oompah' },
    chip: { bpm: 160, scale: 'penta', root: 64, lead: 'square', bass: 'square', prog: [0, 3, 2, 4], dens: .8, drums: 'chip', arp: true },
    epic: { bpm: 92, scale: 'harm', root: 52, lead: 'sawtooth', bass: 'sawtooth', prog: [0, 5, 3, 4], dens: .35, drums: 'epic', chord: 'brass' },
    spooky: { bpm: 74, scale: 'harm', root: 57, lead: 'sine', bass: 'triangle', prog: [0, 3, 5, 4], dens: .4, drums: 'none', vib: 9, chord: 'pad' },
    disco: { bpm: 120, scale: 'dorian', root: 57, lead: 'sawtooth', bass: 'sawtooth', prog: [0, 3, 0, 4], dens: .55, drums: 'disco', octBass: true },
    circus: { bpm: 170, scale: 'major', root: 65, lead: 'square', bass: 'triangle', prog: [0, 4, 0, 4], dens: .92, drums: 'oompah' },
    news: { bpm: 128, scale: 'minor', root: 55, lead: 'sawtooth', bass: 'square', prog: [0, 0, 5, 4], dens: .3, drums: 'news', stabs: true },
    lullaby: { bpm: 96, scale: 'major', root: 72, lead: 'bell', bass: 'sine', prog: [0, 3, 4, 0], dens: .5, drums: 'none' },
    kazoo: { bpm: 132, scale: 'blues', root: 60, lead: 'kazoo', bass: 'triangle', prog: [0, 3, 0, 4], dens: .65, drums: 'chip' },
    lounge: { bpm: 100, scale: 'dorian', root: 58, lead: 'triangle', bass: 'sine', prog: [0, 3, 1, 4], dens: .4, drums: 'brush', swing: .25, chord: 'pad' },
    metal: { bpm: 184, scale: 'minor', root: 52, lead: 'sawtooth', bass: 'sawtooth', prog: [0, 5, 6, 4], dens: .85, drums: 'metal', chord: 'brass' }
  };
  function ensure() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const comp = ctx.createDynamicsCompressor(); out = ctx.createGain(); out.gain.value = 0; out.connect(comp); comp.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return true;
    } catch (e) { return false; }
  }
  function tone(t, f, dur, { type = 'sine', vol = .2, att = .01, rel = .08, vib = 0, filt = 0 } = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain(), kazoo = type === 'kazoo'; let node = o;
    o.type = kazoo ? 'sawtooth' : type; o.frequency.setValueAtTime(f, t);
    if (vib || kazoo) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = kazoo ? 7 : 5.5; lg.gain.value = vib || 6; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + rel + .05); }
    if (filt || kazoo) { const fl = ctx.createBiquadFilter(); fl.type = kazoo ? 'bandpass' : 'lowpass'; fl.frequency.value = kazoo ? 1100 : filt; fl.Q.value = kazoo ? 5 : 1; node.connect(fl); node = fl; }
    node.connect(g); g.connect(out);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + att); g.gain.setValueAtTime(vol, t + Math.max(att, dur - rel)); g.gain.exponentialRampToValueAtTime(.0001, t + dur + rel);
    o.start(t); o.stop(t + dur + rel + .05);
  }
  const bell = (t, f, dur) => { tone(t, f, dur * 1.6, { vol: .1, rel: .4 }); tone(t, f * 2.76, dur * .5, { vol: .03, rel: .2 }); };
  function kick(t, v = .5) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + .18); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + .25); o.connect(g); g.connect(out); o.start(t); o.stop(t + .3); }
  function noise(t, dur, v, type, freq) { const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf; f.type = type; f.frequency.value = freq; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); s.connect(f); f.connect(g); g.connect(out); s.start(t); s.stop(t + dur + .05); }
  const snare = (t, v = .25) => { noise(t, .14, v, 'bandpass', 1800); tone(t, 190, .06, { type: 'triangle', vol: v * .6, rel: .04 }); };
  const hat = (t, v = .08) => noise(t, .04, v, 'highpass', 7500);
  const DRUMS = { // 8 steps (eighth notes) per bar
    brush: (s, t) => { hat(t, .035); if (s === 2 || s === 6) noise(t, .2, .06, 'bandpass', 2500); },
    oompah: (s, t) => { if (s % 4 === 0) kick(t, .35); if (s % 4 === 2) snare(t, .14); },
    chip: (s, t) => { if (s === 0 || s === 4) kick(t, .35); if (s === 2 || s === 6) noise(t, .08, .12, 'highpass', 3000); hat(t, .03); },
    epic: (s, t, bar) => { if (s === 0 || s === 3 || s === 4) kick(t, .55); if (s === 0 && bar % 2 === 0) noise(t, .9, .1, 'highpass', 5000); if (s === 6) snare(t, .2); },
    disco: (s, t) => { if (s % 2 === 0) kick(t, .45); else hat(t, .1); if (s === 2 || s === 6) snare(t, .18); },
    news: (s, t) => { hat(t, .06); if (s === 0 || s === 3 || s === 6) kick(t, .4); },
    metal: (s, t) => { kick(t, .38); if (s === 2 || s === 6) snare(t, .3); hat(t, .06); },
    none: () => {}
  };
  /** a two-bar motif from the ad's seed, played twice with a varied ending */
  function compose(style, seed) {
    const S = STYLES[style] || STYLES.elevator, sc = SCALES[S.scale], r = Shared.mulberry32(seed >>> 0);
    const deg = d => S.root + 12 * Math.floor(d / sc.length) + sc[((d % sc.length) + sc.length) % sc.length];
    const motif = []; let d = sc.length + Math.floor(r() * 3);
    for (let i = 0; i < 16; i++) {
      if (i % 4 === 0 || r() < S.dens) { d = Math.max(2, Math.min(sc.length * 2 + 2, d + Math.round((r() - .5) * 4))); motif.push({ d, len: r() < .25 ? 2 : 1 }); } else motif.push(null);
    }
    const lead = motif.concat(motif.map((n, i) => i < 12 ? n : i === 15 ? { d: sc.length, len: 1 } : n && { d: n.d - 1, len: n.len }));
    return { S, deg, lead, step: 0, next: 0 };
  }
  function sched() {
    const sg = song; if (!sg || !ctx) return;
    const S = sg.S, dur = 60 / S.bpm / 2;
    while (sg.next < ctx.currentTime + .12) {
      const i = sg.step % 32, s = i % 8, bar = Math.floor(i / 8), t = sg.next + (s % 2 ? (S.swing || 0) * dur : 0), root = S.prog[bar % S.prog.length];
      if (s % 2 === 0 || S.octBass) tone(t, mtof(sg.deg(root) - 24 + (S.octBass && s % 2 ? 12 : 0)), dur * .9, { type: S.bass, vol: .2, filt: 900 });
      if (s === 0 && S.chord) [0, 2, 4].forEach(k => tone(t, mtof(sg.deg(root + k) - 12), dur * 7.5, { type: S.chord === 'brass' ? 'sawtooth' : 'triangle', vol: .04, att: .08, rel: .3, filt: S.chord === 'brass' ? 1300 : 1800 }));
      if (S.arp) tone(t, mtof(sg.deg(root + [0, 2, 4, 7][s % 4])), dur * .6, { type: 'square', vol: .035, filt: 3000 });
      const n = sg.lead[i];
      if (n) { const f = mtof(sg.deg(n.d + root)), len = dur * n.len * .92; if (S.lead === 'bell') bell(t, f, len); else tone(t, f, len, { type: S.lead, vol: S.lead === 'sine' || S.lead === 'triangle' ? .13 : .06, vib: S.vib || 0, filt: S.lead === 'sawtooth' ? 2600 : 0 }); }
      if (S.stabs && (i === 0 || i === 16 || i === 19)) [0, 3, 7].forEach(k => tone(t, mtof(S.root + k + 12), dur * .8, { type: 'sawtooth', vol: .05, filt: 2200 }));
      DRUMS[S.drums](s, t, bar);
      sg.step++; sg.next += dur;
    }
  }
  function play(style, seed) {
    stop(); if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume();
    song = compose(style, seed); song.next = ctx.currentTime + .08;
    out.gain.cancelScheduledValues(ctx.currentTime); out.gain.setTargetAtTime(muted ? 0 : VOL, ctx.currentTime, .05);
    timer = setInterval(sched, 25); sched();
  }
  function stop() { clearInterval(timer); timer = null; song = null; if (ctx) out.gain.setTargetAtTime(0, ctx.currentTime, .04); }
  function mute(m) { muted = m; if (ctx && song) out.gain.setTargetAtTime(m ? 0 : VOL, ctx.currentTime, .05); }
  return { play, stop, mute, styles: Object.keys(STYLES) };
})();

const Ads = (() => {
  const C = Casino;
  const W = 'https://upload.wikimedia.org/wikipedia/commons/';
  const GIF = {
    cat: W + 'thumb/8/81/Cat_funny_gif.gif/330px-Cat_funny_gif.gif', dougie: W + 'thumb/7/7b/The_Dougie_%28animated%29.gif/330px-The_Dougie_%28animated%29.gif',
    blackcat: W + 'thumb/3/31/Black_Cat_1220032.gif/330px-Black_Cat_1220032.gif', dancer: W + '2/21/Spinning_Dancer.gif', dogtail: W + '2/29/Dog_wiggling_tail.gif',
    cradle: W + 'd/d3/Newtons_cradle_animation_book_2.gif', horse: W + 'd/dd/Muybridge_race_horse_animated.gif', earth: W + '2/2c/Rotating_earth_%28large%29.gif',
    hamster: W + '9/9f/Hamster_Wheels.gif', runcat: W + '9/93/Transparent_Cartoon_Running_Cat.gif', dog: W + '9/91/Dog_galloping.gif'
  };
  /* st = layout (tv, news, popup, luxury, app, meme, hype), tr = soundtrack style, md = ['meme', imgflip id, top, bottom] or ['gif', key] */
  const ADS = [
    { t: 'Soup Insurance™', s: 'Is your soup covered? Most soups aren\'t. Don\'t let your minestrone face the world alone.', q: 'My gazpacho went cold and they paid out in full.', who: 'Linda, 47, soup enthusiast', fine: 'Bisques covered on alternate Tuesdays only. Croutons are not soup.', c1: '#f59e0b', c2: '#7c2d12', ic: 'shield-check', st: 'tv', tr: 'elevator', ph: '1-800-SOUP-NOW', md: ['meme', 'wxica', 'MY SOUP: COLD', 'MY POLICY: ACTIVE'] },
    { t: 'Download More RAM', s: 'Now with 40% more downloading. Works on toasters, fridges and most decorative rocks. Powered by four hamsters.', q: 'My calculator now runs three browsers.', who: 'Kevin, IT department (self-appointed)', fine: 'RAM may arrive as a sheep. Ewe have been warned.', c1: '#22d3ee', c2: '#0c4a6e', ic: 'lightning', st: 'popup', tr: 'chip', file: 'FREE_RAM_100%_REAL', md: ['gif', 'hamster'] },
    { t: 'Pigeon Accountants', s: 'Certified* pigeons do your taxes for one (1) breadcrumb. Fast, cheap, mostly airborne.', q: 'I got a refund of 400 seeds.', who: 'Gary, probably', fine: '*Certified by another pigeon. Receipts may be eaten.', c1: '#a78bfa', c2: '#312e81', ic: 'bird', st: 'news', tr: 'news', md: ['meme', '1o00in', 'IS THIS', 'AN ACCOUNTANT?'] },
    { t: 'Moon Real Estate', s: 'Lots now 2% less moon. Ocean views of the Sea of Tranquility (no sea, no tranquility). Earth not included.', q: 'The neighbours are quiet. Too quiet.', who: 'Neil, not that one', fine: 'Gravity sold separately. Atmosphere on backorder since 1969.', c1: '#e2e8f0', c2: '#1e293b', ic: 'rocket-launch', st: 'luxury', tr: 'lounge', md: ['gif', 'earth'] },
    { t: 'Invisible Sunglasses', s: 'Look cool without anyone knowing. Not even you. Especially not you.', q: 'I\'ve been wearing them for weeks. I think.', who: 'Unverified customer', fine: 'Glare protection is emotional only.', c1: '#f472b6', c2: '#701a75', ic: 'sunglasses', st: 'hype', tr: 'disco', md: ['meme', '2kbn1e', 'PUTS ON THE SUNGLASSES', 'CAN\'T SEE THEM'] },
    { t: 'Dehydrated Water', s: 'Just add water! Lightweight, travel-sized and legally distinct from nothing.', q: 'Lost 3 kg carrying it home. 10/10.', who: 'Hydro Hank', fine: 'Contents may settle into nothing during shipping.', c1: '#38bdf8', c2: '#082f49', ic: 'sparkle', st: 'tv', tr: 'polka', ph: '1-888-JUST-ADD', md: ['meme', 'gk5el', 'JUST ADD WATER', 'TO THE WATER'] },
    { t: 'Square Wheels 2.0', s: 'Bumpier. Bolder. Four patented corners per wheel. Round is so last millennium.', q: 'My car doesn\'t drive anymore. It walks.', who: 'Brenda, early adopter', fine: 'Not legal on roads, bridges or the concept of travel.', c1: '#fb923c', c2: '#431407', ic: 'gear', st: 'app', tr: 'chip', md: ['meme', '1b42wl', 'ROUND WHEELS', 'WHO NEEDS THEM'] },
    { t: 'Haunted Toaster', s: 'Toasts bread AND your enemies\' reputations. Whispers motivational quotes at 3 a.m. for free.', q: 'It told me to sell my Mythic. I didn\'t. It\'s angry now.', who: 'Toby, sleeps lightly', fine: 'Exorcism not included. Do not insert bagels after midnight.', c1: '#c084fc', c2: '#1e1b4b', ic: 'ghost', st: 'tv', tr: 'spooky', ph: '1-666-TOASTER', md: ['meme', '1qg8fp', 'KNOCK KNOCK', 'IT\'S TOAST O\'CLOCK'] },
    { t: 'Wi-Fi for Plants', s: 'Your fern deserves 5G. Finally, your cactus can doomscroll like everyone else.', q: 'My basil started a podcast.', who: 'Pat, plant parent', fine: 'Plants may form opinions. We are not responsible for those opinions.', c1: '#4ade80', c2: '#14532d', ic: 'wifi-high', st: 'app', tr: 'lullaby', md: ['meme', '3i7p', 'MY FERN', 'WITH 5G'] },
    { t: 'Silent Alarm Clock', s: 'Wake up whenever you want. You were going to anyway.', q: 'Best sleep of my life. Also, I\'m fired.', who: 'Dave, former employee', fine: 'Snooze button is decorative. So is the clock.', c1: '#fbbf24', c2: '#422006', ic: 'alarm', st: 'luxury', tr: 'lullaby', md: ['meme', '1nck6k', 'ALARM: SILENT', 'ME: ASLEEP FOREVER'] },
    { t: 'Pre-Chewed Gum', s: 'Saves you up to four minutes of chewing per piece. Flavour sold separately.', q: 'Efficient. Moist. Unforgettable.', who: 'Anonymous (please)', fine: 'Previously chewed by professionals in a controlled environment.', c1: '#f9a8d4', c2: '#831843', ic: 'cookie', st: 'hype', tr: 'kazoo', md: ['meme', '24zoa8', 'CHEWING GUM', 'PRE-CHEWED GUM'] },
    { t: 'Rent-a-Banana for Scale', s: 'Professional bananas for all your measuring needs. Now available in metric.', q: 'Finally I know how big my problems are: 4.5 bananas.', who: 'Dr. Lengthsworth', fine: 'Banana may ripen during measurement. Results get browner over time.', c1: '#fde047', c2: '#713f12', ic: 'ruler', st: 'news', tr: 'polka', md: ['meme', '30b1gx', 'RULERS', 'BANANAS'] },
    { t: 'Cloud Storage (Actual Clouds)', s: 'Store your files in a real cumulus. 99.9% uptime, except when it rains.', q: 'My tax returns are somewhere over Belgium now.', who: 'Frank, frequent flyer', fine: 'Data may precipitate. Bring an umbrella to retrieve it.', c1: '#93c5fd', c2: '#1e3a8a', ic: 'cloud', st: 'popup', tr: 'elevator', file: 'CLOUD_SETUP', md: ['meme', '1ihzfe', 'CLOUDS', 'YOUR FILES IN CLOUDS EVERYWHERE'] },
    { t: 'Duck Chess Club', s: 'Finally, a board game your duck won\'t eat. Pieces are mostly bread. The duck still wins.', q: 'Lost 14 games to a mallard. Humbling.', who: 'Grandmaster Quackers\' latest victim', fine: 'Ducks never resign. Ducks have never resigned.', c1: '#38bdf8', c2: '#0f172a', ic: 'crown', st: 'luxury', tr: 'epic', md: ['meme', '345v97', 'THAT\'S NOT HOW THE KNIGHT MOVES', 'I AM A DUCK'] },
    { t: 'Ghost Pepper Toothpaste', s: 'Breath so fresh it\'s banned in four countries and one cruise ship.', q: 'I can hear colours now.', who: 'Sam, crying (happily?)', fine: 'Do not brush near open flames, pets or feelings.', c1: '#f87171', c2: '#450a0a', ic: 'fire', st: 'meme', tr: 'metal', md: ['meme', '1w7ygt', 'MINT', 'GHOST PEPPER MINT!!!'] },
    { t: 'Cats Sitting Cats', s: 'Going on holiday? A professional cat will watch your cat. Judgmentally. From across the room.', q: 'My cat came back with a cat-sitting license of its own.', who: 'Margaret, has 9 cats (allegedly)', fine: 'Sitter may sit on your cat. Sitter may sit on you.', c1: '#fdba74', c2: '#7c2d12', ic: 'eye', st: 'tv', tr: 'lounge', ph: '1-800-MEOW-MEOW', md: ['gif', 'cat'] },
    { t: 'Vertigo Pills', s: 'Is she spinning left or right? Our pills don\'t know either, but they make you not care.', q: 'I took two and now the room spins in both directions.', who: 'Rita, upside down', fine: 'Side effects include spinning, also spinning.', c1: '#e879f9', c2: '#4a044e', ic: 'spiral', st: 'hype', tr: 'circus', md: ['gif', 'dancer'] },
    { t: 'DougieFit', s: 'The only fitness app with exactly one exercise. It\'s this one. Forever.', q: 'Lost 0 kg but gained so much confidence.', who: 'Doug, obviously', fine: 'Not a substitute for any other dance move.', c1: '#60a5fa', c2: '#172554', ic: 'game-controller', st: 'app', tr: 'disco', md: ['gif', 'dougie'] },
    { t: 'Bad Luck Insurance', s: 'Covers black cats, broken mirrors, ladders, Fridays the 13th and every hand of blackjack you\'ve ever played.', q: 'A black cat crossed my path and they sent me a fruit basket.', who: 'Larry, unlucky since 1994', fine: 'Claims must be filed on a lucky day. There are no lucky days.', c1: '#a3a3a3', c2: '#0a0a0a', ic: 'shield', st: 'tv', tr: 'spooky', ph: '1-313-OOPS', md: ['gif', 'blackcat'] },
    { t: 'DogWag Wi-Fi', s: 'Signal strength measured in tail wags. Full bars = very good boy.', q: 'Five wags in the kitchen. Zero in the bathroom. Accurate.', who: 'Kim, router whisperer', fine: 'Router may need walks twice a day.', c1: '#facc15', c2: '#3f2a06', ic: 'wifi-high', st: 'popup', tr: 'chip', file: 'GOOD_BOY_INSTALLER', md: ['gif', 'dogtail'] },
    { t: 'Horse Tips Hotline', s: 'Our horse has been running since 1878 and has never lost a race. It has also never won one.', q: 'They told me to bet on the horse. Which horse? THE horse.', who: 'Seabiscuit\'s cousin', fine: 'Tips are recycled from 1878. Horse is a photograph.', c1: '#86efac', c2: '#14532d', ic: 'horse', st: 'news', tr: 'polka', md: ['gif', 'horse'] },
    { t: 'Rover Rapid Delivery', s: 'Your pizza, delivered at 40 km/h by a very fast, very confused dog. Toppings may vary (they will be eaten).', q: 'The pizza never arrived but the dog was happy.', who: 'Steve, still hungry', fine: 'Delivery radius: wherever the squirrel goes.', c1: '#fca5a5', c2: '#450a0a', ic: 'dog', st: 'app', tr: 'chip', md: ['gif', 'dog'] },
    { t: 'Cat Cardio', s: 'Get fit like this cat. It runs constantly. It is a drawing. You can do it too.', q: 'I\'ve been running for three weeks. Please help.', who: 'Jen, cannot stop', fine: 'Not a real cat. Not a real workout. Not real.', c1: '#f472b6', c2: '#500724', ic: 'fire', st: 'hype', tr: 'metal', md: ['gif', 'runcat'] },
    { t: 'Newton\'s Desk Subscription', s: 'Click. Clack. Click. Clack. That\'s the whole product. Delivered monthly. $40.', q: 'I have twelve now. They never stop.', who: 'Isaac, physics enjoyer', fine: 'Energy is not conserved in our billing department.', c1: '#cbd5e1', c2: '#111827', ic: 'clock', st: 'luxury', tr: 'lounge', md: ['gif', 'cradle'] },
    { t: 'Hamster Power Grid', s: 'Clean, renewable energy from four hamsters and their dreams. Now powering half a lightbulb.', q: 'My lights flicker whenever a hamster takes a nap.', who: 'Thomas, eco-warrior', fine: 'Outages during hamster union breaks.', c1: '#fbbf24', c2: '#451a03', ic: 'lightning', st: 'news', tr: 'news', md: ['gif', 'hamster'] },
    { t: 'Galaxy Brain Supplements', s: 'One capsule a day for the brain you deserve. Brain sold separately.', q: 'I now understand the house edge. I still play.', who: 'Brian, enlightened', fine: 'May cause ideas. Ideas may be bad.', c1: '#818cf8', c2: '#1e1b4b', ic: 'brain', st: 'hype', tr: 'epic', md: ['meme', '1jwhww', 'NORMAL SUPPLEMENTS', 'GALAXY BRAIN BEANS'] },
    { t: 'Glance: The Dating App', s: 'Swipe left. Swipe right. Turn around and look at someone else entirely.', q: 'Met the love of my life. She was looking at someone else too.', who: 'Chad & Stacy & Kyle', fine: 'Loyalty not included in free tier.', c1: '#fb7185', c2: '#4c0519', ic: 'heart', st: 'app', tr: 'disco', md: ['meme', '1ur9b0', 'ME', 'A NEW NOTIFICATION'] },
    { t: 'Change My Mind Debate Club', s: 'Pineapple belongs in soup. Show up, sit down, try to change our minds. You won\'t.', q: 'I came in a pineapple skeptic. I left a pineapple skeptic.', who: 'Steven, unconvinced', fine: 'Minds are non-refundable.', c1: '#fdba74', c2: '#292524', ic: 'chat-circle-dots', st: 'tv', tr: 'news', ph: '1-800-NO-U', md: ['meme', '24y43o', 'PINEAPPLE BELONGS IN SOUP', 'CHANGE MY MIND'] },
    { t: 'Roll Safe Wealth Management', s: 'Can\'t lose money if you never had any. A revolutionary strategy for revolutionary people.', q: 'My portfolio has never gone down. It has never gone anywhere.', who: 'Darnell, financially stationary', fine: 'Past performance is zero. Future performance is also zero.', c1: '#d4af37', c2: '#1c1917', ic: 'piggy-bank', st: 'luxury', tr: 'lounge', md: ['meme', '1h7in3', 'CAN\'T LOSE MONEY', 'IF YOU NEVER HAD ANY'] },
    { t: 'Trade Offer Realty', s: 'You receive: a house. We receive: your house. Everybody wins (us).', q: 'I moved into my own house. Then I paid rent for it.', who: 'Ricardo, homeowner?', fine: 'Offer valid until you read this sentence.', c1: '#4ade80', c2: '#052e16', ic: 'house', st: 'news', tr: 'polka', md: ['meme', '54hjww', 'I RECEIVE: YOUR HOUSE', 'YOU RECEIVE: A HOUSE'] },
    { t: 'Bat-Slap Customer Service', s: 'Complaints handled instantly. Your call is important to us — until you start talking.', q: 'I said "I\'d like a ref—" and then it was over.', who: 'Robin, former customer', fine: 'Satisfaction guaranteed for the agent only.', c1: '#facc15', c2: '#1c1917', ic: 'hand-palm', st: 'popup', tr: 'metal', file: 'SUPPORT_TICKET_#999', md: ['meme', '9ehk', 'I WOULD LIKE A REF—', 'NO.'] },
    { t: 'Pawn Stars Appraisals', s: 'Bring us your priceless heirlooms, rare cards and family secrets. Best we can do is $3.', q: 'Sold my grandma\'s ring for $3. She\'s furious.', who: 'Chumlee\'s understudy', fine: 'The best we can do is always $3.', c1: '#fcd34d', c2: '#422006', ic: 'tag', st: 'tv', tr: 'polka', ph: '1-800-THREE-$', md: ['meme', '19vcz0', 'YOUR MYTHIC CARD?', 'BEST I CAN DO IS $3'] },
    { t: 'Scroll of Truth Fortune Cookies', s: 'Fortunes nobody wants to hear, baked fresh daily. "The house always wins." Crunch.', q: 'Mine said "You will lose this hand." It was right.', who: 'Wendy, crumbs everywhere', fine: 'Truth may be thrown in a well. Cookie may follow.', c1: '#fde68a', c2: '#3b0764', ic: 'cookie', st: 'luxury', tr: 'spooky', md: ['meme', '21tqf4', 'YOUR FORTUNE:', 'THE HOUSE ALWAYS WINS'] },
    { t: 'UNO Reverse Insurance', s: 'Anything bad that happens to you happens to us instead!* Lose a hand? We lose it too.*', q: 'They reversed my reverse. I owe them money now.', who: 'Kyle, draws 25', fine: '*It doesn\'t. **It really doesn\'t.', c1: '#ef4444', c2: '#450a0a', ic: 'shuffle', st: 'hype', tr: 'circus', md: ['meme', '3lmzyx', 'READ THE FINE PRINT', 'OR DRAW 25'] },
    { t: 'Grandma Broadband', s: 'Speeds of up to three cat videos per day. Installed by your grandma, with love and a lot of questions.', q: 'She typed "Google" into Google. It worked!', who: 'Grandma, online now', fine: 'Speed varies with how loudly grandma asks the router.', c1: '#c4b5fd', c2: '#2e1065', ic: 'globe', st: 'app', tr: 'elevator', md: ['meme', '1bhw', 'GRANDMA FINDS', 'THE CASINO'] },
    { t: 'Invisible Hats', s: 'The hat so stylish you can’t even see it. One size fits all heads, and several non-heads.', q: 'Everyone stares at my hat. I think.', who: 'Derek, hatless (allegedly)', fine: 'Hat may not exist. Refunds also invisible.', c1: '#f472b6', c2: '#831843', ic: 'crown-simple', st: 'luxury', tr: 'lounge', md: ['meme', '5o32tt', 'YOU WEAR HATS', 'I WEAR THE CONCEPT OF HATS'] },
    { t: 'Bottled Wi-Fi', s: 'Fresh Wi-Fi harvested from Alpine routers. Just uncork and connect. Now in sparkling 5G.', q: 'Five bars. Tastes like loading.', who: 'Priya, connoisseur', fine: 'Do not shake. Signal may settle at bottom.', c1: '#38bdf8', c2: '#0c4a6e', ic: 'wifi-high', st: 'tv', tr: 'elevator', ph: '1-800-WIFI-JUG', md: ['meme', '9sw43', 'PEOPLE PAYING FOR ROUTERS', 'BUT THAT’S NONE OF MY BUSINESS'] },
    { t: 'Rent-a-Grandma', s: 'She will tell you that you look thin and give you £5. By the hour, day, or forever.', q: 'She knitted me a sweater during my Zoom call.', who: 'Tom, now very warm', fine: 'Grandma may fall asleep mid-sentence. This is a feature.', c1: '#fb923c', c2: '#7c2d12', ic: 'heart', st: 'app', tr: 'lullaby', md: ['gif', 'cradle'] },
    { t: 'Moon Timeshare', s: 'Own one week a year on the Moon. Low gravity, no neighbours, terrible Wi-Fi.', q: 'The view of Earth is amazing. Getting there is the hard part.', who: 'Neil, not that one', fine: 'Transport not included. Oxygen sold separately.', c1: '#a5b4fc', c2: '#1e1b4b', ic: 'rocket-launch', st: 'hype', tr: 'epic', md: ['gif', 'earth'] },
    { t: 'Haunted Toaster', s: 'Toasts bread. Whispers your name at 3am. Two slots, one ghost.', q: 'My toast spells out warnings. Delicious ones.', who: 'Morticia, early adopter', fine: 'Ghost not covered under warranty. Crumbs are ectoplasm.', c1: '#a3e635', c2: '#1a2e05', ic: 'ghost', st: 'popup', tr: 'spooky', file: 'TOASTER_EXORCISM', md: ['meme', '3po4m7', 'ME HIDING', 'FROM MY TOASTER'] },
    { t: 'Chair Gym', s: 'Lose weight sitting down. Simply sit, and think about running. Results in 0–∞ weeks.', q: 'I thought about running so hard I got tired.', who: 'Bob, couch athlete', fine: 'Thinking may cause mild sweating. Chair not included.', c1: '#4ade80', c2: '#14532d', ic: 'medal', st: 'tv', tr: 'disco', ph: '1-800-SIT-FIT', md: ['gif', 'dougie'] },
    { t: 'Professional Line Stander', s: 'We stand in lines for you. Banks, concerts, existential queues. Very patient. Slightly judgmental.', q: 'They stood in line for my birthday cake. It was a very long line.', who: 'Jen, delegator', fine: 'Line-standers may form their own line. Not responsible for line drama.', c1: '#94a3b8', c2: '#1e293b', ic: 'users-three', st: 'news', tr: 'news', md: ['meme', '145qvv', 'ME IN LINE', 'WATCHING PEOPLE LEAVE'] },
    { t: 'Diet Water', s: 'All the hydration of water with zero of the calories of water. Now 0% wetter.', q: 'I drank six bottles and I feel exactly the same.', who: 'Chad, hydrated', fine: 'Diet Water is water. We are as surprised as you.', c1: '#67e8f9', c2: '#164e63', ic: 'sparkle', st: 'meme', tr: 'chip', md: ['meme', '2cjr7j', 'WATER WITH A NEW LABEL', 'IS THIS INNOVATION?'] },
    { t: 'Nap Insurance', s: 'Was your nap interrupted? We pay out in extra naps. Cover your sleep today.', q: 'My dog barked. I received 40 minutes of compensation nap.', who: 'Sam, professional napper', fine: 'Naps over 3 hours are classified as sleep and not covered.', c1: '#818cf8', c2: '#312e81', ic: 'clock', st: 'luxury', tr: 'lullaby', md: ['gif', 'blackcat'] },
    { t: 'Spicy Ice Cubes', s: 'Ice, but hot. Chill and burn your drink at the same time. Science has gone too far.', q: 'My lemonade is crying.', who: 'Carlos, regrets', fine: 'Not suitable for people, pets or drinks.', c1: '#f87171', c2: '#7f1d1d', ic: 'pepper', st: 'hype', tr: 'metal', md: ['meme', '23ls', 'ME ADDING SPICY ICE', 'TO A NORMAL DRINK'] },
    { t: 'Ducks for Hire', s: 'Need an emotional support duck? A wedding duck? A duck lawyer? We have them all.', q: 'The duck won my court case. Quack.', who: 'Judge Waddleton', fine: 'Ducks bill hourly. Literally.', c1: '#facc15', c2: '#713f12', ic: 'bird', st: 'app', tr: 'polka', md: ['meme', '54d9lj', 'HIRE A LAWYER', 'HIRE A DUCK'] },
    { t: 'Self-Peeling Bananas', s: 'Tired of peeling? These bananas peel themselves when they sense hunger. Slightly terrifying.', q: 'It peeled before I knew I was hungry.', who: 'Ana, watched by fruit', fine: 'Bananas may peel at night. Lock your fruit bowl.', c1: '#fde047', c2: '#854d0e', ic: 'orange-slice', st: 'popup', tr: 'kazoo', file: 'BANANA_PEELER_PRO', md: ['meme', '1otk96', 'PEELING BANANAS YOURSELF', 'pEeLiNg BaNaNaS yOuRsElF'] },
    { t: 'Cloud Storage (Real Clouds)', s: 'Store your files in actual clouds. Free when it rains. Data may fall on Belgium.', q: 'My photos came down as hail. Still sharp.', who: 'Lars, meteorologist', fine: 'Sunny days may cause total data loss.', c1: '#e0f2fe', c2: '#0369a1', ic: 'cloud', st: 'tv', tr: 'elevator', ph: '1-800-RAIN-DRV', md: ['meme', '46e43q', 'WAIT, IT’S ALL WATER?', 'ALWAYS HAS BEEN'] },
    { t: 'Cat Translator', s: 'Finally understand your cat. Warning: you will not like what it says about you.', q: 'Turns out she’s been plotting since 2019.', who: 'Helen, now afraid', fine: 'Translations may be offensive. Cat may deny everything.', c1: '#fbbf24', c2: '#78350f', ic: 'chat-circle-dots', st: 'news', tr: 'news', md: ['gif', 'cat'] },
    { t: 'Lucky Rock', s: 'This rock has never lost a single bet. It has also never placed one. Coincidence?', q: 'I hold it while gambling. My losses are now heavier.', who: 'Rocky, believer', fine: 'Rock is a rock. Luck is not guaranteed. Neither is rock.', c1: '#a8a29e', c2: '#292524', ic: 'clover', st: 'luxury', tr: 'lounge', md: ['meme', '5v6gwj', 'PEOPLE WITH STRATEGY', 'ME WITH MY ROCK'] },
    { t: 'Turbo Snail Delivery', s: 'Your package, delivered by snail. Eco-friendly, slime-proofed, eventually.', q: 'Ordered in 2021. Arriving any decade now.', who: 'Patience, customer', fine: 'Snails may stop for lettuce. Tracking updates yearly.', c1: '#86efac', c2: '#14532d', ic: 'timer', st: 'app', tr: 'polka', md: ['meme', '2fm6x', 'WAITING FOR', 'MY SNAIL DELIVERY'] },
    { t: 'Infinite Socks', s: 'Lose one sock, two grow back. Socks that multiply like rabbits. Please send help.', q: 'My drawer is now 90% sock.', who: 'Greg, buried', fine: 'Sock growth cannot be stopped. We have tried.', c1: '#c084fc', c2: '#3b0764', ic: 'squares-four', st: 'hype', tr: 'circus', md: ['meme', '26hg', 'YO DAWG I PUT SOCKS', 'IN YOUR SOCKS'] },
    { t: 'Volcano Hot Tubs', s: 'Relax in the warmest tub on Earth. Built directly into an active volcano. Robes optional.', q: 'Very relaxing until the eruption.', who: 'Lava Larry', fine: 'Tub may become lava. Do not bring rubber ducks.', c1: '#fb7185', c2: '#4c0519', ic: 'fire', st: 'tv', tr: 'epic', ph: '1-800-LAVA-SPA', md: ['meme', '3qqcim', 'NEW HOT TUB', 'IT’S A VOLCANO'] },
    { t: 'Homework Eating Dog', s: 'A certified dog that eats homework on command. Excuses never sounded so real.', q: 'My teacher believed me. The dog is also my teacher now.', who: 'Max, 12', fine: 'Dog may also eat shoes, sofa and car keys.', c1: '#d6a26a', c2: '#422006', ic: 'dog', st: 'meme', tr: 'chip', md: ['gif', 'dogtail'] },
    { t: 'Pocket Thunderstorm', s: 'Take a storm anywhere. Perfect for dramatic entrances and drying laundry fast.', q: 'I walked into the meeting with lightning. Promoted.', who: 'Zeus Jr.', fine: 'Do not use indoors, outdoors, or near anything.', c1: '#60a5fa', c2: '#172554', ic: 'lightning', st: 'popup', tr: 'metal', file: 'STORM_IN_A_JAR', md: ['meme', '64sz4u', 'NO STORM?', ''] },
    { t: 'Hamster Power Plant', s: 'Power your home with 100% organic hamster energy. Clean, renewable, extremely cute.', q: 'The lights flicker when they nap. Worth it.', who: 'Greta, green', fine: 'Requires 4,000 hamsters per kettle.', c1: '#fcd34d', c2: '#78350f', ic: 'lightning-a', st: 'news', tr: 'chip', md: ['gif', 'hamster'] },
    { t: 'Fake Plant Water', s: 'Keep your plastic plants thriving with our premium fake water. Zero drops, maximum dignity.', q: 'My fake ficus has never looked faker.', who: 'Dana, plant parent', fine: 'Fake water is air. Air is free. Please still buy it.', c1: '#4ade80', c2: '#052e16', ic: 'magic-wand', st: 'app', tr: 'lounge', md: ['meme', '2za3u1', 'WATER', 'NO WATER'] },
    { t: 'Speed Reading Glasses', s: 'Read whole books in 4 seconds. Understand none of it. Feel incredibly smart.', q: 'Read all of Shakespeare on the bus. It was about a guy, I think.', who: 'Owen, well-read', fine: 'Comprehension sold separately.', c1: '#f59e0b', c2: '#451a03', ic: 'sunglasses', st: 'tv', tr: 'disco', ph: '1-800-SKIM-NOW', md: ['meme', '1tl71a', 'ME AFTER SPEED READING', 'THINKING ABOUT NOTHING'] },
    { t: 'Rubber Duck Debugging Pro', s: 'Explain your code to a duck. Now with Enterprise Duck™: it explains it back.', q: 'The duck found the bug. Then filed a ticket.', who: 'Dev, senior duck engineer', fine: 'Duck does not accept pull requests.', c1: '#fde047', c2: '#3f3f46', ic: 'bird', st: 'meme', tr: 'chip', md: ['meme', '27qxmb', 'I’M SOMETHING OF', 'A DUCK MYSELF'] },
    { t: 'Galloping Lessons', s: 'Learn to gallop like a horse in just 6 weeks. No horse required. Mild neighing expected.', q: 'I galloped to work. Faster than the bus.', who: 'Penny, cantering', fine: 'Galloping indoors may upset neighbours.', c1: '#d97706', c2: '#431407', ic: 'horse', st: 'hype', tr: 'polka', md: ['gif', 'horse'] },
    { t: 'Ancient Aliens Casino', s: 'Some say the house edge was built by aliens. We say: yes, and they want you to play.', q: 'I lost, but it was a cosmic loss.', who: 'Giorgio, expert', fine: 'Aliens not liable for losses on Earth.', c1: '#34d399', c2: '#022c22', ic: 'globe', st: 'news', tr: 'spooky', md: ['meme', '26am', 'THE HOUSE EDGE?', 'ALIENS'] },
    { t: 'Bubble Wrap Suit', s: 'Fully pop-able. Fully protective. Fully embarrassing. The safest fashion choice ever.', q: 'I fell down the stairs and it sounded like fireworks.', who: 'Clumsy Carl', fine: 'Each pop reduces protection by one pop.', c1: '#e2e8f0', c2: '#334155', ic: 'shield', st: 'luxury', tr: 'circus', md: ['meme', '2reqtg', 'ME AFTER FALLING', 'ONE BUBBLE WRAP SUIT'] },
    { t: 'Tears of Joy Juice', s: 'Made from 100% happy tears collected at weddings. Sweet, salty, emotional.', q: 'I cried while drinking it. Infinite refills.', who: 'Bride, unnamed', fine: 'Contains feelings. May cause hugging.', c1: '#93c5fd', c2: '#1e3a8a', ic: 'heart', st: 'tv', tr: 'lullaby', ph: '1-800-SOB-SIPS', md: ['meme', '4acd7j', 'ME DRINKING', 'TEARS OF JOY JUICE'] },
    { t: 'Treadmill for Cats', s: 'Your cat runs, you watch. Burn calories by proxy. Very modern fitness.', q: 'My cat is shredded. I am not.', who: 'Mia, coach', fine: 'Cat may refuse. Cat always refuses.', c1: '#f97316', c2: '#431407', ic: 'trophy', st: 'app', tr: 'disco', md: ['gif', 'runcat'] },
    { t: 'Perpetual Desk Toy', s: 'It clicks forever. You will watch it forever. Productivity is a myth anyway.', q: 'I’ve been staring for nine hours. Best day of work ever.', who: 'Office Steve', fine: 'Clicking may continue after death.', c1: '#cbd5e1', c2: '#0f172a', ic: 'circle-notch', st: 'popup', tr: 'elevator', file: 'CLICK_CLACK_FOREVER', md: ['gif', 'cradle'] },
  ];
  const STATUS = ['Reticulating splines…', 'Bribing the algorithm…', 'Asking the duck for permission…', 'Warming up the hamsters…', 'Counting to fifteen, slowly…', 'Consulting a horoscope…', 'Loading the loading bar…', 'Polishing the pixels…', 'Negotiating with the toaster…', 'Downloading more RAM…', 'Feeding the sponsor…', 'Inventing a new colour…', 'Untangling the internet…', 'Calibrating vibes…', 'Filing paperwork with the pigeons…', 'Rewinding the GIF…', 'Tuning the kazoo…', 'Paying the cats…'];
  const NEWS = ['LOCAL MAN WINS $4, LOSES $400', 'DUCK ELECTED MAYOR, PROMISES MORE BREAD', 'SCIENTISTS CONFIRM: THE SLOT IS NOT DUE', 'TIPSY NAMED WORST ADVISOR FOR 7TH YEAR', 'MOON REPORTS 2% SHRINKAGE', 'SOUP PRICES SOAR AMID INSURANCE BOOM', 'PIGEON CPA FIRM GOES PUBLIC', 'BANANA STOLEN FROM MEASUREMENT LAB', 'HAMSTERS DEMAND SHORTER WHEELS', 'CAT REFUSES TO FOLD, WINS ANYWAY'];
  const POPS = ['🎉 Congratulations! You are visitor #1,000,000!', '⚠️ Your computer has 3 toasters installed', '🔥 Hot soups in your area', '👉 Click here to win a free click', '📞 Your car\'s extended warranty has entered the chat', '🦆 1 new message from a duck', '🍌 Your banana is ready for measuring', '💾 Do you want to download the internet? (Yes / Also yes)'];
  const STICKERS = ['NEW!', 'WOW!', '50% OFF*', 'LIMITED*', 'FREE*', '100% REAL*', 'MEGA DEAL', 'NOT A SCAM*', 'BEST SELLER', 'ONLY $∞'];
  /* the "sponsor websites": every clickable bit of an ad opens one of these at random, in a new tab */
  const LINKS = ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://pointerpointer.com', 'https://theuselessweb.com', 'https://zombo.com', 'https://isitchristmas.com',
    'https://cat-bounce.com', 'https://hackertyper.net', 'https://eelslap.com', 'https://heeeeeeeey.com', 'https://longdogechallenge.com', 'https://thatsthefinger.com',
    'https://onesquareminesweeper.com', 'https://smashthewalls.com', 'https://checkboxrace.com', 'https://alwaysjudgeabookbyitscover.com', 'https://ducksarethebest.com',
    'https://puginarug.com', 'https://optical.toys', 'https://paint.toys', 'https://www.windows93.net', 'https://binarypiano.com', 'https://www.boredbutton.com',
    'https://instantrimshot.com', 'https://weirdorconfusing.com', 'https://www.fallingfalling.com', 'https://hooooooooo.com', 'https://neal.fun/deep-sea', 'https://neal.fun/spend', 'https://neal.fun/password-game'];
  const CTA = ['Learn more', 'Visit website', 'Claim offer', 'Totally safe link', 'Find out why', 'Click for soup', 'Don\'t click', 'See for yourself', 'Investigate', 'Open the portal'];
  const pick = a => a[C.rint(a.length)];
  const media = (md, cls = '') => md[0] === 'gif'
    ? `<div class="admedia gif ${cls}" data-link><img src="${GIF[md[1]]}" alt=""></div>`
    : `<div class="admedia ${cls}" data-link><img src="${Eco.memeUrl(md[1], true)}" alt=""><span class="cap t">${C.esc(md[2])}</span><span class="cap b">${C.esc(md[3])}</span></div>`;
  const stars = () => { const s = (3 + C.rnd() * 2).toFixed(1); return `${'★'.repeat(Math.round(s))}${'☆'.repeat(5 - Math.round(s))} ${s} from ${pick(['3 pigeons', 'a confused owl', '1 ghost', 'my mum', '0.5 people', 'a sentient spoon', 'the duck'])}`; };
  const price = () => `<div class="adprice"><s>WAS $∞</s><b>NOW $∞ − 1</b><span>${stars()}</span></div>`;
  const quote = ad => `<blockquote>“${C.esc(ad.q)}”<cite>— ${C.esc(ad.who)}</cite></blockquote>`;
  function body(ad) {
    const st = ad.st, h = `<h2>${C.esc(ad.t)}</h2><p>${C.esc(ad.s)}</p>`;
    if (st === 'tv') return `<div class="tvwrap"><div class="tvscreen">${media(ad.md)}<i class="scan"></i></div><span class="seen">AS SEEN<br>ON TV</span></div>${h}${price()}<div class="callnow" data-link>CALL NOW <b>${ad.ph || '1-800-NONSENSE'}</b></div>`;
    if (st === 'news') return `<div class="newsbar"><b>BREAKING NEWS</b><span class="live">● LIVE</span></div><div class="newsmain">${media(ad.md)}<div class="lower"><b>${C.esc(ad.t)}</b><span>${C.esc(ad.s)}</span></div></div><div class="ticker"><div>${C.shuffle(NEWS.slice()).map(n => `<span data-link>${n}</span>`).join('')}</div></div>${quote(ad)}`;
    if (st === 'popup') return `<div class="adwin"><div class="wtitle"><span>${ad.file || 'OFFER'}.exe</span><i>_</i><i>□</i><i class="wx" data-pop>✕</i></div><div class="wbody">${media(ad.md)}<div>${h}<button class="btn small fakebtn" data-pop data-link>${C.icon('upload', 14)}DOWNLOAD NOW</button></div></div></div><div class="pops" id="pops"></div>${quote(ad)}`;
    if (st === 'luxury') return `<div class="lux">${media(ad.md, 'kb')}<div class="luxt"><small>THE ${C.esc(ad.t.toUpperCase())} COLLECTION</small>${h}<span class="since">Est. last Tuesday</span></div></div>${quote(ad)}`;
    if (st === 'app') return `<div class="appcard"><div class="appicon">${C.icon(ad.ic, 34)}</div><div class="appmeta"><b>${C.esc(ad.t)}</b><small>Nonsense Inc. · ${stars()}</small><small>0+ downloads · Rated N for Nonsense</small></div><button class="getbtn" id="getbtn" data-link>GET</button></div><div class="shots">${media(ad.md)}<div class="shotx">${C.icon(ad.ic, 56)}<b>${C.esc(ad.s)}</b></div></div>${quote(ad)}`;
    if (st === 'meme') return `<div class="deepfry">${media(ad.md)}</div>${h}${quote(ad)}`;
    return `<div class="hypemedia">${media(ad.md)}</div><h2 class="rainbow">${C.esc(ad.t)}</h2><p>${C.esc(ad.s)}</p>${price()}${quote(ad)}`;   // hype
  }
  function openLink() {
    const url = pick(LINKS); window.open(url, '_blank', 'noopener,noreferrer'); C.sfx('pop');
    C.toast(`Opening sponsor: ${new URL(url).hostname.replace(/^www\./, '')}`);
  }
  let last = -1;
  function watch(done, force) {
    let i = force; if (i == null) { do i = C.rint(ADS.length); while (i === last && ADS.length > 1); } last = i;
    const ad = ADS[i], SECONDS = 15, soundOn = C.S.sound;
    const parts = Array.from({ length: 12 }, () => `<span style="--x:${(C.rnd() * 100).toFixed(0)}%;--d:${(C.rnd() * 5).toFixed(2)}s;--s:${(.6 + C.rnd() * .9).toFixed(2)};--t:${(5 + C.rnd() * 4).toFixed(1)}s">${C.icon(ad.ic, 22)}</span>`).join('');
    const stk = C.shuffle(STICKERS.slice()).slice(0, ad.st === 'hype' ? 3 : 2).map((s, k) => `<span class="stk k${k}">${s}</span>`).join('');
    const m = C.modal(`<div class="ad st-${ad.st}" style="--c1:${ad.c1};--c2:${ad.c2}"><div class="adbg"></div><div class="adparts">${parts}</div>${stk}
      <span class="adtag">SPONSORED</span><button class="admute" id="admute" title="Sound">${C.icon(soundOn ? 'volume' : 'mute', 16)}</button><button class="adskip" id="adskip">Skip ad ›</button>
      <div class="adbody">${body(ad)}</div>
      <div class="adbar"><i id="adp"></i></div><div class="adfoot"><span id="adt">${pick(STATUS)}</span><button class="btn sec small adcta" data-link>${pick(CTA)} ${C.icon('arrow-right', 14)}</button><span class="adtrack">${C.icon('music-notes', 14)}${ad.tr} mix</span><button class="btn gold" id="adclaim" disabled>Claim reward</button></div>
      <small class="adfine">${C.esc(ad.fine)}</small></div>`, { noClose: true, cls: 'admodal' });
    const q = s => m.el.querySelector(s), adEl = q('.ad'), skip = q('#adskip'), timers = [];
    let muted = !soundOn; Jingle.mute(muted); Jingle.play(ad.tr, Shared.hash(ad.t));
    q('#admute').onclick = () => { muted = !muted; Jingle.mute(muted); q('#admute').innerHTML = C.icon(muted ? 'mute' : 'volume', 16); };
    const dodge = el => { const r = adEl.getBoundingClientRect(); el.style.position = 'absolute'; el.style.left = (10 + C.rnd() * (r.width - 130)) + 'px'; el.style.top = (40 + C.rnd() * (r.height - 140)) + 'px'; el.style.right = 'auto'; C.sfx('pop'); };
    skip.onmouseenter = () => dodge(skip);
    skip.onclick = () => { dodge(skip); skip.textContent = pick(['Nice try', 'Nope', 'Still no', 'The soup insists', 'Skipping is a premium feature', 'Have you tried not skipping?']); };
    const get = q('#getbtn'); if (get) { get.onmouseenter = () => { get.classList.add('flee'); get.style.transform = `translate(${(C.rnd() - .5) * 160}px,${(C.rnd() - .5) * 60}px)`; C.sfx('pop'); }; get.onclick = () => { get.textContent = 'GOT'; }; }
    const pops = q('#pops');
    const spawn = () => { if (!pops) return; const p = document.createElement('div'); p.className = 'adpop'; p.style.left = (C.rnd() * 55) + '%'; p.style.top = (C.rnd() * 60) + '%'; p.innerHTML = `<div class="wtitle"><span>ALERT.exe</span><i class="wx" data-pop>✕</i></div><p data-link>${pick(POPS)}</p>`; pops.append(p); C.sfx('pop'); if (pops.children.length > 4) pops.firstChild.remove(); };
    if (pops) { [1800, 4500, 7500, 10500].forEach(t => timers.push(setTimeout(spawn, t))); adEl.addEventListener('click', e => { if (e.target.closest('[data-pop]')) { e.target.closest('.adpop') ? (e.target.closest('.adpop').remove(), spawn(), spawn()) : spawn(); } }); }
    adEl.addEventListener('click', e => { const l = e.target.closest('[data-link]'); if (l && adEl.contains(l)) openLink(); });
    if (ad.st === 'hype') timers.push(setTimeout(() => C.fx.confetti(60, innerWidth / 2, innerHeight * .3), 400));
    const t0 = Date.now(); let lastMsg = 0;
    const tm = setInterval(() => {
      const el = (Date.now() - t0) / 1000, p = Math.min(1, el / SECONDS);
      q('#adp').style.width = (p * 100) + '%';
      if (p < 1 && el - lastMsg > 2.2) { lastMsg = el; q('#adt').textContent = `${pick(STATUS)} ${Math.ceil(SECONDS - el)}s`; }
      if (p >= 1) { clearInterval(tm); q('#adt').textContent = 'Thank you for your attention. The sponsor is weeping with joy.'; q('#adclaim').disabled = false; skip.remove(); }
    }, 100);
    q('#adclaim').onclick = () => { clearInterval(tm); timers.forEach(clearTimeout); Jingle.stop(); m.close(); done && done(); };
  }

  /* ---------- spam: random popups, a skyscraper rail, a sidebar card and a page-bottom banner ---------- */
  const spamOff = () => !!(C.S.cheats && C.S.cheats.noSpam);
  const randAd = () => ADS[C.rint(ADS.length)];
  const NOTIFS = [['Duck Messenger', 'bird', 'Quackers: u up? wanna race 🦆'], ['Bank of Nonsense', 'piggy-bank', 'Your account balance is: yes'], ['Tipsy', 'robot', 'I have a new tip. It’s ALL IN.'], ['Pigeon Post', 'paper-plane-tilt', 'You have 1 (one) breadcrumb waiting'],
    ['Soup Alert', 'bell', 'Minestrone spotted 0.3 km away'], ['Casino News', 'megaphone', 'Local slot machine “feeling lucky” today'], ['Weather', 'cloud', '100% chance of jackpots, followed by losses'], ['Calendar', 'clock', 'Reminder: Go all in (repeats daily)'],
    ['Mum', 'heart', 'Did you eat? Also, red or black?'], ['Lucky Rock', 'clover', 'Your rock misses you. Come home.']];
  const VIRUS = ['47 JACKPOTS', '12 FREE SPINS', '3 SOUPS', '1 SUSPICIOUS DUCK', '999 COOKIES', '8 UNCLAIMED BANANAS', '42 TINY HORSES'];
  const DEALS = ['Infinite coins for $0.00', 'Second chance at your last loss', 'A slightly used jackpot', 'Pre-owned luck, mint condition', '50% off the house edge*', 'One (1) free hug from the dealer'];
  const CHATS = [['Prince of Duckland', 'Greetings. I need help moving 10,000,000 breadcrumbs. You get 20%.'], ['Definitely Not A Bot', 'hello fellow human. do you also enjoy breathing air?'], ['Your Future Self', 'Bet on 17. Trust me. I can’t say more.'],
    ['Lady Luck', 'I was going to visit today but I got lost. Rain check?'], ['The House', 'We always win. But you look nice today.'], ['A Ghost', 'boo. also have you tried the duck race']];
  const SURVEY = [['How much do you love losing?', ['A lot', 'Very much', 'Yes']], ['Rate your luck today', ['🍀🍀🍀', '🍀', 'Soup']], ['Should Tipsy be your financial advisor?', ['Yes', 'Absolutely', 'I already did that']], ['Pick your favourite number', ['17', '17', 'Also 17']]];
  const COOKIE = ['This casino uses cookies 🍪, biscuits and one crumpet to improve your losing experience.', 'We value your privacy. Mostly we value your balance.', 'By scrolling you agree to go all in at least once.'];
  const xBtn = () => `<button class="spx ${C.rnd() < .25 ? 'tiny' : ''} ${C.rnd() < .2 ? 'shy' : ''}" data-x title="Close">✕</button>`;
  const KINDS = {
    win: () => [`<div class="adwin"><div class="wtitle"><span>${pick(['WARNING', 'ALERT', 'URGENT', 'CONGRATS', 'ERROR'])}.exe</span>${xBtn()}</div><div class="spwin"><b class="spico">⚠</b><p data-link>${pick(POPS)}</p></div><div class="spbtns"><button class="w95" data-link>OK</button><button class="w95 shy" data-x>Cancel</button></div></div>`, 'tl'],
    notif: () => { const [app, ic, msg] = pick(NOTIFS); return [`<div class="spnotif" data-link><span class="spapp">${C.icon(ic, 20)}</span><div><small>${app} · now</small><b>${C.esc(msg)}</b></div>${xBtn()}</div>`, 'tr']; },
    virus: () => [`<div class="spvirus">${xBtn()}<div class="spvh">${C.icon('shield', 22)}<b>SCAN COMPLETE</b></div><p><b class="blink">${pick(VIRUS)}</b> DETECTED ON YOUR DEVICE</p><div class="spbar"><i></i></div><button class="btn small red" data-link>REMOVE THEM NOW</button></div>`, 'tr'],
    cookie: () => [`<div class="spcookie"><span class="spck">🍪</span><p>${pick(COOKIE)}</p><button class="btn small gold" data-x>Accept</button><button class="btn small sec" data-link>Eat them</button></div>`, 'bot'],
    deal: () => [`<div class="spdeal">${xBtn()}<small>⚡ FLASH SALE ⚡</small><b>${pick(DEALS)}</b><div class="spcd">Ends in <span>00:10</span></div><button class="btn small gold" data-link>BUY NOW</button></div>`, 'bl'],
    adcard: () => { const ad = randAd(); return [`<div class="spcard" style="--c1:${ad.c1};--c2:${ad.c2}">${xBtn()}<span class="sptag">AD</span>${media(ad.md)}<b>${C.esc(ad.t)}</b><p>${C.esc(ad.s)}</p><button class="btn small" data-link>${pick(CTA)} ›</button></div>`, pick(['tl', 'bl'])]; },
    chat: () => { const [who, msg] = pick(CHATS); return [`<div class="spchat">${xBtn()}<img src="https://api.dicebear.com/9.x/bottts/svg?seed=${encodeURIComponent(who)}" alt=""><div><small>${C.esc(who)} <i>● online</i></small><p>${C.esc(msg)}</p><button class="btn small sec" data-link>Reply</button></div></div>`, 'bl']; },
    survey: () => { const [qq, opts] = pick(SURVEY); return [`<div class="spsurvey">${xBtn()}<small>QUICK SURVEY · 1 of 1</small><b>${qq}</b><div class="spopts">${opts.map(o => `<button data-sv>${o}</button>`).join('')}</div></div>`, 'tr']; },
    spin: () => [`<div class="spspin">${xBtn()}<small>YOU’VE BEEN SELECTED!</small><div class="spwheel"><i></i></div><b>Spin to win</b><button class="btn small gold" data-spin>SPIN</button></div>`, 'tl']
  };
  let popT = 0;
  function popup(kind) {
    const host = document.body, live = document.querySelectorAll('.spam');
    if (live.length >= 2) live[0].remove();
    const [html, pos] = KINDS[kind || pick(Object.keys(KINDS))]();
    const el = document.createElement('div'); el.className = `spam pos-${pos}`; el.innerHTML = html;
    const sw = (document.getElementById('side') || { getBoundingClientRect: () => ({ width: 0 }) }).getBoundingClientRect().width;
    if (pos === 'tl' || pos === 'bl') el.style.left = (sw + 16 + C.rnd() * 60) + 'px';
    host.append(el); C.sfx('pop');
    const bye = () => { el.classList.add('bye'); setTimeout(() => el.remove(), 250); };
    el.addEventListener('mouseover', e => { const s = e.target.closest('.shy'); if (s && !s.dataset.moved) { s.dataset.moved = 1; s.style.transform = `translate(${(C.rnd() - .5) * 120}px,${(C.rnd() - .5) * 50}px)`; } });
    el.addEventListener('click', e => {
      if (e.target.closest('[data-x]')) return bye();
      const sv = e.target.closest('[data-sv]'); if (sv) { el.querySelector('.spopts').outerHTML = '<p class="spthx">Thanks! Your opinion has been carefully ignored.</p>'; return setTimeout(bye, 1800); }
      const sp = e.target.closest('[data-spin]'); if (sp) { sp.disabled = true; el.querySelector('.spwheel').classList.add('go'); return setTimeout(() => { el.querySelector('.spspin b').textContent = `You won: ${pick(['nothing!', 'a free spin of this wheel', 'the concept of money', 'one (1) duck', 'exposure'])}`; sp.textContent = 'CLAIM'; sp.disabled = false; sp.removeAttribute('data-spin'); sp.dataset.link = ''; }, 2200); }
      if (e.target.closest('[data-link]')) { openLink(); if (C.rnd() < .5) bye(); }
    });
    const cd = el.querySelector('.spcd span'); if (cd) { let n = 10; const t = setInterval(() => { if (!el.isConnected) return clearInterval(t); n = n <= 0 ? 10 : n - 1; cd.textContent = '00:' + String(n).padStart(2, '0'); }, 1000); }
    setTimeout(() => el.isConnected && bye(), 25000);
    return el;
  }
  function schedule(first) {
    clearTimeout(popT);
    popT = setTimeout(() => { if (!spamOff() && !document.hidden && !document.querySelector('.modal-wrap, .modal')) popup(); schedule(); }, first ? 20000 + C.rnd() * 15000 : 35000 + C.rnd() * 45000);
  }
  /* side ads */
  const sideAd = cls => { const ad = randAd(); return `<div class="sidead ${cls}" style="--c1:${ad.c1};--c2:${ad.c2}"><div class="sdh"><span>Ad</span><button data-sx title="Close">✕</button></div>${media(ad.md)}<b>${C.esc(ad.t)}</b><p>${C.esc(ad.s)}</p><button class="btn small" data-link>${pick(CTA)} ›</button></div>`; };
  function rail() {
    let r = document.getElementById('adrail');
    if (spamOff()) { if (r) r.remove(); return; }
    if (!r) { r = document.createElement('aside'); r.id = 'adrail'; document.getElementById('app').append(r); r.addEventListener('click', sideClick); }
    r.innerHTML = sideAd('sky') + sideAd('sky');
  }
  function sideCard() {
    let s = document.getElementById('sbad'); const nav = document.getElementById('namebtn');
    if (spamOff()) { if (s) s.remove(); return; }
    if (!s && nav) { s = document.createElement('div'); s.id = 'sbad'; nav.before(s); s.addEventListener('click', sideClick); }
    if (s) { const ad = randAd(); s.innerHTML = `<div class="sbad" style="--c1:${ad.c1};--c2:${ad.c2}" data-link><span class="sbi">${C.icon(ad.ic, 18)}</span><div><small>Sponsored</small><b>${C.esc(ad.t)}</b></div></div>`; }
  }
  function sideClick(e) {
    const x = e.target.closest('[data-sx]');
    if (x) { const box = x.closest('.sidead'); box.outerHTML = `<div class="sidead gone"><p>Ad closed.<br>Here’s another ad in a moment.</p></div>`; return setTimeout(rail, 4000); }
    if (e.target.closest('[data-link]')) openLink();
  }
  function banner() {
    if (spamOff()) return;
    const v = document.getElementById('view'); if (!v || v.querySelector('.bannerad')) return;
    const ad = randAd(), b = document.createElement('div'); b.className = 'bannerad'; b.style.cssText = `--c1:${ad.c1};--c2:${ad.c2}`;
    b.innerHTML = `${media(ad.md)}<div><small>SPONSORED · ${pick(STICKERS)}</small><b>${C.esc(ad.t)}</b><p>${C.esc(ad.s)}</p></div><button class="btn gold" data-link>${pick(CTA)} ›</button>`;
    b.addEventListener('click', e => { if (e.target.closest('[data-link]')) openLink(); });
    v.append(b);
  }
  function startSpam() {
    rail(); sideCard(); schedule(true);
    setInterval(() => { if (!document.hidden) { rail(); sideCard(); } }, 20000);
    C.on('route', () => setTimeout(banner, 300)); setTimeout(banner, 600);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(startSpam, 0)); else setTimeout(startSpam, 0);

  return { watch, ADS, count: () => ADS.length, popup, refresh: () => { rail(); sideCard(); } };
})();
