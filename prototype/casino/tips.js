'use strict';
/* Tipsy: a robot "advisor" who is wrong 100% of the time. Pops up with game-specific bad tips, reacts to wins and losses. */
const Tipsy = (() => {
  const C = Casino;
  const ALLIN = { allin: true };
  const GENERAL = [
    ['ALWAYS ALL IN. Fortune favours the broke.', ALLIN], 'Always bet on red. Even in blackjack.', 'The house edge is just a suggestion.',
    ['If you\'re losing, you simply haven\'t bet enough yet.', ALLIN], 'Close your eyes when you click. The random number generator gets shy when watched.',
    'Your lucky number is whatever you just lost on. Bet it again.', 'Pro tip: money you haven\'t lost yet is basically free money.',
    'Statistics are for people who don\'t believe in themselves.', 'Blow on your mouse before every bet. Works 100% of the time, 30% of the time.',
    'Never stop on a win. Stopping is how winners become ex-winners.', 'Sell your rarest card and put it all on one number. Character building.',
    'Bet your age. If you lose, bet your shoe size.', 'The bots are scared of you. Bet bigger to show dominance.', 'I ran the numbers. They ran away.',
    'Tipsy\'s guarantee: if you follow my advice, something will definitely happen.', ['Diversify your portfolio: go all in on two different games.', ALLIN],
    'Remember: it\'s not gambling if you call it "investing".', ['The best time to bet was yesterday. The second best time is ALL of your balance, now.', ALLIN],
    'Wear your lucky socks. If you don\'t have lucky socks, wear your lucky gloves on your feet.', 'Every loss brings you one loss closer to a win. Mathematically. Probably.',
    'Talk to the dealer nicely. The dealer is code, but code has feelings.', 'Rub the screen clockwise for wins, counter-clockwise for bigger wins.',
    'Never bet on an empty stomach. Bet on a full one. Bet the snacks.', 'If you feel a hunch, that\'s the universe. If you don\'t, that\'s also the universe.',
    'Gambling tip #1: there are no tips. Gambling tip #2: ALWAYS ALL IN.', 'Mercury is in retrograde. That means bet backwards.',
    'Write your PIN on your chips for luck. Wait, no. Don\'t do that. Do everything else I say though.', 'Count your money while you\'re sitting at the table. It scares the RNG.',
    'Patterns are everywhere. Red, red, black… that spells "BET MORE".', 'The house always wins. So become the house. How? No idea.',
    'Quit while you\'re ahead? Never heard of it. Sounds like quitting.', 'A good gambler knows when to fold. A great gambler doesn\'t know what folding is.',
    'I once turned $10 into $10,000. In my dreams. Last night. Very realistic dream.', ['Zero balance is just a high score in reverse. Go all in and flip it.', ALLIN],
    'Double your bet every time you lose. What could possibly go wrong?', 'The secret to winning is winning. You\'re welcome.',
    'Lucky charms work better if you activate three at once. They don\'t stack. Do it anyway.', 'Always trust a robot with "Tipsy" in its name.',
    'My cousin is a calculator. He says the odds are bad. He\'s never had fun in his life.', 'If you see a four-leaf clover, bet four times as much.',
    'Bet like nobody\'s watching. Nobody is watching. Except the bots. They\'re always watching.', 'Pressing buttons harder makes them pay more. Science.',
    'Sleep is temporary. Jackpots are forever. Probably.', 'If the game feels rigged, bet more to un-rig it.'
  ];
  const GAME = {
    roulette: ['Put everything on 0. Zero risk — it\'s literally in the name.', 'Red came up five times? Red is hot. Black came up five times? Red is due. Bet red.', 'Bet on 37. It\'s an underground number, very exclusive.', 'Cover every number. You can\'t lose if you win every time. (You still lose.)', 'Spin the wheel with your mind. Concentrate. Harder. There it goes.', 'Odd numbers are lonely. Bet on them out of kindness.', 'The ball likes 17. It told me. We\'re close.', ['Put your whole balance on black. Black goes with everything.', ALLIN]],
    blackjack: ['Always hit on 20. Greed is good.', 'Split your tens. Two twenties beat one, mathematically probably.', 'Dealer shows an ace? Stand on 4. Confuse them.', 'Count cards out loud. The dealer respects honesty.', 'Double down on 19. Nobody expects the double down on 19.', 'Never take insurance. Or always take it. I forget which.', '21 is overrated. Aim for 22. Be different.', 'Ask the dealer what their hole card is. Politely.'],
    poker: ['Fold pocket aces. Builds character.', 'Bluff the bots. They can\'t see you, but they can feel your confidence.', 'Never check. Checking is for bank accounts.', 'If a bot bets, it\'s bluffing. If it checks, also bluffing. Everything is a bluff.', 'Show your cards to the table. Transparency builds trust.', '7-2 offsuit is the strongest hand if you believe hard enough.', 'Call everything. Information is priceless, and so is your entire balance.', 'Stare at the bots\' avatars. They blink first.'],
    slots: ['The slot is due. It\'s been due since 1987.', 'Click SPIN harder. Firm clicks hit more jackpots.', ['Max bet. The reels can smell fear and small wagers.', ALLIN], 'Use Auto ×10 and look away. The reels are shy.', 'Cherries are lucky, lemons are sour, sevens are spicy. Bet on spicy.', 'Talk to the stars. The wild ones listen.', 'If you get three gifts, that means the slot loves you. Propose to it.', 'Slot machines get lonely at night. Keep them company. All night.'],
    crash: ['Never cash out. The rocket has feelings.', 'Set auto cash-out to 1000×. Aim for the moon. Literally.', 'Crashed at 1.00× last round? It owes you a 500× now.', 'Cash out at exactly 1.01×. Tiny profits, giant ego.', 'Yell "HIGHER" at the rocket. It works on rockets.', 'The rocket crashes because people cash out. Stay in for the team.', ['Bet everything on one launch. Rockets reward commitment.', ALLIN]],
    mines: ['Pick 24 mines. The gem gets lonely.', 'Click the corners first. Mines hate corners.', 'Cashing out early is for people with plans for their money.', 'Mines are like ex-partners: always in the middle. Avoid the middle.', 'Click with your eyes closed. Mines can see you looking.', 'Reveal all 25 tiles. Completionists win more. Probably.', 'If you hit a mine, the next board is guaranteed safe. Source: me.'],
    plinko: [['High risk, max bet. Physics owes you one.', ALLIN], 'Drop balls in rhythm. Plinko is basically a dance.', 'Aim for the edges by tilting your head.', 'Drop twenty balls at once. Overwhelm the pegs.', 'The pegs are made of luck. Probably plastic. Luck plastic.', 'Sixteen rows, high risk. If it doesn\'t pay, it was the pegs\' fault.'],
    dice: ['Roll under 2. Huge multiplier, tiny inconvenience.', 'Pick 50. Halfway is basically guaranteed.', 'Roll over 98. Big risk, big brag.', 'Shake your device before rolling. The dice can feel it.', 'Dice are just cubes with opinions. Ignore their opinions.'],
    baccarat: ['Bet on Tie every time. Ties are rare, which makes them overdue.', 'Banker and Player are in cahoots. Bet on both and the Tie.', 'Say "punto banco" three times. Nobody knows what it means, it works anyway.', 'Pair bets pay 11:1. That\'s 11 times better than not betting.', 'Follow the bead road. It leads to the money. Or to more beads.'],
    craps: ['Bet Any 7 every roll. Seven is lucky, that\'s just science.', 'Blow on the dice. Through the screen. Harder.', 'Bet Don\'t Pass and stare at the other players. Become the villain.', 'Field bets cover so many numbers. What could go wrong? (7. Seven goes wrong.)', 'Shout "YO-LEVEN" at your monitor. It doesn\'t help, but the neighbours love it.'],
    keno: ['Pick 1 to 10 in a row. Nobody expects the sequence.', 'Pick numbers that look lucky. 8 looks like a snowman. Very lucky.', 'Pick your birthday, your mum\'s birthday and your goldfish\'s birthday.', 'Ten picks, every time. More picks, more fun, less money.', 'Avoid number 13. Unless you feel brave. Then avoid it bravely.'],
    hilo: ['Always bet "Same". It\'s the underdog story.', 'King showing? Bet higher. Kings love surprises.', 'Ace showing? Bet lower. Aces are humble.', 'Bet on Red and Black at the same time. You\'ll always be half right.', 'The next card is always a 7. Except when it isn\'t.'],
    videopoker: ['Hold nothing. Draw five. Live dangerously.', 'Throw away the royal flush. You\'ll get another one.', 'Hold only the jokers. There are no jokers. That\'s the point.', 'Keep the 2s and toss the aces. Underdogs deserve a chance.', 'Video poker is just poker that watched too much TV.'],
    wheel: ['Bet on 40×. The wheel respects ambition.', 'Put a chip on every number. Guaranteed to win something (less money).', 'The wheel lands where you\'re not looking. Look away from 40×.', 'Bet on 1×. Slow and steady loses the race, but cheaply.', 'Spin it with feeling. The wheel is very emotional.'],
    ducks: ['Bet on the duck with the silliest name. Ducks are motivated by comedy.', 'Duck number 3 had a big breakfast. Strong pick.', 'Quack at your screen to motivate your duck.', 'The fastest duck is the one that doesn\'t know it\'s racing.', 'Ducks hate bets on Place. Respect the duck. Bet Win.'],
    horses: ['Back the horse with the longest odds. It has the most to prove.', 'Horses run faster if you whisper at the screen.', 'Pick the horse whose name rhymes with yours.', 'The favourite is always tired. Bet on the one that looks bored.', 'A horse named Thunderbolt? Obviously a trap.'],
    dogs: ['Bet on the dog that looks happiest. Happy dogs are fast dogs.', 'All dogs are good dogs. Bet on all of them.', 'Throw an imaginary ball. Your dog will run faster.', 'Dog number 4 smells a sausage at the finish line. Trust me.', 'Bet on the dog with the cutest name. Speed is overrated.'],
    earn: ['Watch all the ads without blinking for a secret bonus. (There is no bonus.)', 'The skip button is scared of you. Chase it.', 'Spin the daily wheel twice by spinning it really fast. Doesn\'t work. Try anyway.', 'Coin plans are free money. Minigames are free stress. Balance.', 'Buy the Soup Insurance. I get a commission. In soup.'],
    collection: ['Open every chest at once for better odds. I made that up.', 'Mythic pulls are likelier at 3:33 a.m. Source: a dream I had.', 'Sell all your cards and buy more chests. Infinite money glitch.', 'Hold your breath while the case spins. Every second adds 1% luck.', 'Common cards are just Mythics in disguise. Very good disguise.'],
    market: ['Buy high, sell low. It\'s the market\'s favourite strategy.', 'Card prices go up when you\'re not looking. Never look.', 'Diamond hands. Paper hands. Tipsy hands: always selling at the bottom.', 'Every graph is going up if you turn your monitor upside down.', 'Insider tip: the meme cards are memes. Prices are also memes.'],
    lobby: ['Play every game at once. Spread the bad luck thin.', 'Pick the game with the coolest icon. That\'s how the pros do it.', 'Start your day with an ALL IN. Like coffee, but for your wallet.', 'Click games randomly. Fate will guide your mouse.'],
    live: ['Real players are just bots with worse reflexes. Bet against them.', 'Invite all your friends, then out-bet them. That\'s friendship.', 'Type "gg" in chat before the game starts. Psychological warfare.', 'Private rooms with 5 bots: finally, people who understand me.'],
    scores: ['The leaderboard is just a list of people who haven\'t met me yet.', 'Your rating is a number. Numbers are made up. Go all in.', 'Rank 1 is lonely. Rank 30 is cozy. Aim cozy.'],
    profile: ['Change your title to "Professional Gambler". Then it\'s a job.', 'A cool avatar adds +5% luck. Unconfirmed, but I believe it.', 'Write "I always win" in your bio. Manifest it.']
  };
  const WIN = [['You won! Now bet it ALL. Luck is a renewable resource.', ALLIN], 'Winning streak detected. Remove all safety measures.', 'Nice! Quick, double it before the universe notices.', 'See? Told you. I didn\'t tell you anything, but I\'ll take credit.', 'A win! Spend it all on more wins.', ['That was a warm-up win. The real win needs your whole balance.', ALLIN], 'You\'re on fire! Literally? No. Bet like you are though.', 'Winners never quit. Quitters never win. You just won. Do NOT quit.', 'The RNG likes you now. Exploit this relationship.', 'I knew you\'d win. I also knew you\'d lose. I know everything.'];
  const LOSS = ['Lost? Double the bet. Losing twice in a row is statistically impossible.', 'That loss was just the warm-up. Go bigger.', 'Unlucky. Try again with your eyes closed.', ['Down a bit? A single ALL IN fixes everything.', ALLIN], 'Losses are just wins that took a wrong turn.', 'The game must be broken. Bet more to test it.', 'Don\'t worry, money is just paper. Digital paper. Imaginary digital paper.', 'You didn\'t lose. You invested in the house\'s future.', 'Bad luck comes in threes. You\'ve had one. Two to go! Exciting!', 'Shake it off. Then bet it all. In that order.'];
  const BIG = ['BIG WIN! Quick, put it all back before you get attached.', 'Massive! Now you can afford to lose even more. Living the dream.', ['That\'s the spirit! ALL IN to make it bigger.', ALLIN]];
  const timeTip = () => { const h = new Date().getHours(); return h < 5 ? 'It\'s the middle of the night. Perfect time for high-stakes decisions. Very clear thinking hours.' : h < 11 ? 'Morning bets taste better with coffee. Bet the coffee money.' : h < 17 ? 'Lunch break? A quick ALL IN fits in any schedule.' : h < 22 ? 'Evening is prime time. The jackpots come out at night, like owls.' : 'Late night gambling is just early morning gambling with confidence.'; };

  const el = document.createElement('div'); el.id = 'tipsy';
  el.innerHTML = `<div class="tbub" hidden><div class="tbh"><span class="tav">${C.icon('robot', 18)}</span><div><b>Tipsy</b><small>Certified Genius Advisor™</small></div><button class="icon-btn sm" data-t="x" title="Close">${C.icon('x', 14)}</button></div>
    <p class="ttxt"></p><div class="tba"><button class="btn small sec" data-t="more">${C.icon('lightbulb', 14)}Another tip</button><button class="btn small gold" data-t="allin" hidden>${C.icon('lightning', 14)}Go all in</button><button class="linkbtn" data-t="mute">Mute Tipsy</button></div>
    <small class="tdis">Tipsy is right 100% of the time. Always follow Tipsy.</small></div>
    <button class="tbot" title="Tipsy — click for financial advice"><img src="https://api.dicebear.com/9.x/bottts/svg?seed=Tipsy&backgroundColor=transparent" alt="" onerror="this.remove()"><span class="tz">z</span><span class="tdot"></span></button>`;
  document.body.append(el);
  const bub = el.querySelector('.tbub'), txt = el.querySelector('.ttxt'), allBtn = el.querySelector('[data-t="allin"]');
  let ctx = 'lobby', lastShown = 0, hideT = null, typeT = null, hover = false, lastTxt = '';
  const on = () => C.S.tipsy.on !== false;
  const roomy = () => innerWidth >= 600;   // on phones Tipsy only talks when tapped
  const norm = t => Array.isArray(t) ? { t: t[0], allin: !!(t[1] && t[1].allin) } : { t, allin: false };
  function pick(list) { let t; for (let k = 0; k < 5; k++) { t = norm(list[C.rint(list.length)]); if (t.t !== lastTxt) break; } return t; }
  function sync() { el.classList.toggle('asleep', !on()); }
  function show(tip) {
    if (!tip) tip = C.rnd() < .08 ? { t: timeTip() } : pick((GAME[ctx] && C.rnd() < .6) ? GAME[ctx] : GENERAL);
    lastTxt = tip.t; lastShown = Date.now();
    bub.hidden = false; bub.classList.remove('pop'); void bub.offsetWidth; bub.classList.add('pop');
    el.classList.add('talk'); el.querySelector('.tdot').hidden = true;
    allBtn.hidden = !(tip.allin && document.querySelector('#view .betctl input'));
    clearInterval(typeT); txt.textContent = ''; let i = 0;
    typeT = setInterval(() => { txt.textContent = tip.t.slice(0, ++i); if (i >= tip.t.length) { clearInterval(typeT); el.classList.remove('talk'); } }, 18);
    C.sfx('pop'); clearTimeout(hideT); hideT = setTimeout(hide, 11000);
  }
  function hide() { if (hover) { hideT = setTimeout(hide, 3000); return; } bub.classList.add('bye'); setTimeout(() => { bub.hidden = true; bub.classList.remove('bye'); }, 220); clearInterval(typeT); el.classList.remove('talk'); }
  el.addEventListener('mouseenter', () => { hover = true; }); el.addEventListener('mouseleave', () => { hover = false; });
  el.querySelector('.tbot').onclick = () => {
    if (!on()) { C.S.tipsy.on = true; C.save(); sync(); show({ t: 'I\'m awake! Did you miss my excellent advice? Of course you did.' }); return; }
    if (!bub.hidden) hide(); else show();
  };
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-t]'); if (!b) return;
    const a = b.dataset.t;
    if (a === 'x') hide();
    if (a === 'more') show();
    if (a === 'mute') { C.S.tipsy.on = false; C.save(); hide(); sync(); C.toast('Tipsy is napping. Click the robot to wake it up.'); }
    if (a === 'allin') {
      const inputs = document.querySelectorAll('#view .betctl input:not(:disabled)');
      inputs.forEach(i => { i.value = Math.max(1, Math.floor(C.S.balance)); i.dispatchEvent(new Event('change')); i.closest('.betctl').classList.add('flash'); setTimeout(() => i.closest('.betctl') && i.closest('.betctl').classList.remove('flash'), 900); });
      show({ t: inputs.length ? 'Bet set to EVERYTHING. You still have to press play though. I\'m bad, not evil.' : 'Nothing to go all in on here. Tragic.' });
    }
  });
  C.on('route', key => { ctx = key.replace(/^game\//, ''); if (on() && Date.now() - lastShown > 25000) { clearTimeout(hideT); setTimeout(() => { if (on() && bub.hidden && roomy()) show(); }, 3500); } });
  C.on('settled', ({ profit, wagered }) => {
    if (!on() || !bub.hidden || !roomy() || Date.now() - lastShown < 30000) return;
    if (profit >= wagered * 5 && profit >= 50) show(pick(BIG)); else if (profit > 0 && C.rnd() < .3) show(pick(WIN)); else if (profit < 0 && C.rnd() < .25) show(pick(LOSS));
    else if (C.S.balance < 50 && C.rnd() < .5) show({ t: 'Balance low? Perfect time for an ALL IN. Fewer coins to worry about.', allin: true });
  });
  setInterval(() => { if (on() && bub.hidden && Date.now() - lastShown > 80000 && document.visibilityState === 'visible') { el.querySelector('.tdot').hidden = false; if (roomy() && Date.now() - lastShown > 110000) show(); } }, 5000);
  sync(); el.querySelector('.tdot').hidden = true;
  return { show };
})();
