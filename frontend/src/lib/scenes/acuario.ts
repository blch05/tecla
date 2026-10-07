/* Acuario: cada letra correcta suelta una burbuja; cada palabra trae un pez que cruza.
   Con racha llegan cardúmenes. Un error revienta las burbujas cercanas. */
import { hash, mix, sprite } from '@/lib/scenes/pixel';
import type { Scene } from '@/lib/scenes/types';

const FISH = [['..xx...', '.xxxx.x', 'xexxxxx', '.xxxx.x', '..xx...'], ['..xx...', '.xxxxx.', 'xexxxxx', '.xxxxx.', '..xx...']];

interface Bubble { x: number; y: number; r: number; pop: number }
interface Fish { x: number; y: number; dir: 1 | -1; sp: number; col: string; ph: number }

export function acuario(): Scene {
  const bubbles: Bubble[] = [], fish: Fish[] = [];
  let streak = 0;
  return {
    on(e, env) {
      const { W, H, pal } = env;
      if (e.type === 'key' && e.ok) bubbles.push({ x: 8 + Math.random() * (W - 16), y: H - 6, r: Math.random() < 0.2 ? 2 : 1, pop: 0 });
      else if (e.type === 'key' && !e.ok) { streak = 0; for (const b of bubbles) if (b.y > H * 0.4) b.pop = 0.15; }
      else if (e.type === 'word' && e.ok) {
        streak++;
        const n = streak >= 10 ? 4 : 1, dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1, y = 10 + Math.random() * (H - 30);
        const col = [pal.warn, pal.acc, pal.err, '#c084fc'][Math.floor(Math.random() * 4)];
        for (let i = 0; i < n; i++) fish.push({ x: dir === 1 ? -8 - i * 9 : W + 8 + i * 9, y: y + (i % 2) * 4, dir, sp: 22 + Math.random() * 14, col, ph: Math.random() * 6 });
      }
    },
    frame(ctx, env, dt) {
      const { W, H, pal, t, flow } = env;
      ctx.clearRect(0, 0, W, H);
      const water = ctx.createLinearGradient(0, 0, 0, H);
      water.addColorStop(0, mix(pal.bg, pal.acc2, pal.dark ? 0.15 : 0.25)); water.addColorStop(1, mix(pal.bg, pal.acc, pal.dark ? 0.35 : 0.5));
      ctx.fillStyle = water; ctx.fillRect(0, 0, W, H);
      // rayos de luz
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      for (let i = 0; i < 4; i++) { const rx = (W * (0.15 + i * 0.25) + Math.sin(t * 0.3 + i) * 10); ctx.beginPath(); ctx.moveTo(rx, 0); ctx.lineTo(rx + 8, 0); ctx.lineTo(rx + 26, H); ctx.lineTo(rx + 14, H); ctx.fill(); }
      // arena y algas que se mecen (más con la velocidad)
      ctx.fillStyle = mix(pal.bg, pal.warn, 0.45); ctx.fillRect(0, H - 5, W, 5);
      for (let i = 0; i < W; i += 11) {
        const h = 8 + Math.floor(hash(i) * 12);
        for (let k = 0; k < h; k++) { ctx.fillStyle = mix(pal.ok, pal.ink, 0.2 + (k % 3) * 0.05); ctx.fillRect(Math.round(i + Math.sin(t * (1 + flow * 2) + k * 0.4 + i) * (k / h) * 2), H - 5 - k, 1, 1); }
      }
      // peces
      for (let i = fish.length - 1; i >= 0; i--) {
        const f = fish[i]; f.x += f.dir * f.sp * (1 + flow * 0.8) * dt; f.ph += dt * 6;
        if (f.x < -20 || f.x > W + 20) { fish.splice(i, 1); continue; }
        sprite(ctx, FISH[Math.floor(f.ph) % 2], { x: f.col, e: pal.ink }, f.x, f.y + Math.round(Math.sin(f.ph * 0.5)), f.dir === -1);
      }
      // burbujas
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.fillStyle = 'rgba(255,255,255,0.8)';
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        if (b.pop > 0) { b.pop -= dt; ctx.fillRect(b.x - 2, b.y, 1, 1); ctx.fillRect(b.x + 2, b.y, 1, 1); ctx.fillRect(b.x, b.y - 2, 1, 1); if (b.pop <= 0) bubbles.splice(i, 1); continue; }
        b.y -= (18 + b.r * 6) * dt; b.x += Math.sin(t * 3 + i) * 3 * dt;
        if (b.y < -3) { bubbles.splice(i, 1); continue; }
        if (b.r === 1) ctx.fillRect(Math.round(b.x), Math.round(b.y), 1, 1);
        else { ctx.fillRect(Math.round(b.x), Math.round(b.y) - 1, 1, 1); ctx.fillRect(Math.round(b.x) - 1, Math.round(b.y), 1, 1); ctx.fillRect(Math.round(b.x) + 1, Math.round(b.y), 1, 1); ctx.fillRect(Math.round(b.x), Math.round(b.y) + 1, 1, 1); }
      }
    },
  };
}
