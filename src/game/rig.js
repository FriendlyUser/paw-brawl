// The puppet rig: painted parts in Phaser containers, posed every render frame.
// Poses are targets in degrees; the rig eases toward them with frame-rate independent
// smoothing, so animation stays fluid at any refresh rate.
import { RES } from '../art/paint.js';
import { rigLayout } from '../art/animals.js';

const D2R = Math.PI / 180;
const REST = { lean: 4, by: 0, sx: 1, sy: 1, head: 0, armF: 28, armB: 38, legF: 8, legB: -8, tail: 10, spin: 0, armFs: 1, armBs: 1, legFs: 1, legBs: 1 };
const KEYS = Object.keys(REST);
const P = (o) => ({ ...REST, ...o });
const CROUCH = { by: 0.3, lean: 22, legF: 48, legB: -30, sx: 1.08, sy: 0.88, head: 6, armF: 50, armB: 40 };

// Attack animations: wind-up pose, hit pose, optional land pose and spin (degrees
// spread across the active frames).
const ANIMS = {
  jab: { wind: { armF: 50, armB: 40, lean: 2 }, hit: { armF: 92, armFs: 1.38, lean: 12, armB: 25, head: -4 } },
  jab2: { wind: { armB: 52, armF: 70 }, hit: { armB: 92, armBs: 1.4, lean: 14, armF: 30 } },
  jabfin: { wind: { lean: -10, armF: 40, legF: -10 }, hit: { legF: 92, legFs: 1.28, lean: -18, armF: 120, armB: -30 } },
  ftilt: { wind: { legF: -25, lean: 4, armF: 60 }, hit: { legF: 98, legFs: 1.32, lean: -22, armF: 140, armB: -30, legB: -10 } },
  ledgeatk: { wind: { legF: -25, lean: 4, armF: 60 }, hit: { legF: 98, legFs: 1.32, lean: -22, armF: 140, armB: -30 } },
  utilt: { wind: { armF: 10, lean: 8, by: 0.1 }, hit: { armF: 178, armFs: 1.32, lean: -12, head: 22, armB: 40, by: -0.08 } },
  dtilt: { wind: { ...CROUCH, legF: 40 }, hit: { ...CROUCH, lean: 30, legF: 100, legFs: 1.38, legB: -40, armF: 30, armB: 60 } },
  dashatk: { wind: { lean: 22, legF: 30 }, hit: { lean: -30, by: 0.15, legF: 85, legFs: 1.3, legB: -20, armF: 140, armB: -50 } },
  fsmash: { wind: { lean: -24, armF: -70, armB: 50, head: 12, sx: 0.96, sy: 1.04, legF: 20, legB: -30 }, hit: { lean: 30, armF: 95, armFs: 1.55, armB: -60, legF: 35, legB: -45, head: -6 } },
  usmash: { wind: { ...CROUCH, by: 0.35, armF: -20, armB: -30, lean: 10 }, hit: { armF: 180, armB: 176, armFs: 1.38, armBs: 1.32, head: 30, sy: 1.14, sx: 0.9, by: -0.15, lean: -6 } },
  dsmash: { wind: { by: 0.25, armF: 30, armB: 30, sx: 1.05, sy: 0.93, legF: 20, legB: -20 }, hit: { legF: 100, legB: -100, legFs: 1.35, legBs: 1.35, by: 0.38, armF: 110, armB: -110, sx: 1.1, sy: 0.9 } },
  nair: { wind: { legF: 70, legB: 50, armF: 90, armB: 90 }, hit: { armF: 90, armB: -90, legF: 80, legB: -80, armFs: 1.2, legFs: 1.15 }, spin: 360 },
  fair: { wind: { lean: -18, armF: 175, armB: 150, head: 10 }, hit: { armF: 50, armFs: 1.48, lean: 26, legF: 30, legB: -30, armB: 80 } },
  bair: { wind: { lean: 10, legB: 10, legF: 40 }, hit: { legB: -115, legBs: 1.42, lean: 34, head: -12, armF: 60, armB: 40, legF: 30 } },
  uair: { wind: { legF: 40, legB: 20, armF: 60 }, hit: { legF: 160, legFs: 1.3, armF: 30, armB: -40 }, spin: -300 },
  dair: { wind: { legF: 60, legB: 50, armF: 140, armB: 150, sy: 1.05 }, hit: { legF: 8, legB: -8, legFs: 1.38, legBs: 1.38, armF: 160, armB: 160, by: -0.2, sy: 1.1, sx: 0.92 } },
  grab: { wind: { armF: 40, armB: 30, lean: 4 }, hit: { armF: 88, armB: 80, armFs: 1.45, armBs: 1.4, lean: 16 } },
  fthrow: { wind: { armF: 70, armB: 70, lean: -10 }, hit: { armF: 100, armB: 90, armFs: 1.32, lean: 22 } },
  bthrow: { wind: { armF: 80, armB: 80 }, hit: { armF: -60, armB: -70, lean: -30, armFs: 1.3 } },
  uthrow: { wind: { armF: 170, armB: 165, by: 0.15 }, hit: { armF: 178, armB: 178, sy: 1.12, sx: 0.92, by: -0.1, head: 20 } },
  dthrow: { wind: { armF: 120, armB: 120, sy: 1.05 }, hit: { armF: 30, armB: 30, by: 0.35, sx: 1.12, sy: 0.86, lean: 30 } },
  lob: { wind: { armF: -80, lean: -15, armB: 40 }, hit: { armF: 125, armFs: 1.25, lean: 18, armB: -20 } },
  rush: { wind: { lean: -10, by: 0.2 }, hit: { lean: 38, head: -18, armF: -50, armB: -60 }, run: true },
  stampede: { wind: { lean: -6, by: 0.2, head: 10 }, hit: { lean: 30, head: -26, armF: -40, armB: -50 }, run: true },
  leap: { wind: { ...CROUCH, by: 0.35, armF: -30, armB: -40 }, hit: { armF: 178, armB: 160, armFs: 1.25, sy: 1.18, sx: 0.88, head: 25, legF: -5, legB: -20, lean: -5 } },
  hornup: { wind: { ...CROUCH, by: 0.35, head: 20 }, hit: { armF: 150, armB: 140, sy: 1.18, sx: 0.88, head: 35, legF: -5, legB: -20, lean: -12 } },
  springhop: { wind: { ...CROUCH, by: 0.4 }, hit: { legF: -5, legB: 5, legFs: 1.35, legBs: 1.35, armF: 170, armB: 170, sy: 1.2, sx: 0.85 } },
  pound: { wind: { legF: 70, legB: 60, armF: 140, armB: 140, by: -0.1 }, hit: { legF: 10, legB: -10, armF: 170, armB: 170, sy: 1.1, sx: 0.9 }, land: { by: 0.3, sx: 1.25, sy: 0.8, armF: 100, armB: -100, legF: 40, legB: -40 } },
  quake: { wind: { legF: 70, legB: 60, armF: 120, armB: 120, head: 10 }, hit: { legF: 10, legB: -10, armF: 150, armB: 150, sy: 1.1, sx: 0.9 }, land: { by: 0.32, sx: 1.25, sy: 0.8, armF: 90, armB: -90, legF: 45, legB: -45, head: -10 } },
  bellyflop: { wind: { legF: 60, legB: 50, armF: 150, armB: 150 }, hit: { spin: 75, armF: 100, armB: 90, legF: -30, legB: -40 }, land: { by: 0.3, sx: 1.3, sy: 0.75, armF: 100, armB: -100, legF: 50, legB: -50 } },
  stompdive: { wind: { legF: 70, legB: 60, armF: 120 }, hit: { lean: -35, legF: 70, legFs: 1.35, legB: 20, armF: 160, armB: 140 }, land: { by: 0.25, sx: 1.2, sy: 0.82, legF: 40, legB: -40 } },
  pounce: { wind: { ...CROUCH, lean: 20 }, hit: { lean: 70, armF: 110, armB: 100, armFs: 1.25, legF: -40, legB: -70, head: -20 } },
  dropkick: { wind: { lean: -10, legF: 40, legB: 30 }, hit: { lean: -55, legF: 95, legB: 85, legFs: 1.3, legBs: 1.25, armF: 160, armB: 150 } },
  swoop: { wind: { armF: 160, armB: 160 }, hit: { lean: 60, armF: 120, armB: 110, legF: -50, legB: -60, head: -10 } },
  spinup: { wind: { ...CROUCH }, hit: { armF: 100, armB: -100, legF: 20, legB: -20, armFs: 1.2 }, spin: 1080 },
  copter: { wind: { armF: 60 }, hit: { armF: 175, armB: 170, legF: 10, legB: -10 }, spin: 1440 },
  updraft: { wind: { armF: 40, armB: 30, by: 0.2 }, hit: { armB: 165, sy: 1.1, legF: -10, legB: -20 }, flap: true },
  counter: { wind: { armF: 70, armB: 80, lean: -12, head: -10, by: 0.1 }, hit: { armF: 70, armB: 80, lean: -12, head: -10, by: 0.1 } },
  counterhit: { wind: { lean: -10, armF: -30 }, hit: { armF: 100, armFs: 1.5, lean: 25, armB: -40 } },
  tongue: { wind: { head: 12, lean: -5 }, hit: { head: -4, lean: 12, armF: 40, armB: 30 } },
  snort: { wind: { head: 18, lean: -12, by: 0.1 }, hit: { head: -22, lean: 18, armF: 40, armB: 20 } },
  wingshot: { wind: { armF: 160, armB: 150, lean: -10 }, hit: { armF: 80, armB: 70, armFs: 1.2, lean: 15 } },
  screech: { wind: { armF: 40, armB: 40, head: -10, by: 0.1 }, hit: { armF: 130, armB: 130, armFs: 1.2, armBs: 1.2, head: 25, sy: 1.1, sx: 1.05 } },
};

function lastActive(m) {
  if (m._la != null) return m._la;
  let la = 0;
  for (const h of m.hit ?? []) la = Math.max(la, h.f[1]);
  for (const v of m.vel ?? []) la = Math.max(la, v.f[1]);
  if (m.grab) la = Math.max(la, m.grab.f[1]);
  if (m.throw) la = Math.max(la, m.throw.f + 4);
  if (m.counter) la = Math.max(la, m.counter[1]);
  if (m.proj) la = Math.max(la, ...m.proj.map((p) => p.f + 4));
  m._la = la || Math.round(m.frames * 0.5);
  return m._la;
}

function firstActive(m) {
  if (m.firstActive != null) return m.firstActive;
  if (m.grab) return m.grab.f[0];
  if (m.throw) return m.throw.f;
  if (m.counter) return m.counter[0];
  if (m.proj) return Math.min(...m.proj.map((p) => p.f));
  return Math.round(m.frames * 0.3);
}

export class Rig {
  constructor(scene, layer, fighter, art, key, shadowLayer = layer) {
    this.scene = scene;
    this.f = fighter;
    this.d = art.dims;
    this.key = key;
    const d = this.d;
    const lay = rigLayout(d);
    this.pivotY = d.th * 0.35;
    this.shadow = scene.add.image(0, 0, 'fx_shadow').setAlpha(0.8);
    shadowLayer.add(this.shadow);
    this.root = scene.add.container(0, 0);
    this.body = scene.add.container(0, -d.L - this.pivotY);
    this.parts = {};
    for (const name of ['tail', 'armB', 'legB', 'torso', 'legF', 'tongue', 'head', 'armF']) {
      if (name === 'tongue') {
        if (fighter.charId !== 'frog') continue;
        const t = scene.add.image(lay.head.x + d.hr * 0.75, lay.head.y + this.pivotY - d.hr * 0.4, 'fx_tongue').setOrigin(0, 0.5).setVisible(false);
        this.parts.tongue = t;
        this.body.add(t);
        continue;
      }
      const tex = name === 'head' ? `${key}_head_normal` : `${key}_${name}`;
      if (!scene.textures.exists(tex)) continue;
      const fr = scene.textures.get(tex).getSourceImage();
      const meta = art.parts[name === 'head' ? 'head_normal' : name];
      const img = scene.add.image(lay[name].x, lay[name].y + this.pivotY, tex).setOrigin(meta.ox, meta.oy).setScale(1 / RES);
      img.baseScale = 1 / RES;
      void fr;
      this.parts[name] = img;
      this.body.add(img);
    }
    this.root.add(this.body);
    layer.add(this.root);
    this.cur = { ...REST };
    this.facing = fighter.facing;
    this.phase = 0;
    this.squash = 0;
    this.flip = 0;
    this.tumble = 0;
    this.expr = 'normal';
    this.blinkT = 2 + Math.random() * 3;
    this.time = 0;
    this.visible = true;
  }

