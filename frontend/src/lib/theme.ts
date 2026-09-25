/* temas: modo claro/oscuro + color de acento. Se guardan en el navegador. */
export type ThemeMode = 'light' | 'dark';
export type Accent = 'celeste' | 'menta' | 'lavanda' | 'coral' | 'atardecer' | 'neon' | 'noche' | 'oro' | 'sakura' | 'oceano' | 'lava' | 'bosque' | 'uva';
export interface Theme { mode: ThemeMode; accent: Accent }

export const ACCENTS: { key: Accent; label: string; color: string }[] = [
  { key: 'celeste', label: 'celeste', color: '#34A3F0' },
  { key: 'menta', label: 'menta', color: '#1DB386' },
  { key: 'lavanda', label: 'lavanda', color: '#8A7BF4' },
  { key: 'coral', label: 'coral', color: '#F0735F' },
];
/** colores que se compran en la tienda (solo se pueden elegir si los tenés) */
export const PREMIUM: { key: Accent; label: string; color: string; item: string; gen?: boolean }[] = [
  { key: 'atardecer', label: 'atardecer', color: '#F2766B', item: 'acento-atardecer' },
  { key: 'neon', label: 'neón', color: '#2BC94A', item: 'acento-neon' },
  { key: 'noche', label: 'noche', color: '#4F5BD5', item: 'acento-noche' },
  { key: 'oro', label: 'oro', color: '#D9A21B', item: 'acento-oro' },
  // estos se arman con culori a partir del color (lib/shop/palette)
  { key: 'sakura', label: 'sakura', color: '#E86A9E', item: 'acento-sakura', gen: true },
  { key: 'oceano', label: 'océano', color: '#1690A8', item: 'acento-oceano', gen: true },
  { key: 'lava', label: 'lava', color: '#E0532F', item: 'acento-lava', gen: true },
  { key: 'bosque', label: 'bosque', color: '#3F8F4E', item: 'acento-bosque', gen: true },
  { key: 'uva', label: 'uva', color: '#9A4FC9', item: 'acento-uva', gen: true },
];

const KEY = 'tecla:theme';
const VARS_KEY = 'tecla:accentvars'; // variables de los acentos generados, para aplicarlas antes de pintar
const VAR_NAMES = ['--accent', '--accent-2', '--soft', '--dim', '--line', '--pat'];

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
  const gen = PREMIUM.find(p => p.key === t.accent && p.gen);
  const done = () => window.dispatchEvent(new CustomEvent('tecla:theme', { detail: t }));
  if (!gen) {
    VAR_NAMES.forEach(n => d.style.removeProperty(n));
    try { localStorage.removeItem(VARS_KEY); } catch {}
    return done();
  }
  import('@/lib/shop/palette').then(({ palette }) => {
    const v = palette(gen.color, t.mode);
    VAR_NAMES.forEach(n => (v[n] ? d.style.setProperty(n, v[n]) : d.style.removeProperty(n)));
    try { localStorage.setItem(VARS_KEY, JSON.stringify(v)); } catch {}
    done();
  });
}

/** Lee un color del tema actual (para canvas y componentes que necesitan un hex). */
export function cssColor(name: string, fallback: string) {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/** familias de las tipografías de la tienda (lib/shop/fonts las carga) */
export const FONT_FAMILIES: Record<string, string> = { jetbrains: '"JetBrains Mono"', fira: '"Fira Code"', space: '"Space Mono"', courier: '"Courier Prime"', vt323: '"VT323"' };

/** Script que corre antes de pintar, para que no parpadee el tema al cargar. */
export const THEME_BOOT = `(function(){try{var t=JSON.parse(localStorage.getItem('${KEY}')||'{}');var d=document.documentElement;d.dataset.theme=t.mode==='dark'?'dark':'light';d.dataset.accent=t.accent||'celeste';var v=JSON.parse(localStorage.getItem('${VARS_KEY}')||'{}');for(var k in v)d.style.setProperty(k,v[k]);var c=JSON.parse(localStorage.getItem('tecla:cos')||'{}');if(c.caret)d.dataset.caret=c.caret;var f=${JSON.stringify(FONT_FAMILIES)}[c.fuente];if(f){d.dataset.font=c.fuente;d.style.setProperty('--type-font',f+',var(--mono)');}}catch(e){}})();`;
