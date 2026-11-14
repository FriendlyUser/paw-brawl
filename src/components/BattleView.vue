<script setup>
import { ref, reactive, onMounted, onBeforeUnmount, computed } from 'vue';
import Phaser from 'phaser';
import { store, buildMatchConfig, SLOT_COLORS } from '../store.js';
import { createBus } from '../bus.js';
import { BattleScene } from '../game/BattleScene.js';
import { portraitURL, PALETTES } from '../art/animals.js';
import { CHARACTERS } from '../engine/characters.js';
import { sfx } from '../audio/sfx.js';

const host = ref(null);
const bus = createBus();
const cfg = store.lastConfig && store.rematch ? { ...store.lastConfig, seed: Math.floor(Math.random() * 1e9) } : buildMatchConfig();
const q = new URLSearchParams(location.search);
cfg.debug = { warp: +(q.get('warp') ?? 0), ff: +(q.get('ff') ?? 1) };
store.lastConfig = cfg;
store.rematch = false;

const hud = reactive({ players: cfg.players.map((p, i) => ({ slot: i, damage: 0, stocks: cfg.rules.stocks, score: 0, dead: false, out: false, shake: 0, pop: 0, hurt: false, hurtTimer: 0 })) });
const countdown = ref(null);
const banner = ref(null);
const paused = ref(false);
const flash = ref(0);
const timer = ref(cfg.rules.time || null);
let game = null;
let flashTimer = null;

const cards = computed(() => cfg.players.map((p, i) => ({
  ...p,
  name: CHARACTERS[p.charId].name,
  color: SLOT_COLORS[p.colorIdx],
  head: portraitURL(p.charId, p.palette),
  hurt: portraitURL(p.charId, p.palette, 'hurt'),
  h: hud.players[i],
})));

function dmgColor(d) {
  // White → yellow → orange → deep red as damage climbs.
  const t = Math.min(1, d / 160);
  const stops = [[255, 255, 255], [255, 226, 90], [255, 140, 40], [220, 30, 40], [140, 10, 30]];
  const x = t * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  const k = x - i;
  const c = stops[i].map((v, j) => Math.round(v + (stops[i + 1][j] - v) * k));
  return `rgb(${c})`;
}

onMounted(() => {
  bus.on('hud', (data) => data.forEach((d, i) => Object.assign(hud.players[i], d)));
  bus.on('hudhit', ({ slot, dmg }) => {
    const p = hud.players[slot];
    p.shake = Math.min(1, 0.3 + dmg / 18);
    p.pop++;
    p.hurt = true;
    clearTimeout(p.hurtTimer);
    p.hurtTimer = setTimeout(() => { p.hurt = false; }, 650);
  });
  bus.on('countdown', (n) => { countdown.value = n === 0 ? 'GO!' : String(n); setTimeout(() => { if (countdown.value === 'GO!') countdown.value = null; }, n === 0 ? 700 : 2000); });
  bus.on('paused', (v) => { paused.value = v; });
  bus.on('flash', (v) => { flash.value = v; clearTimeout(flashTimer); flashTimer = setTimeout(() => (flash.value = 0), 60); });
  bus.on('timer', (t) => (timer.value = t));
  bus.on('ko', () => {});
  bus.on('game', () => { banner.value = cfg.rules.time ? 'TIME!' : 'GAME!'; });
  bus.on('results', (r) => { store.results = { ...r, cfg }; store.screen = 'results'; });
  game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent: host.value,
    width: 1920,
    height: 1080,
    backgroundColor: '#000000',
    banner: false,
    audio: { noAudio: true },
    input: { keyboard: false, mouse: false, touch: false, gamepad: false },
    render: { antialias: true, powerPreference: 'high-performance', roundPixels: false },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    fps: { smoothStep: true },
  });
  game.scene.add('battle', BattleScene, true, { cfg, bus });
  window.__paw = { game, bus, cfg, get scene() { return game?.scene.getScene('battle'); } };
});

