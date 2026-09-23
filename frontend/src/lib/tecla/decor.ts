// @ts-nocheck — módulo portado del prototipo; pendiente de tipar (ver README)
import { $, $$, h, rng } from '@/lib/tecla/utils';

/* =========================================================
   decoración: tiras de * — | y código de barras
   ========================================================= */
export function decorate() {
  $$('.deco').forEach((el, i) => {
    const r = rng(1234 + i * 77); const parts = ['*', '—', '— —', '|', '||', '|||', '-', '* *', '/', '—*—'];
    let s = ''; const n = +el.dataset.n || 160; while (s.length < n) s += parts[Math.floor(r() * parts.length)] + ' '.repeat(2 + Math.floor(r() * 4));
    el.textContent = s;
  });
  const bars = $('.bars'); if (bars) { const r = rng(99); for (let i = 0; i < 34; i++) bars.append(h('i', { style: `width:${1 + Math.floor(r() * 3)}px;height:${30 + Math.floor(r() * 70)}%` })); }
}
