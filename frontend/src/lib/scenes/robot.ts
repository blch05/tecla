/* Robot que alienta: su cara es una pantalla con expresiones. Contento si venís bien,
   sorprendido con racha, triste si le errás, de fiesta al batir un récord. Saluda con cada palabra. */
import { burst, mix, sprite, stepBits, type Bit } from '@/lib/scenes/pixel';
import type { Scene } from '@/lib/scenes/types';

// m metal · d metal oscuro · s pantalla · a antena · l luz
const BODY = [
  '......a......',
  '......l......',
  '..ddddddddd..',
  '..dsssssssd..',
  '..dsssssssd..',
  '..dsssssssd..',
  '..dsssssssd..',
  '..ddddddddd..',
  '.....ddd.....',
  '..mmmmmmmmm..',
  '..mmmdddmmm..',
  '..mmmdldmmm..',
  '..mmmmmmmmm..',
  '...mm...mm...',
  '...dd...dd...',
];
// caras de 7×4 en la pantalla
const FACES: Record<string, string[]> = {
  neutral: ['.......', '.x...x.', '.......', '..xxx..'],
  feliz: ['.......', '.x...x.', '.x...x.', '..xxx..'],
  wow: ['.x...x.', '.x...x.', '...x...', '..x.x..'],
  triste: ['.......', '.xx.xx.', '.......', '.xxxxx.'],
  fiesta: ['x.....x', '.x...x.', '.......', '.xxxxx.'],
};

export function robot(): Scene {
  const bits: Bit[] = [];
  let face = 'neutral', faceT = 0, wave = 0, streak = 0, party = 0;
  const show = (f: string, secs: number) => { face = f; faceT = secs; };
  return {
    on(e, env) {
      if (e.type === 'word' && e.ok) { streak++; wave = 0.4; if (streak % 10 === 0) { show('wow', 1.2); burst(bits, env.W / 2, env.H - 30, 8, env.pal.warn, 30, 40); } }
      else if (e.type === 'key' && !e.ok) { streak = 0; show('triste', 0.8); }
      else if (e.type === 'finish') { party = e.record ? 3 : 1.2; show(e.record ? 'fiesta' : 'feliz', party); if (e.record) burst(bits, env.W / 2, env.H - 34, 24, env.pal.acc, 50, 40); }
    },
    frame(ctx, env, dt) {
      const { W, H, pal, t, flow } = env, gy = H - 5, cx = Math.round(W / 2);
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = mix(pal.bg, pal.ink, pal.dark ? 0.25 : 0.1); ctx.fillRect(0, gy, W, H - gy);
      faceT = Math.max(0, faceT - dt); wave = Math.max(0, wave - dt); party = Math.max(0, party - dt);
      if (faceT <= 0) face = flow > 0.6 ? 'feliz' : 'neutral';
      const hop = party > 0 ? -Math.abs(Math.round(Math.sin(t * 9) * 2)) : 0;
      sprite(ctx, BODY, { m: pal.dark ? '#c9d3de' : '#dfe6ee', d: mix(pal.ink, pal.bg, 0.25), s: pal.dark ? '#0b1220' : '#1d2b38', a: pal.sub, l: Math.floor(t * 3) % 2 ? pal.err : pal.warn }, cx, gy + hop);
      // la cara (en la pantalla)
      const f = FACES[face], fx = cx - 3, fy = gy + hop - 15 + 3;
      ctx.fillStyle = face === 'triste' ? pal.err : face === 'fiesta' ? pal.warn : pal.acc2;
      f.forEach((row, r) => [...row].forEach((c, k) => { if (c === 'x') ctx.fillRect(fx + k, fy + r, 1, 1); }));
      // brazos: saluda con cada palabra
      ctx.fillStyle = mix(pal.ink, pal.bg, 0.25);
      const up = wave > 0 || party > 0 ? Math.round(Math.sin(t * 20) * 1.5) + 3 : 0;
      ctx.fillRect(cx - 8, gy + hop - 5 - up, 2, 3 + up); ctx.fillRect(cx + 6, gy + hop - 5, 2, 3);
      stepBits(ctx, bits, dt);
    },
  };
}
