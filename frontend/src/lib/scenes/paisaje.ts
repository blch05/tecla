/* Paisaje (gratis): un recorrido lo-fi en capas que avanza más rápido cuanto más rápido tipeás.
   Montañas, colinas, árboles y flores *, sol de día y luna con estrellas de noche. */
import { hash } from '@/lib/scenes/pixel';
import type { Scene } from '@/lib/scenes/types';

/** altura de una capa en x: suma de ondas con fases fijas (infinita y sin cortes) */
const ridge = (x: number, seed: number, amp: number) =>
  amp * (0.55 * Math.sin(x * 0.0021 + seed) + 0.3 * Math.sin(x * 0.0057 + seed * 2.3) + 0.15 * Math.sin(x * 0.013 + seed * 4.1));

// de atrás hacia adelante: velocidad relativa, base (fracción del alto), amplitud y tono
const LAYERS = [
  { speed: 0.08, base: 0.42, amp: 0.13, tone: 0.18, seed: 1.7 },
  { speed: 0.2, base: 0.58, amp: 0.1, tone: 0.32, seed: 4.2 },
  { speed: 0.45, base: 0.72, amp: 0.07, tone: 0.5, seed: 7.9 },
  { speed: 1, base: 0.86, amp: 0.04, tone: 0.72, seed: 2.6 },
];

export function paisaje(): Scene {
  let x = 0, stumble = 0;
  return {
    on(e) { if (e.type === 'key' && !e.ok) stumble = 1; },
    frame(ctx, { W, H, pal, t, flow }, dt) {
      stumble = Math.max(0, stumble - dt * 2.5);
      x += (14 + flow * flow * 520) * dt * (1 - stumble * 0.8);
      const { bg, acc, acc2, ink, dark, mix } = pal, k = dark ? 0.75 : 1;
      ctx.clearRect(0, 0, W, H);
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, bg); sky.addColorStop(1, mix(bg, acc2, dark ? 0.12 : 0.28));
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      if (dark) for (let i = 0; i < 60; i++) {
        const sx = ((hash(i) * W * 1.5 - x * 0.02) % W + W) % W, sy = hash(i + 99) * H * 0.5;
        ctx.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(t * 0.6 + i)); ctx.fillStyle = mix(bg, ink, 0.8);
        ctx.fillRect(sx, sy, 1.5, 1.5);
      }
      ctx.globalAlpha = 1;
      // sol (o luna), quieto sobre el horizonte
      const sunX = W * 0.74, sunY = H * 0.36, sunR = Math.min(W, H) * 0.09;
      const halo = ctx.createRadialGradient(sunX, sunY, sunR * 0.4, sunX, sunY, sunR * 3);
      halo.addColorStop(0, mix(bg, acc2, dark ? 0.35 : 0.55)); halo.addColorStop(1, mix(bg, acc2, 0));
      ctx.fillStyle = halo; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = dark ? mix(bg, ink, 0.85) : mix(bg, acc2, 0.9);
      ctx.beginPath(); ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2); ctx.fill();
      LAYERS.forEach((L, li) => {
        const off = x * L.speed, base = H * L.base, amp = H * L.amp;
        ctx.fillStyle = mix(bg, li < 2 ? acc2 : acc, L.tone * k);
        ctx.beginPath(); ctx.moveTo(0, H);
        for (let px = 0; px <= W + 8; px += 8) ctx.lineTo(px, base - ridge(px + off, L.seed, amp));
        ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
        if (li < 2) return;
        // árboles en la colina del medio, flores * en la de adelante
        const step = li === 2 ? 46 : 34, first = Math.floor(off / step) - 1;
        for (let j = first; j < first + W / step + 3; j++) {
          const r = hash(j * (li + 3)); if (r < (li === 2 ? 0.55 : 0.4)) continue;
          const wx = j * step - off + r * step * 0.6, gy = base - ridge(wx + off, L.seed, amp);
          if (li === 2) {
            const th = 14 + r * 16;
            ctx.fillStyle = mix(bg, acc, 0.66 * k);
            ctx.beginPath(); ctx.moveTo(wx, gy - th); ctx.lineTo(wx - th * 0.32, gy + 2); ctx.lineTo(wx + th * 0.32, gy + 2); ctx.closePath(); ctx.fill();
          } else {
            ctx.fillStyle = r > 0.85 ? mix(bg, acc2, 0.25) : mix(bg, ink, dark ? 0.55 : 0.12);
            ctx.font = `700 ${12 + r * 8}px "Martian Mono", monospace`; ctx.textAlign = 'center';
            ctx.fillText('*', wx, gy - 2);
          }
        }
      });
      // viento cuando vas rápido
      if (flow > 0.35) {
        ctx.strokeStyle = mix(bg, acc2, 0.9); ctx.lineWidth = 1.5; ctx.globalAlpha = (flow - 0.35) * 0.9;
        for (let i = 0; i < 9; i++) {
          const ly = H * (0.15 + hash(i + 7) * 0.5), len = 40 + hash(i + 3) * 80;
          const lx = W - ((x * (1.4 + hash(i) * 0.8) + hash(i + 11) * W * 2) % (W + len * 2)) + len;
          ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + len, ly); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    },
  };
}
