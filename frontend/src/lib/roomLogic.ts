/* Reglas de las salas online, como funciones puras (fáciles de testear). */

export interface RoomPlayer {
  id: string;
  color: string;
  joinedAt: number;
  round: number;
  alive: boolean;
  score?: number;
  deadAt?: number | null;
  rr?: number; // royale: ronda a la que corresponde rc
  rc?: number; // royale: letras correctas de esa ronda
}
export interface RosterEntry { id: string }

/** Jugadores de la ronda actual que siguen conectados. */
export function participants(players: RoomPlayer[], roster: RosterEntry[], round: number) {
  const ids = new Set(roster.map(r => r.id));
  return players.filter(p => ids.has(p.id) && p.round === round);
}

/**
 * ¿Terminó la ronda? (modos "último en pie" y royale)
 * - con 2 o más participantes: termina cuando queda 1 vivo (o ninguno, si caen a la vez)
 * - jugando solo: termina cuando muere
 * Si se desconectan todos menos uno, el que queda gana.
 * Ojo: al arrancar la ronda, la presencia de los demás tarda un instante en actualizarse.
 * Un jugador de la lista que sigue conectado pero todavía figura en la ronda anterior
 * cuenta como vivo; solo se da por perdido a quien ya no está conectado.
 */
export function decideEnd(players: RoomPlayer[], roster: RosterEntry[], round: number): { end: boolean; winner: string | null } {
  const ids = new Set(roster.map(r => r.id));
  const present = players.filter(p => ids.has(p.id));
  const lagging = present.filter(p => p.round !== round);
  const alive = present.filter(p => p.round === round && p.alive);
  const stillIn = alive.length + lagging.length;
  if (roster.length <= 1) return { end: stillIn === 0, winner: null };
  if (stillIn <= 1) return { end: true, winner: alive[0]?.id ?? null };
  return { end: false, winner: null };
}

/**
 * Royale: a quién eliminar al cerrar la ronda `closed`.
 * Cuenta solo las letras reportadas para esa ronda (si alguien no reportó, cuenta 0).
 * Empate: sale el que llegó último a la sala (para que el resultado sea igual en todos lados).
 * Con 1 o ningún vivo no se elimina a nadie.
 */
export function pickEliminated(players: RoomPlayer[], roster: RosterEntry[], round: number, closed: number): string | null {
  const alive = participants(players, roster, round).filter(p => p.alive);
  if (alive.length <= 1) return null;
  const letters = (p: RoomPlayer) => (p.rr === closed ? Math.max(0, p.rc || 0) : 0);
  const sorted = [...alive].sort((a, b) => letters(a) - letters(b) || b.joinedAt - a.joinedAt);
  return sorted[0].id;
}

/**
 * Color de un jugador: si no tiene, o si alguien que llegó antes tiene el mismo,
 * toma el primer color libre de la paleta. Devuelve null si el actual está bien.
 */
export function resolveColor(me: RoomPlayer, players: RoomPlayer[], palette: string[]): string | null {
  const others = players.filter(o => o.id !== me.id);
  const clash = others.some(o => o.color === me.color && o.joinedAt < me.joinedAt);
  if (me.color && palette.includes(me.color) && !clash) return null;
  const used = new Set(others.map(o => o.color));
  return palette.find(c => !used.has(c)) ?? palette[others.length % palette.length];
}

/** Tabla de posiciones: vivos primero, después los que cayeron más tarde, y por puntos. */
export function standings(players: RoomPlayer[], roster: RosterEntry[], round: number) {
  return participants(players, roster, round).sort(
    (a, b) => Number(b.alive) - Number(a.alive) || (b.deadAt || 0) - (a.deadAt || 0) || (b.score || 0) - (a.score || 0),
  );
}

/** Cantidad de palabras basura aceptada por mensaje (evita que un tramposo mande 1000). */
export const clampGarbage = (n: unknown) => Math.min(3, Math.max(1, Math.floor(Number(n) || 1)));
