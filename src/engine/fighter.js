// One fighter: state machine, movement physics, moves and stage collision.
// Pure logic (no Phaser), stepped at a fixed 60 Hz by Battle.
import { InputTracker } from './input.js';
import { CHARACTERS } from './characters.js';
import { buildMoveset } from './moves.js';

export const SHIELD_MAX = 50;
const GROUND_STATES = new Set(['idle', 'walk', 'run', 'crouch']);
// Ground states that stop at a platform's edge instead of walking off it.
const TEETER = new Set(['attack', 'shield', 'land', 'roll', 'spotdodge', 'shielddrop', 'downed', 'getup', 'jumpsquat', 'holding', 'dizzy', 'crouch']);

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const approach = (v, target, step) => (v < target ? Math.min(target, v + step) : Math.max(target, v - step));

export class Fighter {
  constructor(battle, opts) {
    this.battle = battle;
    this.slot = opts.slot;
    this.id = opts.slot;
    this.team = opts.team ?? opts.slot;
    this.charId = opts.charId;
    this.char = CHARACTERS[opts.charId];
    this.st = this.char.stats;
    this.moves = buildMoveset(this.char);
    this.w = this.st.width;
    this.h = this.st.height;
    this.palette = opts.palette ?? 0;
    this.controller = opts.controller;
    this.isCpu = !!opts.cpu;
    this.input = new InputTracker(opts.tapJump);
    this.stocks = opts.stocks;
    this.score = 0;
    this.record = { kos: 0, falls: 0, sds: 0, dealt: 0, taken: 0, maxCombo: 0 };
    this.spawnX = opts.spawnX ?? 0;
    this.placeAt(this.spawnX, 0, battle.stage.solids[0]);
    this.facing = this.spawnX > 0 ? -1 : 1;
  }

  placeAt(x, y, surface) {
    Object.assign(this, {
      x, y, px: x, py: y, vx: 0, vy: 0, kbx: 0, kby: 0,
      grounded: !!surface, surface, state: surface ? 'idle' : 'air', sf: 0,
      move: null, mf: 0, hitSet: new Map(), chargeF: 0, holdingCharge: false,
      airJumps: this.st.airJumps, sideUsed: false, airdodgeUsed: false, fastFalling: false,
      damage: 0, hitlag: 0, hitstun: 0, tumble: false, pendingKb: null,
      shieldHp: SHIELD_MAX, shieldStun: 0, intangible: 0, invincible: 0,
      ledge: null, ledgeGrabs: 0, regrabCd: 0, dropThrough: 0,
      grabbedBy: null, holding: null, holdTimer: 0,
      lag: 0, runHold: 0, combo: 0, jumpCut: 0, lastHitBy: null, lastHitFrame: -9999,
      flash: 0, rollDir: 0, dizzy: 0, armorFlash: 0, counterDmg: 0, launchSpeed: 0,
    });
  }

  // ---------------------------------------------------------------- queries
  get ev() { return this.battle.events; }
  get frame() { return this.battle.frame; }
  get alive() { return this.state !== 'dead'; }
  get scale() { return this.h / 140; }

  isHittable() {
    return this.state !== 'dead' && this.state !== 'respawn' && this.intangible <= 0 && this.invincible <= 0;
  }

  hurtbox() {
    let h = this.h;
    if (this.state === 'crouch' || (this.state === 'attack' && this.move?.crouch)) h *= 0.72;
    if (this.state === 'downed') h *= 0.45;
    const w = this.w;
    return { x1: this.x - w / 2, x2: this.x + w / 2, y1: this.y - h, y2: this.y };
  }

  center() { return { x: this.x, y: this.y - this.h * 0.5 }; }

  activeHitboxes() {
    if (this.state !== 'attack' || !this.move?.hit) return [];
    const out = [];
    const chargeMul = 1 + Math.min(this.chargeF, 60) / 150;
    for (const h of this.move.hit) {
      if (this.mf < h.f[0] || this.mf > h.f[1]) continue;
      const dmg = this.move.name === 'counterHit' ? Math.max(h.dmg, this.counterDmg) : h.dmg;
      out.push({ ...h, dmg: Math.round(dmg * chargeMul * 10) / 10, wx: this.x + h.x * this.facing, wy: this.y + h.y });
    }
    return out;
  }

