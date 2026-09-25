/* Tipografías de la caja de tipeo (Fontsource): se descargan solo si alguien las tiene puestas. */
import { FONT_FAMILIES } from '@/lib/theme';

export const FONTS: Record<string, { load: () => Promise<unknown> }> = {
  jetbrains: { load: () => import('@fontsource/jetbrains-mono/400.css') },
  fira: { load: () => import('@fontsource/fira-code/400.css') },
  space: { load: () => import('@fontsource/space-mono/400.css') },
  courier: { load: () => import('@fontsource/courier-prime/400.css') },
  vt323: { load: () => import('@fontsource/vt323/400.css') },
};

/** Pone (o saca) la tipografía de la caja de tipeo y avisa cuando ya cargó, para recolocar el cursor. */
export async function applyFont(fx: string) {
  const d = document.documentElement, f = FONTS[fx], family = FONT_FAMILIES[fx];
  if (!f) { delete d.dataset.font; d.style.removeProperty('--type-font'); window.dispatchEvent(new Event('tecla:font')); return; }
  d.dataset.font = fx; d.style.setProperty('--type-font', `${family},var(--mono)`);
  try { await f.load(); await document.fonts.load(`1em ${family}`); } catch {}
  window.dispatchEvent(new Event('tecla:font'));
}
