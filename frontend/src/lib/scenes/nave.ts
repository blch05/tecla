/* Nave arcade: una navecita abajo y una formación de invasores arriba.
   Cada letra correcta es un disparo; cada palabra, un invasor que explota. Con buena velocidad
   dispara de a tres. Un error hace parpadear la nave. Las estrellas pasan más rápido si vas rápido. */
import { burst, hash, mix, sprite, stepBits, type Bit } from '@/lib/scenes/pixel';
import type { Scene } from '@/lib/scenes/types';

const SHIP = ['....w....', '...waw...', '...waw...', '..wwwww..', '.wwbwbww.', 'wwwwwwwww', 'w.r...r.w'];
const INV = [['..x...x..', '...x.x...', '..xxxxx..', '.xx.x.xx.', 'xxxxxxxxx', 'x.xxxxx.x', 'x.x...x.x', '...x.x...'],
             ['..x...x..', 'x..x.x..x', 'x.xxxxx.x', 'xxx.x.xxx', 'xxxxxxxxx', '.xxxxxxx.', '..x...x..', '.x.....x.']];

interface Shot { x: number; y: number }
interface Inv { col: number; row: number; alive: boolean }

export function nave(): Scene {
  const shots: Shot[] = [], bits: Bit[] = [];
  let invs: Inv[] = [], ox = 0, dir = 1, drop = 0, shipX = 0.5, hurtT = 0, wave = 0, stars = 0;
  const reset = () => { invs = []; for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) invs.push({ col: c, row: r, alive: true }); drop = 0; wave++; };
  reset();
  return {
    on(e, env) {
      if (e.type === 'key' && e.ok) {
        const x = env.W * shipX, y = env.H - 14;
        shots.push({ x, y });
        if (env.flow > 0.7) shots.push({ x: x - 4, y: y + 2 }, { x: x + 4, y: y + 2 });
      } else if (e.type === 'key' && !e.ok) hurtT = 0.4;
      else if (e.type === 'word' && e.ok) {
        // la palabra completa derriba al invasor más bajo y cercano a la nave
        const alive = invs.filter(i => i.alive);
        if (!alive.length) return;
        const W = env.W, gx = (i: Inv) => W / 2 - 4 * 13 + i.col * 13 + ox;
        const tgt = alive.sort((a, b) => b.row - a.row || Math.abs(gx(a) - W * shipX) - Math.abs(gx(b) - W * shipX))[0];
        tgt.alive = false; shipX += (gx(tgt) / W - shipX) * 0.6;
        burst(bits, gx(tgt), env.H * 0.52 + tgt.row * 10 + drop - 4, 14, env.pal.warn, 45, 20);
        if (invs.every(i => !i.alive)) setTimeout(reset, 600);
      }
    },
    frame(ctx, env, dt) {
      const { W, H, pal, flow, t } = env;
      ctx.clearRect(0, 0, W, H);
      // el espacio aparece de a poco desde arriba, para no tapar el texto del test
      const space = ctx.createLinearGradient(0, 0, 0, H);
      space.addColorStop(0, 'rgba(0,0,0,0)'); space.addColorStop(0.45, pal.dark ? mix(pal.bg, '#000000', 0.3) : mix(pal.bg, pal.ink, 0.86));
      ctx.fillStyle = space; ctx.fillRect(0, 0, W, H);
      // estrellas en capas, bajan más rápido con la velocidad
      stars += dt * (8 + flow * 70);
      for (let i = 0; i < 70; i++) {
        const sp = 0.3 + hash(i) * 0.7, x = Math.floor(hash(i + 1) * W), y = Math.floor((hash(i + 2) * H + stars * sp) % H);
        if (y < H * 0.4) continue;
        ctx.fillStyle = mix(pal.bg, pal.acc2, 0.25 + sp * 0.5); ctx.fillRect(x, y, 1, sp > 0.85 && flow > 0.6 ? 2 : 1);
      }
      // formación de invasores: va y viene y baja de a poco
      ox += dir * 10 * dt * (1 + wave * 0.1);
      if (Math.abs(ox) > W / 2 - 4 * 13 - 6) { dir = -dir as 1 | -1; drop = Math.min(H * 0.18, drop + 2); ox = Math.sign(ox) * (W / 2 - 4 * 13 - 6); }
      const fr = Math.floor(t * 2) % 2;
      for (const i of invs) if (i.alive) {
        const x = W / 2 - 4 * 13 + i.col * 13 + ox, y = H * 0.52 + i.row * 10 + drop;
        sprite(ctx, INV[fr], { x: [pal.err, pal.warn, pal.ok][i.row] }, x, y);
      }
      // disparos
      for (let k = shots.length - 1; k >= 0; k--) {
        const s = shots[k]; s.y -= 160 * dt;
        ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(s.x), Math.round(s.y), 1, 3);
        if (s.y < -4) shots.splice(k, 1);
      }
      // la nave (sigue un poco al blanco, parpadea con un error)
      hurtT = Math.max(0, hurtT - dt); shipX += (0.5 + Math.sin(t * 0.7) * 0.15 - shipX) * dt * 0.5;
      if (!(hurtT > 0 && Math.floor(hurtT * 16) % 2)) {
        sprite(ctx, SHIP, { w: pal.acc2, a: pal.acc, b: '#ffffff', r: Math.floor(t * 12) % 2 ? pal.warn : pal.err }, W * shipX, H - 4);
      }
      stepBits(ctx, bits, dt);
    },
  };
}
