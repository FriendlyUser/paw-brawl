// Headless CPU-vs-CPU matches: checks the engine never breaks (NaN, stuck states) and that
// matches end with real KOs rather than self-destructs. Usage: node tests/sim.mjs [matches] [level]
import { Battle } from '../src/engine/battle.js';
import { CpuController } from '../src/engine/ai.js';
import { ROSTER } from '../src/engine/characters.js';
import { STAGE_LIST } from '../src/engine/stages.js';

const N = +(process.argv[2] ?? 24);
const LEVEL = +(process.argv[3] ?? 7);
const MAXF = 60 * 60 * 5;
let totals = { kos: 0, sds: 0, frames: 0, unfinished: 0, errors: 0 };
const perChar = Object.fromEntries(ROSTER.map((c) => [c, { wins: 0, games: 0, sds: 0, kos: 0 }]));
const stuck = {};
const allKo = [];
for (let i = 0; i < N; i++) {
  const a = ROSTER[i % ROSTER.length];
  const bId = ROSTER[(i + 1 + Math.floor(i / ROSTER.length)) % ROSTER.length];
  const stage = STAGE_LIST[i % STAGE_LIST.length].id;
  const battle = new Battle({ stageId: stage, seed: 1000 + i, rules: { stocks: 3 }, players: [
    { charId: a, controller: new CpuController(LEVEL), cpu: true },
    { charId: bId, controller: new CpuController(LEVEL), cpu: true },
  ] });
  const stateFrames = new Map();
  const koPct = [];
  const lastDmg = new Map();
  try {
    while (!battle.over && battle.frame < MAXF) {
      battle.step();
      for (const e of battle.drainEvents()) if (e.type === 'ko' && e.credit) koPct.push(lastDmg.get(e.f.slot) ?? 0);
      for (const f of battle.fighters) if (f.state !== 'dead') lastDmg.set(f.slot, f.damage);
      for (const f of battle.fighters) {
        if (![f.x, f.y, f.vx, f.vy, f.kbx, f.kby, f.damage].every(Number.isFinite)) throw new Error(`NaN on ${f.charId} in ${f.state}`);
        const k = f.slot;
        const s = stateFrames.get(k) ?? { state: '', n: 0 };
        if (s.state === f.state && f.state !== 'idle' && f.state !== 'dead' && f.state !== 'respawn' && f.state !== 'walk' && f.state !== 'run') s.n++; else { s.state = f.state; s.n = 0; }
        if (s.n > 900) { stuck[`${f.charId}:${f.state}:${f.move?.name ?? ''}`] = (stuck[`${f.charId}:${f.state}:${f.move?.name ?? ''}`] ?? 0) + 1; s.n = 0; }
        stateFrames.set(k, s);
      }
    }
  } catch (e) { totals.errors++; console.log(`match ${i} ${a} vs ${bId} @${stage}: ERROR`, e.stack.split('\n').slice(0, 4).join(' | ')); continue; }
  const [f1, f2] = battle.fighters;
  totals.frames += battle.frame;
  allKo.push(...koPct);
  if (!battle.over) totals.unfinished++;
  for (const f of battle.fighters) {
    totals.kos += f.record.kos; totals.sds += f.record.sds;
    perChar[f.charId].games++; perChar[f.charId].sds += f.record.sds; perChar[f.charId].kos += f.record.kos;
  }
  if (battle.over) perChar[battle.winner.charId].wins++;
  console.log(`${String(i).padStart(2)} ${a.padEnd(6)} vs ${bId.padEnd(6)} @${stage.padEnd(8)} ${battle.over ? 'winner ' + battle.winner.charId.padEnd(6) : 'TIMEOUT      '} ${(battle.frame / 60).toFixed(0).padStart(4)}s  kos ${f1.record.kos}/${f2.record.kos} sds ${f1.record.sds}/${f2.record.sds} dmg ${f1.record.dealt.toFixed(0)}/${f2.record.dealt.toFixed(0)}`);
}
console.log('\ntotals', { ...totals, avgSec: +(totals.frames / 60 / N).toFixed(1) });
console.log('per char', perChar);
allKo.sort((a, b) => a - b);
console.log('KO %: median', allKo[allKo.length >> 1]?.toFixed(0), 'p25', allKo[allKo.length >> 2]?.toFixed(0), 'p75', allKo[(allKo.length * 3) >> 2]?.toFixed(0));
if (Object.keys(stuck).length) console.log('stuck states (>15s)', stuck);
// Fail CI on engine errors or matches that never finish; balance numbers are informational.
process.exitCode = totals.errors || totals.unfinished > N / 4 ? 1 : 0;
