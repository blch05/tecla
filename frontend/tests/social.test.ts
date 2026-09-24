import { norm, ocultaWords, pistasWords, sopaWords, SPICY, TUTTI_CATS, TUTTI_LETTERS } from '@/lib/social/data';
import { cellsOf, clueError, guessHits, isRejected, makeSopa, ocultaPoints, pistasPoints, sopaMatch, tuttiScores, validGuess, wordleMarks } from '@/lib/social/logic';
import { rng } from '@/lib/tecla/utils';

describe('norm', () => {
  it('saca tildes y mayúsculas pero respeta la ñ', () => {
    expect(norm('  Canción ')).toBe('cancion');
    expect(norm('ÑANDÚ')).toBe('ñandu');
    expect(norm('pingüino')).toBe('pinguino');
  });
});

describe('palabras', () => {
  it('la palabra oculta siempre tiene 5 letras, con y sin picante', () => {
    for (const s of [false, true]) {
      const ws = ocultaWords(s);
      expect(ws.length).toBeGreaterThan(15);
      for (const w of ws) expect(norm(w)).toMatch(/^[a-zñ]{5}$/);
    }
  });
  it('sopa y pistas tienen material suficiente', () => {
    expect(sopaWords(false).length).toBeGreaterThan(200);
    expect(sopaWords(true).length).toBeGreaterThan(40);
    expect(pistasWords(true).length).toBeGreaterThan(40);
  });
  it('la lista picante no tiene repetidas y el tutti tiene letras y categorías', () => {
    expect(new Set(SPICY).size).toBe(SPICY.length);
    expect(TUTTI_CATS.length).toBeGreaterThanOrEqual(8);
    expect(TUTTI_LETTERS).not.toContain('k');
  });
});

describe('palabra oculta', () => {
  it('marca exactas, cercanas y ausentes', () => {
    expect(wordleMarks('perro', 'perro')).toEqual(['ok', 'ok', 'ok', 'ok', 'ok']);
    expect(wordleMarks('carta', 'tarco')).toEqual(['near', 'ok', 'ok', 'near', 'no']);
  });
  it('letras repetidas: solo se marcan tantas como hay en el secreto', () => {
    // secreto con una sola "o": de las dos "o" del intento, una sola sale marcada
    expect(wordleMarks('ooxxx', 'abcod')).toEqual(['near', 'no', 'no', 'no', 'no']);
    expect(wordleMarks('llama', 'pollo')).toEqual(['near', 'near', 'no', 'no', 'no']);
    // la exacta tiene prioridad sobre la cercana
    expect(wordleMarks('aabbb', 'caaaa')).toEqual(['near', 'ok', 'no', 'no', 'no']);
  });
  it('ignora tildes al comparar', () => {
    expect(wordleMarks('ratón', 'raton')).toEqual(['ok', 'ok', 'ok', 'ok', 'ok']);
  });
  it('valida el largo y que sean letras', () => {
    expect(validGuess('perro', 5)).toBe(true);
    expect(validGuess('ratón', 5)).toBe(true);
    expect(validGuess('perr', 5)).toBe(false);
    expect(validGuess('per o', 5)).toBe(false);
    expect(validGuess('p3rro', 5)).toBe(false);
  });
  it('los puntos premian menos intentos y rapidez', () => {
    expect(ocultaPoints(1, true, 0, 1000)).toBe(140);
    expect(ocultaPoints(6, true, 1000, 1000)).toBe(20);
    expect(ocultaPoints(3, false, 0, 1000)).toBe(0);
    expect(ocultaPoints(2, true, 500, 1000)).toBeGreaterThan(ocultaPoints(3, true, 500, 1000));
  });
});