  activeGrab() {
    const g = this.state === 'attack' && this.move?.grab;
    if (!g || this.mf < g.f[0] || this.mf > g.f[1]) return null;
    return { wx: this.x + g.x * this.facing, wy: this.y + g.y, r: g.r };
  }

  inWindow(key) {
    const w = this.state === 'attack' && this.move?.[key];
    return !!w && this.mf >= w[0] && this.mf <= w[1];
  }

  shielding() { return this.state === 'shield'; }

  // ---------------------------------------------------------------- per-frame update
  update() {
    const inp = this.input;
    if (this.hitlag > 0) {
      this.hitlag--;
      if (this.hitlag === 0 && this.pendingKb) this.applyKnockback();
      return;
    }
    if (this.intangible > 0) this.intangible--;
    if (this.invincible > 0) this.invincible--;
    if (this.regrabCd > 0) this.regrabCd--;
    if (this.dropThrough > 0) this.dropThrough--;
    if (this.flash > 0) this.flash--;
    if (this.armorFlash > 0) this.armorFlash--;
    if (this.state !== 'shield') this.shieldHp = Math.min(SHIELD_MAX, this.shieldHp + 0.09);
    this.sf++;

    switch (this.state) {
      case 'idle': case 'walk': case 'run': case 'crouch': this.groundState(); break;
      case 'jumpsquat':
        if (this.sf >= 4) this.leaveGround(inp.held('jump') ? this.st.jump : this.st.shortHop, true);
        break;
      case 'land': case 'shielddrop':
        this.vx = approach(this.vx, 0, this.friction());
        if (this.sf >= this.lag) this.toIdle();
        break;
      case 'air': this.airState(); break;
      case 'helpless': this.airDrift(0.75); this.tryLedge(); break;
      case 'attack': this.attackState(); break;
      case 'hitstun': this.hitstunState(); break;
      case 'downed':
        this.vx = approach(this.vx, 0, this.friction());
        if (this.sf > 40 || (this.sf > 12 && (inp.buffered('jump') || inp.buffered('attack') || Math.abs(inp.x) > 0.5))) {
          this.setState('getup');
          this.intangible = 22;
        }
        break;
      case 'getup': if (this.sf >= 22) this.toIdle(); break;
      case 'shield': this.shieldState(); break;
      case 'roll': this.rollState(); break;
      case 'spotdodge': if (this.sf === 2) this.intangible = 14; if (this.sf >= 22) this.toIdle(); break;
      case 'airdodge': this.airdodgeState(); break;
      case 'shieldbreak':
        if (this.grounded && this.sf > 6) { this.setState('dizzy'); this.dizzy = Math.max(90, 220 - this.damage); }
        break;
      case 'dizzy':
        this.vx = approach(this.vx, 0, this.friction());
        if (inp.pressed('attack') || inp.pressed('special') || inp.pressed('jump')) this.dizzy -= 6;
        if (this.sf >= this.dizzy) this.toIdle();
        break;
      case 'ledge': this.ledgeState(); return;
      case 'ledgeclimb': this.ledgeClimbState(); return;
      case 'grabbed': this.grabbedState(); return;
      case 'holding': this.holdingState(); break;
      case 'dead': case 'respawn': return; // Battle drives these
    }
    if (this.state === 'ledge' || this.state === 'ledgeclimb') return;
    this.physics();
  }

  setState(s) {
    if (this.state === 'ledge' && s !== 'ledge' && this.ledge) { this.ledge.owner = null; this.ledge = null; }
    this.state = s;
    this.sf = 0;
    if (s !== 'attack') { this.move = null; this.chargeF = 0; this.holdingCharge = false; }
  }

  toIdle() {
    if (this.grounded) this.setState('idle');
    else this.setState('air');
  }

  friction() { return 0.95 * this.battle.stage.def.friction; }

