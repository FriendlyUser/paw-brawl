// A tiny event bus shared by the Vue UI and the Phaser scene.
export function createBus() {
  const map = new Map();
  return {
    on(type, fn) { (map.get(type) ?? map.set(type, new Set()).get(type)).add(fn); },
    off(type, fn) { map.get(type)?.delete(fn); },
    emit(type, data) { for (const fn of map.get(type) ?? []) fn(data); },
    clear() { map.clear(); },
  };
}
