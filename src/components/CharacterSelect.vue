<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { store, ROSTER, CHARACTERS, SLOT_COLORS, slotLabel, activeSlots, fixPalettes } from '../store.js';
import { fullBodyURL, PALETTES } from '../art/animals.js';
import { connectedPads } from '../game/controls.js';
import { sfx } from '../audio/sfx.js';

const emit = defineEmits(['controls']);
const active = ref(store.slots.findIndex((s) => s.type === 'human') >= 0 ? store.slots.findIndex((s) => s.type === 'human') : 0);
const hover = ref(store.slots[active.value].charId === 'random' ? 'bear' : store.slots[active.value].charId);
const cursor = ref(Math.max(0, ROSTER.indexOf(hover.value)));
const pads = ref(connectedPads());
let padTimer = null;

const cards = [...ROSTER.map((id) => ({ id, ...CHARACTERS[id] })), { id: 'random', name: 'Random', species: '???', style: 'Feeling lucky?' }];
const BG = { bear: '#b46a3a', cat: '#e58a3f', rabbit: '#e88aa8', frog: '#4fae4a', rhino: '#7c8a99', owl: '#9b7a4f', random: '#6a5acd' };
const info = computed(() => CHARACTERS[hover.value] ?? null);
const ready = computed(() => activeSlots().length >= 2);
const inputs = computed(() => [
  { id: 'kb1', label: 'Keyboard 1' },
  { id: 'kb2', label: 'Keyboard 2' },
  ...[0, 1, 2, 3].map((i) => ({ id: `pad${i}`, label: pads.value.some((p) => p.index === i) ? `Gamepad ${i + 1}` : `Gamepad ${i + 1} (off)` })),
]);
const LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

function img(slot) { return slot.charId === 'random' ? null : fullBodyURL(slot.charId, slot.palette); }

function pick(id) {
  const s = store.slots[active.value];
  if (s.type === 'off') s.type = active.value === 0 ? 'human' : 'cpu';
  s.charId = id;
  s.palette = 0;
  fixPalettes();
  sfx('menuOk');
  // Move on to the next slot that is still on its default pick.
  const next = store.slots.findIndex((x, i) => i > active.value && x.type !== 'off');
  if (next >= 0) active.value = next;
}

function cycleType(i) {
  const s = store.slots[i];
  const order = ['human', 'cpu', 'off'];
  s.type = order[(order.indexOf(s.type) + 1) % order.length];
  if (s.type === 'human' && i > 0 && s.input === 'kb1' && store.slots.some((o, j) => j !== i && o.type === 'human' && o.input === 'kb1')) s.input = i === 1 ? 'kb2' : `pad${i - 2}`;
  if (s.type === 'cpu' && store.mode === 'training') s.level = 0;
  fixPalettes();
  sfx('menuMove');
  active.value = i;
}

function palette(i, d) {
  const s = store.slots[i];
  if (s.charId === 'random') return;
  const n = PALETTES[s.charId].length;
  s.palette = (s.palette + d + n) % n;
  fixPalettes();
  sfx('menuMove');
}

function back() { sfx('menuBack'); store.screen = 'title'; }
function next() { if (!ready.value) return; sfx('menuOk'); store.screen = 'stage'; }

function onKey(e) {
  const cols = 7;
  if (['ArrowRight', 'KeyD'].includes(e.code)) cursor.value = (cursor.value + 1) % cols;
  else if (['ArrowLeft', 'KeyA'].includes(e.code)) cursor.value = (cursor.value + cols - 1) % cols;
  else if (['KeyJ', 'Space'].includes(e.code)) { pick(cards[cursor.value].id); return; }
  else if (e.code === 'Enter') { if (ready.value) next(); else pick(cards[cursor.value].id); return; }
  else if (e.code === 'Escape') { back(); return; }
  else if (e.code === 'Tab') { e.preventDefault(); active.value = (active.value + 1) % 4; return; }
  else return;
  hover.value = cards[cursor.value].id;
  sfx('menuMove');
}
onMounted(() => {
  window.addEventListener('keydown', onKey);
  padTimer = setInterval(() => (pads.value = connectedPads()), 1000);
});
onBeforeUnmount(() => { window.removeEventListener('keydown', onKey); clearInterval(padTimer); });
</script>

