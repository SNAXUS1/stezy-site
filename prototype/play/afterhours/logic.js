// Afterhours: the counting. Pure functions, no screen, no storage, so they can be tested on their own.
// Times are milliseconds (Date.getTime()); clock times in settings are minutes after midnight.

export const DEFAULTS = Object.freeze({
  otStart: 18 * 60,        // after this on a working day: after hours
  dayStart: 6 * 60,        // before this (late at night, very early): after hours too
  weekends: true,          // all of Saturday and Sunday counts as after hours
  holidays: true,          // Lithuanian public holidays count like weekends
  roundStep: 60,           // minutes; 0 = exact times
  roundStart: 'nearest',   // nearest | down | up
  roundEnd: 'up',          // up | nearest | down
  askBreaks: true,         // ending the day asks about breaks
  usualBreak: 0,           // minutes picked by default in that question
  remindStart: true, startAt: 8 * 60 + 15, workDays: [1, 2, 3, 4, 5],
  remindLate: true, lateAt: 23 * 60 + 15,
  remindBreak: false, breakAt: 13 * 60,
  theme: 'system',
  updates: true,
  rate: null,
  lang: 'system',         // system | dark | light
});

export const KINDS = ['normal', 'evening', 'weekend', 'holiday'];
const MIN = 60000, DAY = 86400000;

// ---------------------------------------------------------------- dates

export const pad = n => String(n).padStart(2, '0');
/** "2026-10-16" in local time. */
export const dayKey = t => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
export const fromKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d).getTime(); };
/** Local midnight of the day t falls on. */
export const midnight = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
/** The same day at a clock time (minutes after midnight), in local time (summer time handled by Date). */
export const at = (t, mins) => { const d = new Date(t); d.setHours(0, 0, 0, 0); d.setMinutes(mins); return d.getTime(); };
export const minsOfDay = t => { const d = new Date(t); return d.getHours() * 60 + d.getMinutes(); };
/** Monday of t's week (weeks start on Monday). */
export const weekStart = t => { const d = new Date(midnight(t)); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return d.getTime(); };
export const isoWeek = t => {
  const d = new Date(midnight(t));
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const w1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - w1) / DAY - 3 + ((w1.getDay() + 6) % 7)) / 7);
};

// ---------------------------------------------------------------- Lithuanian public holidays

function easter(y) {
  // Anonymous Gregorian algorithm
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, month - 1, day);
}
const firstSunday = (y, m) => { const d = new Date(y, m, 1); d.setDate(1 + ((7 - d.getDay()) % 7)); return d; };
const cache = new Map();
/** Lithuania's non-working public holidays for a year: day key → name. */
export function holidaysLT(y) {
  if (cache.has(y)) return cache.get(y);
  const map = new Map();
  const add = (d, name) => map.set(dayKey(d.getTime()), name);
  const fixed = [[0, 1, "New Year's Day"], [1, 16, 'Day of the Restoration of the State'], [2, 11, 'Day of the Restoration of Independence'], [4, 1, 'Labour Day'],
    [5, 24, "St John's Day"], [6, 6, 'Statehood Day'], [7, 15, 'Assumption Day'], [10, 1, "All Saints' Day"], [10, 2, "All Souls' Day"],
    [11, 24, 'Christmas Eve'], [11, 25, 'Christmas Day'], [11, 26, 'Second Day of Christmas']];
  for (const [m, d, n] of fixed) add(new Date(y, m, d), n);
  const e = easter(y);
  add(e, 'Easter Sunday');
  add(new Date(y, e.getMonth(), e.getDate() + 1), 'Easter Monday');
  add(firstSunday(y, 4), "Mother's Day");
  add(firstSunday(y, 5), "Father's Day");
  cache.set(y, map);
  return map;
}
export const holidayName = t => holidaysLT(new Date(t).getFullYear()).get(dayKey(t)) || null;

/** What one moment of work counts as. */
export function kindAt(t, s) {
  if (s.holidays && holidayName(t)) return 'holiday';
  const wd = new Date(t).getDay();
  if (s.weekends && (wd === 0 || wd === 6)) return 'weekend';
  const m = minsOfDay(t);
  return m >= s.otStart || m < s.dayStart ? 'evening' : 'normal';
}
export const isAfterHours = k => k !== 'normal';

// ---------------------------------------------------------------- rounding

/** Rounds a moment to the step (minutes) on the local clock: nearest, up or down. Exact times with a step of 0. */
export function roundTime(t, step, rule) {
  if (!step) return Math.floor(t / MIN) * MIN;
  // minutes on the wall clock (not time since midnight: on a clock-change day those differ by an hour)
  const d = new Date(t), base = midnight(t), m = d.getHours() * 60 + d.getMinutes() + (d.getSeconds() * 1000 + d.getMilliseconds()) / MIN;
  let r;
  if (rule === 'up') r = Math.ceil(m / step - 1e-9) * step;
  else if (rule === 'down') r = Math.floor(m / step + 1e-9) * step;
  else r = Math.round(m / step) * step;
  return at(base, r);
}

