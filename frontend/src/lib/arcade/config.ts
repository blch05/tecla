/* =========================================================
   datos de los juegos del arcade: textos, misiones, poderes, mejoras y dificultades
   ========================================================= */
import type { Arcade } from '@/lib/arcade/engine';
import type { ArcadeDiff, ArcadeKind, PowerKind, Upgrade } from '@/lib/arcade/types';

export interface Mission { t: string; ok: (s: Arcade) => boolean }
export interface GameInfo { name: string; desc: string; missions: [Mission, Mission, Mission] }

export const ARC: Record<ArcadeKind, GameInfo> = {
  caen: {
    name: 'palabras que caen',
    desc: 'Las palabras caen desde arriba: tipeá cada una antes de que toque el piso. Ojo con las rápidas (rojas), las que zigzaguean y las que se parten en dos. Encadená 10 aciertos para entrar en fiebre y sumar el doble.',
    missions: [{ t: 'llegá al nivel 5', ok: s => s.level >= 5 }, { t: 'hacé un combo de 15', ok: s => s.maxCombo >= 15 }, { t: 'atrapá 2 poderes', ok: s => s.powers >= 2 }],
  },
  torre: {
    name: 'defensa de torre',
    desc: 'Los enemigos avanzan por el camino hacia tu base. Hay exploradores rápidos, tanques con escudo (dos palabras) y un jefe cada 5 oleadas. Entre oleadas elegís una mejora, como una torreta que dispara sola.',
    missions: [{ t: 'superá 5 oleadas', ok: s => s.cleared >= 5 }, { t: 'vencé a un jefe', ok: s => s.bosses >= 1 }, { t: 'terminá una oleada sin daño', ok: s => s.perfect >= 1 }],
  },
  runner: {
    name: 'runner',
    desc: 'Una ola te persigue y tu tipeo es el motor: cada letra correcta del texto de abajo es un paso. Cuando un obstáculo se acerca, escribí la palabra de un carril libre para cambiarte. Tipear parejo sube el ritmo, y cada 500 m elegís un tramo difícil (x2) o uno seguro.',
    missions: [{ t: 'corré 500 metros', ok: s => s.dist >= 500 }, { t: 'juntá 5 monedas', ok: s => s.coins >= 5 }, { t: 'esquivá 20 obstáculos', ok: s => s.jumps >= 20 }],
  },
  bombas: {
    name: 'bombas',
    desc: 'Aparecen bombas con la mecha encendida. Si una explota perdés una vida y las de alrededor se aceleran. Desactivá varias seguidas para hacer cadena. Las doradas desactivan a sus vecinas, y las mega explotan fuerte.',
    missions: [{ t: 'desactivá 25 bombas', ok: s => s.kills >= 25 }, { t: 'hacé una cadena de 4', ok: s => s.maxChain >= 4 }, { t: 'desactivá una bomba dorada', ok: s => s.golden >= 1 }],
  },
};

export const POWERS: Record<PowerKind, { g: string; name: string; desc: string }> = {
  hielo: { g: '❄', name: '¡hielo!', desc: 'congela todo 3 s' },
  boom: { g: '✸', name: '¡bum!', desc: 'limpia la pantalla' },
  vida: { g: '♥', name: '+1 vida', desc: 'recuperás una vida' },
  lento: { g: '◷', name: 'cámara lenta', desc: 'todo va a la mitad 5 s' },
};

export const UPGRADES: Upgrade[] = [
  { id: 'turret', name: 'torreta', desc: 'dispara sola al enemigo más avanzado cada pocos segundos' },
  { id: 'frost', name: 'escarcha', desc: 'los enemigos avanzan 15% más lento' },
  { id: 'wall', name: 'muralla', desc: '+3 vidas para tu base' },
  { id: 'shock', name: 'onda', desc: 'al destruir un enemigo, los cercanos retroceden' },
  { id: 'loot', name: 'botín', desc: '+25% de puntos por palabra' },
];

export interface DiffInfo {
  name: string;
  /** multiplicadores: velocidad, tiempo entre apariciones, puntos, cantidad por oleada y duración de las mechas */
  speed: number; spawn: number; pts: number; count: number; fuse: number;
  /** vidas de más (o de menos) */
  lives: number;
  /** caminos de la torre */
  paths: 1 | 2 | 3;
}
export const ADIFF: Record<ArcadeDiff, DiffInfo> = {
  facil: { name: 'fácil', speed: .8, spawn: 1.25, lives: 2, pts: .75, paths: 1, count: 1, fuse: 1.25 },
  medio: { name: 'medio', speed: 1, spawn: 1, lives: 0, pts: 1, paths: 2, count: 1.25, fuse: 1 },
  dificil: { name: 'difícil', speed: 1.22, spawn: .82, lives: -1, pts: 1.5, paths: 3, count: 1.5, fuse: .8 },
};
export const DIFF_DESC: Record<ArcadeKind, Record<ArcadeDiff, string>> = {
  torre: { facil: '1 camino · palabras cortas', medio: '2 caminos · palabras comunes', dificil: '3 caminos · palabras largas y difíciles' },
  caen: { facil: 'más lento · +2 vidas · palabras cortas', medio: 'velocidad normal · palabras comunes', dificil: 'más rápido · 1 vida menos · palabras largas' },
  runner: { facil: 'ola lenta · +2 vidas · palabras cortas', medio: 'ola normal · palabras comunes', dificil: 'ola rápida · 2 vidas · palabras largas' },
  bombas: { facil: 'mechas largas · +2 vidas · palabras cortas', medio: 'mechas normales · palabras comunes', dificil: 'mechas cortas · 1 vida menos · palabras largas' },
};
export const BASE_LIVES: Record<ArcadeKind, number> = { caen: 5, torre: 10, runner: 3, bombas: 5 };

type Pt = [number, number];
/** caminos del tower defense, en coordenadas relativas (0–1); todos terminan en la base.
    Cada camino vive en su propia franja horizontal y solo se juntan cerca de la base. */
export const TD_PATHS: Record<'solo' | 'top' | 'mid' | 'bot', Pt[]> = {
  solo: [[-.02, .16], [.6, .16], [.6, .44], [.2, .44], [.2, .82], [.74, .82], [.74, .5], [.91, .5]],
  top: [[-.02, .15], [.24, .15], [.24, .27], [.5, .27], [.5, .15], [.74, .15], [.74, .5], [.91, .5]],
  mid: [[-.02, .5], [.2, .5], [.2, .43], [.44, .43], [.44, .57], [.66, .57], [.66, .5], [.91, .5]],
  bot: [[-.02, .87], [.24, .87], [.24, .75], [.5, .75], [.5, .87], [.74, .87], [.74, .5], [.91, .5]],
};

export const RUNNER_OBS = {
  roca: { name: 'roca', desc: 'se queda quieta' },
  carga: { name: 'carga', desc: 'viene hacia vos' },
  muro: { name: 'muro', desc: 'ocupa dos carriles' },
} as const;
