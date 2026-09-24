/* Juegos sociales: el estado lo tiene el anfitrión. Los jugadores mandan acciones y el anfitrión
   devuelve el estado público (sin secretos: la palabra oculta, la de pistas, dónde están las
   palabras de la sopa y las respuestas del tutti hasta la votación).
   Todo acá es puro: recibe el estado, la hora y el azar, y devuelve el estado nuevo. */
import { norm, ocultaWords, pistasWords, sopaWords, TUTTI_CATS, TUTTI_LETTERS, TUTTI_SPICY } from '@/lib/social/data';
import { clueError, guessHits, makeSopa, type Mark, ocultaPoints, pistasPoints, type Placed, sopaMatch, tuttiScores, validGuess, wordleMarks, cellsOf } from '@/lib/social/logic';
import type { SocialGame } from '@/lib/rooms';

export interface Seat { id: string; name: string; color: string }
export type Phase = 'playing' | 'vote' | 'reveal' | 'over';

export const TIMES = { oculta: 150_000, sopa: 180_000, pistas: 80_000, tutti: 90_000, basta: 5_000, vote: 45_000, reveal: 7_000 };
export const MAX_TRIES = 6, MAX_CLUES = 5, SOPA_SIZE = 12, SOPA_WORDS = 10, TUTTI_N = 6;

export interface OcultaState { len: number; secret?: string; shown?: string; rows: Record<string, Mark[][]>; solved: Record<string, number>; reveal?: string }
export interface SopaState { grid: string[]; words: string[]; placed?: Placed[]; found: Record<string, { by: string; cells: [number, number][] }> }
export interface PistasState { giver: string; secret?: string; shown?: string; len: number; clues: string[]; guesses: { id: string; text: string; ok: boolean }[]; winner: string | null; reveal?: string; skips: number }
export interface TuttiState { letter: string; cats: string[]; answers?: Record<string, string[]>; filled: Record<string, number>; bastaBy: string | null; votes: Record<string, string[]>; cell?: Record<string, number>; ready: string[] }

export interface GS {
  game: SocialGame; phase: Phase; round: number; rounds: number; spicy: boolean;
  roster: Seat[]; scores: Record<string, number>; roundPts: Record<string, number>;
  started: number; until: number; used: string[];
  o?: OcultaState; s?: SopaState; p?: PistasState; t?: TuttiState;
}

export type Act =
  | { type: 'guess'; g: string }                       // palabra oculta
  | { type: 'pick'; r1: number; c1: number; r2: number; c2: number } // sopa
  | { type: 'clue'; text: string } | { type: 'answer'; text: string } | { type: 'skip' } // pistas
  | { type: 'fill'; answers: string[] } | { type: 'basta' } | { type: 'vote'; cell: string; against: boolean } | { type: 'ready' }; // tutti

const pick = <T,>(list: T[], rand: () => number) => list[Math.floor(rand() * list.length)];
const fresh = (list: string[], used: string[], rand: () => number) => { const pool = list.filter(w => !used.includes(norm(w))); return pick(pool.length ? pool : list, rand); };
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
/** Los del roster que siguen en la sala (si no se sabe, o no queda nadie, cuenta el roster entero). */
export type Active = ReadonlySet<string> | undefined;
const present = (gs: GS, active: Active) => { if (!active) return gs.roster; const p = gs.roster.filter(r => active.has(r.id)); return p.length ? p : gs.roster; };
const minPlayers = (g: SocialGame) => (g === 'pistas' || g === 'tutti' ? 2 : 1);
export const canStart = (g: SocialGame, n: number) => n >= minPlayers(g);

/* ---------- arranque ---------- */
export function newGame(game: SocialGame, roster: Seat[], rounds: number, spicy: boolean, now: number, rand: () => number): GS {
  const gs: GS = { game, phase: 'playing', round: 0, rounds: Math.max(1, rounds), spicy, roster, scores: {}, roundPts: {}, started: now, until: now, used: [] };
  for (const r of roster) gs.scores[r.id] = 0;
  return startRound(gs, now, rand);
}

