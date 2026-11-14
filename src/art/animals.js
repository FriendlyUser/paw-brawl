// Procedural animal art. Every fighter is a puppet of painted parts (head, torso, arms,
// legs, tail) drawn here with Canvas2D at 2x, then animated by the rig in Phaser.
// The same painters render portraits and full-body pictures for the Vue menus.
import { RES, makeCanvas, shade, volume, ellipse, capsule, star, seeded } from './paint.js';
import { CHARACTERS } from '../engine/characters.js';

export const PALETTES = {
  bear: [
    { fur: '#8b5a34', belly: '#d9b48a', nose: '#2b1d14', accent: '#c98a52' },
    { fur: '#ece4d4', belly: '#ffffff', nose: '#2b2b33', accent: '#d8cdb8' },
    { fur: '#3b3431', belly: '#b4946f', nose: '#141012', accent: '#5a4f4a' },
  ],
  cat: [
    { fur: '#f6efe4', belly: '#ffffff', p1: '#ec8a3a', p2: '#3b3335', eye: '#6cc95a', nose: '#f29bab' },
    { fur: '#a3a8b0', belly: '#e4e6ea', p1: '#6c717a', p2: '#575b63', eye: '#f2b33a', nose: '#e88a9a' },
    { fur: '#2f2b35', belly: '#4a4552', p1: '#2f2b35', p2: '#241f29', eye: '#f5d33a', nose: '#e47d93' },
  ],
  rabbit: [
    { fur: '#efe4d6', belly: '#ffffff', inner: '#f6b0bf', nose: '#ef8a9e', accent: '#d9c8b4' },
    { fur: '#a77d5a', belly: '#ecdcc5', inner: '#e9a8a8', nose: '#d97a8a', accent: '#8a6446' },
    { fur: '#8e909c', belly: '#dcdde4', inner: '#e9b0c4', nose: '#d77d95', accent: '#6f717d' },
  ],
  frog: [
    { fur: '#5cbf4a', belly: '#f2e27a', spot: '#3d8f34', eye: '#f2c641', cheek: '#ff9a8a' },
    { fur: '#3c8ee6', belly: '#2b2f3a', spot: '#1d2433', eye: '#f2f2f2', cheek: '#8fd0ff' },
    { fur: '#e2483e', belly: '#ffd77a', spot: '#2b1f22', eye: '#ffe08a', cheek: '#ffb0a0' },
  ],
  rhino: [
    { fur: '#9aa2a8', belly: '#c9ced3', horn: '#f1e7cf', accent: '#7b838a' },
    { fur: '#b28d73', belly: '#d9c0aa', horn: '#fff3d6', accent: '#8f6c55' },
    { fur: '#5d6570', belly: '#8b929c', horn: '#e6e0d0', accent: '#474e58' },
  ],
  owl: [
    { fur: '#8c6b4a', belly: '#ead9b8', disc: '#f3e8d0', eye: '#ffb21c', beak: '#3b2f28', accent: '#6b4f35' },
    { fur: '#f1f1ef', belly: '#ffffff', disc: '#ffffff', eye: '#ffd21c', beak: '#2b2b2b', accent: '#b9b9b4' },
    { fur: '#6c7d96', belly: '#d6dde8', disc: '#eef2f7', eye: '#ff8a1c', beak: '#2a2f3a', accent: '#4f5e75' },
  ],
};

const OL = 2.3; // outline width in world px

/** Body proportions in world px, shared by the painter and the rig. */
export function animalDims(id) {
  const { height: h, width: w } = CHARACTERS[id].stats;
  const d = { h, w, L: 0.28 * h, th: 0.34 * h, tw: w, hr: 0.19 * h, al: 0.27 * h, aw: 0.09 * h, ll: 0.3 * h, lw: 0.11 * h };
  const o = {
    bear: { tw: w * 1.12, aw: 0.11 * h, lw: 0.13 * h, L: 0.26 * h, ll: 0.28 * h, th: 0.36 * h },
    cat: { tw: w * 0.95, hr: 0.215 * h, aw: 0.078 * h, lw: 0.088 * h, th: 0.31 * h },
    rabbit: { hr: 0.19 * h, th: 0.31 * h, lw: 0.095 * h, aw: 0.075 * h, L: 0.29 * h, ll: 0.31 * h },
    frog: { tw: w * 1.0, hr: 0.2 * h, th: 0.3 * h, L: 0.26 * h, ll: 0.28 * h, lw: 0.11 * h, aw: 0.075 * h },
    rhino: { tw: w * 1.08, hr: 0.19 * h, th: 0.38 * h, L: 0.25 * h, ll: 0.27 * h, lw: 0.14 * h, aw: 0.12 * h },
    owl: { tw: w * 1.05, hr: 0.215 * h, th: 0.36 * h, L: 0.2 * h, ll: 0.22 * h, lw: 0.055 * h, aw: 0.15 * h, al: 0.33 * h },
  }[id];
  return { ...d, ...o };
}

function outlineOf(c) { return shade(c, -0.62); }

