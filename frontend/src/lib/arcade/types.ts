/* =========================================================
   tipos del arcade (canvas) y de su versión multijugador
   ========================================================= */

export type ArcadeKind = 'caen' | 'torre' | 'runner' | 'bombas';
export type ArcadeDiff = 'facil' | 'medio' | 'dificil';
export type PowerKind = 'hielo' | 'boom' | 'vida' | 'lento';

/** colores del tema actual, leídos de las variables CSS (el canvas no entiende var(--x)) */
export interface Palette { ink: string; sub: string; dim: string; acc: string; acc2: string; soft: string; err: string; ok: string; gold: string; bg: string; pat: string; line?: string }

/**
 * Una palabra en pantalla (caen, torre y bombas). Todos los juegos comparten la misma forma;
 * cada uno usa sus campos: caen y bombas se ubican con x/y, la torre con la distancia `d` sobre el camino `p`.
 */
export interface Entity {
  word: string;
  /** letras ya escritas */
  typed: number;
  id?: number;
  /** n (normal) · caen: rapida, zig, split · torre: scout, tank, duo, boss · bombas: gold, mega */
  type: string;
  x: number; y: number; x0: number; ph: number;
  /** velocidad (px/s o distancia/s en la torre) */
  v: number;
  d: number; p: number;
  fuse: number; total: number;
  pw?: PowerKind | null;
  garbage?: boolean;
  boss?: boolean;
  /** tanque: palabras de cada capa del escudo */
  words?: string[] | null;
  stage?: number;
  /** torre cooperativa: de quién es la palabra y su color */
  owner?: string | null;
  color?: string | null;
  /** bicho doble: las dos mitades comparten `link` */
  link?: number;
  part?: number;
  done?: boolean;
  /** invitado de la torre: ignorar la palabra hasta este momento (espera la confirmación del anfitrión) */
  lock?: number;
  coin?: boolean;
  bad?: string | null;
  badUntil?: number;
}

/** Palabra suelta que dibuja `Arcade.word` (las del runner no son entidades). */
export type WordLike = Pick<Entity, 'word' | 'typed'> & Partial<Pick<Entity, 'color' | 'bad' | 'badUntil' | 'pw' | 'done' | 'owner' | 'coin' | 'type' | 'boss'>>;

export type Particle =
  | { ring?: false; x: number; y: number; vx: number; vy: number; life: number; ch: string; col: string }
  | { ring: true; x: number; y: number; r: number; R: number; life: number };
export interface FloatText { x: number; y: number; text: string; col: string; size: number; life: number; strike?: boolean }
export interface Laser { x1: number; y1: number; x2: number; y2: number; life: number }
export interface PathSeg { x1: number; y1: number; x2: number; y2: number; l: number; s: number }
export interface TdPath { segs: PathSeg[]; len: number; start: [number, number] }

export interface Upgrade { id: 'turret' | 'frost' | 'wall' | 'shock' | 'loot'; name: string; desc: string }

export interface HudState { score: number; levelLabel: string; level: number; lives: string; wpm: number; acc: string; combo: string; hot: boolean; best: number }

/** Lo que el juego le pide a React que muestre encima del canvas. */
export type OverlaySpec =
  | { kind: 'intro' } | { kind: 'pause' } | { kind: 'upgrades' } | { kind: 'wait' }
  | { kind: 'over'; rec: boolean; where: string; stats: string; fresh?: boolean[] | null; cloud: boolean }
  | { kind: 'mpWin'; score: number } | { kind: 'mpOut'; score: number } | { kind: 'mpEnd'; coop: boolean; score: number; wave: number };

export interface ArcadeUi {
  overlay?: (spec: OverlaySpec | null) => void;
  hud?: (st: HudState) => void;
  /** algo cambió fuera del HUD (dificultad, récord): React vuelve a dibujar */
  changed?: () => void;
}

/* ---------- multijugador ---------- */
export interface RosterEntry { id: string; name: string; color: string }
export interface MpStatus { lives: number; score: number; level: number; alive: boolean }
export interface CoopSummary { coop: boolean; score: number; wave: number }

export interface SnapshotEntity {
  id?: number; w: string; d: number; p: number; v: number; type: string; boss: boolean;
  link: number; part: number; owner: string | null; color: string | null; done: boolean; stage: number; pw: PowerKind | null;
}
/** estado de la torre cooperativa que el anfitrión manda ~4 veces por segundo */
export interface Snapshot {
  lives: number; wave: number; score: number; banner: number; boss: boolean; frost: number; choosing: boolean; turret: number;
  ents: SnapshotEntity[];
}

export interface MpConfig {
  seed: number;
  diff: ArcadeDiff;
  /** torre: el anfitrión simula y el invitado copia · battle: cada uno juega su partida */
  role: 'host' | 'guest' | 'battle';
  me: string;
  roster: RosterEntry[];
  coop: boolean;
  onStatus?(s: MpStatus): void;
  onDead?(s: { score: number }): void;
  /** caen: mandar palabras basura a un rival */
  onAttack?(n: number): void;
  onHit?(id: number): void;
  onSnapshot?(sn: Snapshot): void;
  onEnd?(sum: CoopSummary): void;
}

/** runner online: dónde van los demás */
export interface Rival { name: string; color: string; dist: number; alive: boolean; shown?: number }
