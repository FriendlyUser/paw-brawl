// The battle scene: steps the engine at a fixed 60 Hz, renders it with interpolation,
// and turns engine events into effects, camera moves, sound and HUD updates.
import Phaser from 'phaser';
import { Battle } from '../engine/battle.js';
import { CpuController } from '../engine/ai.js';
import { STAGES } from '../engine/stages.js';
import { paintAnimal } from '../art/animals.js';
import { paintFx, PLAYER_COLORS } from '../art/fx.js';
import { paintStage } from '../art/stages.js';
import { hexNum } from '../art/paint.js';
import { Rig } from './rig.js';
import { Particles } from './particles.js';
import { keys, makeController, getPad } from './controls.js';
import { sfx, playMusic, stopMusic } from '../audio/sfx.js';

const W = 1920, H = 1080;
const STEP = 1 / 60;
const SPECIAL_SFX = new Set(['tongue', 'snort', 'screech', 'wind', 'bubble', 'throw']);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class BattleScene extends Phaser.Scene {
  constructor() { super('battle'); }

  init(data) {
    this.cfg = data.cfg;
    this.bus = data.bus;
  }

  create() {
    const cfg = this.cfg;
    this.def = STAGES[cfg.stageId];
    this.makeTextures();
    // Cameras: background (no zoom) renders first, then the zooming world camera,
    // then a screen-space UI camera for off-screen bubbles.
    this.bgCam = this.cameras.main;
    this.bgCam.setBackgroundColor('#000000');
    this.worldCam = this.cameras.add(0, 0, W, H);
    this.uiCam = this.cameras.add(0, 0, W, H);
    this.L = {
      bg: this.add.layer(), ground: this.add.layer(), shadow: this.add.layer(), fighters: this.add.layer(),
      proj: this.add.layer(), fx: this.add.layer(), tags: this.add.layer(), ui: this.add.layer(),
    };
    const world = [this.L.ground, this.L.shadow, this.L.fighters, this.L.proj, this.L.fx, this.L.tags];
    this.bgCam.ignore([...world, this.L.ui]);
    this.worldCam.ignore([this.L.bg, this.L.ui]);
    this.uiCam.ignore([this.L.bg, ...world]);

    this.buildStage();
    this.battle = new Battle({
      stageId: cfg.stageId,
      seed: cfg.seed ?? (Date.now() & 0xffff),
      rules: { stocks: cfg.rules.stocks, time: cfg.rules.time },
      players: cfg.players.map((p) => ({
        charId: p.charId,
        palette: p.palette,
        cpu: p.type === 'cpu',
        tapJump: p.type === 'human' && cfg.settings?.tapJump,
        controller: p.type === 'cpu' ? new CpuController(p.level) : makeController(p.input),
      })),
    });
    this.fighters = this.battle.fighters;
    this.rigs = this.fighters.map((f) => new Rig(this, this.L.fighters, f, this.art[f.slot], `pl${f.slot}`, this.L.shadow));
    this.fighters.forEach((f, i) => { f.color = hexNum(PLAYER_COLORS[cfg.players[i].colorIdx ?? i]); f.label = cfg.players[i].label; });
    this.buildTags();
    this.parts = new Particles(this, this.L.fx);
    this.bgParts = new Particles(this, this.L.bg, 160);
    this.smear = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    this.L.fx.add(this.smear);
    this.shieldImgs = this.fighters.map(() => { const s = this.add.image(0, 0, 'fx_bubbleShield').setVisible(false); this.L.fx.add(s); return s; });
    this.halos = this.fighters.map(() => { const s = this.add.image(0, 0, 'fx_halo').setVisible(false); this.L.fighters.addAt(s, 0); return s; });
    this.projSprites = new Map();
    this.trails = this.fighters.map(() => []);

    // Camera state.
    this.cam = { x: 0, y: -180, z: 0.7, shake: 0, punch: 0 };
    this.applyCamera();
    this.acc = 0;
    this.timeScale = 1;
    this.slowUntil = 0;
    this.paused = false;
    this.phase = 'countdown';
    this.countdown = 0;
    this.time0 = 0;
    this.lastHud = '';
    this.ended = false;
    this.ambientT = 0;
    this.padStart = this.fighters.map(() => false);
    this.lastHitSlot = new Map();

    this.onBus = {
      pause: (v) => this.setPaused(v),
    };
    this.bus.on('scene:pause', this.onBus.pause);
    this.events.once('shutdown', () => this.bus.off('scene:pause', this.onBus.pause));
    keys.flush();
    playMusic(cfg.stageId);
    // Test hooks: ?warp=N fast-forwards N frames, ?ff=K runs K engine steps per tick.
    if (cfg.debug?.warp) {
      this.phase = 'fight';
      for (let i = 0; i < cfg.debug.warp && !this.battle.over; i++) {
        this.battle.step();
        this.recordProjectiles();
        this.handleEvents(this.battle.drainEvents().filter((e) => e.type === 'proj' || e.type === 'projdead'), 0);
      }
      this.emitHud(true);
    }
    this.emitHud(true);
  }

  // ---------------------------------------------------------------- setup
  makeTextures() {
    const tx = this.textures;
    for (const [k, c] of Object.entries(paintFx())) if (!tx.exists(`fx_${k}`)) tx.addCanvas(`fx_${k}`, c);
    this.art = this.cfg.players.map((p, i) => {
      const art = paintAnimal(p.charId, p.palette);
      for (const [name, part] of Object.entries(art.parts)) {
        const key = `pl${i}_${name}`;
        if (tx.exists(key)) tx.remove(key);
        tx.addCanvas(key, part.canvas);
      }
      return art;
    });
    this.stageArt = paintStage(this.def);
    const sa = this.stageArt;
    const add = (key, c) => { if (tx.exists(key)) tx.remove(key); tx.addCanvas(key, c); };
    add('st_sky', sa.sky);
    sa.layers.forEach((l, i) => add(`st_layer${i}`, l.canvas));
    sa.grounds.forEach((g, i) => add(`st_ground${i}`, g.canvas));
    sa.platforms.forEach((p, i) => add(`st_plat${i}`, p.canvas));
    if (sa.aurora) add('st_aurora', sa.aurora);
  }

  buildStage() {
    const sa = this.stageArt;
    this.sky = this.add.image(W / 2, H / 2, 'st_sky').setDisplaySize(W + 8, H + 8);
    this.L.bg.add(this.sky);
    if (sa.aurora) {
      this.aurora = [0, 1].map((i) => {
        const a = this.add.image(W / 2, 260, 'st_aurora').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.7).setScale(1.2 + i * 0.25, 1 + i * 0.2);
        this.L.bg.add(a);
        return a;
      });
    }
    this.layers = sa.layers.map((l, i) => {
      const img = this.add.image(W / 2, l.y, `st_layer${i}`).setOrigin(0.5, 1).setScale(l.scale);
      this.L.bg.add(img);
      return { img, ...l };
    });
    this.groundImgs = sa.grounds.map((g, i) => {
      const img = this.add.image(g.x, g.y, `st_ground${i}`).setOrigin(0, 0).setScale(1 / g.res);
      this.L.ground.add(img);
      return img;
    });
    this.platImgs = this.def.platforms.map((p, i) => {
      const pa = sa.platforms[i];
      const img = this.add.image(p.x1 - pa.ox, p.y - pa.oy, `st_plat${i}`).setOrigin(0, 0).setScale(1 / pa.res);
      this.L.ground.add(img);
      return { img, pa };
    });
  }

  buildTags() {
    this.tags = this.fighters.map((f) => {
      const col = f.color;
      const t = this.add.text(0, 0, f.label, { fontFamily: 'Lilita One, Arial Black, sans-serif', fontSize: '30px', color: '#ffffff', stroke: '#1a1020', strokeThickness: 7 }).setOrigin(0.5, 1);
      t.setTint(col, col, 0xffffff, 0xffffff);
      const arrow = this.add.image(0, 0, 'fx_arrow').setTint(col).setScale(0.55).setOrigin(0.5, 0);
      this.L.tags.add([arrow, t]);
      // Off-screen bubble.
      const bubble = this.add.container(0, 0).setVisible(false);
      const ring = this.add.graphics();
      ring.fillStyle(0x10131f, 0.75).fillCircle(0, 0, 58).lineStyle(7, col, 1).strokeCircle(0, 0, 58);
      const head = this.add.image(0, 6, `pl${f.slot}_head_normal`).setScale(0.32);
      const pointer = this.add.triangle(0, 0, 0, -14, 0, 14, 22, 0, col);
      bubble.add([ring, head, pointer]);
      this.L.ui.add(bubble);
      return { t, arrow, bubble, head, pointer };
    });
  }

  // ---------------------------------------------------------------- main loop
  setPaused(v) {
    if (this.ended || this.phase === 'countdown') v = false;
    this.paused = v;
    this.bus.emit('paused', v);
    if (v) sfx('menuBack');
  }

  update(time, delta) {
    const dt = Math.min(delta, 100) / 1000;
    this.pollPause();
    if (this.paused) return;
    const now = time / 1000;
    if (now < this.slowUntil) this.timeScale = lerp(this.timeScale, this.slowTarget, 0.2);
    else this.timeScale = lerp(this.timeScale, 1, 0.12);
    this.acc += dt * this.timeScale * (this.cfg.debug?.ff || 1);
    let steps = 0;
    while (this.acc >= STEP && steps < 5 * (this.cfg.debug?.ff || 1)) {
      this.acc -= STEP;
      steps++;
      this.fixedStep(now);
    }
    if (steps >= 5 * (this.cfg.debug?.ff || 1)) this.acc = 0;
    const alpha = this.acc / STEP;
    this.render(dt, alpha, now);
  }

  pollPause() {
    let toggle = keys.take('Escape') || keys.take('KeyP');
    this.fighters.forEach((f, i) => {
      const c = f.controller;
      if (c.kind !== 'gamepad') return;
      const p = getPad(c.index);
      const st = !!p?.buttons[9]?.pressed;
      if (st && !this.padStart[i]) toggle = true;
      this.padStart[i] = st;
    });
    if (toggle && !this.ended) this.setPaused(!this.paused);
  }

  fixedStep(now) {
    if (this.phase === 'countdown') {
      this.countdown++;
      for (const f of this.fighters) { f.px = f.x; f.py = f.y; }
      const c = this.countdown;
      if (c === 1 || c === 61 || c === 121) { this.bus.emit('countdown', 3 - Math.floor(c / 60)); sfx('beep'); }
      if (c === 181) {
        this.bus.emit('countdown', 0);
        sfx('go');
        this.phase = 'fight';
      }
      return;
    }
    this.battle.step();
    keys.endStep();
    this.recordProjectiles();
    this.handleEvents(this.battle.drainEvents(), now);
    this.emitHud();
    if (this.battle.timeLeft != null && this.battle.frame % 30 === 0) this.bus.emit('timer', Math.ceil(this.battle.timeLeft / 60));
  }

  // ---------------------------------------------------------------- events → effects
  handleEvents(events, now) {
    for (const e of events) {
      const f = e.f;
      const rig = f ? this.rigs[f.slot] : null;
      switch (e.type) {
        case 'hit': this.onHit(e, now); break;
        case 'launch': this.onLaunch(e, now); break;
        case 'shieldhit':
          sfx('shieldhit');
          this.ring(e.x, e.y, f.color, 0.35, 0.25);
          this.sparks(e.x, e.y, 6, 0xbfe8ff, 6);
          break;
        case 'shieldbreak':
          sfx('shieldbreak');
          this.shards(f);
          this.shakeCam(14);
          break;
        case 'ko': this.onKO(e, now); break;
        case 'jump':
          sfx('jump', { air: e.air });
          if (e.air) { rig.flip = 1; this.ring(f.x, f.y - 6, 0xffffff, 0.28, 0.3, 0.35); }
          else this.dust(f.x, f.y, 4, 1);
          rig.impulse(e.air ? -0.12 : -0.18);
          break;
        case 'land':
          if (Math.abs(e.impact) > 2) sfx('land', { impact: e.impact });
          this.dust(f.x, f.y, Math.min(8, 2 + Math.abs(e.impact) * 0.4), 1);
          rig.impulse(0.08 + Math.min(0.2, Math.abs(e.impact) * 0.012));
          break;
        case 'dash': sfx('dash'); this.dust(f.x - f.facing * 20, f.y, 3, -f.facing); break;
        case 'skid': this.dust(f.x, f.y, 3, f.facing); break;
        case 'dodge': sfx('dodge'); break;
        case 'fastfall': this.parts.spawn({ tex: 'fx_spark', x: f.x, y: f.y - f.h * 0.5, s0: 0.5, s1: 0.1, life: 0.12, add: true }); break;
        case 'ledge': sfx('ledge'); this.sparks(f.x, f.y - f.h, 4, 0xffffff, 4); break;
        case 'swing': this.onSwing(e); break;
        case 'move':
          if (e.move.endsWith('throw')) sfx('throw');
          else if (f.moves[e.move]?.sfx && SPECIAL_SFX.has(f.moves[e.move].sfx)) sfx(f.moves[e.move].sfx);
          break;
        case 'grab': sfx('grab'); break;
        case 'proj': sfx('proj', { ptype: e.p.type }); this.addProjectile(e.p); break;
        case 'projdead': this.removeProjectile(e.p); break;
        case 'counter':
          sfx('counter');
          this.ring(e.x, e.y, 0xffffff, 0.6, 0.3, 0.6);
          this.floatText(e.x, e.y - 60, 'COUNTER!', '#ffe14a');
          this.punch(0.06);
          break;
        case 'reflect': sfx('reflect'); this.ring(e.x, e.y, 0x9fe8ff, 0.4, 0.2); break;
        case 'armor': sfx('armor'); this.sparks(e.x, e.y, 6, 0xffa040, 5); break;
        case 'charge': sfx('charge'); this.sparks(f.x + f.facing * 30, f.y - f.h * 0.6, 2, 0xffe080, 3); break;
        case 'quake':
          sfx('quake');
          this.shakeCam(10);
          for (const dir of [-1, 1]) for (let i = 0; i < 6; i++) this.parts.spawn({ tex: 'fx_puff', x: f.x + dir * i * 18, y: f.y - 8, vx: dir * (6 + i * 1.6), vy: -1 - Math.random() * 2, drag: 0.9, s0: 0.5, s1: 1.3, a0: 0.8, life: 0.55, tint: this.dustColor() });
          this.ring(f.x, f.y - 10, 0xffffff, 0.5, 0.35, 1.4, 0.3);
          break;
        case 'bounce':
          sfx('bounce');
          this.shakeCam(8);
          this.dust(e.x, e.y, 8, 1);
          break;
        case 'thud': sfx('land', { impact: 18 }); this.dust(f.x, f.y, 6, 1); break;
        case 'respawn': sfx('respawn'); break;
        case 'gameover': this.onGameOver(e, now); break;
      }
    }
  }

  onHit(e, now) {
    const s = Math.min(1, e.kb / 150);
    sfx('hit', { kb: e.kb, sfx: e.sfx });
    const col = s > 0.7 ? 0xff7a2a : s > 0.4 ? 0xffd23a : 0xffffff;
    const ang = (e.ang * Math.PI) / 180;
    const lx = Math.cos(ang) * e.dir, ly = -Math.sin(ang);
    this.parts.spawn({ tex: 'fx_burst', x: e.x, y: e.y, s0: 0.25 + s * 0.4, s1: 0.75 + s * 0.9, a0: 1, a1: 0, life: 0.16 + s * 0.12, add: true, tint: col, rot: Math.random() * 3 });
    this.parts.spawn({ tex: 'fx_glow', x: e.x, y: e.y, s0: 1 + s * 2, s1: 2 + s * 3, a0: 0.9, life: 0.18, add: true, tint: col });
    this.ring(e.x, e.y, col, 0.2 + s * 0.3, 0.25, 0.8 + s * 1.2);
    const n = 5 + Math.round(s * 12);
    for (let i = 0; i < n; i++) {
      const a = Math.atan2(ly, lx) + (Math.random() - 0.5) * 1.6;
      const sp = 6 + Math.random() * 14 * (0.5 + s);
      this.parts.spawn({ tex: 'fx_streak', x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 0.86, s0: 0.35 + s * 0.3, s1: 0.05, sy: 0.6, life: 0.22 + Math.random() * 0.15, add: true, tint: col, alignVel: true, ox: 1 });
    }
    if (e.kb > 70) this.shakeCam(e.kb * 0.07);
    const r = this.rigs[e.f.slot];
    r.impulse(-0.12);
    if (e.combo >= 3) this.floatText(e.f.x, e.f.y - e.f.h - 40, `${e.combo} HIT`, '#ffe14a', 0.9);
    this.bus.emit('hudhit', { slot: e.f.slot, dmg: e.dmg });
  }

  onLaunch(e, now) {
    const f = e.f;
    if (this.predictKO(f)) {
      // A KO-level hit: hold the frame, flash and zoom in.
      this.slowUntil = now + 0.45;
      this.slowTarget = 0.18;
      this.timeScale = 0.08;
      this.punch(0.12);
      this.shakeCam(18);
      this.bus.emit('flash', 0.5);
      this.parts.spawn({ tex: 'fx_burst', x: f.x, y: f.y - f.h / 2, s0: 0.6, s1: 2.6, a0: 0.9, life: 0.35, add: true, tint: 0xfff1a0 });
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        this.parts.spawn({ tex: 'fx_streak', x: f.x + Math.cos(a) * 40, y: f.y - f.h / 2 + Math.sin(a) * 40, vx: Math.cos(a) * 26, vy: Math.sin(a) * 26, drag: 0.85, s0: 0.9, s1: 0.1, sy: 0.7, life: 0.35, add: true, tint: 0xffffff, alignVel: true, ox: 1 });
      }
    }
  }

  /** Runs the launch forward (no DI) to see if it crosses a blast line. */
  predictKO(f) {
    const b = this.def.blast;
    let x = f.x, y = f.y, kx = f.kbx, ky = f.kby, vy = 0;
    const decay = this.battle.rules.kbDecay;
    for (let i = 0; i < 160; i++) {
      const sp = Math.hypot(kx, ky);
      if (sp > 0) { const ns = Math.max(0, sp - decay); kx *= ns / sp; ky *= ns / sp; }
      vy = Math.min(f.st.fall, vy + f.st.gravity);
      x += kx; y += ky + vy;
      if (x < b.left || x > b.right || y - f.h < b.top) return true;
      if (sp < 2) return false;
    }
    return false;
  }

  onKO(e, now) {
    const f = e.f;
    sfx('ko');
    this.shakeCam(32);
    this.bus.emit('flash', 0.35);
    const inward = { left: 0, right: Math.PI, top: Math.PI / 2, bottom: -Math.PI / 2 }[e.side];
    // Clamp the blast into the visible area so it is always seen.
    const v = this.worldCam.worldView;
    const x = clamp(e.x, v.x + 30, v.right - 30), y = clamp(e.y, v.y + 30, v.bottom - 30);
    const col = f.color;
    for (let i = 0; i < 40; i++) {
      const a = inward + (Math.random() - 0.5) * 1.3;
      const sp = 10 + Math.random() * 40;
      this.parts.spawn({ tex: i % 3 ? 'fx_streak' : 'fx_glow', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 0.93, s0: 1.4 + Math.random(), s1: 0.1, sy: i % 3 ? 1.2 : 1, life: 0.6 + Math.random() * 0.5, add: true, tint: i % 2 ? col : 0xffffff, alignVel: i % 3 !== 0, ox: 1 });
    }
    this.parts.spawn({ tex: 'fx_burst', x, y, s0: 1, s1: 5, a0: 1, life: 0.5, add: true, tint: col, rot: inward });
    this.parts.spawn({ tex: 'fx_glow', x, y, s0: 4, s1: 10, a0: 1, life: 0.6, add: true, tint: col });
    for (let i = 0; i < 8; i++) this.parts.spawn({ tex: 'fx_star5', x, y, vx: Math.cos(inward + (Math.random() - 0.5)) * (8 + Math.random() * 14), vy: Math.sin(inward + (Math.random() - 0.5)) * (8 + Math.random() * 14) - 4, g: 0.35, s0: 0.9, s1: 0.4, a0: 1, life: 1.1, spin: 0.2 });
    this.trails[f.slot] = [];
    this.bus.emit('ko', { slot: f.slot, credit: e.credit?.slot ?? null });
    this.emitHud(true);
  }

  onSwing(e) {
    const f = e.f;
    sfx('swing', { sfx: e.sfx });
    if (f.charId === 'owl' && e.move === 'dspec') {
      for (let i = 0; i < 3; i++) this.parts.spawn({ tex: 'fx_ring', x: f.x, y: f.y - f.h * 0.55, s0: 0.2, s1: 1.2 + i * 0.25, a0: 0.8 - i * 0.2, life: 0.35 + i * 0.08, add: true, tint: 0xc9b3ff });
    }
    if (f.charId === 'rhino' && e.move === 'nspec') {
      for (let i = 0; i < 10; i++) this.parts.spawn({ tex: 'fx_puff', x: f.x + f.facing * 50, y: f.y - f.h * 0.35, vx: f.facing * (6 + Math.random() * 10), vy: (Math.random() - 0.5) * 4, drag: 0.9, s0: 0.4, s1: 1.4, a0: 0.75, life: 0.6, tint: 0xe8dcc8 });
    }
    if (e.move === 'usmash' || e.move === 'fsmash' || e.move === 'dsmash') this.punch(0.03);
  }

  onGameOver(e, now) {
    this.ended = true;
    this.slowUntil = now + 1.4;
    this.slowTarget = 0.25;
    this.timeScale = 0.2;
    stopMusic();
    sfx('game');
    this.bus.emit('game', { winner: e.winner?.slot ?? null });
    this.time.delayedCall(2600, () => {
      const b = this.battle;
      this.bus.emit('results', {
        winner: b.winner?.slot ?? null,
        ranking: b.ranking.map((f) => f.slot),
        players: b.fighters.map((f) => ({ slot: f.slot, ...f.record, stocks: Number.isFinite(f.stocks) ? f.stocks : null, score: f.score, damage: Math.round(f.damage) })),
        frames: b.frame,
      });
    });
  }

  // ---------------------------------------------------------------- effect helpers
  dustColor() { return { grove: 0xe8f0d0, savanna: 0xf5c89a, glacier: 0xffffff }[this.def.id]; }

  dust(x, y, n, dir) {
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1;
      this.parts.spawn({ tex: 'fx_puff', x: x + side * 8, y: y - 6, vx: side * (1.5 + Math.random() * 3) + dir * 0.5, vy: -0.5 - Math.random() * 1.6, drag: 0.92, s0: 0.25 + Math.random() * 0.2, s1: 0.7 + Math.random() * 0.4, a0: 0.75, life: 0.4 + Math.random() * 0.25, tint: this.dustColor() });
    }
  }

  ring(x, y, tint, s0, life, s1 = 1, a0 = 0.9) {
    this.parts.spawn({ tex: 'fx_ring', x, y, s0, s1, a0, life, add: true, tint });
  }

  sparks(x, y, n, tint, sp) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      this.parts.spawn({ tex: 'fx_spark', x, y, vx: Math.cos(a) * sp * (0.5 + Math.random()), vy: Math.sin(a) * sp * (0.5 + Math.random()), drag: 0.9, s0: 0.3, s1: 0, life: 0.3, add: true, tint, spin: 0.1 });
    }
  }

  shards(f) {
    const c = f.center();
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2;
      this.parts.spawn({ tex: 'fx_spark', x: c.x, y: c.y, vx: Math.cos(a) * 12, vy: Math.sin(a) * 12 - 3, g: 0.4, drag: 0.97, s0: 0.5, s1: 0.1, life: 0.8, add: true, tint: f.color, spin: 0.3 });
    }
  }

  floatText(x, y, text, color, scale = 1) {
    const t = this.add.text(x, y, text, { fontFamily: 'Lilita One, Arial Black, sans-serif', fontSize: `${Math.round(40 * scale)}px`, color, stroke: '#1a1020', strokeThickness: 8 }).setOrigin(0.5);
    this.L.tags.add(t);
    t.setScale(0.4);
    this.tweens.add({ targets: t, scale: 1, duration: 140, ease: 'Back.Out' });
    this.tweens.add({ targets: t, y: y - 50, alpha: 0, delay: 450, duration: 450, onComplete: () => t.destroy() });
  }

  shakeCam(amt) { this.cam.shake = Math.min(40, Math.max(this.cam.shake, amt)); }
  punch(amt) { this.cam.punch = Math.max(this.cam.punch, amt); }

  // ---------------------------------------------------------------- projectiles
  addProjectile(p) {
    const img = this.add.image(p.x, p.y, `fx_proj_${p.type}`).setScale(p.type === 'bubble' ? 0.75 : 0.7);
    if (p.vx < 0 && p.type !== 'yarn' && p.type !== 'bubble') img.setFlipX(true);
    this.L.proj.add(img);
    this.projSprites.set(p.id, { img, p, px: p.x, py: p.y, cx: p.x, cy: p.y });
  }

  recordProjectiles() {
    for (const rec of this.projSprites.values()) {
      rec.px = rec.cx; rec.py = rec.cy;
      rec.cx = rec.p.x; rec.cy = rec.p.y;
    }
  }

  removeProjectile(p) {
    const rec = this.projSprites.get(p.id);
    if (!rec) return;
    this.projSprites.delete(p.id);
    rec.img.destroy();
    if (p.type === 'honey' && !p.fizzle) {
      for (let i = 0; i < 10; i++) this.parts.spawn({ tex: 'fx_glow', x: p.x, y: p.y, vx: (Math.random() - 0.5) * 10, vy: -Math.random() * 8, g: 0.45, s0: 0.35, s1: 0.15, life: 0.6, tint: 0xffb81c, a0: 1 });
    } else if (p.type === 'bubble') {
      sfx('pop');
      this.ring(p.x, p.y, 0xbff4ff, 0.2, 0.2, 0.45);
    } else this.parts.spawn({ tex: 'fx_puff', x: p.x, y: p.y, s0: 0.3, s1: 0.8, a0: 0.6, life: 0.3 });
  }

  // ---------------------------------------------------------------- rendering
  render(dt, alpha, now) {
    const t = now;
    this.rigs.forEach((r) => r.update(dt, alpha, t));
    for (const [i, f] of this.fighters.entries()) this.decorate(f, this.rigs[i], i, alpha, t);
    for (const rec of this.projSprites.values()) {
      rec.img.setPosition(lerp(rec.px, rec.cx, alpha), lerp(rec.py, rec.cy, alpha));
      rec.img.rotation = rec.p.rot;
      if (rec.p.wobble) rec.img.setScale(0.75 + Math.sin(rec.p.age * 0.3) * 0.04, 0.75 - Math.sin(rec.p.age * 0.3) * 0.04);
    }
    // Moving platforms.
    this.def.platforms.forEach((p, i) => {
      const live = this.battle.stage.platforms[i];
      const { img, pa } = this.platImgs[i];
      img.x = live.x1 - pa.ox;
    });
    this.drawSmears();
    this.updateCamera(dt);
    this.updateBackground(dt, t);
    this.parts.update(dt * Math.max(0.3, this.timeScale));
    this.bgParts.update(dt);
  }

  decorate(f, rig, i, alpha, t) {
    const x = lerp(f.px, f.x, alpha), y = lerp(f.py, f.y, alpha);
    const alive = f.state !== 'dead';
    // Tints and visibility cues.
    let tint = null, fill = false, a = 1;
    if (f.flash > 4) { tint = 0xffffff; fill = true; }
    else if (f.armorFlash > 0) tint = 0xffb46a;
    else if (f.holdingCharge && Math.floor(t * 16) % 2) tint = 0xfff0a0;
    else if (f.state === 'helpless') tint = 0x9a9aaa;
    else if (f.state === 'attack' && f.move?.counter && f.inWindow('counter')) tint = 0xd8f0ff;
    if (f.intangible > 0) a = 0.55 + Math.sin(t * 40) * 0.15;
    if (f.invincible > 0 && f.state !== 'respawn') a = Math.floor(t * 14) % 2 ? 0.45 : 1;
    const key = `${tint}:${fill}`;
    if (rig.tintKey !== key) { rig.setTint(tint, fill); rig.tintKey = key; }
    rig.root.setAlpha(a);
    // Shield bubble.
    const sh = this.shieldImgs[i];
    if (f.state === 'shield' && alive) {
      const k = 0.3 + 0.7 * (f.shieldHp / 50);
      const jitter = f.shieldStun > 0 ? (Math.random() - 0.5) * 6 : 0;
      sh.setVisible(true).setPosition(x + jitter, y - f.h * 0.48).setScale((f.h * 0.62 * k) / 124).setTint(f.color).setAlpha(0.55 + (1 - k) * 0.2);
    } else sh.setVisible(false);
    // Respawn halo.
    const halo = this.halos[i];
    if (f.state === 'respawn') halo.setVisible(true).setPosition(x, y + 6).setTint(f.color).setScale(0.7 + Math.sin(t * 5) * 0.03).setAlpha(0.9);
    else halo.setVisible(false);
    // Launch smoke trail.
    if (f.state === 'hitstun' && !f.grounded && Math.hypot(f.kbx, f.kby) > 9 && f.hitlag === 0) {
      const sp = Math.hypot(f.kbx, f.kby);
      const hot = sp > 24;
      this.parts.spawn({ tex: hot ? 'fx_glow' : 'fx_puff', x: x + (Math.random() - 0.5) * 16, y: y - f.h * 0.5 + (Math.random() - 0.5) * 16, s0: hot ? 0.8 : 0.35, s1: hot ? 0.2 : 0.9, a0: hot ? 0.9 : 0.6, life: hot ? 0.3 : 0.6, add: hot, tint: hot ? (Math.random() < 0.5 ? 0xffa030 : 0xffe080) : 0xe6e6e6 });
    }
    // Dizzy stars.
    if (f.state === 'dizzy' && Math.random() < 0.3) {
      const a2 = t * 6 + Math.random();
      this.parts.spawn({ tex: 'fx_star5', x: x + Math.cos(a2) * 34, y: y - f.h - 8 + Math.sin(a2) * 8, s0: 0.45, s1: 0.2, life: 0.4 });
    }
    // Player tag.
    const tag = this.tags[i];
    const show = alive && !this.ended;
    tag.t.setVisible(show).setPosition(x, y - f.h - 34 - (f.state === 'ledge' ? -f.h * 0.3 : 0));
    tag.arrow.setVisible(show).setPosition(x, y - f.h - 30 - (f.state === 'ledge' ? -f.h * 0.3 : 0));
    // Off-screen bubble.
    const v = this.worldCam.worldView;
    const cy = y - f.h / 2;
    const off = alive && (x < v.x || x > v.right || cy < v.y || y - f.h > v.bottom);
    tag.bubble.setVisible(off);
    if (off) {
      const z = this.worldCam.zoom;
      const sx = clamp((x - v.x) * z, 80, W - 80), sy = clamp((cy - v.y) * z, 80, H - 80);
      tag.bubble.setPosition(sx, sy);
      const ang = Math.atan2((cy - v.y) * z - sy, (x - v.x) * z - sx);
      tag.pointer.setPosition(Math.cos(ang) * 66, Math.sin(ang) * 66).setRotation(ang);
      tag.head.setFlipX(f.facing < 0);
      const dist = Math.hypot((x - v.x) * z - sx, (cy - v.y) * z - sy);
      tag.bubble.setScale(clamp(1.1 - dist / 1400, 0.6, 1));
    }
  }

  drawSmears() {
    const g = this.smear;
    g.clear();
    this.fighters.forEach((f, i) => {
      const tr = this.trails[i];
      const boxes = f.state === 'attack' && f.hitlag === 0 ? f.activeHitboxes() : [];
      if (boxes.length) {
        const h = boxes.reduce((a, b) => (b.r * b.dmg > a.r * a.dmg ? b : a));
        tr.push({ x: h.wx, y: h.wy, r: h.r, t: this.time.now });
      }
      while (tr.length && this.time.now - tr[0].t > 110) tr.shift();
      if (tr.length < 2) return;
      for (let k = 1; k < tr.length; k++) {
        const a = tr[k - 1], b = tr[k];
        const age = (this.time.now - b.t) / 110;
        const w = b.r * 1.2 * (1 - age) * (k / tr.length);
        g.lineStyle(w, 0xffffff, 0.35 * (1 - age));
        g.lineBetween(a.x, a.y, b.x, b.y);
      }
    });
  }

  updateCamera(dt) {
    const c = this.cam;
    const def = this.def.cam;
    const live = this.fighters.filter((f) => f.state !== 'dead');
    let minX = -300, maxX = 300, minY = -400, maxY = 120;
    if (live.length) {
      minX = Math.min(...live.map((f) => f.x)) - 300;
      maxX = Math.max(...live.map((f) => f.x)) + 300;
      minY = Math.min(...live.map((f) => f.y - f.h)) - 220;
      maxY = Math.max(...live.map((f) => f.y)) + 200;
    }
    minX = Math.max(minX, def.left); maxX = Math.min(maxX, def.right);
    minY = Math.max(minY, def.top); maxY = Math.min(maxY, def.bottom);
    if (maxX - minX < 200) { const m = (minX + maxX) / 2; minX = m - 100; maxX = m + 100; }
    if (maxY - minY < 200) { const m = (minY + maxY) / 2; minY = m - 100; maxY = m + 100; }
    let z = clamp(Math.min(W / (maxX - minX), H / (maxY - minY)), 0.52, 1.1);
    let tx = (minX + maxX) / 2, ty = (minY + maxY) / 2;
    const vw = W / z / 2, vh = H / z / 2;
    tx = def.right - def.left > vw * 2 ? clamp(tx, def.left + vw, def.right - vw) : (def.left + def.right) / 2;
    ty = def.bottom - def.top > vh * 2 ? clamp(ty, def.top + vh, def.bottom - vh) : (def.top + def.bottom) / 2;
    const step = dt * 60;
    const kp = 1 - Math.pow(0.9, step);
    const kz = 1 - Math.pow(0.95, step);
    c.x += (tx - c.x) * kp;
    c.y += (ty - c.y) * kp;
    c.z += (z - c.z) * kz;
    c.shake *= Math.pow(0.86, step);
    c.punch *= Math.pow(0.9, step);
    this.applyCamera();
  }

  applyCamera() {
    const c = this.cam;
    const sx = (Math.random() - 0.5) * c.shake * 2, sy = (Math.random() - 0.5) * c.shake * 2;
    this.worldCam.setZoom(c.z * (1 + c.punch));
    this.worldCam.centerOn(c.x + sx, c.y + sy);
    this.bgShake = { x: sx * 0.3, y: sy * 0.3 };
  }

  updateBackground(dt, t) {
    const c = this.cam;
    for (const l of this.layers) {
      const s = l.scale * (1 + (c.z - 0.75) * l.f * 0.9);
      l.img.setScale(s);
      l.img.x = W / 2 - c.x * c.z * l.f + this.bgShake.x;
      l.img.y = l.y - (c.y + 180) * c.z * l.f + this.bgShake.y + (s - l.scale) * 300;
    }
    if (this.aurora) this.aurora.forEach((a, i) => { a.x = W / 2 + Math.sin(t * 0.15 + i * 2) * 120 - c.x * 0.05; a.setAlpha(0.45 + Math.sin(t * 0.6 + i * 1.7) * 0.25); });
    // Ambient particles in screen space.
    this.ambientT -= dt;
    if (this.ambientT <= 0) {
      this.ambientT = this.def.id === 'glacier' ? 0.05 : 0.22;
      const kind = this.stageArt.ambient;
      if (kind === 'leaves') this.bgParts.spawn({ tex: 'fx_leaf', x: Math.random() * W, y: -30, vx: 0.6 + Math.random(), vy: 1.2 + Math.random(), sway: 1.2, s0: 0.6 + Math.random() * 0.5, s1: 0.6, a0: 0.9, a1: 0.6, life: 9, spin: 0.03, tint: [0x8fd14f, 0xd9e05a, 0xf0a040, 0x6fbf4a][Math.floor(Math.random() * 4)], ease: 'lin' });
      else if (kind === 'snow') this.bgParts.spawn({ tex: 'fx_snow', x: Math.random() * W * 1.2 - 100, y: -20, vx: 0.4 + Math.random() * 0.6, vy: 1 + Math.random() * 1.8, sway: 0.5, s0: 0.3 + Math.random() * 0.6, s1: 0.3, a0: 0.9, a1: 0.5, life: 12, ease: 'lin' });
      else if (kind === 'embers') this.bgParts.spawn({ tex: 'fx_glow', x: Math.random() * W, y: H + 20, vx: 0.3 + Math.random() * 0.6, vy: -0.8 - Math.random(), sway: 0.6, s0: 0.12 + Math.random() * 0.12, s1: 0.05, a0: 0.9, a1: 0, life: 10, add: true, tint: 0xffb060, ease: 'lin' });
    }
  }

  // ---------------------------------------------------------------- HUD
  emitHud(force = false) {
    const data = this.fighters.map((f) => ({
      slot: f.slot,
      damage: Math.floor(f.damage),
      stocks: Number.isFinite(f.stocks) ? f.stocks : null,
      score: f.score,
      dead: f.state === 'dead',
      out: f.state === 'dead' && f.stocks <= 0,
    }));
    const s = JSON.stringify(data);
    if (!force && s === this.lastHud) return;
    this.lastHud = s;
    this.bus.emit('hud', data);
  }
}
