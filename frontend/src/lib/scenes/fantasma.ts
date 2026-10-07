/* Vos contra tu fantasma: dos corredores en una pista. Vos (color de acento) y tu récord
   (translúcido). La distancia entre los dos es la ventaja real en letras que el test calcula
   contra tu récord. Las piernas van más rápido cuanto más rápido tipeás. Un error: tropezón. */
import { mix, pixelText, sprite } from '@/lib/scenes/pixel';
import type { Scene } from '@/lib/scenes/types';

const RUN = [
  ['..hh..', '..hh..', '.bbbb.', 'b.bb.b', '..bb..', '.b..b.', 'b....b'],
  ['..hh..', '..hh..', '.bbbb.', '.bbbb.', '..bb..', '..bb..', '.b..b.'],
];
const FALL = ['......', '......', '..hh..', '.bbbb.', 'bbbbbb', 'b.bb.b', '......'];

export function fantasma(): Scene {
  let diff: number | null = null, shown = 0, ph = 0, trip = 0, scroll = 0, win = 0;
  return {
    on(e) {
      if (e.type === 'ghost') diff = e.diff;
      else if (e.type === 'key' && !e.ok) trip = 0.35;
      else if (e.type === 'finish') win = e.record ? 3 : 0;
      else if (e.type === 'start') { shown = 0; win = 0; }
    },
    frame(ctx, env, dt) {
      const { W, H, pal, flow } = env, gy = H - 10;
      ctx.clearRect(0, 0, W, H);
      // pista con carriles
      ctx.fillStyle = mix(pal.bg, pal.err, pal.dark ? 0.25 : 0.3); ctx.fillRect(0, gy - 12, W, 14);
      ctx.fillStyle = mix(pal.bg, '#ffffff', 0.6); ctx.fillRect(0, gy - 12, W, 1); ctx.fillRect(0, gy - 5, W, 1); ctx.fillRect(0, gy + 2, W, 1);
      scroll += (10 + flow * 90) * dt;
      for (let x = -(scroll % 24); x < W; x += 24) { ctx.fillStyle = mix(pal.bg, '#ffffff', 0.35); ctx.fillRect(Math.round(x), gy - 9, 6, 1); ctx.fillRect(Math.round(x + 12), gy - 2, 6, 1); }
      ph += dt * (4 + flow * 14); trip = Math.max(0, trip - dt); win = Math.max(0, win - dt);
      // separación: letras de ventaja → píxeles (con tope para que entren los dos)
      const target = diff == null ? 0 : Math.max(-W * 0.3, Math.min(W * 0.3, diff * 1.4));
      shown += (target - shown) * Math.min(1, dt * 3);
      const mid = W / 2, fr = Math.floor(ph) % 2;
      if (diff != null) {
        ctx.globalAlpha = 0.45;
        sprite(ctx, RUN[(fr + 1) % 2], { h: pal.sub, b: pal.sub }, mid - shown / 2, gy - 6);
        ctx.globalAlpha = 1;
      }
      sprite(ctx, trip > 0 ? FALL : RUN[fr], { h: '#f1c9a5', b: pal.acc }, mid + shown / 2, gy + 1);
      // cartel con la ventaja
      const label = diff == null ? '' : (diff >= 0 ? '+' : '') + Math.round(diff);
      if (label) pixelText(ctx, label, mid + shown / 2 - 4, gy - 20, diff! >= 0 ? pal.ok : pal.err);
      if (win > 0 && Math.floor(win * 4) % 2) pixelText(ctx, '!', mid + shown / 2, gy - 28, pal.warn);
    },
  };
}
