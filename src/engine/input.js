// Per-fighter input tracking. Controllers (keyboard, gamepad, CPU) produce a raw state
// each frame; the tracker turns it into presses, a short input buffer and tap detection,
// so the fighter code never touches devices directly.

export const BUTTONS = ['attack', 'special', 'jump', 'shield', 'grab'];
export const BUFFER_FRAMES = 7;

export function blankRaw() {
  return { x: 0, y: 0, cx: 0, cy: 0, attack: false, special: false, jump: false, shield: false, grab: false, start: false };
}

const sign = (v) => (v > 0.5 ? 1 : v < -0.5 ? -1 : 0);

export class InputTracker {
  constructor(tapJump = false) {
    this.tapJump = tapJump;
    this.raw = blankRaw();
    this.prev = blankRaw();
    this.age = Object.fromEntries(BUTTONS.map((b) => [b, 99]));
    this.tapX = 99; // frames since the stick was pushed hard left/right
    this.tapY = 99;
    this.sx = 0;
    this.sy = 0;
    this.cstick = null; // {x, y} on the frame the c-stick is flicked
    this.prevC = 0;
  }

  update(raw) {
    this.prev = this.raw;
    this.raw = raw;
    for (const b of BUTTONS) this.age[b] = raw[b] && !this.prev[b] ? 0 : Math.min(99, this.age[b] + 1);
    const sx = sign(raw.x);
    const sy = sign(raw.y);
    this.tapX = sx !== 0 && sx !== this.sx ? 0 : Math.min(99, this.tapX + 1);
    this.tapY = sy !== 0 && sy !== this.sy ? 0 : Math.min(99, this.tapY + 1);
    if (this.tapJump && sy === -1 && this.sy !== -1) this.age.jump = 0;
    this.sx = sx;
    this.sy = sy;
    const c = Math.abs(raw.cx) > 0.5 || Math.abs(raw.cy) > 0.5 ? 1 : 0;
    this.cstick = c && !this.prevC ? { x: sign(raw.cx), y: sign(raw.cy) } : null;
    this.prevC = c;
  }

  held(b) {
    if (b === 'jump' && this.tapJump && this.sy === -1) return true;
    return !!this.raw[b];
  }
  pressed(b) { return this.age[b] === 0; }
  buffered(b, win = BUFFER_FRAMES) { return this.age[b] <= win; }
  consume(b) { this.age[b] = 99; }
  clear() { for (const b of BUTTONS) this.age[b] = 99; this.cstick = null; }
  get x() { return this.raw.x; }
  get y() { return this.raw.y; }
}
