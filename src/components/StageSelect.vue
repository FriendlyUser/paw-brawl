<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { store } from '../store.js';
import { STAGE_LIST } from '../engine/stages.js';
import { stageThumbURL } from '../art/stages.js';
import { sfx } from '../audio/sfx.js';

const thumbs = ref({});
const stages = [...STAGE_LIST, { id: 'random', name: 'Random', blurb: 'Let fate pick the battlefield.' }];
const focus = ref(Math.max(0, stages.findIndex((s) => s.id === store.stageId)));

onMounted(() => {
  // Paint thumbnails one per frame so the screen appears immediately.
  STAGE_LIST.forEach((s, i) => setTimeout(() => { thumbs.value = { ...thumbs.value, [s.id]: stageThumbURL(s) }; }, 30 + i * 40));
  window.addEventListener('keydown', onKey);
});
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));

function choose(id) {
  sfx('menuOk');
  store.stageId = id;
  store.screen = 'battle';
}
function onKey(e) {
  if (['ArrowRight', 'KeyD'].includes(e.code)) { focus.value = (focus.value + 1) % stages.length; sfx('menuMove'); }
  else if (['ArrowLeft', 'KeyA'].includes(e.code)) { focus.value = (focus.value + stages.length - 1) % stages.length; sfx('menuMove'); }
  else if (['Enter', 'KeyJ', 'Space'].includes(e.code)) choose(stages[focus.value].id);
  else if (['Escape', 'KeyK'].includes(e.code)) { sfx('menuBack'); store.screen = 'select'; }
}
</script>

<template>
  <div class="stage">
    <header>
      <button class="btn ghost small" @click="store.screen = 'select'">◀ Back</button>
      <h1 class="display">Choose a stage</h1>
    </header>
    <div class="grid">
      <button v-for="(s, i) in stages" :key="s.id" class="sc" :class="{ hot: focus === i }" @mouseenter="focus = i" @click="choose(s.id)">
        <div class="pic">
          <img v-if="thumbs[s.id]" :src="thumbs[s.id]" :alt="s.name" />
          <div v-else-if="s.id === 'random'" class="q display">?</div>
          <div v-else class="loading" />
        </div>
        <div class="nm display">{{ s.name }}</div>
        <div class="bl">{{ s.blurb }}</div>
      </button>
    </div>
  </div>
</template>

<style scoped>
.stage { position: fixed; inset: 0; padding: 2vh 3vw; display: flex; flex-direction: column; gap: 3vh; }
header { display: flex; gap: 16px; align-items: center; }
h1 { margin: 0; font-size: clamp(28px, 3.6vw, 52px); text-shadow: 0 4px 0 rgba(0, 0, 0, 0.35); }
.grid { flex: 1; display: grid; grid-template-columns: repeat(2, 1fr); gap: 2.4vw; align-content: center; max-width: 1400px; width: 100%; margin: 0 auto; }
.sc { border: 4px solid rgba(0, 0, 0, 0.4); border-radius: 22px; padding: 0 0 12px; background: var(--card); color: #fff; cursor: pointer; overflow: hidden; box-shadow: 0 8px 0 rgba(0, 0, 0, 0.4); transition: transform 0.12s, box-shadow 0.12s; text-align: left; }
.sc.hot { transform: translateY(-6px); box-shadow: 0 14px 0 rgba(0, 0, 0, 0.4), 0 0 0 5px var(--gold); }
.pic { aspect-ratio: 16 / 9; max-height: 30vh; width: 100%; background: linear-gradient(135deg, #3a2a7a, #1b1338); display: grid; place-items: center; overflow: hidden; }
.pic img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.4s; }
.sc.hot .pic img { transform: scale(1.05); }
.q { font-size: 110px; color: rgba(255, 255, 255, 0.8); }
.loading { width: 40px; height: 40px; border-radius: 50%; border: 5px solid rgba(255, 255, 255, 0.2); border-top-color: #fff; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.nm { font-size: 30px; padding: 8px 16px 0; }
.bl { font-size: 15px; color: var(--muted); padding: 0 16px; }
</style>
