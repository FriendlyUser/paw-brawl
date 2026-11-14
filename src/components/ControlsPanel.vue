<script setup>
const emit = defineEmits(['close']);
const rows = [
  ['Move', 'W A S D', 'Arrow keys', 'Left stick / D-pad'],
  ['Jump', 'Space or I', 'Numpad 0 or Right Shift', 'X / Y'],
  ['Attack', 'J', 'Numpad 1 or ,', 'A'],
  ['Special', 'K', 'Numpad 2 or .', 'B'],
  ['Shield / Dodge', 'L or Left Shift', 'Numpad 3 or /', 'LB / LT / RT'],
  ['Grab', 'U or ;', 'Numpad 4 or \'', 'RB'],
  ['Smash attack', 'Tap direction + Attack', 'Tap direction + Attack', 'Right stick'],
  ['Pause', 'Esc or P', 'Esc or P', 'Start'],
];
const tips = [
  ['Tilts vs smashes', 'Hold a direction, then Attack for a quick tilt. Tap the direction and Attack together for a chargeable smash.'],
  ['Specials', 'Special alone, or with up, side or down: four signature moves per animal. Up + Special is your recovery.'],
  ['Defense', 'Shield blocks hits. Shield + direction rolls, Shield + down spot-dodges, Shield in the air air-dodges.'],
  ['Platforms', 'Jump up through soft platforms. Hold down for a moment to drop back through. Release jump early for a short hop.'],
  ['Getting back', 'Use your air jumps and Up + Special to grab the ledge. From the ledge: up to climb, Jump to hop, Attack to strike.'],
  ['Percent', 'Damage builds up. The higher it is, the farther you fly. Fly past the edge of the screen and you lose a stock.'],
];
</script>

<template>
  <div class="modal-back" @click.self="emit('close')">
    <div class="panel box">
      <h2 class="display">Controls</h2>
      <table>
        <thead><tr><th /><th>Keyboard 1</th><th>Keyboard 2</th><th>Gamepad</th></tr></thead>
        <tbody>
          <tr v-for="r in rows" :key="r[0]"><td class="act">{{ r[0] }}</td><td v-for="(c, i) in r.slice(1)" :key="i"><kbd>{{ c }}</kbd></td></tr>
        </tbody>
      </table>
      <div class="tips">
        <div v-for="t in tips" :key="t[0]" class="tip"><b>{{ t[0] }}</b><span>{{ t[1] }}</span></div>
      </div>
      <button class="btn gold" @click="emit('close')">Got it</button>
    </div>
  </div>
</template>

<style scoped>
.box { width: min(980px, 94vw); max-height: 92vh; overflow: auto; padding: 22px 28px; text-align: center; }
h2 { margin: 0 0 12px; font-size: 40px; }
table { width: 100%; border-collapse: collapse; font-size: 15px; }
th { color: var(--gold); font-family: var(--display); font-weight: 400; font-size: 18px; padding: 6px; }
td { padding: 5px 6px; border-top: 1px solid rgba(255, 255, 255, 0.08); }
td.act { text-align: left; color: var(--muted); }
.tips { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 10px; margin: 18px 0; text-align: left; }
.tip { background: rgba(0, 0, 0, 0.2); border-radius: 12px; padding: 10px 12px; font-size: 14px; font-weight: 700; line-height: 1.35; }
.tip b { display: block; font-family: var(--display); font-weight: 400; color: var(--gold); font-size: 17px; margin-bottom: 2px; }
</style>
