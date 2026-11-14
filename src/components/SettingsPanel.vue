<script setup>
import { store } from '../store.js';
import { sfx } from '../audio/sfx.js';
const emit = defineEmits(['close']);
</script>

<template>
  <div class="modal-back" @click.self="emit('close')">
    <div class="panel box">
      <h2 class="display">Settings</h2>
      <label>Music <input v-model.number="store.settings.music" type="range" min="0" max="1" step="0.05" /> <span>{{ Math.round(store.settings.music * 100) }}%</span></label>
      <label>Sound effects <input v-model.number="store.settings.sfx" type="range" min="0" max="1" step="0.05" @change="sfx('hit', { kb: 80 })" /> <span>{{ Math.round(store.settings.sfx * 100) }}%</span></label>
      <label class="check"><input v-model="store.settings.tapJump" type="checkbox" /> Tap jump (Up also jumps)</label>
      <button class="btn gold" @click="emit('close')">Done</button>
    </div>
  </div>
</template>

<style scoped>
.box { width: min(520px, 92vw); padding: 24px 30px; display: flex; flex-direction: column; gap: 18px; }
h2 { margin: 0; font-size: 40px; text-align: center; }
label { display: grid; grid-template-columns: 150px 1fr 50px; align-items: center; gap: 12px; font-size: 18px; }
label.check { grid-template-columns: auto 1fr; }
input[type='range'] { accent-color: var(--gold); width: 100%; }
input[type='checkbox'] { width: 22px; height: 22px; accent-color: var(--gold); }
</style>