  // ---------------------------------------------------------------- ground
  groundState() {
    const inp = this.input;
    if (this.groundActions()) return;
    const ix = inp.x;
    const fr = this.battle.stage.def.friction;
    // Drop through a soft platform by holding down briefly (so down + attack/special
    // still work on platforms when pressed together on a keyboard).
    if (this.surface?.soft && inp.y > 0.6 && this.state === 'crouch' && this.sf >= 6) {
      this.grounded = false;
      this.surface = null;
      this.dropThrough = 12;
      this.y += 2;
      this.setState('air');
      return;
    }
    if (inp.y > 0.6 && Math.abs(ix) < 0.6) {
      if (this.state !== 'crouch') this.setState('crouch');
      this.vx = approach(this.vx, 0, this.friction());
      return;
    }
    if (Math.abs(ix) > 0.25) {
      const dir = Math.sign(ix);
      const wasRun = this.state === 'run';
      if (dir !== this.facing) {
        this.facing = dir;
        this.runHold = 0;
        if (wasRun) this.ev.push({ type: 'skid', f: this });
      }
      this.runHold++;
      const run = (wasRun && dir === Math.sign(this.vx || dir)) || (inp.tapX <= 3 && Math.abs(ix) > 0.8) || this.runHold > 9;
      if (run && !wasRun) {
        this.setState('run');
        this.ev.push({ type: 'dash', f: this });
      } else if (!run && this.state !== 'walk') this.setState('walk');
      const target = (run ? this.st.run : this.st.walk * Math.min(1, Math.abs(ix) * 1.3)) * dir;
      this.vx = approach(this.vx, target, (run ? 1.3 : 0.9) * Math.max(0.4, fr));
    } else {
      this.runHold = 0;
      if (this.state !== 'idle') this.setState('idle');
      this.vx = approach(this.vx, 0, this.friction());
    }
  }

  groundActions() {
    const inp = this.input;
    const run = this.state === 'run';
    if (inp.buffered('jump')) { inp.consume('jump'); this.setState('jumpsquat'); return true; }
    if (inp.held('shield')) {
      if (inp.buffered('attack') || inp.buffered('grab')) { inp.consume('attack'); inp.consume('grab'); this.startMove(run ? 'dashgrab' : 'grab'); return true; }
      if (inp.buffered('shield', 2) || this.state !== 'run') { this.setState('shield'); this.shieldStun = 0; return true; }
    }
    if (inp.buffered('grab')) { inp.consume('grab'); this.startMove(run ? 'dashgrab' : 'grab'); return true; }
    if (inp.buffered('special')) { inp.consume('special'); this.special(); return true; }
    if (inp.cstick) {
      const c = inp.cstick;
      inp.cstick = null;
      if (c.y < 0) this.startMove('usmash');
      else if (c.y > 0) this.startMove('dsmash');
      else { this.facing = c.x; this.startMove('fsmash'); }
      return true;
    }
    if (inp.buffered('attack')) {
      inp.consume('attack');
      const smash = inp.tapX <= 5 || inp.tapY <= 5;
      if (run && !(inp.tapX <= 3)) this.startMove('dashatk');
      else if (inp.y < -0.5) this.startMove(smash ? 'usmash' : 'utilt');
      else if (inp.y > 0.5) this.startMove(smash ? 'dsmash' : 'dtilt');
      else if (Math.abs(inp.x) > 0.5) { this.facing = Math.sign(inp.x); this.startMove(smash ? 'fsmash' : 'ftilt'); }
      else this.startMove('jab1');
      return true;
    }
    return false;
  }

  special() {
    const inp = this.input;
    if (inp.y < -0.5) this.startMove('uspec');
    else if (inp.y > 0.5) this.startMove('dspec');
    else if (Math.abs(inp.x) > 0.5 && !(this.sideUsed && !this.grounded && this.moves.sspec.once)) {
      this.facing = Math.sign(inp.x);
      this.startMove('sspec');
    } else this.startMove('nspec');
  }

  leaveGround(force, full) {
    this.grounded = false;
    this.surface = null;
    this.vy = -force;
    const ix = this.input.x;
    this.vx = clamp(this.vx * 0.85 + ix * 1.5, -this.st.air * 1.25, this.st.air * 1.25);
    this.setState('air');
    this.jumpCut = full ? 10 : 0;
    this.ev.push({ type: 'jump', f: this, air: false, full });
  }

  // ---------------------------------------------------------------- air
  airState() {
    // Variable jump height: letting go of jump early in a full hop cuts it short.
    if (this.jumpCut > 0) {
      this.jumpCut--;
      if (!this.input.held('jump') && this.vy < -this.st.shortHop) { this.vy = -this.st.shortHop; this.jumpCut = 0; }
    }
    if (this.airActions()) return;
    this.airDrift(1);
    this.tryLedge();
  }

