// App-wide state: the current screen, settings (saved), match setup and results.
import { reactive, watch } from 'vue';
import { ROSTER, CHARACTERS } from './engine/characters.js';
import { PALETTES } from './art/animals.js';
import { setVolumes } from './audio/sfx.js';

const saved = (() => {
  try { return JSON.parse(localStorage.getItem('pawbrawl.settings') ?? '{}'); } catch { return {}; }
})();

export const store = reactive({
  screen: 'title',
  mode: 'versus',
  settings: { music: 0.5, sfx: 0.8, tapJump: false, ...saved.settings },
  rules: { stocks: 3, time: 0, ...saved.rules },
  slots: saved.slots ?? [
    { type: 'human', input: 'kb1', charId: 'bear', palette: 0, level: 5 },
    { type: 'cpu', input: 'kb2', charId: 'cat', palette: 0, level: 5 },
    { type: 'off', input: 'pad0', charId: 'rabbit', palette: 0, level: 5 },
    { type: 'off', input: 'pad1', charId: 'frog', palette: 0, level: 5 },
  ],
  stageId: saved.stageId ?? 'grove',
  results: null,
  lastConfig: null,
});

watch(() => [store.settings, store.rules, store.slots, store.stageId], () => {
  try {
    localStorage.setItem('pawbrawl.settings', JSON.stringify({ settings: store.settings, rules: store.rules, slots: store.slots, stageId: store.stageId }));
  } catch { /* storage unavailable */ }
  setVolumes(store.settings);
}, { deep: true, immediate: true });

export const SLOT_COLORS = ['#ff4d5e', '#3d8bff', '#ffc531', '#3ccf6e'];

export function slotLabel(i, slot = store.slots[i]) {
  return slot.type === 'cpu' ? 'CPU' : `P${i + 1}`;
}

export function activeSlots() {
  return store.slots.map((s, i) => ({ ...s, index: i })).filter((s) => s.type !== 'off');
}

/** Two players on the same animal get different palettes. */
export function fixPalettes() {
  const used = new Map();
  store.slots.forEach((s) => {
    if (s.type === 'off') return;
    const n = PALETTES[s.charId].length;
    const taken = used.get(s.charId) ?? new Set();
    let p = s.palette % n;
    for (let k = 0; k < n && taken.has(p); k++) p = (p + 1) % n;
    s.palette = p;
    taken.add(p);
    used.set(s.charId, taken);
  });
}

export function buildMatchConfig() {
  fixPalettes();
  const players = activeSlots().map((s) => ({
    charId: s.charId === 'random' ? ROSTER[Math.floor(Math.random() * ROSTER.length)] : s.charId,
    palette: s.palette,
    type: s.type,
    input: s.input,
    level: s.level,
    colorIdx: s.index,
    label: slotLabel(s.index, s),
  }));
  const stageId = store.stageId === 'random' ? ['grove', 'savanna', 'glacier'][Math.floor(Math.random() * 3)] : store.stageId;
  const rules = store.mode === 'training' ? { stocks: 99, time: 0 } : { ...store.rules };
  return { players, stageId, rules, settings: { ...store.settings }, seed: Math.floor(Math.random() * 1e9) };
}

export { ROSTER, CHARACTERS };
