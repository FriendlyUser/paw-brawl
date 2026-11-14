// Synthesized sound effects and music (Web Audio). No audio files: every sound is
// built from oscillators, filtered noise and envelopes.

let ctx = null;
let master, sfxBus, musicBus, noiseBuf, comp;
const settings = { sfx: 0.8, music: 0.5 };

export function audioReady() { return !!ctx; }

export function unlockAudio() {
  if (typeof window === 'undefined') return;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    master = ctx.createGain();
    master.gain.value = 0.9;
    sfxBus = ctx.createGain();
    musicBus = ctx.createGain();
    sfxBus.connect(comp);
    musicBus.connect(comp);
    comp.connect(master);
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    applyVolumes();
  }
  if (ctx.state === 'suspended') ctx.resume();
}

export function setVolumes({ sfx, music }) {
  if (sfx != null) settings.sfx = sfx;
  if (music != null) settings.music = music;
  applyVolumes();
}

function applyVolumes() {
  if (!ctx) return;
  sfxBus.gain.value = settings.sfx;
  musicBus.gain.value = settings.music * 0.55;
}

function env(g, t, a, peak, dec, sus = 0.0001) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(Math.max(sus, 0.0001), t + a + dec);
}

function tone({ type = 'sine', f0, f1, dur = 0.15, vol = 0.3, a = 0.005, t = 0, bus = sfxBus, detune = 0 }) {
  const now = ctx.currentTime + t;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.detune.value = detune;
  o.frequency.setValueAtTime(f0, now);
  if (f1) o.frequency.exponentialRampToValueAtTime(f1, now + dur);
  env(g, now, a, vol, dur);
  o.connect(g).connect(bus);
  o.start(now);
  o.stop(now + a + dur + 0.05);
}

function noise({ dur = 0.15, vol = 0.3, type = 'bandpass', f0 = 1200, f1, q = 1, a = 0.003, t = 0, bus = sfxBus }) {
  const now = ctx.currentTime + t;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  const fl = ctx.createBiquadFilter();
  fl.type = type;
  fl.Q.value = q;
  fl.frequency.setValueAtTime(f0, now);
  if (f1) fl.frequency.exponentialRampToValueAtTime(f1, now + dur);
  const g = ctx.createGain();
  env(g, now, a, vol, dur);
  s.connect(fl).connect(g).connect(bus);
  s.start(now, Math.random() * 0.8);
  s.stop(now + a + dur + 0.05);
}