  /** Squash & stretch impulse (positive = squash). */
  impulse(k) { this.squash = Math.max(-0.3, Math.min(0.35, this.squash + k)); }

  setTint(color, fill = false) {
    for (const p of Object.values(this.parts)) {
      if (p === this.parts.tongue) continue;
      if (color == null) p.clearTint();
      else if (fill) p.setTintFill(color);
      else p.setTint(color);
    }
  }

  target(t) {
    const f = this.f;
    const d = this.d;
    const st = f.state;
    const sf = f.sf;
    const ph = this.phase;
    switch (st) {
      case 'idle': case 'respawn': case 'shielddrop':
        return { p: P({ by: Math.sin(t * 3.2) * 0.012, sy: 1 + Math.sin(t * 3.2) * 0.014, head: Math.sin(t * 1.6) * 3, armF: 30 + Math.sin(t * 3.2) * 5, armB: 40 + Math.sin(t * 3.2 + 1) * 5, tail: 10 + Math.sin(t * 2.4) * 14 }), k: 0.18 };
      case 'walk': { const s = Math.sin(ph); return { p: P({ lean: 6, by: -Math.abs(Math.cos(ph)) * 0.05, legF: s * 30, legB: -s * 30, armF: 20 - s * 26, armB: 20 + s * 26, tail: 15 + s * 10, head: Math.cos(ph * 2) * 2 }), k: 0.35 }; }
      case 'run': { const s = Math.sin(ph); return { p: P({ lean: 17, by: -Math.abs(Math.cos(ph)) * 0.12 + 0.03, legF: s * 58 + 10, legB: -s * 58 + 10, armF: -s * 60 + 15, armB: s * 60 + 15, head: -6, tail: 45 + s * 12, sx: 1.03, sy: 0.97 }), k: 0.45 }; }
      case 'crouch': return { p: P(CROUCH), k: 0.4 };
      case 'jumpsquat': return { p: P({ ...CROUCH, by: 0.38, sy: 0.82, sx: 1.12 }), k: 0.65 };
      case 'land': return { p: P({ by: 0.22, legF: 38, legB: -26, sx: 1.08, sy: 0.9, armF: 60, armB: -10, lean: 10 }), k: 0.5 };
      case 'air': case 'helpless': {
        const helpless = st === 'helpless';
        if (this.flip > 0) return { p: P({ legF: 80, legB: 60, armF: 100, armB: 90, spin: (1 - this.flip) * 360 }), k: 0.5, spin: true };
        if (f.vy < -3 && !helpless) return { p: P({ legF: 52, legB: 8, armF: 150, armB: 122, sy: 1.05, sx: 0.96, tail: -20, lean: -4 }), k: 0.25 };
        const flail = Math.sin(t * 11) * 7;
        return { p: P({ legF: 18, legB: -24, armF: (helpless ? 165 : 112) + flail, armB: (helpless ? 150 : 82) - flail, lean: 6, tail: 30, head: helpless ? -10 : 0 }), k: 0.18 };
      }
      case 'shield': return { p: P({ lean: -4, by: 0.12, legF: 25, legB: -20, armF: 75, armB: 85, head: -8, sx: 1.04, sy: 0.95 }), k: 0.5 };
      case 'roll': {
        const prog = Math.min(1, sf / 26);
        const dir = f.rollDir === f.facing ? 1 : -1;
        return { p: P({ spin: prog * 360 * dir, legF: 85, legB: 70, armF: 120, armB: 120, by: 0.35, sx: 0.92, sy: 0.92 }), k: 0.55, spin: true };
      }
      case 'spotdodge': return { p: P({ by: 0.25, sy: 0.85, sx: 1.1, lean: -12, armF: 40, armB: 40, legF: 30, legB: -30 }), k: 0.5 };
      case 'airdodge': return { p: P({ legF: 62, legB: 40, armF: 90, armB: 100, lean: -10 }), k: 0.4 };
      case 'hitstun':
        if (f.tumble && !f.grounded) return { p: P({ armF: 160, armB: -140, legF: 40, legB: -50, spin: this.tumble }), k: 0.6, spin: true };
        return { p: P({ lean: -25, head: 20, armF: 140, armB: 160, legF: 30, legB: -30, by: -0.05 }), k: 0.6 };
      case 'downed': return { p: P({ spin: -84, by: 0.95, armF: 160, armB: 140, legF: 10, legB: -10, head: 10 }), k: 0.3 };
      case 'getup': return { p: P({ by: 0.2, armF: 60, armB: 40 }), k: 0.25 };
      case 'dizzy': return { p: P({ lean: Math.sin(t * 4) * 10, head: Math.sin(t * 4 + 1) * 14, armF: 10, armB: 5, by: 0.05 }), k: 0.2 };
      case 'shieldbreak': return { p: P({ armF: 170, armB: 170, legF: 20, legB: -20, lean: -20 }), k: 0.3 };
      case 'ledge': return { p: P({ armF: 176, armB: 170, armFs: 1.15, armBs: 1.15, legF: 10 + Math.sin(t * 3) * 6, legB: -10 + Math.sin(t * 3 + 1) * 6, by: -0.08, lean: -6, head: 15 }), k: 0.4 };
      case 'ledgeclimb': return { p: P({ armF: 120, armB: 100, legF: 70, legB: -10, lean: 20 }), k: 0.4 };
      case 'grabbed': return { p: P({ armF: 150 + Math.sin(t * 20) * 12, armB: 140, legF: 30 + Math.sin(t * 18) * 22, legB: -30, lean: -10 }), k: 0.5 };
      case 'holding': return { p: P({ armF: 85, armB: 80, lean: 6, armFs: 1.2, armBs: 1.2 }), k: 0.4 };
      case 'attack': return this.attackPose(t);
      default: return { p: P({}), k: 0.2 };
    }
  }

