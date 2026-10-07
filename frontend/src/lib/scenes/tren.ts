/* Tren nocturno: mirás por la ventanilla. La ciudad y los postes pasan más rápido cuanto más
   rápido tipeás; la lluvia en el vidrio se inclina con la velocidad. Cada palabra correcta hace
   pasar un poste con luz; un error sacude el vagón. */
import { hash, mix } from '@/lib/scenes/pixel';
import type { Scene } from '@/lib/scenes/types';

interface Drop { x: number; y: number; len: number }

export function tren(): Scene {
  const drops: Drop[] = [], posts: number[] = [];
  let x = 0, shake = 0;
  return {
    on(e, env) {
      if (e.type === 'word' && e.ok) posts.push(env.W + 4);
      else if (e.type === 'key' && !e.ok) shake = 0.3;
    },
    frame(ctx, env, dt) {
      const { W, pal, flow, t } = env, speed = 20 + flow * flow * 260;
      // la ventanilla ocupa la parte de abajo (arriba queda el texto del test)
      const top = Math.round(env.H * 0.36), H = env.H - top;
      x += speed * dt; shake = Math.max(0, shake - dt);
      const sy = shake > 0 ? Math.round(Math.sin(t * 60)) : Math.round(Math.sin(t * 9) * 0.4);
      ctx.clearRect(0, 0, W, env.H);
      ctx.save(); ctx.beginPath(); ctx.rect(0, top, W, H); ctx.clip(); ctx.translate(0, top + sy);
      // cielo de noche (siempre, aunque la página esté en modo claro)
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#0f1a2b'); sky.addColorStop(1, mix('#1d2b45', pal.acc, 0.25));
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(255,255,255,${0.3 + hash(i) * 0.5})`; ctx.fillRect(Math.floor(((hash(i + 1) * W * 3 - x * 0.02) % W + W) % W), Math.floor(hash(i + 2) * H * 0.45), 1, 1); }
      // luna
      ctx.fillStyle = '#f5f1d8'; ctx.beginPath(); ctx.arc(W * 0.78, H * 0.22, 6, 0, Math.PI * 2); ctx.fill();
      // ciudad lejana con ventanitas encendidas
      const far = x * 0.15;
      for (let b = Math.floor(far / 14) - 1; b < (far + W) / 14 + 1; b++) {
        const bx = Math.round(b * 14 - far), bh = 10 + Math.floor(hash(b) * 22), by = H - 22 - bh;
        ctx.fillStyle = '#16233a'; ctx.fillRect(bx, by, 12, bh + 22);
        for (let wy = by + 2; wy < H - 24; wy += 4) for (let wx = bx + 2; wx < bx + 11; wx += 3) if (hash(b * 31 + wy * 7 + wx) > 0.62) { ctx.fillStyle = hash(wx + wy) > 0.5 ? '#f6d27a' : pal.acc2; ctx.fillRect(wx, wy, 1, 1); }
      }
      // terraplén y postes con luz (los suma cada palabra)
      ctx.fillStyle = '#0b1220'; ctx.fillRect(0, H - 20, W, 20);
      for (let i = posts.length - 1; i >= 0; i--) {
        posts[i] -= speed * 1.6 * dt; const px = Math.round(posts[i]);
        if (px < -6) { posts.splice(i, 1); continue; }
        ctx.fillStyle = '#2a3446'; ctx.fillRect(px, H - 52, 2, 34);
        ctx.fillStyle = '#ffe9a8'; ctx.fillRect(px - 2, H - 53, 6, 2);
        ctx.fillStyle = 'rgba(255,233,168,0.12)'; ctx.beginPath(); ctx.moveTo(px - 2, H - 51); ctx.lineTo(px - 12, H - 20); ctx.lineTo(px + 14, H - 20); ctx.lineTo(px + 4, H - 51); ctx.fill();
      }
      // lluvia en el vidrio: más inclinada cuanto más rápido
      if (drops.length < 70) drops.push({ x: Math.random() * W * 1.3, y: -4, len: 2 + Math.random() * 4 });
      const slant = 0.3 + flow * 2.2;
      ctx.strokeStyle = 'rgba(190,220,255,0.45)'; ctx.lineWidth = 1;
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i]; d.y += 80 * dt; d.x -= slant * 80 * dt;
        if (d.y > H || d.x < -10) { drops.splice(i, 1); continue; }
        ctx.beginPath(); ctx.moveTo(Math.round(d.x), Math.round(d.y)); ctx.lineTo(Math.round(d.x + slant * d.len), Math.round(d.y - d.len)); ctx.stroke();
      }
      ctx.restore();
      // marco de la ventanilla, con esquinas redondeadas
      ctx.fillStyle = pal.dark ? '#1b2533' : '#d7dee6';
      ctx.fillRect(0, top, W, 3); ctx.fillRect(0, env.H - 3, W, 3);
      for (let wx = 0; wx < W; wx += Math.max(60, Math.floor(W / 3))) { ctx.fillRect(wx, top, 3, H); ctx.fillRect(wx + 3, top + 3, 1, 1); ctx.fillRect(wx - 1, top + 3, 1, 1); }
    },
  };
}
