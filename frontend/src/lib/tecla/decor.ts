import { $, $$, h, rng } from '@/lib/tecla/utils';

/* =========================================================
   decoración: tiras de * — | y código de barras
   (con semilla fija: se ven igual en cada visita)
   ========================================================= */
const PARTS = ['*', '—', '— —', '|', '||', '|||', '-', '* *', '/', '—*—'];

export function decorate() {
  $$('.deco').forEach((el, i) => {
    const r = rng(1234 + i * 77);
    let s = ''; const n = Number(el.dataset.n) || 160;
    while (s.length < n) s += PARTS[Math.floor(r() * PARTS.length)] + ' '.repeat(2 + Math.floor(r() * 4));
    el.textContent = s;
  });
  const bars = $('.bars');
  if (bars) { const r = rng(99); for (let i = 0; i < 34; i++) bars.append(h('i', { style: `width:${1 + Math.floor(r() * 3)}px;height:${30 + Math.floor(r() * 70)}%` })); }
}