  airActions() {
    const inp = this.input;
    if (inp.buffered('special')) { inp.consume('special'); this.special(); return true; }
    if (inp.buffered('attack') || inp.cstick) {
      let dx = inp.x, dy = inp.y;
      if (inp.cstick) { dx = inp.cstick.x; dy = inp.cstick.y; inp.cstick = null; }
      inp.consume('attack');
      if (dy < -0.5 && Math.abs(dy) >= Math.abs(dx) * 0.8) this.startMove('uair');
      else if (dy > 0.5 && Math.abs(dy) >= Math.abs(dx) * 0.8) this.startMove('dair');
      else if (dx * this.facing > 0.5) this.startMove('fair');
      else if (dx * this.facing < -0.5) this.startMove('bair');
      else this.startMove('nair');
      return true;
    }
    if (inp.buffered('jump') && this.airJumps > 0) {
      inp.consume('jump');
      this.airJumps--;
      this.vy = -this.st.airJump;
      this.vx = inp.x * this.st.air;
      if (Math.abs(inp.x) > 0.5) this.facing = Math.sign(inp.x);
      this.fastFalling = false;
      this.kbx *= 0.5; this.kby = Math.min(this.kby, 0) * 0.5;
      this.ev.push({ type: 'jump', f: this, air: true });
      return true;
    }
    if ((inp.buffered('shield', 3)) && !this.airdodgeUsed) {
      inp.consume('shield');
      this.airdodgeUsed = true;
      this.setState('airdodge');
      const m = Math.hypot(inp.x, inp.y);
      this.rollDir = m > 0.5 ? { x: inp.x / m, y: inp.y / m } : null;
      this.ev.push({ type: 'dodge', f: this });
      return true;
    }
    if (inp.buffered('grab')) { inp.consume('grab'); this.startMove('nair'); return true; }
    this.checkFastFall();
    return false;
  }

  checkFastFall() {
    const inp = this.input;
    if (!this.fastFalling && inp.y > 0.6 && inp.tapY <= 3 && this.vy > -2) {
      this.fastFalling = true;
      this.vy = Math.max(this.vy, this.st.ffall);
      this.ev.push({ type: 'fastfall', f: this });
    }
  }

  airDrift(mult) {
    const ix = this.input.x;
    const max = this.st.air * mult;
    if (Math.abs(ix) > 0.2) this.vx = approach(this.vx, ix * max, this.st.airAccel);
    else this.vx = approach(this.vx, 0, 0.06);
  }

  airdodgeState() {
    const d = this.rollDir;
    if (this.sf === 3) this.intangible = 18;
    if (d) {
      const sp = this.sf < 4 ? 0 : 12 * Math.pow(0.86, this.sf - 4);
      if (this.sf >= 4) { this.vx = d.x * sp; this.vy = d.y * sp; }
    } else this.airDrift(0.6);
    if (this.sf >= 32) this.setState('air');
    else if (this.sf > 22) this.tryLedge();
  }

  // ---------------------------------------------------------------- ledge
  tryLedge() {
    if (this.regrabCd > 0 || this.input.y > 0.6) return false;
    const rising = this.vy + this.kby < 0;
    if (rising && !(this.state === 'attack' && this.move?.ledgeFrom && this.mf >= this.move.ledgeFrom)) return false;
    for (const L of this.battle.stage.ledges) {
      if (L.owner && L.owner !== this) continue;
      const out = (this.x - L.x) * L.side; // > 0 means off the stage side of the ledge
      if (out < -this.w * 0.35 || out > this.w * 0.5 + 34) continue;
      const below = this.y - L.y;
      if (below < 12 || below > this.h * 0.95 + 10) continue;
      this.grabLedge(L);
      return true;
    }
    return false;
  }

  grabLedge(L) {
    this.setState('ledge');
    this.ledge = L;
    L.owner = this;
    this.facing = -L.side;
    this.x = L.x + L.side * this.w * 0.42;
    this.y = L.y + this.h * 0.62;
    this.vx = this.vy = this.kbx = this.kby = 0;
    this.airJumps = this.st.airJumps;
    this.sideUsed = false;
    this.airdodgeUsed = false;
    this.fastFalling = false;
    this.intangible = Math.max(0, 48 - this.ledgeGrabs * 12);
    this.ledgeGrabs++;
    this.ev.push({ type: 'ledge', f: this });
  }

