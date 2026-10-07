/* Herramientas para las escenas: colores del tema, sprites como texto, una fuente de 3×5 y partículas. */
import { cssColor } from '@/lib/theme';
import type { Palette } from '@/lib/scenes/types';

type RGB = [number, number, number];
const parse = (c: string): RGB => {
  const m = c.trim().match(/^#?([0-9a-f]{6})$/i) || c.trim().match(/^#?([0-9a-f]{3})$/i);
  if (!m) { const r = c.match(/\d+(\.\d+)?/g); return r && r.length >= 3 ? [+r[0], +r[1], +r[2]] : [255, 255, 255]; }
  const h = m[1].length === 3 ? [...m[1]].map(x => x + x).join('') : m[1], n = parseInt(h, 16);
  return [n >> 16 & 255, n >> 8 & 255, n & 255];
};
export const mix = (a: string, b: string, k: number) => {
  const x = parse(a), y = parse(b);
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * k)).join(',')})`;
};

export function readPalette(): Palette {
  const g = (n: string, d: string) => cssColor(n, d);
  return {
    bg: g('--bg', '#ffffff'), ink: g('--ink', '#1D2B38'), sub: g('--sub', '#4E5D6C'), acc: g('--accent', '#34A3F0'), acc2: g('--accent-2', '#92D2FF'),
    soft: g('--soft', '#F0F8FF'), dim: g('--dim', '#D6E8F7'), err: g('--err', '#F0607A'), ok: g('--ok', '#1DB386'), warn: g('--warn', '#F2B13C'),
    dark: document.documentElement.dataset.theme === 'dark', mix,
  };
}

/**
 * Dibuja un sprite escrito como texto: cada carácter es un píxel, "." es transparente
 * y los demás se buscan en `colors`. `x`/`y` es la esquina de abajo al centro (los pies).
 */
export function sprite(ctx: CanvasRenderingContext2D, rows: readonly string[], colors: Record<string, string>, x: number, y: number, flip = false) {
  const h = rows.length, w = rows[0].length, ox = Math.round(x - w / 2), oy = Math.round(y - h);
  for (let r = 0; r < h; r++) {
    const row = rows[r];
    for (let c = 0; c < w; c++) {
      const ch = row[flip ? w - 1 - c : c];
      if (ch === '.' || ch === ' ') continue;
      const col = colors[ch]; if (!col) continue;
      ctx.fillStyle = col; ctx.fillRect(ox + c, oy + r, 1, 1);
    }
  }
}

/* fuente de 3×5 para números y letras de puntaje (S A B C D, x, +) */
const GLYPHS: Record<string, string> = {
  '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111', '4': '101101111001001',
  '5': '111100111001111', '6': '111100111101111', '7': '111001010010010', '8': '111101111101111', '9': '111101111001111',
  S: '111100111001111', A: '010101111101101', B: '110101110101110', C: '111100100100111', D: '110101101101110',
  x: '000101010101000', '+': '000010111010000', '-': '000000111000000', '!': '010010010000010', ' ': '000000000000000', '♥': '000101111111010',
};
export function pixelText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, scale = 1) {
  ctx.fillStyle = color;
  let cx = Math.round(x);
  for (const ch of text) {
    const g = GLYPHS[ch] || GLYPHS[' '];
    for (let i = 0; i < 15; i++) if (g[i] === '1') ctx.fillRect(cx + (i % 3) * scale, Math.round(y) + Math.floor(i / 3) * scale, scale, scale);
    cx += 4 * scale;
  }
}
export const pixelTextWidth = (text: string, scale = 1) => text.length * 4 * scale - scale;

/* partículas cuadradas (chispas, gotas, pétalos) */
export interface Bit { x: number; y: number; vx: number; vy: number; life: number; col: string; g: number; size: number }
export function burst(list: Bit[], x: number, y: number, n: number, col: string, speed = 40, g = 60, size = 1) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = speed * (0.4 + Math.random() * 0.8);
    list.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.3, life: 0.5 + Math.random() * 0.5, col, g, size });
  }
}
export function stepBits(ctx: CanvasRenderingContext2D, list: Bit[], dt: number) {
  for (let i = list.length - 1; i >= 0; i--) {
    const b = list[i];
    b.life -= dt; if (b.life <= 0) { list.splice(i, 1); continue; }
    b.vy += b.g * dt; b.x += b.vx * dt; b.y += b.vy * dt;
    ctx.globalAlpha = Math.min(1, b.life * 2); ctx.fillStyle = b.col;
    ctx.fillRect(Math.round(b.x), Math.round(b.y), b.size, b.size);
  }
  ctx.globalAlpha = 1;
}

/** pseudoaleatorio estable por número (para ubicar cosas siempre en el mismo lugar) */
export const hash = (n: number) => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };
