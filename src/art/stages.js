// Painted stage art: sky, parallax layers, the main ground and the soft platforms.
// Layers are drawn for a 1920x1080 screen and scrolled by the background camera.
import { makeCanvas, shade, seeded, ellipse, mix } from './paint.js';

export const LW = 2800;
export const LH = 1100;
const GROUND_RES = 1.5;

function canvas(w, h) {
  const c = makeCanvas(w, h);
  return [c, c.getContext('2d')];
}

function vgrad(ctx, y0, y1, stops) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  stops.forEach(([t, c]) => g.addColorStop(t, c));
  return g;
}

/** A bumpy silhouette across the layer (tree canopies, hills, ice). */
function ridge(ctx, rnd, y, amp, bump, color, { flat = false, step = 1 } = {}) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, LH);
  let x = 0;
  ctx.lineTo(0, y);
  while (x < LW + bump) {
    const w = bump * (0.6 + rnd() * 0.9) * step;
    const h = y - amp * (0.3 + rnd() * 0.7);
    if (flat) {
      ctx.lineTo(x + w * 0.15, h);
      ctx.lineTo(x + w * 0.85, h);
      ctx.lineTo(x + w, y + amp * 0.1 * rnd());
    } else ctx.quadraticCurveTo(x + w / 2, h - amp * 0.5, x + w, y - rnd() * amp * 0.25);
    x += w;
  }
  ctx.lineTo(LW, LH);
  ctx.closePath();
  ctx.fill();
}

function sunGlow(ctx, x, y, r, color) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

// ------------------------------------------------------------------ grove
function grove() {
  const [sky, s] = canvas(8, 1080);
  s.fillStyle = vgrad(s, 0, 1080, [[0, '#5aaefc'], [0.5, '#a5dcff'], [0.85, '#fff0c4'], [1, '#ffe2a0']]);
  s.fillRect(0, 0, 8, 1080);

  const rnd = seeded(42);
  const [far, f] = canvas(LW, LH);
  sunGlow(f, LW * 0.62, 300, 520, 'rgba(255,248,214,0.9)');
  ridge(f, rnd, 640, 110, 150, '#a9d8c0');
  ridge(f, rnd, 700, 90, 120, '#8cc5a6');
  const [mid, m] = canvas(LW, LH);
  // Trunks, then canopy.
  for (let i = 0; i < 14; i++) {
    const x = rnd() * LW, w = 26 + rnd() * 30;
    m.fillStyle = mix('#3f5f45', '#6b8f6a', rnd() * 0.4);
    m.fillRect(x, 640 + rnd() * 60, w, 700);
  }
  ridge(m, rnd, 560, 150, 210, '#4f8a5d');
  ridge(m, rnd, 720, 70, 120, '#3c7350');
  m.fillStyle = 'rgba(255,240,190,0.08)';
  for (let i = 0; i < 6; i++) {
    m.save();
    m.translate(LW * 0.3 + i * 260, 0);
    m.rotate(0.35);
    m.fillRect(0, -200, 60 + rnd() * 80, 1600);
    m.restore();
  }
  const [near, n] = canvas(LW, LH);
  for (const side of [0, 1]) {
    for (let i = 0; i < 9; i++) {
      const x = side ? LW - rnd() * 520 : rnd() * 520;
      const y = 820 + rnd() * 260;
      const r = 90 + rnd() * 110;
      n.fillStyle = mix('#1f4630', '#2f6342', rnd());
      n.beginPath();
      n.arc(x, y, r, 0, Math.PI * 2);
      n.fill();
    }
  }
  return {
    sky, ambient: 'leaves',
    layers: [
      { canvas: far, f: 0.12, y: 1090, scale: 1.3 },
      { canvas: mid, f: 0.3, y: 1230, scale: 1.25 },
      { canvas: near, f: 0.62, y: 1330, scale: 1.3 },
    ],
    tint: 0xffffff,
  };
}

