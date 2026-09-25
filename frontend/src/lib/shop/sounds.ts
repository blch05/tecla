/* Paquetes de sonido de teclado de la tienda, reproducidos con Howler.
   Los archivos se sintetizan con scripts/gen-sounds.mjs (la distribución del sprite es la misma). */
import type { Howl } from 'howler';

/** Paquetes que se compran (valor de EFFECT → nombre que se ve en el test). */
export const PACKS: Record<string, string> = { cremoso: 'cremoso', azul: 'azul', burbujas: 'burbujas', retro: 'retro', antigua: 'máquina antigua' };
export const isPack = (k: string) => k in PACKS;

const SPRITE: Record<string, [number, number]> = {
  k0: [0, 150], k1: [160, 150], k2: [320, 150], k3: [480, 150], sp: [640, 150], err: [800, 150], end: [960, 1000],
};
const loaded: Record<string, Promise<Howl>> = {};

function howl(pack: string) {
  return (loaded[pack] ||= import('howler').then(({ Howl }) => new Howl({ src: [`/sounds/${pack}.wav`], sprite: SPRITE, volume: 0.55, preload: true })));
}

/** Descarga el paquete antes de empezar a tipear (así la primera tecla ya suena). */
export const preload = (pack: string) => { if (isPack(pack)) howl(pack); };

export function play(pack: string, what: 'key' | 'space' | 'err' | 'end') {
  if (!isPack(pack)) return;
  howl(pack).then(h => h.play(what === 'key' ? 'k' + Math.floor(Math.random() * 4) : what === 'space' ? 'sp' : what));
}