export function startRound(prev: GS, now: number, rand: () => number, active?: Active): GS {
  const gs = clone(prev); gs.round++; gs.phase = 'playing'; gs.roundPts = {}; gs.started = now;
  delete gs.o; delete gs.s; delete gs.p; delete gs.t;
  if (gs.game === 'oculta') {
    const shown = fresh(ocultaWords(gs.spicy), gs.used, rand), w = norm(shown); gs.used.push(w);
    gs.o = { len: w.length, secret: w, shown, rows: {}, solved: {} };
    gs.until = now + TIMES.oculta;
  } else if (gs.game === 'sopa') {
    let pool = sopaWords(gs.spicy).map(norm).filter(w => !gs.used.includes(w));
    if (pool.length < SOPA_WORDS) pool = sopaWords(gs.spicy).map(norm);
    const chosen = new Set<string>();
    for (let i = 0; chosen.size < SOPA_WORDS && i < 500; i++) chosen.add(pick(pool, rand));
    // las más largas primero: así entran todas en la grilla
    const { grid, placed } = makeSopa([...chosen].sort((a, b) => b.length - a.length), SOPA_SIZE, rand);
    gs.used.push(...placed.map(p => p.w));
    gs.s = { grid, words: placed.map(p => p.w).sort(), placed, found: {} };
    gs.until = now + TIMES.sopa;
  } else if (gs.game === 'pistas') {
    const n = gs.roster.length, base = (gs.round - 1) % n;
    let giver = gs.roster[base].id;
    for (let k = 0; k < n; k++) { const c = gs.roster[(base + k) % n].id; if (!active || active.has(c)) { giver = c; break; } }
    const shown = fresh(pistasWords(gs.spicy), gs.used, rand), w = norm(shown); gs.used.push(w);
    gs.p = { giver, secret: w, shown, len: w.length, clues: [], guesses: [], winner: null, skips: 0 };
    gs.until = now + TIMES.pistas;
  } else {
    const cats = [...(gs.spicy ? TUTTI_SPICY.slice() : []), ...TUTTI_CATS].sort(() => rand() - 0.5);
    const chosenCats = gs.spicy ? [...cats.filter(c => TUTTI_SPICY.includes(c)).slice(0, 3), ...cats.filter(c => !TUTTI_SPICY.includes(c)).slice(0, TUTTI_N - 3)] : cats.slice(0, TUTTI_N);
    const letters = TUTTI_LETTERS.filter(l => !gs.used.includes('letra:' + l));
    const letter = pick(letters.length ? letters : TUTTI_LETTERS, rand); gs.used.push('letra:' + letter);
    gs.t = { letter, cats: chosenCats, answers: {}, filled: {}, bastaBy: null, votes: {}, ready: [] };
    gs.until = now + TIMES.tutti;
  }
  return gs;
}

/* ---------- acciones de los jugadores ---------- */
export interface Result { gs: GS; changed: boolean; reply?: { to: string; event: string; payload: Record<string, unknown> } }
const inRoster = (gs: GS, id: string) => gs.roster.some(r => r.id === id);