  ledgeState() {
    const inp = this.input;
    const L = this.ledge;
    if (!L) { this.setState('air'); return; }
    if (this.sf < 8) return;
    const inward = -L.side;
    const drop = () => {
      this.setState('air');
      this.regrabCd = 30;
      this.x = L.x + L.side * (this.w / 2 + 3);
    };
    if (inp.buffered('jump')) {
      inp.consume('jump');
      drop();
      this.regrabCd = 20;
      this.vy = -this.st.jump * 1.02;
      this.vx = inward * 2;
      this.ev.push({ type: 'jump', f: this, air: false, full: true });
    } else if (inp.buffered('attack') || inp.buffered('special')) {
      inp.consume('attack'); inp.consume('special');
      this.standOnLedge(L);
      this.startMove('ledgeatk');
    } else if (inp.buffered('shield')) {
      inp.consume('shield');
      this.standOnLedge(L);
      this.startRoll(inward);
    } else if (inp.y < -0.6 || inp.x * inward > 0.6) {
      this.setState('ledgeclimb');
      this.ledge = L; // keep for climb positioning
      this.intangible = 26;
    } else if (inp.y > 0.6 || inp.x * inward < -0.6 || this.sf > 300) {
      drop();
    }
  }

  standOnLedge(L) {
    const s = L.solid;
    this.setState('idle');
    L.owner = null;
    this.ledge = null;
    this.grounded = true;
    this.surface = s;
    this.x = L.x - L.side * (this.w / 2 + 6);
    this.y = L.y;
    this.vx = this.vy = 0;
  }

  ledgeClimbState() {
    const L = this.ledge;
    const t = Math.min(1, this.sf / 22);
    const sx = L.x + L.side * this.w * 0.42;
    const ex = L.x - L.side * (this.w / 2 + 6);
    const e = 1 - Math.pow(1 - t, 3);
    this.x = sx + (ex - sx) * e;
    this.y = L.y + this.h * 0.62 * (1 - Math.min(1, t * 1.6));
    if (this.sf >= 22) {
      L.owner = null;
      this.standOnLedge(L);
    }
  }

  // ---------------------------------------------------------------- shield / dodges
  shieldState() {
    const inp = this.input;
    this.vx = approach(this.vx, 0, this.friction());
    if (this.shieldStun > 0) { this.shieldStun--; return; }
    this.shieldHp -= 0.14;
    if (this.shieldHp <= 0) { this.breakShield(); return; }
    if (inp.buffered('jump')) { inp.consume('jump'); this.setState('jumpsquat'); return; }
    if (inp.buffered('attack') || inp.buffered('grab')) { inp.consume('attack'); inp.consume('grab'); this.startMove('grab'); return; }
    if (Math.abs(inp.x) > 0.6 && inp.tapX <= 3) { this.startRoll(Math.sign(inp.x)); return; }
    if (inp.y > 0.6 && inp.tapY <= 3) { this.setState('spotdodge'); this.ev.push({ type: 'dodge', f: this }); return; }
    if (!inp.held('shield')) { this.setState('shielddrop'); this.lag = 7; }
  }

  startRoll(dir) {
    this.setState('roll');
    this.rollDir = dir;
    this.ev.push({ type: 'dodge', f: this });
  }

  rollState() {
    if (this.sf === 3) this.intangible = 15;
    const t = this.sf / 26;
    this.vx = this.rollDir * (t < 0.75 ? 9.5 * Math.sin(Math.min(1, t / 0.75) * Math.PI * 0.5 + 0.6) : 1);
    if (this.sf >= 26) {
      if (this.rollDir === this.facing) this.facing = -this.facing;
      this.vx = 0;
      this.toIdle();
    }
  }

  breakShield() {
    this.shieldHp = SHIELD_MAX * 0.4;
    this.setState('shieldbreak');
    this.grounded = false;
    this.surface = null;
    this.vy = -15;
    this.vx = 0;
    this.ev.push({ type: 'shieldbreak', f: this });
  }

  // ---------------------------------------------------------------- moves
  startMove(name) {
    const m = this.moves[name];
    if (!m) return;
    this.setState('attack');
    this.move = m;
    this.mf = 0;
    this.chargeF = 0;
    this.hitSet = new Map();
    this.holdingCharge = false;
    if (m.once === 'side' && !this.grounded) this.sideUsed = true;
    if (m.slide == null && this.grounded && !m.vel) this.vx *= 0.5;
    if (!this.grounded && !m.aerial) this.fastFalling = false;
    if (m.intan) this.intangible = 0;
    this.ev.push({ type: 'move', f: this, move: name });
  }