function groveGround(s) {
  const W = s.x2 - s.x1, pad = 80;
  const H = 520;
  const [c, g] = canvas((W + pad * 2) * GROUND_RES, H * GROUND_RES);
  g.scale(GROUND_RES, GROUND_RES);
  g.translate(pad, 30);
  const rnd = seeded(9);
  // Roots hanging below.
  g.strokeStyle = '#3b2414';
  for (let i = 0; i < 9; i++) {
    const x = 90 + (i / 8) * (W - 180);
    g.lineWidth = 16 + rnd() * 18;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(x, 200);
    g.bezierCurveTo(x + (rnd() - 0.5) * 120, 300, x + (rnd() - 0.5) * 140, 380, x + (rnd() - 0.5) * 100, 420 + rnd() * 40);
    g.stroke();
  }
  // Trunk body.
  g.beginPath();
  g.moveTo(-6, 0);
  g.lineTo(W + 6, 0);
  g.bezierCurveTo(W + 10, 120, W - 50, 210, W - 110, 260);
  g.lineTo(110, 260);
  g.bezierCurveTo(50, 210, -10, 120, -6, 0);
  g.closePath();
  g.fillStyle = vgrad(g, 0, 260, [[0, '#8a5a32'], [0.5, '#6e4426'], [1, '#4a2c17']]);
  g.fill();
  g.lineWidth = 6;
  g.strokeStyle = '#2e1a0c';
  g.stroke();
  g.save();
  g.clip();
  g.strokeStyle = 'rgba(40,20,8,0.35)';
  for (let i = 0; i < 40; i++) {
    const x = rnd() * W;
    g.lineWidth = 2 + rnd() * 4;
    g.beginPath();
    g.moveTo(x, 20 + rnd() * 40);
    g.quadraticCurveTo(x + (rnd() - 0.5) * 30, 140, x + (rnd() - 0.5) * 40, 270);
    g.stroke();
  }
  // Rings (cut stump face) as subtle highlights.
  g.strokeStyle = 'rgba(255,220,160,0.12)';
  g.lineWidth = 3;
  for (let i = 1; i < 6; i++) { g.beginPath(); g.ellipse(W / 2, 0, (W / 2) * (i / 6), 30 * (i / 6), 0, 0, Math.PI); g.stroke(); }
  g.restore();
  // Grass lip.
  g.beginPath();
  g.roundRect(-14, -14, W + 28, 34, 16);
  g.fillStyle = vgrad(g, -14, 20, [[0, '#9be15a'], [1, '#4a9a34']]);
  g.fill();
  g.lineWidth = 5;
  g.strokeStyle = '#25521a';
  g.stroke();
  g.strokeStyle = '#5bb33d';
  g.lineWidth = 3;
  for (let x = -6; x < W + 6; x += 9 + rnd() * 6) {
    g.beginPath();
    g.moveTo(x, 18);
    g.quadraticCurveTo(x + 4, 28, x + (rnd() - 0.5) * 8, 30 + rnd() * 14);
    g.stroke();
  }
  // Flowers and mushrooms on the lip.
  for (let i = 0; i < 16; i++) {
    const x = 20 + rnd() * (W - 40);
    g.fillStyle = ['#ffffff', '#ffd23f', '#ff8fb1', '#b28dff'][i % 4];
    for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x + Math.cos(k * 1.256) * 4, -12 + Math.sin(k * 1.256) * 4, 3.4, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#ffb000';
    g.beginPath(); g.arc(x, -12, 2.4, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.fillRect(0, -10, W, 4);
  return { canvas: c, x: s.x1 - pad, y: s.y - 30, res: GROUND_RES };
}

function grovePlatform(p) {
  const W = p.x2 - p.x1, pad = 40;
  const [c, g] = canvas((W + pad * 2) * GROUND_RES, 90 * GROUND_RES);
  g.scale(GROUND_RES, GROUND_RES);
  g.translate(pad, 20);
  g.beginPath();
  g.roundRect(-8, -4, W + 16, 24, 12);
  g.fillStyle = vgrad(g, -4, 20, [[0, '#a8713f'], [1, '#6b4122']]);
  g.fill();
  g.lineWidth = 4;
  g.strokeStyle = '#33200f';
  g.stroke();
  g.strokeStyle = 'rgba(50,25,10,0.4)';
  g.lineWidth = 2;
  for (let x = 20; x < W; x += 46) { g.beginPath(); g.moveTo(x, 2); g.lineTo(x + 18, 14); g.stroke(); }
  const rnd = seeded(W);
  for (const end of [-6, W + 6]) {
    for (let i = 0; i < 6; i++) {
      g.fillStyle = mix('#3f9a3a', '#7fd14f', rnd());
      g.beginPath();
      g.ellipse(end + (rnd() - 0.5) * 40, 8 + (rnd() - 0.5) * 22, 18, 10, rnd() * 3, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.fillStyle = 'rgba(255,255,255,0.3)';
  g.fillRect(0, -1, W, 3);
  return { canvas: c, ox: pad, oy: 20, res: GROUND_RES };
}

// ------------------------------------------------------------------ savanna
function savanna() {
  const [sky, s] = canvas(8, 1080);
  s.fillStyle = vgrad(s, 0, 1080, [[0, '#24164a'], [0.35, '#7d3a73'], [0.62, '#f06b5a'], [0.82, '#ffb36b'], [1, '#ffe39a']]);
  s.fillRect(0, 0, 8, 1080);
  const rnd = seeded(77);
  const [far, f] = canvas(LW, LH);
  sunGlow(f, LW * 0.45, 640, 600, 'rgba(255,215,140,0.85)');
  f.fillStyle = '#ffe6a6';
  f.beginPath();
  f.arc(LW * 0.45, 640, 120, 0, Math.PI * 2);
  f.fill();
  ridge(f, rnd, 700, 140, 260, '#8a4466', { flat: true });
  ridge(f, rnd, 760, 60, 200, '#6e3558', { flat: true });
  const [mid, m] = canvas(LW, LH);
  ridge(m, rnd, 790, 210, 340, '#4b2346', { flat: true, step: 1.2 });
  m.fillStyle = '#2c1430';
  m.fillRect(0, 860, LW, LH);
  // Acacia trees.
  for (let i = 0; i < 7; i++) {
    const x = 120 + rnd() * (LW - 240), y = 860;
    m.strokeStyle = '#2c1430';
    m.lineWidth = 10;
    m.beginPath();
    m.moveTo(x, y);
    m.quadraticCurveTo(x + 10, y - 60, x - 6, y - 110);
    m.stroke();
    m.fillStyle = '#2c1430';
    m.beginPath();
    m.ellipse(x - 6, y - 118, 90 + rnd() * 30, 22, 0, 0, Math.PI * 2);
    m.fill();
  }
  const [near, n] = canvas(LW, LH);
  n.fillStyle = '#1d0c20';
  for (let x = 0; x < LW; x += 14) {
    const h = 30 + rnd() * 70;
    if (x > 600 && x < LW - 600 && rnd() < 0.85) continue;
    n.beginPath();
    n.moveTo(x - 10, LH);
    n.lineTo(x + (rnd() - 0.5) * 30, LH - 120 - h);
    n.lineTo(x + 10, LH);
    n.fill();
  }
  return {
    sky, ambient: 'embers',
    layers: [
      { canvas: far, f: 0.1, y: 1010, scale: 1.3 },
      { canvas: mid, f: 0.28, y: 1150, scale: 1.25 },
      { canvas: near, f: 0.6, y: 1260, scale: 1.3 },
    ],
  };
}

function savannaGround(s) {
  const W = s.x2 - s.x1, pad = 60, H = 560;
  const [c, g] = canvas((W + pad * 2) * GROUND_RES, H * GROUND_RES);
  g.scale(GROUND_RES, GROUND_RES);
  g.translate(pad, 30);
  const rnd = seeded(5);
  g.beginPath();
  g.moveTo(-4, 0);
  g.lineTo(W + 4, 0);
  g.lineTo(W - 10, 120);
  g.lineTo(W - 70, 250);
  g.lineTo(W - 160, 380);
  g.lineTo(W * 0.62, 470);
  g.lineTo(W * 0.4, 440);
  g.lineTo(170, 360);
  g.lineTo(60, 230);
  g.lineTo(8, 110);
  g.closePath();
  const bands = ['#e08a4f', '#c9603a', '#b44f34', '#d47648', '#9c3f2e', '#7d3127'];
  g.save();
  g.clip();
  let y = 0;
  bands.forEach((b, i) => {
    const h = 50 + rnd() * 50;
    g.fillStyle = b;
    g.beginPath();
    g.moveTo(-10, y);
    for (let x = 0; x <= W + 20; x += 60) g.lineTo(x, y + (rnd() - 0.5) * 12);
    g.lineTo(W + 20, 600);
    g.lineTo(-10, 600);
    g.fill();
    y += h;
  });
  g.fillStyle = vgrad(g, 0, 480, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(40,5,20,0.5)']]);
  g.fillRect(-10, 0, W + 20, 600);
  g.strokeStyle = 'rgba(60,15,10,0.45)';
  g.lineWidth = 3;
  for (let i = 0; i < 18; i++) {
    const x = rnd() * W, yy = 40 + rnd() * 300;
    g.beginPath(); g.moveTo(x, yy); g.lineTo(x + (rnd() - 0.5) * 30, yy + 30 + rnd() * 40); g.lineTo(x + (rnd() - 0.5) * 30, yy + 80 + rnd() * 40); g.stroke();
  }
  g.restore();
  g.lineWidth = 6;
  g.strokeStyle = '#4a1a14';
  g.stroke();
  g.beginPath();
  g.roundRect(-10, -12, W + 20, 26, 10);
  g.fillStyle = vgrad(g, -12, 14, [[0, '#ffd58e'], [1, '#e79b5c']]);
  g.fill();
  g.lineWidth = 5;
  g.strokeStyle = '#6b2a17';
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.fillRect(0, -8, W, 3);
  // Dry grass tufts.
  g.strokeStyle = '#c99a3d';
  g.lineWidth = 2;
  for (let i = 0; i < 30; i++) {
    const x = rnd() * W;
    for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(x, -10); g.lineTo(x + k * 4, -22 - rnd() * 10); g.stroke(); }
  }
  return { canvas: c, x: s.x1 - pad, y: s.y - 30, res: GROUND_RES };
}

function savannaPlatform(p) {
  const W = p.x2 - p.x1, pad = 30;
  const [c, g] = canvas((W + pad * 2) * GROUND_RES, 110 * GROUND_RES);
  g.scale(GROUND_RES, GROUND_RES);
  g.translate(pad, 16);
  g.beginPath();
  g.moveTo(-6, 0);
  g.lineTo(W + 6, 0);
  g.lineTo(W - 30, 36);
  g.lineTo(W * 0.55, 70);
  g.lineTo(W * 0.3, 52);
  g.lineTo(20, 30);
  g.closePath();
  g.fillStyle = vgrad(g, 0, 70, [[0, '#d0703f'], [1, '#7a3026']]);
  g.fill();
  g.lineWidth = 4;
  g.strokeStyle = '#4a1a14';
  g.stroke();
  g.beginPath();
  g.roundRect(-8, -6, W + 16, 14, 7);
  g.fillStyle = '#f5c27c';
  g.fill();
  g.stroke();
  return { canvas: c, ox: pad, oy: 16, res: GROUND_RES };
}

// ------------------------------------------------------------------ glacier
function glacier() {
  const [sky, s] = canvas(8, 1080);
  s.fillStyle = vgrad(s, 0, 1080, [[0, '#040a22'], [0.45, '#0e2150'], [0.8, '#1d4a7a'], [1, '#3d7fa8']]);
  s.fillRect(0, 0, 8, 1080);
  const rnd = seeded(3);
  const [far, f] = canvas(LW, LH);
  for (let i = 0; i < 260; i++) {
    f.fillStyle = `rgba(255,255,255,${0.3 + rnd() * 0.7})`;
    const r = rnd() < 0.1 ? 2.2 : 1.2;
    f.beginPath(); f.arc(rnd() * LW, rnd() * 620, r, 0, Math.PI * 2); f.fill();
  }
  ridge(f, rnd, 700, 260, 300, '#33598a');
  // Snowy peaks.
  f.fillStyle = 'rgba(230,240,255,0.5)';
  ridge(f, rnd, 720, 120, 260, '#4a73a3');
  const [mid, m] = canvas(LW, LH);
  m.fillStyle = vgrad(m, 800, LH, [[0, '#123a66'], [1, '#081a35']]);
  m.fillRect(0, 800, LW, LH);
  for (let i = 0; i < 8; i++) {
    const x = rnd() * LW, w = 120 + rnd() * 200, h = 60 + rnd() * 140;
    m.fillStyle = vgrad(m, 800 - h, 800, [[0, '#e8f6ff'], [1, '#8cc4ea']]);
    m.beginPath();
    m.moveTo(x - w / 2, 806);
    m.lineTo(x - w * 0.3, 800 - h * 0.7);
    m.lineTo(x - w * 0.05, 800 - h);
    m.lineTo(x + w * 0.25, 800 - h * 0.8);
    m.lineTo(x + w / 2, 806);
    m.fill();
    m.fillStyle = 'rgba(200,235,255,0.18)';
    m.fillRect(x - w / 2, 812, w, 18 + rnd() * 14);
  }
  m.strokeStyle = 'rgba(180,225,255,0.25)';
  m.lineWidth = 2;
  for (let i = 0; i < 60; i++) { const x = rnd() * LW, y = 830 + rnd() * 250; m.beginPath(); m.moveTo(x, y); m.lineTo(x + 30 + rnd() * 60, y); m.stroke(); }
  const [aurora, a] = canvas(LW, 700);
  for (const [col, y0, amp] of [['rgba(80,255,180,', 220, 90], ['rgba(110,170,255,', 300, 70], ['rgba(200,120,255,', 180, 60]]) {
    for (let x = 0; x < LW; x += 6) {
      const y = y0 + Math.sin(x * 0.003) * amp + Math.sin(x * 0.011) * 20;
      const g = a.createLinearGradient(0, y - 160, 0, y + 40);
      g.addColorStop(0, col + '0)');
      g.addColorStop(0.75, col + '0.32)');
      g.addColorStop(1, col + '0)');
      a.fillStyle = g;
      a.fillRect(x, y - 160, 7, 200);
    }
  }
  return {
    sky, ambient: 'snow', aurora,
    layers: [
      { canvas: far, f: 0.1, y: 1000, scale: 1.3 },
      { canvas: mid, f: 0.3, y: 1120, scale: 1.25 },
    ],
  };
}

function iceBlock(g, W, H, rnd) {
  g.beginPath();
  g.moveTo(-6, 0);
  g.lineTo(W + 6, 0);
  g.lineTo(W - 20, H * 0.45);
  g.lineTo(W - 90, H * 0.8);
  g.lineTo(W * 0.6, H);
  g.lineTo(W * 0.42, H * 0.86);
  g.lineTo(W * 0.25, H * 0.95);
  g.lineTo(60, H * 0.62);
  g.lineTo(14, H * 0.35);
  g.closePath();
  g.fillStyle = vgrad(g, 0, H, [[0, '#bff0ff'], [0.4, '#6fc4ef'], [1, '#2a6aa8']]);
  g.fill();
  g.save();
  g.clip();
  g.strokeStyle = 'rgba(255,255,255,0.45)';
  g.lineWidth = 2;
  for (let i = 0; i < 10; i++) {
    let x = rnd() * W, y = 20 + rnd() * H * 0.5;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 3; k++) { x += (rnd() - 0.5) * 60; y += 20 + rnd() * 30; g.lineTo(x, y); }
    g.stroke();
  }
  g.fillStyle = 'rgba(255,255,255,0.18)';
  for (let i = 0; i < 4; i++) { g.save(); g.translate(rnd() * W, 0); g.rotate(0.5); g.fillRect(0, -40, 26, H * 1.4); g.restore(); }
  g.restore();
  g.lineWidth = 5;
  g.strokeStyle = '#1b4677';
  g.stroke();
  // Snow cap with drips.
  g.beginPath();
  g.moveTo(-12, 8);
  g.quadraticCurveTo(-14, -14, 8, -12);
  g.lineTo(W - 8, -12);
  g.quadraticCurveTo(W + 14, -14, W + 12, 8);
  for (let x = W; x > 0; x -= 40 + rnd() * 40) g.quadraticCurveTo(x - 10, 26 + rnd() * 18, x - 30, 10);
  g.closePath();
  g.fillStyle = vgrad(g, -12, 26, [[0, '#ffffff'], [1, '#d9efff']]);
  g.fill();
  g.lineWidth = 4;
  g.strokeStyle = '#7fb4dd';
  g.stroke();
}

function glacierGround(s) {
  const W = s.x2 - s.x1, pad = 60, H = 330;
  const [c, g] = canvas((W + pad * 2) * GROUND_RES, (H + 80) * GROUND_RES);
  g.scale(GROUND_RES, GROUND_RES);
  g.translate(pad, 30);
  iceBlock(g, W, H, seeded(12));
  return { canvas: c, x: s.x1 - pad, y: s.y - 30, res: GROUND_RES };
}

function glacierPlatform(p) {
  const W = p.x2 - p.x1, pad = 30;
  const [c, g] = canvas((W + pad * 2) * GROUND_RES, 120 * GROUND_RES);
  g.scale(GROUND_RES, GROUND_RES);
  g.translate(pad, 20);
  iceBlock(g, W, 70, seeded(W));
  return { canvas: c, ox: pad, oy: 20, res: GROUND_RES };
}

const PAINTERS = {
  grove: { bg: grove, ground: groveGround, platform: grovePlatform },
  savanna: { bg: savanna, ground: savannaGround, platform: savannaPlatform },
  glacier: { bg: glacier, ground: glacierGround, platform: glacierPlatform },
};

export function paintStage(def) {
  const P = PAINTERS[def.id];
  const bg = P.bg();
  return {
    ...bg,
    grounds: def.solids.map((s) => P.ground(s)),
    platforms: def.platforms.map((p) => P.platform(p)),
  };
}

/** Small thumbnail for the stage select screen. */
export function stageThumbURL(def, w = 480, h = 270) {
  const art = paintStage(def);
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  g.drawImage(art.sky, 0, 0, w, h);
  const k = w / 1920;
  for (const L of art.layers) {
    const lw = L.canvas.width * L.scale * k, lh = L.canvas.height * L.scale * k;
    g.drawImage(L.canvas, (w - lw) / 2, L.y * k - lh + 60 * k, lw, lh);
  }
  if (art.aurora) g.drawImage(art.aurora, -w * 0.2, 0, w * 1.4, h * 0.6);
  // Stage at a fixed camera: ground top at 62% height, zoom 0.55.
  const z = 0.42 * k * 1.9;
  const cx = w / 2, gy = h * 0.56;
  art.grounds.forEach((gr) => {
    g.drawImage(gr.canvas, cx + gr.x * z, gy + gr.y * z, (gr.canvas.width / gr.res) * z, (gr.canvas.height / gr.res) * z);
  });
  def.platforms.forEach((p, i) => {
    const pa = art.platforms[i];
    g.drawImage(pa.canvas, cx + (p.x1 - pa.ox) * z, gy + (p.y - pa.oy) * z, (pa.canvas.width / pa.res) * z, (pa.canvas.height / pa.res) * z);
  });
  return c.toDataURL('image/jpeg', 0.85);
}

export { shade, ellipse };
