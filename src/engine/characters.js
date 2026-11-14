// The roster: stats, tuning and signature specials for each animal.
// Speeds are px/frame at 60 fps; weight works like Smash weight (100 = average).
import { hb } from './moves.js';

const multi = (from, n, step, len, x, y, r, dmg, ang, bkb) =>
  Array.from({ length: n }, (_, i) => hb(from + i * step, from + i * step + len, x, y, r, dmg, ang, bkb, 0, { group: i + 1 }));

export const CHARACTERS = {
  bear: {
    id: 'bear',
    name: 'Bruno',
    species: 'Brown Bear',
    tagline: 'Slow to anger. Slower to fly.',
    style: 'Heavyweight bruiser',
    stats: { weight: 122, walk: 3.2, run: 6.4, air: 4.2, airAccel: 0.36, gravity: 0.76, fall: 13, ffall: 19, jump: 17.5, shortHop: 11, airJump: 16.5, airJumps: 1, height: 150, width: 66 },
    tuning: { power: 1.06, reach: 1.05, speed: 0.93 },
    rating: { power: 5, speed: 2, weight: 5, recovery: 2 },
    specials: {
      nspec: { frames: 44, anim: 'lob', sfx: 'throw', proj: [{ f: 16, type: 'honey', x: 30, y: -110 }], label: 'Honey Lob' },
      sspec: { frames: 52, anim: 'rush', sfx: 'heavy', once: 'side', armor: [8, 24, 85], vel: [{ f: [8, 24], vx: 14.5, vy: -0.4 }, { f: 26, vx: 3 }], grav: { from: 8, to: 26, g: 0.1 }, hit: [hb(9, 24, 42, -66, 44, 12, 40, 55, 75)], label: 'Bear Rush' },
      uspec: { frames: 52, anim: 'leap', sfx: 'heavy', helpless: true, ledgeFrom: 14, vel: [{ f: 6, vy: -21.5, vxIn: 4.5 }], hit: [hb(6, 16, 20, -132, 46, 10, 85, 55, 62)], label: 'Mighty Leap' },
      dspec: { frames: 50, anim: 'pound', sfx: 'heavy', loopLand: { from: 12, to: 14, land: 20 }, vel: [{ f: 4, vy: -6 }, { f: 11, vx: 0, vy: 25 }], hit: [hb(12, 14, 0, -20, 36, 8, 270, 20, 60), hb(21, 24, 74, -18, 42, 12, 60, 50, 75, { group: 2 }), hb(21, 24, -74, -18, 42, 12, 120, 50, 75, { group: 2 })], label: 'Ground Pound' },
    },
  },
  cat: {
    id: 'cat',
    name: 'Mika',
    species: 'Calico Cat',
    tagline: 'Nine lives, zero patience.',
    style: 'Speedy combo artist',
    stats: { weight: 90, walk: 4.1, run: 9.4, air: 5.4, airAccel: 0.55, gravity: 0.82, fall: 14, ffall: 21, jump: 18, shortHop: 11.5, airJump: 17, airJumps: 1, height: 118, width: 50 },
    tuning: { power: 1.13, reach: 1.1, speed: 1.2 },
    rating: { power: 2, speed: 5, weight: 2, recovery: 3 },
    specials: {
      nspec: { frames: 36, anim: 'lob', sfx: 'throw', proj: [{ f: 12, type: 'yarn', x: 30, y: -70 }], label: 'Yarn Ball' },
      sspec: { frames: 42, anim: 'pounce', sfx: 'mid', once: 'side', vel: [{ f: 6, vx: 16, vy: -6 }], grav: { from: 6, to: 18, g: 0.5 }, hit: [hb(7, 18, 40, -56, 36, 9, 45, 42, 72)], label: 'Pounce' },
      uspec: { frames: 46, anim: 'spinup', sfx: 'mid', helpless: true, ledgeFrom: 10, vel: [{ f: 4, vy: -19.5, vxIn: 4 }], hit: [...multi(4, 4, 4, 3, 0, -72, 46, 2, 90, 32), hb(22, 26, 0, -84, 54, 5, 80, 55, 90, { group: 9 })], label: 'Nine Lives Spin' },
      dspec: { frames: 46, anim: 'counter', sfx: 'none', counter: [5, 24], label: 'Hiss Counter' },
      counterHit: { frames: 34, anim: 'counterhit', sfx: 'heavy', intan: [1, 20], noPower: true, hit: [hb(5, 9, 52, -66, 48, 10, 361, 60, 75)] },
    },
  },
  rabbit: {
    id: 'rabbit',
    name: 'Pip',
    species: 'Lop Rabbit',
    tagline: 'Hops first, asks never.',
    style: 'Aerial acrobat',
    stats: { weight: 86, walk: 3.8, run: 8.2, air: 4.7, airAccel: 0.45, gravity: 0.62, fall: 11.5, ffall: 17, jump: 21, shortHop: 12, airJump: 18, airJumps: 2, height: 130, width: 48 },
    tuning: { power: 0.96, reach: 1, speed: 1.08 },
    rating: { power: 3, speed: 4, weight: 2, recovery: 5 },
    overrides: {
      fair: { frames: 38, anim: 'fair', sfx: 'mid', aerial: true, landLag: 12, hit: [hb(8, 9, 60, -58, 34, 4, 70, 30, 20, { group: 1 }), hb(13, 15, 66, -60, 38, 9, 42, 32, 96, { group: 2 })] },
    },
    specials: {
      nspec: { frames: 30, anim: 'lob', sfx: 'throw', proj: [{ f: 10, type: 'carrot', x: 34, y: -84 }], label: 'Carrot Dart' },
      sspec: { frames: 44, anim: 'dropkick', sfx: 'mid', once: 'side', vel: [{ f: 8, vx: 14, vy: -3 }], grav: { from: 8, to: 22, g: 0.3 }, hit: [hb(9, 20, 48, -42, 36, 11, 38, 45, 80)], label: 'Drop Kick' },
      uspec: { frames: 64, anim: 'copter', sfx: 'mid', helpless: true, ledgeFrom: 8, vel: [{ f: 4, vy: -13.5, vxIn: 5.5 }], grav: { from: 4, to: 44, g: 0.16 }, hit: [...multi(6, 4, 6, 3, 0, -150, 36, 2, 90, 26), hb(30, 34, 0, -150, 42, 4, 80, 50, 80, { group: 9 })], label: 'Ear Copter' },
      dspec: { frames: 40, anim: 'stompdive', sfx: 'heavy', loopLand: { from: 12, to: 14, land: 22 }, vel: [{ f: 10, vx: 7, vy: 17 }], hit: [hb(10, 14, 20, -6, 36, 10, 290, 30, 70), hb(23, 26, 62, -14, 36, 7, 80, 50, 60, { group: 2 }), hb(23, 26, -62, -14, 36, 7, 100, 50, 60, { group: 2 })], label: 'Thump Dive' },
    },
  },
  frog: {
    id: 'frog',
    name: 'Tadeo',
    species: 'Tree Frog',
    tagline: 'All tongue, all the time.',
    style: 'Long-range zoner',
    stats: { weight: 92, walk: 3.4, run: 7.2, air: 4.8, airAccel: 0.5, gravity: 0.7, fall: 12.5, ffall: 19, jump: 19.5, shortHop: 12, airJump: 17.5, airJumps: 1, height: 120, width: 62 },
    tuning: { power: 1, reach: 1.05, speed: 1 },
    rating: { power: 3, speed: 3, weight: 3, recovery: 4 },
    specials: {
      nspec: { frames: 46, anim: 'tongue', sfx: 'tongue', tongue: { from: 10, to: 24 }, hit: [hb(14, 19, 250, -96, 30, 10, 361, 32, 78), hb(14, 19, 190, -96, 26, 8, 361, 30, 70), hb(14, 19, 130, -96, 26, 7, 361, 30, 65), hb(14, 19, 72, -96, 26, 6, 361, 30, 60)], label: 'Tongue Lash' },
      sspec: { frames: 38, anim: 'lob', sfx: 'bubble', proj: [{ f: 14, type: 'bubble', x: 44, y: -80 }], label: 'Bubble Spit' },
      uspec: { frames: 44, anim: 'springhop', sfx: 'jump', helpless: true, ledgeFrom: 12, vel: [{ f: 5, vy: -24.5, vxIn: 4 }], hit: [hb(5, 10, 0, -6, 38, 7, 280, 30, 60)], label: 'Spring Hop' },
      dspec: { frames: 50, anim: 'bellyflop', sfx: 'heavy', loopLand: { from: 12, to: 14, land: 22 }, vel: [{ f: 4, vy: -8 }, { f: 11, vx: 0, vy: 22 }], hit: [hb(23, 27, 0, -40, 96, 11, 70, 55, 72)], label: 'Belly Flop' },
    },
  },
  rhino: {
    id: 'rhino',
    name: 'Rocco',
    species: 'White Rhino',
    tagline: 'Has never once used the brakes.',
    style: 'Armored juggernaut',
    stats: { weight: 135, walk: 2.8, run: 6.8, air: 3.8, airAccel: 0.3, gravity: 0.86, fall: 14, ffall: 20, jump: 17, shortHop: 10.5, airJump: 16, airJumps: 1, height: 156, width: 76 },
    tuning: { power: 1.15, reach: 1.05, speed: 0.88 },
    rating: { power: 5, speed: 1, weight: 5, recovery: 2 },
    specials: {
      nspec: { frames: 38, anim: 'snort', sfx: 'snort', hit: [hb(10, 18, 76, -52, 54, 4, 15, 75, 8)], label: 'Dust Snort' },
      sspec: { frames: 66, anim: 'stampede', sfx: 'heavy', once: 'side', armor: [6, 42, 95], vel: [{ f: [10, 42], vx: 13 }, { f: 43, vx: 3 }], grav: { from: 10, to: 42, g: 0.35 }, hit: [hb(10, 42, 60, -58, 44, 14, 40, 60, 80)], label: 'Stampede' },
      uspec: { frames: 52, anim: 'hornup', sfx: 'heavy', helpless: true, ledgeFrom: 14, vel: [{ f: 6, vy: -21.5, vxIn: 4 }], hit: [hb(6, 14, 30, -142, 44, 13, 80, 55, 75)], label: 'Horn Uppercut' },
      dspec: { frames: 56, anim: 'quake', sfx: 'heavy', loopLand: { from: 14, to: 16, land: 22 }, vel: [{ f: 12, vy: 24 }], hit: [hb(23, 27, 0, -32, 52, 13, 88, 60, 70), hb(23, 27, 112, -12, 52, 13, 85, 60, 70), hb(23, 27, -112, -12, 52, 13, 95, 60, 70)], label: 'Quake Stomp' },
    },
  },
  owl: {
    id: 'owl',
    name: 'Sage',
    species: 'Horned Owl',
    tagline: 'Who? You. Off the stage.',
    style: 'Floaty sky dancer',
    stats: { weight: 85, walk: 3.0, run: 6.6, air: 5, airAccel: 0.5, gravity: 0.5, fall: 9, ffall: 14, jump: 16, shortHop: 10, airJump: 13.5, airJumps: 4, height: 128, width: 56 },
    tuning: { power: 1.04, reach: 1.08, speed: 1.04 },
    rating: { power: 3, speed: 3, weight: 1, recovery: 5 },
    specials: {
      nspec: { frames: 36, anim: 'wingshot', sfx: 'throw', proj: [{ f: 12, type: 'feather', x: 30, y: -80, ang: 9 }, { f: 12, type: 'feather', x: 30, y: -80, ang: 0 }, { f: 12, type: 'feather', x: 30, y: -80, ang: -9 }], label: 'Feather Volley' },
      sspec: { frames: 46, anim: 'swoop', sfx: 'mid', once: 'side', vel: [{ f: [8, 24], vx: 14, vy: 5 }], grav: { from: 8, to: 24, g: 0 }, hit: [hb(8, 24, 42, -42, 40, 9, 45, 45, 70)], label: 'Swoop' },
      uspec: { frames: 48, anim: 'updraft', sfx: 'wind', helpless: true, ledgeFrom: 10, vel: [{ f: 4, vy: -22, vxIn: 5 }], hit: [hb(4, 10, 0, -80, 52, 4, 90, 50, 30)], label: 'Updraft' },
      dspec: { frames: 40, anim: 'screech', sfx: 'screech', reflect: [8, 20, 120], hit: [hb(10, 16, 0, -70, 100, 5, 361, 50, 40)], label: 'Screech' },
    },
  },
};

export const ROSTER = Object.keys(CHARACTERS);
