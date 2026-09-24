/* Datos de cada juego en un solo lugar: nombre, glifo, cómo se gana y un resumen.
   Los usan las pestañas del arcade, la lista y el creador de salas, y los lobbies. */
import type { RoomGame } from '@/lib/rooms';

export type GameGroup = 'tipeo' | 'arcade' | 'social';
export interface GameInfo { name: string; glyph: string; how: string; blurb: string; group: GameGroup }

export const GAME_INFO: Record<RoomGame, GameInfo> = {
  carrera: { name: 'carrera', glyph: '›››', how: 'todos contra todos', blurb: 'mismo texto, gana el primero en terminar', group: 'tipeo' },
  royale: { name: 'battle royale', glyph: '*|*', how: 'eliminación', blurb: 'cada 20 s queda afuera el más lento', group: 'tipeo' },
  caen: { name: 'palabras que caen', glyph: '↓↓↓', how: 'ataque', blurb: 'tus aciertos le mandan basura a otro', group: 'arcade' },
  bombas: { name: 'bombas', glyph: '(*)', how: 'último en pie', blurb: 'desactivá tus bombas antes de que exploten', group: 'arcade' },
  runner: { name: 'runner', glyph: '»*»', how: 'último en pie', blurb: 'escapá de la ola: tu tipeo es el motor', group: 'arcade' },
  torre: { name: 'defensa de torre', glyph: '[*]', how: 'cooperativo', blurb: 'cada uno escribe las palabras de su color', group: 'arcade' },
  oculta: { name: 'palabra oculta', glyph: '?▢?', how: 'adiviná', blurb: 'la misma palabra secreta para todos, 6 intentos', group: 'social' },
  sopa: { name: 'sopa de letras', glyph: '#a#', how: 'buscá', blurb: 'la misma grilla: cada palabra es de quien la encuentra primero', group: 'social' },
  pistas: { name: 'pistas', glyph: '»?«', how: 'por turnos', blurb: 'uno da pistas de una palabra, los demás adivinan', group: 'social' },
  tutti: { name: 'tutti frutti', glyph: 'a–z', how: 'basta', blurb: 'una letra, varias categorías, y votan qué vale', group: 'social' },
};

export const GAME_GROUPS: { id: GameGroup; name: string; games: RoomGame[] }[] = [
  { id: 'tipeo', name: 'tipeo', games: ['carrera', 'royale'] },
  { id: 'arcade', name: 'arcade', games: ['caen', 'bombas', 'runner', 'torre'] },
  { id: 'social', name: 'social', games: ['oculta', 'sopa', 'pistas', 'tutti'] },
];

/** Opciones para las pestañas de juegos (componente Tabs, variante "card"). */
export const gameTabs = (ids: RoomGame[], withHow = true) =>
  ids.map(id => ({ id, label: GAME_INFO[id].name, glyph: GAME_INFO[id].glyph, sub: withHow ? GAME_INFO[id].how : undefined }));
