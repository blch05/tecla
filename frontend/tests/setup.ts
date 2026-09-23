// jsdom no trae requestAnimationFrame ni randomUUID en todas las versiones
if (!globalThis.requestAnimationFrame) {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 0) as unknown as number;
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
}
if (!globalThis.crypto?.randomUUID) {
  // @ts-expect-error polyfill mínimo para tests
  globalThis.crypto = { ...globalThis.crypto, randomUUID: () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => ((Math.random() * 16) | 0).toString(16)) };
}
beforeEach(() => { localStorage.clear(); });