describe('sopa de letras', () => {
  const words = ['perro', 'gato', 'casa', 'árbol', 'nube', 'mesa'];
  it('coloca las palabras, llena la grilla y es reproducible con la misma semilla', () => {
    const a = makeSopa(words, 10, rng(7)), b = makeSopa(words, 10, rng(7));
    expect(a).toEqual(b);
    expect(a.grid).toHaveLength(10);
    for (const row of a.grid) expect(row).toMatch(/^[a-zñ]{10}$/);
    expect(a.placed.length).toBeGreaterThanOrEqual(5);
    // cada palabra colocada se lee en la grilla
    for (const p of a.placed) expect(cellsOf(p).map(([r, c]) => a.grid[r][c]).join('')).toBe(p.w);
  });
  it('las palabras más largas que la grilla se descartan', () => {
    const s = makeSopa(['electrodoméstico', 'sol'], 6, rng(1));
    expect(s.placed.map(p => p.w)).toEqual(['sol']);
  });
  it('reconoce la selección en los dos sentidos y rechaza las que no coinciden', () => {
    const s = makeSopa(['perro'], 8, rng(3)); const p = s.placed[0]; const cs = cellsOf(p);
    const [a, b] = [cs[0], cs[cs.length - 1]];
    expect(sopaMatch(s.placed, a[0], a[1], b[0], b[1])?.w).toBe('perro');
    expect(sopaMatch(s.placed, b[0], b[1], a[0], a[1])?.w).toBe('perro');
    expect(sopaMatch(s.placed, a[0], a[1], cs[2][0], cs[2][1])).toBeNull();
  });
});

describe('pistas', () => {
  it('la pista es una sola palabra y no puede contener la secreta', () => {
    expect(clueError('ladra', 'perro')).toBeNull();
    expect(clueError('', 'perro')).toMatch(/pista/);
    expect(clueError('mejor amigo', 'perro')).toMatch(/una sola/);
    expect(clueError('perrito', 'perro')).toMatch(/No vale/);
    expect(clueError('PERRO', 'perro')).toMatch(/No vale/);
    expect(clueError('per', 'perro')).toMatch(/No vale/);
    expect(clueError('¿?', 'perro')).toMatch(/letras/);
  });
  it('acepta la respuesta sin tildes, en mayúsculas o en plural', () => {
    expect(guessHits('Ratón', 'raton')).toBe(true);
    expect(guessHits('perros', 'perro')).toBe(true);
    expect(guessHits('flor', 'flores')).toBe(true);
    expect(guessHits('gato', 'perro')).toBe(false);
  });
  it('menos pistas, más puntos (con un mínimo)', () => {
    expect(pistasPoints(1).guesser).toBeGreaterThan(pistasPoints(3).guesser);
    expect(pistasPoints(20)).toEqual({ guesser: 20, giver: 10 });
  });
});

describe('tutti frutti', () => {
  it('10 si es única, 5 si se repite, 0 si no empieza con la letra o está vacía', () => {
    const { cell, total } = tuttiScores({ a: ['Mariana', 'mono', ''], b: ['mariana', 'perro', 'mango'] }, 'm', 3, {});
    expect(cell['a:0']).toBe(5); expect(cell['b:0']).toBe(5);
    expect(cell['a:1']).toBe(10); expect(cell['b:1']).toBe(0);
    expect(cell['a:2']).toBe(0); expect(cell['b:2']).toBe(10);
    expect(total).toEqual({ a: 15, b: 15 });
  });
  it('una respuesta rechazada por la mayoría no suma (y el dueño no puede votarse)', () => {
    const answers = { a: ['mesa'], b: ['moto'], c: ['mono'] };
    // a vota contra sí mismo: no cuenta
    expect(tuttiScores(answers, 'm', 1, { 'a:0': ['a'] }).cell['a:0']).toBe(10);
    // 1 de 2 no alcanza la mayoría; 2 de 2 sí
    expect(tuttiScores(answers, 'm', 1, { 'a:0': ['b'] }).cell['a:0']).toBe(10);
    expect(tuttiScores(answers, 'm', 1, { 'a:0': ['b', 'c'] }).cell['a:0']).toBe(0);
  });
  it('con dos jugadores alcanza un voto en contra', () => {
    expect(isRejected(['b'], 'a', 2)).toBe(true);
    expect(isRejected([], 'a', 2)).toBe(false);
    expect(isRejected(undefined, 'a', 1)).toBe(false);
  });
});
