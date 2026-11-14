// CPU opponents. The AI produces the same raw input a controller would, so it plays by
// the same rules as a human. Level 1-9 scales reaction time, accuracy and defense;
// level 0 is a training dummy that stands still.
import { blankRaw } from './input.js';

const lerp = (a, b, t) => a + (b - a) * t;

function circleRect(cx, cy, r, b) {
  const nx = Math.max(b.x1, Math.min(cx, b.x2));
  const ny = Math.max(b.y1, Math.min(cy, b.y2));
  return (cx - nx) ** 2 + (cy - ny) ** 2 <= r * r;
}

const GROUND_MOVES = ['jab1', 'ftilt', 'utilt', 'dtilt', 'fsmash', 'usmash', 'dsmash', 'nspec', 'sspec', 'dspec'];
const AIR_MOVES = ['nair', 'fair', 'bair', 'uair', 'dair', 'nspec', 'sspec', 'dspec'];
const KILL_MOVES = new Set(['fsmash', 'usmash', 'dsmash', 'bair', 'fair', 'uair', 'sspec', 'dspec']);

export class CpuController {
  constructor(level = 5) {
    this.level = level;
    const t = Math.max(0, level - 1) / 8;
    this.t = t;
    this.react = Math.round(lerp(26, 3, t));
    this.shieldChance = lerp(0.04, 0.55, t);
    this.mistake = lerp(0.35, 0.03, t);
    this.tolerance = lerp(18, 4, t);
    this.queue = [];
    this.wait = 0;
    this.last = blankRaw();
    this.jumpHeld = 0;
    this.ledgeWait = 0;
  }

  poll(f, b) {
    if (this.level === 0) return blankRaw();
    const raw = this.step(f, b);
    this.last = raw;
    return raw;
  }

  step(f, b) {
    const rng = b.rng;
    const raw = blankRaw();
    if (f.state === 'dead') { this.queue = []; return raw; }
    if (f.state === 'respawn') {
      if (f.sf > 40 + rng() * 60) raw.x = f.x > 0 ? -1 : 1;
      return raw;
    }
    if (f.state === 'grabbed') {
      if (b.frame % 4 < 2 && rng() < 0.3 + this.t * 0.6) raw.attack = !this.last.attack;
      return raw;
    }
    // Offstage: recovery takes over every frame.
    if (this.isOffstage(f, b) && !(this.queue.length && f.state === 'attack')) {
      this.queue = [];
      return this.recover(f, b, raw);
    }
    if (f.state === 'ledge') return this.ledge(f, b, raw);
    if (this.queue.length) {
      const q = this.queue[0];
      Object.assign(raw, q.raw);
      if (--q.n <= 0) this.queue.shift();
      return raw;
    }
    if (f.state === 'holding') return this.throwChoice(f, b, raw);
    if (this.wait > 0) {
      this.wait--;
      Object.assign(raw, this.carry ?? {});
      return raw;
    }
    this.wait = Math.max(0, this.react + Math.round((rng() - 0.5) * this.react * 0.6));
    this.carry = this.decide(f, b, raw);
    return raw;
  }

  isOffstage(f, b) {
    if (f.grounded) return false;
    const st = b.stage;
    return f.x < st.mainLeft - 4 || f.x > st.mainRight + 4 || (f.y > st.solids[0].y + 10);
  }