/** Strokes every shape first, then fills them all, so overlapping shapes share one outline. */
function blob(ctx, shapes, outline, olw = OL) {
  ctx.save();
  ctx.lineWidth = olw * 2;
  ctx.strokeStyle = outline;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const s of shapes) { s.path(ctx); ctx.stroke(); }
  ctx.restore();
  for (const s of shapes) { s.path(ctx); ctx.fillStyle = typeof s.fill === 'function' ? s.fill(ctx) : s.fill; ctx.fill(); }
}

function paintPart(bounds, draw) {
  const [x0, y0, x1, y1] = bounds;
  const pad = 4;
  const w = (x1 - x0 + pad * 2) * RES;
  const h = (y1 - y0 + pad * 2) * RES;
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(RES, 0, 0, RES, (-x0 + pad) * RES, (-y0 + pad) * RES);
  draw(ctx);
  return { canvas, ox: (-x0 + pad) / (x1 - x0 + pad * 2), oy: (-y0 + pad) / (y1 - y0 + pad * 2), wpx: x1 - x0 + pad * 2, hpx: y1 - y0 + pad * 2 };
}

// ------------------------------------------------------------------ eyes
function eyes(ctx, list, expr, style, pal) {
  for (const e of list) {
    const { x, y, r } = e;
    if (expr === 'blink' || expr === 'hurt') {
      ctx.strokeStyle = '#1d1517';
      ctx.lineWidth = Math.max(1.6, r * 0.45);
      ctx.lineCap = 'round';
      ctx.beginPath();
      if (expr === 'blink') ctx.arc(x, y - r * 0.2, r * 0.8, 0.15 * Math.PI, 0.85 * Math.PI);
      else { ctx.moveTo(x - r * 0.8, y - r * 0.7); ctx.lineTo(x + r * 0.5, y); ctx.lineTo(x - r * 0.8, y + r * 0.7); }
      ctx.stroke();
      continue;
    }
    if (style === 'dot') {
      ellipse(ctx, x, y, r * 0.78, r);
      ctx.fillStyle = '#1b1416';
      ctx.fill();
      ellipse(ctx, x + r * 0.22, y - r * 0.38, r * 0.3, r * 0.3);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ellipse(ctx, x - r * 0.25, y + r * 0.45, r * 0.13, r * 0.13);
      ctx.fill();
    } else {
      // Iris eyes (cat, owl, frog).
      ellipse(ctx, x, y, r, r * (style === 'cat' ? 1.05 : 1));
      ctx.fillStyle = '#fffaf0';
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = '#2a1c18';
      ctx.stroke();
      const ir = r * 0.82;
      ellipse(ctx, x + r * 0.12, y, ir, ir);
      const g = ctx.createRadialGradient(x + r * 0.12, y - ir * 0.4, ir * 0.1, x + r * 0.12, y, ir);
      g.addColorStop(0, shade(pal.eye, 0.45));
      g.addColorStop(1, shade(pal.eye, -0.15));
      ctx.fillStyle = g;
      ctx.fill();
      ctx.fillStyle = '#140d0d';
      if (style === 'cat') ellipse(ctx, x + r * 0.16, y, ir * 0.24, ir * 0.82);
      else if (style === 'frog') ellipse(ctx, x + r * 0.14, y, ir * 0.7, ir * 0.32);
      else ellipse(ctx, x + r * 0.14, y, ir * 0.55, ir * 0.55);
      ctx.fill();
      ellipse(ctx, x + r * 0.38, y - r * 0.4, r * 0.24, r * 0.24);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
    if (expr === 'angry') {
      ctx.strokeStyle = '#1d1517';
      ctx.lineWidth = Math.max(2, r * 0.42);
      ctx.lineCap = 'round';
      ctx.beginPath();
      const inner = e.front ? -1 : 1;
      ctx.moveTo(x + inner * r * 0.9, y - r * 0.95);
      ctx.lineTo(x - inner * r * 0.9, y - r * 1.55);
      ctx.stroke();
    }
  }
}

function blush(ctx, x, y, r, color = '#ff8f9a') {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, shade(color, 0, 0.55));
  g.addColorStop(1, shade(color, 0, 0));
  ctx.fillStyle = g;
  ellipse(ctx, x, y, r, r * 0.7);
  ctx.fill();
}

function mouth(ctx, x, y, s, expr) {
  ctx.strokeStyle = '#2a1a16';
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (expr === 'angry') {
    ellipse(ctx, x, y + s * 0.3, s * 0.55, s * 0.45);
    ctx.fillStyle = '#5a1e24';
    ctx.fill();
    ctx.stroke();
  } else if (expr === 'hurt') {
    ctx.moveTo(x - s * 0.6, y + s * 0.5);
    ctx.quadraticCurveTo(x, y - s * 0.1, x + s * 0.6, y + s * 0.5);
    ctx.stroke();
  } else {
    ctx.moveTo(x - s * 0.7, y);
    ctx.quadraticCurveTo(x - s * 0.35, y + s * 0.5, x, y);
    ctx.quadraticCurveTo(x + s * 0.35, y + s * 0.5, x + s * 0.7, y);
    ctx.stroke();
  }
}

