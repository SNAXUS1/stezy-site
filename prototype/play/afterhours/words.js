// Afterhours in English and Lithuanian: every word on screen, plus dates, durations and plurals the way each language
// writes them. Lithuanian: "9 val. 30 min.", "Penktadienis, spalio 16 d.", "2026 m. spalis", plural endings by number.

let lang = 'en';
export const getLang = () => lang;
export function setLang(pref) {
  const nav = typeof navigator === 'undefined' ? {} : navigator;
  const phone = String((nav.languages && nav.languages[0]) || nav.language || 'en').toLowerCase();
  lang = pref === 'lt' || pref === 'en' ? pref : phone.startsWith('lt') ? 'lt' : 'en';
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
  return lang;
}
const pad = n => String(n).padStart(2, '0');

// ---------------------------------------------------------------- Lithuanian plurals: 1 diena, 2 dienos, 10 dienų
export function ltPlural(n, one, few, many) {
  const a = Math.abs(n) % 10, b = Math.abs(n) % 100;
  if (a === 1 && b !== 11) return one;
  if (a >= 2 && a <= 9 && (b < 11 || b > 19)) return few;
  return many;
}

// ---------------------------------------------------------------- calendar words
const WD = {
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  lt: ['sekmadienis', 'pirmadienis', 'antradienis', 'trečiadienis', 'ketvirtadienis', 'penktadienis', 'šeštadienis'],
};
const WD_SHORT = { en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], lt: ['Sk', 'Pr', 'An', 'Tr', 'Kt', 'Pn', 'Št'] };
const WD_LETTER = { en: ['S', 'M', 'T', 'W', 'T', 'F', 'S'], lt: ['S', 'P', 'A', 'T', 'K', 'P', 'Š'] };
const MO = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  lt: ['sausis', 'vasaris', 'kovas', 'balandis', 'gegužė', 'birželis', 'liepa', 'rugpjūtis', 'rugsėjis', 'spalis', 'lapkritis', 'gruodis'],
};
// "spalio 16 d.", "spalio mėnesį": the genitive
const MO_GEN = ['sausio', 'vasario', 'kovo', 'balandžio', 'gegužės', 'birželio', 'liepos', 'rugpjūčio', 'rugsėjo', 'spalio', 'lapkričio', 'gruodžio'];
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

