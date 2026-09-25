// Genera los paquetes de sonido de teclado de la tienda (public/sounds/*.wav), sintetizados desde cero:
// no dependen de grabaciones de terceros. Cada archivo es un "sprite" para Howler con la misma distribución
// que SPRITE en src/lib/shop/sounds.ts. Uso: node scripts/gen-sounds.mjs
import { writeFileSync } from 'node:fs';

const SR = 22050, SLOT = 0.16, END_AT = 0.96, END_LEN = 1.0;
const NAMES = ['k0', 'k1', 'k2', 'k3', 'sp', 'err'];

let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
const buf = s => new Float32Array(Math.round(s * SR));
const env = (t, a, d) => (t < a ? t / a : Math.exp(-(t - a) / d));

// filtro biquad (RBJ)
function biquad(x, type, f, q = 0.8) {
  const w = 2 * Math.PI * f / SR, al = Math.sin(w) / (2 * q), c = Math.cos(w);
  let b0, b1, b2, a0 = 1 + al, a1 = -2 * c, a2 = 1 - al;
  if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; }
  else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; }
  else { b0 = al; b1 = 0; b2 = -al; }
  const y = new Float32Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) { const v = (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; }
  return y;
}
const noise = (len, a, d, at = 0) => { const b = buf(len); for (let i = 0; i < b.length; i++) { const t = i / SR - at; b[i] = t < 0 ? 0 : rnd() * env(t, a, d); } return b; };
const tone = (len, f0, d, { f1 = f0, glide = 0.05, wave = 'sin', a = 0.002, at = 0 } = {}) => {
  const b = buf(len); let ph = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR - at; if (t < 0) continue;
    const f = f1 === f0 ? f0 : f0 * Math.pow(f1 / f0, Math.min(1, t / glide)); ph += 2 * Math.PI * f / SR;
    const s = wave === 'sq' ? Math.sign(Math.sin(ph)) * 0.5 : Math.sin(ph);
    b[i] = s * env(t, a, d);
  }
  return b;
};
const mix = (...parts) => { const n = Math.max(...parts.map(p => p[0].length)), o = new Float32Array(n); for (const [p, g] of parts) for (let i = 0; i < p.length; i++) o[i] += p[i] * g; return o; };
const norm = (b, peak = 0.8) => { let m = 0; for (const v of b) m = Math.max(m, Math.abs(v)); if (m) for (let i = 0; i < b.length; i++) b[i] *= peak / m; return b; };
const crush = (b, steps = 16) => b.map(v => Math.round(v * steps) / steps);