const SOUNDS = {
  swing(o) { const h = o.sfx === 'heavy' ? 1 : o.sfx === 'light' ? 0.5 : 0.75; noise({ dur: 0.09 + h * 0.08, vol: 0.12 + h * 0.08, f0: 2600 - h * 900, f1: 700, q: 1.4 }); },
  hit(o) {
    const s = Math.min(1, (o.kb ?? 40) / 160);
    tone({ type: 'sine', f0: 190 - s * 90, f1: 45, dur: 0.12 + s * 0.2, vol: 0.45 + s * 0.35 });
    noise({ dur: 0.05 + s * 0.12, vol: 0.35 + s * 0.3, type: 'lowpass', f0: 4000 + s * 3000, f1: 400 });
    if (s > 0.55) { noise({ dur: 0.4, vol: 0.25, type: 'bandpass', f0: 900, f1: 200, q: 0.7, t: 0.02 }); tone({ type: 'square', f0: 1200, f1: 300, dur: 0.12, vol: 0.06 }); }
    if (o.sfx === 'light') tone({ type: 'triangle', f0: 900, f1: 500, dur: 0.05, vol: 0.12 });
  },
  shieldhit() { tone({ type: 'triangle', f0: 1400, f1: 900, dur: 0.12, vol: 0.18 }); noise({ dur: 0.06, vol: 0.12, f0: 5000, q: 2 }); },
  shieldbreak() { for (let i = 0; i < 6; i++) tone({ type: 'triangle', f0: 1800 - i * 200, f1: 300, dur: 0.25, vol: 0.12, t: i * 0.03 }); noise({ dur: 0.5, vol: 0.3, f0: 3000, f1: 300 }); },
  jump(o) { tone({ type: 'triangle', f0: o.air ? 420 : 300, f1: o.air ? 900 : 640, dur: 0.12, vol: 0.13 }); if (o.air) noise({ dur: 0.12, vol: 0.08, f0: 1800, f1: 3500, q: 1 }); },
  land(o) { const s = Math.min(1, Math.abs(o.impact ?? 6) / 18); noise({ dur: 0.07 + s * 0.08, vol: 0.06 + s * 0.12, type: 'lowpass', f0: 900, f1: 120 }); },
  dash() { noise({ dur: 0.12, vol: 0.1, f0: 1300, f1: 500, q: 0.8 }); },
  dodge() { noise({ dur: 0.18, vol: 0.12, f0: 600, f1: 3000, q: 2 }); },
  ledge() { tone({ type: 'triangle', f0: 600, f1: 500, dur: 0.06, vol: 0.12 }); noise({ dur: 0.05, vol: 0.1, f0: 2000 }); },
  grab() { noise({ dur: 0.08, vol: 0.2, f0: 800, q: 1 }); tone({ type: 'sine', f0: 240, f1: 160, dur: 0.1, vol: 0.2 }); },
  throw() { noise({ dur: 0.18, vol: 0.18, f0: 1500, f1: 400, q: 1 }); },
  proj(o) {
    const t = o.ptype;
    if (t === 'bubble') { tone({ type: 'sine', f0: 300, f1: 900, dur: 0.15, vol: 0.2 }); }
    else if (t === 'feather') noise({ dur: 0.1, vol: 0.12, f0: 3000, f1: 1500, q: 2 });
    else tone({ type: 'triangle', f0: 500, f1: 260, dur: 0.12, vol: 0.14 });
  },
  pop() { tone({ type: 'sine', f0: 700, f1: 1400, dur: 0.06, vol: 0.12 }); },
  ko() {
    tone({ type: 'sine', f0: 120, f1: 30, dur: 1.1, vol: 0.8 });
    noise({ dur: 1.2, vol: 0.55, type: 'lowpass', f0: 3000, f1: 80 });
    tone({ type: 'sawtooth', f0: 880, f1: 110, dur: 0.6, vol: 0.08 });
  },
  star() { [0, 0.07, 0.14].forEach((t, i) => tone({ type: 'triangle', f0: 1200 + i * 300, dur: 0.12, vol: 0.08, t })); },
  counter() { tone({ type: 'square', f0: 1600, f1: 2200, dur: 0.1, vol: 0.08 }); tone({ type: 'triangle', f0: 400, f1: 1600, dur: 0.2, vol: 0.16 }); },
  reflect() { tone({ type: 'square', f0: 2000, f1: 1000, dur: 0.12, vol: 0.07 }); },
  armor() { tone({ type: 'square', f0: 220, f1: 180, dur: 0.1, vol: 0.12 }); },
  charge() { tone({ type: 'triangle', f0: 800, f1: 1400, dur: 0.08, vol: 0.05 }); },
  quake() { tone({ type: 'sine', f0: 90, f1: 35, dur: 0.45, vol: 0.6 }); noise({ dur: 0.4, vol: 0.35, type: 'lowpass', f0: 800, f1: 90 }); },
  bounce() { tone({ type: 'sine', f0: 160, f1: 60, dur: 0.2, vol: 0.4 }); },
  tongue() { tone({ type: 'sine', f0: 200, f1: 900, dur: 0.12, vol: 0.18 }); },
  snort() { noise({ dur: 0.3, vol: 0.3, type: 'lowpass', f0: 1200, f1: 200 }); },
  screech() { tone({ type: 'sawtooth', f0: 1300, f1: 1700, dur: 0.3, vol: 0.06 }); tone({ type: 'square', f0: 1700, f1: 1200, dur: 0.3, vol: 0.04 }); },
  wind() { noise({ dur: 0.4, vol: 0.18, f0: 400, f1: 1800, q: 1.5 }); },
  respawn() { [0, 0.08, 0.16, 0.24].forEach((t, i) => tone({ type: 'triangle', f0: 520 * Math.pow(1.26, i), dur: 0.16, vol: 0.09, t })); },
  beep() { tone({ type: 'square', f0: 660, dur: 0.16, vol: 0.12 }); },
  go() { tone({ type: 'square', f0: 990, dur: 0.4, vol: 0.14 }); tone({ type: 'square', f0: 1320, dur: 0.4, vol: 0.08, t: 0.02 }); },
  game() { [523, 659, 784, 1046].forEach((f, i) => tone({ type: 'square', f0: f, dur: 0.3, vol: 0.1, t: i * 0.09 })); },
  menuMove() { tone({ type: 'triangle', f0: 880, dur: 0.05, vol: 0.08 }); },
  menuOk() { tone({ type: 'triangle', f0: 660, f1: 1320, dur: 0.1, vol: 0.12 }); },
  menuBack() { tone({ type: 'triangle', f0: 660, f1: 330, dur: 0.1, vol: 0.1 }); },
};

export function sfx(name, opts = {}) {
  if (!ctx || ctx.state !== 'running') return;
  const fn = SOUNDS[name];
  if (fn) fn(opts);
}