  target(f, b) {
    let best = null;
    let bd = Infinity;
    for (const o of b.fighters) {
      if (o === f || o.team === f.team || o.state === 'dead' || o.state === 'respawn') continue;
      const d = Math.hypot(o.x - f.x, o.y - f.y) - o.damage * 0.5;
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  // ---------------------------------------------------------------- recovery
  recover(f, b, raw) {
    const st = b.stage;
    const L = f.x < 0 ? st.ledges.find((l) => l.side === -1) : st.ledges.find((l) => l.side === 1);
    const inward = -L.side;
    const horiz = (f.x - L.x) * L.side; // distance outside the ledge
    const below = f.y - L.y;
    if (f.state === 'hitstun') {
      // Survival DI: up and toward the stage.
      raw.x = inward * 0.7;
      raw.y = -0.7;
      if (f.sf >= f.hitstun - 1 && f.airJumps > 0 && below > 100 && this.t > 0.3) raw.jump = true;
      return raw;
    }
    // Under the stage: get out from underneath first.
    raw.x = horiz < f.w / 2 + 8 && below > 20 ? L.side : inward;
    if (f.state === 'helpless' || f.state === 'attack' || f.state === 'airdodge') return raw;
    const falling = f.vy > -1.5;
    const jumpReady = !this.last.jump;
    const upUsable = f.moves.uspec;
    const sideOk = f.moves.sspec?.once && !f.sideUsed && f.moves.sspec.vel;
    if (falling && f.airJumps > 0 && (below > -30 || horiz > 280) && jumpReady) {
      raw.jump = true;
    } else if (falling && f.airJumps === 0 && sideOk && horiz > 330 && below < 120 && below > -260) {
      raw.special = true;
      raw.x = inward;
    } else if (falling && f.airJumps === 0 && (below > 40 - this.t * 30 || horiz > 240) && upUsable) {
      raw.special = true;
      raw.y = -1;
      raw.x = inward;
    }
    return raw;
  }

  ledge(f, b, raw) {
    const rng = b.rng;
    if (f.sf === 1) this.ledgeWait = 6 + Math.round(rng() * lerp(50, 14, this.t));
    if (f.sf < this.ledgeWait) return raw;
    const inward = -f.ledge.side;
    const r = rng();
    if (r < 0.55) raw.x = inward;
    else if (r < 0.75) raw.jump = true;
    else if (r < 0.9) raw.attack = true;
    else raw.shield = true;
    this.ledgeWait = 9999;
    return raw;
  }

  throwChoice(f, b, raw) {
    if (f.sf < 6 + Math.round(b.rng() * 10)) return raw;
    const t = f.holding;
    const st = b.stage;
    const nearEdge = Math.min(Math.abs(f.x - st.mainLeft), Math.abs(f.x - st.mainRight)) < 260;
    const edgeDir = Math.abs(f.x - st.mainLeft) < Math.abs(f.x - st.mainRight) ? -1 : 1;
    if (t && t.damage > 90 && nearEdge) raw.x = edgeDir;
    else if (t && t.damage < 50) raw.y = b.rng() < 0.5 ? 1 : -1;
    else raw.x = b.rng() < 0.5 ? f.facing : -f.facing;
    return raw;
  }

  // ---------------------------------------------------------------- neutral
  decide(f, b, raw) {
    const rng = b.rng;
    const T = this.target(f, b);
    if (!T) return {};
    const dx = T.x - f.x;
    const dy = (T.y - T.h / 2) - (f.y - f.h / 2);
    const dist = Math.hypot(dx, dy);
    const dir = Math.sign(dx) || f.facing;
    const st = b.stage;
    const actionable = ['idle', 'walk', 'run', 'crouch', 'air', 'shield'].includes(f.state);
    if (!actionable) {
      // During landing lag etc., just hold toward the target (buffering is fine).
      return {};
    }

    // Defense: shield or dodge a threatening attack.
    const threat = T.state === 'attack' && T.move?.hit && T.mf < (T.move.firstActive ?? 0) + 4 && dist < 240 * T.scale;
    if (f.grounded && threat && rng() < this.shieldChance) {
      const r = rng();
      if (r < 0.65) this.queue.push({ raw: { shield: true }, n: 10 + Math.round(rng() * 12) });
      else if (r < 0.85) this.queue.push({ raw: { shield: true }, n: 1 }, { raw: { shield: true, x: -dir }, n: 2 });
      else this.queue.push({ raw: { shield: true }, n: 1 }, { raw: { shield: true, y: 1 }, n: 2 });
      return {};
    }
    // Release shield when nothing is coming.
    if (f.state === 'shield') {
      if (T.state === 'attack' && dist < 200) return { shield: true };
      return {};
    }

    // Grab a shielding opponent.
    if (f.grounded && (T.state === 'shield' || T.state === 'dizzy') && Math.abs(dx) < 110 * f.scale && Math.abs(dy) < 60) {
      if (T.state === 'dizzy') this.queue.push({ raw: { x: dir }, n: 1 }, { raw: { cx: dir, attack: false }, n: 1 }, { raw: { attack: true }, n: 30 });
      else this.queue.push({ raw: { x: dir }, n: 1 }, { raw: { grab: true }, n: 1 });
      return {};
    }

    // Attack if something connects.
    const choice = this.pickMove(f, T, b);
    if (choice) { this.queueMove(f, choice, dir, b); return {}; }

    // Edge-guard: wait near the ledge, fire projectiles at a recovering target.
    const Toff = !T.grounded && (T.x < st.mainLeft || T.x > st.mainRight);
    if (Toff) {
      const edgeX = T.x < 0 ? st.mainLeft + 70 : st.mainRight - 70;
      const proj = f.moves.nspec.proj && Math.abs(dx) < 650 && this.t > 0.2 && rng() < 0.35;
      if (proj && f.grounded) {
        if (Math.sign(dx) !== f.facing) return { x: dir };
        this.queue.push({ raw: { special: true }, n: 1 });
        return {};
      }
      if (f.grounded) {
        if (Math.abs(f.x - edgeX) > 30) return { x: Math.sign(edgeX - f.x) };
        if (f.facing !== Math.sign(dx)) return { x: dir * 0.4 };
        return {};
      }
    }

    // Projectile poke at range.
    if (f.grounded && Math.abs(dx) > 380 && Math.abs(dy) < 120 && rng() < 0.12 + this.t * 0.1) {
      const p = f.moves.nspec.proj ? 'nspec' : f.moves.sspec.proj ? 'sspec' : null;
      if (p) {
        if (f.facing !== dir) this.queue.push({ raw: { x: dir * 0.7 }, n: 1 });
        this.queue.push({ raw: p === 'nspec' ? { special: true } : { special: true, x: dir }, n: 1 });
        return {};
      }
    }

    // Movement.
    const out = {};
    const ahead = f.x + dir * 90;
    const safe = ahead > st.mainLeft + 20 && ahead < st.mainRight - 20;
    if (Math.abs(dx) > 50 && (safe || !f.grounded || !Toff)) out.x = dir;
    if (!safe && f.grounded && Toff) out.x = 0;
    if (f.grounded) {
      if (dy < -110 && Math.abs(dx) < 260 && rng() < 0.7) this.queue.push({ raw: { jump: true, x: dir }, n: 6 });
      else if (dy > 90 && f.surface?.soft && rng() < 0.5) this.queue.push({ raw: { y: 0 }, n: 1 }, { raw: { y: 1 }, n: 9 });
      else if (Math.abs(dx) < 160 && Math.abs(dy) < 90 && rng() < 0.18 + this.t * 0.1) {
        // Short hop for an aerial approach.
        this.queue.push({ raw: { jump: true, x: dir }, n: 2 }, { raw: { x: dir }, n: 2 });
      }
    } else {
      if (dy > 120 && f.vy > 0 && !Toff && rng() < 0.4) out.y = 1;
      if (dy < -140 && f.airJumps > 0 && f.vy > -2 && rng() < 0.3) { this.queue.push({ raw: { jump: true, x: dir }, n: 1 }); }
    }
    Object.assign(raw, out);
    return out;
  }

  /** Simulates each candidate move's hitboxes against the target's predicted spot. */
  pickMove(f, T, b) {
    const rng = b.rng;
    const list = f.grounded ? GROUND_MOVES : AIR_MOVES;
    const cand = [];
    const tol = this.tolerance;
    const offstage = (x) => x < b.stage.mainLeft || x > b.stage.mainRight;
    for (const name of list) {
      const m = f.moves[name];
      if (!m?.hit) continue;
      if (name === 'sspec' && (!f.grounded && (f.sideUsed || offstage(f.x)))) continue;
      if (name === 'dspec' && m.loopLand && !f.grounded && f.y > -50) continue;
      // Ground moves can face either way (we can turn first); aerials use current facing.
      const facings = f.grounded && !['jab1', 'utilt', 'usmash', 'dsmash', 'dtilt'].includes(name) ? [-1, 1] : [f.facing];
      if (f.grounded && ['jab1', 'utilt', 'usmash', 'dtilt', 'nspec', 'dspec'].includes(name)) facings.splice(0, 1, Math.sign(T.x - f.x) || f.facing);
      for (const fc of facings) {
        let hitH = null;
        for (const h of m.hit) {
          const tf = h.f[0];
          let ax = f.x + (f.grounded ? f.vx * 3 : f.vx * tf);
          let ay = f.y + (f.grounded ? 0 : Math.min(tf * f.vy + 0.5 * f.st.gravity * tf * tf, 400));
          for (const v of m.vel ?? []) {
            const span = Math.max(0, Math.min(tf, v.f[1]) - v.f[0] + 1);
            if (v.vx != null) ax += v.vx * fc * span;
            if (v.vy != null) ay += v.vy * span * 0.7;
          }
          const hx = ax + h.x * fc;
          const hy = ay + h.y;
          const tx = T.x + (T.vx + T.kbx) * tf * 0.7;
          const ty = T.y + (T.grounded ? 0 : Math.min(400, (T.vy + T.kby) * tf * 0.7));
          const rect = { x1: tx - T.w / 2, x2: tx + T.w / 2, y1: ty - T.h, y2: ty };
          if (circleRect(hx, hy, h.r + tol, rect)) { hitH = h; break; }
        }
        if (!hitH) continue;
        if (f.grounded && m.vel && offstage(f.x + fc * 260)) continue; // don't dash off the stage
        let score = hitH.dmg + rng() * 6 - hitH.f[0] * 0.25;
        if (T.damage > 85 && KILL_MOVES.has(name)) score += 10 + this.t * 8;
        if (T.damage < 50 && ['fsmash', 'usmash', 'dsmash'].includes(name)) score -= 6;
        if (name.endsWith('spec')) score -= 2;
        cand.push({ name, fc, score });
      }
    }
    if (!cand.length) return null;
    if (rng() < this.mistake) return cand[Math.floor(rng() * cand.length)];
    cand.sort((a, b) => b.score - a.score);
    return cand[0];
  }

  queueMove(f, { name, fc }, dir, b) {
    const q = this.queue;
    const turn = f.grounded && fc !== f.facing;
    const charge = Math.round(b.rng() * lerp(10, 40, this.t));
    if (f.state === 'run' && f.grounded && !name.endsWith('spec')) q.push({ raw: {}, n: 2 });
    switch (name) {
      case 'jab1': if (turn) q.push({ raw: { x: fc * 0.4 }, n: 1 }); q.push({ raw: { attack: true }, n: 1 }, { raw: {}, n: 1 }, { raw: { attack: true }, n: 1 }, { raw: {}, n: 1 }, { raw: { attack: true }, n: 1 }); break;
      case 'ftilt': q.push({ raw: { x: fc * 0.7 }, n: 6 }, { raw: { x: fc * 0.7, attack: true }, n: 1 }); break;
      case 'utilt': if (turn) q.push({ raw: { x: fc * 0.4 }, n: 1 }); q.push({ raw: { y: -0.7 }, n: 6 }, { raw: { y: -0.7, attack: true }, n: 1 }); break;
      case 'dtilt': if (turn) q.push({ raw: { x: fc * 0.4 }, n: 1 }); q.push({ raw: { y: 0.55 }, n: 6 }, { raw: { y: 0.55, attack: true }, n: 1 }); break;
      case 'fsmash': q.push({ raw: { cx: fc }, n: 1 }, { raw: { attack: true }, n: charge + 9 }); break;
      case 'usmash': if (turn) q.push({ raw: { x: fc * 0.4 }, n: 1 }); q.push({ raw: { cy: -1 }, n: 1 }, { raw: { attack: true }, n: charge + 8 }); break;
      case 'dsmash': q.push({ raw: { cy: 1 }, n: 1 }, { raw: { attack: true }, n: charge + 7 }); break;
      case 'nair': q.push({ raw: { attack: true }, n: 1 }); break;
      case 'fair': q.push({ raw: { cx: f.facing }, n: 1 }); break;
      case 'bair': q.push({ raw: { cx: -f.facing }, n: 1 }); break;
      case 'uair': q.push({ raw: { cy: -1 }, n: 1 }); break;
      case 'dair': q.push({ raw: { cy: 1 }, n: 1 }); break;
      case 'nspec': if (turn) q.push({ raw: { x: fc * 0.4 }, n: 1 }); q.push({ raw: { special: true }, n: 1 }); break;
      case 'sspec': q.push({ raw: { special: true, x: fc }, n: 1 }); break;
      case 'dspec': q.push({ raw: { special: true, y: 1 }, n: 1 }); break;
      default: q.push({ raw: { attack: true }, n: 1 });
    }
    q.push({ raw: {}, n: 1 });
  }
}
