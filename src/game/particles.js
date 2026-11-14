// A light particle system on pooled Phaser images: full control over direction,
// tint, blend and fade per particle, which Phaser's emitters make awkward.
export class Particles {
  constructor(scene, layer, max = 700) {
    this.scene = scene;
    this.layer = layer;
    this.pool = [];
    this.live = [];
    this.max = max;
  }

  spawn(o) {
    if (this.live.length >= this.max) {
      const old = this.live.shift();
      old.img.setVisible(false);
      this.pool.push(old);
    }
    let p = this.pool.pop();
    if (!p) {
      const img = this.scene.add.image(0, 0, o.tex);
      this.layer.add(img);
      p = { img };
    }
    const img = p.img;
    img.setTexture(o.tex).setVisible(true).setPosition(o.x, o.y).setRotation(o.rot ?? 0);
    img.setBlendMode(o.add ? 1 : 0);
    if (o.tint != null) img.setTint(o.tint); else img.clearTint();
    img.setOrigin(o.ox ?? 0.5, o.oy ?? 0.5);
    Object.assign(p, {
      x: o.x, y: o.y, vx: o.vx ?? 0, vy: o.vy ?? 0, g: o.g ?? 0, drag: o.drag ?? 1,
      life: o.life ?? 0.5, age: 0, s0: o.s0 ?? 1, s1: o.s1 ?? 0, sy: o.sy ?? 1, a0: o.a0 ?? 1, a1: o.a1 ?? 0,
      spin: o.spin ?? 0, rot: o.rot ?? 0, alignVel: !!o.alignVel, ease: o.ease ?? 'out', sway: o.sway ?? 0, swayT: Math.random() * 6,
    });
    this.apply(p, 0);
    this.live.push(p);
    return p;
  }

  apply(p, t) {
    const e = p.ease === 'out' ? 1 - (1 - t) * (1 - t) : p.ease === 'in' ? t * t : t;
    const s = p.s0 + (p.s1 - p.s0) * e;
    p.img.setScale(s, s * p.sy);
    p.img.setAlpha(Math.max(0, p.a0 + (p.a1 - p.a0) * t));
  }

  update(dt) {
    const step = dt * 60;
    const keep = [];
    for (const p of this.live) {
      p.age += dt;
      const t = p.age / p.life;
      if (t >= 1) { p.img.setVisible(false); this.pool.push(p); continue; }
      p.vy += p.g * step;
      const d = Math.pow(p.drag, step);
      p.vx *= d;
      p.vy *= d;
      p.x += p.vx * step + (p.sway ? Math.sin((p.swayT += dt * 2.2)) * p.sway * step : 0);
      p.y += p.vy * step;
      p.rot += p.spin * step;
      p.img.setPosition(p.x, p.y);
      p.img.setRotation(p.alignVel ? Math.atan2(p.vy, p.vx) : p.rot);
      this.apply(p, t);
      keep.push(p);
    }
    this.live = keep;
  }

  clear() {
    for (const p of this.live) { p.img.setVisible(false); this.pool.push(p); }
    this.live = [];
  }
}
