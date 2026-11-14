<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { store, ROSTER } from '../store.js';
import { fullBodyURL } from '../art/animals.js';
import { sfx } from '../audio/sfx.js';

const emit = defineEmits(['controls', 'settings']);
const animals = ROSTER.map((id, i) => ({ id, src: fullBodyURL(id, 0), delay: `${i * 0.18}s` }));
const items = [
  { label: 'Versus', sub: 'Up to 4 fighters, humans or CPUs', act: () => go('versus') },
  { label: 'Training', sub: 'Practice on a dummy, no stocks lost', act: () => go('training') },
  { label: 'Controls', sub: 'Keyboard and gamepad layouts', act: () => emit('controls') },
  { label: 'Settings', sub: 'Volume and tap-jump', act: () => emit('settings') },
];
const focus = ref(0);
const paws = Array.from({ length: 14 }, (_, i) => ({ left: `${(i * 37) % 100}%`, delay: `${(i * 1.3) % 9}s`, dur: `${9 + (i % 5) * 2}s`, size: `${22 + (i % 4) * 10}px` }));

function go(mode) {
  sfx('menuOk');
  store.mode = mode;
  if (mode === 'training') {
    store.slots[1].type = 'cpu';
    store.slots[1].level = 0;
  } else if (store.slots[1].type === 'cpu' && store.slots[1].level === 0) store.slots[1].level = 5;
  store.screen = 'select';
}

function onKey(e) {
  if (['ArrowDown', 'KeyS'].includes(e.code)) { focus.value = (focus.value + 1) % items.length; sfx('menuMove'); }
  else if (['ArrowUp', 'KeyW'].includes(e.code)) { focus.value = (focus.value + items.length - 1) % items.length; sfx('menuMove'); }
  else if (['Enter', 'KeyJ', 'Space'].includes(e.code)) items[focus.value].act();
}
onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <div class="title">
    <div class="sky" />
    <div class="sun" />
    <div v-for="(p, i) in paws" :key="i" class="floatpaw" :style="{ left: p.left, animationDelay: p.delay, animationDuration: p.dur, fontSize: p.size }">🐾</div>
    <div class="logo">
      <div class="word paw display">PAW</div>
      <div class="word brawl display">BRAWL</div>
      <div class="tag">Six animals. Three stages. Zero mercy.</div>
    </div>
    <nav class="menu">
      <button v-for="(it, i) in items" :key="it.label" class="btn" :class="{ focus: focus === i, gold: i === 0 }" @mouseenter="focus = i" @click="it.act()">
        {{ it.label }}
        <span class="sub">{{ it.sub }}</span>
      </button>
    </nav>
    <div class="hill" />
    <div class="parade left">
      <img v-for="a in animals.slice(0, 3)" :key="a.id" :src="a.src" :alt="a.id" :style="{ animationDelay: a.delay }" />
    </div>
    <div class="parade right">
      <img v-for="a in animals.slice(3)" :key="a.id" :src="a.src" :alt="a.id" :style="{ animationDelay: a.delay }" />
    </div>
    <div class="hint">Arrows / WASD to choose, Enter to select</div>
  </div>
</template>

<style scoped>
.title { position: fixed; inset: 0; overflow: hidden; }
.sky { position: absolute; inset: 0; background: linear-gradient(180deg, #2b1d63 0%, #6c3fb3 38%, #ff8f6b 72%, #ffd27a 100%); }
.sun { position: absolute; left: 50%; bottom: 18%; width: 46vmin; height: 46vmin; transform: translateX(-50%); border-radius: 50%; background: radial-gradient(circle, #fff3b0 0%, #ffcf5a 45%, rgba(255, 160, 80, 0) 70%); animation: pulse 6s ease-in-out infinite; }
.floatpaw { position: absolute; bottom: -60px; opacity: 0.18; animation: rise linear infinite; filter: grayscale(1) brightness(2); }
@keyframes rise { to { transform: translateY(-115vh) rotate(40deg); } }
@keyframes pulse { 50% { transform: translateX(-50%) scale(1.05); } }
.logo { position: absolute; top: 6vh; left: 0; right: 0; text-align: center; animation: drop 0.8s cubic-bezier(.2, 1.6, .4, 1) both; }
.word { line-height: 0.85; color: #fff; -webkit-text-stroke: 0.06em #2a1040; paint-order: stroke fill; text-shadow: 0 0.08em 0 #2a1040, 0 0.16em 0.3em rgba(0, 0, 0, 0.35); }
.paw.display { font-size: 13vmin; transform: rotate(-4deg); display: inline-block; color: #ffd84a; }
.brawl { font-size: 17vmin; transform: rotate(-4deg); color: #fff4dc; text-shadow: 0 0.06em 0 #ff9b4a, 0 0.11em 0 #2a1040, 0 0.2em 0.35em rgba(0, 0, 0, 0.35); }
.tag { margin-top: 3vh; font-size: 2.3vmin; letter-spacing: 0.2em; text-transform: uppercase; color: #fff; text-shadow: 0 2px 0 rgba(0, 0, 0, 0.4); }
@keyframes drop { from { transform: translateY(-40vh); } }
.menu { position: absolute; left: 50%; top: 50vh; transform: translateX(-50%); display: flex; flex-direction: column; gap: 12px; width: min(420px, 80vw); z-index: 3; }
.menu .btn { display: flex; flex-direction: column; align-items: center; font-size: 28px; padding: 10px 20px; }
.menu .sub { font-family: var(--body); font-size: 13px; letter-spacing: 0.02em; opacity: 0.85; text-shadow: none; }
.hill { position: absolute; left: -10%; right: -10%; bottom: -24vh; height: 42vh; border-radius: 50%; background: radial-gradient(ellipse at 50% 0%, #7ed957 0%, #3f9c3a 60%, #276b2a 100%); box-shadow: inset 0 10px 0 rgba(255, 255, 255, 0.25); }
.parade { position: absolute; bottom: 4vh; width: calc(50vw - min(240px, 22vw)); display: flex; justify-content: space-evenly; align-items: flex-end; z-index: 2; pointer-events: none; }
.parade.left { left: 0; }
.parade.right { right: 0; }
.parade img { height: min(20vh, 13vw); animation: bob 1.4s ease-in-out infinite; filter: drop-shadow(0 6px 0 rgba(0, 0, 0, 0.15)); }
@keyframes bob { 50% { transform: translateY(-14px) rotate(-3deg); } }
.hint { position: absolute; bottom: 1.2vh; width: 100%; text-align: center; font-size: 13px; opacity: 0.75; z-index: 3; }
@media (max-height: 700px) { .menu .sub { display: none; } .menu .btn { font-size: 22px; } }
</style>
