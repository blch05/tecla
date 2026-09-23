import { TypeBox } from '@/lib/tecla/typebox';

function setup(words: string[], opts: Record<string, unknown> = {}, cb: Record<string, unknown> = {}) {
  const root = document.createElement('div');
  document.body.append(root);
  const box = new TypeBox(root, cb);
  box.load(words, opts);
  return box;
}
const type = (box: any, s: string) => { for (const c of s) box.char(c); };

beforeEach(() => { vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] }); });
afterEach(() => { vi.useRealTimers(); });

describe('TypeBox: conteo', () => {
  it('espacio al principio o con la palabra vacía no hace nada', () => {
    const b = setup(['hola', 'mundo']);
    b.char(' '); b.char(' ');
    expect(b.wi).toBe(0);
    expect(b.t0).toBe(0); // el test no arrancó
    type(b, 'hola '); b.char(' ');
    expect(b.wi).toBe(1);
  });
  it('cuenta letras correctas solo de palabras bien escritas (más el espacio)', () => {
    const b = setup(['hola', 'mundo', 'feliz']);
    type(b, 'hola mundi ');
    const c = b.counts();
    expect(c.correct).toBe(5);    // "hola " sí, "mundi " no
    expect(c.all).toBe(11);       // todo lo tipeado
  });
  it('la palabra actual suma solo si lo tipeado hasta ahora es correcto', () => {
    const b = setup(['hola', 'mundo']);
    type(b, 'ho');
    expect(b.counts().correct).toBe(2);
    type(b, 'x');
    expect(b.counts().correct).toBe(0);
  });
  it('limita las letras de más a 10 por palabra', () => {
    const b = setup(['sol', 'luna']);
    type(b, 'sol' + 'x'.repeat(30));
    expect(b.typed[0].length).toBe(13);
  });
  it('borrar con la palabra vacía vuelve a la anterior solo si tenía errores', () => {
    const b = setup(['uno', 'dos', 'tres']);
    type(b, 'uno ');
    b.back(false);
    expect(b.wi).toBe(1); // "uno" estaba bien: no se puede volver
    type(b, 'dso ');
    b.back(false);
    expect(b.wi).toBe(1); // "dso" estaba mal: vuelve a corregirla
    expect(b.typed[1]).toBe('dso');
  });
  it('ctrl+borrar vacía la palabra entera', () => {
    const b = setup(['palabra', 'otra']);
    type(b, 'pala');
    b.back(true);
    expect(b.typed[0]).toBe('');
  });
  it('borrar antes de empezar no rompe nada', () => {
    const b = setup(['a']);
    expect(() => b.back(false)).not.toThrow();
    expect(b.wi).toBe(0);
  });
});

describe('TypeBox: fin del test', () => {
  it('termina al escribir bien la última palabra, sin necesidad de espacio', () => {
    const onFinish = vi.fn();
    const b = setup(['hola', 'chau'], {}, { onFinish });
    type(b, 'hola cha');
    expect(onFinish).not.toHaveBeenCalled();
    b.char('u');
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(b.done).toBe(true);
  });
  it('con la última palabra mal, termina recién con el espacio', () => {
    const onFinish = vi.fn();
    const b = setup(['hola', 'chau'], {}, { onFinish });
    type(b, 'hola chai');
    expect(onFinish).not.toHaveBeenCalled();
    b.char(' ');
    expect(onFinish).toHaveBeenCalledTimes(1);
  });
  it('después de terminar ignora las teclas', () => {
    const b = setup(['a']);
    type(b, 'a');
    const typed = JSON.stringify(b.typed);
    type(b, 'bcd '); b.back(false);
    expect(JSON.stringify(b.typed)).toBe(typed);
  });
  it('en modo tiempo termina solo cuando se acaba el reloj', () => {
    const onFinish = vi.fn();
    const words = Array.from({ length: 50 }, () => 'palabra');
    const b = setup(words, { time: 5, extend: (n: number) => Array(n).fill('mas') }, { onFinish });
    type(b, 'palabra ');
    vi.advanceTimersByTime(4900);
    expect(onFinish).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(onFinish).toHaveBeenCalledTimes(1);
    const s = onFinish.mock.calls[0][0];
    expect(s.secs).toBeGreaterThanOrEqual(5);
    expect(s.secs).toBeLessThan(5.5);
  });
  it('en modo infinito agrega palabras antes de quedarse sin texto', () => {
    const extend = vi.fn((n: number) => Array(n).fill('x'));
    const b = setup(Array(31).fill('x'), { extend });
    for (let i = 0; i < 5; i++) type(b, 'x ');
    expect(extend).toHaveBeenCalled();
    expect(b.words.length).toBeGreaterThan(31);
  });
});

describe('TypeBox: estadísticas', () => {
  it('sin teclas la precisión es 100% y no divide por cero', () => {
    const b = setup(['hola']);
    const s = b.stats();
    expect(s.acc).toBe(100);
    expect(Number.isFinite(s.wpm)).toBe(true);
    expect(Number.isFinite(s.raw)).toBe(true);
  });
  it('calcula ppm con el tiempo transcurrido', () => {
    const b = setup(['aaaa', 'bbbb', 'cccc']);
    type(b, 'a');                   // arranca el reloj
    vi.advanceTimersByTime(12000);  // 12 s
    type(b, 'aaa bbbb cccc');
    const s = b.stats();
    // 14 letras correctas (4+1+4+1+4) / 5 / (12/60) = 14 ppm
    expect(Math.round(s.wpm)).toBe(14);
    expect(s.acc).toBe(100);
  });
  it('los errores bajan la precisión', () => {
    const b = setup(['hola']);
    type(b, 'hxla');
    expect(b.stats().acc).toBe(75);
  });
  it('el progreso va de 0 a 1 y nunca pasa de 1', () => {
    const b = setup(['ab', 'cd']);
    expect(b.progress()).toBe(0);
    type(b, 'ab ');
    expect(b.progress()).toBeCloseTo(3 / 5);
    type(b, 'cd');
    expect(b.progress()).toBe(1);
  });
});
