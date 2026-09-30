import { avg, baseKey, store } from '@/lib/tecla/utils';
import { WORDS, wordGen } from '@/lib/tecla/data/words';

/* =========================================================
   estadísticas de teclas (heatmap) y de pares de teclas (bigramas)
   ========================================================= */

/** por tecla: pulsaciones, errores, ms acumulados y cuántas pulsaciones entraron en esos ms */
export interface KeyStat { n: number; e: number; t: number; c: number }
/** por bigrama: aciertos, ms acumulados y errores */
export interface BigramStat { n: number; t: number; e: number }

export const KS = {
  keys: store.get<Record<string, KeyStat>>('keys', {}),
  bi: store.get<Record<string, BigramStat>>('bi', {}),
  dirty: false,
};

/** pausas más largas no cuentan para la velocidad: el usuario se distrajo */
const MAX_DT = 1500;

export const isLetter = (c: string) => /^\p{L}$/u.test(c);

/** Registra una pulsación: `exp` la letra esperada, `got` la escrita, `dt` ms desde la anterior y `prev` la anterior si fue correcta. */
export function recordKey(exp: string, got: string, dt: number, prev: string | null) {
  if (!isLetter(exp)) return;
  const k = baseKey(exp);
  const s = KS.keys[k] || (KS.keys[k] = { n: 0, e: 0, t: 0, c: 0 });
  s.n++;
  if (got !== exp) s.e++; else if (dt > 0 && dt < MAX_DT) { s.t += dt; s.c++; }
  if (prev && isLetter(prev)) {
    const bk = baseKey(prev) + k; const b = KS.bi[bk] || (KS.bi[bk] = { n: 0, t: 0, e: 0 });
    if (got !== exp) b.e++; else if (dt > 0 && dt < MAX_DT) { b.n++; b.t += dt; }
  }
  KS.dirty = true;
}

export function saveKS() { if (KS.dirty) { store.set('keys', KS.keys); store.set('bi', KS.bi); KS.dirty = false; } }

export interface WeakKey { k: string; n: number; err: number; ms: number }
export interface WeakBigram { b: string; n: number; err: number; ms: number }

/** Teclas y bigramas con suficientes muestras, con su tasa de error y sus ms promedio. */
export function weakData(): { ks: WeakKey[]; bis: WeakBigram[] } {
  const ks = Object.entries(KS.keys).filter(([, v]) => v.n >= 5).map(([k, v]) => ({ k, n: v.n, err: v.e / v.n, ms: v.c ? v.t / v.c : 0 }));
  const bis = Object.entries(KS.bi).filter(([, v]) => v.n + v.e >= 4).map(([b, v]) => ({ b, n: v.n + v.e, err: v.e / (v.n + v.e), ms: v.n ? v.t / v.n : 0 }));
  return { ks, bis };
}

/** Palabras que ejercitan tus puntos débiles: cada letra y bigrama suma según su error y cuánto más lento es que tu promedio. */
export function weakWordGen(seed: number) {
  const { ks, bis } = weakData();
  const kMs = avg(ks.filter(x => x.ms).map(x => x.ms)) || 200, bMs = avg(bis.filter(x => x.ms).map(x => x.ms)) || 200;
  const kw: Record<string, number> = {}, bw: Record<string, number> = {};
  ks.forEach(x => { kw[x.k] = x.err * 5 + Math.max(0, (x.ms - kMs) / kMs); });
  bis.forEach(x => { bw[x.b] = x.err * 6 + Math.max(0, (x.ms - bMs) / bMs); });
  const scored = WORDS.filter(w => w.length >= 3).map(w => {
    const n = [...w].map(baseKey); let s = 0;
    n.forEach((c, i) => { s += kw[c] || 0; if (i) s += bw[n[i - 1] + c] || 0; });
    return [w, s / Math.sqrt(w.length)] as const;
  }).sort((a, b) => b[1] - a[1]);
  return wordGen(seed, scored.slice(0, 45).map(x => x[0]));
}
