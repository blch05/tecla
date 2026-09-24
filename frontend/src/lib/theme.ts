/* temas: modo claro/oscuro + color de acento. Se guardan en el navegador. */
export type ThemeMode = 'light' | 'dark';
export type Accent = 'celeste' | 'menta' | 'lavanda' | 'coral' | 'atardecer' | 'neon' | 'noche' | 'oro';
export interface Theme { mode: ThemeMode; accent: Accent }

export const ACCENTS: { key: Accent; label: string; color: string }[] = [
  { key: 'celeste', label: 'celeste', color: '#34A3F0' },
  { key: 'menta', label: 'menta', color: '#1DB386' },
  { key: 'lavanda', label: 'lavanda', color: '#8A7BF4' },
  { key: 'coral', label: 'coral', color: '#F0735F' },
];
/** colores que se compran en la tienda (solo se pueden elegir si los tenés) */
export const PREMIUM: { key: Accent; label: string; color: string; item: string }[] = [
  { key: 'atardecer', label: 'atardecer', color: '#F2766B', item: 'acento-atardecer' },
  { key: 'neon', label: 'neón', color: '#2BC94A', item: 'acento-neon' },
  { key: 'noche', label: 'noche', color: '#4F5BD5', item: 'acento-noche' },
  { key: 'oro', label: 'oro', color: '#D9A21B', item: 'acento-oro' },
];

const KEY = 'tecla:theme';

export function readTheme(): Theme {
  try {
    const t = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { mode: t.mode === 'dark' ? 'dark' : 'light', accent: [...ACCENTS, ...PREMIUM].some(a => a.key === t.accent) ? t.accent : 'celeste' };
  } catch { return { mode: 'light', accent: 'celeste' }; }
}

export function applyTheme(t: Theme) {
  const d = document.documentElement;
  d.dataset.theme = t.mode;
  d.dataset.accent = t.accent;
  try { localStorage.setItem(KEY, JSON.stringify(t)); } catch {}
  window.dispatchEvent(new CustomEvent('tecla:theme', { detail: t }));
}

/** Lee un color del tema actual (para canvas y componentes que necesitan un hex). */
export function cssColor(name: string, fallback: string) {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/** Script que corre antes de pintar, para que no parpadee el tema al cargar. */
export const THEME_BOOT = `(function(){try{var t=JSON.parse(localStorage.getItem('${KEY}')||'{}');var d=document.documentElement;d.dataset.theme=t.mode==='dark'?'dark':'light';d.dataset.accent=t.accent||'celeste';var c=JSON.parse(localStorage.getItem('tecla:cos')||'{}');if(c.caret)d.dataset.caret=c.caret;}catch(e){}})();`;
