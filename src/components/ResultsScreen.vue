<script setup>
import { computed, onMounted, onBeforeUnmount } from 'vue';
import { store, SLOT_COLORS } from '../store.js';
import { fullBodyURL, portraitURL } from '../art/animals.js';
import { CHARACTERS } from '../engine/characters.js';
import { sfx } from '../audio/sfx.js';

const r = store.results;
const players = computed(() => r.ranking.map((slot, place) => {
  const p = r.cfg.players[slot];
  const st = r.players[slot];
  return { place: place + 1, slot, ...p, ...st, name: CHARACTERS[p.charId].name, color: SLOT_COLORS[p.colorIdx], head: portraitURL(p.charId, p.palette) };
}));
const winner = computed(() => (r.winner != null ? players.value.find((p) => p.slot === r.winner) : null));
const confetti = Array.from({ length: 60 }, (_, i) => ({ left: `${(i * 53) % 100}%`, delay: `${(i % 12) * 0.25}s`, dur: `${2.6 + (i % 5) * 0.5}s`, color: ['#ff4d5e', '#3d8bff', '#ffc531', '#3ccf6e', '#ffffff', '#b28dff'][i % 6], rot: `${(i * 47) % 360}deg` }));

function rematch() { sfx('menuOk'); store.rematch = true; store.screen = 'battle'; }
function onKey(e) {
  if (e.code === 'Enter' || e.code === 'KeyJ') rematch();
  else if (e.code === 'Escape') { sfx('menuBack'); store.screen = 'select'; }
}
onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <div class="results">
    <div class="rays" :style="{ '--wc': winner?.color ?? '#ffc531' }" />
    <div v-for="(c, i) in confetti" :key="i" class="conf" :style="{ left: c.left, animationDelay: c.delay, animationDuration: c.dur, background: c.color, rotate: c.rot }" />
    <div class="hero" v-if="winner">
      <img :src="fullBodyURL(winner.charId, winner.palette)" :alt="winner.name" />
      <div class="wins display" :style="{ color: winner.color }">{{ winner.name }} wins!</div>
      <div class="sub">{{ winner.label }} · {{ CHARACTERS[winner.charId].tagline }}</div>
    </div>
    <div class="hero" v-else><div class="wins display">No contest</div></div>
    <div class="table">
      <div v-for="p in players" :key="p.slot" class="row panel" :style="{ '--pc': p.color }">
        <div class="place display">{{ p.place }}</div>
        <img :src="p.head" alt="" class="hd" />
        <div class="who"><div class="display">{{ p.name }}</div><div class="lab">{{ p.label }}</div></div>
        <div class="stat"><b>{{ p.kos }}</b><span>KOs</span></div>
        <div class="stat"><b>{{ p.falls }}</b><span>Falls</span></div>
        <div class="stat"><b>{{ Math.round(p.dealt) }}%</b><span>Dealt</span></div>
        <div class="stat"><b>{{ Math.round(p.taken) }}%</b><span>Taken</span></div>
        <div class="stat"><b>{{ p.maxCombo }}</b><span>Best combo</span></div>
        <div class="stat"><b>{{ p.sds }}</b><span>Self-KOs</span></div>
      </div>
    </div>
    <div class="actions">
      <button class="btn gold" @click="rematch">Rematch</button>
      <button class="btn" @click="store.screen = 'select'">Fighter select</button>
      <button class="btn ghost" @click="store.screen = 'title'">Title</button>
    </div>
  </div>
</template>

<style scoped>
.results { position: fixed; inset: 0; overflow: hidden; display: flex; flex-direction: column; align-items: center; padding: 2vh 3vw; gap: 2vh; }
.rays { position: absolute; left: 50%; top: 30%; width: 220vmax; height: 220vmax; transform: translate(-50%, -50%); background: repeating-conic-gradient(from 0deg, color-mix(in srgb, var(--wc) 22%, transparent) 0deg 10deg, transparent 10deg 20deg); animation: turn 40s linear infinite; z-index: -1; }
@keyframes turn { to { transform: translate(-50%, -50%) rotate(360deg); } }
.conf { position: absolute; top: -20px; width: 10px; height: 16px; border-radius: 2px; animation: fall linear infinite; opacity: 0.9; }
@keyframes fall { to { transform: translateY(110vh) rotate(720deg); } }
.hero { display: flex; flex-direction: column; align-items: center; animation: rise 0.6s cubic-bezier(.2, 1.5, .4, 1) both; }
.hero img { height: 34vh; filter: drop-shadow(0 10px 0 rgba(0, 0, 0, 0.3)); animation: hop 1.2s ease-in-out infinite; }
@keyframes hop { 50% { transform: translateY(-16px); } }
@keyframes rise { from { transform: translateY(30vh) scale(0.6); opacity: 0; } }
.wins { font-size: clamp(40px, 7vh, 84px); -webkit-text-stroke: 0.08em #1a1020; paint-order: stroke fill; text-shadow: 0 0.08em 0 #1a1020; }
.sub { color: var(--muted); font-size: 16px; }
.table { display: flex; flex-direction: column; gap: 8px; width: min(1100px, 100%); }
.row { display: grid; grid-template-columns: 50px 60px 1.4fr repeat(6, 1fr); align-items: center; gap: 10px; padding: 6px 16px; border-color: var(--pc); border-radius: 16px; }
.place { font-size: 34px; color: var(--pc); }
.hd { width: 56px; height: 56px; object-fit: contain; }
.who .display { font-size: 24px; }
.lab { font-size: 13px; color: var(--muted); }
.stat { display: flex; flex-direction: column; align-items: center; }
.stat b { font-family: var(--display); font-weight: 400; font-size: 24px; }
.stat span { font-size: 12px; color: var(--muted); }
.actions { display: flex; gap: 16px; margin-top: auto; }
@media (max-width: 800px) { .row { grid-template-columns: 40px 48px 1fr repeat(3, 1fr); } .stat:nth-child(n + 7) { display: none; } }
</style>