  attackState() {
    const m = this.move;
    const inp = this.input;
    // Smash attacks charge while attack is held at the charge frame.
    if (m.charge && this.mf === m.charge && this.chargeF < 60 && (inp.held('attack') || this.holdingCharge === 'c')) {
      this.chargeF++;
      this.holdingCharge = true;
      if (this.grounded) this.vx = approach(this.vx, 0, this.friction());
      if (this.chargeF % 8 === 1) this.ev.push({ type: 'charge', f: this });
      return;
    }
    this.mf++;
    const mf = this.mf;
    if (mf === m.firstActive && m.hit) this.ev.push({ type: 'swing', f: this, sfx: m.sfx, move: m.name });
    for (const v of m.vel ?? []) {
      if (mf < v.f[0] || mf > v.f[1]) continue;
      if (v.vx != null) this.vx = v.vx * this.facing + (v.vxIn ? this.input.x * v.vxIn : 0);
      else if (v.vxIn) this.vx = this.input.x * v.vxIn;
      if (v.vy != null) {
        this.vy = v.vy;
        if (v.vy < 0 && this.grounded) { this.grounded = false; this.surface = null; this.y -= 1; }
      }
    }
    for (const p of m.proj ?? []) if (p.f === mf) this.battle.spawnProjectile(this, p);
    if (m.armor && mf >= m.armor[0] && mf <= m.armor[1] && mf % 6 === 0) this.armorFlash = 4;
    if (m.intan && mf === m.intan[0]) this.intangible = m.intan[1] - m.intan[0] + 1;
    if (m.throw && mf === m.throw.f) this.battle.doThrow(this);
    if (m.loopLand && mf >= m.loopLand.from && mf < m.loopLand.land) {
      if (this.grounded && mf >= m.loopLand.from) { this.mf = m.loopLand.land; this.ev.push({ type: 'quake', f: this }); }
      else if (mf >= m.loopLand.to) this.mf = m.loopLand.from;
    }
    if (m.next && mf >= m.next.window[0] && mf <= m.next.window[1] && inp.buffered('attack') && Math.abs(inp.x) < 0.5 && Math.abs(inp.y) < 0.5) {
      inp.consume('attack');
      this.startMove(m.next.move);
      return;
    }
    // Movement during the move.
    if (this.grounded) {
      if (m.slide) this.vx *= m.slide;
      else if (!m.vel) this.vx = approach(this.vx, 0, this.friction());
    } else {
      if (!m.vel || !m.vel.some((v) => mf >= v.f[0] && mf <= v.f[1] + 3)) this.airDrift(m.aerial ? 1 : 0.7);
      if (m.aerial) this.checkFastFall();
      if (m.ledgeFrom && mf >= m.ledgeFrom && this.tryLedge()) return;
    }
    if (this.mf >= m.frames) {
      if (this.grounded) this.setState('idle');
      else this.setState(m.helpless ? 'helpless' : 'air');
    }
  }

  // ---------------------------------------------------------------- hitstun / grabs
  hitstunState() {
    if (!this.grounded) {
      if (this.sf > this.hitstun * 0.4) this.airDrift(0.35);
    } else {
      this.kbx = approach(this.kbx, 0, 0.9);
      this.vx = approach(this.vx, 0, this.friction());
    }
    if (this.sf >= this.hitstun) {
      this.combo = 0;
      if (this.grounded) this.setState('idle');
      else {
        this.setState('air');
        if (this.tumble) this.state = 'air';
      }
    }
  }

  grabbedState() {
    const g = this.grabbedBy;
    if (!g || g.holding !== this) { this.grabbedBy = null; this.setState('air'); return; }
    const inp = this.input;
    if (inp.pressed('attack') || inp.pressed('special') || inp.pressed('jump') || inp.tapX === 0) g.holdTimer -= 4;
    // Position in the holder's paws; throws swing the victim around.
    let ox = g.facing * (g.w / 2 + this.w * 0.32);
    let oy = 0;
    if (g.state === 'attack' && g.move?.throwType) {
      const t = Math.min(1, g.mf / Math.max(1, g.move.throw.f));
      const tt = g.move.throwType;
      if (tt === 'b') ox *= Math.cos(t * Math.PI);
      if (tt === 'u') { ox *= 1 - t * 0.8; oy = -g.h * 0.9 * t; }
      if (tt === 'd') { oy = 4; ox *= 1 + t * 0.15; }
    }
    this.x = g.x + ox;
    this.y = g.y + oy;
    this.vx = this.vy = this.kbx = this.kby = 0;
    this.facing = -g.facing;
  }