// ---------------------------------------------------------------- a shift

/**
 * One shift as counted: rounded start and end, minutes by kind, breaks taken out, and the pieces for drawing.
 * A running shift counts up to now (its end isn't rounded until it ends). Timed breaks come out of the minutes they
 * cover; breaks given as a length (at the end of the day) come out of normal time first, then after hours.
 */
export function computeShift(sh, s, now = Date.now()) {
  // a saved day keeps the rounding and after-hours rules it was counted with
  const rs = sh.round || { step: s.roundStep, start: s.roundStart, end: s.roundEnd };
  if (sh.rules) s = { ...s, ...sh.rules };
  const S = roundTime(sh.start, rs.step, rs.start);
  let E = sh.end != null ? roundTime(sh.end, rs.step, rs.end) : Math.max(S, Math.floor(now / MIN) * MIN);
  if (E < S) E = S;
  const breaks = (sh.breaks || []).map(b => [Math.max(S, b.start), Math.min(E, b.end != null ? b.end : now)]).filter(([a, b]) => b > a);
  const min = { normal: 0, evening: 0, weekend: 0, holiday: 0 };
  const segs = [];
  let breakMin = 0, cur = null;
  for (let t = S; t < E; t += MIN) {
    const inBreak = breaks.some(([a, b]) => t >= a && t < b);
    const k = inBreak ? 'break' : kindAt(t, s);
    if (inBreak) breakMin++; else min[k]++;
    if (!cur || cur.kind !== k) { cur = { kind: k, from: t, to: t + MIN }; segs.push(cur); } else cur.to = t + MIN;
  }
  // a break given as a length: lunch comes out of the normal day first
  let extra = Math.max(0, Math.round(sh.extraBreak || 0));
  breakMin += extra;
  for (const k of KINDS) { const take = Math.min(extra, min[k]); min[k] -= take; extra -= take; }
  const after = min.evening + min.weekend + min.holiday;
  return { id: sh.id, note: sh.note || "", start: S, end: E, realStart: sh.start, realEnd: sh.end, running: sh.end == null, min, total: min.normal + after, normal: min.normal, after, breakMin, segs,
    onBreak: sh.end == null && (sh.breaks || []).some(b => b.end == null) };
}

/** Totals over many shifts (already computed). */
export function totals(list) {
  const t = { normal: 0, evening: 0, weekend: 0, holiday: 0, after: 0, total: 0, breakMin: 0, days: 0 };
  const days = new Set();
  for (const c of list) {
    for (const k of KINDS) t[k] += c.min[k];
    t.breakMin += c.breakMin;
    if (c.total > 0) days.add(dayKey(c.realStart));
  }
  t.after = t.evening + t.weekend + t.holiday;
  t.total = t.normal + t.after;
  t.days = days.size;
  return t;
}

// ---------------------------------------------------------------- words and numbers

/** 600 → "10 h", 570 → "9 h 30", 45 → "45 min". */
export function fmtDur(m) {
  m = Math.max(0, Math.round(m));
  const h = Math.floor(m / 60), r = m % 60;
  if (!h) return r ? `${r} min` : '0 h';
  return r ? `${h} h ${pad(r)}` : `${h} h`;
}
/** Decimal hours for a spreadsheet: 570 → "9.5". */
export const fmtDec = m => (Math.round(m / 6) / 10).toString();
export const fmtClock = t => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export const fmtMins = m => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
const WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MO = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const fmtDay = t => { const d = new Date(t); return `${WD[d.getDay()]}, ${d.getDate()} ${MO[d.getMonth()]}`; };
export const fmtDayShort = t => { const d = new Date(t); return `${WD[d.getDay()].slice(0, 3)} ${d.getDate()}`; };
export const fmtMonth = t => { const d = new Date(t); return `${MO[d.getMonth()]} ${d.getFullYear()}`; };
export const monthName = m => MO[m];
export const weekdayName = (wd, short) => short ? WD[wd].slice(0, 3) : WD[wd];

/** A spreadsheet of shifts (computed), one row a shift. */
export function toCSV(list, o = {}) {
  const head = o.head || ['Date', 'Day', 'Start', 'End', 'Break (min)', 'Normal (h)', 'After 18:00 (h)', 'Weekend (h)', 'Holiday (h)', 'Total (h)', 'Note'];
  const day = o.day || (wd => WD[wd]), dec = o.dec || fmtDec, sep = o.sep || ',';
  const rows = [head];
  for (const c of list) {
    const d = new Date(c.realStart);
    rows.push([dayKey(c.realStart), day(d.getDay()), fmtClock(c.start), c.running ? '' : fmtClock(c.end), String(c.breakMin), dec(c.normal), dec(c.min.evening), dec(c.min.weekend), dec(c.min.holiday), dec(c.total), c.note || '']);
  }
  return rows.map(r => r.map(v => /[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v).join(sep)).join('\r\n') + '\r\n';
}