<template>
  <div class="select">
    <header>
      <button class="btn ghost small" @click="back">◀ Back</button>
      <h1 class="display">{{ store.mode === 'training' ? 'Training' : 'Choose your fighter' }}</h1>
      <div class="rules" v-if="store.mode !== 'training'">
        <span>Stocks</span>
        <button v-for="n in [1, 2, 3, 4, 5]" :key="n" class="chip" :class="{ on: store.rules.stocks === n }" @click="store.rules.stocks = n">{{ n }}</button>
        <span>Time</span>
        <button v-for="t in [0, 3, 5, 7]" :key="t" class="chip" :class="{ on: store.rules.time === t * 60 }" @click="store.rules.time = t * 60">{{ t ? t + 'm' : '∞' }}</button>
      </div>
      <button class="btn ghost small" @click="emit('controls')">Controls</button>
    </header>

    <div class="roster">
      <button v-for="(c, i) in cards" :key="c.id" class="card" :class="{ hot: cursor === i }" :style="{ '--bg': BG[c.id] }"
        @mouseenter="hover = c.id; cursor = i" @click="pick(c.id)">
        <img v-if="c.id !== 'random'" :src="fullBodyURL(c.id, 0)" :alt="c.name" />
        <div v-else class="q display">?</div>
        <div class="name display">{{ c.name }}</div>
        <div class="species">{{ c.species }}</div>
        <div class="marks">
          <span v-for="(s, j) in store.slots" v-show="s.type !== 'off' && s.charId === c.id" :key="j" class="mark" :style="{ background: SLOT_COLORS[j] }">{{ slotLabel(j) }}</span>
        </div>
      </button>
    </div>

    <div class="info panel" v-if="info">
      <div class="who">
        <div class="display big">{{ info.name }} <small>the {{ info.species }}</small></div>
        <div class="line">"{{ info.tagline }}" · {{ info.style }}</div>
      </div>
      <div class="bars">
        <div v-for="(v, k) in info.rating" :key="k" class="bar"><span>{{ k }}</span><i v-for="n in 5" :key="n" :class="{ on: n <= v }" /></div>
      </div>
      <div class="specials">
        <div v-for="(k, lab) in { 'Neutral': 'nspec', 'Side': 'sspec', 'Up': 'uspec', 'Down': 'dspec' }" :key="k"><b>{{ lab }}</b> {{ info.specials[k].label }}</div>
      </div>
    </div>
    <div class="info panel empty" v-else><div class="display big">Random</div><div class="line">A surprise animal every match.</div></div>

    <div class="slots">
      <div v-for="(s, i) in store.slots" :key="i" class="slot" :class="{ off: s.type === 'off', act: active === i }" :style="{ '--pc': SLOT_COLORS[i] }" @click="active = i">
        <div class="top">
          <span class="lab display">{{ s.type === 'off' ? '—' : slotLabel(i) }}</span>
          <button class="btn small type" @click.stop="cycleType(i)">{{ s.type === 'human' ? 'Player' : s.type === 'cpu' ? 'CPU' : 'Off' }}</button>
        </div>
        <template v-if="s.type !== 'off'">
          <div class="portrait">
            <button class="arrow" @click.stop="palette(i, -1)" title="Previous color">‹</button>
            <img v-if="img(s)" :src="img(s)" :alt="s.charId" />
            <div v-else class="q display">?</div>
            <button class="arrow" @click.stop="palette(i, 1)" title="Next color">›</button>
          </div>
          <div class="cname display">{{ s.charId === 'random' ? 'Random' : CHARACTERS[s.charId].name }}</div>
          <select v-if="s.type === 'human'" v-model="s.input" @click.stop>
            <option v-for="o in inputs" :key="o.id" :value="o.id">{{ o.label }}</option>
          </select>
          <div v-else class="lvl" @click.stop>
            <span>Level</span>
            <button v-for="l in LEVELS" :key="l" class="chip" :class="{ on: s.level === l }" @click="s.level = l">{{ l === 0 ? 'D' : l }}</button>
          </div>
        </template>
        <div v-else class="join">Click "Off" to add a fighter</div>
      </div>
    </div>

    <div class="go" :class="{ show: ready }">
      <span class="display">Ready to brawl!</span>
      <button class="btn gold" @click="next">Pick a stage ▶</button>
    </div>
  </div>
</template>