  holdingState() {
    const inp = this.input;
    const v = this.holding;
    this.vx = approach(this.vx, 0, this.friction());
    if (!v || v.grabbedBy !== this) { this.holding = null; this.toIdle(); return; }
    this.holdTimer--;
    const fx = inp.x * this.facing;
    let t = null;
    if (this.sf > 4) {
      if (inp.y < -0.6) t = 'uthrow';
      else if (inp.y > 0.6) t = 'dthrow';
      else if (fx > 0.6) t = 'fthrow';
      else if (fx < -0.6) t = 'bthrow';
      else if (inp.buffered('attack') || inp.buffered('special')) { inp.consume('attack'); t = 'fthrow'; }
    }
    if (inp.cstick) { const c = inp.cstick; inp.cstick = null; t = c.y < 0 ? 'uthrow' : c.y > 0 ? 'dthrow' : c.x === this.facing ? 'fthrow' : 'bthrow'; }
    if (t) {
      const keep = this.holding;
      this.startMove(t);
      this.holding = keep;
    } else if (this.holdTimer <= 0) {
      this.battle.releaseGrab(this);
    }
  }

  // ---------------------------------------------------------------- knockback
  applyKnockback() {
    const { kb, ang, dir } = this.pendingKb;
    this.pendingKb = null;
    let a = (ang * Math.PI) / 180;
    // Directional influence: holding perpendicular to the launch bends it up to 14°.
    const inp = this.input;
    const lx = Math.cos(a) * dir, ly = -Math.sin(a);
    if (Math.hypot(inp.x, inp.y) > 0.5 && kb > 30) {
      const perp = inp.x * -ly + inp.y * lx; // cross product (screen coords)
      a -= perp * 0.24 * dir;
    }
    const launch = kb * this.battle.rules.launchScale;
    let kx = Math.cos(a) * dir * launch;
    let ky = -Math.sin(a) * launch;
    if (this.grounded) {
      if (ky > 0) ky = kb > 45 ? -ky * 0.8 : 0;
      if (ky > -4 && kb < 70) {
        this.kbx = kx * 0.85;
        this.kby = 0;
        this.vx = 0;
        this.launchSpeed = Math.abs(kx);
        return;
      }
      this.grounded = false;
      this.surface = null;
      this.y -= 2;
    }
    this.kbx = kx;
    this.kby = ky;
    this.vx = 0;
    this.vy = 0;
    this.fastFalling = false;
    this.launchSpeed = launch;
    this.ev.push({ type: 'launch', f: this, speed: launch });
  }

  // ---------------------------------------------------------------- physics
  physics() {
    const st = this.st;
    if (this.grounded) {
      this.vy = 0;
      if (this.kbx) this.kbx = approach(this.kbx, 0, 0.9 * Math.max(0.5, this.battle.stage.def.friction));
      this.x += this.vx + this.kbx + (this.surface?.dx ?? 0);
      const s = this.surface;
      if (s && (this.x < s.x1 || this.x > s.x2)) {
        if (TEETER.has(this.state) && !(this.state === 'attack' && (this.move?.slide || this.move?.vel)) && Math.abs(this.kbx) < 1) {
          this.x = clamp(this.x, s.x1, s.x2);
          this.vx = 0;
        } else {
          this.grounded = false;
          this.surface = null;
          if (GROUND_STATES.has(this.state) || this.state === 'land' || this.state === 'shielddrop') this.setState('air');
          if (this.state === 'attack' && !this.move?.vel) this.setState('air');
          if (this.state === 'roll' || this.state === 'shield' || this.state === 'spotdodge') this.setState('air');
        }
      }
    } else {
      let g = st.gravity;
      if (this.state === 'attack' && this.move?.grav && this.mf >= this.move.grav.from && this.mf <= this.move.grav.to) g *= this.move.grav.g;
      if (this.state === 'airdodge' && this.rollDir && this.sf < 18) g = 0;
      const maxFall = this.fastFalling ? st.ffall : st.fall;
      if (this.vy < maxFall) this.vy = Math.min(maxFall, this.vy + g);
      else if (this.vy > maxFall && !(this.state === 'attack' && this.move?.loopLand)) this.vy = approach(this.vy, maxFall, 1.2);
      if (this.fastFalling) this.vy = Math.max(this.vy, st.ffall * (this.state === 'attack' && this.move?.loopLand ? 0 : 1));
      const sp = Math.hypot(this.kbx, this.kby);
      if (sp > 0) {
        const ns = Math.max(0, sp - this.battle.rules.kbDecay);
        this.kbx *= ns / sp;
        this.kby *= ns / sp;
      }
      this.x += this.vx + this.kbx;
      this.y += this.vy + this.kby;
    }
    this.collide();
  }