// ------------------------------------------------------------------ heads
const HEADS = {
  bear(ctx, d, p, expr) {
    const r = d.hr, cy = -r * 0.85, ol = outlineOf(p.fur);
    blob(ctx, [
      { path: (c) => ellipse(c, -r * 0.62, cy - r * 0.72, r * 0.34, r * 0.34), fill: volume(ctx, -r * 0.62, cy - r * 0.72, r * 0.34, p.fur) },
      { path: (c) => ellipse(c, r * 0.42, cy - r * 0.82, r * 0.32, r * 0.32), fill: volume(ctx, r * 0.42, cy - r * 0.82, r * 0.32, p.fur) },
      { path: (c) => ellipse(c, 0, cy, r * 1.02, r * 0.96), fill: volume(ctx, 0, cy, r, p.fur) },
      { path: (c) => ellipse(c, r * 0.55, cy + r * 0.3, r * 0.5, r * 0.36), fill: volume(ctx, r * 0.55, cy + r * 0.3, r * 0.5, p.belly, 0.25, 0.08) },
    ], ol);
    ellipse(ctx, -r * 0.62, cy - r * 0.72, r * 0.17, r * 0.17); ctx.fillStyle = p.accent; ctx.fill();
    ellipse(ctx, r * 0.42, cy - r * 0.82, r * 0.16, r * 0.16); ctx.fill();
    ellipse(ctx, r * 0.9, cy + r * 0.12, r * 0.17, r * 0.12); ctx.fillStyle = p.nose; ctx.fill();
    ellipse(ctx, r * 0.94, cy + r * 0.07, r * 0.06, r * 0.035); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fill();
    mouth(ctx, r * 0.68, cy + r * 0.42, r * 0.22, expr);
    eyes(ctx, [{ x: r * 0.42, y: cy - r * 0.22, r: r * 0.12, front: true }, { x: -r * 0.08, y: cy - r * 0.24, r: r * 0.11 }], expr, 'dot', p);
    blush(ctx, r * 0.1, cy + r * 0.25, r * 0.2);
  },
  cat(ctx, d, p, expr) {
    const r = d.hr, cy = -r * 0.85, ol = outlineOf(p.p2 === p.fur ? p.fur : '#6b5a52');
    const ear = (x, tilt) => (c) => {
      c.beginPath();
      c.moveTo(x - r * 0.38, cy - r * 0.45);
      c.lineTo(x + tilt * r, cy - r * 1.45);
      c.lineTo(x + r * 0.34, cy - r * 0.55);
      c.closePath();
    };
    blob(ctx, [
      { path: ear(-r * 0.45, -0.2), fill: p.p2 },
      { path: ear(r * 0.42, 0.18), fill: p.fur },
      { path: (c) => ellipse(c, 0, cy, r * 1.06, r * 0.92), fill: volume(ctx, 0, cy, r, p.fur) },
    ], ol);
    // Calico patches, clipped to the head.
    ctx.save();
    ellipse(ctx, 0, cy, r * 1.06, r * 0.92);
    ctx.clip();
    ellipse(ctx, -r * 0.65, cy - r * 0.55, r * 0.62, r * 0.55); ctx.fillStyle = p.p2; ctx.fill();
    ellipse(ctx, r * 0.35, cy - r * 0.85, r * 0.5, r * 0.4); ctx.fillStyle = p.p1; ctx.fill();
    ctx.restore();
    ctx.fillStyle = p.nose;
    ctx.beginPath(); ctx.moveTo(-r * 0.47, cy - r * 0.7); ctx.lineTo(-r * 0.57, cy - r * 1.12); ctx.lineTo(-r * 0.25, cy - r * 0.78); ctx.fill();
    ctx.beginPath(); ctx.moveTo(r * 0.3, cy - r * 0.78); ctx.lineTo(r * 0.55, cy - r * 1.15); ctx.lineTo(r * 0.66, cy - r * 0.68); ctx.fill();
    // Muzzle, nose, whiskers.
    ellipse(ctx, r * 0.62, cy + r * 0.3, r * 0.34, r * 0.24); ctx.fillStyle = p.belly; ctx.fill();
    ctx.beginPath(); ctx.moveTo(r * 0.78, cy + r * 0.12); ctx.lineTo(r * 0.98, cy + r * 0.12); ctx.lineTo(r * 0.88, cy + r * 0.26); ctx.closePath(); ctx.fillStyle = p.nose; ctx.fill();
    mouth(ctx, r * 0.78, cy + r * 0.34, r * 0.18, expr);
    ctx.strokeStyle = shade(p.fur, -0.55, 0.7); ctx.lineWidth = 1.1;
    for (const k of [-1, 0, 1]) {
      ctx.beginPath(); ctx.moveTo(r * 0.85, cy + r * 0.28); ctx.lineTo(r * 1.45, cy + r * (0.18 + k * 0.14)); ctx.stroke();
    }
    eyes(ctx, [{ x: r * 0.48, y: cy - r * 0.12, r: r * 0.2, front: true }, { x: -r * 0.05, y: cy - r * 0.14, r: r * 0.18 }], expr, 'cat', p);
    blush(ctx, r * 0.18, cy + r * 0.32, r * 0.18);
  },
  rabbit(ctx, d, p, expr) {
    const r = d.hr, cy = -r * 0.85, ol = outlineOf(p.accent);
    blob(ctx, [
      // One ear tall, one lopped back.
      { path: (c) => ellipse(c, r * 0.1, cy - r * 1.55, r * 0.28, r * 0.85, 0.12), fill: volume(ctx, r * 0.1, cy - r * 1.5, r * 0.6, p.fur) },
      { path: (c) => ellipse(c, -r * 0.95, cy - r * 0.5, r * 0.26, r * 0.78, 1.1), fill: volume(ctx, -r * 0.95, cy - r * 0.5, r * 0.6, p.accent) },
      { path: (c) => ellipse(c, 0, cy, r * 0.98, r * 0.9), fill: volume(ctx, 0, cy, r, p.fur) },
      { path: (c) => ellipse(c, r * 0.48, cy + r * 0.38, r * 0.42, r * 0.3), fill: p.belly },
    ], ol);
    ellipse(ctx, r * 0.12, cy - r * 1.52, r * 0.13, r * 0.62, 0.12); ctx.fillStyle = p.inner; ctx.fill();
    ellipse(ctx, -r * 0.97, cy - r * 0.48, r * 0.12, r * 0.55, 1.1); ctx.fill();
    ellipse(ctx, r * 0.84, cy + r * 0.2, r * 0.12, r * 0.09); ctx.fillStyle = p.nose; ctx.fill();
    // Buck teeth.
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#7b6a62'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(r * 0.62, cy + r * 0.44, r * 0.2, r * 0.2, 2); ctx.fill(); ctx.stroke();
    mouth(ctx, r * 0.72, cy + r * 0.38, r * 0.17, expr === 'angry' ? 'normal' : expr);
    eyes(ctx, [{ x: r * 0.42, y: cy - r * 0.15, r: r * 0.14, front: true }, { x: -r * 0.08, y: cy - r * 0.16, r: r * 0.125 }], expr, 'dot', p);
    blush(ctx, r * 0.12, cy + r * 0.3, r * 0.22);
  },
  frog(ctx, d, p, expr) {
    const r = d.hr, cy = -r * 0.7, ol = outlineOf(p.fur);
    blob(ctx, [
      { path: (c) => ellipse(c, -r * 0.2, cy - r * 0.62, r * 0.42, r * 0.42), fill: volume(ctx, -r * 0.2, cy - r * 0.62, r * 0.42, p.fur) },
      { path: (c) => ellipse(c, r * 0.55, cy - r * 0.6, r * 0.44, r * 0.44), fill: volume(ctx, r * 0.55, cy - r * 0.6, r * 0.44, p.fur) },
      { path: (c) => ellipse(c, r * 0.12, cy, r * 1.22, r * 0.78), fill: volume(ctx, r * 0.1, cy, r * 1.1, p.fur) },
    ], ol);
    ctx.save(); ellipse(ctx, r * 0.12, cy, r * 1.22, r * 0.78); ctx.clip();
    ellipse(ctx, r * 0.3, cy + r * 0.75, r * 1.0, r * 0.45); ctx.fillStyle = p.belly; ctx.fill();
    const rnd = seeded(7);
    ctx.fillStyle = p.spot;
    for (let i = 0; i < 5; i++) { ellipse(ctx, -r * 0.9 + rnd() * r * 1.1, cy - r * 0.3 + rnd() * r * 0.4, r * 0.1 + rnd() * r * 0.08, r * 0.08 + rnd() * r * 0.06); ctx.fill(); }
    ctx.restore();
    // Wide smile.
    ctx.strokeStyle = '#21301c'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath();
    if (expr === 'angry') { ctx.moveTo(-r * 0.4, cy + r * 0.3); ctx.quadraticCurveTo(r * 0.5, cy + r * 0.62, r * 1.25, cy + r * 0.12); ctx.lineTo(-r * 0.4, cy + r * 0.3); ctx.fillStyle = '#7a2730'; ctx.fill(); }
    else if (expr === 'hurt') { ctx.moveTo(-r * 0.2, cy + r * 0.45); ctx.quadraticCurveTo(r * 0.5, cy + r * 0.2, r * 1.15, cy + r * 0.38); }
    else { ctx.moveTo(-r * 0.4, cy + r * 0.28); ctx.quadraticCurveTo(r * 0.5, cy + r * 0.62, r * 1.25, cy + r * 0.12); }
    ctx.stroke();
    ellipse(ctx, r * 1.1, cy - r * 0.08, r * 0.04, r * 0.03); ctx.fillStyle = '#21301c'; ctx.fill();
    eyes(ctx, [{ x: r * 0.58, y: cy - r * 0.62, r: r * 0.3, front: true }, { x: -r * 0.18, y: cy - r * 0.64, r: r * 0.27 }], expr, 'frog', p);
    blush(ctx, r * 0.15, cy + r * 0.25, r * 0.22, p.cheek);
  },
  rhino(ctx, d, p, expr) {
    const r = d.hr, cy = -r * 0.85, ol = outlineOf(p.fur);
    const earP = (x, a) => (c) => ellipse(c, x, cy - r * 0.95, r * 0.18, r * 0.36, a);
    blob(ctx, [
      { path: earP(-r * 0.55, -0.5), fill: p.accent },
      { path: earP(-r * 0.15, 0.25), fill: p.fur },
      // Horns.
      { path: (c) => { c.beginPath(); c.moveTo(r * 1.0, cy - r * 0.05); c.quadraticCurveTo(r * 1.5, cy - r * 0.5, r * 1.42, cy - r * 1.15); c.quadraticCurveTo(r * 1.15, cy - r * 0.55, r * 0.72, cy - r * 0.22); c.closePath(); }, fill: volume(ctx, r * 1.2, cy - r * 0.5, r * 0.5, p.horn, 0.3, 0.1) },
      { path: (c) => { c.beginPath(); c.moveTo(r * 0.55, cy - r * 0.45); c.quadraticCurveTo(r * 0.8, cy - r * 0.75, r * 0.78, cy - r * 1.0); c.quadraticCurveTo(r * 0.55, cy - r * 0.7, r * 0.3, cy - r * 0.55); c.closePath(); }, fill: volume(ctx, r * 0.6, cy - r * 0.7, r * 0.35, p.horn, 0.3, 0.1) },
      { path: (c) => ellipse(c, -r * 0.05, cy - r * 0.1, r * 0.95, r * 0.86), fill: volume(ctx, 0, cy, r, p.fur) },
      { path: (c) => { c.beginPath(); c.roundRect(r * 0.1, cy - r * 0.35, r * 1.1, r * 0.95, r * 0.42); }, fill: volume(ctx, r * 0.7, cy + r * 0.1, r * 0.7, p.fur, 0.18, 0.12) },
    ], ol);
    ellipse(ctx, -r * 0.55, cy - r * 0.95, r * 0.08, r * 0.2, -0.5); ctx.fillStyle = shade(p.accent, -0.2); ctx.fill();
    // Skin folds and nostril.
    ctx.strokeStyle = shade(p.fur, -0.35); ctx.lineWidth = 1.3; ctx.lineCap = 'round';
    for (const k of [0, 1]) { ctx.beginPath(); ctx.arc(r * (0.0 - k * 0.18), cy + r * 0.2, r * 0.45, -0.6, 0.6); ctx.stroke(); }
    ellipse(ctx, r * 1.02, cy + r * 0.28, r * 0.08, r * 0.05, 0.4); ctx.fillStyle = shade(p.fur, -0.6); ctx.fill();
    mouth(ctx, r * 0.85, cy + r * 0.5, r * 0.2, expr);
    eyes(ctx, [{ x: r * 0.25, y: cy - r * 0.2, r: r * 0.11, front: true }, { x: -r * 0.25, y: cy - r * 0.22, r: r * 0.1 }], expr, 'dot', p);
    blush(ctx, r * 0.0, cy + r * 0.18, r * 0.2);
  },
  owl(ctx, d, p, expr) {
    const r = d.hr, cy = -r * 0.85, ol = outlineOf(p.fur);
    const tuft = (x, dir) => (c) => { c.beginPath(); c.moveTo(x - r * 0.25, cy - r * 0.7); c.lineTo(x + dir * r * 0.32, cy - r * 1.42); c.lineTo(x + r * 0.28, cy - r * 0.72); c.closePath(); };
    blob(ctx, [
      { path: tuft(-r * 0.55, -1), fill: p.accent },
      { path: tuft(r * 0.42, 1), fill: p.fur },
      { path: (c) => ellipse(c, 0, cy, r * 1.02, r * 0.95), fill: volume(ctx, 0, cy, r, p.fur) },
    ], ol);
    // Facial disc.
    ellipse(ctx, r * 0.42, cy + r * 0.02, r * 0.42, r * 0.45); ctx.fillStyle = p.disc; ctx.fill();
    ellipse(ctx, -r * 0.08, cy + r * 0.02, r * 0.38, r * 0.43); ctx.fill();
    ctx.strokeStyle = shade(p.fur, -0.3, 0.6); ctx.lineWidth = 1.2;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(-r * 0.2 + i * r * 0.18, cy - r * 0.6, r * 0.12, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke(); }
    eyes(ctx, [{ x: r * 0.44, y: cy - r * 0.02, r: r * 0.27, front: true }, { x: -r * 0.08, y: cy - r * 0.02, r: r * 0.24 }], expr, 'owl', p);
    // Beak.
    ctx.beginPath(); ctx.moveTo(r * 0.12, cy + r * 0.2); ctx.quadraticCurveTo(r * 0.35, cy + r * 0.25, r * 0.22, cy + r * 0.62); ctx.quadraticCurveTo(r * 0.05, cy + r * 0.35, r * 0.12, cy + r * 0.2);
    ctx.fillStyle = p.beak; ctx.fill();
  },
};

