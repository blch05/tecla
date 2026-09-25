/* Paletas de acento generadas con culori a partir de un solo color, en el espacio OKLCH
   (así todas quedan parejas en luminosidad, como los acentos hechos a mano). */
import { clampChroma, formatHex, oklch } from 'culori';

export type Vars = Record<string, string>;

export function palette(hex: string, mode: 'light' | 'dark'): Vars {
  const base = oklch(hex); if (!base) return {};
  const h = base.h ?? 0, c = base.c;
  const mk = (l: number, ch: number) => formatHex(clampChroma({ mode: 'oklch', l, c: ch, h }, 'oklch'));
  const accent2 = mk(.84, Math.min(c * .6, .11));
  // en oscuro los fondos los pone el modo oscuro; solo cambian los dos acentos
  if (mode === 'dark') return { '--accent': mk(Math.max(base.l, .68), c), '--accent-2': accent2 };
  return {
    '--accent': hex, '--accent-2': accent2,
    '--soft': mk(.985, .012), '--dim': mk(.925, .04), '--line': mk(.955, .022), '--pat': mk(.945, .034),
  };
}