  collide() {
    const stage = this.battle.stage;
    if (!this.grounded) {
      const down = this.vy + this.kby;
      if (down >= 0) {
        for (const s of stage.surfaces) {
          if (s.soft && (this.dropThrough > 0 || (this.input.y > 0.7 && this.state !== 'hitstun') || this.state === 'grabbed')) continue;
          const prevX = this.px + (s.dx ?? 0);
          if (this.py <= s.y + 0.5 && this.y >= s.y && this.x >= s.x1 - 4 && this.x <= s.x2 + 4 && prevX >= s.x1 - 40 && prevX <= s.x2 + 40) {
            if (this.landOn(s)) return;
            break;
          }
        }
      }
    }
    // Walls and ceilings of solid blocks.
    for (const s of stage.solids) {
      const hw = this.w / 2;
      const top = this.grounded && this.surface === s ? s.y + 1 : s.y + 2;
      if (!(this.x + hw > s.x1 && this.x - hw < s.x2 && this.y > top && this.y - this.h < s.y2)) continue;
      const tumble = this.state === 'hitstun';
      if (this.py - this.h >= s.y2 - 2) {
        this.y = s.y2 + this.h;
        if (tumble && this.kby < -6) { this.kby = -this.kby * 0.55; this.ev.push({ type: 'bounce', f: this, x: this.x, y: s.y2 }); }
        else { this.kby = Math.max(0, this.kby); }
        this.vy = Math.max(0, this.vy);
      } else {
        const fromLeft = this.px + hw <= s.x1 + 2 || (this.px < (s.x1 + s.x2) / 2 && !(this.px - hw >= s.x2 - 2));
        this.x = fromLeft ? s.x1 - hw - 0.1 : s.x2 + hw + 0.1;
        if (tumble && Math.abs(this.kbx) > 8) { this.kbx = -this.kbx * 0.55; this.ev.push({ type: 'bounce', f: this, x: fromLeft ? s.x1 : s.x2, y: this.y - this.h / 2, wall: true }); }
        else this.kbx = 0;
        this.vx = 0;
      }
    }
  }

  landOn(s) {
    const impact = this.vy + this.kby;
    if (this.state === 'hitstun' && this.sf < this.hitstun) {
      const sp = Math.hypot(this.kbx, this.kby + this.vy);
      if (sp > 16 && this.kby > 2) {
        this.y = s.y - 0.5;
        this.kby = -Math.abs(this.kby) * 0.6;
        this.vy = -Math.abs(this.vy) * 0.3;
        this.ev.push({ type: 'bounce', f: this, x: this.x, y: s.y });
        return false;
      }
    }
    this.grounded = true;
    this.surface = s;
    this.y = s.y;
    this.vy = 0;
    this.kby = 0;
    this.kbx *= 0.5;
    this.airJumps = this.st.airJumps;
    this.sideUsed = false;
    this.airdodgeUsed = false;
    this.fastFalling = false;
    this.ledgeGrabs = 0;
    const st = this.state;
    if (st === 'attack') {
      const m = this.move;
      if (m.loopLand) {
        if (this.mf >= m.loopLand.from - 2 && this.mf < m.loopLand.land) { this.mf = m.loopLand.land; this.ev.push({ type: 'quake', f: this }); }
      } else if (m.aerial) { this.setState('land'); this.lag = m.landLag; }
      else if (m.helpless) { this.setState('land'); this.lag = 20; }
      else if (m.vel || m.proj) { this.setState('land'); this.lag = 8; }
    } else if (st === 'helpless') { this.setState('land'); this.lag = 18; }
    else if (st === 'airdodge') { this.setState('land'); this.lag = 10; }
    else if (st === 'hitstun') {
      if (this.tumble) { this.setState('downed'); this.ev.push({ type: 'thud', f: this }); }
      else this.state = 'hitstun';
    } else if (st === 'air' || st === 'respawn') { this.setState('land'); this.lag = 3; }
    this.vx = clamp(this.vx, -this.st.run, this.st.run);
    this.ev.push({ type: 'land', f: this, impact });
    return true;
  }
}
