import { SENTENCES, VOCAB, WORDS, passage, wordGen } from '@/lib/tecla/data/words';

describe('vocabularios', () => {
  it('cada nivel respeta sus largos', () => {
    expect(VOCAB.facil.every((w: string) => w.length <= 7)).toBe(true);
    expect(VOCAB.medio.every((w: string) => w.length >= 4 && w.length <= 11)).toBe(true);
    expect(VOCAB.dificil.every((w: string) => w.length >= 8 && w.length <= 17)).toBe(true);
  });
  it('solo minúsculas (con tildes, ñ y ü), sin espacios ni símbolos', () => {
    for (const w of WORDS) expect(w).toMatch(/^\p{Ll}+$/u);
  });
  it('no hay palabras repetidas dentro de un nivel', () => {
    for (const k of ['facil', 'medio', 'dificil']) expect(new Set(VOCAB[k]).size).toBe(VOCAB[k].length);
  });
  it('hay suficientes palabras para no repetir enseguida', () => {
    expect(VOCAB.facil.length).toBeGreaterThan(500);
    expect(VOCAB.medio.length).toBeGreaterThan(500);
    expect(VOCAB.dificil.length).toBeGreaterThan(300);
  });
});

describe('wordGen', () => {
  it('es reproducible con la misma semilla (fantasma y desafío diario dependen de esto)', () => {
    const a = wordGen(1234)(60), b = wordGen(1234)(60);
    expect(a).toEqual(b);
    expect(wordGen(1235)(60)).not.toEqual(a);
  });
  it('pedir en tandas da la misma secuencia que pedir todo junto', () => {
    const g1 = wordGen(99), g2 = wordGen(99);
    const tandas = [...g1(10), ...g1(1), ...g1(29)];
    expect(tandas).toEqual(g2(40));
  });
  it('recorre toda la lista antes de repetir una palabra', () => {
    const list = ['uno', 'dos', 'tres', 'cuatro', 'cinco'];
    const out = wordGen(7, list)(5);
    expect(new Set(out).size).toBe(5);
  });
  it('nunca pone la misma palabra dos veces seguidas (salvo lista de una sola)', () => {
    const out = wordGen(3, ['a', 'b'])(200);
    for (let i = 1; i < out.length; i++) expect(out[i]).not.toBe(out[i - 1]);
    expect(wordGen(3, ['solo'])(3)).toEqual(['solo', 'solo', 'solo']);
  });
  it('pedir 0 palabras devuelve lista vacía', () => {
    expect(wordGen(1)(0)).toEqual([]);
  });
  it('una lista vacía es un error explícito, no palabras undefined', () => {
    expect(() => wordGen(1, [])(3)).toThrow();
  });
});

describe('passage', () => {
  it('junta frases enteras hasta llegar al mínimo de palabras', () => {
    const words = passage(20260923, 30);
    expect(words.length).toBeGreaterThanOrEqual(30);
    const text = words.join(' ');
    expect(SENTENCES.some((s: string) => text.startsWith(s))).toBe(true);
  });
  it('mismo día, mismo texto', () => {
    expect(passage(20260923, 30)).toEqual(passage(20260923, 30));
  });
  it('si el mínimo supera todas las frases, devuelve todas sin colgarse', () => {
    const all = SENTENCES.join(' ').split(' ').length;
    expect(passage(1, 1_000_000).length).toBe(all);
  });
  it('mínimo 0 devuelve texto vacío', () => {
    expect(passage(1, 0)).toEqual([]);
  });
});
