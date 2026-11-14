<script setup>
import { onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { store } from './store.js';
import { unlockAudio, playMusic } from './audio/sfx.js';
import { getPad } from './game/controls.js';
import TitleScreen from './components/TitleScreen.vue';
import CharacterSelect from './components/CharacterSelect.vue';
import StageSelect from './components/StageSelect.vue';
import BattleView from './components/BattleView.vue';
import ResultsScreen from './components/ResultsScreen.vue';
import ControlsPanel from './components/ControlsPanel.vue';
import SettingsPanel from './components/SettingsPanel.vue';

const modal = ref(null);

// Gamepads in menus: d-pad / stick become arrow keys, A = Enter, B = Escape, Start = Enter.
const padPrev = {};
let padRaf = 0;
function pollMenuPads() {
  padRaf = requestAnimationFrame(pollMenuPads);
  if (store.screen === 'battle') return;
  for (let i = 0; i < 4; i++) {
    const p = getPad(i);
    if (!p) continue;
    const ax = p.axes[0] ?? 0, ay = p.axes[1] ?? 0;
    const now = {
      ArrowLeft: p.buttons[14]?.pressed || ax < -0.6, ArrowRight: p.buttons[15]?.pressed || ax > 0.6,
      ArrowUp: p.buttons[12]?.pressed || ay < -0.6, ArrowDown: p.buttons[13]?.pressed || ay > 0.6,
      Enter: p.buttons[0]?.pressed || p.buttons[9]?.pressed, Escape: p.buttons[1]?.pressed,
    };
    const prev = padPrev[i] ?? {};
    for (const [code, down] of Object.entries(now)) {
      if (down && !prev[code]) { unlock(); window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code })); }
    }
    padPrev[i] = now;
  }
}
const battleKey = ref(0);

const unlock = () => {
  unlockAudio();
  if (store.screen !== 'battle') playMusic(store.screen === 'results' ? 'victory' : 'menu');
};

watch(() => store.screen, (s) => {
  if (s === 'battle') battleKey.value++;
  else playMusic(s === 'results' ? 'victory' : 'menu');
});

// Test hook: ?quick=1&p1=bear&p2=cat&cpu1=7&cpu2=7&stage=grove jumps straight into a fight.
onMounted(() => {
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
  padRaf = requestAnimationFrame(pollMenuPads);
  const q = new URLSearchParams(location.search);
  if (q.get('screen')) store.screen = q.get('screen');
  if (q.get('quick')) {
    const chars = [q.get('p1') ?? 'bear', q.get('p2') ?? 'cat', q.get('p3'), q.get('p4')];
    chars.forEach((c, i) => {
      const s = store.slots[i];
      if (!c) { s.type = 'off'; return; }
      s.charId = c;
      const lv = q.get(`cpu${i + 1}`);
      s.type = lv != null ? 'cpu' : 'human';
      if (lv != null) s.level = +lv;
      s.input = i === 0 ? 'kb1' : 'kb2';
    });
    store.stageId = q.get('stage') ?? 'grove';
    if (q.get('stocks')) store.rules.stocks = +q.get('stocks');
    store.screen = 'battle';
  }
});
onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', unlock);
  window.removeEventListener('keydown', unlock);
  cancelAnimationFrame(padRaf);
});
</script>

<template>
  <Transition name="fade" mode="out-in">
    <TitleScreen v-if="store.screen === 'title'" @controls="modal = 'controls'" @settings="modal = 'settings'" />
    <CharacterSelect v-else-if="store.screen === 'select'" @controls="modal = 'controls'" />
    <StageSelect v-else-if="store.screen === 'stage'" />
    <BattleView v-else-if="store.screen === 'battle'" :key="battleKey" />
    <ResultsScreen v-else-if="store.screen === 'results'" />
  </Transition>
  <Transition name="fade">
    <ControlsPanel v-if="modal === 'controls'" @close="modal = null" />
    <SettingsPanel v-else-if="modal === 'settings'" @close="modal = null" />
  </Transition>
</template>
