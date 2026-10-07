/* Gatito que teje: sentado en su almohadón, teje una bufanda que crece con cada palabra.
   Cada palabra correcta suma una franja (alternando colores del tema); un error deja un nudo rojo.
   Las agujas hacen clic con cada letra. Al terminar el test, corazones. */
import { burst, mix, sprite, stepBits, type Bit } from '@/lib/scenes/pixel';
import type { Scene } from '@/lib/scenes/types';

// f pelaje · d pelaje oscuro · p rosa (orejas, nariz) · e ojo · w panza
const CAT = [
  '.f.....f...',
  '.ff...ff...',
  '.fpffffpf..',
  '.ffffffff..',
  '.fefffeff..',
  '.ffffpfff..',
  '..ffffff...',
  '.ffwwwwff..',
  'fffwwwwfff.',
  'fffwwwwfff.',
  'ffffffffffd',
  '.ffffffffdd',
];
const CAT_BLINK = CAT.map((r, i) => (i === 4 ? '.fdfffdff..' : r));

interface Stripe { col: string; knot: boolean }

export function gato(): Scene {
  const scarf: Stripe[] = [], bits: Bit[] = [];
  let click = 0, colorI = 0, blink = 3, happy = 0;
  return {
    on(e, env) {
      const p = env.pal, cols = [p.acc, p.acc2, p.warn, p.ok];
      if (e.type === 'key' && e.ok) click = 0.12;
      else if (e.type === 'word' && e.ok) { scarf.push({ col: cols[colorI++ % cols.length], knot: false }); if (scarf.length > 60) scarf.shift(); }
      else if (e.type === 'word' && !e.ok) scarf.push({ col: cols[colorI % cols.length], knot: true });
      else if (e.type === 'finish') { happy = 2.5; for (let i = 0; i < 6; i++) burst(bits, env.W * 0.3, env.H - 30, 1, p.err, 25, -15); }
      else if (e.type === 'start') scarf.length = 0;
    },
    frame(ctx, env, dt) {
      const { W, H, pal, t } = env, gy = H - 6, cx = Math.round(W * 0.3);
      ctx.clearRect(0, 0, W, H);
      // piso de madera y una ventana con luz
      ctx.fillStyle = mix(pal.bg, pal.warn, pal.dark ? 0.15 : 0.22); ctx.fillRect(0, gy, W, H - gy);
      for (let x = 0; x < W; x += 16) { ctx.fillStyle = mix(pal.bg, pal.warn, pal.dark ? 0.25 : 0.35); ctx.fillRect(x, gy, 1, H - gy); }
      ctx.fillStyle = mix(pal.bg, pal.acc2, 0.25); ctx.fillRect(cx - 40, gy - 50, 22, 26);
      ctx.fillStyle = mix(pal.bg, pal.ink, 0.25); ctx.fillRect(cx - 30, gy - 50, 1, 26); ctx.fillRect(cx - 40, gy - 38, 22, 1);
      // almohadón
      ctx.fillStyle = mix(pal.acc, pal.err, 0.4); ctx.fillRect(cx - 9, gy - 3, 19, 3);
      // el gato (parpadea de vez en cuando, se mece contento al terminar)
      blink -= dt; if (blink < -0.12) blink = 2 + Math.random() * 3;
      happy = Math.max(0, happy - dt); click = Math.max(0, click - dt);
      const sway = happy > 0 ? Math.round(Math.sin(t * 10)) : 0;
      sprite(ctx, blink < 0 ? CAT_BLINK : CAT, { f: pal.dark ? '#e8a35c' : '#f0a55a', d: '#c97f3a', p: '#f6a1b4', e: pal.ink, w: '#fff4e6' }, cx + sway, gy - 3);
      // agujas cruzadas (se mueven con cada letra)
      ctx.fillStyle = '#9aa7b4';
      const n = click > 0 ? 1 : 0;
      for (let k = 0; k < 7; k++) { ctx.fillRect(cx - 2 + k, gy - 9 - k + n, 1, 1); ctx.fillRect(cx + 4 - k, gy - 9 - k - n, 1, 1); }
      // la bufanda: sale de las agujas y se acomoda en el piso hacia la derecha
      let x = cx + 6, y = gy - 7;
      scarf.forEach((s, i) => {
        // primero baja, después se extiende sobre el piso en zigzag suave
        if (i < 5) { y += 1; x += 1; } else { x += 3; y = gy - 3 + (Math.floor(i / 8) % 2); }
        if (x > W - 4) return;
        ctx.fillStyle = s.col; ctx.fillRect(x, y, 3, 3);
        if (s.knot) { ctx.fillStyle = pal.err; ctx.fillRect(x + 1, y + 1, 1, 1); }
        else if (i % 2) { ctx.fillStyle = mix(s.col, '#ffffff', 0.4); ctx.fillRect(x + 1, y, 1, 3); }
      });
      // ovillo
      ctx.fillStyle = pal.acc; ctx.beginPath(); ctx.arc(cx - 13, gy - 3, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = pal.acc2; ctx.fillRect(cx - 14, gy - 4, 2, 1);
      stepBits(ctx, bits, dt);
      // corazones que suben al terminar
      if (happy > 0) for (let i = 0; i < 3; i++) {
        const hy = gy - 20 - ((t * 12 + i * 9) % 30), hx = cx - 4 + i * 5 + Math.round(Math.sin(t * 3 + i));
        ctx.fillStyle = pal.err; ctx.fillRect(hx, hy, 1, 1); ctx.fillRect(hx + 2, hy, 1, 1); ctx.fillRect(hx, hy + 1, 3, 1); ctx.fillRect(hx + 1, hy + 2, 1, 1);
      }
    },
  };
}