// ------------------------------------------------------------------ bodies
function torso(ctx, id, d, p) {
  const { tw, th } = d;
  const cy = -th * 0.5;
  const base = p.fur;
  const ol = outlineOf(id === 'cat' ? '#6b5a52' : id === 'rabbit' ? p.accent : base);
  const rx = tw / 2, ry = th * 0.56;
  const shapes = [{ path: (c) => ellipse(c, 0, cy, rx, ry), fill: volume(ctx, 0, cy, Math.max(rx, ry), base, 0.18, 0.18) }];
  blob(ctx, shapes, ol);
  ctx.save();
  ellipse(ctx, 0, cy, rx, ry);
  ctx.clip();
  if (id === 'cat') {
    ellipse(ctx, -rx * 0.6, cy - ry * 0.5, rx * 0.7, ry * 0.6); ctx.fillStyle = p.p1; ctx.fill();
    ellipse(ctx, -rx * 0.9, cy + ry * 0.3, rx * 0.4, ry * 0.4); ctx.fillStyle = p.p2; ctx.fill();
  }
  if (id === 'frog') {
    const rnd = seeded(11); ctx.fillStyle = p.spot;
    for (let i = 0; i < 6; i++) { ellipse(ctx, -rx * 0.8 + rnd() * rx * 1.2, cy - ry * 0.7 + rnd() * ry, 3 + rnd() * 3, 2.5 + rnd() * 2.5); ctx.fill(); }
  }
  const bg = ctx.createLinearGradient(0, cy - ry, 0, cy + ry);
  bg.addColorStop(0, shade(p.belly, 0.25));
  bg.addColorStop(1, shade(p.belly, -0.06));
  ellipse(ctx, rx * 0.22, cy + ry * 0.12, rx * 0.62, ry * 0.78);
  ctx.fillStyle = bg;
  ctx.fill();
  if (id === 'owl') {
    ctx.strokeStyle = shade(p.fur, -0.1, 0.8); ctx.lineWidth = 1.4;
    for (let row = 0; row < 4; row++) for (let i = 0; i < 3; i++) {
      const x = rx * (-0.15 + i * 0.28) + (row % 2) * rx * 0.14, y = cy - ry * 0.35 + row * ry * 0.3;
      ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x, y + 4); ctx.lineTo(x + 4, y); ctx.stroke();
    }
  }
  if (id === 'rhino') {
    ctx.strokeStyle = shade(base, -0.3); ctx.lineWidth = 1.4;
    for (const k of [-0.35, 0.05]) { ctx.beginPath(); ctx.arc(rx * k - rx * 0.4, cy, ry * 0.9, -0.5, 0.5); ctx.stroke(); }
  }
  if (id === 'rabbit' || id === 'bear') {
    // Fluffy chest tuft.
    ctx.fillStyle = shade(p.belly, 0.35);
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(rx * (0.05 + i * 0.18), cy - ry * 0.55, rx * 0.13, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.restore();
}

function arm(ctx, id, d, p, back) {
  const { al, aw } = d;
  const base = back ? shade(p.fur, -0.12) : p.fur;
  const ol = outlineOf(id === 'cat' ? '#6b5a52' : id === 'rabbit' ? p.accent : p.fur);
  if (id === 'owl') {
    const wing = (c) => {
      c.beginPath();
      c.moveTo(-aw * 0.45, -aw * 0.2);
      c.quadraticCurveTo(-aw * 0.75, al * 0.5, -aw * 0.15, al);
      c.lineTo(aw * 0.05, al * 0.86);
      c.lineTo(aw * 0.25, al * 0.95);
      c.lineTo(aw * 0.35, al * 0.75);
      c.lineTo(aw * 0.55, al * 0.78);
      c.quadraticCurveTo(aw * 0.75, al * 0.3, aw * 0.4, -aw * 0.2);
      c.closePath();
    };
    blob(ctx, [{ path: wing, fill: volume(ctx, 0, al * 0.4, al * 0.6, base) }], ol);
    ctx.strokeStyle = shade(base, -0.3, 0.7); ctx.lineWidth = 1.2;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-aw * 0.3 + i * aw * 0.25, al * 0.35); ctx.lineTo(-aw * 0.2 + i * aw * 0.3, al * 0.85); ctx.stroke(); }
    return;
  }
  const pawR = aw * (id === 'frog' ? 0.5 : 0.62);
  const shapes = [
    { path: (c) => capsule(c, 0, 0, aw, al - pawR * 0.5), fill: volume(ctx, 0, al * 0.4, al * 0.5, base) },
  ];
  if (id === 'frog') {
    for (const k of [-1, 0, 1]) shapes.push({ path: (c) => ellipse(c, k * aw * 0.42, al + 1, aw * 0.26, aw * 0.26), fill: shade(base, 0.1) });
  } else {
    shapes.push({ path: (c) => ellipse(c, aw * 0.08, al - pawR * 0.8, pawR, pawR * 0.95), fill: volume(ctx, 0, al - pawR, pawR, id === 'rhino' ? shade(base, -0.15) : base) });
  }
  blob(ctx, shapes, ol);
  if (id === 'bear' || id === 'cat') {
    ctx.fillStyle = id === 'bear' ? '#f2e2cc' : '#f6c5cf';
    ellipse(ctx, aw * 0.15, al - pawR * 0.55, pawR * 0.45, pawR * 0.32); ctx.fill();
  }
  if (id === 'bear') {
    ctx.strokeStyle = '#f5efe6'; ctx.lineWidth = 1.4;
    for (const k of [-1, 0, 1]) { ctx.beginPath(); ctx.moveTo(aw * 0.1 + k * pawR * 0.45, al - pawR * 0.1); ctx.lineTo(aw * 0.15 + k * pawR * 0.5, al + pawR * 0.25); ctx.stroke(); }
  }
}

