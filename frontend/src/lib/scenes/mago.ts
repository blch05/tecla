/* Mago de runas: cada letra correcta enciende una runa en el círculo mágico que tiene adelante;
   al completar la palabra, el círculo dispara un hechizo contra un slime. Cuanto más rápido,
   más gira el círculo y aparecen más anillos. Un error apaga una runa con chispas rojas. */
import { burst, mix, sprite, stepBits, type Bit } from '@/lib/scenes/pixel';
import type { Scene } from '@/lib/scenes/types';

// h sombrero · r túnica · s piel · b barba · w bastón · o orbe
const MAGE = [
  '.....h......',
  '....hhh.....',
  '...hhhhh....',
  '..hhhhhhh..o',
  '.hhhhhhhhh.w',
  '...ssss....w',
  '...sbbs....w',
  '..rbbbbr..sw',
  '.rrrbbrrrrrw',
  '.rrrrrrrr..w',
  '.rrrrrrrr..w',
  'rrrrrrrrrr.w',
  'rrrrrrrrrr.w',
];
const SLIME = [['..xxxx..', '.xxxxxx.', 'xxwxxwxx', 'xxkxxkxx', 'xxxxxxxx', '.xxxxxx.'], ['........', '..xxxx..', '.xxxxxx.', 'xxwxxwxx', 'xxkxxkxx', 'xxxxxxxx']];
// runas de 3×3 (se elige una al azar por letra)
const RUNES = ['010111010', '101010101', '111101111', '110011110', '011110011', '100111001'];

interface Bolt { x: number; y: number; tx: number; ty: number; life: number }
interface Mob { x: number; ph: number }

export function mago(): Scene {
  const lit: number[] = [], bolts: Bolt[] = [], mobs: Mob[] = [], bits: Bit[] = [];
  let rot = 0, spawnT = 0.5, castT = 0, sparks = 0;
  return {
    on(e, env) {
      if (e.type === 'key' && e.ok) { lit.push(Math.floor(Math.random() * RUNES.length)); if (lit.length > 10) lit.shift(); }
      else if (e.type === 'key' && !e.ok) { lit.pop(); sparks = 0.3; }
      else if (e.type === 'word' && e.ok) {
        castT = 0.3;
        const target = mobs.reduce<Mob | null>((a, m) => (!a || m.x < a.x ? m : a), null);
        const cx = env.W * 0.34, gy = env.H - 8;
        bolts.push({ x: cx, y: gy - 22, tx: target ? target.x : env.W + 10, ty: gy - 3, life: 1 });
        lit.length = 0;
      } else if (e.type === 'start') lit.length = 0;
    },
    frame(ctx, env, dt) {
      const { W, H, pal, t, flow } = env, gy = H - 8, mx = W * 0.2, cx = W * 0.34, cy = gy - 22;
      ctx.clearRect(0, 0, W, H);
      // piso de piedra
      ctx.fillStyle = mix(pal.bg, pal.ink, pal.dark ? 0.3 : 0.12); ctx.fillRect(0, gy, W, H - gy);
      for (let x = 0; x < W; x += 9) { ctx.fillStyle = mix(pal.bg, pal.ink, pal.dark ? 0.4 : 0.2); ctx.fillRect(x, gy, 1, H - gy); }
      // el mago (se balancea y levanta el bastón al lanzar)
      castT = Math.max(0, castT - dt); sparks = Math.max(0, sparks - dt);
      sprite(ctx, MAGE, { h: mix(pal.acc, pal.ink, 0.35), r: pal.acc, s: '#f1c9a5', b: '#eef2f6', w: '#8a5a2b', o: castT > 0 ? '#ffffff' : pal.acc2 }, mx, gy + Math.round(Math.sin(t * 2) * 0.6) - (castT > 0 ? 1 : 0));
      // círculo mágico (elipse vista desde el costado), gira más rápido con la velocidad
      rot += dt * (0.6 + flow * 4);
      const rings = flow > 0.6 ? 2 : 1;
      for (let r = 0; r < rings; r++) {
        const R = 10 + r * 4;
        ctx.fillStyle = mix(pal.bg, pal.acc, 0.55 - r * 0.12);
        for (let k = 0; k < 40; k++) { const a = k / 40 * Math.PI * 2 + rot * (r % 2 ? -1 : 1); ctx.fillRect(Math.round(cx + Math.cos(a) * R * 0.45), Math.round(cy + Math.sin(a) * R), 1, 1); }
      }
      // runas encendidas alrededor del círculo
      lit.forEach((ri, i) => {
        const a = i / 10 * Math.PI * 2 + rot, rx = Math.round(cx + Math.cos(a) * 4), ry = Math.round(cy + Math.sin(a) * 10);
        const g = RUNES[ri]; ctx.fillStyle = i === lit.length - 1 ? '#ffffff' : pal.acc2;
        for (let p = 0; p < 9; p++) if (g[p] === '1') ctx.fillRect(rx - 1 + (p % 3), ry - 1 + Math.floor(p / 3), 1, 1);
      });
      if (sparks > 0 && Math.random() < 0.5) burst(bits, cx, cy, 2, pal.err, 25, 40);
      // slimes que se acercan desde la derecha
      spawnT -= dt;
      if (spawnT <= 0 && mobs.length < 5) { spawnT = 2.2 - flow * 1.2 + Math.random(); mobs.push({ x: W + 8, ph: Math.random() * 6 }); }
      for (const m of mobs) {
        if (m.x > cx + 16) m.x -= 9 * (1 + flow * 0.5) * dt;
        m.ph += dt * 5;
        sprite(ctx, SLIME[Math.floor(m.ph) % 2], { x: mix(pal.ok, pal.ink, 0.15), w: '#ffffff', k: pal.ink }, m.x, gy);
      }
      // hechizos: viajan hasta el slime y lo hacen estallar
      for (let i = bolts.length - 1; i >= 0; i--) {
        const b = bolts[i], dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy), sp = 160 * dt;
        if (d < sp) {
          const hit = mobs.find(m => Math.abs(m.x - b.tx) < 6);
          if (hit) { mobs.splice(mobs.indexOf(hit), 1); burst(bits, hit.x, gy - 3, 14, pal.acc2, 50, 60); burst(bits, hit.x, gy - 3, 6, pal.ok, 35, 60); }
          bolts.splice(i, 1); continue;
        }
        b.x += dx / d * sp; b.y += dy / d * sp;
        ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(b.x) - 1, Math.round(b.y) - 1, 3, 3);
        ctx.fillStyle = pal.acc; ctx.fillRect(Math.round(b.x - dx / d * 3), Math.round(b.y - dy / d * 3), 2, 2);
        if (Math.random() < 0.6) bits.push({ x: b.x, y: b.y, vx: 0, vy: -4, life: 0.4, col: pal.acc2, g: 0, size: 1 });
      }
      stepBits(ctx, bits, dt);
    },
  };
}