export const weekday = (wd, short) => short ? WD_SHORT[lang][wd] : (lang === 'lt' ? cap(WD.lt[wd]) : WD.en[wd]);
/** Monday-first single letters for the week strip and the calendar. */
export const weekLetters = () => [1, 2, 3, 4, 5, 6, 0].map(i => WD_LETTER[lang][i]);
export const monthName = m => lang === 'lt' ? cap(MO.lt[m]) : MO.en[m];
/** "Friday, 16 October" / "Penktadienis, spalio 16 d." */
export function day(t) {
  const d = new Date(t);
  return lang === 'lt' ? `${cap(WD.lt[d.getDay()])}, ${MO_GEN[d.getMonth()]} ${d.getDate()} d.` : `${WD.en[d.getDay()]}, ${d.getDate()} ${MO.en[d.getMonth()]}`;
}
/** "Fri 16" / "Pn 16" */
export const dayShort = t => { const d = new Date(t); return `${WD_SHORT[lang][d.getDay()]} ${d.getDate()}`; };
/** "October 2026" / "2026 m. spalis" */
export const month = t => { const d = new Date(t); return lang === 'lt' ? `${d.getFullYear()} m. ${MO.lt[d.getMonth()]}` : `${MO.en[d.getMonth()]} ${d.getFullYear()}`; };
/** "in October" / "spalio mėnesį" */
export const inMonth = (m, capital) => lang === 'lt' ? `${capital ? cap(MO_GEN[m]) : MO_GEN[m]} mėnesį` : `in ${MO.en[m]}`;
/** "Week 42 · 12–18 Oct" / "42 sav. · spalio 12–18" */
export function weekLabel(n, from, to) {
  return lang === 'lt' ? `${n} sav. · ${range(from, to)}` : `Week ${n} · ${range(from, to)}`;
}
/** "16 October" / "spalio 16 d." */
export const date = t => { const d = new Date(t); return lang === 'lt' ? `${MO_GEN[d.getMonth()]} ${d.getDate()} d.` : `${d.getDate()} ${MO.en[d.getMonth()]}`; };
/** "12–18 Oct", "28 Sep – 4 Oct" / "spalio 12–18 d.", "rugsėjo 28 d. – spalio 4 d." */
export function range(from, to) {
  const a = new Date(from), b = new Date(to), same = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  if (lang === 'lt') return same ? `${MO_GEN[b.getMonth()]} ${a.getDate()}–${b.getDate()} d.` : `${MO_GEN[a.getMonth()]} ${a.getDate()} d. – ${MO_GEN[b.getMonth()]} ${b.getDate()} d.`;
  const m = d => MO.en[d.getMonth()].slice(0, 3);
  return same ? `${a.getDate()}–${b.getDate()} ${m(b)}` : `${a.getDate()} ${m(a)} – ${b.getDate()} ${m(b)}`;
}
/** "9 days" / "9 dienos" */
export const daysN = n => lang === 'lt' ? `${n} ${ltPlural(n, 'diena', 'dienos', 'dienų')}` : `${n} day${n === 1 ? '' : 's'}`;
// ---------------------------------------------------------------- money, in euros
const fmt = () => new Intl.NumberFormat(lang === 'lt' ? 'lt-LT' : 'en-IE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** "€240.50" / "240,50 €" */
export const money = v => fmt().format(v || 0);
/** The big amount: whole euros large, cents and the sign small. */
export function bigMoney(v) {
  return fmt().formatToParts(v || 0).map(p => p.type === 'integer' || p.type === 'group' || p.type === 'minusSign' ? p.value : `<small>${p.value.replace(/\s/g, '&#8239;')}</small>`).join('');
}

// ---------------------------------------------------------------- durations
/** 600 → "10 h" / "10 val.", 570 → "9 h 30" / "9 val. 30 min.", 45 → "45 min" / "45 min." */
export function dur(m) {
  m = Math.max(0, Math.round(m));
  const h = Math.floor(m / 60), r = m % 60;
  if (lang === 'lt') {
    if (!h) return r ? `${r} min.` : '0 val.';
    return r ? `${h} val. ${pad(r)} min.` : `${h} val.`;
  }
  if (!h) return r ? `${r} min` : '0 h';
  return r ? `${h} h ${pad(r)}` : `${h} h`;
}
/** The big number, with its units small. */
export function bigDur(m) {
  m = Math.max(0, Math.round(m));
  const h = Math.floor(m / 60), r = m % 60, H = lang === 'lt' ? 'val.' : 'h', M = lang === 'lt' ? 'min.' : 'm', MIN = lang === 'lt' ? 'min.' : 'min';
  if (!h) return r ? `${r}<small>${MIN}</small>` : `0<small>${H}</small>`;
  return `${h}<small>${H}</small>${r ? `<span class="sep"></span>${pad(r)}<small>${M}</small>` : ''}`;
}
/** Hours with one decimal for a spreadsheet: "9.5" / "9,5". */
export const dec = m => { const v = (Math.round(m / 6) / 10).toString(); return lang === 'lt' ? v.replace('.', ',') : v; };
/** "in 13 days" / "per 13 dienų" */
export const inDays = n => lang === 'lt' ? `per ${n} ${ltPlural(n, 'dieną', 'dienas', 'dienų')}` : `in ${n} day${n === 1 ? '' : 's'}`;

// ---------------------------------------------------------------- Lithuanian public holidays, by their English name
const HOL_LT = {
  "New Year's Day": 'Naujieji metai', 'Day of the Restoration of the State': 'Valstybės atkūrimo diena', 'Day of the Restoration of Independence': 'Nepriklausomybės atkūrimo diena',
  'Easter Sunday': 'Velykos', 'Easter Monday': 'Antroji Velykų diena', 'Labour Day': 'Tarptautinė darbo diena', "Mother's Day": 'Motinos diena', "Father's Day": 'Tėvo diena',
  "St John's Day": 'Joninės', 'Statehood Day': 'Valstybės diena', 'Assumption Day': 'Žolinė', "All Saints' Day": 'Visų šventųjų diena', "All Souls' Day": 'Vėlinės',
  'Christmas Eve': 'Kūčios', 'Christmas Day': 'Kalėdos', 'Second Day of Christmas': 'Antroji Kalėdų diena',
};
export const holiday = en => en == null ? null : lang === 'lt' ? (HOL_LT[en] || en) : en;

// ---------------------------------------------------------------- everything else on screen
const EN = {
  today: 'Today', log: 'Log', monthTab: 'Month', settings: 'Settings', addDay: 'Add a day',
  workday: 'Workday', afterFrom: 'After hours from {t}', allAfter: 'All after hours',
  notStarted: 'Not started yet', lateNight: 'Late night', workingSince: 'Working since {t}', afterSince: 'After hours since {t}', onBreak: 'On a break · {d}', done: 'Done · {a} – {b}',
  normal: 'normal', afterHours: 'after hours', breaksFact: 'Breaks <b>{d}</b>', endNowFact: 'End now and it counts to <b>{t}</b>', allTodayFact: 'Every hour today counts as <b style="color:var(--dusk)">after hours</b>',
  thisWeek: 'This week', weekAfter: '{d} after hours',
  start: 'Start work', end: 'End day', brk: 'Break', back: 'Back to work',
  startedToast: 'Started. Counting from {t}', change: 'Change', backAfter: 'Back to work after {d}', backQuick: 'Back to work. That break was too short to count', breakStarted: 'Break started',
  savedToast: 'Saved: {d}', savedAfter: 'Saved: {d}, {a} after hours', saveFail: 'Couldn\'t save. Is the phone\'s storage full?',
  endTitle: 'End your day', startL: 'Start', endL: 'End', now: 'now', upFrom: 'up from {t}', downFrom: 'down from {t}',
  breaksToday: 'Breaks today', tookBreaks: 'You took {d} of breaks with the Break button. Anything else?', noMore: 'No more', plus: '+{d}',
  none: 'None', howCounts: 'How it counts', note: 'Note', notePh: 'Optional, like what you worked on', notePh2: 'Optional',
  keep: 'Keep working', saveDay: 'Save day', resNormal: '{d} normal', resAfter: '{d} after hours', resBreak: '{d} break',
  startedEarlier: 'Started earlier?', whenStart: 'When did you start?', setReal: 'Set the time you really started.', changeStart: 'Change the start of today\'s work.',
  countsRounded: 'counts from {t} (rounded)', countsHere: 'counts from here', cancel: 'Cancel', startBtn: 'Start', save: 'Save', startChanged: 'Start changed to {t}',
  thisDay: 'This day', hours: 'Hours', breaks: 'Breaks', timedNote: '{d} taken with the Break button. Pick a length to replace it.', del: 'Delete',
  weekendAll: 'weekend, all after hours', holAll: '{h}, all after hours', added: 'Added {day}: {d}', saved: 'Saved', deleted: 'Day deleted', undo: 'Undo',
  noBreak: 'no break', breakLen: '{d} break', weekend: 'Weekend', afterShort: '{d} after',
  emptyLogT: 'No days {m}', emptyLogP: 'Days you work show up here. Forgot one? Add it with the + button.',
  workedIn: 'Worked {m}', afterOnWorkdays: 'After {t} on workdays', weekends: 'Weekends', holidays: 'Public holidays', breaksTaken: 'Breaks taken', avgDay: 'Average day',
  sheet: 'Spreadsheet', shareSum: 'Share summary', copied: 'Summary copied', emptyMonthT: 'Nothing {m} yet', emptyMonthP: 'Your month adds up here as you work: normal hours, after hours, weekends and holidays.',
  hoursTitle: 'Hours, {m}', sumText: '{m}: {d} {days}\nNormal: {n}\nAfter hours: {a} (after {t}: {e}, weekends: {w}, holidays: {h})',
  setSub: 'How your hours are counted. Changes apply to days you haven\'t saved yet.',
  sAfter: 'After hours', sStarts: 'Starts at', sStartsS: 'Work after this on a workday counts as after hours.', sWeekends: 'Weekends', sWeekendsS: 'All of Saturday and Sunday counts as after hours.',
  sHol: 'Public holidays', sHolS: 'Lithuania\'s public holidays count like weekends.', sEarly: 'Early mornings', sEarlyS: 'Work before this counts as after hours too.',
  sRound: 'Rounding', sRoundTo: 'Round times to', exact: 'Exact', m15: '15 min', m30: '30 min', hourW: 'Hour', sStartR: 'Start rounds', sEndR: 'End rounds', nearest: 'Nearest', down: 'Down', up: 'Up',
  ex: 'A start at 07:52 counts from <b>{a}</b>, an end at 18:48 counts to <b>{b}</b>.', exExact: 'Times count exactly as you tap them.',
  sBreaks: 'Breaks', sAsk: 'Ask when I end the day', sAskS: 'So a break you forgot to tap still counts.', sUsual: 'Usual break', sUsualS: 'Picked for you in that question.',
  sRem: 'Reminders', sRemWeb: 'Reminders work in the Android app.', sRemStart: 'Remind me to start', sRemStartS: 'If you haven\'t started by then.', sDays: 'On these days',
  sRemLate: 'If I forget to end', sRemLateS: 'Asks whether you\'re still at work.', sRemBreak: 'Break reminder', sRemBreakS: 'If you haven\'t taken one by then.',
  sLook: 'Look', likePhone: 'Like the phone', dark: 'Dark', light: 'Light', sLang: 'Language',
  sData: 'Your hours', backup: 'Save a backup', backupS: 'A file with every day, to keep somewhere safe.', restore: 'Restore a backup', restoreS: 'Adds the days from a backup file.',
  wipe: 'Delete everything', wipeSure: 'Tap again to delete every day', wiped: 'Every day deleted', restored: 'Days added from the backup: {n}', restoredNone: 'Nothing new in that backup', notBackup: 'That file isn\'t an Afterhours backup.',
  backupTitle: 'Afterhours backup',
  about: '<b>Afterhours {v}</b> by STEZY<br>Everything stays on this phone. No account, no ads.<br>stezy.lt<br>Font: Geist (SIL Open Font License)',
  notifOff: 'Notifications are off for Afterhours. Turn them on in Android settings, under Apps.',
  wTitle: 'Your evenings <em>count.</em>', wLead: 'Afterhours keeps your work hours, and counts everything after 18:00 and at weekends on its own.',
  w1: 'One tap to start and end', w1s: 'No fixed schedule. Times round to the hour, the way you set them.', w2: 'After hours, counted for you', w2s: 'Evenings, weekends and Lithuanian public holidays, kept apart from normal hours.',
  w3: 'Hard to forget', w3s: 'It asks about breaks when you end the day, and reminds you if you forget to start or end.', wGo: 'Get started', wFine: 'Everything stays on your phone. No account.',
  nStartT: 'Started work?', nStartB: 'Tap to start your day. It can count from when you really started.', nLateT: 'Still at work?', nLateB: 'Tap to end your day, so no hours count by mistake.',
  nYestT: 'Yesterday is still running', nYestB: 'Tap to set when you finished.', nBackT: 'Still on your break?', nBackB: 'Tap if you\'re back at work.',
  nBrkT: 'Time for a break?', nBrkB: 'Tap to start it, so it\'s counted right.', forgot: 'Your day was still running. When did you finish?', channel: 'Reminders', channelD: 'Start, end and break reminders',
  prevMonth: 'Previous month', nextMonth: 'Next month', dialLabel: 'Today, from 6 in the morning to midnight',
  payTab: 'Pay', owed: 'Owed to you', allPaid: 'All paid up', allPaidS: 'New after hours will add up here.', forHours: 'for {d} after hours', notPaidHours: 'after hours not paid yet', since: 'since {day}',
  rateRow: 'After-hours pay', perHour: '{v} / h', noRateT: 'Add your hourly pay', noRateS: 'See what your after hours are worth as you work.', paidBtn: 'They paid me', share: 'Share', history: 'Paid before',
  daysRow: 'Days with after hours', paidT: 'Paid up to which day?', paidS: 'That day and every day before it turn grey and stop counting here.', paidUpToLong: 'Up to {day}', paidWill: '{n} · {d} after hours',
  markPaid: 'Mark as paid', paidToast: 'Paid up to {day}', nothingToPay: 'No finished days to mark yet', payoutRemoved: 'Payout removed', paidSep: 'Paid up to {day}',
  paidNote: 'Before your last payout, so this day counts as paid.', rateT: 'After-hours pay', rateS: 'What you get for one hour after hours. Only you see it.', rateEx: '10 h after hours = {v}',
  rateBad: 'Type an amount, like 12.50', rateClear: 'Remove', rateSaved: 'Saved: {v} an hour', hUnit: 'h', owedText: 'After hours not paid yet: {d} since {day}{money}.',
  emptyPayT: 'Nothing here yet', emptyPayP: "Once you've worked some after hours, they show up here with what they're worth.",
  updT: 'Afterhours {v} is out', updGet: 'Get it', updCard: 'A new version is out: {v}', updCardS: 'Tap to download it. Your hours stay when you install it over this one.',
  sUpd: 'Check for new versions', sUpdS: 'Once a day, on stezy.lt. Nothing about you is sent.',
  csv: ['Date', 'Day', 'Start', 'End', 'Break (min)', 'Normal (h)', 'After {t} (h)', 'Weekend (h)', 'Holiday (h)', 'Total (h)', 'Note'],
  brkChips: ['None', '15 min', '30 min', '45 min', '1 hour'], moreChips: ['No more', '+15 min', '+30 min', '+1 hour'],
};
const LT = {
  today: 'Šiandien', log: 'Istorija', monthTab: 'Mėnuo', settings: 'Nustatymai', addDay: 'Pridėti dieną',
  workday: 'Darbo diena', afterFrom: 'Viršvalandžiai nuo {t}', allAfter: 'Visa diena – viršvalandžiai',
  notStarted: 'Dar nepradėta', lateNight: 'Vėlyva naktis', workingSince: 'Dirbate nuo {t}', afterSince: 'Viršvalandžiai nuo {t}', onBreak: 'Pertrauka · {d}', done: 'Baigta · {a}–{b}',
  normal: 'įprasto darbo', afterHours: 'viršvalandžių', breaksFact: 'Pertraukos <b>{d}</b>', endNowFact: 'Baigus dabar, bus skaičiuojama iki <b>{t}</b>', allTodayFact: 'Šiandien visos valandos – <b style="color:var(--dusk)">viršvalandžiai</b>',
  thisWeek: 'Ši savaitė', weekAfter: '{d}',
  start: 'Pradėti darbą', end: 'Baigti dieną', brk: 'Pertrauka', back: 'Grįžti į darbą',
  startedToast: 'Pradėta. Skaičiuojama nuo {t}', change: 'Keisti', backAfter: 'Grįžote po {d} pertraukos', backQuick: 'Grįžote į darbą. Pertrauka per trumpa, neįskaityta', breakStarted: 'Pertrauka pradėta',
  savedToast: 'Išsaugota: {d}', savedAfter: 'Išsaugota: {d}, iš jų {a} viršvalandžių', saveFail: 'Nepavyko išsaugoti. Gal telefone baigėsi vieta?',
  endTitle: 'Baigti dieną', startL: 'Pradžia', endL: 'Pabaiga', now: 'dabar', upFrom: 'suapvalinta iš {t}', downFrom: 'suapvalinta iš {t}',
  breaksToday: 'Pertraukos šiandien', tookBreaks: 'Pertraukos mygtuku pažymėjote {d}. Ar buvo dar?', noMore: 'Daugiau nebuvo', plus: '+{d}',
  none: 'Nebuvo', howCounts: 'Kaip skaičiuojama', note: 'Pastaba', notePh: 'Nebūtina, pvz., ką dirbote', notePh2: 'Nebūtina',
  keep: 'Dirbti toliau', saveDay: 'Išsaugoti dieną', resNormal: '{d} įprasto darbo', resAfter: '{d} viršvalandžių', resBreak: '{d} pertrauka',
  startedEarlier: 'Pradėjote anksčiau?', whenStart: 'Kada pradėjote?', setReal: 'Nustatykite, kada iš tikrųjų pradėjote.', changeStart: 'Pakeiskite šiandienos darbo pradžią.',
  countsRounded: 'skaičiuojama nuo {t} (suapvalinta)', countsHere: 'skaičiuojama nuo čia', cancel: 'Atšaukti', startBtn: 'Pradėti', save: 'Išsaugoti', startChanged: 'Pradžia pakeista į {t}',
  thisDay: 'Ši diena', hours: 'Valandos', breaks: 'Pertraukos', timedNote: 'Pertraukos mygtuku: {d}. Pasirinkite trukmę, jei norite pakeisti.', del: 'Ištrinti',
  weekendAll: 'savaitgalis, visa diena – viršvalandžiai', holAll: '{h}, visa diena – viršvalandžiai', added: 'Pridėta: {day} – {d}', saved: 'Išsaugota', deleted: 'Diena ištrinta', undo: 'Atšaukti',
  noBreak: 'be pertraukos', breakLen: '{d} pertrauka', weekend: 'Savaitgalis', afterShort: '{d} viršvalandžių',
  emptyLogT: '{m} dar nėra dienų', emptyLogP: 'Dirbtos dienos atsiras čia. Pamiršote kurią? Pridėkite ją mygtuku +.',
  workedIn: 'Dirbta {m}', afterOnWorkdays: 'Po {t} darbo dienomis', weekends: 'Savaitgaliai', holidays: 'Valstybinės šventės', breaksTaken: 'Pertraukos', avgDay: 'Vidutinė diena',
  sheet: 'Lentelė', shareSum: 'Suvestinė', copied: 'Suvestinė nukopijuota', emptyMonthT: '{m} dar nieko nėra', emptyMonthP: 'Čia susideda jūsų mėnuo: įprastos valandos, viršvalandžiai, savaitgaliai ir šventės.',
  hoursTitle: 'Valandos, {m}', sumText: '{m}: {d} {days}\nĮprastos: {n}\nViršvalandžiai: {a} (po {t}: {e}, savaitgaliais: {w}, šventėmis: {h})',
  setSub: 'Kaip skaičiuojamos jūsų valandos. Pakeitimai taikomi dar neišsaugotoms dienoms.',
  sAfter: 'Viršvalandžiai', sStarts: 'Prasideda', sStartsS: 'Darbas po šio laiko darbo dieną skaičiuojamas kaip viršvalandžiai.', sWeekends: 'Savaitgaliai', sWeekendsS: 'Visas šeštadienis ir sekmadienis – viršvalandžiai.',
  sHol: 'Valstybinės šventės', sHolS: 'Lietuvos valstybinės šventės skaičiuojamos kaip savaitgaliai.', sEarly: 'Ankstyvas rytas', sEarlyS: 'Darbas iki šio laiko irgi skaičiuojamas kaip viršvalandžiai.',
  sRound: 'Apvalinimas', sRoundTo: 'Laiką apvalinti iki', exact: 'Tiksliai', m15: '15 min.', m30: '30 min.', hourW: 'Valandos', sStartR: 'Pradžia apvalinama', sEndR: 'Pabaiga apvalinama', nearest: 'Į artimesnę', down: 'Žemyn', up: 'Aukštyn',
  ex: 'Pradėjus 07:52, skaičiuojama nuo <b>{a}</b>; baigus 18:48 – iki <b>{b}</b>.', exExact: 'Laikas skaičiuojamas tiksliai, kaip paspaudžiate.',
  sBreaks: 'Pertraukos', sAsk: 'Paklausti baigiant dieną', sAskS: 'Kad būtų įskaityta ir pamiršta pažymėti pertrauka.', sUsual: 'Įprasta pertrauka', sUsualS: 'Pažymima iš anksto, kai klausiama apie pertraukas.',
  sRem: 'Priminimai', sRemWeb: 'Priminimai veikia Android programėlėje.', sRemStart: 'Priminti pradėti', sRemStartS: 'Jei iki tol dar nepradėjote.', sDays: 'Šiomis dienomis',
  sRemLate: 'Jei pamiršiu baigti', sRemLateS: 'Paklausia, ar dar dirbate.', sRemBreak: 'Priminti pertrauką', sRemBreakS: 'Jei iki tol pertraukos nebuvo.',
  sLook: 'Išvaizda', likePhone: 'Kaip telefone', dark: 'Tamsi', light: 'Šviesi', sLang: 'Kalba',
  sData: 'Jūsų valandos', backup: 'Išsaugoti atsarginę kopiją', backupS: 'Failas su visomis dienomis – laikykite saugioje vietoje.', restore: 'Atkurti iš kopijos', restoreS: 'Prideda dienas iš atsarginės kopijos failo.',
  wipe: 'Ištrinti viską', wipeSure: 'Paspauskite dar kartą – bus ištrintos visos dienos', wiped: 'Visos dienos ištrintos', restored: 'Iš kopijos pridėta dienų: {n}', restoredNone: 'Toje kopijoje nieko naujo', notBackup: 'Tai ne Afterhours atsarginė kopija.',
  backupTitle: 'Afterhours atsarginė kopija',
  about: '<b>Afterhours {v}</b> · STEZY<br>Viskas lieka šiame telefone. Jokios paskyros, jokių reklamų.<br>stezy.lt<br>Šriftas: Geist (SIL Open Font License)',
  notifOff: 'Afterhours pranešimai išjungti. Įjunkite juos Android nustatymuose, skiltyje „Programos“.',
  wTitle: 'Kiekvienas vakaras <em>suskaičiuotas.</em>', wLead: 'Afterhours saugo jūsų darbo valandas, o viską po 18:00 ir savaitgaliais skaičiuoja atskirai.',
  w1: 'Pradėti ir baigti – vienu paspaudimu', w1s: 'Jokio fiksuoto grafiko. Laikas apvalinamas iki valandos, kaip nustatysite.', w2: 'Viršvalandžiai suskaičiuojami už jus', w2s: 'Vakarai, savaitgaliai ir Lietuvos valstybinės šventės – atskirai nuo įprastų valandų.',
  w3: 'Sunku pamiršti', w3s: 'Baigiant dieną paklausia apie pertraukas ir primena, jei pamiršote pradėti ar baigti.', wGo: 'Pradėti', wFine: 'Viskas lieka jūsų telefone. Jokios paskyros.',
  nStartT: 'Jau pradėjote darbą?', nStartB: 'Bakstelėkite ir pradėkite dieną – galima nurodyti tikrąjį pradžios laiką.', nLateT: 'Dar dirbate?', nLateB: 'Bakstelėkite ir baikite dieną, kad nebūtų priskaičiuota per daug.',
  nYestT: 'Vakarykštė diena dar neužbaigta', nYestB: 'Bakstelėkite ir nurodykite, kada baigėte.', nBackT: 'Dar pertrauka?', nBackB: 'Bakstelėkite, jei jau grįžote į darbą.',
  nBrkT: 'Laikas pertraukai?', nBrkB: 'Bakstelėkite ir pradėkite ją – bus teisingai įskaityta.', forgot: 'Diena dar nebuvo užbaigta. Kada baigėte?', channel: 'Priminimai', channelD: 'Priminimai pradėti, baigti ir apie pertraukas',
  prevMonth: 'Ankstesnis mėnuo', nextMonth: 'Kitas mėnuo', dialLabel: 'Šiandien, nuo 6 ryto iki vidurnakčio',
  payTab: 'Uždarbis', owed: 'Jums priklauso', allPaid: 'Viskas sumokėta', allPaidS: 'Nauji viršvalandžiai susidės čia.', forHours: 'už {d} viršvalandžių', notPaidHours: 'neapmokėtų viršvalandžių', since: 'nuo {day}',
  rateRow: 'Viršvalandžių įkainis', perHour: '{v} / val.', noRateT: 'Įveskite valandinį įkainį', noRateS: 'Matysite, kiek vertos jūsų viršvalandžių valandos.', paidBtn: 'Man sumokėjo', share: 'Dalintis', history: 'Jau sumokėta',
  daysRow: 'Dienos su viršvalandžiais', paidT: 'Iki kurios dienos sumokėta?', paidS: 'Ta diena ir visos ankstesnės taps pilkos ir čia nebeskaičiuojamos.', paidUpToLong: 'Iki {day}', paidWill: '{n} · {d} viršvalandžių',
  markPaid: 'Pažymėti sumokėta', paidToast: 'Sumokėta iki {day}', nothingToPay: 'Dar nėra užbaigtų dienų, kurias galima pažymėti', payoutRemoved: 'Mokėjimas pašalintas', paidSep: 'Sumokėta iki {day}',
  paidNote: 'Diena yra prieš paskutinį mokėjimą, todėl laikoma sumokėta.', rateT: 'Viršvalandžių įkainis', rateS: 'Kiek gaunate už vieną viršvalandžių valandą. Matote tik jūs.', rateEx: '10 val. viršvalandžių = {v}',
  rateBad: 'Įveskite sumą, pvz., 12,50', rateClear: 'Pašalinti', rateSaved: 'Išsaugota: {v} už valandą', hUnit: 'val.', owedText: 'Neapmokėti viršvalandžiai: {d} nuo {day}{money}.',
  emptyPayT: 'Kol kas tuščia', emptyPayP: 'Kai padirbsite viršvalandžių, čia matysite juos ir kiek jie verti.',
  updT: 'Išėjo Afterhours {v}', updGet: 'Atsisiųsti', updCard: 'Yra nauja versija: {v}', updCardS: 'Bakstelėkite ir atsisiųskite. Įdiegus ant viršaus, jūsų valandos išliks.',
  sUpd: 'Tikrinti, ar yra naujesnė versija', sUpdS: 'Kartą per dieną, stezy.lt svetainėje. Apie jus niekas nesiunčiama.',
  csv: ['Data', 'Diena', 'Pradžia', 'Pabaiga', 'Pertrauka (min.)', 'Įprastos (val.)', 'Po {t} (val.)', 'Savaitgalis (val.)', 'Šventė (val.)', 'Iš viso (val.)', 'Pastaba'],
  brkChips: ['Be pertraukos', '15 min.', '30 min.', '45 min.', '1 val.'], moreChips: ['Daugiau nebuvo', '+15 min.', '+30 min.', '+1 val.'],
};
const DICT = { en: EN, lt: LT };

/** A word or sentence in the current language, with {placeholders} filled in. */
export function t(key, vars) {
  let s = (DICT[lang] && DICT[lang][key]) ?? EN[key] ?? key;
  if (vars && typeof s === 'string') s = s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
  return s;
}
export const list = key => DICT[lang][key] || EN[key];
