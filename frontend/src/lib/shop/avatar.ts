/* Avatares generados con DiceBear a partir de tu cuenta (mismo usuario → mismo dibujo).
   Solo estilos con licencia libre para usar (CC0 o libre uso comercial); cada uno se descarga aparte. */
import type { Style } from '@dicebear/core';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- cada estilo de DiceBear tiene sus propias opciones
type AnyStyle = Style<any>;
const STYLES: Record<string, () => Promise<AnyStyle>> = {
  pixel: () => import('@dicebear/collection/async').then(m => m.pixelArt()),
  formas: () => import('@dicebear/collection/async').then(m => m.shapes()),
  pulgar: () => import('@dicebear/collection/async').then(m => m.thumbs()),
  lorelei: () => import('@dicebear/collection/async').then(m => m.lorelei()),
  robot: () => import('@dicebear/collection/async').then(m => m.bottts()),
};
const cache = new Map<string, Promise<string>>();

/** Devuelve el avatar como data URI (SVG), o null si el estilo no existe. */
export function avatarUri(style: string, seed: string): Promise<string> | null {
  if (!STYLES[style]) return null;
  const k = style + ':' + seed;
  if (!cache.has(k)) cache.set(k, Promise.all([import('@dicebear/core'), STYLES[style]()]).then(([{ createAvatar }, st]) => createAvatar(st, { seed, size: 128 }).toDataUri()));
  return cache.get(k)!;
}
