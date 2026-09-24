/* Reglas de los juegos sociales, como funciones puras (fáciles de testear). */
import { norm } from '@/lib/social/data';

/* ---------- palabra oculta ---------- */
export type Mark = 'ok' | 'near' | 'no';

/** Colores de un intento, como en Wordle: primero las exactas, después las que están en otro lugar
 *  (cada letra del secreto se usa una sola vez, así las repetidas se marcan bien). */
export function wordleMarks(guess: string, secret: string): Mark[] {
  const g = [...norm(guess)], s = [...norm(secret)];
  const marks: Mark[] = g.map(() => 'no');
  const left: Record<string, number> = {};
  g.forEach((ch, i) => { if (ch === s[i]) marks[i] = 'ok'; else left[s[i]] = (left[s[i]] || 0) + 1; });
  g.forEach((ch, i) => { if (marks[i] !== 'ok' && left[ch] > 0) { marks[i] = 'near'; left[ch]--; } });
  return marks;
}

/** ¿El intento es válido? Mismo largo y solo letras (se aceptan palabras fuera del diccionario). */
export const validGuess = (guess: string, len: number) => { const g = norm(guess); return g.length === len && /^[a-zñ]+$/.test(g); };

/** Puntos: más por adivinar en menos intentos, y un extra si fue rápido. */
export function ocultaPoints(tries: number, solved: boolean, ms: number, limitMs: number) {
  if (!solved) return 0;
  const base = (7 - Math.min(6, Math.max(1, tries))) * 20;
  const bonus = Math.round(20 * Math.max(0, 1 - ms / limitMs));
  return base + bonus;
}

/* ---------- sopa de letras ---------- */
export interface Placed { w: string; r: number; c: number; dr: number; dc: number }
const DIRS: [number, number][] = [[0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1]];
const FILL = 'aaaaeeeeiioooosssrrnnlldduuttccmmpbgvyqhfzjñx';

/** Arma una grilla cuadrada con las palabras (en las 8 direcciones) y la completa con letras al azar.
 *  Devuelve solo las palabras que entraron. */
export function makeSopa(words: string[], size: number, rand: () => number) {
  const grid: string[][] = Array.from({ length: size }, () => Array(size).fill(''));
  const placed: Placed[] = [];
  for (const raw of words) {
    const w = norm(raw); if (w.length > size) continue;
    for (let tries = 0; tries < 200; tries++) {
      const [dr, dc] = DIRS[Math.floor(rand() * DIRS.length)];
      const r = Math.floor(rand() * size), c = Math.floor(rand() * size);
      const er = r + dr * (w.length - 1), ec = c + dc * (w.length - 1);
      if (er < 0 || er >= size || ec < 0 || ec >= size) continue;
      let ok = true;
      for (let i = 0; i < w.length; i++) { const cell = grid[r + dr * i][c + dc * i]; if (cell && cell !== w[i]) { ok = false; break; } }
      if (!ok) continue;
      for (let i = 0; i < w.length; i++) grid[r + dr * i][c + dc * i] = w[i];
      placed.push({ w, r, c, dr, dc }); break;
    }
  }
  for (const row of grid) for (let i = 0; i < size; i++) if (!row[i]) row[i] = FILL[Math.floor(rand() * FILL.length)];
  return { grid: grid.map(r => r.join('')), placed };
}

/** Celdas que ocupa una palabra colocada. */
export const cellsOf = (p: Placed) => Array.from({ length: p.w.length }, (_, i) => [p.r + p.dr * i, p.c + p.dc * i] as [number, number]);

/** ¿La selección (de una celda a otra, en cualquier sentido) coincide con alguna palabra? */
export function sopaMatch(placed: Placed[], r1: number, c1: number, r2: number, c2: number): Placed | null {
  for (const p of placed) {
    const cs = cellsOf(p), a = cs[0], b = cs[cs.length - 1];
    if ((a[0] === r1 && a[1] === c1 && b[0] === r2 && b[1] === c2) || (a[0] === r2 && a[1] === c2 && b[0] === r1 && b[1] === c1)) return p;
  }
  return null;
}

/* ---------- pistas ---------- */
const stem = (w: string) => { const n = norm(w); return n.length <= 4 ? n : n.slice(0, 4); };

/** Una pista vale si es una sola palabra y no contiene la palabra secreta (ni su raíz). */
export function clueError(clue: string, secret: string): string | null {
  const c = norm(clue);
  if (!c) return 'Escribí una pista.';
  if (/\s/.test(c)) return 'La pista es de una sola palabra.';
  if (!/^[a-zñ0-9]+$/.test(c)) return 'Solo letras y números.';
  if (c.includes(stem(secret)) || norm(secret).includes(c)) return 'No vale usar la palabra (ni parte de ella).';
  return null;
}

/** ¿Adivinó? Sin tildes ni mayúsculas, y acepta el plural. */
export function guessHits(guess: string, secret: string) {
  const g = norm(guess), s = norm(secret);
  return g === s || g === s + 's' || g === s + 'es' || s === g + 's' || s === g + 'es';
}

/** Puntos de una ronda de pistas: menos pistas usadas, más puntos (para el que adivina y el que da pistas). */
export const pistasPoints = (cluesUsed: number) => ({ guesser: Math.max(20, 70 - (cluesUsed - 1) * 10), giver: Math.max(10, 40 - (cluesUsed - 1) * 6) });

/* ---------- tutti frutti ---------- */
export type Answers = Record<string, string[]>; // jugador → respuesta por categoría

/** Una respuesta está rechazada si la mayoría de los otros jugadores la votó en contra. */
export function isRejected(votes: string[] | undefined, owner: string, players: number) {
  const against = (votes || []).filter(v => v !== owner).length;
  const others = Math.max(1, players - 1);
  return against > others / 2;
}

/** Puntaje: 10 si es válida y nadie más la puso, 5 si se repite, 0 si está vacía, no empieza con la letra o la rechazaron. */
export function tuttiScores(answers: Answers, letter: string, cats: number, votes: Record<string, string[]>) {
  const ids = Object.keys(answers), L = norm(letter), n = ids.length;
  const cell: Record<string, number> = {}, total: Record<string, number> = {};
  for (const id of ids) total[id] = 0;
  for (let k = 0; k < cats; k++) {
    const valid: Record<string, string> = {};
    for (const id of ids) {
      const a = norm(answers[id]?.[k] || '');
      if (!a || !a.startsWith(L) || isRejected(votes[`${id}:${k}`], id, n)) { cell[`${id}:${k}`] = 0; continue; }
      valid[id] = a;
    }
    const counts: Record<string, number> = {};
    for (const a of Object.values(valid)) counts[a] = (counts[a] || 0) + 1;
    for (const [id, a] of Object.entries(valid)) { const p = counts[a] > 1 ? 5 : 10; cell[`${id}:${k}`] = p; total[id] += p; }
  }
  return { cell, total };
}
