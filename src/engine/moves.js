// Move data. Positions are for a nominal 140px-tall fighter facing right (y up is
// negative); buildMoveset scales them to each animal's size and reach.
// Hitbox: f = active frames [first, last], x/y/r circle, dmg %, ang (degrees,
// 0 = forward, 90 = up, 270 = down, 361 = auto), bkb/kbg = base / growth knockback.

export function hb(a, b, x, y, r, dmg, ang, bkb, kbg, extra = {}) {
  return { f: [a, b], x, y, r, dmg, ang, bkb, kbg, ...extra };
}

/** The shared moveset template every animal starts from. */
export const TEMPLATE = {
  jab1: { frames: 16, anim: 'jab', sfx: 'light', hit: [hb(3, 4, 44, -84, 26, 2.5, 80, 10, 22)], next: { move: 'jab2', window: [5, 16] } },
  jab2: { frames: 16, anim: 'jab2', sfx: 'light', hit: [hb(3, 4, 48, -80, 26, 2.5, 80, 10, 22)], next: { move: 'jab3', window: [5, 16] } },
  jab3: { frames: 30, anim: 'jabfin', sfx: 'mid', hit: [hb(5, 8, 54, -76, 32, 5, 40, 45, 80)] },
  ftilt: { frames: 28, anim: 'ftilt', sfx: 'mid', hit: [hb(7, 10, 64, -62, 30, 9, 361, 26, 92), hb(7, 10, 30, -62, 26, 8, 361, 24, 90)] },
  utilt: { frames: 28, anim: 'utilt', sfx: 'mid', hit: [hb(6, 12, 12, -152, 38, 7.5, 88, 32, 100), hb(6, 12, 36, -112, 28, 7, 95, 30, 95)] },
  dtilt: { frames: 20, anim: 'dtilt', sfx: 'light', crouch: true, hit: [hb(5, 8, 60, -14, 28, 6, 72, 34, 60)] },
  dashatk: { frames: 34, anim: 'dashatk', sfx: 'mid', slide: 0.93, hit: [hb(6, 14, 42, -60, 38, 9, 55, 50, 70)] },
  fsmash: { frames: 48, anim: 'fsmash', sfx: 'heavy', charge: 9, hit: [hb(14, 17, 74, -68, 40, 15, 361, 36, 100), hb(14, 17, 34, -68, 30, 13, 361, 32, 95)] },
  usmash: { frames: 46, anim: 'usmash', sfx: 'heavy', charge: 8, hit: [hb(12, 17, 0, -164, 46, 14, 90, 36, 98), hb(12, 17, 22, -104, 34, 12, 85, 34, 95)] },
  dsmash: { frames: 46, anim: 'dsmash', sfx: 'heavy', charge: 7, hit: [hb(11, 13, 64, -14, 34, 13, 28, 32, 96), hb(11, 13, -64, -14, 34, 13, 152, 32, 96)] },
  nair: { frames: 36, anim: 'nair', sfx: 'mid', aerial: true, landLag: 8, hit: [hb(5, 10, 0, -66, 52, 9, 361, 28, 90), hb(11, 22, 0, -66, 48, 5, 361, 20, 70)] },
  fair: { frames: 36, anim: 'fair', sfx: 'mid', aerial: true, landLag: 14, hit: [hb(10, 13, 62, -62, 38, 11, 45, 30, 95)] },
  bair: { frames: 32, anim: 'bair', sfx: 'mid', aerial: true, landLag: 12, hit: [hb(8, 11, -64, -64, 38, 12, 145, 32, 98)] },
  uair: { frames: 30, anim: 'uair', sfx: 'mid', aerial: true, landLag: 10, hit: [hb(6, 10, 0, -154, 42, 9, 85, 30, 95)] },
  dair: { frames: 40, anim: 'dair', sfx: 'heavy', aerial: true, landLag: 20, hit: [hb(14, 16, 0, 6, 36, 13, 270, 25, 80), hb(17, 26, 0, 0, 32, 8, 80, 25, 60)] },
  grab: { frames: 30, anim: 'grab', grab: { f: [6, 8], x: 52, y: -64, r: 32 } },
  dashgrab: { frames: 36, anim: 'grab', slide: 0.9, grab: { f: [8, 10], x: 62, y: -64, r: 34 } },
  fthrow: { frames: 30, anim: 'fthrow', throwType: 'f', throw: { f: 12, dmg: 8, ang: 40, bkb: 62, kbg: 70 } },
  bthrow: { frames: 34, anim: 'bthrow', throwType: 'b', throw: { f: 16, dmg: 10, ang: 140, bkb: 60, kbg: 80 } },
  uthrow: { frames: 32, anim: 'uthrow', throwType: 'u', throw: { f: 12, dmg: 7, ang: 90, bkb: 70, kbg: 65 } },
  dthrow: { frames: 30, anim: 'dthrow', throwType: 'd', throw: { f: 14, dmg: 6, ang: 82, bkb: 52, kbg: 42 } },
  ledgeatk: { frames: 34, anim: 'ledgeatk', sfx: 'mid', intan: [1, 12], hit: [hb(12, 15, 52, -30, 36, 7, 361, 45, 50)] },
};

