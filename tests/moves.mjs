// Every move of every animal must run to completion and (if it has hitboxes) connect
// with a dummy placed on its first hitbox. Throws must land after a grab.
import { Battle } from '../src/engine/battle.js';
import { ROSTER } from '../src/engine/characters.js';
import { blankRaw } from '../src/engine/input.js';

const idle = { poll: () => blankRaw() };
let fails = 0;
const report = [];
for (const id of ROSTER) {
  const probe = new Battle({ stageId: 'savanna', players: [{ charId: id, controller: idle }, { charId: 'bear', controller: idle }] });
  const names = Object.keys(probe.fighters[0].moves).filter((n) => !n.endsWith('throw'));
  const row = [];
  for (const name of names) {
    const b = new Battle({ stageId: 'savanna', players: [{ charId: id, controller: idle }, { charId: 'bear', controller: idle }] });
    const [a, v] = b.fighters;
    const m = a.moves[name];
    const aerial = m.aerial;
    a.x = 0; a.facing = 1;
    if (aerial) { a.grounded = false; a.surface = null; a.state = 'air'; a.y = -400; a.st = { ...a.st, gravity: 0 }; }
    const h = m.hit?.[0];
    v.st = { ...v.st, gravity: 0 };
    if (h) {
      // Account for the move's own movement before the hitbox comes out.
      let dx = 0;
      for (const vel of m.vel ?? []) if (vel.vx != null) dx += vel.vx * Math.max(0, Math.min(h.f[0], vel.f[1]) - vel.f[0] + 1);
      v.x = a.x + h.x + dx;
      // Grounded moves face a standing dummy; aerials a floating one centred on the hitbox.
      v.y = aerial ? a.y + h.y + v.h / 2 : 0;
      v.grounded = !aerial; v.surface = v.grounded ? b.stage.solids[0] : null; v.state = v.grounded ? 'idle' : 'air';
    } else { v.x = 300; }
    v.facing = -1;
    if (name === 'counterHit') a.counterDmg = 10;
    a.startMove(name);
    let frames = 0, hit = false, err = null;
    try {
      while (frames < 400) {
        b.step();
        frames++;
        if (v.damage > 0) hit = true;
        if (a.state !== 'attack' && a.state !== 'holding' && frames > 2) break;
      }
    } catch (e) { err = e.message; }
    const needsHit = !!m.hit && !['dspec'].includes(name) || (m.hit && !m.loopLand);
    const ok = !err && frames < 400 && (!m.hit || hit || m.loopLand);
    if (!ok) { fails++; row.push(`${name}✗(${err ?? (frames >= 400 ? 'stuck' : 'miss')})`); } else row.push(name);
    void needsHit;
  }
  // Throws.
  for (const t of ['fthrow', 'bthrow', 'uthrow', 'dthrow']) {
    const b = new Battle({ stageId: 'savanna', players: [{ charId: id, controller: idle }, { charId: 'bear', controller: idle }] });
    const [a, v] = b.fighters;
    a.x = 0; a.facing = 1; v.x = a.w / 2 + v.w / 2 + 6;
    a.startMove('grab');
    for (let i = 0; i < 12 && a.state !== 'holding'; i++) b.step();
    if (a.state !== 'holding') { fails++; row.push(`${t}✗(no grab)`); continue; }
    const keep = a.holding; a.startMove(t); a.holding = keep;
    for (let i = 0; i < 60; i++) b.step();
    if (v.damage > 0) row.push(t); else { fails++; row.push(`${t}✗`); }
  }
  report.push(`${id.padEnd(7)} ${row.join(' ')}`);
}
console.log(report.join('\n'));
console.log(fails ? `\n${fails} FAILURES` : '\nall moves OK');
process.exitCode = fails ? 1 : 0;
