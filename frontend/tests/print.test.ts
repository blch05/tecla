import { buildPrint } from '@/lib/tecla/print';
import type { Stroke } from '@/lib/tecla/typebox';

const strokes = (dts: number[], bad: number[] = [], spaces: number[] = []): Stroke[] => {
  let t = 0;
  return dts.map((d, i) => { t += d; return { t, ok: !bad.includes(i), space: spaces.includes(i) }; });
};

describe('huella de tipeo', () => {
  it('con menos de dos pulsaciones no dibuja nada', () => {
    expect(buildPrint([]).segs).toHaveLength(0);
    expect(buildPrint(strokes([100])).segs).toHaveLength(0);
  });
  it('un segmento por pulsación, dentro del lienzo', () => {
    const p = buildPrint(strokes(Array(80).fill(120)), 400);
    expect(p.segs).toHaveLength(79);
    for (const s of p.segs) for (const v of [s.x1, s.y1, s.x2, s.y2]) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(400); }
  });
  it('marca errores y fines de palabra', () => {
    const p = buildPrint(strokes(Array(10).fill(100), [3, 7], [5]));
    expect(p.errs).toHaveLength(2);
    expect(p.words).toHaveLength(1);
  });
  it('es determinista y el ritmo cambia la forma', () => {
    const a = strokes(Array(40).fill(100)), b = strokes(Array(40).fill(0).map((_, i) => (i % 2 ? 60 : 240)));
    expect(buildPrint(a)).toEqual(buildPrint(a));
    expect(buildPrint(a).segs.at(-1)).not.toEqual(buildPrint(b).segs.at(-1));
  });
  it('ir más rápido que tu ritmo hace el trazo más grueso', () => {
    const p = buildPrint(strokes([100, 100, 100, 100, 30, 100, 100, 400]));
    const w = p.segs.map(s => s.w);
    expect(w[3]).toBeGreaterThan(w[2]);   // la pulsación rápida
    expect(w[6]).toBeLessThan(w[2]);      // la pausa larga
  });
});