<style scoped>
.select { position: fixed; inset: 0; display: grid; grid-template-rows: auto auto auto 1fr auto; gap: 1.2vh; padding: 1.6vh 2vw; }
header { display: flex; align-items: center; gap: 16px; }
h1 { margin: 0; font-size: clamp(26px, 3.4vw, 46px); flex: 1; text-shadow: 0 4px 0 rgba(0, 0, 0, 0.35); }
.rules { display: flex; align-items: center; gap: 6px; font-size: 14px; color: var(--muted); }
.rules span { margin-left: 10px; }
.chip { font-family: var(--body); font-weight: 900; font-size: 14px; min-width: 32px; padding: 4px 8px; border-radius: 9px; border: 2px solid rgba(255, 255, 255, 0.2); background: rgba(255, 255, 255, 0.06); color: #fff; cursor: pointer; }
.chip.on { background: var(--gold); color: #3a1d00; border-color: #fff; }
.roster { display: grid; grid-template-columns: repeat(7, 1fr); gap: 1vw; }
.card { position: relative; height: clamp(150px, 25vh, 260px); border-radius: 18px; border: 4px solid rgba(0, 0, 0, 0.35); background: radial-gradient(circle at 50% 30%, color-mix(in srgb, var(--bg) 70%, white) 0%, var(--bg) 55%, color-mix(in srgb, var(--bg) 60%, black) 100%); cursor: pointer; overflow: hidden; color: #fff; transition: transform 0.12s ease, box-shadow 0.12s ease; box-shadow: 0 6px 0 rgba(0, 0, 0, 0.4); }
.card:hover, .card.hot { transform: translateY(-6px) rotate(-1deg); box-shadow: 0 12px 0 rgba(0, 0, 0, 0.4), 0 0 0 4px #fff; }
.card img { position: absolute; left: 50%; bottom: 22%; height: 78%; transform: translateX(-50%); filter: drop-shadow(0 4px 0 rgba(0, 0, 0, 0.25)); transition: transform 0.2s; }
.card:hover img { transform: translateX(-50%) scale(1.06); }
.card .q { position: absolute; inset: 0 0 20% 0; display: grid; place-items: center; font-size: 90px; color: rgba(255, 255, 255, 0.85); }
.card .name { position: absolute; left: 0; right: 0; bottom: 8%; font-size: clamp(18px, 1.8vw, 28px); text-shadow: 0 3px 0 rgba(0, 0, 0, 0.45); }
.card .species { position: absolute; left: 0; right: 0; bottom: 2%; font-size: 12px; opacity: 0.85; }
.marks { position: absolute; top: 8px; right: 8px; display: flex; flex-direction: column; gap: 4px; }
.mark { font-family: var(--display); font-size: 14px; padding: 2px 8px; border-radius: 8px; border: 2px solid #fff; }
.info { display: grid; grid-template-columns: 1.3fr 1fr 1.2fr; gap: 20px; align-items: center; padding: 10px 20px; }
.info.empty { display: block; }
.big { font-size: clamp(22px, 2.4vw, 34px); }
.big small { font-family: var(--body); font-size: 15px; color: var(--muted); }
.line { color: var(--muted); font-size: 14px; }
.bars { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; }
.bar { display: flex; align-items: center; gap: 4px; font-size: 13px; text-transform: capitalize; }
.bar span { width: 70px; color: var(--muted); }
.bar i { width: 18px; height: 10px; border-radius: 4px; background: rgba(255, 255, 255, 0.12); }
.bar i.on { background: var(--gold); }
.specials { display: grid; grid-template-columns: 1fr 1fr; gap: 3px 12px; font-size: 14px; }
.specials b { color: var(--gold); font-family: var(--display); font-weight: 400; margin-right: 4px; }
.slots { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1vw; min-height: 0; }
.slot { position: relative; border-radius: 18px; padding: 10px; background: linear-gradient(180deg, color-mix(in srgb, var(--pc) 35%, var(--card2)), var(--card)); border: 4px solid color-mix(in srgb, var(--pc) 70%, black); display: flex; flex-direction: column; align-items: center; gap: 6px; min-height: 0; cursor: pointer; transition: transform 0.15s, box-shadow 0.15s; }
.slot.act { box-shadow: 0 0 0 4px #fff, 0 0 30px color-mix(in srgb, var(--pc) 70%, transparent); transform: translateY(-3px); }
.slot.off { background: rgba(255, 255, 255, 0.04); border-color: rgba(255, 255, 255, 0.15); border-style: dashed; }
.top { display: flex; width: 100%; justify-content: space-between; align-items: center; }
.lab { font-size: 30px; color: var(--pc); text-shadow: 0 3px 0 rgba(0, 0, 0, 0.5); }
.portrait { flex: 1; min-height: 0; width: 100%; display: flex; align-items: center; justify-content: center; }
.portrait img { height: 100%; max-height: 22vh; min-height: 0; object-fit: contain; filter: drop-shadow(0 4px 0 rgba(0, 0, 0, 0.3)); }
.portrait .q { font-size: 80px; }
.arrow { background: rgba(0, 0, 0, 0.25); border: none; color: #fff; font-size: 26px; width: 32px; height: 48px; border-radius: 10px; cursor: pointer; }
.cname { font-size: 24px; }
select { font-family: var(--body); font-weight: 800; font-size: 14px; padding: 4px 8px; border-radius: 8px; border: 2px solid rgba(255, 255, 255, 0.3); background: #1d1540; color: #fff; }
.lvl { display: flex; flex-wrap: wrap; gap: 3px; justify-content: center; align-items: center; font-size: 12px; color: var(--muted); }
.lvl .chip { min-width: 24px; padding: 2px 4px; font-size: 12px; }
.join { margin: auto; color: var(--muted); font-size: 14px; }
.go { display: flex; align-items: center; justify-content: center; gap: 24px; padding: 8px; border-radius: 16px; background: linear-gradient(90deg, transparent, rgba(255, 197, 49, 0.25), transparent); opacity: 0.35; transition: opacity 0.2s; }
.go.show { opacity: 1; }
.go .display { font-size: 30px; color: var(--gold); text-shadow: 0 3px 0 rgba(0, 0, 0, 0.4); }
@media (max-width: 900px) { .roster { grid-template-columns: repeat(4, 1fr); } .info { grid-template-columns: 1fr; } .rules { display: none; } }
</style>
