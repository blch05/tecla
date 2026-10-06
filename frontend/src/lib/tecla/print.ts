/* =========================================================
   Huella de tipeo: convierte las pulsaciones de un test en una espiral única.
   - cada pulsación es un paso de la espiral, que crece de adentro hacia afuera;
   - las pausas largas avanzan más ángulo (el ritmo dibuja la forma);
   - el trazo es más grueso cuando ibas rápido;
   - los errores quedan marcados y cada fin de palabra deja un punto.
   Es determinista: el mismo test da siempre el mismo dibujo.
   ========================================================= */
import type { Stroke } from '@/lib/tecla/typebox';

export interface PrintSeg { x1: number; y1: number; x2: number; y2: number; w: number; k: number }
export interface Print { size: number; segs: PrintSeg[]; errs: [number, number][]; words: [number, number][] }

const median = (a: number[]) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

export function buildPrint(strokes: Stroke[], size = 400): Print {
  const c = size / 2, n = strokes.length;
  const segs: PrintSeg[] = [], errs: [number, number][] = [], words: [number, number][] = [];
  if (n < 2) return { size, segs, errs, words };
  const dts = strokes.map((s, i) => (i ? Math.max(1, s.t - strokes[i - 1].t) : 0)).slice(1);
  const med = median(dts) || 150;
  const rMin = size * 0.07, rMax = size * 0.46;
  let a = -Math.PI / 2, px = c, py = c - rMin;
  for (let i = 1; i < n; i++) {
    const rel = Math.min(3, Math.max(0.25, dts[i - 1] / med));
    // una pausa larga gira más; el radio crece parejo y "tiembla" con la irregularidad del ritmo
    a += 0.16 + rel * 0.2;
    const r = rMin + (rMax - rMin) * (i / (n - 1)) + (rel - 1) * size * 0.012;
    const x = c + Math.cos(a) * r, y = c + Math.sin(a) * r;
    segs.push({ x1: px, y1: py, x2: x, y2: y, w: Math.max(0.6, 3.4 - rel * 1.1) * (size / 400), k: i / (n - 1) });
    if (!strokes[i].ok) errs.push([x, y]);
    else if (strokes[i].space) words.push([x, y]);
    px = x; py = y;
  }
  return { size, segs, errs, words };
}