function leg(ctx, id, d, p, back) {
  const { ll, lw } = d;
  const base = back ? shade(p.fur, -0.14) : p.fur;
  const ol = outlineOf(id === 'cat' ? '#6b5a52' : id === 'rabbit' ? p.accent : p.fur);
  if (id === 'owl') {
    const talon = '#e8a33a';
    blob(ctx, [
      { path: (c) => capsule(c, 0, -lw * 0.5, lw, ll), fill: talon },
      { path: (c) => ellipse(c, lw * 0.9, ll - lw * 0.2, lw * 1.3, lw * 0.5), fill: talon },
      { path: (c) => ellipse(c, 0, -lw * 1.2, lw * 1.6, lw * 1.4), fill: base },
    ], shade(talon, -0.6));
    return;
  }
  const footW = id === 'rabbit' ? lw * 1.15 : id === 'frog' ? lw * 1.2 : lw * 0.8;
  const shapes = [
    { path: (c) => ellipse(c, lw * 0.35 + footW * 0.2, ll - lw * 0.2, footW, lw * 0.42), fill: volume(ctx, lw * 0.4, ll, footW, base) },
    { path: (c) => capsule(c, 0, -lw * 0.3, lw, ll - lw * 0.2), fill: volume(ctx, 0, ll * 0.4, ll * 0.5, base) },
  ];
  if (id === 'frog') for (const k of [0, 1, 2]) shapes.push({ path: (c) => ellipse(c, lw * (0.65 + k * 0.5), ll - lw * 0.05, lw * 0.24, lw * 0.22), fill: shade(base, 0.1) });
  blob(ctx, shapes, ol);
  if (id === 'rhino') {
    ctx.fillStyle = shade(p.horn, -0.1);
    for (const k of [0, 1, 2]) { ellipse(ctx, lw * (0.1 + k * 0.32), ll + lw * 0.05, lw * 0.13, lw * 0.1); ctx.fill(); }
  }
}

function tail(ctx, id, d, p) {
  const r = d.hr;
  const ol = outlineOf(id === 'cat' ? '#6b5a52' : id === 'rabbit' ? p.accent : p.fur);
  if (id === 'bear') blob(ctx, [{ path: (c) => ellipse(c, -r * 0.18, 0, r * 0.26, r * 0.24), fill: p.fur }], ol);
  else if (id === 'rabbit') {
    const puffs = [[-0.2, 0, 0.3], [-0.38, -0.12, 0.2], [-0.32, 0.15, 0.2], [-0.05, -0.18, 0.18]];
    blob(ctx, puffs.map(([x, y, s]) => ({ path: (c) => ellipse(c, r * x, r * y, r * s, r * s), fill: '#ffffff' })), '#b9aaa0');
  } else if (id === 'cat') {
    const path = (c) => { c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(-r * 0.9, r * 0.1, -r * 1.1, -r * 0.7, -r * 0.6, -r * 1.3); };
    ctx.lineCap = 'round';
    path(ctx); ctx.lineWidth = r * 0.24 + OL * 2; ctx.strokeStyle = ol; ctx.stroke();
    path(ctx); ctx.lineWidth = r * 0.24; ctx.strokeStyle = p.p1; ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.rect(-r * 1.3, -r * 1.6, r * 1.4, r * 0.55); ctx.clip();
    path(ctx); ctx.strokeStyle = p.p2; ctx.stroke(); ctx.restore();
  } else if (id === 'rhino') {
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-r * 0.4, r * 0.1, -r * 0.55, r * 0.5);
    ctx.lineWidth = 5; ctx.strokeStyle = ol; ctx.stroke(); ctx.lineWidth = 2.6; ctx.strokeStyle = p.fur; ctx.stroke();
    blob(ctx, [{ path: (c) => ellipse(c, -r * 0.57, r * 0.58, r * 0.1, r * 0.14), fill: shade(p.fur, -0.4) }], ol);
  } else if (id === 'owl') {
    blob(ctx, [-0.35, 0, 0.35].map((a) => ({ path: (c) => ellipse(c, -r * 0.35 * Math.cos(a), r * 0.3 + r * 0.35 * Math.sin(a), r * 0.42, r * 0.13, a + 0.6), fill: p.accent })), ol);
  }
}