  attackPose(t) {
    const f = this.f;
    const m = f.move;
    const A = ANIMS[m.anim] ?? ANIMS.jab;
    const fa = firstActive(m);
    const la = lastActive(m);
    const mf = f.mf;
    let base = f.grounded || m.aerial ? {} : { legF: 30, legB: -10 };
    if (A.land && m.loopLand && mf >= m.loopLand.land) {
      return { p: P({ ...A.land }), k: 0.6 };
    }
    if (mf < fa) {
      const shake = f.holdingCharge ? Math.sin(t * 70) * 2.5 : 0;
      return { p: P({ ...base, ...A.wind, lean: (A.wind.lean ?? 4) + shake }), k: 0.32 };
    }
    if (mf <= la + 3) {
      const prog = Math.min(1, (mf - fa) / Math.max(1, la - fa + 1));
      const p = P({ ...base, ...A.hit });
      let spin = false;
      if (A.spin) { p.spin = prog * A.spin; spin = true; }
      if (A.run) { const s = Math.sin(t * 28); p.legF = s * 55 + 10; p.legB = -s * 55 + 10; }
      if (A.flap) { p.armF = 110 + Math.sin(t * 32) * 60; p.armB = 100 + Math.sin(t * 32 + 0.4) * 60; }
      return { p, k: 0.7, spin };
    }
    return { p: P(f.grounded ? {} : { legF: 30, legB: -15, armF: 90, armB: 70 }), k: 0.14 };
  }