export function act(prev: GS, from: string, a: Act, now: number, active?: Active): Result {
  const none = { gs: prev, changed: false };
  if (!inRoster(prev, from) || !a || typeof a !== 'object') return none;
  const gs = clone(prev);

  if (gs.game === 'oculta' && gs.o && gs.phase === 'playing' && a.type === 'guess') {
    const o = gs.o, rows = (o.rows[from] ||= []);
    if (o.solved[from] != null || rows.length >= MAX_TRIES) return none;
    if (!validGuess(String(a.g), o.len)) return { gs: prev, changed: false, reply: { to: from, event: 'marks', payload: { error: `Tiene que tener ${o.len} letras.` } } };
    const marks = wordleMarks(String(a.g), o.secret!); rows.push(marks);
    if (marks.every(m => m === 'ok')) { o.solved[from] = now - gs.started; gs.roundPts[from] = ocultaPoints(rows.length, true, now - gs.started, TIMES.oculta); }
    return { gs: maybeEnd(gs, now, active), changed: true, reply: { to: from, event: 'marks', payload: { g: norm(String(a.g)), marks } } };
  }

  if (gs.game === 'sopa' && gs.s && gs.phase === 'playing' && a.type === 'pick') {
    const p = sopaMatch(gs.s.placed || [], a.r1, a.c1, a.r2, a.c2);
    if (!p || gs.s.found[p.w]) return none;
    gs.s.found[p.w] = { by: from, cells: cellsOf(p) };
    gs.roundPts[from] = (gs.roundPts[from] || 0) + p.w.length * 10;
    return { gs: maybeEnd(gs, now, active), changed: true };
  }

  if (gs.game === 'pistas' && gs.p && gs.phase === 'playing') {
    const p = gs.p;
    if (a.type === 'clue' && from === p.giver) {
      if (p.clues.length >= MAX_CLUES) return none;
      const err = clueError(String(a.text), p.secret!);
      if (err) return { gs: prev, changed: false, reply: { to: from, event: 'clue-error', payload: { error: err } } };
      p.clues.push(norm(String(a.text)).slice(0, 30)); return { gs, changed: true };
    }
    if (a.type === 'skip' && from === p.giver && !p.clues.length && p.skips < 2) {
      const next = startRoundSameGiver(gs, now); return { gs: next, changed: true };
    }
    if (a.type === 'answer' && from !== p.giver && p.clues.length && !p.winner) {
      const text = String(a.text).slice(0, 30), ok = guessHits(text, p.secret!);
      p.guesses.push({ id: from, text: norm(text), ok }); if (p.guesses.length > 60) p.guesses.shift();
      if (ok) {
        p.winner = from; const pts = pistasPoints(p.clues.length);
        gs.roundPts[from] = pts.guesser; gs.roundPts[p.giver] = pts.giver;
        return { gs: toReveal(gs, now), changed: true };
      }
      return { gs, changed: true };
    }
    return none;
  }

  if (gs.game === 'tutti' && gs.t) {
    const t = gs.t;
    if (a.type === 'fill' && gs.phase === 'playing' && Array.isArray(a.answers)) {
      const ans = t.cats.map((_, i) => String(a.answers[i] ?? '').slice(0, 40));
      t.answers![from] = ans; t.filled[from] = ans.filter(x => x.trim()).length;
      return { gs, changed: true };
    }
    if (a.type === 'basta' && gs.phase === 'playing' && !t.bastaBy && (t.filled[from] || 0) >= t.cats.length) {
      t.bastaBy = from; gs.until = Math.min(gs.until, now + TIMES.basta); return { gs, changed: true };
    }
    if (a.type === 'vote' && gs.phase === 'vote' && typeof a.cell === 'string' && /^[^:]+:\d+$/.test(a.cell)) {
      const owner = a.cell.slice(0, a.cell.lastIndexOf(':')); if (owner === from) return none;
      const list = new Set(t.votes[a.cell] || []); if (a.against) list.add(from); else list.delete(from);
      t.votes[a.cell] = [...list];
      t.cell = tuttiScores(t.answers!, t.letter, t.cats.length, t.votes).cell;
      return { gs, changed: true };
    }
    // cuando todos marcan "listo", se cierra la votación antes de tiempo
    if (a.type === 'ready' && gs.phase === 'vote' && !t.ready.includes(from)) {
      t.ready.push(from);
      if (present(gs, active).every(r => t.ready.includes(r.id))) { gs.until = now; return { gs: tick(gs, now, Math.random, active).gs, changed: true }; }
      return { gs, changed: true };
    }
  }
  return none;
}

function startRoundSameGiver(gs: GS, now: number): GS {
  const p = gs.p!; const shown = fresh(pistasWords(gs.spicy), gs.used, Math.random), w = norm(shown); gs.used.push(w);
  gs.p = { ...p, secret: w, shown, len: w.length, skips: p.skips + 1 }; gs.until = now + TIMES.pistas; return gs;
}