// ------------------------------------------------------------------ public API
export const EXPRESSIONS = ['normal', 'angry', 'hurt', 'blink'];

/** All rig parts for one animal + palette: { head_normal, head_angry, ..., torso, armF, ... }. */
export function paintAnimal(id, paletteIdx = 0) {
  const d = animalDims(id);
  const p = PALETTES[id][paletteIdx % PALETTES[id].length];
  const r = d.hr;
  const parts = {};
  const headBounds = { rabbit: [-r * 1.5, -r * 3.4, r * 1.3, r * 0.2], frog: [-r * 1.2, -r * 1.6, r * 1.45, r * 0.2], rhino: [-r * 1.1, -r * 2.15, r * 1.6, r * 0.25], owl: [-r * 1.2, -r * 2.4, r * 1.2, r * 0.25] }[id] ?? [-r * 1.2, -r * 2.4, r * 1.55, r * 0.25];
  for (const expr of EXPRESSIONS) parts[`head_${expr}`] = paintPart(headBounds, (ctx) => HEADS[id](ctx, d, p, expr));
  parts.torso = paintPart([-d.tw / 2 - 2, -d.th * 1.12, d.tw / 2 + 2, d.th * 0.12], (ctx) => torso(ctx, id, d, p));
  const armB = [-d.aw * 1.2, -d.aw * 0.8, d.aw * 1.3, d.al + d.aw * 0.8];
  parts.armF = paintPart(armB, (ctx) => arm(ctx, id, d, p, false));
  parts.armB = paintPart(armB, (ctx) => arm(ctx, id, d, p, true));
  const legB = id === 'owl' ? [-d.lw * 2, -d.lw * 3, d.lw * 2.6, d.ll + d.lw] : [-d.lw * 0.8, -d.lw * 0.9, d.lw * 2.2, d.ll + d.lw * 0.6];
  parts.legF = paintPart(legB, (ctx) => leg(ctx, id, d, p, false));
  parts.legB = paintPart(legB, (ctx) => leg(ctx, id, d, p, true));
  if (id !== 'frog') parts.tail = paintPart([-r * 1.4, -r * 1.7, r * 0.4, r * 0.9], (ctx) => tail(ctx, id, d, p));
  return { dims: d, parts, palette: p };
}

