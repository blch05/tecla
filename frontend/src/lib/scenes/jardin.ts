/* Jardín: cada palabra correcta planta una flor que brota; cada 8 palabras seguidas sin errores
   crece un poco el árbol del centro. Un error hace caer una hoja. Con buena velocidad aparecen
   mariposas. Al terminar queda tu jardín: único para cada test. */
import { burst, hash, mix, stepBits, type Bit } from '@/lib/scenes/pixel';
import type { Scene } from '@/lib/scenes/types';

interface Flower { x: number; kind: number; age: number; col: string }
interface Leaf { x: number; y: number; vx: number; life: number }

export function jardin(): Scene {
  const flowers: Flower[] = [], leaves: Leaf[] = [], bits: Bit[] = [];
  let streak = 0, tree = 0, treeShow = 0, next = 0;
  return {
    on(e, env) {
      const p = env.pal;
      if (e.type === 'word' && e.ok) {
        streak++; if (streak % 8 === 0) tree = Math.min(6, tree + 1);
        // repartidas por todo el ancho, en un orden que parece al azar pero no se pisa
        const slot = Math.floor(hash(next++ * 7.3) * 40), x = 6 + slot * ((env.W - 12) / 40);
        flowers.push({ x, kind: next % 4, age: 0, col: [p.acc, p.err, p.warn, '#c084fc'][Math.floor(hash(next) * 4)] });
        if (flowers.length > 80) flowers.shift();
      } else if (e.type === 'key' && !e.ok) {
        streak = 0;
        leaves.push({ x: env.W / 2 + (Math.random() - 0.5) * 20, y: env.H - 40, vx: (Math.random() - 0.5) * 10, life: 2.5 });
      } else if (e.type === 'finish') burst(bits, env.W / 2, env.H - 30, 16, p.warn, 30, -10);
      else if (e.type === 'start') { flowers.length = 0; tree = 0; streak = 0; next = 0; }
    },
    frame(ctx, env, dt) {
      const { W, H, pal, t, flow } = env, gy = H - 7;
      ctx.clearRect(0, 0, W, H);
      // pasto
      ctx.fillStyle = mix(pal.bg, pal.ok, pal.dark ? 0.3 : 0.35); ctx.fillRect(0, gy, W, H - gy);
      for (let x = 0; x < W; x += 2) if (hash(x) > 0.55) { ctx.fillStyle = mix(pal.bg, pal.ok, 0.6); ctx.fillRect(x, gy - 1 - Math.round(hash(x + 3) * 1.4 + Math.sin(t * 2 + x) * 0.4), 1, 2); }
      // el árbol crece por etapas
      treeShow += (tree - treeShow) * Math.min(1, dt * 2);
      if (treeShow > 0.05) {
        const tx = Math.round(W / 2), h = Math.round(6 + treeShow * 6), r = 3 + treeShow * 3.5;
        ctx.fillStyle = '#8a5a2b'; ctx.fillRect(tx - 1, gy - h, 3, h);
        ctx.fillStyle = mix(pal.ok, pal.ink, 0.2);
        ctx.beginPath(); ctx.arc(tx, gy - h - r * 0.6, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = mix(pal.ok, '#ffffff', 0.25);
        ctx.beginPath(); ctx.arc(tx - r * 0.35, gy - h - r * 0.9, r * 0.45, 0, Math.PI * 2); ctx.fill();
        if (tree >= 4) for (let i = 0; i < tree; i++) { ctx.fillStyle = pal.err; ctx.fillRect(Math.round(tx + Math.cos(i * 2.1) * r * 0.6), Math.round(gy - h - r * 0.6 + Math.sin(i * 2.1) * r * 0.5), 1, 1); }
      }
      // flores: brotan, crecen y se mecen con el viento (más si vas rápido)
      for (const f of flowers) {
        f.age = Math.min(1, f.age + dt * 2.5);
        const h = Math.round(2 + f.age * (3 + f.kind)), sway = Math.round(Math.sin(t * (1.5 + flow * 3) + f.x) * (f.age > 0.9 ? 0.6 + flow : 0));
        const fx = Math.round(f.x), top = gy - h;
        ctx.fillStyle = mix(pal.ok, pal.ink, 0.25); ctx.fillRect(fx, top, 1, h);
        if (f.age < 0.6) continue;
        ctx.fillStyle = f.col;
        if (f.kind === 0) { ctx.fillRect(fx - 1 + sway, top - 1, 3, 1); ctx.fillRect(fx + sway, top - 2, 1, 3); }
        else if (f.kind === 1) { ctx.fillRect(fx - 1 + sway, top - 2, 3, 2); }
        else if (f.kind === 2) { ctx.fillRect(fx - 1 + sway, top - 1, 1, 1); ctx.fillRect(fx + 1 + sway, top - 1, 1, 1); ctx.fillRect(fx + sway, top - 2, 1, 1); }
        else { ctx.fillRect(fx + sway, top - 1, 1, 1); ctx.fillRect(fx - 1 + sway, top, 1, 1); ctx.fillRect(fx + 1 + sway, top, 1, 1); }
        ctx.fillStyle = pal.warn; ctx.fillRect(fx + sway, top - 1, 1, 1);
      }
      // mariposas cuando vas rápido
      const nb = Math.floor(flow * 4);
      for (let i = 0; i < nb; i++) {
        const bx = Math.round((W * hash(i + 5) + t * (12 + i * 3)) % W), by = Math.round(gy - 18 - i * 5 + Math.sin(t * 3 + i) * 4), w = Math.floor(t * 10 + i) % 2;
        ctx.fillStyle = ['#c084fc', pal.acc2, pal.warn, pal.err][i];
        ctx.fillRect(bx - 1, by - w, 1, 1 + w); ctx.fillRect(bx + 1, by - w, 1, 1 + w); ctx.fillStyle = pal.ink; ctx.fillRect(bx, by, 1, 1);
      }
      // hojas que caen con un error
      for (let i = leaves.length - 1; i >= 0; i--) {
        const l = leaves[i]; l.life -= dt; l.y += 10 * dt; l.x += Math.sin(l.life * 4) * 8 * dt + l.vx * dt;
        if (l.life <= 0 || l.y > gy) { leaves.splice(i, 1); continue; }
        ctx.fillStyle = pal.warn; ctx.fillRect(Math.round(l.x), Math.round(l.y), 2, 1);
      }
      stepBits(ctx, bits, dt);
    },
  };
}
