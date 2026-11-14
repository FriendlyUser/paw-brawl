// Stage geometry, in world pixels. y grows downward; the main ground top sits at y = 0.
// solids: blocks you stand on and cannot pass through (their top corners are ledges).
// platforms: one-way soft platforms (drop through with down). `move` makes one drift.

export const STAGES = {
  grove: {
    id: 'grove',
    name: 'Canopy Grove',
    blurb: 'A treetop arena with three branch platforms. Balanced and classic.',
    blast: { left: -1450, right: 1450, top: -1100, bottom: 760 },
    cam: { left: -1050, right: 1050, top: -760, bottom: 420 },
    solids: [{ x1: -560, x2: 560, y: 0, y2: 240 }],
    platforms: [
      { x1: -430, x2: -170, y: -190 },
      { x1: 170, x2: 430, y: -190 },
      { x1: -130, x2: 130, y: -370 },
    ],
    spawns: [-380, 380, -140, 140],
    respawnY: -520,
    friction: 1,
  },
  savanna: {
    id: 'savanna',
    name: 'Sunset Mesa',
    blurb: 'A long red-rock mesa under a burning sky. Room to run, nowhere to hide.',
    blast: { left: -1600, right: 1600, top: -1100, bottom: 760 },
    cam: { left: -1200, right: 1200, top: -700, bottom: 420 },
    solids: [{ x1: -700, x2: 700, y: 0, y2: 260 }],
    platforms: [
      { x1: -500, x2: -250, y: -180 },
      { x1: 250, x2: 500, y: -180 },
    ],
    spawns: [-450, 450, -160, 160],
    respawnY: -480,
    friction: 1,
  },
  glacier: {
    id: 'glacier',
    name: 'Glacier Drift',
    blurb: 'Slippery pack ice and one drifting floe. Watch your footing.',
    blast: { left: -1400, right: 1400, top: -1100, bottom: 740 },
    cam: { left: -1000, right: 1000, top: -720, bottom: 420 },
    solids: [{ x1: -520, x2: 520, y: 0, y2: 220 }],
    platforms: [
      { x1: -130, x2: 130, y: -230, move: { amp: 330, period: 540 } },
    ],
    spawns: [-340, 340, -120, 120],
    respawnY: -500,
    friction: 0.35,
  },
};

export const STAGE_LIST = Object.values(STAGES);

/** Live, per-battle copy of a stage: moving platforms update their x each frame. */
export function instantiateStage(id) {
  const def = STAGES[id];
  const platforms = def.platforms.map((p) => ({ ...p, baseX1: p.x1, baseX2: p.x2, dx: 0, soft: true }));
  const solids = def.solids.map((s) => ({ ...s, dx: 0, soft: false }));
  return {
    def,
    solids,
    platforms,
    surfaces: [...solids, ...platforms],
    ledges: solids.flatMap((s) => [
      { solid: s, x: s.x1, y: s.y, side: -1, owner: null },
      { solid: s, x: s.x2, y: s.y, side: 1, owner: null },
    ]),
    update(frame) {
      for (const p of platforms) {
        if (!p.move) continue;
        const off = Math.sin((frame / p.move.period) * Math.PI * 2) * p.move.amp;
        const nx1 = p.baseX1 + off;
        p.dx = nx1 - p.x1;
        p.x1 = nx1;
        p.x2 = p.baseX2 + off;
      }
    },
    get mainLeft() { return Math.min(...solids.map((s) => s.x1)); },
    get mainRight() { return Math.max(...solids.map((s) => s.x2)); },
  };
}
