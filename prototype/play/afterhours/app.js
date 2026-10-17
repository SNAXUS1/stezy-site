// Afterhours: the screens. Data lives on the phone (localStorage); the counting is in logic.js.
import * as L from './logic.js';
import * as N from './native.js';
import { timeWheel } from './wheel.js';
import * as W from './words.js';
import { t as T } from './words.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const QS = new URLSearchParams(location.search);
const DEMO = QS.has('demo') || !!window.AFTERHOURS_DEMO;
const KEY = 'afterhours.v1';
const VERSION = '1.2.1';
const MINMS = 60000;
const addDays = (t, n) => { const d = new Date(t); d.setDate(d.getDate() + n); return d.getTime(); };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// ================================================================ data

let D = load();
function blank() { return { v: 1, shifts: [], payouts: [], settings: { ...L.DEFAULTS }, onboarded: false, created: Date.now() }; }
function load() {
  if (DEMO) return demoData();
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (d && d.v === 1 && Array.isArray(d.shifts)) return upgrade(d);
  } catch (e) { console.warn(e); }
  return blank();
}
/** Fills in what older versions didn't keep: days saved by 1.0 take the after-hours rules they were counted with. */
function upgrade(d) {
  const out = { ...blank(), ...d, settings: { ...L.DEFAULTS, ...d.settings } };
  if (!Array.isArray(out.payouts)) out.payouts = [];
  for (const s of out.shifts) if (s.end != null && !s.rules) s.rules = rulesOf(out.settings);
  return out;
}
function rulesOf(s) { return { otStart: s.otStart, dayStart: s.dayStart, weekends: s.weekends, holidays: s.holidays }; }
function save() {
  if (DEMO) return;
  const text = JSON.stringify(D);
  N.mirrorSave(text);
  try {
    localStorage.setItem(KEY, text);
    // one copy a day kept aside, in case something ever goes wrong with the main one
    const day = L.dayKey(Date.now());
    if (localStorage.getItem(KEY + '.day') !== day) { localStorage.setItem(KEY + '.prev', text); localStorage.setItem(KEY + '.day', day); }
  } catch (e) { toast(T('saveFail')); }
}
const S = () => D.settings;
const running = () => D.shifts.find(s => s.end == null) || null;
const comp = (sh, now = Date.now()) => L.computeShift(sh, S(), now);
const byStart = (a, b) => a.start - b.start;
const roundingNow = () => ({ step: S().roundStep, start: S().roundStart, end: S().roundEnd });
const rulesNow = () => rulesOf(S());

// ================================================================ the phone's bars
// env(safe-area-inset-*) knows where the WebView really sits. Capacitor also reports the bars' sizes, but on some phones
// (the owner's Samsung: a 705-tall view on a 780-tall screen, bars 27 + 48) the WebView already sits between the bars,
// and adding those sizes again left empty bands at the top and bottom. They're used only when the WebView really fills
// the screen and env() says nothing.
function fitBars() {
  if (document.activeElement && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) return; // the keyboard changes the height
  const r = document.documentElement, cs = getComputedStyle(r);
  const vt = parseFloat(cs.getPropertyValue('--safe-area-inset-top')) || 0, vb = parseFloat(cs.getPropertyValue('--safe-area-inset-bottom')) || 0;
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)';
  document.body.appendChild(probe);
  const ps = getComputedStyle(probe), et = parseFloat(ps.paddingTop) || 0, eb = parseFloat(ps.paddingBottom) || 0;
  probe.remove();
  const fills = Math.max(screen.width, screen.height) - Math.max(innerWidth, innerHeight) <= 4;
  const want = !et && !eb && (vt || vb) && fills ? [vt + 'px', vb + 'px'] : ['', ''];
  if (r.style.getPropertyValue('--bars-top') !== want[0]) want[0] ? r.style.setProperty('--bars-top', want[0]) : r.style.removeProperty('--bars-top');
  if (r.style.getPropertyValue('--bars-bottom') !== want[1]) want[1] ? r.style.setProperty('--bars-bottom', want[1]) : r.style.removeProperty('--bars-bottom');
}
let barsBusy = false;
const barsAgain = () => { if (barsBusy) return; barsBusy = true; requestAnimationFrame(() => { fitBars(); barsBusy = false; if (tab === 'today') fitToday(); }); };
addEventListener('resize', barsAgain);
// Capacitor sends the bars' sizes whenever they change (it writes them on <html>)
new MutationObserver(barsAgain).observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });

// ================================================================ theme

const media = matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  const t = S().theme, dark = t === 'dark' || (t === 'system' && media.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute('content', dark ? '#0B0B0C' : '#F4F3F0'));
  N.bars(dark);
}
media.addEventListener('change', () => { if (S().theme === 'system') applyTheme(); });

// ================================================================ language

/** Picks English or Lithuanian (like the phone, unless chosen in Settings) and words the page's fixed parts. */
function applyLang() {
  W.setLang(S().lang);
  document.querySelectorAll('[data-w]').forEach(el => el.textContent = T(el.dataset.w));
  document.querySelectorAll('[data-wl]').forEach(el => el.setAttribute('aria-label', T(el.dataset.wl)));
}
addEventListener('languagechange', () => { if (S().lang === 'system') { applyLang(); renderAll(); plan(); } });

// ================================================================ small pieces

const ICON = {
  play: '<path d="M8 5.5v13l10-6.5Z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="2.5"/>',
  cup: '<path d="M5 9h11v4.5A4.5 4.5 0 0 1 11.5 18h-2A4.5 4.5 0 0 1 5 13.5Z"/><path d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M8.5 3.5v2.5M12 3.5v2.5"/>',
  back: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  left: '<path d="M15 5.5 8.5 12 15 18.5"/>',
  right: '<path d="M9 5.5l6.5 6.5L9 18.5"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  share: '<path d="M12 15V3.5M7.5 8 12 3.5 16.5 8"/><path d="M5 12.5v5A2.5 2.5 0 0 0 7.5 20h9a2.5 2.5 0 0 0 2.5-2.5v-5"/>',
  sheet: '<rect x="4" y="3.5" width="16" height="17" rx="3"/><path d="M4 9h16M4 14.5h16M10 9v11.5"/>',
  tap: '<circle cx="12" cy="12" r="8.5"/><path d="M9.5 9v6l5-3Z"/>',
  moon: '<path d="M19.5 14.5A8 8 0 1 1 9.5 4.5a6.5 6.5 0 0 0 10 10Z"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15Z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  empty: '<path d="M3.5 17a8.5 8.5 0 0 1 17 0"/><path d="M2 20h20"/><path d="M12 5V3M5.3 8.3 4 7M18.7 8.3 20 7"/>',
};
const icon = (n, cls = '') => `<svg viewBox="0 0 24 24" class="${cls}" aria-hidden="true">${ICON[n]}</svg>`;
const bigDur = W.bigDur;
const hrs = W.dur;

let toastT = 0;
function toast(text, action, fn) {
  const t = $('toast');
  t.innerHTML = `<span>${esc(text)}</span>${action ? `<button type="button">${esc(action)}</button>` : ''}`;
  t.hidden = false;
  t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
  if (action) t.querySelector('button').onclick = () => { t.hidden = true; fn(); };
  clearTimeout(toastT);
  toastT = setTimeout(() => t.hidden = true, action ? 5200 : 3200);
}

// ================================================================ what kind of day

function dayKind(t) {
  const s = S(), hol = s.holidays && L.holidayName(t), wd = new Date(t).getDay();
  if (hol) return { label: W.holiday(hol), sub: T('allAfter'), dusk: true, all: true, hol: true };
  if (s.weekends && (wd === 0 || wd === 6)) return { label: T('weekend'), sub: T('allAfter'), dusk: true, all: true, hol: false };
  return { label: T('workday'), sub: T('afterFrom', { t: L.fmtMins(s.otStart) }), dusk: false, all: false, hol: false };
}

// ================================================================ TODAY

let drawn = false;
function renderToday() {
  const now = Date.now(), today = L.midnight(now), r = running();
  const shifts = D.shifts.filter(s => L.midnight(s.start) === today || s === r).sort(byStart);
  const cs = shifts.map(s => comp(s, now));
  const tot = L.totals(cs);
  const kind = dayKind(now);
  const rc = r ? comp(r, now) : null;
  const curKind = r ? L.kindAt(now, S()) : null;
  const onBreak = rc && rc.onBreak;
  let status;
  if (onBreak) {
    const ob = r.breaks.find(b => b.end == null);
    status = `<span class="status brk"><i></i>${T('onBreak', { d: hrs((now - ob.start) / MINMS) })}</span>`;
  } else if (r) status = curKind !== 'normal'
    ? `<span class="status after"><i></i>${T('afterSince', { t: rc.min.normal ? L.fmtMins(S().otStart) : L.fmtClock(rc.start) })}</span>`
    : `<span class="status live"><i></i>${T('workingSince', { t: L.fmtClock(rc.start) })}</span>`;
  else if (cs.length) status = `<span class="status"><i></i>${T('done', { a: L.fmtClock(cs[0].start), b: L.fmtClock(cs[cs.length - 1].end) })}</span>`;
  else status = `<span class="status"><i></i>${T(new Date(now).getHours() < 5 ? 'lateNight' : 'notStarted')}</span>`;

  const facts = [];
  if (tot.breakMin) facts.push(T('breaksFact', { d: hrs(tot.breakMin) }));
  if (r && S().roundStep) {
    const e = L.roundTime(now, S().roundStep, S().roundEnd);
    facts.push(T('endNowFact', { t: L.fmtClock(e) }));
  }
  if (!r && !cs.length && kind.all) facts.push(T('allTodayFact'));

  const first = !drawn && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const el = $('today');
  el.innerHTML = `
    <div class="day-head"><span class="day-date">${W.day(now)}</span><span class="kind-chip${kind.dusk ? ' dusk' : ''}">${esc(kind.label)} · ${esc(kind.sub)}</span></div>
    <div class="hero"><div class="dial-wrap">${dial(cs, now, kind, r)}
      <div class="read">${status}<div class="big">${bigDur(tot.total)}</div></div></div>
      <div class="split"><span><i></i><b>${hrs(tot.normal)}</b> ${T('normal')}</span><span class="a"><i></i><b>${hrs(tot.after)}</b> ${T('afterHours')}</span></div>
      ${facts.length ? `<div class="facts">${facts.map(f => `<span class="fact">${f}</span>`).join('')}</div>` : ''}</div>
    ${weekStrip(now)}`;
  drawn = true;
  fitToday();
  if (first) {
    el.classList.add('first');
    clearTimeout(el._first);
    el._first = setTimeout(() => el.classList.remove('first'), 1600);
    countUp(el.querySelector('.big'), tot.total);
  }

  // the buttons change only when the day's state does (rebuilding them every refresh would cut a long press short)
  const dock = $('dock'), key = (!r ? 'start' : onBreak ? 'break' : 'run') + W.getLang();
  if (dock.dataset.k === key) return;
  const swap = !!dock.dataset.k;
  dock.dataset.k = key;
  dock.innerHTML = !r
    ? `<button type="button" class="cta" id="b-start">${icon('play')}${T('start')}</button>`
    : onBreak
      ? `<button type="button" class="cta" id="b-break">${icon('back')}${T('back')}</button><button type="button" class="cta ghost small" id="b-end">${T('end')}</button>`
      : `<button type="button" class="cta ghost small" id="b-break">${icon('cup')}${T('brk')}</button><button type="button" class="cta" id="b-end">${icon('stop')}${T('end')}</button>`;
  const bs = $('b-start'), bb = $('b-break'), be = $('b-end');
  if (bs) { bs.onclick = () => startWork(); press(bs, () => openStart()); }
  if (bb) bb.onclick = toggleBreak;
  if (be) be.onclick = () => openEnd(running());
  if (swap && !matchMedia('(prefers-reduced-motion: reduce)').matches) { dock.classList.remove('swap'); void dock.offsetWidth; dock.classList.add('swap'); }
}