onBeforeUnmount(() => {
  bus.clear();
  game?.destroy(true);
  game = null;
});

function resume() { bus.emit('scene:pause', false); }
function restart() { sfx('menuOk'); store.rematch = true; store.screen = 'title'; requestAnimationFrame(() => (store.screen = 'battle')); }
function quit() { sfx('menuBack'); store.screen = 'select'; }
const fmtTime = (t) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
void PALETTES;
</script>

<template>
  <div class="battle">
    <div class="frame">
      <div ref="host" class="host" />
      <div class="flash" :style="{ opacity: flash }" />
      <div v-if="timer != null" class="timer display" :class="{ low: timer <= 10 }">{{ fmtTime(timer) }}</div>
      <div class="hud">
        <div v-for="c in cards" :key="c.slot ?? c.colorIdx" class="pcard" :class="{ out: c.h.out, dead: c.h.dead }" :style="{ '--pc': c.color }">
          <div class="face" :key="c.h.pop" :class="{ hit: c.h.pop }">
            <img :src="c.h.dead || c.h.hurt ? c.hurt : c.head" alt="" />
          </div>
          <div class="meta">
            <div class="nm display">{{ c.name }} <span class="lab">{{ c.label }}</span></div>
            <div class="pct display" :key="'p' + c.h.pop" :style="{ color: dmgColor(c.h.damage), '--shake': c.h.shake }" :class="{ jolt: c.h.pop }">
              {{ c.h.out ? '—' : c.h.damage }}<small>%</small>
            </div>
            <div class="stocks" v-if="c.h.stocks != null && c.h.stocks <= 6">
              <img v-for="n in Math.max(0, c.h.stocks)" :key="n" :src="c.head" alt="" />
            </div>
            <div class="stocks num" v-else-if="c.h.stocks != null">× {{ c.h.stocks }}</div>
            <div class="stocks num" v-else>{{ c.h.score >= 0 ? '+' : '' }}{{ c.h.score }}</div>
          </div>
        </div>
      </div>
      <Transition name="pop"><div v-if="countdown" :key="countdown" class="count display" :class="{ go: countdown === 'GO!' }">{{ countdown }}</div></Transition>
      <Transition name="pop"><div v-if="banner" class="count display game">{{ banner }}</div></Transition>
      <Transition name="fade">
        <div v-if="paused" class="pause">
          <div class="panel pbox">
            <div class="display ptitle">Paused</div>
            <button class="btn gold" @click="resume">Resume</button>
            <button class="btn" @click="restart">Restart</button>
            <button class="btn red" @click="quit">Quit to fighter select</button>
            <div class="phint">Esc / P / Start to resume</div>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.battle { position: fixed; inset: 0; background: #000; display: grid; place-items: center; }
.frame { position: relative; width: min(100vw, 177.78vh); height: min(56.25vw, 100vh); container-type: size; overflow: hidden; }
.host { position: absolute; inset: 0; }
.host :deep(canvas) { display: block; }
.flash { position: absolute; inset: 0; background: #fff; pointer-events: none; transition: opacity 0.25s ease-out; }
.timer { position: absolute; top: 2cqh; left: 50%; transform: translateX(-50%); font-size: 5cqh; color: #fff; -webkit-text-stroke: 0.12em #1a1020; paint-order: stroke fill; }
.timer.low { color: #ff5a5a; animation: beat 0.5s ease-in-out infinite; }
.hud { position: absolute; left: 0; right: 0; bottom: 2cqh; display: flex; justify-content: center; gap: 2.2cqw; pointer-events: none; }
.pcard { position: relative; display: flex; align-items: center; gap: 0.6cqw; width: 19cqw; height: 13cqh; padding: 0 1cqw 0 0.4cqw; border-radius: 2cqh; background: linear-gradient(180deg, color-mix(in srgb, var(--pc) 55%, #1a1230) 0%, color-mix(in srgb, var(--pc) 25%, #120c24) 100%); border: 0.45cqh solid color-mix(in srgb, var(--pc) 80%, white); box-shadow: 0 0.8cqh 0 rgba(0, 0, 0, 0.45), inset 0 0.4cqh 0 rgba(255, 255, 255, 0.2); transform: skewX(-6deg); transition: opacity 0.3s, filter 0.3s; }
.pcard > * { transform: skewX(6deg); }
.pcard.out { opacity: 0.45; filter: grayscale(1); }
.face { width: 11cqh; height: 11cqh; flex: none; border-radius: 50%; background: radial-gradient(circle at 40% 35%, rgba(255, 255, 255, 0.35), rgba(0, 0, 0, 0.25)); display: grid; place-items: center; overflow: visible; }
.face img { width: 120%; height: 120%; object-fit: contain; filter: drop-shadow(0 0.3cqh 0 rgba(0, 0, 0, 0.35)); }
.face.hit img { animation: wobble 0.35s ease-out; }
.meta { display: flex; flex-direction: column; justify-content: center; min-width: 0; flex: 1; line-height: 1; }
.nm { font-size: 2.2cqh; color: #fff; white-space: nowrap; text-shadow: 0 0.25cqh 0 rgba(0, 0, 0, 0.5); }
.lab { font-size: 1.7cqh; padding: 0.1cqh 0.6cqh; border-radius: 0.6cqh; background: var(--pc); margin-left: 0.4cqw; }
.pct { font-size: 6.4cqh; -webkit-text-stroke: 0.09em #1a1020; paint-order: stroke fill; text-shadow: 0 0.45cqh 0 #1a1020; transform-origin: 30% 60%; }
.pct small { font-size: 0.5em; margin-left: 0.1em; }
.pct.jolt { animation: jolt 0.4s ease-out; }
.stocks { display: flex; gap: 0.3cqw; height: 2.6cqh; margin-top: 0.3cqh; }
.stocks img { height: 100%; filter: drop-shadow(0 0.15cqh 0 rgba(0, 0, 0, 0.5)); }
.stocks.num { font-family: var(--display); font-size: 2.2cqh; color: #fff; }
.count { position: absolute; inset: 0; display: grid; place-items: center; font-size: 26cqh; color: #fff; -webkit-text-stroke: 0.06em #1a1020; paint-order: stroke fill; text-shadow: 0 0.06em 0 #1a1020; pointer-events: none; }
.count.go { color: #ffd84a; }
.count.game { color: #ffd84a; font-size: 22cqh; background: radial-gradient(ellipse at center, rgba(0, 0, 0, 0.35), transparent 60%); }
.pause { position: absolute; inset: 0; background: rgba(10, 6, 25, 0.55); backdrop-filter: blur(3px); display: grid; place-items: center; }
.pbox { display: flex; flex-direction: column; gap: 14px; padding: 26px 34px; min-width: 320px; text-align: center; }
.ptitle { font-size: 54px; margin-bottom: 6px; }
.phint { font-size: 13px; color: var(--muted); }
.pop-enter-active { animation: popin 0.35s cubic-bezier(.2, 1.8, .4, 1); }
.pop-leave-active { transition: opacity 0.25s, transform 0.25s; }
.pop-leave-to { opacity: 0; transform: scale(1.4); }
@keyframes popin { from { transform: scale(2.4); opacity: 0; } }
@keyframes jolt {
  0% { transform: scale(calc(1 + var(--shake) * 0.5)) rotate(calc(var(--shake) * -8deg)); }
  25% { transform: translate(calc(var(--shake) * 0.8cqh), calc(var(--shake) * -0.5cqh)) rotate(calc(var(--shake) * 6deg)); }
  50% { transform: translate(calc(var(--shake) * -0.6cqh), calc(var(--shake) * 0.4cqh)); }
  100% { transform: none; }
}
@keyframes wobble { 0% { transform: rotate(-14deg) scale(1.1); } 50% { transform: rotate(8deg); } 100% { transform: none; } }
@keyframes beat { 50% { transform: translateX(-50%) scale(1.12); } }
</style>