/** Projectiles. vx/vy are launch speeds facing right; g is gravity. */
export const PROJECTILES = {
  honey: { vx: 9, vy: -11, g: 0.55, r: 24, life: 120, max: 1, dmg: 9, ang: 60, bkb: 45, kbg: 60, bounces: 0, spin: 0.08 },
  yarn: { vx: 10.5, vy: -3, g: 0.35, r: 19, life: 110, max: 2, dmg: 6, ang: 45, bkb: 30, kbg: 50, bounces: 2, spin: 0.25 },
  carrot: { vx: 16, vy: 0, g: 0, r: 16, life: 55, max: 3, dmg: 5, ang: 20, bkb: 22, kbg: 30, bounces: 0, spin: 0 },
  bubble: { vx: 5, vy: -0.6, g: -0.015, r: 28, life: 150, max: 2, dmg: 7, ang: 85, bkb: 50, kbg: 45, bounces: 0, spin: 0, wobble: true },
  feather: { vx: 14, vy: 0, g: 0, r: 13, life: 50, max: 6, dmg: 3.5, ang: 30, bkb: 16, kbg: 35, bounces: 0, spin: 0 },
};

const FRAME_KEYS = ['frames', 'iasa', 'charge'];

/** Template + the animal's overrides, scaled to its size, reach, power and speed. */
export function buildMoveset(char) {
  const { height } = char.stats;
  const { power = 1, reach = 1, speed = 1 } = char.tuning ?? {};
  const s = height / 140;
  const all = { ...structuredClone(TEMPLATE), ...structuredClone(char.overrides ?? {}), ...structuredClone(char.specials) };
  const fr = (v) => Math.max(1, Math.round(v / speed));
  for (const [name, m] of Object.entries(all)) {
    m.name = name;
    for (const k of FRAME_KEYS) if (m[k] != null) m[k] = fr(m[k]);
    if (m.next) m.next.window = m.next.window.map(fr);
    for (const h of m.hit ?? []) {
      h.f = h.f.map(fr);
      h.x *= s * reach;
      h.y *= s;
      h.r *= s * Math.sqrt(reach);
      h.dmg = Math.round(h.dmg * (m.noPower ? 1 : power) * 10) / 10;
    }
    if (m.grab) { m.grab.f = m.grab.f.map(fr); m.grab.x *= s * reach; m.grab.y *= s; m.grab.r *= s; }
    if (m.throw) { m.throw.f = fr(m.throw.f); m.throw.dmg = Math.round(m.throw.dmg * power); }
    for (const v of m.vel ?? []) v.f = Array.isArray(v.f) ? v.f.map(fr) : [fr(v.f), fr(v.f)];
    for (const p of m.proj ?? []) { p.f = fr(p.f); p.x *= s; p.y *= s; }
    for (const k of ['armor', 'intan', 'counter', 'reflect']) if (m[k]) m[k] = [fr(m[k][0]), fr(m[k][1]), m[k][2]];
    if (m.grav) m.grav = { ...m.grav, from: fr(m.grav.from), to: fr(m.grav.to) };
    if (m.loopLand) for (const k of ['from', 'to', 'land']) m.loopLand[k] = fr(m.loopLand[k]);
    if (m.ledgeFrom) m.ledgeFrom = fr(m.ledgeFrom);
    if (m.tongue) m.tongue = { from: fr(m.tongue.from), to: fr(m.tongue.to) };
    // The frame the first hitbox comes out: used for swing sounds and smears.
    const starts = (m.hit ?? []).map((h) => h.f[0]);
    m.firstActive = starts.length ? Math.min(...starts) : null;
  }
  return all;
}
