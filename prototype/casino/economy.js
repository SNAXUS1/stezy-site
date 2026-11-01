'use strict';
/* Economy: collector cards, grades, stock-like market prices, bonus cards (boosts), lucky chests, case opening */
const Eco = (() => {
  const C = Casino;
  const RAR = [
    { k: 'common', name: 'Common', color: '#9aa4b2', n: 40, lo: 12, hi: 35, pts: 1 },
    { k: 'uncommon', name: 'Uncommon', color: '#4ade80', n: 30, lo: 45, hi: 110, pts: 3 },
    { k: 'rare', name: 'Rare', color: '#60a5fa', n: 22, lo: 170, hi: 380, pts: 8 },
    { k: 'epic', name: 'Epic', color: '#a855f7', n: 14, lo: 650, hi: 1400, pts: 20 },
    { k: 'legendary', name: 'Legendary', color: '#f43f5e', n: 8, lo: 2800, hi: 6500, pts: 60 },
    { k: 'mythic', name: 'Mythic', color: '#f5c451', n: 6, lo: 16000, hi: 42000, pts: 250 }
  ];
  /* Meme cards: imgflip templates (api.imgflip.com/get_memes) with casino captions. Mythics are animated GIFs from Wikimedia Commons.
     Each entry: [imgflip id, card name, top caption, bottom caption] */
  const MEMES = [
    [ // common
      ['bwu6w', 'C\'mon Do Something', 'ME AT THE SLOT MACHINE', 'C\'MON, DO SOMETHING'], ['hlmst', 'I\'m the Dealer Now', 'LOOK AT ME', 'I\'M THE DEALER NOW'], ['hmt3v', 'High Roller Now', 'LOOK AT ME', 'I\'M THE HIGH ROLLER NOW'],
      ['1bhw', 'Grandma Finds Crash', 'GRANDMA FINDS', 'THE CRASH GAME'], ['1itoun', 'Charlie\'s Roulette Theory', 'RED, BLACK, RED, BLACK', 'IT\'S A PATTERN!'], ['8k0sa', 'Yoda\'s Bankroll Wisdom', 'BET OR BET NOT', 'THERE IS NO CASH OUT'],
      ['21tqf4', 'Scroll of Truth', 'THE HOUSE HAS AN EDGE', '*THROWS SCROLL*'], ['5o32tt', 'We Are Not the Same', 'YOU BET TO WIN', 'I BET FOR THE CHESTS'], ['2896ro', 'The Chopper Argument', 'SPLIT THE 10s!', 'NEVER SPLIT 10s!'],
      ['26hg', 'Chest in a Chest', 'YO DAWG, I HEARD YOU LIKE CHESTS', 'SO WE PUT A CHEST IN YOUR CHEST'], ['9sw43', 'Kermit Sips Tea', 'YOU BET ON 00 IN EUROPEAN ROULETTE', 'BUT THAT\'S NONE OF MY BUSINESS'], ['72epa9', 'Days Without Max Bet', '0 DAYS WITHOUT', 'BETTING THE MAX'],
      ['4pn1an', 'They Don\'t Know', 'THEY DON\'T KNOW', 'I HAVE A SAFETY NET CARD'], ['3po4m7', 'Hiding From the Statement', 'ME, HIDING', 'FROM MY BANK STATEMENT'], ['30b1gx', 'Drake Picks a Chest', 'CHEST FROM THE SHOP', 'CHEST FROM PLAYING'],
      ['1g8my4', 'Two Buttons: Ads', 'WATCH AN AD', 'WATCH ANOTHER AD'], ['1ur9b0', 'Distracted by Crash', 'ME, PLAYING BLACKJACK', 'THE ROCKET HITTING 100×'], ['26jxvz', 'Gru\'s Daily Wheel', 'SPIN THE WHEEL EVERY DAY', 'FORGET ONE DAY. STREAK GONE.'],
      ['24y43o', 'Plinko Is a Sport', 'PLINKO IS A SPORT', 'CHANGE MY MIND'], ['345v97', 'Yelling at the Duck', 'RUN FASTER!!', 'I AM A DUCK'], ['1otk96', 'Mocking the Odds', 'tHe OdDs ArE', 'aGaInSt YoU'],
      ['1o00in', 'Is This a Royal Flush?', 'TWO PAIR', 'IS THIS A ROYAL FLUSH?'], ['1bij', 'Simply Fold Aces', 'ONE DOES NOT SIMPLY', 'FOLD POCKET ACES'], ['1jwhww', 'Crash Brain', 'CASH OUT AT 2×', 'NEVER CASH OUT'],
      ['wxica', 'Fine Dog Plays Mines', '23 MINES SELECTED', 'THIS IS FINE'], ['1h7in3', 'Roll Safe Refills', 'CAN\'T BE BROKE', 'IF YOU WATCH 10 ADS A DAY'], ['gk5el', 'Harold Checks the Market', 'MY CARD DROPPED 40%', 'GREAT INVESTMENT'],
      ['2gnnjh', 'Monkey Sees the Raise', 'WHEN THE BOT RAISES', 'WITH 7-2 OFFSUIT'], ['1e7ql7', 'Evil Kermit: Chests', 'SELL THE CHEST', 'OPEN IT. WHAT COULD GO WRONG'], ['1bip', 'Brian Pulls a Mythic', 'PULLS A MYTHIC CARD', 'CLICKS SELL BY ACCIDENT'],
      ['2kbn1e', 'Pikachu Bets Black', 'BETS ON BLACK', 'BALL LANDS ON GREEN'], ['1bgw', 'Fry Reads the Market', 'NOT SURE IF MARKET CRASH', 'OR JUST TUESDAY'], ['23ls', 'Disaster Plinko', 'THE PLINKO BOARD', 'AFTER MY 100 DROPS'],
      ['9ehk', 'Bat-Slap: Rent', 'I\'LL JUST USE MY RENT—', 'NO.'], ['1b42wl', 'Bike Fall Crash', 'DOESN\'T CASH OUT AT 3×', 'WHY DID IT CRASH?!'], ['19vcz0', 'Pawn Stars: Chests', 'A DIAMOND CHEST?', 'BEST I CAN DO IS A HUG'],
      ['29v4rt', 'Friendship Ended With Luck', 'FRIENDSHIP ENDED WITH LUCK', 'NOW SKILL IS MY... OH NO'], ['24zoa8', 'No? Yes! Slots', 'PAYING BILLS', 'PAYING SLOTS'], ['54d9lj', 'Two Paths: Ducks', 'THE FASTEST DUCK', 'THE DUCK WITH A COOL NAME'],
      ['1ihzfe', 'Bots Everywhere', 'BOTS', 'BOTS EVERYWHERE']
    ],
    [ // uncommon
      ['5v6gwj', 'Bus of Outcomes', 'WINNERS ENJOYING THE VIEW', 'ME STARING AT THE ROCK'], ['3i7p', 'Imagination Bankroll', 'BANKROLL MANAGEMENT', '*RAINBOW HANDS*'], ['3eqjd8', 'Three Bots, One Bluff', 'WHEN THREE BOTS', 'ALL BLUFF AT ONCE'],
      ['58eyvu', 'Where Winnings?', 'WHERE', 'WINNINGS?'], ['29v4rt', 'Friendship Ended With Red', 'FRIENDSHIP ENDED WITH RED', 'NOW BLACK IS MY BEST FRIEND'], ['m78d', 'Boardroom Strategy', 'HOW DO WE WIN MORE?', 'STOP PLAYING *THROWN OUT*'],
      ['1e7ql7', 'Evil Kermit Says Spin', 'ME: GO TO SLEEP', 'ALSO ME: ONE MORE SPIN'], ['33e92f', 'Three-Headed Bankroll', 'SLOTS, POKER, AND', 'THE ONE THAT LOST IT ALL'], ['2reqtg', 'Flex Tape the Losses', 'PATCHING MY LOSSES', 'WITH BIGGER BETS'],
      ['1bip', 'Bad Luck Brian', 'HITS A ROYAL FLUSH', 'IN SOLO PRACTICE'], ['1yz6z4', 'Types of Headaches', 'MIGRAINE · STRESS · TENSION', 'DEALER FLIPS 21'], ['3kwur5', 'All My Homies Hate the Edge', 'ALL MY HOMIES', 'HATE THE HOUSE EDGE'],
      ['1w7ygt', 'Seagull Screams Jackpot', 'J-', 'JACKPOOOOOT!'], ['2eeunw', 'Unmasking the Strategy', 'LET\'S SEE THIS GENIUS STRATEGY', 'IT WAS LUCK ALL ALONG'], ['24zoa8', 'No? Yes!', 'FOLD ON TRASH', 'CALL WITH TRASH'],
      ['1qg8fp', 'Reaper Knocks Twice', 'LUCK, KNOCKING ON', 'EVERY DOOR BUT MINE'], ['1tkjq9', 'Spider-Bot Standoff', 'BOT BLUFFING', 'BOT BLUFFING BACK'], ['1nck6k', 'Sleeping Shaq Wakes', 'NORMAL BETS: ZZZ', 'ALL-IN: WIDE AWAKE'],
      ['3vfrmx', 'Dealer Wins Again', 'ME WITH 20', 'THE DEALER WITH 21'], ['1op9wy', 'Whisper of the Wheel', '*WHISPERS*', 'PUT IT ALL ON 17'], ['3qqcim', 'Panik Kalm Panik', 'CRASH AT 1.01×', 'I NEVER BET... I SHOULD HAVE?'],
      ['27qxmb', 'Something of a Statistician', 'YOU KNOW, I\'M SOMETHING', 'OF A STATISTICIAN MYSELF'], ['4acd7j', 'Laughing at the Odds', 'THE ODDS: 0.05%', 'ME: *PULLS A MYTHIC*'], ['28s2gu', 'Who Killed My Bankroll', 'WHO KILLED MY BANKROLL?', 'IT WAS ME'],
      ['1iruch', 'Drake Saves Chests', 'SAVING MONEY', 'SAVING CHESTS'], ['176h0h', 'Say the Line', 'SAY THE LINE!', '"THE HOUSE ALWAYS WINS"'], ['2oo7h0', 'Domino Bankroll', 'ONE FREE SPIN', 'MY ENTIRE PERSONALITY'],
      ['2cjr7j', 'Is This Profit?', 'A $2 WIN AFTER $200', 'IS THIS PROFIT?'], ['1yxkcp', 'The Max Bet Button', 'WHEN THE BUTTON SAYS MAX', '*SMASH*'], ['54d9lj', 'Two Paths', 'CASH OUT', 'LET IT RIDE']
    ],
    [ // rare
      ['3lmzyx', 'UNO Reverse Gambler', 'STOP GAMBLING OR', 'DRAW 25'], ['22bdq6', 'Exit 12 Off Ramp', 'CASH OUT AT 2×', 'WAIT FOR 100×'], ['5c7lwq', 'Anakin Cashes Out', 'YOU CASHED OUT, RIGHT?', '...RIGHT?'],
      ['28j0te', 'The Gambler\'s Handshake', 'PLAYERS AND BOTS', 'AGREEING IT\'S RIGGED'], ['2fm6x', 'Waiting for the Bonus', 'ME WAITING FOR', 'THE SLOT BONUS ROUND'], ['261o3j', 'Balloon of Savings', 'MY SAVINGS', 'FLOATING TO THE CASINO'],
      ['1ihzfe', 'Chests Everywhere', 'CHESTS', 'CHESTS EVERYWHERE'], ['54hjww', 'Trade Offer: Rent', 'I RECEIVE: YOUR RENT', 'YOU RECEIVE: A BRONZE CHEST'], ['2odckz', 'Marked Safe From Profit', 'MARKED SAFE FROM', 'WINNING TODAY'],
      ['26am', 'Ancient Alien Odds', 'I\'M NOT SAYING IT\'S LUCK', 'BUT IT\'S LUCK'], ['2xscjb', 'Getting Paid?', 'WAIT, YOU GUYS', 'ARE CASHING OUT?'], ['1b42wl', 'Bike Fall Bankroll', 'ME, BETTING MAX', 'ALSO ME: WHY AM I BROKE'],
      ['8d317n', 'Absolute Casino', 'THAT ROYAL FLUSH', 'ABSOLUTE CINEMA'], ['1wz1x', 'Where My Winnings Go', 'THIS IS WHERE I\'D PUT', 'MY WINNINGS, IF I HAD ANY'], ['145qvv', 'Squidward Watches Winners', 'ME AT $0', 'WATCHING CRASH HIT 50×'],
      ['gtj5t', 'Oprah\'s Bonus Round', 'YOU GET A CHEST!', 'EVERYBODY GETS A CHEST!'], ['2ybua0', 'Fancy Pooh', 'LOSING MONEY', 'INVESTING IN EXPERIENCES'], ['64sz4u', 'Megamind Peeks', 'NO', 'WINNINGS?'],
      ['19vcz0', 'Pawn Stars Appraisal', 'YOUR MYTHIC CARD?', 'BEST I CAN DO IS $3'], ['1tl71a', 'Thinking About 8s', 'I BET HE\'S THINKING ABOUT ME', 'IF ONLY I HAD SPLIT THOSE 8s'], ['8tw3vb', 'Bell Curve Bettor', 'BET RED', 'BET RED, BUT SMARTER'],
      ['38el31', 'Clown Up the Bankroll', 'JUST ONE MORE ROUND', 'I AM THE CLOWN']
    ],
    [ // epic
      ['1g8my4', 'The Eternal Dilemma', 'HIT ON 16', 'STAND ON 16'], ['26jxvz', 'Gru\'s Martingale', 'DOUBLE AFTER EVERY LOSS', 'WAIT... OUT OF MONEY'], ['24y43o', 'Change My Mind, Dealer', 'THE SLOT IS DUE', 'CHANGE MY MIND'],
      ['1h7in3', 'Roll Safe Logic', 'CAN\'T LOSE MONEY', 'IF YOU ONLY BET CHESTS'], ['46e43q', 'Always Has Been Random', 'WAIT, IT\'S ALL RANDOM?', 'ALWAYS HAS BEEN'], ['1o00in', 'Is This a Strategy?', 'BETTING ON MY BIRTHDAY', 'IS THIS A STRATEGY?'],
      ['1otk96', 'sPoNgE bEtS', 'yOu ShOuLd QuIt', 'wHiLe YoU\'rE aHeAd'], ['2gnnjh', 'Awkward Monkey Look', 'WHEN SOMEONE ASKS', 'HOW MUCH I\'M UP'], ['1bij', 'One Does Not Simply Leave', 'ONE DOES NOT SIMPLY', 'STOP AFTER ONE SPIN'],
      ['1bgw', 'Suspicious Fry', 'NOT SURE IF HOT STREAK', 'OR JUST GOOD SEEDS'], ['23ls', 'Disaster Dealer', 'THE CASINO', 'AFTER MY LUCKY NIGHT'], ['9ehk', 'Bat-Slap of Reason', 'ONE MORE SPIN AND I\'LL—', 'NO.'],
      ['39t1o', 'Cheers to the Pot', 'TO EVERYONE WHO', 'CALLED MY BLUFF'], ['2za3u1', 'Same Picture', 'LOSING ON RED · LOSING ON BLACK', 'IT\'S THE SAME PICTURE']
    ],
    [ // legendary
      ['30b1gx', 'Drake Counts Chips', 'COUNTING CARDS', 'COUNTING ON VIBES'], ['1ur9b0', 'Distracted Gambler', 'ME, SPOTTING A NEW SLOT', 'MY RENT MONEY, WATCHING'], ['wxica', 'This Is Fine (Balance $0)', 'DOWN TO MY LAST CHIP', 'THIS IS FINE'],
      ['2kbn1e', 'Shocked Pikachu All-In', 'GOES ALL IN WITH 7-2', 'LOSES'], ['gk5el', 'Harold\'s Bankroll', 'BALANCE: $3', 'LIVING THE DREAM'], ['345v97', 'Cat Refuses to Fold', 'FOLD, YOU HAVE NOTHING!', 'I HAVE VIBES'],
      ['1jwhww', 'Galaxy Brain Strategy', 'BET RED · BET BLACK', 'BET THE HOUSE ON GREEN'], ['43a45p', 'Doge Gambler Evolution', 'GAMBLERS IN 1920: STRATEGY', 'GAMBLERS NOW: "IT\'S DUE"']
    ]
  ];
  const W = 'https://upload.wikimedia.org/wikipedia/commons/';
  const GIFS = [
    [W + 'thumb/8/81/Cat_funny_gif.gif/330px-Cat_funny_gif.gif', 'Lord Whiskers, Unbothered', 'THE DEALER BUSTS', 'ME: I KNEW IT'],
    [W + 'thumb/7/7b/The_Dougie_%28animated%29.gif/330px-The_Dougie_%28animated%29.gif', 'The Victory Dougie', 'WON $4 BACK', 'AFTER LOSING $400'],
    [W + 'thumb/3/31/Black_Cat_1220032.gif/330px-Black_Cat_1220032.gif', 'Black Cat Crossing', 'BAD LUCK?', 'I PREFER "VOLATILITY"'],
    [W + '2/21/Spinning_Dancer.gif', 'Which Way, Roulette?', 'CLOCKWISE OR', 'COUNTER-JACKPOT?'],
    [W + '2/29/Dog_wiggling_tail.gif', 'Good Boy Jackpot', 'WHEN THE CHEST', 'IS A MYTHIC'],
    [W + 'd/d3/Newtons_cradle_animation_book_2.gif', 'Hit or Stand Cradle', 'HIT. STAND. HIT.', 'STAND. HIT. BUST.']
  ];
  const PNG = new Set(['46e43q', '5c7lwq', '72epa9', '43a45p', '2xscjb', '8d317n', '2ybua0', '64sz4u', '4pn1an', '8tw3vb', '58eyvu', '2reqtg', '3qqcim', '4acd7j', '54d9lj', '5o32tt']);
  const SERIES = ['Classic Memes', 'Dank Vault', 'Casino Cringe', 'Internet Gold', 'Reaction Pack', 'Wholesome Wins'];
  const CARDS = [], BY = {};
  (() => {
    const r = Shared.mulberry32(20261031); let n = 0;
    RAR.forEach((ra, ri) => { for (let i = 0; i < ra.n; i++) {
      n++; const id = 'c' + String(n).padStart(3, '0'), gif = ri === 5;
      const m = gif ? GIFS[i] : MEMES[ri][i];
      const c = { id, name: m[1], top: m[2], bot: m[3], gif, r: ri, rar: ra, series: SERIES[Math.floor(r() * SERIES.length)], base: Math.round(ra.lo + (ra.hi - ra.lo) * r()), hue: Math.floor(r() * 360),
        img: gif ? m[0] : `https://i.imgflip.com/4/${m[0]}.jpg`, full: gif ? m[0] : `https://i.imgflip.com/${m[0]}.${PNG.has(m[0]) ? 'png' : 'jpg'}` };
      CARDS.push(c); BY[id] = c;
    } });
  })();

  /* ---------- bonus cards ---------- */
  const BOOSTS = {
    charm: { name: 'Lucky Charm', desc: '+15% extra on every win for 15 rounds', act: 'charm', pct: .15, rounds: 15, value: 160, color: '#34d399', icon: 'star' },
    gcharm: { name: 'Golden Charm', desc: '+35% extra on every win for 10 rounds', act: 'charm', pct: .35, rounds: 10, value: 650, color: '#f5c451', icon: 'star' },
    shield: { name: 'Safety Net', desc: 'Refunds 50% of every loss for 12 rounds', act: 'shield', rounds: 12, value: 300, color: '#60a5fa', icon: 'lock' },
    clover: { name: 'Treasure Hunter', desc: '3× chest drop chance for 30 rounds', act: 'clover', rounds: 30, value: 220, color: '#a78bfa', icon: 'chest' },
    guard: { name: 'Rating Guard', desc: 'No rating loss for 20 rounds', act: 'guard', rounds: 20, value: 140, color: '#fbbf24', icon: 'trophy' },
    xp: { name: 'Hot Streak', desc: 'Double rating gains for 15 rounds', act: 'xp', rounds: 15, value: 280, color: '#fb923c', icon: 'flame' }
  };
  const BOOST_W = [['charm', 30], ['shield', 22], ['clover', 18], ['guard', 16], ['xp', 9], ['gcharm', 5]];
  const pickW = list => { let r = C.rnd() * list.reduce((a, x) => a + x[1], 0); for (const [k, w] of list) { r -= w; if (r < 0) return k; } return list[0][0]; };

  /* ---------- grades & market ---------- */
  const rollGrade = () => Math.round((3 + 7 * Math.pow(C.rnd(), 1.4)) * 10) / 10;
  const gradeMult = g => .6 + Math.pow(g / 10, 2) * .9;
  const vnoise = (key, x) => { const i = Math.floor(x), f = x - i, a = Shared.hash(key + i) / 2147483648 - 1, b = Shared.hash(key + (i + 1)) / 2147483648 - 1, s = f * f * (3 - 2 * f); return a + (b - a) * s; };
  const H = 36e5;
  const trend = (c, t) => Math.exp(.26 * vnoise(c.id + 'a', t / (H * 48)) + .1 * vnoise(c.id + 'b', t / (H * 8)) + .035 * vnoise(c.id + 'c', t / (H * 1.5)));
  const supplyOf = c => (typeof MP !== 'undefined' && MP.state().supply || {})[c.id];
  const supplyMult = c => { const s = supplyOf(c); return s == null ? 1 : Math.max(.75, Math.min(1.3, 1.3 - .055 * Math.log2(1 + s))); };
  const price = (c, t = Date.now()) => C.r2(c.base * trend(c, t) * supplyMult(c));
  const value = it => C.r2(price(BY[it.id]) * gradeMult(it.grade));
  const sellPrice = it => C.r2(value(it) * .92);
  const change24 = c => price(c) / price(c, Date.now() - 24 * H) - 1;
  const priceHistory = (c, days = 7, pts = 84) => Array.from({ length: pts + 1 }, (_, i) => price(c, Date.now() - (pts - i) * days * 24 * H / pts));

  /* ---------- chests ---------- */
  const CHESTS = {
    bronze: { name: 'Bronze Chest', color: '#d08a4a', w: [70, 22, 6.4, 1.3, .25, .05], boost: .15 },
    silver: { name: 'Silver Chest', color: '#cbd5e1', w: [42, 33, 17, 6, 1.6, .4], boost: .2 },
    gold: { name: 'Gold Chest', color: '#f5c451', w: [15, 32, 30, 16, 5.5, 1.5], boost: .25 },
    diamond: { name: 'Diamond Chest', color: '#67e8f9', w: [0, 14, 34, 32, 14, 6], boost: .3 }
  };
  const EG = (() => { let s = 0; for (let i = 0; i < 2000; i++) s += gradeMult(3 + 7 * Math.pow((i + .5) / 2000, 1.4)); return s / 2000; })();
  const avgBase = RAR.map((_, ri) => { const p = CARDS.filter(c => c.r === ri); return p.reduce((a, c) => a + c.base, 0) / p.length; });
  const avgBoost = BOOST_W.reduce((a, [k, w]) => a + BOOSTS[k].value * w, 0) / BOOST_W.reduce((a, x) => a + x[1], 0);
  for (const k in CHESTS) {
    const ch = CHESTS[k], tw = ch.w.reduce((a, b) => a + b, 0);
    ch.ev = (1 - ch.boost) * ch.w.reduce((a, w, ri) => a + w / tw * avgBase[ri] * EG, 0) + ch.boost * avgBoost;
    ch.price = Math.round(ch.ev * 1.45 / 10) * 10; ch.sell = Math.round(ch.ev * .5);
    ch.odds = ch.w.map(w => w / tw * (1 - ch.boost));
  }
  function rollItem(tier) {
    const ch = CHESTS[tier];
    if (C.rnd() < ch.boost) return { kind: 'boost', type: pickW(BOOST_W) };
    const ri = +pickW(ch.w.map((w, i) => [String(i), w])), pool = CARDS.filter(c => c.r === ri);
    return { kind: 'card', id: pool[C.rint(pool.length)].id, grade: rollGrade() };
  }
  function grantChest(tier, why) {
    C.S.inv.chests[tier] = (C.S.inv.chests[tier] || 0) + 1; C.save(); C.emit('change');
    C.sfx('open'); C.toast(`${CHESTS[tier].name} ${why || 'received'}!`, 'gold', { label: 'Open', fn: () => { location.hash = '#/collection/chests'; setTimeout(() => openChest(tier), 200); } });
  }
  C.on('settled', ({ id, wagered, profit }) => {
    let p = .035 + Math.min(.045, wagered / 2500); if (profit > 0) p += .01; if (C.S.active.clover) p *= 3;
    if (C.rnd() >= p) return;
    const u = C.rnd(), big = Math.min(1, wagered / 1000);
    const tier = u < .005 + .02 * big ? 'diamond' : u < .05 + .08 * big ? 'gold' : u < .25 + .15 * big ? 'silver' : 'bronze';
    setTimeout(() => grantChest(tier, `found in ${(C.games()[id] || {}).name || 'play'}`), 900);
  });

  /* ---------- inventory ops ---------- */
  const inv = () => C.S.inv;
  function addItem(item) {
    if (item.kind === 'card') { const it = { uid: C.uid(), id: item.id, grade: item.grade, t: Date.now() }; inv().cards.push(it); if (typeof MP !== 'undefined') MP.mint([item.id]); C.save(); C.emit('profile'); return it; }
    const b = { uid: C.uid(), type: item.type, t: Date.now() }; inv().boosts.push(b); C.save(); return b;
  }
  function sellCard(uid, silent) {
    const i = inv().cards.findIndex(c => c.uid === uid); if (i < 0) return 0;
    const it = inv().cards[i], p = sellPrice(it); inv().cards.splice(i, 1);
    C.S.profile.showcase = C.S.profile.showcase.filter(u => u !== uid);
    if (typeof MP !== 'undefined') MP.burn(it.id);
    if (!silent) C.credit(p, `Sold ${BY[it.id].name}`); else { C.S.balance = C.r2(C.S.balance + p); C.save(); C.emit('change'); }
    C.emit('profile'); return p;
  }
  function sellBoost(uid) { const i = inv().boosts.findIndex(b => b.uid === uid); if (i < 0) return; const b = inv().boosts.splice(i, 1)[0]; C.credit(Math.round(BOOSTS[b.type].value * .6), `Sold ${BOOSTS[b.type].name}`); }
  function activateBoost(uid) {
    const i = inv().boosts.findIndex(b => b.uid === uid); if (i < 0) return;
    const def = BOOSTS[inv().boosts[i].type], A = C.S.active, cur = A[def.act];
    if (cur && def.act === 'charm' && cur.pct > (def.pct || 0)) return C.toast('A stronger charm is already active', 'bad');
    inv().boosts.splice(i, 1);
    A[def.act] = { left: (cur ? cur.left : 0) + def.rounds, pct: def.pct };
    C.save(); C.emit('change'); C.sfx('big'); C.toast(`${def.name} activated · ${A[def.act].left} rounds`, 'gold');
  }
  function summary() {
    const cards = inv().cards;
    return { count: cards.length, score: cards.reduce((a, c) => a + BY[c.id].rar.pts, 0), value: C.r2(cards.reduce((a, c) => a + value(c), 0)), unique: new Set(cards.map(c => c.id)).size };
  }
  const showcase = () => C.S.profile.showcase.map(u => inv().cards.find(c => c.uid === u)).filter(Boolean).map(c => ({ id: c.id, grade: c.grade }));

  /* ---------- rendering ---------- */
  const mono = c => c.name.split(' ').map(w => w[0]).join('');
  function cardHTML(it, o = {}) {
    const c = BY[it.id], R = c.rar, owned = o.owned !== false, big = /\bbig\b/.test(o.cls || '');
    const art = owned ? `<span class="cmono">${mono(c)}</span><img class="mbg" src="${c.img}" alt="" loading="lazy" onerror="this.remove()"><img class="mimg" src="${big ? c.full : c.img}" alt="${C.esc(c.name)}" loading="lazy" onerror="this.remove()"><span class="cap t">${C.esc(c.top)}</span><span class="cap b">${C.esc(c.bot)}</span>` : '<span class="cmono">?</span>';
    return `<div class="ccard r-${R.k} ${owned ? '' : 'unowned'} ${o.cls || ''}" style="--rc:${R.color};--hue:${c.hue}${o.i != null ? ';--i:' + o.i : ''}" data-uid="${it.uid || ''}" data-id="${c.id}" data-grade="${it.grade != null ? it.grade : ''}">
      <div class="cimg meme">${art}${R.k === 'mythic' && owned ? '<span class="gifb">GIF</span>' : ''}${o.badge || ''}</div>
      <div class="cbody"><div class="crar">${R.name}${it.grade != null && owned ? `<span class="cgrade" title="Grade">G${it.grade.toFixed(1)}</span>` : ''}</div><b class="cname">${owned ? C.esc(c.name) : 'Undiscovered'}</b><small>${c.series}</small>${o.price === false ? '' : `<div class="cprice">${C.fmt(it.grade != null ? value(it) : price(c))}</div>`}</div></div>`;
  }
  const boostHTML = (b, extra = '') => { const d = BOOSTS[b.type]; return `<div class="bcard" style="--rc:${d.color}" data-uid="${b.uid || ''}"><div class="bico">${C.icon(d.icon, 30)}</div><div class="cbody"><div class="crar">Bonus card</div><b class="cname">${d.name}</b><small>${d.desc}</small>${extra}</div></div>`; };
  const chestArt = (tier, size = 84) => `<div class="chest-art" style="--cc:${CHESTS[tier].color};width:${size}px;height:${size}px">${C.icon('chest', Math.round(size * .62))}</div>`;
  function spark(vals, w = 120, h = 34, col) {
    const lo = Math.min(...vals), hi = Math.max(...vals), sp = hi - lo || 1, up = vals[vals.length - 1] >= vals[0];
    const c = col || (up ? '#34d399' : '#f0605d');
    const pts = vals.map((v, i) => `${(i / (vals.length - 1) * w).toFixed(1)},${(h - 3 - (v - lo) / sp * (h - 6)).toFixed(1)}`);
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" preserveAspectRatio="none"><path d="M0,${h} L${pts.join(' L')} L${w},${h}Z" fill="${c}" fill-opacity=".12"/><path d="M${pts.join(' L')}" fill="none" stroke="${c}" stroke-width="1.6"/></svg>`;
  }
  const pct = x => `<span class="${x >= 0 ? 'pos' : 'neg'}">${x >= 0 ? '▲' : '▼'} ${Math.abs(x * 100).toFixed(1)}%</span>`;

  function cardDetail(it, onDone) {
    const c = BY[it.id], owned = !!it.uid && inv().cards.some(x => x.uid === it.uid), h = priceHistory(c, 7, 120);
    if (it.grade == null) it = Object.assign({}, it, { grade: undefined });
    const m = C.modal(`<div class="cdetail"><div>${cardHTML(it, { cls: 'big' })}</div><div class="cdinfo">
      <div class="crar" style="color:${c.rar.color}">${c.rar.name} · ${c.series}</div><h2>${C.esc(c.name)}</h2><div class="cdcap">“${C.esc(c.top)} … ${C.esc(c.bot)}”</div>
      <div class="kv"><span>Market price</span><b>${C.fmt(price(c))}</b></div><div class="kv"><span>24h change</span><b>${pct(change24(c))}</b></div>
      ${it.grade != null ? `<div class="kv"><span>Grade</span><b>${it.grade.toFixed(1)} / 10 <small class="muted">(${gradeMult(it.grade).toFixed(2)}× value)</small></b></div><div class="kv"><span>${owned ? 'Your' : 'This'} card's value</span><b style="color:var(--gold)">${C.fmt(value(it))}</b></div>` : ''}
      <div class="kv"><span>In circulation</span><b>${supplyOf(c) != null ? supplyOf(c) : '—'}</b></div>
      <div class="kv"><span>Collection points</span><b>${c.rar.pts}</b></div>
      <div class="chartbox">${spark(h, 360, 110)}<div class="chartlbl"><span>7 days ago</span><span>now</span></div></div>
      ${owned ? `<div class="btnrow"><button class="btn gold" data-a="sell">Sell for ${C.fmt(sellPrice(it))}</button><button class="btn sec" data-a="show">${C.S.profile.showcase.includes(it.uid) ? 'Remove from showcase' : 'Add to showcase'}</button></div><p class="muted" style="font-size:12px;margin-top:8px">Selling pays 92% of value. Prices move with the market and with how many copies exist.</p>` : ''}
    </div></div>`, { cls: 'wide' });
    m.el.addEventListener('click', e => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      if (b.dataset.a === 'sell') { sellCard(it.uid); m.close(); onDone && onDone(); }
      if (b.dataset.a === 'show') {
        const sc = C.S.profile.showcase;
        if (sc.includes(it.uid)) C.S.profile.showcase = sc.filter(u => u !== it.uid); else { if (sc.length >= 4) sc.shift(); sc.push(it.uid); }
        C.save(); C.emit('profile'); C.toast('Showcase updated'); m.close(); onDone && onDone();
      }
    });
  }

  /* ---------- case opening ---------- */
  function tileHTML(item) {
    if (item.kind === 'boost') { const d = BOOSTS[item.type]; return `<div class="ctile boost" style="--rc:${d.color}"><div class="timg">${C.icon(d.icon, 34)}</div><span>${d.name}</span></div>`; }
    const c = BY[item.id]; return `<div class="ctile r-${c.rar.k}" style="--rc:${c.rar.color};--hue:${c.hue}"><div class="timg"><b>${mono(c)}</b><img src="${c.img}" alt="" onerror="this.remove()"></div><span>${C.esc(c.name)}</span></div>`;
  }
  function openChest(tier, onDone) {
    if (!(inv().chests[tier] > 0)) return C.toast('No chest of that type', 'bad');
    inv().chests[tier]--; C.save(); C.emit('change');
    const win = rollItem(tier), N = 56, WIN = 47, TW = 140;
    const strip = Array.from({ length: N }, (_, i) => i === WIN ? win : rollItem(tier));
    const m = C.modal(`<div class="case"><div class="case-head">${chestArt(tier, 46)}<div><small class="muted">Opening</small><h2>${CHESTS[tier].name}</h2></div></div>
      <div class="case-window"><div class="case-marker"></div><div class="case-strip">${strip.map(tileHTML).join('')}</div></div><div class="case-result"></div></div>`, { cls: 'wide', noClose: true });
    const el = m.el.querySelector('.case-strip'), winEl = m.el.querySelector('.case-window');
    const target = WIN * TW + TW / 2 - winEl.clientWidth / 2 + (C.rnd() - .5) * (TW - 30);
    m.el.querySelector('.case-head .chest-art').classList.add('shake');
    requestAnimationFrame(() => { el.style.transition = 'transform 6.2s cubic-bezier(.08,.62,.1,1)'; el.style.transform = `translateX(${-target}px)`; });
    let lastTile = -1, raf;
    const tickFn = () => { const x = -new DOMMatrixReadOnly(getComputedStyle(el).transform).m41, t = Math.floor((x + winEl.clientWidth / 2) / TW); if (t !== lastTile) { lastTile = t; C.sfx('tick'); } raf = requestAnimationFrame(tickFn); };
    raf = requestAnimationFrame(tickFn);
    setTimeout(() => {
      cancelAnimationFrame(raf);
      const added = addItem(win), res = m.el.querySelector('.case-result');
      el.children[WIN].classList.add('won');
      const rar = win.kind === 'card' ? BY[win.id].rar : null;
      C.sfx(rar && rar.k !== 'common' && rar.k !== 'uncommon' ? 'big' : 'open');
      if (rar && rar.k === 'mythic') C.toast('MYTHIC PULL! Incredible luck!', 'gold');
      const ri = rar ? RAR.indexOf(rar) : -1;
      if (ri >= 3) C.fx.confetti(ri === 5 ? 260 : ri === 4 ? 180 : 110, innerWidth / 2, innerHeight * .45, ri === 5);
      res.innerHTML = `<div class="reveal ${rar ? 'r-' + rar.k : ''}">${win.kind === 'card' ? cardHTML(added, { cls: 'big' }) : boostHTML(added)}
        <div class="rv-actions"><h3>${win.kind === 'card' ? `${rar.name} card!` : 'Bonus card!'}</h3>
        ${win.kind === 'card' ? `<p class="muted">Grade ${added.grade.toFixed(1)} · worth ${C.fmt(value(added))}</p>` : `<p class="muted">${BOOSTS[win.type].desc}</p>`}
        <div class="btnrow"><button class="btn" data-a="keep">Keep</button>${win.kind === 'card' ? `<button class="btn gold" data-a="sell">Sell ${C.fmt(sellPrice(added))}</button>` : `<button class="btn gold" data-a="use">Activate now</button>`}
        ${inv().chests[tier] > 0 ? `<button class="btn sec" data-a="again">Open another (${inv().chests[tier]})</button>` : ''}</div></div></div>`;
      res.addEventListener('click', e => {
        const b = e.target.closest('[data-a]'); if (!b) return;
        if (b.dataset.a === 'sell') sellCard(added.uid);
        if (b.dataset.a === 'use') activateBoost(added.uid);
        m.close(); onDone && onDone();
        if (b.dataset.a === 'again') openChest(tier, onDone);
      });
    }, 6500);
  }

  /* ---------- Collection page ---------- */
  const TABS = [['chests', 'Chests', 'chest'], ['cards', 'Cards', 'cards'], ['boosts', 'Bonus cards', 'bolt'], ['shop', 'Shop', 'store'], ['catalog', 'Catalog', 'grid']];
  C.page({
    id: 'collection', title: 'Collection', mount(root, args) {
      let tab = TABS.some(t => t[0] === args[0]) ? args[0] : 'chests', filt = 'all', sort = 'value';
      const draw = () => {
        const s = summary(), I = inv();
        root.innerHTML = C.head('collection', 'Collection', 'Open lucky chests, collect rare cards, use bonus cards and trade on the market') + `
        <div class="stat-grid"><div class="stat"><small>Cards owned</small><b>${s.count}</b></div><div class="stat"><small>Unique</small><b>${s.unique} / ${CARDS.length}</b></div>
          <div class="stat"><small>Collection score</small><b>${s.score}</b></div><div class="stat"><small>Collection value</small><b style="color:var(--gold)">${C.fmt(s.value)}</b></div>
          <div class="stat"><small>Chests</small><b>${Object.values(I.chests).reduce((a, b) => a + b, 0)}</b></div></div>
        <div class="tabs">${TABS.map(([k, n, ic]) => { const cnt = { chests: Object.values(I.chests).reduce((a, b) => a + b, 0), cards: I.cards.length, boosts: I.boosts.length }[k]; return `<a href="#/collection/${k}" class="${tab === k ? 'on' : ''}" data-tab="${k}">${C.icon(ic, 18)}<span>${n}</span>${cnt ? `<em class="tcount">${cnt}</em>` : ''}</a>`; }).join('')}</div><div id="tabbody" class="tabbody"></div>`;
        const tb = root.querySelector('#tabbody');
        if (tab === 'chests') {
          tb.innerHTML = `<div class="chests">${Object.keys(CHESTS).map(k => { const ch = CHESTS[k], n = I.chests[k] || 0; return `<div class="chest ${n ? '' : 'empty'}" style="--cc:${ch.color}">${chestArt(k, 96)}<h3>${ch.name}</h3><div class="cnt">×${n}</div>
            <div class="odds">${RAR.map((r, i) => ch.odds[i] ? `<span style="--rc:${r.color}" title="${r.name}">${(ch.odds[i] * 100).toFixed(ch.odds[i] < .01 ? 2 : 1)}%</span>` : '').join('')}<span style="--rc:#94a3b8" title="Bonus card">${(ch.boost * 100).toFixed(0)}% bonus</span></div>
            <div class="btnrow"><button class="btn" data-open="${k}" ${n ? '' : 'disabled'}>Open</button><button class="btn sec small" data-sellc="${k}" ${n ? '' : 'disabled'}>Sell ${C.fmt(ch.sell)}</button></div></div>`; }).join('')}</div>
            <p class="muted" style="margin-top:14px">Chests drop randomly from every game round — bigger bets and wins raise the chance. Buy more in the <a href="#/collection/shop">Shop</a>.</p>`;
        } else if (tab === 'cards') {
          let list = I.cards.slice(); if (filt !== 'all') list = list.filter(c => BY[c.id].rar.k === filt);
          list.sort(sort === 'value' ? (a, b) => value(b) - value(a) : sort === 'new' ? (a, b) => b.t - a.t : (a, b) => BY[b.id].r - BY[a.id].r || value(b) - value(a));
          tb.innerHTML = `<div class="toolbar"><div class="fchips">${['all', ...RAR.map(r => r.k)].map(k => `<button class="fchip ${filt === k ? 'on' : ''}" data-f="${k}" style="--rc:${k === 'all' ? '#94a3b8' : RAR.find(r => r.k === k).color}">${k === 'all' ? 'All' : RAR.find(r => r.k === k).name}</button>`).join('')}</div>
            <select id="sort"><option value="value" ${sort === 'value' ? 'selected' : ''}>Highest value</option><option value="new" ${sort === 'new' ? 'selected' : ''}>Newest</option><option value="rar" ${sort === 'rar' ? 'selected' : ''}>Rarity</option></select>
            <button class="btn sec small" id="sellcommon">Sell all Common</button></div>
            <div class="cgrid">${list.map((it, i) => cardHTML(it, { i: Math.min(i, 24), badge: C.S.profile.showcase.includes(it.uid) ? `<span class="scb">${C.icon('star', 12)}</span>` : '' })).join('') || '<div class="empty-state">No cards yet — open a chest to start your collection.</div>'}</div>`;
        } else if (tab === 'boosts') {
          const A = C.S.active;
          tb.innerHTML = `<div class="card-box" style="margin-bottom:16px"><h3>Active now</h3>${Object.keys(A).length ? `<div class="actives">${Object.entries(A).map(([k, v]) => `<div class="active-b">${C.icon('bolt', 16)}<b>${C.BOOST_NAMES[k]}</b>${v.pct ? `<span>+${Math.round(v.pct * 100)}%</span>` : ''}<span class="muted">${v.left} rounds left</span></div>`).join('')}</div>` : '<span class="muted">No bonus cards active. Activate one below — they count down with every round you play.</span>'}</div>
            <div class="bgrid">${I.boosts.map(b => boostHTML(b, `<div class="btnrow" style="margin-top:10px"><button class="btn small" data-act="${b.uid}">Activate</button><button class="btn sec small" data-sellb="${b.uid}">Sell ${C.fmt(Math.round(BOOSTS[b.type].value * .6))}</button></div>`)).join('') || '<div class="empty-state">No bonus cards. They drop from chests and the daily wheel.</div>'}</div>`;
        } else if (tab === 'shop') {
          tb.innerHTML = `<div class="notice">${C.icon('tag', 20)}<div>Shop chests are pricey — on average a chest is worth about <b>70%</b> of its price. You're paying for the thrill (and the mythic chance).</div></div>
            <div class="chests">${Object.keys(CHESTS).map(k => { const ch = CHESTS[k]; return `<div class="chest" style="--cc:${ch.color}">${chestArt(k, 96)}<h3>${ch.name}</h3><div class="cnt" style="color:var(--gold)">${C.fmt(ch.price)}</div>
              <div class="odds">${RAR.map((r, i) => ch.odds[i] ? `<span style="--rc:${r.color}">${(ch.odds[i] * 100).toFixed(ch.odds[i] < .01 ? 2 : 1)}%</span>` : '').join('')}</div>
              <div class="btnrow"><button class="btn gold" data-buy="${k}">Buy</button><button class="btn sec small" data-buyopen="${k}">Buy &amp; open</button></div></div>`; }).join('')}</div>`;
        } else {
          const ownedIds = new Set(I.cards.map(c => c.id));
          tb.innerHTML = `<div class="progress big"><i style="width:${ownedIds.size / CARDS.length * 100}%"></i></div><p class="muted" style="margin:6px 0 16px">${ownedIds.size} of ${CARDS.length} cards discovered</p>
            ${RAR.slice().reverse().map(r => `<div class="secthead"><h2 style="color:${r.color}">${r.name}</h2><span>${CARDS.filter(c => c.rar === r && ownedIds.has(c.id)).length}/${r.n} · ${r.pts} pts each</span></div>
            <div class="cgrid sm">${CARDS.filter(c => c.rar === r).map(c => cardHTML({ id: c.id }, { owned: ownedIds.has(c.id) })).join('')}</div>`).join('')}`;
        }
      };
      root.addEventListener('click', e => {
        const t = e.target.closest('[data-tab]'); if (t) { e.preventDefault(); tab = t.dataset.tab; history.replaceState(null, '', '#/collection/' + tab); draw(); return; }
        const f = e.target.closest('[data-f]'); if (f) { filt = f.dataset.f; draw(); return; }
        const o = e.target.closest('[data-open]'); if (o) { openChest(o.dataset.open, draw); return; }
        const sc = e.target.closest('[data-sellc]'); if (sc) { const k = sc.dataset.sellc; if (inv().chests[k] > 0) { inv().chests[k]--; C.credit(CHESTS[k].sell, `Sold ${CHESTS[k].name}`); draw(); } return; }
        const buy = e.target.closest('[data-buy],[data-buyopen]'); if (buy) {
          const k = buy.dataset.buy || buy.dataset.buyopen, ch = CHESTS[k];
          C.ask(`Buy ${ch.name} for ${C.fmt(ch.price)}?`, 'Buy').then(ok => { if (!ok || !C.wager(ch.price)) return;
          inv().chests[k]++; C.save(); C.emit('change'); C.toast(`${ch.name} purchased`, 'gold');
          if (buy.dataset.buyopen) openChest(k, draw); else draw(); }); return;
        }
        const ac = e.target.closest('[data-act]'); if (ac) { activateBoost(ac.dataset.act); draw(); return; }
        const sb = e.target.closest('[data-sellb]'); if (sb) { sellBoost(sb.dataset.sellb); draw(); return; }
        if (e.target.closest('#sellcommon')) {
          const cs = inv().cards.filter(c => BY[c.id].rar.k === 'common' && !C.S.profile.showcase.includes(c.uid)); if (!cs.length) return C.toast('No common cards to sell');
          C.ask(`Sell ${cs.length} common cards?`, 'Sell').then(ok => { if (!ok) return; const tot = cs.reduce((a, c) => a + sellCard(c.uid, true), 0); C.toast(`Sold ${cs.length} cards for ${C.fmt(tot)}`, 'gold'); draw(); }); return;
        }
        const cc = e.target.closest('.ccard'); if (cc && !cc.classList.contains('unowned')) {
          const it = cc.dataset.uid ? inv().cards.find(c => c.uid === cc.dataset.uid) : { id: cc.dataset.id };
          if (it) cardDetail(it, draw);
        }
      });
      root.addEventListener('change', e => { if (e.target.id === 'sort') { sort = e.target.value; draw(); } });
      draw();
      const un = C.on('change', () => { if (tab === 'chests' || tab === 'boosts') { const y = scrollY; draw(); scrollTo(0, y); } });
      return () => un();
    }
  });

  /* ---------- Market page ---------- */
  C.page({
    id: 'market', title: 'Card Market', mount(root) {
      let filt = 'all', sortBy = 'price';
      const draw = () => {
        const ownedCount = {}; inv().cards.forEach(c => ownedCount[c.id] = (ownedCount[c.id] || 0) + 1);
        const idx = Array.from({ length: 85 }, (_, i) => { const t = Date.now() - (84 - i) * 2 * H; return CARDS.reduce((a, c) => a + trend(c, t), 0) / CARDS.length * 1000; });
        const ich = idx[idx.length - 1] / idx[idx.length - 13] - 1;
        const movers = CARDS.map(c => ({ c, ch: change24(c) })).sort((a, b) => b.ch - a.ch);
        let list = CARDS.slice(); if (filt !== 'all') list = list.filter(c => c.rar.k === filt);
        list.sort(sortBy === 'price' ? (a, b) => price(b) - price(a) : sortBy === 'gain' ? (a, b) => change24(b) - change24(a) : (a, b) => change24(a) - change24(b));
        root.innerHTML = C.head('market', 'Card Market', 'Live prices move like stocks — trend, momentum and supply in circulation all matter') + `
        <div class="mtop"><div class="card-box mindex"><h3>Lucky Card Index</h3><div class="ival"><b>${idx[idx.length - 1].toFixed(1)}</b> ${pct(ich)} <span class="muted">24h</span></div>${spark(idx, 520, 120, ich >= 0 ? '#34d399' : '#f0605d')}<div class="chartlbl"><span>7 days</span><span>now</span></div></div>
        <div class="card-box"><h3>Top gainers</h3>${movers.slice(0, 4).map(m => `<div class="mover" data-id="${m.c.id}"><i style="background:${m.c.rar.color}"></i><span>${C.esc(m.c.name)}</span><b>${pct(m.ch)}</b></div>`).join('')}
          <h3 style="margin-top:14px">Top losers</h3>${movers.slice(-4).reverse().map(m => `<div class="mover" data-id="${m.c.id}"><i style="background:${m.c.rar.color}"></i><span>${C.esc(m.c.name)}</span><b>${pct(m.ch)}</b></div>`).join('')}</div></div>
        <div class="toolbar"><div class="fchips">${['all', ...RAR.map(r => r.k)].map(k => `<button class="fchip ${filt === k ? 'on' : ''}" data-f="${k}" style="--rc:${k === 'all' ? '#94a3b8' : RAR.find(r => r.k === k).color}">${k === 'all' ? 'All' : RAR.find(r => r.k === k).name}</button>`).join('')}</div>
          <select id="msort"><option value="price">Price</option><option value="gain" ${sortBy === 'gain' ? 'selected' : ''}>Biggest gain</option><option value="loss" ${sortBy === 'loss' ? 'selected' : ''}>Biggest drop</option></select></div>
        <div class="card-box" style="padding:6px 8px;overflow:auto"><table class="tbl mtbl"><tr><th>Card</th><th>Rarity</th><th class="num">Price</th><th class="num">24h</th><th>7 days</th><th class="num">Supply</th><th class="num">Owned</th></tr>
        ${list.map(c => `<tr data-id="${c.id}"><td><div class="mname"><span class="mthumb" style="--rc:${c.rar.color};--hue:${c.hue}"><img src="${c.img}" alt="" loading="lazy" onerror="this.remove()"></span><b>${C.esc(c.name)}</b></div></td><td><span class="rtag" style="--rc:${c.rar.color}">${c.rar.name}</span></td><td class="num"><b>${C.fmt(price(c))}</b></td><td class="num">${pct(change24(c))}</td><td>${spark(priceHistory(c, 7, 42))}</td><td class="num">${supplyOf(c) != null ? supplyOf(c) : '—'}</td><td class="num">${ownedCount[c.id] || ''}</td></tr>`).join('')}</table></div>`;
      };
      root.addEventListener('click', e => {
        const f = e.target.closest('[data-f]'); if (f) { filt = f.dataset.f; draw(); return; }
        const row = e.target.closest('[data-id]'); if (row) { const mine = inv().cards.filter(c => c.id === row.dataset.id).sort((a, b) => value(b) - value(a))[0]; cardDetail(mine || { id: row.dataset.id }, draw); }
      });
      root.addEventListener('change', e => { if (e.target.id === 'msort') { sortBy = e.target.value; draw(); } });
      draw(); const tm = setInterval(draw, 60000), un = C.on('supply', draw);
      return () => { clearInterval(tm); un(); };
    }
  });

  /* meme cards shown on profiles open a read-only preview */
  document.addEventListener('click', e => {
    const cc = e.target.closest('.profile .ccard'); if (!cc || cc.classList.contains('unowned') || !BY[cc.dataset.id]) return;
    cardDetail({ id: cc.dataset.id, grade: cc.dataset.grade ? +cc.dataset.grade : undefined });
  });

  const memeUrl = (id, full) => full ? `https://i.imgflip.com/${id}.${PNG.has(id) ? 'png' : 'jpg'}` : `https://i.imgflip.com/4/${id}.jpg`;
  return { CARDS, BY, RAR, BOOSTS, CHESTS, cardDetail, memeUrl, price, value, sellPrice, summary, showcase, cardHTML, boostHTML, chestArt, grantChest, openChest, addItem, rollGrade, spark };
})();
