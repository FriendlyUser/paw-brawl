# Paw Brawl

A platform fighter in the spirit of the party brawlers: six animals knock each other
off floating stages. Built with **Phaser 3** (rendering) and **Vue 3** (menus and HUD).
All art, music and sound are generated in code; there are no asset files.

## Run it

```bash
npm install
npm run dev        # http://localhost:8790
npm run build      # static build in dist/ (relative paths, host anywhere)
```

From WSL with only the Windows Node install, use `tools/npm.sh install`,
`tools/npm.sh run build`, and `tools/node.sh <script>`.

## The roster

| Animal | Style | Signature specials (neutral / side / up / down) |
| --- | --- | --- |
| Bruno, brown bear | Heavyweight bruiser | Honey Lob, Bear Rush (armored), Mighty Leap, Ground Pound |
| Mika, calico cat | Speedy combo artist | Yarn Ball, Pounce, Nine Lives Spin, Hiss Counter |
| Pip, lop rabbit | Aerial acrobat (3 jumps) | Carrot Dart, Drop Kick, Ear Copter, Thump Dive |
| Tadeo, tree frog | Long-range zoner | Tongue Lash, Bubble Spit, Spring Hop (spikes), Belly Flop |
| Rocco, white rhino | Armored juggernaut | Dust Snort, Stampede (armored), Horn Uppercut, Quake Stomp |
| Sage, horned owl | Floaty sky dancer (5 jumps) | Feather Volley, Swoop, Updraft, Screech (reflects projectiles) |

Stages: **Canopy Grove** (three branch platforms), **Sunset Mesa** (wide, two
platforms), **Glacier Drift** (slippery ice, one drifting floe).

## Controls

| Action | Keyboard 1 | Keyboard 2 | Gamepad |
| --- | --- | --- | --- |
| Move | WASD | Arrows | Stick / D-pad |
| Jump | Space, I | Numpad 0, Right Shift | X / Y |
| Attack | J | Numpad 1, `,` | A |
| Special | K | Numpad 2, `.` | B |
| Shield / dodge | L, Left Shift | Numpad 3, `/` | LB / LT / RT |
| Grab | U, `;` | Numpad 4, `'` | RB |
| Smash attack | tap direction + attack | same | right stick |
| Pause | Esc, P | Esc, P | Start |

Hold a direction then attack for a tilt; press direction and attack together for a
chargeable smash. Up + Special is every animal's recovery. Tap jump can be turned on
in Settings.

## How it fits together

```
src/engine/   pure game logic, no Phaser: runs headless in Node
  battle.js     match loop, hit resolution, knockback, grabs, projectiles, KOs
  fighter.js    per-fighter state machine, physics, ledges, shield/dodges
  moves.js      shared moveset template + projectile data, scaled per animal
  characters.js roster stats, tuning and signature specials
  ai.js         CPU levels 0-9 (0 = training dummy), outputs controller input
  stages.js     stage geometry: solids, soft/moving platforms, blast zones
src/art/      Canvas2D painters: animals (puppet parts + portraits), stages, effects
src/game/     Phaser layer: BattleScene (fixed 60 Hz step + interpolated render,
              camera, effects), rig.js (puppet posing), particles.js, controls.js
src/audio/    Web Audio synth: sound effects and a small step-sequenced soundtrack
src/components/ Vue screens: title, fighter select, stage select, battle HUD, results
```

The engine steps at a fixed 60 Hz; the renderer interpolates positions between steps
and eases puppet poses toward per-state targets, so motion stays smooth on any refresh
rate. Knockback follows the classic formula (damage, weight and percent), with hitlag,
DI, launch decay, smoke trails and a slow-motion flash on KO-level hits.

## Tests

```bash
node tests/moves.mjs        # every move of every animal runs and connects; all throws land
node tests/sim.mjs 60 9     # 60 CPU-vs-CPU matches at level 9: errors, self-KOs, balance, KO %
```

`tools/play.mjs tests/play_basic.json` drives the built game in headless Chrome over the
DevTools protocol (real key presses, state checks, screenshots). It needs the build
served at `http://localhost:8791/dist/`.

URL hooks for testing: `?quick=1&p1=bear&p2=cat&cpu2=7&stage=grove` jumps straight into
a fight (`cpuN=level` makes slot N a CPU); `&warp=1200` fast-forwards frames and `&ff=2`
runs the game at double speed.