/** Today fits any phone: tighter on short screens (nothing slides under the buttons), fuller on tall ones. */
function fitToday() {
  const el = $('today');
  if (!el || !el.clientHeight) return;
  el.classList.remove('fit-1', 'fit-2', 'fit-3', 'fit-4', 'roomy');
  let lvl = 0;
  while (el.scrollHeight > el.clientHeight + 1 && lvl < 4) el.classList.add('fit-' + ++lvl);
  if (lvl) return;
  const used = [...el.children].reduce((a, c) => a + c.offsetHeight, 0);
  if (el.clientHeight - used > 110) {
    el.classList.add('roomy');
    if (el.scrollHeight > el.clientHeight + 1) el.classList.remove('roomy');
  }
}
addEventListener('resize', () => { if (tab === 'today') fitToday(); });
// the font arriving can change how lines wrap
if (document.fonts) document.fonts.ready.then(() => { if (tab === 'today') fitToday(); });

/** The day's total counts up the first time it's shown. */
function countUp(el, to) {
  if (!el || to <= 0) return;
  const t0 = performance.now(), dur = 900;
  const step = t => {
    const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    el.innerHTML = bigDur(Math.round(to * e));
    if (k < 1 && el.isConnected) requestAnimationFrame(step);
    else if (el.isConnected) fitToday();
  };
  el.innerHTML = bigDur(0);
  requestAnimationFrame(step);
}

/** A long press (half a second) on a button. */
function press(el, fn) {
  let t = 0;
  el.addEventListener('pointerdown', () => { t = setTimeout(() => { t = -1; N.haptic.firm(); fn(); }, 520); });
  const clear = () => { if (t > 0) clearTimeout(t); };
  el.addEventListener('pointerup', clear); el.addEventListener('pointerleave', clear); el.addEventListener('pointercancel', clear);
  el.addEventListener('click', e => { if (t === -1) { e.stopImmediatePropagation(); e.preventDefault(); t = 0; } }, true);
}