/** ¿Terminaron todos? (palabra oculta: todos adivinaron o se quedaron sin intentos; sopa: se encontró todo) */
function maybeEnd(gs: GS, now: number, active?: Active): GS {
  if (gs.game === 'oculta' && gs.o) {
    const done = present(gs, active).every(r => gs.o!.solved[r.id] != null || (gs.o!.rows[r.id]?.length || 0) >= MAX_TRIES);
    if (done) return toReveal(gs, now);
  }
  if (gs.game === 'sopa' && gs.s && Object.keys(gs.s.found).length >= gs.s.words.length) return toReveal(gs, now);
  return gs;
}

function toReveal(gs: GS, now: number): GS {
  gs.phase = 'reveal'; gs.until = now + TIMES.reveal;
  for (const [id, pts] of Object.entries(gs.roundPts)) gs.scores[id] = (gs.scores[id] || 0) + pts;
  if (gs.o) gs.o.reveal = gs.o.shown || gs.o.secret;
  if (gs.p) gs.p.reveal = gs.p.shown || gs.p.secret;
  return gs;
}

/* ---------- el reloj (lo llama el anfitrión varias veces por segundo) ---------- */
export function tick(prev: GS, now: number, rand: () => number, active?: Active): { gs: GS; changed: boolean } {
  if (prev.phase === 'over') return { gs: prev, changed: false };
  if (now < prev.until) {
    // no hace falta esperar al reloj si los que quedan ya terminaron (o se fue el que da las pistas)
    if (prev.phase === 'playing' && prev.game === 'oculta') { const g = maybeEnd(clone(prev), now, active); if (g.phase !== prev.phase) return { gs: g, changed: true }; }
    if (prev.phase === 'playing' && prev.game === 'pistas' && prev.p && active && !active.has(prev.p.giver)) return { gs: toReveal(clone(prev), now), changed: true };
    if (prev.phase === 'vote' && prev.t && present(prev, active).every(r => prev.t!.ready.includes(r.id))) return tick({ ...prev, until: now }, now, rand, active);
    return { gs: prev, changed: false };
  }
  let gs = clone(prev);
  if (gs.phase === 'playing') {
    if (gs.game === 'tutti' && gs.t) {
      gs.phase = 'vote'; gs.until = now + TIMES.vote;
      for (const r of gs.roster) gs.t.answers![r.id] ||= gs.t.cats.map(() => '');
      gs.t.cell = tuttiScores(gs.t.answers!, gs.t.letter, gs.t.cats.length, gs.t.votes).cell;
    } else gs = toReveal(gs, now);
  } else if (gs.phase === 'vote' && gs.t) {
    const { total } = tuttiScores(gs.t.answers!, gs.t.letter, gs.t.cats.length, gs.t.votes);
    gs.roundPts = total; gs = toReveal(gs, now);
  } else if (gs.phase === 'reveal') {
    gs = gs.round >= gs.rounds ? { ...gs, phase: 'over', until: Infinity } : startRound(gs, now, rand, active);
  }
  return { gs, changed: true };
}

/** Lo que ven todos: sin secretos. `left` = milisegundos que quedan (cada cliente lo pasa a su reloj). */
export function publicView(gs: GS, now: number) {
  const v = clone(gs) as GS & { left: number };
  v.left = Number.isFinite(gs.until) ? Math.max(0, gs.until - now) : -1;
  if (v.o) { delete v.o.secret; delete v.o.shown; }
  if (v.p) { delete v.p.secret; delete v.p.shown; }
  if (v.s) delete v.s.placed;
  if (v.t && v.phase === 'playing') delete v.t.answers;
  delete (v as Partial<GS>).used;
  return v;
}

/** El ranking final (y el de cada momento). */
export const ranking = (gs: Pick<GS, 'roster' | 'scores'>) =>
  [...gs.roster].sort((a, b) => (gs.scores[b.id] || 0) - (gs.scores[a.id] || 0));