/** Rig layout: where each part attaches, relative to the hip (facing right). */
export function rigLayout(d) {
  return {
    tail: { x: -d.tw * 0.42, y: -d.th * 0.22 },
    armB: { x: -d.tw * 0.16, y: -d.th * 0.78 },
    legB: { x: -d.tw * 0.17, y: -d.lw * 0.2 },
    torso: { x: 0, y: d.lw * 0.15 },
    legF: { x: d.tw * 0.14, y: -d.lw * 0.2 },
    head: { x: d.tw * 0.06, y: -d.th * 0.86 },
    armF: { x: d.tw * 0.2, y: -d.th * 0.74 },
  };
}

const cache = new Map();

/** A static full-body picture for menus, as a canvas (cached). */
export function renderFullBody(id, paletteIdx = 0, scale = 1.6, expr = 'normal') {
  const key = `${id}:${paletteIdx}:${scale}:${expr}`;
  if (cache.has(key)) return cache.get(key);
  const { dims: d, parts } = paintAnimal(id, paletteIdx);
  const lay = rigLayout(d);
  const W = d.h * 1.25, H = d.h * 1.25;
  const canvas = makeCanvas(W * scale * RES, H * scale * RES);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(scale, 0, 0, scale, W * scale * RES * 0.5, H * scale * RES * 0.92);
  const pose = { tail: 0.5, armB: 0.35, legB: -0.12, torso: 0, legF: 0.15, head: 0.04, armF: -0.25 };
  const draw = (name, pp) => {
    const part = parts[pp ?? name];
    if (!part) return;
    const at = lay[name];
    ctx.save();
    ctx.translate(at.x * RES, (at.y - d.L) * RES);
    ctx.rotate(pose[name] ?? 0);
    ctx.drawImage(part.canvas, -part.ox * part.canvas.width, -part.oy * part.canvas.height);
    ctx.restore();
  };
  ctx.save();
  ellipse(ctx, 0, 0, d.tw * 0.7 * RES, 9 * RES);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fill();
  ctx.restore();
  ['tail', 'armB', 'legB', 'torso', 'legF'].forEach((n) => draw(n));
  draw('head', `head_${expr}`);
  draw('armF');
  cache.set(key, canvas);
  return canvas;
}

/** A head-and-shoulders portrait for HUD cards (cached data URL). */
export function portraitURL(id, paletteIdx = 0, expr = 'normal') {
  const key = `portrait:${id}:${paletteIdx}:${expr}`;
  if (cache.has(key)) return cache.get(key);
  const { parts } = paintAnimal(id, paletteIdx);
  const head = parts[`head_${expr}`].canvas;
  const S = 256;
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  const k = Math.min((S * 0.92) / head.width, (S * 0.92) / head.height);
  ctx.drawImage(head, (S - head.width * k) / 2, (S - head.height * k) / 2 + S * 0.02, head.width * k, head.height * k);
  const url = c.toDataURL();
  cache.set(key, url);
  return url;
}

export function fullBodyURL(id, paletteIdx = 0, expr = 'normal') {
  const key = `body:${id}:${paletteIdx}:${expr}`;
  if (cache.has(key)) return cache.get(key);
  const url = renderFullBody(id, paletteIdx, 1.4, expr).toDataURL();
  cache.set(key, url);
  return url;
}

export { star };