const L = 0.15; // largo de cada sonido corto
const PACKS = {
  cremoso: {
    key: v => mix([biquad(noise(L, 0.001, 0.012), 'lp', 1300 + v * 120), 0.9], [tone(L, 170 + v * 9, 0.035, { f1: 120, glide: 0.04 }), 0.8], [biquad(noise(L, 0.001, 0.008, 0.02), 'lp', 900), 0.35]),
    sp: () => mix([biquad(noise(L, 0.001, 0.02), 'lp', 850), 0.9], [tone(L, 115, 0.05, { f1: 80, glide: 0.05 }), 0.9]),
    err: () => mix([biquad(noise(L, 0.001, 0.02), 'lp', 600), 0.8], [tone(L, 105, 0.06, { f1: 70 }), 0.9]),
    end: () => mix([tone(END_LEN, 659, 0.35), 0.5], [tone(END_LEN, 988, 0.3, { at: 0.09 }), 0.4]),
  },
  azul: {
    key: v => mix([biquad(noise(L, 0.0005, 0.002), 'hp', 3200), 1], [biquad(noise(L, 0.0005, 0.003, 0.009), 'hp', 2600), 0.8], [biquad(noise(L, 0.001, 0.018, 0.012), 'bp', 2400 + v * 300, 1.4), 0.6]),
    sp: () => mix([biquad(noise(L, 0.0005, 0.003), 'hp', 2400), 0.9], [biquad(noise(L, 0.001, 0.03, 0.01), 'bp', 1300, 1.2), 0.8], [biquad(noise(L, 0.001, 0.004, 0.045), 'hp', 2000), 0.4]),
    err: () => mix([biquad(noise(L, 0.0005, 0.003), 'hp', 1800), 0.9], [tone(L, 220, 0.05, { f1: 150, wave: 'sq' }), 0.3]),
    end: () => mix([tone(END_LEN, 1319, 0.25), 0.5], [tone(END_LEN, 1760, 0.3, { at: 0.08 }), 0.45]),
  },
  burbujas: {
    key: v => mix([tone(L, 380 + v * 70, 0.045, { f1: 760 + v * 120, glide: 0.04, a: 0.004 }), 1]),
    sp: () => mix([tone(L, 240, 0.07, { f1: 520, glide: 0.06, a: 0.006 }), 1]),
    err: () => mix([tone(L, 520, 0.06, { f1: 200, glide: 0.06, a: 0.004 }), 1]),
    end: () => mix([tone(END_LEN, 400, 0.05, { f1: 800, glide: 0.04 }), 1], [tone(END_LEN, 500, 0.05, { f1: 1000, glide: 0.04, at: 0.1 }), 1], [tone(END_LEN, 600, 0.08, { f1: 1300, glide: 0.05, at: 0.2 }), 1]),
  },
  retro: {
    key: v => crush(tone(L, [1047, 1319, 1568, 1760][v], 0.03, { wave: 'sq' })),
    sp: () => crush(tone(L, 523, 0.04, { wave: 'sq' })),
    err: () => crush(tone(L, 147, 0.07, { f1: 98, glide: 0.08, wave: 'sq' })),
    end: () => crush(mix(...[523, 659, 784, 1047].map((f, i) => [tone(END_LEN, f, i === 3 ? 0.25 : 0.05, { wave: 'sq', at: i * 0.09 }), 1]))),
  },
  antigua: {
    key: v => mix([biquad(noise(L, 0.0003, 0.003), 'hp', 2500), 1], ...[2300, 3700, 5100].map((f, i) => [tone(L, f * (1 + v * 0.02), 0.03 - i * 0.006), 0.25]), [biquad(noise(L, 0.001, 0.02, 0.004), 'lp', 320), 0.9]),
    sp: () => mix([biquad(noise(L, 0.001, 0.035), 'lp', 260), 1], ...[0.03, 0.05, 0.07].map(at => [biquad(noise(L, 0.0003, 0.002, at), 'hp', 2800), 0.5])),
    err: () => mix([biquad(noise(L, 0.0003, 0.004), 'hp', 1500), 0.8], [tone(L, 90, 0.06, { wave: 'sq' }), 0.5]),
    end: () => mix([tone(END_LEN, 2093, 0.35), 1], [tone(END_LEN, 4186, 0.2), 0.35], [tone(END_LEN, 6280, 0.12), 0.18]), // la campanita del carro
  },
};

function wav(samples) {
  const b = Buffer.alloc(44 + samples.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + samples.length * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((v, i) => b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(v * 32767))), 44 + i * 2));
  return b;
}

for (const [name, p] of Object.entries(PACKS)) {
  const out = buf(END_AT + END_LEN);
  const put = (s, at) => { const o = Math.round(at * SR); for (let i = 0; i < s.length && o + i < out.length; i++) out[o + i] = s[i]; };
  NAMES.forEach((n, i) => put(norm(n[0] === 'k' ? p.key(i) : p[n](), n === 'err' ? 0.55 : 0.8).slice(0, Math.round(L * SR)), i * SLOT));
  put(norm(p.end(), 0.6), END_AT);
  // un fundido al final de cada sonido corto para que no haga clic al cortarse
  NAMES.forEach((_, i) => { const e = Math.round((i * SLOT + L) * SR); for (let k = 0; k < 60; k++) out[e - k] *= k / 60; });
  writeFileSync(new URL(`../public/sounds/${name}.wav`, import.meta.url), wav(out));
  console.log(name, out.length, 'muestras');
}
