import { fmt, levelFor, modeLabel } from '@/lib/format';

describe('modeLabel', () => {
  it('traduce las claves de modo', () => {
    expect(modeLabel('t30')).toBe('30 s');
    expect(modeLabel('w25')).toBe('25 palabras');
    expect(modeLabel('t15-dificil')).toBe('15 s · difícil');
    expect(modeLabel('w100-facil')).toBe('100 palabras · fácil');
  });
  it('tolera valores vacíos o raros sin romperse', () => {
    expect(modeLabel(null)).toBe('test');
    expect(modeLabel(undefined)).toBe('test');
    expect(modeLabel('')).toBe('test');
    expect(modeLabel('t30-inventado')).toBe('30 s'); // vocabulario desconocido: se ignora
  });
});

describe('levelFor', () => {
  it('arranca en nivel 1 con 0 puntos', () => {
    expect(levelFor(0)).toEqual({ lv: 1, pct: 0, next: 150 });
  });
  it('sube de nivel exactamente en el umbral', () => {
    expect(levelFor(149).lv).toBe(1);
    expect(levelFor(150).lv).toBe(2);
    expect(levelFor(600).lv).toBe(3); // 150 * 2²
  });
  it('el progreso siempre queda entre 0 y 1 y lo que falta es positivo', () => {
    for (const xp of [0, 1, 149, 150, 151, 5999, 6000, 1_000_000]) {
      const l = levelFor(xp);
      expect(l.pct).toBeGreaterThanOrEqual(0);
      expect(l.pct).toBeLessThan(1);
      expect(l.next).toBeGreaterThan(0);
    }
  });
});

describe('fmt', () => {
  it('redondea y agrega separador de miles', () => {
    expect(fmt(12345.6)).toBe('12.346');
    expect(fmt(1234.6)).toBe('1235'); // en español los números de 4 cifras van sin punto
    expect(fmt(0)).toBe('0');
  });
});
