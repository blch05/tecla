/* Palabras y categorías de los juegos sociales (sin PDF, sin IA). */
import { VOCAB } from '@/lib/tecla/data/words';

/** minúsculas y sin tildes (la ñ se mantiene): para comparar respuestas */
export const norm = (s: string) =>
  s.toLowerCase().trim().replace(/ñ/g, '\u0001').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\u0001/g, 'ñ');

const ALL: string[] = [...new Set([...VOCAB.facil, ...VOCAB.medio, ...VOCAB.dificil])];

/* Picante: humor subido de tono, en rioplatense. Nada de insultos que discriminen. */
export const SPICY: string[] = [
  'tanga', 'chape', 'resaca', 'culo', 'teta', 'pedo', 'eructo', 'calzón', 'bombacha', 'boludo',
  'forro', 'cagada', 'orto', 'garrón', 'franela', 'trampa', 'amante', 'desnudo', 'borracho', 'escote',
  'jacuzzi', 'motel', 'ligue', 'levante', 'trago', 'fernet', 'previa', 'after', 'cornudo', 'celos',
  'sexy', 'beso', 'lengua', 'chupón', 'cita', 'ex', 'crush', 'nudes', 'cachetada', 'nalga',
  'pezón', 'axila', 'sobaco', 'mocos', 'caca', 'pis', 'vómito', 'gases', 'calvo', 'papada',
  'panza', 'ombligo', 'pelotudo', 'chanta', 'garca', 'tarado', 'gil', 'queso', 'baboso', 'picante',
  'fiestero', 'bailanta', 'cumbia', 'perreo', 'twerk', 'stripper', 'despedida', 'soltero', 'suegra', 'cuñado',
  'infiel', 'mentira', 'chisme', 'chusma', 'tóxico', 'ghosteo', 'match', 'tinder', 'sugar', 'poliamor',
  'hot', 'tenso', 'caliente', 'mimos', 'cucharita', 'pijama', 'ducha', 'toalla', 'sábanas', 'almohada',
];

const byLen = (list: string[], min: number, max: number) => list.filter(w => { const n = norm(w); return n.length >= min && n.length <= max && /^[a-zñ]+$/.test(n); });

/** Palabra oculta: palabras de 5 letras (sin tildes al comparar). */
export const ocultaWords = (spicy: boolean) => byLen(spicy ? SPICY : ALL, 5, 5);
/** Sopa de letras: palabras de 4 a 9 letras. */
export const sopaWords = (spicy: boolean) => byLen(spicy ? SPICY : ALL, 4, 9);
/** Pistas: palabras para adivinar. */
export const pistasWords = (spicy: boolean) => byLen(spicy ? SPICY : VOCAB.facil.concat(VOCAB.medio), 3, 12);

/** Tutti frutti */
export const TUTTI_CATS: string[] = [
  'nombre', 'apellido', 'animal', 'país o ciudad', 'comida', 'fruta o verdura', 'color', 'cosa',
  'marca', 'profesión', 'famoso/a', 'película o serie', 'parte del cuerpo', 'deporte', 'instrumento', 'algo de la cocina',
];
export const TUTTI_SPICY: string[] = [
  'excusa para no ir', 'algo que no le dirías a tu suegra', 'lugar para una cita', 'algo que llevarías a una previa',
  'apodo cariñoso', 'algo que hacés de resaca', 'trago', 'algo que no subirías a Instagram', 'motivo para cortar',
];
export const TUTTI_LETTERS = 'abcdefghijlmnoprstuv'.split('');
