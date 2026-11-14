// Small Canvas2D helpers shared by the animal, stage and effect painters.
export const RES = 2; // textures are painted at 2x and drawn at half scale for crisp edges

export function makeCanvas(w, h) {
  const c = typeof OffscreenCanvas !== 'undefined' && typeof document === 'undefined'
    ? new OffscreenCanvas(Math.ceil(w), Math.ceil(h))
    : Object.assign(document.createElement('canvas'), { width: Math.ceil(w), height: Math.ceil(h) });
  return c;
}

export function hexToRgb(hex) {
  if (typeof hex === 'string' && hex.startsWith('rgb')) return hex.match(/[\d.]+/g).slice(0, 3).map(Number);
  const n = typeof hex === 'number' ? hex : parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgb([r, g, b], a = 1) {
  return a >= 1 ? `rgb(${r | 0},${g | 0},${b | 0})` : `rgba(${r | 0},${g | 0},${b | 0},${a})`;
}

/** amt > 0 lightens toward white, < 0 darkens toward black. */
export function shade(hex, amt, a = 1) {
  const c = hexToRgb(hex);
  const t = amt > 0 ? 255 : 0;
  const k = Math.abs(amt);
  return rgb(c.map((v) => v + (t - v) * k), a);
}

export function mix(h1, h2, t) {
  const a = hexToRgb(h1), b = hexToRgb(h2);
  return rgb(a.map((v, i) => v + (b[i] - v) * t));
}

export function hexNum(hex) { return parseInt(hex.replace('#', ''), 16); }

/** A soft volumetric fill: light from the upper left. */
export function volume(ctx, x, y, r, base, light = 0.22, dark = 0.16) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.45, r * 0.1, x, y, r * 1.15);
  g.addColorStop(0, shade(base, light));
  g.addColorStop(0.55, shade(base, 0));
  g.addColorStop(1, shade(base, -dark));
  return g;
}

export function ellipse(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
}

export function capsule(ctx, x, y, w, h) {
  const r = w / 2;
  ctx.beginPath();
  ctx.moveTo(x - r, y);
  ctx.lineTo(x - r, y + h - r);
  ctx.arc(x, y + h - r, r, Math.PI, 0, true);
  ctx.lineTo(x + r, y);
  ctx.arc(x, y, r, 0, Math.PI, true);
  ctx.closePath();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function fillStroke(ctx, fill, stroke, lw) {
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }
}

export function star(ctx, x, y, points, outer, inner, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = rot + (i * Math.PI) / points;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
}

/** Deterministic noise for painted texture details. */
export function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