// ------------------------------------------------------------------ music
// A small step sequencer: bass, chord stabs, arpeggio and drums per theme.
const THEMES = {
  menu: { bpm: 112, root: 57, prog: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [5, 9, 12]], scale: [0, 2, 4, 7, 9], drums: 'light', lead: 'triangle' },
  grove: { bpm: 128, root: 55, prog: [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]], scale: [0, 2, 4, 7, 9], drums: 'drive', lead: 'square' },
  savanna: { bpm: 136, root: 52, prog: [[0, 3, 7], [8, 12, 15], [3, 7, 10], [10, 14, 17]], scale: [0, 3, 5, 7, 10], drums: 'drive', lead: 'sawtooth' },
  glacier: { bpm: 118, root: 50, prog: [[0, 3, 7], [5, 8, 12], [3, 7, 10], [7, 10, 14]], scale: [0, 2, 3, 7, 8], drums: 'half', lead: 'triangle' },
  victory: { bpm: 120, root: 60, prog: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]], scale: [0, 2, 4, 7, 9], drums: 'light', lead: 'square' },
};

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
let seq = null;

export function playMusic(theme) {
  if (!ctx) return;
  if (seq?.theme === theme) return;
  stopMusic();
  const T = THEMES[theme];
  if (!T) return;
  const spb = 60 / T.bpm / 4; // 16th notes
  const bus = ctx.createGain();
  bus.gain.value = 0;
  bus.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.2);
  bus.connect(musicBus);
  let step = 0;
  let next = ctx.currentTime + 0.1;
  let seed = 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const note = (type, m, t, dur, vol, cutoff = 2400) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const fl = ctx.createBiquadFilter();
    fl.type = 'lowpass';
    fl.frequency.value = cutoff;
    o.type = type;
    o.frequency.value = mtof(m);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(fl).connect(g).connect(bus);
    o.start(t);
    o.stop(t + dur + 0.05);
  };
  const drum = (kind, t) => {
    if (kind === 'k') {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.14);
      g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      o.connect(g).connect(bus); o.start(t); o.stop(t + 0.25);
    } else {
      const s = ctx.createBufferSource(); s.buffer = noiseBuf;
      const fl = ctx.createBiquadFilter(); fl.type = kind === 'h' ? 'highpass' : 'bandpass'; fl.frequency.value = kind === 'h' ? 7000 : 1800;
      const g = ctx.createGain(); const v = kind === 'h' ? 0.06 : 0.22; const d = kind === 'h' ? 0.04 : 0.14;
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      s.connect(fl).connect(g).connect(bus); s.start(t, Math.random()); s.stop(t + d + 0.02);
    }
  };
  const tick = () => {
    while (next < ctx.currentTime + 0.15) {
      const bar = Math.floor(step / 16) % T.prog.length;
      const s16 = step % 16;
      const chord = T.prog[bar].map((n) => n + T.root);
      // Bass on 8ths with octave bounce.
      if (s16 % 2 === 0) note('triangle', chord[0] - 12 + (s16 % 4 === 2 ? 12 : 0), next, spb * 1.8, 0.22, 900);
      // Chord stabs on the off-beats.
      if (s16 === 2 || s16 === 6 || s16 === 10 || s16 === 14) chord.forEach((n, i) => note('sawtooth', n + 12, next, spb * 1.2, 0.035, 1800 - i * 200));
      // Arpeggio lead with occasional melodic notes.
      if (s16 % 2 === 1 || (T.drums === 'drive' && rnd() < 0.3)) {
        const deg = T.scale[Math.floor(rnd() * T.scale.length)];
        const m = rnd() < 0.6 ? chord[Math.floor(rnd() * 3)] + 24 : T.root + 24 + deg;
        note(T.lead, m, next, spb * 0.9, T.lead === 'sawtooth' ? 0.025 : 0.045, 3200);
      }
      if (T.drums !== 'none') {
        const kick = T.drums === 'half' ? s16 === 0 || s16 === 10 : s16 % 4 === 0;
        if (kick) drum('k', next);
        if ((T.drums === 'drive' && (s16 === 4 || s16 === 12)) || (T.drums === 'half' && s16 === 8) || (T.drums === 'light' && s16 === 12)) drum('s', next);
        if (s16 % 2 === 0) drum('h', next);
      }
      step++;
      next += spb;
    }
  };
  const id = setInterval(tick, 30);
  tick();
  seq = { theme, id, bus };
}

export function stopMusic() {
  if (!seq || !ctx) { seq = null; return; }
  const { id, bus } = seq;
  clearInterval(id);
  bus.gain.cancelScheduledValues(ctx.currentTime);
  bus.gain.setValueAtTime(bus.gain.value, ctx.currentTime);
  bus.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
  setTimeout(() => bus.disconnect(), 700);
  seq = null;
}
