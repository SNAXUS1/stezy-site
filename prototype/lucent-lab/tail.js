// The light-tail slider. The needle is the handle; a spark sits on its tip; light falls from the spark and trails
// back to the zero point. Close to zero the tail is low and faint; far from zero it stands tall and bright.
// The light drops off over a fixed distance (like real light), then runs on as a faint line to zero.
let uid = 0;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const COL = { '': ['255,246,240', '255,246,240'], temp: ['140,178,255', '255,204,128'], tint: ['140,228,160', '238,150,238'] };

/**
 * pos, zero: 0..1 along the track. energy: 0 at rest, 1 while you hover or drag (it eases between).
 * Returns SVG markup; its baseline (the track) sits at y = B, 8 px above the bottom.
 */
export function tailSVG(pos, zero, W, { energy = 0, kind = '' } = {}) {
  const id = 'lt' + (uid++);
  const B = 30, p = W * pos, z = W * zero, d = z - p, dist = Math.abs(d), sg = Math.sign(d) || 1;
  const far = Math.abs(pos - zero) * 2;
  const k = smooth(0.015, 0.42, far);
  const A = (0.78 + 0.22 * energy) * (0.28 + 0.72 * k);
  const Hn = 16 + 5 * energy;
  const Ht = Hn * (0.3 + 0.7 * k);
  const fall = Math.min(dist, 64);
  const c = COL[kind][p >= z ? 1 : 0];
  const end = p + sg * Math.min(dist, fall * 1.25);
  const gx2 = p + sg * Math.max(fall * 2, 1);
  let tail = '';
  if (dist >= 1.5) {
    const curve = `M${p},${B - Ht} C${p + sg * fall * 0.1},${B - Ht * 0.34} ${p + sg * fall * 0.45},${B - Ht * 0.07} ${end},${B - Ht * 0.025}` + (dist > fall * 1.25 ? ` L${z},${B - 0.25}` : '');
    const area = `${curve} L${z},${B} L${p},${B} Z`;
    tail = `<path d="${area}" fill="url(#${id}f)" filter="url(#${id}b)" opacity=".9"/><path d="${area}" fill="url(#${id}f)"/>` +
      `<path d="${curve}" fill="none" stroke="url(#${id}s)" stroke-width="1.2" stroke-linecap="round"/>` +
      `<line x1="${p}" x2="${z}" y1="${B}" y2="${B}" stroke="url(#${id}l)" stroke-width="1.4"/>`;
  }
  const nw = 2 + energy;
  return `<svg width="${W}" height="${B + 8}" viewBox="0 0 ${W} ${B + 8}" style="overflow:visible" aria-hidden="true"><defs>` +
    `<filter id="${id}b" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="2.6"/></filter>` +
    `<filter id="${id}g" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="2.2"/></filter>` +
    `<linearGradient id="${id}f" gradientUnits="userSpaceOnUse" x1="${p}" x2="${gx2}" y1="0" y2="0"><stop offset="0" stop-color="rgb(${c})" stop-opacity="${0.42 * A}"/><stop offset=".45" stop-color="rgb(${c})" stop-opacity="${0.11 * A}"/><stop offset="1" stop-color="rgb(${c})" stop-opacity="${0.02 * A}"/></linearGradient>` +
    `<linearGradient id="${id}s" gradientUnits="userSpaceOnUse" x1="${p}" x2="${gx2}" y1="0" y2="0"><stop offset="0" stop-color="rgb(${c})" stop-opacity="${Math.min(1, 1.15 * A)}"/><stop offset="1" stop-color="rgb(${c})" stop-opacity="${0.12 * A}"/></linearGradient>` +
    `<linearGradient id="${id}l" gradientUnits="userSpaceOnUse" x1="${p}" x2="${z}" y1="0" y2="0"><stop offset="0" stop-color="rgb(${c})" stop-opacity="${Math.min(1, 1.05 * A)}"/><stop offset="1" stop-color="rgb(${c})" stop-opacity="${0.16 * A}"/></linearGradient>` +
    `</defs>${tail}` +
    `<circle cx="${z}" cy="${B + 5}" r="1.3" fill="rgba(255,255,255,${dist < 4 ? 0 : 0.42})"/>` +
    `<rect x="${p - nw / 2}" y="${B - Hn}" width="${nw}" height="${Hn + 4}" rx="1.5" fill="#fff"/>` +
    `<circle cx="${p}" cy="${B - Ht}" r="${3.2 + energy}" fill="rgb(${c})" opacity="${0.55 + 0.35 * k}" filter="url(#${id}g)"/>` +
    `<circle cx="${p}" cy="${B - Ht}" r="${1.3 + 0.4 * energy}" fill="#fff"/></svg>`;
}
