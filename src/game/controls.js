// Human input: keyboard layouts and gamepads, read with KeyboardEvent.code so both
// players can share one keyboard. Each controller's poll() returns a raw input frame.
import { blankRaw } from '../engine/input.js';

export const KEY_LAYOUTS = {
  kb1: {
    name: 'Keyboard 1',
    left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'],
    attack: ['KeyJ'], special: ['KeyK'], jump: ['Space', 'KeyI'], shield: ['KeyL', 'ShiftLeft'], grab: ['KeyU', 'Semicolon'],
  },
  kb2: {
    name: 'Keyboard 2',
    left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'],
    attack: ['Numpad1', 'Comma'], special: ['Numpad2', 'Period'], jump: ['Numpad0', 'ShiftRight'], shield: ['Numpad3', 'Slash'], grab: ['Numpad4', 'Quote'],
  },
};

const GAME_KEYS = new Set(Object.values(KEY_LAYOUTS).flatMap((l) => Object.values(l).filter(Array.isArray).flat()));

class KeyState {
  constructor() {
    this.down = new Set();
    this.latched = new Set(); // pressed since the last engine step, even if already released
    this.pressedOnce = new Set();
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', (e) => {
      if (GAME_KEYS.has(e.code) && !(e.target instanceof HTMLInputElement)) e.preventDefault();
      if (!e.repeat) { this.pressedOnce.add(e.code); this.latched.add(e.code); }
      this.down.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => this.down.clear());
  }
  any(codes) { return codes.some((c) => this.down.has(c) || this.latched.has(c)); }
  /** Called after each engine step so a tap shorter than a frame still counts once. */
  endStep() { this.latched.clear(); }
  /** True once per physical press (for menus and pause). */
  take(code) {
    const had = this.pressedOnce.has(code);
    this.pressedOnce.delete(code);
    return had;
  }
  flush() { this.pressedOnce.clear(); }
}

export const keys = new KeyState();

export class KeyboardController {
  constructor(layoutId) { this.layout = KEY_LAYOUTS[layoutId]; this.kind = 'keyboard'; }
  poll() {
    const L = this.layout;
    const raw = blankRaw();
    raw.x = (keys.any(L.right) ? 1 : 0) - (keys.any(L.left) ? 1 : 0);
    raw.y = (keys.any(L.down) ? 1 : 0) - (keys.any(L.up) ? 1 : 0);
    for (const b of ['attack', 'special', 'jump', 'shield', 'grab']) raw[b] = keys.any(L[b]);
    return raw;
  }
}

const DEAD = 0.28;
const axis = (v) => (Math.abs(v) < DEAD ? 0 : (v - Math.sign(v) * DEAD) / (1 - DEAD));

export function getPad(index) {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
  return navigator.getGamepads()[index] ?? null;
}

export function connectedPads() {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return [];
  return [...navigator.getGamepads()].filter(Boolean).map((p) => ({ index: p.index, id: p.id }));
}

export class GamepadController {
  constructor(index) { this.index = index; this.kind = 'gamepad'; }
  poll() {
    const raw = blankRaw();
    const p = getPad(this.index);
    if (!p) return raw;
    const b = (i) => !!p.buttons[i]?.pressed;
    raw.x = axis(p.axes[0] ?? 0);
    raw.y = axis(p.axes[1] ?? 0);
    if (b(14)) raw.x = -1;
    if (b(15)) raw.x = 1;
    if (b(12)) raw.y = -1;
    if (b(13)) raw.y = 1;
    raw.cx = axis(p.axes[2] ?? 0);
    raw.cy = axis(p.axes[3] ?? 0);
    raw.attack = b(0);
    raw.special = b(1);
    raw.jump = b(2) || b(3);
    raw.shield = b(4) || b(6) || b(7);
    raw.grab = b(5);
    raw.start = b(9);
    return raw;
  }
}

export function makeController(input) {
  if (input === 'kb1' || input === 'kb2') return new KeyboardController(input);
  if (typeof input === 'string' && input.startsWith('pad')) return new GamepadController(+input.slice(3));
  return new KeyboardController('kb1');
}