/** The day as an arc over the horizon, 06:00 to midnight: worked time drawn on it, after hours in the warm colour. */
function dial(cs, now, kind, r) {
  const W = 340, cx = W / 2, cy = 166, R = 146, H = cy + 26;
  const day = L.midnight(now), t0 = L.at(day, 6 * 60), t1 = L.at(day, 24 * 60), span = t1 - t0;
  const ang = t => Math.PI - Math.max(0, Math.min(1, (t - t0) / span)) * Math.PI;
  const pt = (t, rr = R) => { const a = ang(t); return [cx + rr * Math.cos(a), cy - rr * Math.sin(a)]; };
  const arc = (a, b, rr = R) => { const [x1, y1] = pt(a, rr), [x2, y2] = pt(b, rr); return `M${x1.toFixed(2)} ${y1.toFixed(2)}A${rr} ${rr} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`; };
  const len = (a, b, rr = R) => (Math.abs(ang(a) - ang(b)) * rr).toFixed(1);
  const ot = L.at(day, S().otStart);
  let svg = `<svg class="dial" viewBox="0 0 ${W} ${H}" role="img" aria-label="${T('dialLabel')}">`;
  svg += `<line class="d-horizon" x1="${cx - R - 16}" y1="${cy}" x2="${cx + R + 16}" y2="${cy}"/>`;
  svg += `<path class="d-track" d="${arc(t0, t1)}"/>`;
  svg += kind.all ? `<path class="d-zone" d="${arc(t0, t1)}"/>` : `<path class="d-zone" d="${arc(Math.max(t0, ot), t1)}"/>`;
  for (const h of [6, 9, 12, 15, 18, 21, 24]) {
    const t = L.at(day, h * 60), [x1, y1] = pt(t, R - 11), [x2, y2] = pt(t, R - 16);
    svg += `<line class="d-tick" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;
  }
  // hour labels outside the arc: 06 and 24 under its ends, 12 over the top, and where after hours begins
  const lab = (mins, cls = '', text) => {
    const t = L.at(day, mins), a = ang(t);
    let [x, y] = pt(t, R + 15);
    if (mins <= 6 * 60 || mins >= 24 * 60) { [x] = pt(t, R); y = cy + 18; }
    return `<text class="d-lab ${cls}" x="${x.toFixed(1)}" y="${(y + 3.5).toFixed(1)}" text-anchor="middle">${text}</text>`;
  };
  svg += lab(6 * 60, '', '06') + lab(12 * 60, '', '12') + (kind.all ? '' : lab(S().otStart, 'dusk', L.fmtMins(S().otStart).replace(':00', ''))) + lab(24 * 60, '', '24');
  // worked time
  const pieces = [];
  for (const c of cs) for (const s of c.segs) {
    const a = Math.max(t0, s.from), b = Math.min(t1, s.to);
    if (b <= a) continue;
    pieces.push({ a, b, k: s.kind === 'break' ? 'brk' : s.kind === 'normal' ? 'normal' : 'after' });
  }
  const anim = !drawn && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  let delay = 0;
  for (const p of pieces) {
    const l = len(p.a, p.b);
    svg += `<path class="d-seg ${p.k}${anim && p.k !== 'brk' ? ' d-draw' : ''}" style="--len:${l};animation-delay:${delay.toFixed(2)}s" d="${arc(p.a, p.b)}"/>`;
    if (anim) delay += Math.min(.5, l / 900);
  }
  const work = pieces.filter(p => p.k !== 'brk');
  if (work.length) {
    const f = work[0], e = work[work.length - 1];
    const [sx, sy] = pt(f.a);
    svg += `<circle class="d-cap ${f.k}" cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="4.5"/>`;
    if (!r) { const [ex, ey] = pt(e.b); svg += `<circle class="d-cap ${e.k}" cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="4.5"/>`; }
  }
  // now
  if (now >= t0 && now <= t1) {
    const [nx, ny] = pt(now), after = L.kindAt(now, S()) !== 'normal';
    if (r && !(comp(r, now).onBreak)) svg += `<circle class="d-pulse${after ? ' after' : ''}" cx="${nx.toFixed(1)}" cy="${ny.toFixed(1)}" r="6"/>`;
    svg += `<circle class="d-now${r ? ' live' : ''}" cx="${nx.toFixed(1)}" cy="${ny.toFixed(1)}" r="${r ? 5.5 : 4.5}"${r && after ? ' style="fill:var(--dusk);stroke:var(--dusk)"' : ''}/>`;
  }
  return svg + '</svg>';
}

function weekStrip(now) {
  const ws = L.weekStart(now), days = [];
  for (let i = 0; i < 7; i++) days.push(addDays(ws, i));
  const per = days.map(d => {
    const list = D.shifts.filter(s => L.midnight(s.start) === d).map(s => comp(s, now));
    return L.totals(list);
  });
  const wk = per.reduce((a, t) => ({ total: a.total + t.total, after: a.after + t.after }), { total: 0, after: 0 });
  const max = Math.max(10 * 60, ...per.map(t => t.total));
  const today = L.midnight(now);
  return `<div class="week"><div class="week-head"><span>${T('thisWeek')}</span><span>${wk.after && wk.after === wk.total ? `<b class="a">${hrs(wk.total)}</b>` : `<b>${hrs(wk.total)}</b>${wk.after ? ` · <span class="a">${T('weekAfter', { d: hrs(wk.after) })}</span>` : ''}`}</span></div>
    <div class="bars">${per.map((t, i) => `<div class="bar${days[i] === today ? ' now' : ''}" style="--k:${i}"><div class="col">${t.after ? `<i class="a" style="height:${(t.after / max * 100).toFixed(1)}%"></i>` : ''}${t.normal ? `<i style="height:${(t.normal / max * 100).toFixed(1)}%"></i>` : ''}</div><span>${W.weekLetters()[i]}</span></div>`).join('')}</div></div>`;
}

// ---------------------------------------------------------------- the day's actions

function startWork(at = Date.now()) {
  if (running()) return;
  const sh = { id: uid(), start: at, end: null, breaks: [], extraBreak: 0, note: '' };
  D.shifts.push(sh);
  save();
  N.haptic.firm();
  const c = comp(sh);
  toast(T('startedToast', { t: L.fmtClock(c.start) }), T('change'), () => openStart(sh));
  renderAll();
  plan();
}
function toggleBreak() {
  const r = running();
  if (!r) return;
  const open = r.breaks.find(b => b.end == null);
  if (open) { open.end = Date.now(); const m = (open.end - open.start) / MINMS; if (m < 1) r.breaks.splice(r.breaks.indexOf(open), 1); toast(m < 1 ? T('backQuick') : T('backAfter', { d: hrs(m) })); }
  else { r.breaks.push({ start: Date.now(), end: null }); toast(T('breakStarted')); }
  save();
  N.haptic.tap();
  renderAll();
  plan();
}

// ================================================================ sheets

let sheetClose = null;
function openSheet(html, { full = false, onClose } = {}) {
  const sheet = $('sheet'), scrim = $('scrim'), body = $('sheet-body');
  body.innerHTML = html;
  body.scrollTop = 0;
  sheet.classList.toggle('full', full);
  sheet.hidden = false; scrim.hidden = false;
  sheet.style.transform = '';
  requestAnimationFrame(() => requestAnimationFrame(() => { sheet.classList.add('in'); scrim.classList.add('in'); }));
  sheetClose = onClose || null;
  return body;
}
function closeSheet() {
  const sheet = $('sheet'), scrim = $('scrim');
  if (sheet.hidden) return false;
  sheet.classList.remove('in'); scrim.classList.remove('in');
  sheet.style.transform = '';
  const done = () => { sheet.hidden = true; scrim.hidden = true; $('sheet-body').innerHTML = ''; };
  setTimeout(done, 380);
  const f = sheetClose; sheetClose = null;
  if (f) f();
  return true;
}
$('scrim').addEventListener('click', closeSheet);
// drag the sheet down by its handle to close it
(() => {
  const sheet = $('sheet'), grab = sheet.querySelector('.grab');
  let y0 = 0, dy = 0, t0 = 0, on = false;
  grab.addEventListener('pointerdown', e => { on = true; y0 = e.clientY; dy = 0; t0 = performance.now(); sheet.style.transition = 'none'; grab.setPointerCapture(e.pointerId); });
  grab.addEventListener('pointermove', e => { if (!on) return; dy = Math.max(0, e.clientY - y0); sheet.style.transform = `translateY(${dy}px)`; });
  const end = () => {
    if (!on) return; on = false;
    sheet.style.transition = '';
    const v = dy / Math.max(1, performance.now() - t0);
    if (dy > 110 || v > .6) closeSheet(); else sheet.style.transform = '';
  };
  grab.addEventListener('pointerup', end); grab.addEventListener('pointercancel', end);
})();

/** Start and end cells, each opening the wheel below them. */
function spanHtml(c, startNote, endNote, running) {
  return `<div class="span">
    <button type="button" class="tcell" data-edit="start"><small>${T('startL')}</small><b>${L.fmtClock(c.start)}</b><em>${esc(startNote || '')}</em></button>
    <div class="arrow">${icon('arrow')}</div>
    <button type="button" class="tcell" data-edit="end"><small>${T('endL')}</small><b>${running ? T('now') : L.fmtClock(c.end)}</b><em>${esc(endNote || '')}</em></button>
  </div>`;
}
const roundNote = (real, counted, rule) => {
  if (Math.floor(real / MINMS) === Math.floor(counted / MINMS)) return '';
  return T(counted > real ? 'upFrom' : 'downFrom', { t: L.fmtClock(real) });
};
function resultHtml(c) {
  const parts = [c.normal || !c.after ? T('resNormal', { d: hrs(c.normal) }) : '', c.after ? `<span class="a">${T('resAfter', { d: hrs(c.after) })}</span>` : ''].filter(Boolean);
  return `<div class="result"><b>${hrs(c.total)}</b><span>${parts.join(' · ')}${c.breakMin ? `<br>${T('resBreak', { d: hrs(c.breakMin) })}` : ''}</span></div>`;
}
const BREAKS = () => [0, 15, 30, 45, 60].map((v, i) => [v, W.list('brkChips')[i]]);
const MORE = () => [0, 15, 30, 60].map((v, i) => [v, W.list('moreChips')[i]]);

/** A clock time on a wheel, turned into a moment: on `base`'s day, or the next day if it would come before `after`. */
function clockToTime(base, mins, after) {
  let t = L.at(base, mins);
  if (after != null && t < after) t = L.at(addDays(base, 1), mins);
  return t;
}

// ---------------------------------------------------------------- end the day
function openEnd(sh, endAt) {
  if (!sh) return;
  const st = { start: sh.start, end: endAt || Date.now(), extra: null, note: sh.note || '', edit: null };
  const timed = sh.breaks.reduce((a, b) => a + ((b.end ?? st.end) - b.start), 0) / MINMS;
  st.extra = timed > 0 ? 0 : S().usualBreak;
  const draw = () => {
    const tmp = { ...sh, start: st.start, end: st.end, extraBreak: st.extra, breaks: sh.breaks.map(b => ({ ...b, end: b.end ?? Math.min(st.end, Date.now()) })), round: roundingNow() };
    const c = comp(tmp);
    body.querySelector('#span').innerHTML = spanHtml(c, roundNote(st.start, c.start), roundNote(st.end, c.end));
    body.querySelector('#res').innerHTML = resultHtml(c);
    body.querySelectorAll('[data-br]').forEach(b => b.classList.toggle('on', +b.dataset.br === st.extra));
    wire();
  };
  const wire = () => body.querySelectorAll('[data-edit]').forEach(b => {
    b.classList.toggle('on', st.edit === b.dataset.edit);
    b.onclick = () => {
      N.haptic.tap();
      st.edit = st.edit === b.dataset.edit ? null : b.dataset.edit;
      const host = body.querySelector('#wheel-host');
      host.innerHTML = '';
      draw();
      if (!st.edit) return;
      const which = st.edit;
      timeWheel(host, L.minsOfDay(which === 'start' ? st.start : st.end), v => {
        if (which === 'start') st.start = clockToTime(sh.start, v);
        else st.end = clockToTime(st.start, v, st.start);
        draw();
      }, 5);
    };
  });
  const breaksHtml = !S().askBreaks && timed <= 0 ? '' : `<div class="sh-k">${T('breaksToday')}</div>
    ${timed > 0 ? `<p class="sh-s" style="margin:-4px 0 10px">${T('tookBreaks', { d: hrs(timed) })}</p>` : ''}
    <div class="chips">${(timed > 0 ? MORE() : BREAKS()).map(([v, l]) => `<button type="button" class="chip" data-br="${v}">${l}</button>`).join('')}</div>`;
  const body = openSheet(`<h2 class="sh-t">${T('endTitle')}</h2><p class="sh-s">${W.day(sh.start)}</p>
    <div id="span"></div><div class="wheel-host" id="wheel-host"></div>${breaksHtml}
    <div class="sh-k">${T('howCounts')}</div><div id="res"></div>
    <div class="sh-k">${T('note')}</div><input class="note" id="e-note" maxlength="120" placeholder="${esc(T('notePh'))}" value="${esc(st.note)}" enterkeyhint="done">
    <div class="sh-act"><button type="button" class="cta ghost" id="e-keep">${T('keep')}</button><button type="button" class="cta" id="e-save">${T('saveDay')}</button></div>`);
  body.querySelectorAll('[data-br]').forEach(b => b.onclick = () => { st.extra = +b.dataset.br; N.haptic.tick(); draw(); });
  body.querySelector('#e-keep').onclick = closeSheet;
  body.querySelector('#e-save').onclick = () => {
    const now = Date.now();
    for (const b of sh.breaks) if (b.end == null) b.end = Math.min(now, st.end);
    Object.assign(sh, { start: st.start, end: st.end, extraBreak: st.extra, note: body.querySelector('#e-note').value.trim(), round: roundingNow(), rules: rulesNow() });
    if (sh.end < sh.start) sh.end = sh.start;
    save();
    N.haptic.done();
    closeSheet();
    const c = comp(sh);
    toast(c.after ? T('savedAfter', { d: hrs(c.total), a: hrs(c.after) }) : T('savedToast', { d: hrs(c.total) }));
    renderAll();
    plan();
  };
  draw();
}

// ---------------------------------------------------------------- start (now, or earlier)
function openStart(existing) {
  const now = Date.now();
  const usual = typicalStart();
  const st = { t: existing ? existing.start : Math.min(now, L.at(L.midnight(now), usual)) };
  const body = openSheet(`<h2 class="sh-t">${T(existing ? 'whenStart' : 'startedEarlier')}</h2>
    <p class="sh-s">${T(existing ? 'changeStart' : 'setReal')}</p>
    <div id="sw"></div><div class="result" id="sres"></div>
    <div class="sh-act"><button type="button" class="cta ghost" id="s-cancel">${T('cancel')}</button><button type="button" class="cta" id="s-ok">${T(existing ? 'save' : 'startBtn')}</button></div>`);
  const show = () => {
    const c = L.roundTime(st.t, S().roundStep, S().roundStart);
    body.querySelector('#sres').innerHTML = `<b>${L.fmtClock(c)}</b><span>${c !== Math.floor(st.t / MINMS) * MINMS ? T('countsRounded', { t: L.fmtClock(c) }) : T('countsHere')}</span>`;
  };
  timeWheel(body.querySelector('#sw'), L.minsOfDay(st.t), v => { let t = L.at(L.midnight(now), v); if (t > now + 5 * MINMS) t = addDays(t, -1); st.t = t; show(); }, 5);
  show();
  body.querySelector('#s-cancel').onclick = closeSheet;
  body.querySelector('#s-ok').onclick = () => {
    if (existing) { existing.start = st.t; save(); toast(T('startChanged', { t: L.fmtClock(comp(existing).start) })); renderAll(); plan(); }
    else { closeSheet(); startWork(st.t); return; }
    closeSheet();
  };
}
/** The time you usually start (the middle of your last starts), or 08:00. */
function typicalStart() {
  const last = D.shifts.filter(s => s.end != null).slice(-15).map(s => L.minsOfDay(L.roundTime(s.start, S().roundStep || 15, 'nearest'))).sort((a, b) => a - b);
  return last.length >= 3 ? last[Math.floor(last.length / 2)] : 8 * 60;
}

// ---------------------------------------------------------------- add or change a day
function openDay(sh) {
  const isNew = !sh;
  const today = L.midnight(Date.now());
  const st = isNew
    ? { day: today, start: L.at(today, typicalStart()), end: L.at(today, Math.max(typicalStart() + 60, S().otStart)), extra: S().usualBreak, note: '', edit: null }
    : { day: L.midnight(sh.start), start: sh.start, end: sh.end ?? Date.now(), extra: null, note: sh.note || '', edit: null };
  const timed = !isNew ? (sh.breaks || []).reduce((a, b) => a + ((b.end ?? Date.now()) - b.start), 0) / MINMS : 0;
  if (!isNew) st.extra = sh.extraBreak || 0;
  let breaksTouched = false;
  const days = Array.from({ length: 21 }, (_, i) => addDays(today, -i));
  const body = openSheet(`<h2 class="sh-t">${T(isNew ? 'addDay' : 'thisDay')}</h2><p class="sh-s" id="d-sub"></p>
    ${isNew ? `<div class="wheel-day" id="d-days">${days.map(d => `<button type="button" data-day="${d}"><small>${W.weekday(new Date(d).getDay(), true)}</small><b>${new Date(d).getDate()}</b></button>`).join('')}</div>` : ''}
    <div class="sh-k">${T('hours')}</div><div id="span"></div><div class="wheel-host" id="wheel-host"></div>
    <div class="sh-k">${T('breaks')}</div>
    ${timed > 0 ? `<p class="sh-s" style="margin:-4px 0 10px" id="d-timed">${T('timedNote', { d: hrs(timed) })}</p>` : ''}
    <div class="chips">${BREAKS().map(([v, l]) => `<button type="button" class="chip" data-br="${v}">${l}</button>`).join('')}</div>
    <div class="sh-k">${T('howCounts')}</div><div id="res"></div>
    <div class="sh-k">${T('note')}</div><input class="note" id="d-note" maxlength="120" placeholder="${esc(T('notePh2'))}" value="${esc(st.note)}" enterkeyhint="done">
    <div class="sh-act">${isNew ? `<button type="button" class="cta ghost" id="d-cancel">${T('cancel')}</button>` : `<button type="button" class="cta ghost" id="d-del">${T('del')}</button>`}<button type="button" class="cta" id="d-save">${T('save')}</button></div>`);
  const shape = () => ({ id: sh ? sh.id : 'new', start: st.start, end: st.end, breaks: breaksTouched || isNew ? [] : (sh.breaks || []).map(b => ({ ...b })), extraBreak: st.extra, note: st.note, round: sh && sh.round && !breaksTouched && st.start === sh.start && st.end === sh.end ? sh.round : roundingNow(), rules: sh && sh.rules ? sh.rules : rulesNow() });
  const draw = () => {
    const c = comp(shape());
    const k = dayKind(st.day);
    body.querySelector('#d-sub').textContent = `${W.day(st.day)}${k.all ? ` · ${k.hol ? T('holAll', { h: k.label }) : T('weekendAll')}` : ''}${isPaidKey(L.dayKey(st.day)) ? ` · ${T('paidNote')}` : ''}`;
    body.querySelector('#span').innerHTML = spanHtml(c, roundNote(st.start, c.start), roundNote(st.end, c.end), sh && sh.end == null);
    body.querySelector('#res').innerHTML = resultHtml(c);
    body.querySelectorAll('[data-br]').forEach(b => b.classList.toggle('on', (breaksTouched || isNew || timed <= 0) && +b.dataset.br === st.extra));
    body.querySelectorAll('[data-day]').forEach(b => b.classList.toggle('on', +b.dataset.day === st.day));
    body.querySelectorAll('[data-edit]').forEach(b => {
      b.classList.toggle('on', st.edit === b.dataset.edit);
      b.onclick = () => {
        N.haptic.tap();
        st.edit = st.edit === b.dataset.edit ? null : b.dataset.edit;
        const which = st.edit, host = body.querySelector('#wheel-host');
        host.innerHTML = '';
        draw();
        if (!which) return;
        timeWheel(host, L.minsOfDay(which === 'start' ? st.start : st.end), v => {
          if (which === 'start') { const len = st.end - st.start; st.start = L.at(st.day, v); if (st.end <= st.start) st.end = st.start + Math.max(len, 60 * MINMS); }
          else st.end = clockToTime(st.day, v, st.start);
          draw();
        }, 5);
      };
    });
  };
  body.querySelectorAll('[data-br]').forEach(b => b.onclick = () => { st.extra = +b.dataset.br; breaksTouched = true; const tm = body.querySelector('#d-timed'); if (tm) tm.remove(); N.haptic.tick(); draw(); });
  body.querySelectorAll('[data-day]').forEach(b => b.onclick = () => {
    const nd = +b.dataset.day, ms = L.minsOfDay(st.start), me = L.minsOfDay(st.end);
    st.day = nd; st.start = L.at(nd, ms); st.end = clockToTime(nd, me, st.start); N.haptic.tick(); draw();
  });
  const ok = () => {
    st.note = body.querySelector('#d-note').value.trim();
    const s2 = shape();
    if (isNew) { D.shifts.push({ ...s2, id: uid() }); toast(T('added', { day: W.dayShort(st.day), d: hrs(comp(s2).total) })); }
    else {
      Object.assign(sh, { start: s2.start, extraBreak: s2.extraBreak, note: s2.note, round: s2.round, rules: sh.end != null ? s2.rules : sh.rules });
      if (sh.end != null) sh.end = s2.end;
      if (breaksTouched) sh.breaks = [];
      toast(T('saved'));
    }
    D.shifts.sort(byStart);
    save(); N.haptic.done(); closeSheet(); renderAll(); plan();
  };
  body.querySelector('#d-save').onclick = ok;
  const cancel = body.querySelector('#d-cancel');
  if (cancel) cancel.onclick = closeSheet;
  const del = body.querySelector('#d-del');
  if (del) del.onclick = () => {
    const i = D.shifts.indexOf(sh);
    if (i < 0) return;
    D.shifts.splice(i, 1);
    save(); closeSheet(); renderAll(); plan(); N.haptic.firm();
    toast(T('deleted'), T('undo'), () => { D.shifts.push(sh); D.shifts.sort(byStart); save(); renderAll(); plan(); });
  };
  if (isNew) requestAnimationFrame(() => { const d = body.querySelector('#d-days'); if (d) d.scrollLeft = 0; });
  draw();
}

// ================================================================ LOG

let logMonth = L.midnight(new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime());
let monthMonth = logMonth;
const monthAdd = (m, n) => { const d = new Date(m); d.setMonth(d.getMonth() + n, 1); return d.getTime(); };
const monthEnd = m => monthAdd(m, 1);
function navHtml(m) {
  const cur = L.midnight(new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime());
  return `<button type="button" data-step="-1" aria-label="${T('prevMonth')}">${icon('left')}</button><span>${W.month(m)}</span><button type="button" data-step="1" aria-label="${T('nextMonth')}"${m >= cur ? ' disabled style="opacity:.3"' : ''}>${icon('right')}</button>`;
}
document.querySelectorAll('.month-nav').forEach(n => n.addEventListener('click', e => {
  const b = e.target.closest('[data-step]');
  if (!b || b.disabled) return;
  N.haptic.tick();
  if (n.dataset.nav === 'log') { logMonth = monthAdd(logMonth, +b.dataset.step); renderLog(); }
  else { monthMonth = monthAdd(monthMonth, +b.dataset.step); renderMonth(); }
}));

function renderLog() {
  document.querySelector('[data-nav="log"]').innerHTML = navHtml(logMonth);
  const now = Date.now(), from = logMonth, to = monthEnd(logMonth);
  const list = D.shifts.filter(s => s.start >= from && s.start < to).sort((a, b) => b.start - a.start);
  if (!list.length) {
    $('log').innerHTML = `<div class="empty">${icon('empty')}<b>${T('emptyLogT', { m: W.inMonth(new Date(from).getMonth(), true) })}</b><p>${T('emptyLogP')}</p></div>`;
    return;
  }
  const weeks = new Map();
  for (const s of list) { const w = L.weekStart(s.start); if (!weeks.has(w)) weeks.set(w, []); weeks.get(w).push(s); }
  const upTo = paidUpTo();
  let html = '', sepDone = false;
  for (const [w, ss] of weeks) {
    const cs = ss.map(s => comp(s, now)), t = L.totals(cs);
    const end = addDays(w, 6);
    html += `<div class="wk"><div class="wk-h"><span>${W.weekLabel(L.isoWeek(w), w, end)}</span><span><b>${hrs(t.total)}</b>${t.after ? ` · <span class="a">${hrs(t.after)}</span>` : ''}</span></div><div class="days">`;
    for (let i = 0; i < ss.length; i++) {
      const s = ss[i], c = cs[i], d = new Date(s.start), k = dayKind(s.start);
      const paid = !!upTo && L.dayKey(s.start) <= upTo;
      const cls = [k.all ? (k.hol ? 'hol' : 'we') : '', s.end == null ? 'run' : '', paid ? 'paid' : ''].join(' ');
      if (paid && !sepDone) { sepDone = true; html += `<div class="paid-sep">${icon('check')}${T('paidSep', { day: W.date(L.fromKey(upTo)) })}</div>`; }
      const sub = [c.breakMin ? T('breakLen', { d: hrs(c.breakMin) }) : T('noBreak'), k.all ? `<span class="a">${esc(k.hol ? k.label : T('weekend'))}</span>` : '', s.note ? esc(s.note) : ''].filter(Boolean).join(' · ');
      html += `<button type="button" class="drow ${cls}" data-shift="${s.id}"><div class="dd"><small>${W.weekday(d.getDay(), true)}</small><b>${d.getDate()}</b></div>
        <div class="dm"><div class="t">${L.fmtClock(c.start)} – ${s.end == null ? `${L.fmtClock(now)}<span class="nw"> · ${T('now')}</span>` : L.fmtClock(c.end)}</div><div class="s">${sub}</div></div>
        <div class="dr"><b>${hrs(c.total)}</b>${c.after ? `<small title="${esc(T('afterShort', { d: hrs(c.after) }))}"><svg class="mn" viewBox="0 0 24 24" aria-hidden="true"><path d="M10.44,2.69 A9.2,9.2 0 1 0 21.31,13.56 A7.73,7.73 0 1 1 10.44,2.69 Z"/></svg>${hrs(c.after)}</small>` : ''}</div></button>`;
    }
    html += '</div></div>';
  }
  $('log').innerHTML = html;
  stagger($('log'));
}
$('log').addEventListener('click', e => {
  const r = e.target.closest('[data-shift]');
  if (!r) return;
  const sh = D.shifts.find(s => s.id === r.dataset.shift);
  if (!sh) return;
  N.haptic.tap();
  if (sh.end == null) openEnd(sh); else openDay(sh);
});

// ================================================================ MONTH

function renderMonth() {
  document.querySelector('[data-nav="month"]').innerHTML = navHtml(monthMonth);
  const now = Date.now(), from = monthMonth, to = monthEnd(monthMonth);
  const list = D.shifts.filter(s => s.start >= from && s.start < to).sort(byStart);
  const cs = list.map(s => comp(s, now)), t = L.totals(cs);
  const pct = v => t.total ? (v / t.total * 100).toFixed(2) : 0;
  const perDay = new Map();
  for (const c of cs) { const k = L.dayKey(c.realStart); const p = perDay.get(k) || { total: 0, after: 0 }; p.total += c.total; p.after += c.after; perDay.set(k, p); }
  // the calendar
  const first = new Date(from), lead = (first.getDay() + 6) % 7, nDays = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const todayKey = L.dayKey(now);
  let cells = '';
  for (let i = 0; i < lead; i++) cells += '<div class="cell blank"></div>';
  for (let d = 1; d <= nDays; d++) {
    const day = new Date(first.getFullYear(), first.getMonth(), d).getTime(), k = L.dayKey(day), p = perDay.get(k), kind = dayKind(day);
    const hol = S().holidays && W.holiday(L.holidayName(day));
    const paidDay = p && isPaidKey(k);
    cells += `<div class="cell${p ? ' worked' : ''}${p && p.after ? ' after' : ''}${k === todayKey ? ' today' : ''}${kind.all && !hol && !p ? ' off' : ''}${hol ? ' hol' : ''}${paidDay ? ' paid' : ''}" title="${hol ? esc(hol) : ''}"><b>${d}</b>${p ? `<small>${W.dec(p.total)}${W.getLang() === 'lt' ? '' : 'h'}</small>` : ''}</div>`;
  }
  const avg = t.days ? t.total / t.days : 0;
  $('month').innerHTML = !list.length ? `<div class="empty">${icon('empty')}<b>${T('emptyMonthT', { m: W.inMonth(first.getMonth(), true) })}</b><p>${T('emptyMonthP')}</p></div>` : `
    <div class="m-hero"><div class="m-k">${T('workedIn', { m: W.inMonth(first.getMonth()) })}</div><div class="m-big">${bigDur(t.total)}</div><div class="m-k" style="margin-top:2px">${W.inDays(t.days)}</div>
      <div class="m-bar"><i style="width:${pct(t.normal)}%"></i><i class="a" style="width:${pct(t.after)}%"></i></div>
      <div class="m-legend"><span><b>${hrs(t.normal)}</b> ${T('normal')}</span><span class="a"><b>${hrs(t.after)}</b> ${T('afterHours')}</span></div></div>
    <div class="card">
      <div class="row"><span>${T('afterOnWorkdays', { t: L.fmtMins(S().otStart) })}</span><b class="a">${hrs(t.evening)}</b></div>
      <div class="row"><span>${T('weekends')}</span><b class="a">${hrs(t.weekend)}</b></div>
      <div class="row"><span>${T('holidays')}</span><b class="a">${hrs(t.holiday)}</b></div>
      <div class="row"><span>${T('breaksTaken')}</span><b>${hrs(t.breakMin)}</b></div>
      <div class="row"><span>${T('avgDay')}</span><b>${hrs(avg)}</b></div>
    </div>
    <div class="cal"><div class="cal-h">${W.weekLetters().map(x => `<span>${x}</span>`).join('')}</div><div class="cal-g">${cells}</div></div>
    <div class="actions"><button type="button" class="btn" id="m-csv">${icon('sheet')}${T('sheet')}</button><button type="button" class="btn" id="m-share">${icon('share')}${T('shareSum')}</button></div>`;
  stagger($('month'));
  if ($('month').classList.contains('stag')) {
    // the month's bar fills from nothing
    const bars = [...$('month').querySelectorAll('.m-bar i')], w = bars.map(b => b.style.width);
    bars.forEach(b => b.style.width = '0%');
    void $('month').offsetWidth;
    requestAnimationFrame(() => bars.forEach((b, i) => b.style.width = w[i]));
  }
  const csv = $('m-csv'), sh = $('m-share');
  if (csv) csv.onclick = async () => {
    N.haptic.tap();
    // Lithuanian spreadsheets read ';' between columns and ',' in numbers; the mark at the start keeps ą, č, ę... intact in Excel
    const lt = W.getLang() === 'lt', ot = L.fmtMins(S().otStart);
    const text = '\ufeff' + L.toCSV(cs, { head: W.list('csv').map(h => h.replace('{t}', ot)), day: wd => W.weekday(wd), dec: W.dec, sep: lt ? ';' : ',' });
    await N.shareFile(`afterhours-${L.dayKey(from).slice(0, 7)}.csv`, text, 'text/csv', T('hoursTitle', { m: W.month(from) }));
  };
  if (sh) sh.onclick = async () => {
    N.haptic.tap();
    const text = T('sumText', { m: W.month(from), d: hrs(t.total), days: W.inDays(t.days), n: hrs(t.normal), a: hrs(t.after), t: L.fmtMins(S().otStart), e: hrs(t.evening), w: hrs(t.weekend), h: hrs(t.holiday) });
    const r = await N.shareText(text, T('hoursTitle', { m: W.month(from) }));
    if (r === 'copied') toast(T('copied'));
  };
}

// ================================================================ PAY
// Only after hours count here. "They paid me" marks every day up to a chosen one as paid: those days turn grey and
// stop counting, and counting starts again from the next day.

const paidUpTo = () => (D.payouts || []).reduce((m, p) => p.upTo > m ? p.upTo : m, '');
const isPaidKey = k => { const u = paidUpTo(); return !!u && k <= u; };
const amountFor = mins => S().rate ? Math.round(mins / 60 * S().rate * 100) / 100 : null;
/** After hours not paid yet: every day after the last payout, today's running day included. */
function owedNow(now = Date.now()) {
  const u = paidUpTo();
  const list = D.shifts.filter(s => !u || L.dayKey(s.start) > u).sort(byStart).map(s => comp(s, now));
  const t = L.totals(list), withAfter = list.filter(c => c.after > 0);
  return { t, list, days: new Set(withAfter.map(c => L.dayKey(c.realStart))).size, from: withAfter.length ? withAfter[0].realStart : null };
}
function renderPay() {
  const o = owedNow(), rate = S().rate, pays = [...(D.payouts || [])].sort((a, b) => b.upTo.localeCompare(a.upTo));
  const box = $('pay');
  if (!D.shifts.length && !pays.length) {
    box.innerHTML = `<div class="empty">${icon('empty')}<b>${T('emptyPayT')}</b><p>${T('emptyPayP')}</p></div>${rate ? '' : `<button type="button" class="p-invite" id="p-rate"><b>${T('noRateT')}</b><span>${T('noRateS')}</span></button>`}`;
    const r0 = $('p-rate');
    if (r0) r0.onclick = () => { N.haptic.tap(); openRate(); };
    return;
  }
  const owedMoney = amountFor(o.t.after);
  let html = `<div class="p-hero">
      <div class="m-k">${o.t.after ? T('owed') : T('allPaid')}</div>
      <div class="m-big p-big" id="p-big">${o.t.after && rate ? W.bigMoney(owedMoney) : bigDur(o.t.after)}</div>
      <div class="m-k p-sub">${o.t.after ? `${rate ? T('forHours', { d: hrs(o.t.after) }) : T('notPaidHours')}${o.from ? ' · ' + T('since', { day: W.date(o.from) }) : ''}` : T('allPaidS')}</div>
    </div>`;
  html += rate
    ? `<button type="button" class="card p-rate" id="p-rate"><span>${T('rateRow')}</span><b>${T('perHour', { v: W.money(rate) })}</b>${icon('right')}</button>`
    : `<button type="button" class="p-invite" id="p-rate"><b>${T('noRateT')}</b><span>${T('noRateS')}</span></button>`;
  if (o.t.after) {
    const row = (label, m) => `<div class="row"><span>${label}</span><b class="a">${hrs(m)}${rate && m ? `<small class="p-m">${W.money(amountFor(m))}</small>` : ''}</b></div>`;
    html += `<div class="card">${row(T('afterOnWorkdays', { t: L.fmtMins(S().otStart) }), o.t.evening)}${o.t.weekend ? row(T('weekends'), o.t.weekend) : ''}${o.t.holiday ? row(T('holidays'), o.t.holiday) : ''}
      <div class="row"><span>${T('daysRow')}</span><b>${o.days}</b></div></div>`;
  }
  const canPay = o.list.some(c => !c.running);
  html += `<div class="p-act">${canPay ? `<button type="button" class="cta" id="p-paid">${icon('check')}${T('paidBtn')}</button>` : ''}${o.t.after ? `<button type="button" class="btn" id="p-share">${icon('share')}${T('share')}</button>` : ''}</div>`;
  if (pays.length) html += `<div class="p-hist"><div class="sh-k">${T('history')}</div><div class="days">${pays.map((p, i) => `<div class="p-row"><div><b>${W.range(L.fromKey(p.from || p.upTo), L.fromKey(p.upTo))}</b><span>${hrs(p.after || 0)}${p.amount != null ? ' · ' + W.money(p.amount) : ''}</span></div>${i === 0 ? `<button type="button" class="p-undo" data-undo="${esc(p.id)}">${T('undo')}</button>` : `${icon('check', 'p-ok')}`}</div>`).join('')}</div></div>`;
  box.innerHTML = html;
  $('p-rate').onclick = () => { N.haptic.tap(); openRate(); };
  const pp = $('p-paid'), ps = $('p-share');
  if (pp) pp.onclick = () => { N.haptic.tap(); openPaid(); };
  if (ps) ps.onclick = async () => {
    N.haptic.tap();
    const text = T('owedText', { d: hrs(o.t.after), day: o.from ? W.date(o.from) : '', money: rate ? ' = ' + W.money(owedMoney) : '' });
    const r = await N.shareText(text, T('payTab'));
    if (r === 'copied') toast(T('copied'));
  };
  const un = box.querySelector('[data-undo]');
  if (un) un.onclick = () => {
    const i = D.payouts.findIndex(p => p.id === un.dataset.undo);
    if (i < 0) return;
    const [gone] = D.payouts.splice(i, 1);
    save(); N.haptic.firm(); renderAll();
    toast(T('payoutRemoved'), T('undo'), () => { D.payouts.push(gone); save(); renderAll(); });
  };
  const animate = staggerNext;
  stagger(box);
  if (animate && rate && o.t.after) countMoney($('p-big'), owedMoney);
}
/** The amount counts up when the tab opens. */
function countMoney(el, to) {
  if (!el || !(to > 0) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const t0 = performance.now(), dur = 800;
  const step = t => {
    const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    el.innerHTML = W.bigMoney(k < 1 ? Math.round(to * e) : to);
    if (k < 1 && el.isConnected) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
/** "They paid me": pick the last paid day. */
function openPaid() {
  const u = paidUpTo();
  const days = [...new Set(D.shifts.filter(s => s.end != null && (!u || L.dayKey(s.start) > u)).map(s => L.dayKey(s.start)))].sort().reverse().slice(0, 62);
  if (!days.length) { toast(T('nothingToPay')); return; }
  const st = { upTo: days[0] };
  const body = openSheet(`<h2 class="sh-t">${T('paidT')}</h2><p class="sh-s">${T('paidS')}</p>
    <div class="wheel-day" id="pd-days">${days.map(k => { const d = L.fromKey(k); return `<button type="button" data-k="${k}"><small>${W.weekday(new Date(d).getDay(), true)}</small><b>${new Date(d).getDate()}</b></button>`; }).join('')}</div>
    <div class="result col" id="pd-res"></div>
    <div class="sh-act"><button type="button" class="cta ghost" id="pd-cancel">${T('cancel')}</button><button type="button" class="cta" id="pd-ok">${T('markPaid')}</button></div>`);
  const pick = () => {
    const list = D.shifts.filter(s => { const k = L.dayKey(s.start); return s.end != null && (!u || k > u) && k <= st.upTo; }).map(s => comp(s));
    const t = L.totals(list), m = amountFor(t.after);
    body.querySelector('#pd-res').innerHTML = `<b>${T('paidUpToLong', { day: W.date(L.fromKey(st.upTo)) })}</b><span>${T('paidWill', { n: W.daysN(t.days), d: hrs(t.after) })}${m != null ? `<br><span class="a">${W.money(m)}</span>` : ''}</span>`;
    body.querySelectorAll('[data-k]').forEach(b => b.classList.toggle('on', b.dataset.k === st.upTo));
    return { list, t, m };
  };
  body.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { st.upTo = b.dataset.k; N.haptic.tick(); pick(); });
  body.querySelector('#pd-cancel').onclick = closeSheet;
  body.querySelector('#pd-ok').onclick = () => {
    const { list, t, m } = pick();
    const first = list.length ? L.dayKey(Math.min(...list.map(c => c.realStart))) : st.upTo;
    const p = { id: uid(), from: first, upTo: st.upTo, at: Date.now(), after: t.after, days: t.days, rate: S().rate || null, amount: m };
    D.payouts.push(p);
    save(); N.haptic.done(); closeSheet(); renderAll();
    toast(T('paidToast', { day: W.date(L.fromKey(st.upTo)) }), T('undo'), () => { D.payouts = D.payouts.filter(x => x.id !== p.id); save(); renderAll(); });
  };
  pick();
}
/** Your pay for one hour after hours. */
function openRate() {
  const lt = W.getLang() === 'lt', rate = S().rate;
  const shown = rate ? (lt ? String(rate).replace('.', ',') : String(rate)) : '';
  const body = openSheet(`<h2 class="sh-t">${T('rateT')}</h2><p class="sh-s">${T('rateS')}</p>
    <label class="rate-in"><input id="r-in" type="text" inputmode="decimal" enterkeyhint="done" autocomplete="off" placeholder="${lt ? '0,00' : '0.00'}" value="${esc(shown)}"><span>€ / ${T('hUnit')}</span></label>
    <p class="example" id="r-ex"></p>
    <div class="sh-act">${rate ? `<button type="button" class="cta ghost" id="r-clear">${T('rateClear')}</button>` : `<button type="button" class="cta ghost" id="r-cancel">${T('cancel')}</button>`}<button type="button" class="cta" id="r-save">${T('save')}</button></div>`);
  const input = body.querySelector('#r-in');
  const read = () => { const v = parseFloat(input.value.replace(',', '.').replace(/[^\d.]/g, '')); return v > 0 && v < 10000 ? Math.round(v * 100) / 100 : null; };
  const ex = () => { const v = read(); body.querySelector('#r-ex').textContent = v ? T('rateEx', { v: W.money(v * 10) }) : ''; };
  input.addEventListener('input', ex);
  ex();
  const done = v => { S().rate = v; save(); N.haptic.done(); closeSheet(); renderAll(); if (v) toast(T('rateSaved', { v: W.money(v) })); };
  body.querySelector('#r-save').onclick = () => { const v = read(); if (!v) { toast(T('rateBad')); input.focus(); return; } done(v); };
  input.addEventListener('keydown', e => { if (e.key === 'Enter') body.querySelector('#r-save').click(); });
  const c = body.querySelector('#r-clear'), x = body.querySelector('#r-cancel');
  if (c) c.onclick = () => done(null);
  if (x) x.onclick = closeSheet;
  setTimeout(() => input.focus(), 380);
}

/** The screen's measurements (Settings: tap the version line five times), for sorting out spacing on a phone. */
function screenInfo() {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)';
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe), envT = parseFloat(cs.paddingTop), envB = parseFloat(cs.paddingBottom);
  probe.remove();
  const root = getComputedStyle(document.documentElement);
  const v = n => (root.getPropertyValue(n) || '–').trim();
  const wv = (navigator.userAgent.match(/Chrome\/(\d+)/) || [])[1] || '?';
  const t = $('today');
  return `${innerWidth}×${innerHeight} of ${screen.width}×${screen.height} @${devicePixelRatio} · bars ${v('--safe-area-inset-top')}/${v('--safe-area-inset-bottom')} · env ${envT}/${envB} · used ${v('--bars-top') || 'env'} · WebView ${wv} · ${t ? t.className.replace('today', '').trim() || 'normal' : ''}`;
}

// ================================================================ SETTINGS

function openSettings() {
  const s = S();
  const tog = (key, on, label) => `<button type="button" class="toggle${on ? ' on' : ''}" data-tog="${key}" role="switch" aria-checked="${on}" aria-label="${esc(label || key)}"></button>`;
  const seg = (key, opts, cur) => `<div class="seg" data-seg="${key}">${opts.map(([v, l]) => `<button type="button" data-v="${v}" class="${String(v) === String(cur) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const tbtn = key => `<button type="button" class="time-btn" data-time="${key}">${L.fmtMins(s[key])}</button>`;
  const example = () => {
    const base = L.midnight(Date.now());
    const a = L.at(base, 7 * 60 + 52), b = L.at(base, 18 * 60 + 48);
    if (!s.roundStep) return T('exExact');
    return T('ex', { a: L.fmtClock(L.roundTime(a, s.roundStep, s.roundStart)), b: L.fmtClock(L.roundTime(b, s.roundStep, s.roundEnd)) });
  };
  const html = `<h2 class="sh-t">${T('settings')}</h2><p class="sh-s">${T('setSub')}</p>
    ${update ? `<button type="button" class="upd" id="st-upd"><b>${T('updCard', { v: esc(update.v) })}</b><span>${T('updCardS')}</span></button>` : ''}
    <div class="sh-k">${T('sLang')}</div>${seg('lang', [['system', T('likePhone')], ['en', 'English'], ['lt', 'Lietuvių']], s.lang)}
    <div class="sh-k">${T('sAfter')}</div><div class="card" style="margin-top:0">
      <div class="set-row"><span>${T('sStarts')}<small>${T('sStartsS')}</small></span>${tbtn('otStart')}</div>
      <div class="wheel-host" data-wheel="otStart"></div>
      <div class="set-row"><span>${T('sWeekends')}<small>${T('sWeekendsS')}</small></span>${tog('weekends', s.weekends, T('sWeekends'))}</div>
      <div class="set-row"><span>${T('sHol')}<small>${T('sHolS')}</small></span>${tog('holidays', s.holidays, T('sHol'))}</div>
      <div class="set-row"><span>${T('sEarly')}<small>${T('sEarlyS')}</small></span>${tbtn('dayStart')}</div>
      <div class="wheel-host" data-wheel="dayStart"></div>
    </div>
    <div class="sh-k">${T('sRound')}</div><div class="card" style="margin-top:0">
      <div class="set-row col"><span>${T('sRoundTo')}</span>${seg('roundStep', [[0, T('exact')], [15, T('m15')], [30, T('m30')], [60, T('hourW')]], s.roundStep)}</div>
      <div class="set-row col" ${s.roundStep ? '' : 'hidden'}><span>${T('sStartR')}</span>${seg('roundStart', [['nearest', T('nearest')], ['down', T('down')], ['up', T('up')]], s.roundStart)}</div>
      <div class="set-row col" ${s.roundStep ? '' : 'hidden'}><span>${T('sEndR')}</span>${seg('roundEnd', [['up', T('up')], ['nearest', T('nearest')], ['down', T('down')]], s.roundEnd)}<p class="example" id="ex">${example()}</p></div>
    </div>
    <div class="sh-k">${T('sBreaks')}</div><div class="card" style="margin-top:0">
      <div class="set-row"><span>${T('sAsk')}<small>${T('sAskS')}</small></span>${tog('askBreaks', s.askBreaks, T('sAsk'))}</div>
      <div class="set-row col"><span>${T('sUsual')}<small>${T('sUsualS')}</small></span><div class="chips" style="margin-top:10px">${BREAKS().map(([v, l]) => `<button type="button" class="chip${v === s.usualBreak ? ' on' : ''}" data-ub="${v}">${l}</button>`).join('')}</div></div>
    </div>
    <div class="sh-k">${T('sRem')}</div><div class="card" style="margin-top:0">
      ${N.isNative ? '' : `<div class="set-row"><span><small style="margin:0">${T('sRemWeb')}</small></span></div>`}
      <div class="set-row"><span>${T('sRemStart')}<small>${T('sRemStartS')}</small></span>${tbtn('startAt')}${tog('remindStart', s.remindStart, T('sRemStart'))}</div>
      <div class="wheel-host" data-wheel="startAt"></div>
      <div class="set-row col"><span>${T('sDays')}</span><div class="days-pick">${[1, 2, 3, 4, 5, 6, 0].map(d => `<button type="button" data-wd="${d}" class="${s.workDays.includes(d) ? 'on' : ''}" aria-label="${W.weekday(d)}">${W.weekday(d, true).slice(0, 2)}</button>`).join('')}</div></div>
      <div class="set-row"><span>${T('sRemLate')}<small>${T('sRemLateS')}</small></span>${tbtn('lateAt')}${tog('remindLate', s.remindLate, T('sRemLate'))}</div>
      <div class="wheel-host" data-wheel="lateAt"></div>
      <div class="set-row"><span>${T('sRemBreak')}<small>${T('sRemBreakS')}</small></span>${tbtn('breakAt')}${tog('remindBreak', s.remindBreak, T('sRemBreak'))}</div>
      <div class="wheel-host" data-wheel="breakAt"></div>
    </div>
    <div class="sh-k">${T('sLook')}</div>${seg('theme', [['system', T('likePhone')], ['dark', T('dark')], ['light', T('light')]], s.theme)}
    <div class="sh-k">${T('sData')}</div><div class="card" style="margin-top:0">
      ${N.isNative ? `<div class="set-row"><span>${T('sUpd')}<small>${T('sUpdS')}</small></span>${tog('updates', s.updates !== false, T('sUpd'))}</div>` : ''}
      <button type="button" class="set-row" style="width:100%;text-align:left" id="st-backup"><span>${T('backup')}<small>${T('backupS')}</small></span></button>
      <button type="button" class="set-row" style="width:100%;text-align:left" id="st-restore"><span>${T('restore')}<small>${T('restoreS')}</small></span></button>
      <button type="button" class="set-row" style="width:100%;text-align:left" id="st-wipe"><span style="color:#E5675A">${T('wipe')}</span></button>
    </div>
    <p class="about">${T('about', { v: VERSION })}</p>`;
  const body = openSheet(html, { full: true });
  const changed = () => { save(); renderAll(); plan(); };
  const ab = body.querySelector('.about');
  let abTaps = 0;
  if (ab) ab.onclick = () => { if (++abTaps === 5) ab.insertAdjacentHTML('afterend', `<p class="diag">${esc(screenInfo())}</p>`); };
  const up = body.querySelector('#st-upd');
  if (up) up.onclick = () => { N.haptic.tap(); N.openUrl(update.url); };
  body.querySelectorAll('[data-tog]').forEach(b => b.onclick = async () => {
    const k = b.dataset.tog, on = !s[k];
    if (on && /^remind/.test(k) && N.isNative) {
      let p = await N.notifyState();
      if (p !== 'granted') p = await N.askNotify();
      if (p !== 'granted') { toast(T('notifOff')); return; }
    }
    s[k] = on; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); N.haptic.tick(); changed();
    if (k === 'updates' && on) checkUpdate(true);
  });
  body.querySelectorAll('[data-seg]').forEach(g => g.addEventListener('click', e => {
    const b = e.target.closest('[data-v]'); if (!b) return;
    const k = g.dataset.seg, v = b.dataset.v;
    s[k] = k === 'roundStep' ? +v : v;
    g.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    N.haptic.tick();
    if (k === 'roundStep') body.querySelectorAll('[data-seg="roundStart"], [data-seg="roundEnd"]').forEach(x => x.closest('.set-row').hidden = !s.roundStep);
    if (k === 'theme') applyTheme();
    if (k === 'lang') { applyLang(); save(); renderAll(); plan(); closeSheet(); setTimeout(openSettings, 400); return; }
    const ex = body.querySelector('#ex'); if (ex) ex.innerHTML = example();
    changed();
  }));
  body.querySelectorAll('[data-ub]').forEach(b => b.onclick = () => { s.usualBreak = +b.dataset.ub; body.querySelectorAll('[data-ub]').forEach(x => x.classList.toggle('on', x === b)); N.haptic.tick(); changed(); });
  body.querySelectorAll('[data-wd]').forEach(b => b.onclick = () => {
    const d = +b.dataset.wd, i = s.workDays.indexOf(d);
    if (i >= 0) s.workDays.splice(i, 1); else s.workDays.push(d);
    b.classList.toggle('on', i < 0); N.haptic.tick(); changed();
  });
  body.querySelectorAll('[data-time]').forEach(b => b.onclick = () => {
    const k = b.dataset.time, host = body.querySelector(`[data-wheel="${k}"]`);
    const open = host.childElementCount > 0;
    body.querySelectorAll('.wheel-host[data-wheel]').forEach(h => h.innerHTML = '');
    if (open) return;
    host.style.padding = '0 12px 12px';
    timeWheel(host, s[k], v => { s[k] = v; b.textContent = L.fmtMins(v); changed(); }, k === 'otStart' || k === 'dayStart' ? 15 : 5);
  });
  body.querySelector('#st-backup').onclick = async () => {
    await N.shareFile(`afterhours-backup-${L.dayKey(Date.now())}.json`, JSON.stringify({ app: 'afterhours', ...D }, null, 1), 'application/json', T('backupTitle'));
  };
  body.querySelector('#st-restore').onclick = async () => {
    const text = await N.pickFile('application/json,.json');
    if (!text) return;
    try {
      const d = JSON.parse(text);
      if (!d || !Array.isArray(d.shifts)) throw new Error('not a backup');
      const have = new Set(D.shifts.map(x => x.id));
      let n = 0;
      for (const x of d.shifts) if (x && typeof x.start === 'number' && !have.has(x.id)) { D.shifts.push({ breaks: [], extraBreak: 0, note: '', ...x }); n++; }
      D.shifts.sort(byStart);
      const havePay = new Set(D.payouts.map(x => x.id));
      for (const x of Array.isArray(d.payouts) ? d.payouts : []) if (x && x.upTo && !havePay.has(x.id)) D.payouts.push(x);
      changed();
      toast(n ? T('restored', { n }) : T('restoredNone'));
    } catch { toast(T('notBackup')); }
  };
  body.querySelector('#st-wipe').onclick = () => {
    const b = body.querySelector('#st-wipe');
    if (!b.dataset.sure) { b.dataset.sure = '1'; b.querySelector('span').textContent = T('wipeSure'); setTimeout(() => { if (b.isConnected) { delete b.dataset.sure; b.querySelector('span').textContent = T('wipe'); } }, 4000); return; }
    const old = D.shifts, oldPay = D.payouts;
    D.shifts = [];
    D.payouts = [];
    changed(); closeSheet(); N.haptic.firm();
    toast(T('wiped'), T('undo'), () => { D.shifts = old; D.payouts = oldPay; changed(); });
  };
}

// ================================================================ first run

function welcome(again) {
  const w = document.createElement('div');
  w.className = 'welcome' + (again ? ' again' : '');
  const cur = W.getLang();
  w.innerHTML = `<div class="w-lang" role="group" aria-label="${T('sLang')}"><button type="button" data-l="en" lang="en" class="${cur === 'en' ? 'on' : ''}" aria-pressed="${cur === 'en'}">EN</button><button type="button" data-l="lt" lang="lt" class="${cur === 'lt' ? 'on' : ''}" aria-pressed="${cur === 'lt'}">LT</button></div>
    <svg class="mark w-mark" viewBox="0 0 24 24" aria-hidden="true"><path class="mk-moon" d="M10.44,2.69 A9.2,9.2 0 1 0 21.31,13.56 A7.73,7.73 0 1 1 10.44,2.69 Z"/><path class="mk-star" d="M16.9,4.62 L17.45,6.55 L19.38,7.1 L17.45,7.65 L16.9,9.58 L16.35,7.65 L14.42,7.1 L16.35,6.55 Z"/></svg>
    <h1>${T('wTitle')}</h1>
    <p class="lead">${T('wLead')}</p>
    <div class="w-list">
      <div class="w-item"><i>${icon('tap')}</i><div><b>${T('w1')}</b><span>${T('w1s')}</span></div></div>
      <div class="w-item"><i class="d">${icon('moon')}</i><div><b>${T('w2')}</b><span>${T('w2s')}</span></div></div>
      <div class="w-item"><i>${icon('bell')}</i><div><b>${T('w3')}</b><span>${T('w3s')}</span></div></div>
    </div>
    <div class="w-go"><button type="button" class="cta" id="w-go">${T('wGo')}</button><p class="fine">${T('wFine')}</p></div>`;
  document.body.appendChild(w);
  w.querySelectorAll('[data-l]').forEach(b => b.onclick = () => {
    if (b.dataset.l === W.getLang()) return;
    N.haptic.tick();
    S().lang = b.dataset.l;
    applyLang(); renderAll();
    w.remove(); welcome(true);
  });
  w.querySelector('#w-go').onclick = async () => {
    N.haptic.firm();
    if (N.isNative) {
      const p = await N.askNotify();
      if (p !== 'granted') { S().remindStart = false; S().remindLate = false; }
    }
    D.onboarded = true;
    save();
    w.style.transition = 'opacity .3s, transform .3s'; w.style.opacity = '0'; w.style.transform = 'translateY(-8px)';
    setTimeout(() => w.remove(), 320);
    plan();
  };
}

// ================================================================ reminders

let planT = 0;
function plan() { clearTimeout(planT); planT = setTimeout(planNow, 250); }
async function planNow() {
  if (!N.isNative || DEMO) return;
  const s = S(), now = Date.now(), today = L.midnight(now), r = running(), list = [];
  if (s.remindStart) {
    for (let d = 0; d < 14; d++) {
      const day = addDays(today, d), wd = new Date(day).getDay();
      if (!s.workDays.includes(wd) || (s.holidays && L.holidayName(day))) continue;
      if (d === 0 && (r || D.shifts.some(x => L.midnight(x.start) === today))) continue;
      list.push({ id: 100 + d, at: L.at(day, s.startAt), title: T('nStartT'), body: T('nStartB'), act: 'start' });
    }
  }
  if (r) {
    if (s.remindLate) {
      const late = L.at(L.midnight(r.start), s.lateAt);
      if (late > now) list.push({ id: 200, at: late, title: T('nLateT'), body: T('nLateB'), act: 'end' });
      list.push({ id: 201, at: L.at(addDays(L.midnight(r.start), 1), 7 * 60 + 30), title: T('nYestT'), body: T('nYestB'), act: 'end' });
    }
    const open = r.breaks.find(b => b.end == null);
    if (open) list.push({ id: 202, at: open.start + 75 * MINMS, title: T('nBackT'), body: T('nBackB'), act: 'back' });
    if (s.remindBreak && !r.breaks.length) list.push({ id: 203, at: L.at(L.midnight(r.start), s.breakAt), title: T('nBrkT'), body: T('nBrkB'), act: 'break' });
  }
  await N.setReminders(list, { name: T('channel'), description: T('channelD') });
}
N.onReminderTap(act => {
  const r = running();
  if (act === 'start' && !r) openStart();
  else if (act === 'end' && r) openEnd(r, r.start < L.midnight(Date.now()) ? L.at(L.midnight(r.start), Math.max(S().otStart, 19 * 60)) : undefined);
  else if (act === 'back' && r && r.breaks.some(b => b.end == null)) toggleBreak();
  else if (act === 'break' && r && !r.breaks.some(b => b.end == null)) toggleBreak();
});

// ================================================================ tabs, back button, refresh

let tab = 'today';
let staggerNext = false;
function go(t) {
  if (t === tab) return;
  const prev = tab;
  tab = t;
  document.body.dataset.tab = t;
  const order = ['today', 'log', 'month', 'pay'], dir = Math.sign(order.indexOf(t) - order.indexOf(prev));
  for (const v of order) { const el = $('v-' + v); el.hidden = v !== t; el.classList.remove('enter'); if (v === t) { el.style.setProperty('--dx', dir * 18 + 'px'); void el.offsetWidth; el.classList.add('enter'); } }
  staggerNext = true;
  document.querySelectorAll('#tabs [data-tab]').forEach((b, i) => { b.classList.toggle('on', b.dataset.tab === t); if (b.dataset.tab === t) document.querySelector('.tab-ind').style.transform = `translateX(${i * 100}%)`; });
  if (t === 'log') renderLog();
  if (t === 'month') renderMonth();
  if (t === 'pay') renderPay();
  if (t === 'today') { drawn = true; renderToday(); }
  staggerNext = false;
}
/** When a tab opens, its blocks rise in one after another (only then, not on every refresh). */
function stagger(box) {
  box.classList.remove('stag');
  if (!staggerNext || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  [...box.children].forEach((c, i) => c.style.setProperty('--k', Math.min(i, 8)));
  void box.offsetWidth;
  box.classList.add('stag');
  clearTimeout(box._stag);
  box._stag = setTimeout(() => box.classList.remove('stag'), 1100);
}
$('tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) { N.haptic.tick(); go(b.dataset.tab); } });
document.addEventListener('click', e => {
  const o = e.target.closest('[data-open]');
  if (!o) return;
  N.haptic.tap();
  if (o.dataset.open === 'settings') openSettings();
  if (o.dataset.open === 'add') openDay(null);
});
N.onBack(() => {
  if (closeSheet()) return;
  if (tab !== 'today') { go('today'); return; }
  N.exitApp();
});

function renderAll() { renderToday(); if (tab === 'log') renderLog(); if (tab === 'month') renderMonth(); if (tab === 'pay') renderPay(); }
setInterval(() => { if (!document.hidden) { renderToday(); if (tab === 'log' && running()) renderLog(); if (tab === 'pay' && running()) renderPay(); } }, 20000);
let forgotAsked = false;
function checkForgot() {
  const r = running();
  if (!r || forgotAsked || DEMO) return;
  if (Date.now() - r.start > 16 * 3600000 && $('sheet').hidden) {
    forgotAsked = true;
    openEnd(r, L.at(L.midnight(r.start), Math.max(S().otStart, 19 * 60)));
    toast(T('forgot'));
  }
}
N.onResume(() => { renderAll(); plan(); checkForgot(); checkUpdate(); });

// ================================================================ the hours' second copy
// If the WebView's storage ever comes back empty, the hours are read back from the copy in the app's own files.
async function recover() {
  if (DEMO || !N.isNative) return;
  const text = await N.mirrorLoad();
  if (localStorage.getItem(KEY)) { if (!text) N.mirrorSave(localStorage.getItem(KEY)); return; }
  if (!text) return;
  try {
    const d = JSON.parse(text);
    if (!d || d.v !== 1 || !Array.isArray(d.shifts) || (!d.shifts.length && !d.onboarded)) return;
    D = upgrade(d);
    window.__ah.D = D;
    save();
    applyLang(); applyTheme(); renderAll(); plan();
    if (D.onboarded) document.querySelectorAll('.welcome').forEach(w => w.remove());
  } catch (e) { console.warn(e); }
}

// ================================================================ updates
// Afterhours comes from stezy.lt, not a store, so once a day it looks there for a newer version.
const UPD = 'afterhours.update';
const newer = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); return false; };
let update = null;
async function checkUpdate(force) {
  if (DEMO || !N.isNative || S().updates === false) return;
  let st = {};
  try { st = JSON.parse(localStorage.getItem(UPD) || '{}') || {}; } catch {}
  update = st.v && newer(st.v, VERSION) ? st : null;
  if (!force && st.at && Date.now() - st.at < 20 * 3600000) { if (update) offerUpdate(st); return; }
  try {
    const r = await fetch('https://stezy.lt/play/afterhours/latest.json', { cache: 'no-store' });
    if (!r.ok) return;
    const j = await r.json();
    if (!j || !j.version || !/^https:\/\//.test(j.url || '')) return;
    st = { at: Date.now(), v: j.version, url: j.url, told: st.told };
    localStorage.setItem(UPD, JSON.stringify(st));
    update = newer(j.version, VERSION) ? st : null;
    if (update) offerUpdate(st);
  } catch {}
}
function offerUpdate(st) {
  if (st.told === st.v || !$('sheet').hidden) return;
  st.told = st.v;
  try { localStorage.setItem(UPD, JSON.stringify(st)); } catch {}
  toast(T('updT', { v: st.v }), T('updGet'), () => N.openUrl(st.url));
}

// ================================================================ the opening
/** A short opening on every start: the moon lifts over a horizon and the name appears; then the day draws itself. Tap to skip. */
function intro() {
  if (QS.has('nointro') || matchMedia('(prefers-reduced-motion: reduce)').matches) return Promise.resolve();
  const el = document.createElement('div');
  el.className = 'intro';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `<i class="in-glow"></i><svg class="in-moon" viewBox="0 0 108 108"><defs><linearGradient id="inm" gradientUnits="userSpaceOnUse" x1="31.5" y1="76.5" x2="65.1" y2="42.9"><stop offset="0" stop-color="#F6DCB6"/><stop offset=".55" stop-color="#E8AD6B"/><stop offset="1" stop-color="#C9813F"/></linearGradient></defs><path d="M50.66,28.99 A24,24 0 1 0 79.01,57.34 A20.16,20.16 0 1 1 50.66,28.99 Z" fill="url(#inm)"/><path class="in-star" d="M67.5,34.02 L68.93,39.07 L73.98,40.5 L68.93,41.93 L67.5,46.98 L66.07,41.93 L61.02,40.5 L66.07,39.07 Z"/></svg><i class="in-line"></i><b class="in-name">After<em>hours</em></b>`;
  document.body.appendChild(el);
  return new Promise(res => {
    let done = false;
    const finish = () => { if (done) return; done = true; el.classList.add('out'); res(); setTimeout(() => el.remove(), 450); };
    setTimeout(finish, 1500);
    el.addEventListener('pointerdown', finish, { once: true });
  });
}

// ================================================================ demo (the live demo on stezy.lt): made-up hours

function demoData() {
  const lt = window.AFTERHOURS_LANG === 'lt' || QS.get('lang') === 'lt' || (!QS.get('lang') && !window.AFTERHOURS_LANG && /^lt/i.test(navigator.language || ''));
  const NOTES = lt ? ['Inventorizacija', 'Naujas pristatymas', 'Pavadavau kolegą'] : ['Stock count', 'New delivery', 'Covering for a colleague'];
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const d = blank();
  d.onboarded = true;
  if (QS.get('lang') || window.AFTERHOURS_LANG) d.settings.lang = QS.get('lang') || window.AFTERHOURS_LANG;
  const now = Date.now(), today = L.midnight(now);
  for (let i = 45; i >= 1; i--) {
    const day = addDays(today, -i), wd = new Date(day).getDay();
    if (wd === 0) continue;
    if (wd === 6 && rnd() > .3) continue;
    const st = wd === 6 ? 9 * 60 + Math.round(rnd() * 20) : 7 * 60 + 50 + Math.round(rnd() * 22);
    const len = wd === 6 ? 240 + Math.round(rnd() * 120) : 600 + Math.round(rnd() * 200) + (rnd() > .6 ? 120 : 0);
    const s = L.at(day, st), e = s + len * MINMS;
    d.shifts.push({ id: 'd' + i, start: s, end: e, breaks: [], extraBreak: wd === 6 ? 0 : [30, 30, 45, 60][Math.floor(rnd() * 4)], note: rnd() > .85 ? NOTES[Math.floor(rnd() * 3)] : '', round: { step: 60, start: 'nearest', end: 'up' } });
  }
  d.settings.rate = 9.5;
  const paidTo = L.dayKey(addDays(today, -8)), paidList = d.shifts.filter(s => L.dayKey(s.start) <= paidTo).map(s => L.computeShift(s, d.settings));
  const pt = L.totals(paidList);
  if (paidList.length) d.payouts = [{ id: 'dp1', from: L.dayKey(paidList[0].realStart), upTo: paidTo, at: now, after: pt.after, days: pt.days, rate: 9.5, amount: Math.round(pt.after / 60 * 9.5 * 100) / 100 }];
  const h = new Date(now).getHours();
  if (h >= 8 && new Date(now).getDay() !== 0) {
    // a day still running, or (late at night) one that ended at 21:40
    const s = L.at(today, 7 * 60 + 56);
    const b = L.at(today, 12 * 60 + 30);
    const late = h >= 23;
    d.shifts.push({ id: 'dnow', start: s, end: late ? L.at(today, 21 * 60 + 40) : null, breaks: now > b + 30 * MINMS ? [{ start: b, end: b + 30 * MINMS }] : [], extraBreak: 0, note: '', round: late ? { step: 60, start: 'nearest', end: 'up' } : undefined });
  }
  return d;
}

// ================================================================ go

fitBars();
applyLang();
applyTheme();
renderToday();
const opening = intro();
requestAnimationFrame(() => N.hideSplash());
opening.then(() => {
  drawn = false; // the first real paint animates the day in
  renderToday();
  if (!D.onboarded && !DEMO) welcome();
  else { plan(); checkForgot(); }
  setTimeout(() => checkUpdate(), 2500);
});
recover();
window.__ah = { D, L, go, openSettings, openDay, openEnd, openStart, startWork, toggleBreak, renderAll };
