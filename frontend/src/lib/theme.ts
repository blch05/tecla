/* temas: modo claro/oscuro + color de acento. Se guardan en el navegador. */
export type ThemeMode = 'light' | 'dark';
export type Accent = 'celeste' | 'menta' | 'lavanda' | 'coral';
export interface Theme { mode: ThemeMode; accent: Accent }

export const ACCENTS: { key: Accent; label: string; color: string }[] = [
  { key: 'celeste', label: 'celeste', color: '#34A3F0' },
  { key: 'menta', label: 'menta', color: '#1DB386' },
  { key: 'lavanda', label: 'lavanda', color: '#8A7BF4' },
  { key: 'coral', label: 'coral', color: '#F0735F' },
];

const KEY = 'tecla:theme';

export function readTheme(): Theme {
  try {
    const t = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { mode: t.mode === 'dark' ? 'dark' : 'light', accent: ACCENTS.some(a => a.key === t.accent) ? t.accent : 'celeste' };
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
export const THEME_BOOT = `(function(){try{var t=JSON.parse(localStorage.getItem('${KEY}')||'{}');var d=document.documentElement;d.dataset.theme=t.mode==='dark'?'dark':'light';d.dataset.accent=t.accent||'celeste';}catch(e){}})();`;
