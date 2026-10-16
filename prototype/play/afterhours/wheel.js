// A time wheel: hours and minutes that scroll and snap, like the phone's own clock picker.
import { haptic } from './native.js';

const ROW = 44;

function column(values, label, onPick) {
  const col = document.createElement('div');
  col.className = 'col';
  col.setAttribute('role', 'listbox');
  col.setAttribute('aria-label', label);
  col.innerHTML = '<div class="pad"></div>' + values.map(v => `<div role="option">${String(v).padStart(2, '0')}</div>`).join('') + '<div class="pad"></div>';
  const items = [...col.querySelectorAll('[role="option"]')];
  let idx = 0, timer = 0, ticking = false, quiet = false;
  const mark = i => { items.forEach((el, k) => { el.classList.toggle('on', k === i); el.setAttribute('aria-selected', k === i ? 'true' : 'false'); }); };
  const at = () => Math.max(0, Math.min(values.length - 1, Math.round(col.scrollTop / ROW)));
  col.addEventListener('scroll', () => {
    const i = at();
    if (i !== idx) { idx = i; mark(i); if (!quiet) { if (!ticking) { ticking = true; haptic.tickStart(); } haptic.tick(); } }
    clearTimeout(timer);
    timer = setTimeout(() => { if (ticking) haptic.tickEnd(); ticking = false; const q = quiet; quiet = false; if (!q) onPick(values[idx]); }, 90);
  }, { passive: true });
  // a tap on a value scrolls it to the middle
  col.addEventListener('click', e => {
    const k = items.indexOf(e.target.closest('[role="option"]'));
    if (k >= 0) col.scrollTo({ top: k * ROW, behavior: 'smooth' });
  });
  return {
    el: col,
    set(v, smooth) {
      let k = values.indexOf(v);
      if (k < 0) k = values.reduce((best, x, j) => Math.abs(x - v) < Math.abs(values[best] - v) ? j : best, 0);
      idx = k; mark(k);
      if (Math.abs(col.scrollTop - k * ROW) > 1) quiet = true; // moved by the app, not the finger: no ticks, no change
      col.scrollTo({ top: k * ROW, behavior: smooth ? 'smooth' : 'auto' });
    },
    get: () => values[idx],
  };
}

/**
 * Builds a wheel into `host` for a clock time (minutes after midnight). `step` is the minute step (5 by default).
 * onChange gets the new value whenever the wheel settles.
 */
export function timeWheel(host, value, onChange, step = 5) {
  host.innerHTML = '';
  const w = document.createElement('div');
  w.className = 'wheel';
  w.innerHTML = '<div class="band"></div>';
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const mins = Array.from({ length: 60 / step }, (_, i) => i * step);
  let h = Math.floor(value / 60) % 24, m = value % 60;
  const emit = () => onChange && onChange(hc.get() * 60 + mc.get());
  const hc = column(hours, 'Hour', emit), mc = column(mins, 'Minute', emit);
  const colon = document.createElement('div');
  colon.className = 'colon';
  colon.textContent = ':';
  w.append(hc.el, colon, mc.el);
  host.appendChild(w);
  requestAnimationFrame(() => { hc.set(h); mc.set(Math.round(m / step) * step % 60); });
  return {
    set(v, smooth) { hc.set(Math.floor(v / 60) % 24, smooth); mc.set(Math.round((v % 60) / step) * step % 60, smooth); },
    get: () => hc.get() * 60 + mc.get(),
  };
}
