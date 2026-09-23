'use client';

import { useEffect, useRef, useState } from 'react';
import { ACCENTS, applyTheme, readTheme, type Theme } from '@/lib/theme';

export default function ThemeSwitcher() {
  const [theme, setTheme] = useState<Theme | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setTheme(readTheme()); }, []);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  const set = (patch: Partial<Theme>) => { const t = { ...(theme || readTheme()), ...patch }; setTheme(t); applyTheme(t); };
  const accent = ACCENTS.find(a => a.key === theme?.accent) || ACCENTS[0];

  return (
    <div className="theme-sw" ref={ref}>
      <button type="button" className="theme-btn" aria-label="cambiar tema" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <span className="swatch" style={{ background: accent.color }} />
      </button>
      {open && theme && (
        <div className="theme-pop" role="dialog" aria-label="tema">
          <span className="lbl">modo</span>
          <div className="cfgbar">
            <button type="button" className={'opt' + (theme.mode === 'light' ? ' on' : '')} onClick={() => set({ mode: 'light' })}>claro</button>
            <button type="button" className={'opt' + (theme.mode === 'dark' ? ' on' : '')} onClick={() => set({ mode: 'dark' })}>oscuro</button>
          </div>
          <span className="lbl">color</span>
          <div className="swatches">
            {ACCENTS.map(a => (
              <button key={a.key} type="button" title={a.label} aria-label={a.label} className={'swatch-btn' + (a.key === theme.accent ? ' on' : '')} onClick={() => set({ accent: a.key })}>
                <span className="swatch" style={{ background: a.color }} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