  update(dt, alpha, t) {
    const f = this.f;
    const d = this.d;
    this.time = t;
    const dead = f.state === 'dead';
    this.root.setVisible(!dead);
    this.shadow.setVisible(!dead);
    if (dead) return;
    const x = f.px + (f.x - f.px) * alpha;
    const y = f.py + (f.y - f.py) * alpha;
    const step = dt * 60;
    // Walk/run cycle advances with distance covered.
    if (f.state === 'walk' || f.state === 'run') this.phase += (Math.abs(f.vx) * 0.12 * step) / Math.max(0.7, this.d.h / 140);
    if (this.flip > 0) this.flip = Math.max(0, this.flip - dt * 3.2);
    if (f.state === 'hitstun' && f.tumble && !f.grounded) this.tumble += (f.launchSpeed * 0.9 + 6) * step * (f.kbx * f.facing > 0 ? -1 : 1);
    else this.tumble = 0;
    const { p, k, spin } = this.target(t);
    const a = 1 - Math.pow(1 - k, step);
    const c = this.cur;
    for (const key of KEYS) {
      if (key === 'spin' && spin) { c.spin = p.spin; continue; }
      c[key] += (p[key] - c[key]) * a;
    }
    if (!spin) c.spin += (0 - c.spin) * a; // unwind spins smoothly
    this.squash *= Math.pow(0.82, step);
    // Facing turns flip through zero for a quick paper-turn.
    this.facing += Math.sign(f.facing - this.facing) * Math.min(Math.abs(f.facing - this.facing), 0.34 * step);
    const shake = f.hitlag > 0 && f.state === 'hitstun' ? (Math.random() - 0.5) * 7 : 0;
    this.root.setPosition(x + shake, y);
    const sx = c.sx * (1 + this.squash);
    const sy = c.sy * (1 - this.squash);
    const fs = Math.abs(this.facing) < 0.08 ? 0.08 * Math.sign(this.facing || 1) : this.facing;
    this.root.setScale(fs * sx, sy);
    this.body.y = -d.L - this.pivotY + c.by * d.L;
    this.body.rotation = (c.lean + c.spin) * D2R;
    const pr = this.parts;
    const rot = (part, deg, s = 1) => { if (part) { part.rotation = -deg * D2R; part.scaleY = part.baseScale * s; } };
    rot(pr.armF, c.armF, c.armFs);
    rot(pr.armB, c.armB, c.armBs);
    rot(pr.legF, c.legF, c.legFs);
    rot(pr.legB, c.legB, c.legBs);
    rot(pr.tail, c.tail);
    if (pr.head) pr.head.rotation = -c.head * D2R;
    // Expression.
    let expr = 'normal';
    if (['hitstun', 'grabbed', 'dizzy', 'downed', 'shieldbreak'].includes(f.state)) expr = 'hurt';
    else if (f.state === 'attack' || f.state === 'holding' || f.holdingCharge) expr = 'angry';
    else {
      this.blinkT -= dt;
      if (this.blinkT < 0) { expr = 'blink'; if (this.blinkT < -0.12) this.blinkT = 2 + Math.random() * 3.5; }
    }
    if (expr !== this.expr) {
      this.expr = expr;
      pr.head?.setTexture(`${this.key}_head_${expr}`);
    }
    // Frog tongue.
    if (pr.tongue) {
      const m = f.state === 'attack' && f.move?.tongue;
      if (m) {
        const fa = f.move.firstActive, la = lastActive(f.move);
        const mf = f.mf;
        let prog = 0;
        if (mf >= m.from && mf < fa) prog = (mf - m.from) / Math.max(1, fa - m.from);
        else if (mf >= fa && mf <= la) prog = 1;
        else if (mf > la && mf <= m.to) prog = 1 - (mf - la) / Math.max(1, m.to - la);
        const reach = Math.max(...f.move.hit.map((h) => h.x)) - pr.tongue.x + 20;
        pr.tongue.setVisible(prog > 0.02);
        pr.tongue.scaleX = (reach * prog) / 64;
        pr.tongue.scaleY = 0.9;
      } else pr.tongue.setVisible(false);
    }
    // Shadow on the ground beneath.
    const ground = this.groundBelow(x, y);
    if (ground != null) {
      const hgt = ground - y;
      const k2 = Math.max(0, 1 - hgt / 500);
      this.shadow.setVisible(k2 > 0.02).setPosition(x, ground + 2).setScale((d.tw / 90) * (0.6 + 0.4 * k2), 0.9 * (0.6 + 0.4 * k2)).setAlpha(0.75 * k2);
    } else this.shadow.setVisible(false);
  }

  groundBelow(x, y) {
    let best = null;
    for (const s of this.f.battle.stage.surfaces) {
      if (x < s.x1 || x > s.x2 || s.y < y - 2) continue;
      if (best == null || s.y < best) best = s.y;
    }
    return best;
  }

  destroy() {
    this.root.destroy();
    this.shadow.destroy();
  }
}
