/* Insignias animadas de la tienda, armadas en código como animaciones Lottie (las reproduce lottie-web).
   Hechas a mano con formas simples, así no dependen de archivos de terceros. */
type V = number[];
const FR = 30, OP = 60; // 2 segundos en bucle

const st = (k: unknown) => ({ a: 0, k });
/** propiedad animada: [cuadro, valor][] con curva suave */
const kf = (keys: [number, V][]) => ({
  a: 1,
  k: keys.map(([t, s], i) => (i < keys.length - 1 ? { t, s, i: { x: [0.45], y: [1] }, o: { x: [0.55], y: [0] } } : { t, s })),
});
const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).concat(1);
const fill = (hex: string) => ({ ty: 'fl', c: st(rgb(hex)), o: st(100), r: 1 });
const tr = () => ({ ty: 'tr', p: st([0, 0]), a: st([0, 0]), s: st([100, 100]), r: st(0), o: st(100) });
const path = (v: [number, number][]) => ({ ty: 'sh', ks: st({ i: v.map(() => [0, 0]), o: v.map(() => [0, 0]), v, c: true }) });
const circle = (x: number, y: number, d: number) => ({ ty: 'el', p: st([x, y]), s: st([d, d]), d: 1 });
const rect = (x: number, y: number, w: number, h: number) => ({ ty: 'rc', p: st([x, y]), s: st([w, h]), r: st(2), d: 1 });
const group = (color: string, ...items: object[]) => ({ ty: 'gr', it: [...items, fill(color), tr()] });
const star = (outer: number, inner: number) => path(Array.from({ length: 10 }, (_, i) => {
  const r = i % 2 ? inner : outer, a = -Math.PI / 2 + i * Math.PI / 5;
  return [Math.round(Math.cos(a) * r * 10) / 10, Math.round(Math.sin(a) * r * 10) / 10] as [number, number];
}));

interface Tf { o?: object; r?: object; p?: object; s?: object }
const layer = (ind: number, shapes: object[], t: Tf = {}) => ({
  ddd: 0, ind, ty: 4, nm: 'l' + ind, sr: 1, ao: 0, ip: 0, op: OP, st: 0, bm: 0,
  ks: { o: t.o || st(100), r: t.r || st(0), p: t.p || st([50, 50, 0]), a: st([0, 0, 0]), s: t.s || st([100, 100, 100]) },
  shapes,
});
const anim = (layers: object[]) => ({ v: '5.7.4', fr: FR, ip: 0, op: OP, w: 100, h: 100, nm: 'insignia', ddd: 0, assets: [], layers });

const BADGES: Record<string, () => object> = {
  estrella: () => anim([
    layer(1, [group('#FFF4C2', circle(0, 0, 7))], { p: st([74, 24, 0]), o: kf([[0, [0]], [20, [100]], [40, [0]], [60, [0]]]) }),
    layer(2, [group('#FFE08A', star(13, 5.5))], { r: kf([[0, [0]], [60, [-72]]]) }),
    layer(3, [group('#F2B13C', star(34, 15))], { r: kf([[0, [0]], [60, [72]]]), s: kf([[0, [100, 100, 100]], [30, [112, 112, 100]], [60, [100, 100, 100]]]) }),
  ]),
  rayo: () => anim([
    layer(1, [group('#F2C12E', path([[2, -38], [-18, 6], [-3, 6], [-10, 38], [18, -8], [3, -8], [16, -38]]))], {
      s: kf([[0, [85, 85, 100]], [5, [114, 114, 100]], [10, [100, 100, 100]], [60, [100, 100, 100]]]),
      o: kf([[0, [100]], [36, [100]], [38, [35]], [40, [100]], [42, [50]], [44, [100]], [60, [100]]]),
    }),
  ]),
  corazon: () => anim([
    layer(1, [group('#F0607A', circle(-12, -8, 30), circle(12, -8, 30), path([[-25.5, -2], [25.5, -2], [0, 30]]))], {
      s: kf([[0, [100, 100, 100]], [6, [118, 118, 100]], [12, [100, 100, 100]], [18, [112, 112, 100]], [24, [100, 100, 100]], [60, [100, 100, 100]]]),
    }),
  ]),
  corona: () => anim([
    layer(1, [
      group('#F0607A', circle(0, -23, 9)), group('#34A3F0', circle(-28, -11, 8)), group('#1DB386', circle(28, -11, 8)),
      group('#D9A21B', rect(0, 13, 56, 8)),
      group('#F2B13C', path([[-28, 16], [-28, -8], [-14, 4], [0, -20], [14, 4], [28, -8], [28, 16]])),
    ], {
      p: kf([[0, [50, 54, 0]], [30, [50, 48, 0]], [60, [50, 54, 0]]]),
      r: kf([[0, [-5]], [30, [5]], [60, [-5]]]),
    }),
  ]),
};

export const badgeAnim = (fx: string) => BADGES[fx]?.() ?? null;
export const BADGE_IDS = Object.keys(BADGES);
