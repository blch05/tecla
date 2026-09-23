// @ts-nocheck — módulo portado del prototipo; pendiente de tipar (ver README)
import { avg, baseKey, store } from '@/lib/tecla/utils';
import { WORDS, wordGen } from '@/lib/tecla/data/words';

/* =========================================================
   estadísticas de teclas (heatmap)
   ========================================================= */
export const KS: any = { keys: store.get('keys', {}), bi: store.get('bi', {}), dirty: false };
export const isLetter = c => /^\p{L}$/u.test(c);
export function recordKey(exp, got, dt, prev) {
  if (!isLetter(exp)) return;
  const k = baseKey(exp);
  const s = KS.keys[k] || (KS.keys[k] = { n: 0, e: 0, t: 0, c: 0 });
  s.n++;
  if (got !== exp) s.e++; else if (dt > 0 && dt < 1500) { s.t += dt; s.c++; }
  if (prev && isLetter(prev)) {
    const bk = baseKey(prev) + k; const b = KS.bi[bk] || (KS.bi[bk] = { n: 0, t: 0, e: 0 });
    if (got !== exp) b.e++; else if (dt > 0 && dt < 1500) { b.n++; b.t += dt; }
  }
  KS.dirty = true;
}
export function saveKS() { if (KS.dirty) { store.set('keys', KS.keys); store.set('bi', KS.bi); KS.dirty = false; } }
export function weakData() {
  const ks = Object.entries(KS.keys).filter(([, v]) => v.n >= 5).map(([k, v]) => ({ k, n: v.n, err: v.e / v.n, ms: v.c ? v.t / v.c : 0 }));
  const bis = Object.entries(KS.bi).filter(([, v]) => v.n + v.e >= 4).map(([b, v]) => ({ b, n: v.n + v.e, err: v.e / (v.n + v.e), ms: v.n ? v.t / v.n : 0 }));
  return { ks, bis };
}
export function weakWordGen(seed) {
  const { ks, bis } = weakData();
  const kMs = avg(ks.filter(x => x.ms).map(x => x.ms)) || 200, bMs = avg(bis.filter(x => x.ms).map(x => x.ms)) || 200;
  const kw = {}, bw = {};
  ks.forEach(x => kw[x.k] = x.err * 5 + Math.max(0, (x.ms - kMs) / kMs));
  bis.forEach(x => bw[x.b] = x.err * 6 + Math.max(0, (x.ms - bMs) / bMs));
  const scored = WORDS.filter(w => w.length >= 3).map(w => {
    const n = [...w].map(baseKey); let s = 0;
    n.forEach((c, i) => { s += kw[c] || 0; if (i) s += bw[n[i - 1] + c] || 0; });
    return [w, s / Math.sqrt(w.length)];
  }).sort((a, b) => b[1] - a[1]);
  return wordGen(seed, scored.slice(0, 45).map(x => x[0]));
}
