// A match: fighters, projectiles, hit resolution, KOs, respawns and the win check.
// Deterministic for a given seed; the renderer reads state and drains `events`.
import { Fighter } from './fighter.js';
import { instantiateStage } from './stages.js';
import { PROJECTILES } from './moves.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DEFAULT_RULES = { stocks: 3, time: 0, launchScale: 0.25, kbDecay: 0.51, teams: false };

export function knockback(p, d, w, h) {
  return (((p / 10 + (p * d) / 20) * (200 / (w + 100)) * 1.4 + 18) * (h.kbg / 100)) + h.bkb;
}

function circleRect(cx, cy, r, b) {
  const nx = Math.max(b.x1, Math.min(cx, b.x2));
  const ny = Math.max(b.y1, Math.min(cy, b.y2));
  return (cx - nx) ** 2 + (cy - ny) ** 2 <= r * r;
}

export class Battle {
  /**
   * @param {object} cfg { stageId, rules, seed, players: [{ charId, palette, team, controller, cpu, tapJump }] }
   * Each controller is { poll(fighter, battle) -> raw input }.
   */
  constructor(cfg) {
    this.rules = { ...DEFAULT_RULES, ...cfg.rules };
    this.rng = mulberry32(cfg.seed ?? 1);
    this.stage = instantiateStage(cfg.stageId);
    this.frame = 0;
    this.events = [];
    this.projectiles = [];
    this.nextProjId = 1;
    this.over = false;
    this.winner = null;
    this.timeLeft = this.rules.time ? this.rules.time * 60 : null;
    const spawns = this.stage.def.spawns;
    this.fighters = cfg.players.map((p, i) => new Fighter(this, {
      ...p,
      slot: i,
      team: this.rules.teams ? p.team : i,
      stocks: this.rules.time ? Infinity : this.rules.stocks,
      spawnX: spawns[i % spawns.length],
    }));
  }

  step() {
    if (this.over && this.overFrame && this.frame - this.overFrame > 600) return;
    this.frame++;
    this.stage.update(this.frame);
    for (const f of this.fighters) {
      f.px = f.x;
      f.py = f.y;
      f.input.update(f.controller.poll(f, this));
    }
    for (const f of this.fighters) {
      if (f.state === 'dead' || f.state === 'respawn') this.respawnStep(f);
      else f.update();
    }
    this.separate();
    this.updateProjectiles();
    this.resolveHits();
    for (const f of this.fighters) this.checkBlast(f);
    if (this.timeLeft != null && !this.over) {
      this.timeLeft--;
      if (this.timeLeft <= 0) this.finish();
    }
  }

  /** Grounded fighters overlapping on the same surface ease apart instead of stacking. */
  separate() {
    const busy = new Set(['hitstun', 'grabbed', 'holding', 'dead', 'respawn', 'ledge', 'ledgeclimb', 'roll', 'downed']);
    const fs = this.fighters;
    for (let i = 0; i < fs.length; i++) {
      for (let j = i + 1; j < fs.length; j++) {
        const a = fs[i], b = fs[j];
        if (!a.grounded || !b.grounded || a.surface !== b.surface || busy.has(a.state) || busy.has(b.state)) continue;
        const overlap = (a.w + b.w) * 0.3 - Math.abs(a.x - b.x);
        if (overlap <= 0) continue;
        const dir = Math.sign(a.x - b.x) || (this.frame % 2 ? 1 : -1);
        const push = Math.min(overlap, 2.4) / 2;
        const s = a.surface;
        a.x = Math.max(s.x1, Math.min(s.x2, a.x + dir * push));
        b.x = Math.max(s.x1, Math.min(s.x2, b.x - dir * push));
      }
    }
  }

  drainEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }

  // ---------------------------------------------------------------- hits
  resolveHits() {
    const hits = [];
    const grabs = [];
    for (const a of this.fighters) {
      if (a.hitlag > 0 || a.state !== 'attack') continue;
      const boxes = a.activeHitboxes();
      const gb = a.activeGrab();
      for (const v of this.fighters) {
        if (v === a || v.team === a.team || !v.isHittable() || v.grabbedBy === a) continue;
        const hurt = v.hurtbox();
        for (const h of boxes) {
          const key = `${v.id}:${h.group ?? 0}`;
          if (a.hitSet.has(key)) continue;
          if (!circleRect(h.wx, h.wy, h.r, hurt)) continue;
          a.hitSet.set(key, a.mf);
          hits.push({ a, v, h });
          break;
        }
        if (gb && !a.holding && v.state !== 'grabbed' && !v.holding && circleRect(gb.wx, gb.wy, gb.r, hurt)) grabs.push({ a, v });
      }
    }
    for (const { a, v, h } of hits) this.applyHit(a, v, h, a.facing, false);
    for (const { a, v } of grabs) {
      if (a.state !== 'attack' || v.state === 'hitstun' || v.state === 'grabbed' || v.hitlag > 0 || !v.isHittable()) continue;
      this.startGrab(a, v);
    }
  }

  applyHit(a, v, h, dir, projectile, opts = {}) {
    const ev = this.events;
    // Counter: the cat's Hiss turns the hit around.
    if (!opts.throw && v.inWindow('counter')) {
      v.counterDmg = Math.max(8, h.dmg * 1.3);
      v.facing = a.x >= v.x ? 1 : -1;
      v.startMove('counterHit');
      v.hitlag = 10;
      if (!projectile) a.hitlag = 14;
      ev.push({ type: 'counter', f: v, x: v.x, y: v.y - v.h * 0.6 });
      return;
    }
    if (!opts.throw && v.shielding()) {
      v.shieldHp -= h.dmg * 1.15;
      v.shieldStun = Math.round(h.dmg * 0.75 + 3);
      v.vx = (v.x >= (projectile ? h.wx : a.x) ? 1 : -1) * (h.dmg * 0.22 + 1.5);
      const lag = Math.round(Math.min(14, h.dmg * 0.3 + 3));
      v.hitlag = lag;
      if (!projectile) a.hitlag = lag;
      ev.push({ type: 'shieldhit', f: v, x: h.wx, y: h.wy, dmg: h.dmg });
      if (v.shieldHp <= 0) { v.hitlag = 0; v.breakShield(); }
      return;
    }
    const dmg = h.dmg;
    v.damage = Math.min(999, v.damage + dmg);
    const kb = knockback(v.damage, dmg, v.st.weight, h);
    if (!opts.throw && v.inWindow('armor') && kb < v.move.armor[2]) {
      v.armorFlash = 10;
      const lag = Math.round(Math.min(12, dmg * 0.4 + 3));
      v.hitlag = lag;
      if (!projectile) a.hitlag = lag;
      a.record.dealt += dmg;
      v.record.taken += dmg;
      ev.push({ type: 'armor', f: v, x: h.wx, y: h.wy, dmg });
      return;
    }
    let ang = h.ang;
    if (ang === 361) ang = v.grounded && kb < 55 ? 0 : 40;
    // Release whatever the victim was doing.
    if (v.holding) this.releaseGrab(v, true);
    if (v.grabbedBy && !opts.throw) { const g = v.grabbedBy; v.grabbedBy = null; g.holding = null; if (g.state === 'holding') g.toIdle(); }
    if (v.ledge) { v.ledge.owner = null; v.ledge = null; }
    const wasStunned = v.state === 'hitstun';
    v.setState('hitstun');
    v.grabbedBy = null;
    v.hitstun = Math.floor(kb * 0.4);
    v.tumble = kb > 78;
    v.pendingKb = { kb, ang, dir };
    const lag = Math.min(20, Math.floor(dmg * 0.45 + 4) + (kb > 140 ? 5 : 0));
    v.hitlag = lag;
    v.flash = 8;
    if (!projectile && !opts.throw) a.hitlag = lag;
    v.combo = wasStunned ? v.combo + 1 : 1;
    a.record.maxCombo = Math.max(a.record.maxCombo, v.combo);
    a.record.dealt += dmg;
    v.record.taken += dmg;
    v.lastHitBy = a;
    v.lastHitFrame = this.frame;
    ev.push({
      type: 'hit', a, f: v, x: projectile ? h.wx : (h.wx + v.x) / 2, y: projectile ? h.wy : (h.wy + v.y - v.h / 2) / 2,
      dmg, kb, ang, dir, sfx: h.sfx ?? a.move?.sfx ?? 'mid', combo: v.combo, projectile,
    });
  }

  // ---------------------------------------------------------------- grabs
  startGrab(a, v) {
    v.setState('grabbed');
    v.grabbedBy = a;
    v.grounded = a.grounded;
    v.surface = a.surface;
    a.holding = v;
    a.setState('holding');
    a.holdTimer = Math.min(160, 50 + v.damage * 0.7);
    a.vx = 0;
    this.events.push({ type: 'grab', f: a, v });
  }

  releaseGrab(a, quiet = false) {
    const v = a.holding;
    a.holding = null;
    if (v && v.grabbedBy === a) {
      v.grabbedBy = null;
      v.grounded = a.grounded;
      v.surface = a.surface;
      v.setState(v.grounded ? 'idle' : 'air');
      v.vx = a.facing * 7;
      if (!v.grounded) v.vy = -6;
    }
    if (!quiet && a.state === 'holding') { a.setState('land'); a.lag = 12; a.vx = -a.facing * 4; }
  }

  doThrow(a) {
    const v = a.holding;
    a.holding = null;
    if (!v || v.grabbedBy !== a) return;
    const t = a.move.throw;
    v.grabbedBy = null;
    v.intangible = 0;
    const h = { dmg: t.dmg, ang: t.ang, bkb: t.bkb, kbg: t.kbg, wx: v.x, wy: v.y - v.h / 2, sfx: 'heavy' };
    this.applyHit(a, v, h, a.facing, false, { throw: true });
  }

  // ---------------------------------------------------------------- projectiles
  spawnProjectile(owner, spec) {
    const def = PROJECTILES[spec.type];
    const mine = this.projectiles.filter((p) => p.owner === owner && p.type === spec.type);
    if (mine.length >= def.max) return;
    const a = ((spec.ang ?? 0) * Math.PI) / 180;
    const p = {
      id: this.nextProjId++, type: spec.type, owner, team: owner.team, ...def,
      x: owner.x + spec.x * owner.facing, y: owner.y + spec.y,
      vx: (def.vx * Math.cos(a)) * owner.facing, vy: def.vy - def.vx * Math.sin(a),
      age: 0, rot: 0, hitSet: new Set(), dead: false, facing: owner.facing,
    };
    if (!owner.grounded && def.g > 0) p.vy -= 2;
    this.projectiles.push(p);
    this.events.push({ type: 'proj', p });
  }

  updateProjectiles() {
    const b = this.stage.def.blast;
    for (const p of this.projectiles) {
      p.age++;
      p.vy += p.g;
      if (p.wobble) p.vy += Math.sin(p.age * 0.15) * 0.08;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.spin * Math.sign(p.vx || 1);
      if (p.age >= p.life || p.x < b.left || p.x > b.right || p.y > b.bottom) { p.dead = true; p.fizzle = p.age >= p.life; continue; }
      for (const s of this.stage.solids) {
        if (p.x > s.x1 && p.x < s.x2 && p.y + p.r * 0.5 > s.y && p.y < s.y2) {
          if (p.bounces > 0 && p.y - p.vy <= s.y + p.r) { p.bounces--; p.y = s.y - p.r * 0.5; p.vy = -Math.abs(p.vy) * 0.72; }
          else p.dead = true;
        }
      }
      // Owl screech reflects projectiles.
      for (const f of this.fighters) {
        if (f.team === p.team || !f.inWindow('reflect')) continue;
        const c = f.center();
        if (Math.hypot(p.x - c.x, p.y - c.y) < f.move.reflect[2] * f.scale) {
          p.vx = -p.vx * 1.2; p.vy *= -0.4; p.owner = f; p.team = f.team; p.dmg *= 1.25; p.age = 0; p.hitSet.clear();
          this.events.push({ type: 'reflect', f, x: p.x, y: p.y });
        }
      }
      if (p.dead) continue;
      for (const v of this.fighters) {
        if (v.team === p.team || !v.isHittable() || p.hitSet.has(v.id)) continue;
        if (!circleRect(p.x, p.y, p.r, v.hurtbox())) continue;
        p.hitSet.add(v.id);
        this.applyHit(p.owner, v, { ...p, wx: p.x, wy: p.y, sfx: 'light' }, Math.sign(p.vx) || p.facing, true);
        p.dead = true;
        break;
      }
    }
    for (const p of this.projectiles) if (p.dead) this.events.push({ type: 'projdead', p });
    this.projectiles = this.projectiles.filter((p) => !p.dead);
  }

  // ---------------------------------------------------------------- KOs
  checkBlast(f) {
    if (f.state === 'dead' || f.state === 'respawn') return;
    const b = this.stage.def.blast;
    const out = f.x < b.left || f.x > b.right || f.y > b.bottom || f.y - f.h < b.top;
    if (!out) return;
    const credit = f.lastHitBy && this.frame - f.lastHitFrame < 600 ? f.lastHitBy : null;
    f.record.falls++;
    if (credit) { credit.record.kos++; credit.score++; } else { f.record.sds++; }
    f.score--;
    if (Number.isFinite(f.stocks)) f.stocks--;
    if (f.holding) this.releaseGrab(f, true);
    if (f.grabbedBy) { f.grabbedBy.holding = null; f.grabbedBy = null; }
    if (f.ledge) { f.ledge.owner = null; f.ledge = null; }
    this.events.push({
      type: 'ko', f, credit,
      x: Math.max(b.left, Math.min(b.right, f.x)), y: Math.max(b.top, Math.min(b.bottom, f.y - f.h / 2)),
      side: f.x < b.left ? 'left' : f.x > b.right ? 'right' : f.y > b.bottom ? 'bottom' : 'top',
    });
    f.setState('dead');
    f.vx = f.vy = f.kbx = f.kby = 0;
    f.hitlag = 0;
    f.pendingKb = null;
    this.checkEnd();
  }

  respawnStep(f) {
    f.sf++;
    if (f.state === 'dead') {
      if (f.stocks <= 0 || this.over) return;
      if (f.sf >= 80) {
        const idx = this.fighters.indexOf(f);
        const x = [-160, 160, -60, 60][idx % 4];
        f.placeAt(x, this.stage.def.respawnY, null);
        f.state = 'respawn';
        f.sf = 0;
        f.facing = x > 0 ? -1 : 1;
        f.invincible = 9999;
        this.events.push({ type: 'respawn', f });
      }
      return;
    }
    // On the halo platform: leave with any input, or after 4 s.
    const inp = f.input;
    const moved = Math.abs(inp.x) > 0.5 || Math.abs(inp.y) > 0.5 || inp.age.jump === 0 || inp.age.attack === 0 || inp.age.special === 0 || inp.age.shield === 0;
    if ((f.sf > 30 && moved) || f.sf > 240) {
      f.setState('air');
      f.invincible = 120;
      if (inp.age.jump < 3) f.input.age.jump = 0;
    }
  }

  checkEnd() {
    if (this.over || this.rules.time) return;
    const teams = new Set(this.fighters.filter((f) => f.stocks > 0).map((f) => f.team));
    if (teams.size <= 1) this.finish();
  }

  finish() {
    this.over = true;
    this.overFrame = this.frame;
    const rank = [...this.fighters].sort((a, b) =>
      this.rules.time ? b.score - a.score || a.damage - b.damage : b.stocks - a.stocks || a.damage - b.damage);
    this.winner = rank[0];
    this.ranking = rank;
    this.events.push({ type: 'gameover', winner: this.winner });
  }
}
