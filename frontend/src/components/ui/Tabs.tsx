'use client';

/* Pestañas de toda la app.
   - variante "text": las subpestañas de competir y estudiar
   - variante "card": elegir juego (arcade, en vivo, lobbies de las salas), con glifo y subtítulo opcional */
export interface TabItem { id: string; label: string; glyph?: string; sub?: string; disabled?: boolean }

export default function Tabs({ items, value, onChange, variant = 'text', label, className = '', readOnly = false }: {
  items: TabItem[]; value: string; onChange?: (id: string) => void;
  variant?: 'text' | 'card'; label?: string; className?: string; readOnly?: boolean;
}) {
  return (
    <div className={`tabs tabs-${variant} ${className}`} role="tablist" aria-label={label}>
      {items.map(t => {
        const on = t.id === value;
        return (
          <button key={t.id} type="button" role="tab" aria-selected={on} data-id={t.id}
            className={'tab' + (on ? ' on' : '')} disabled={t.disabled || (readOnly && !on)}
            onClick={() => { if (!readOnly && !on) onChange?.(t.id); }}>
            {t.glyph && <span className="tab-glyph" aria-hidden="true">{t.glyph}</span>}
            <span className="tab-text">
              <span className="tab-label">{t.label}</span>
              {t.sub && <span className="tab-sub">{t.sub}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
