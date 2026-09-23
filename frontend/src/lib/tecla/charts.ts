// @ts-nocheck — módulo portado del prototipo; pendiente de tipar (ver README)
import { h } from '@/lib/tecla/utils';

/* =========================================================
   gráficos simples en SVG
   ========================================================= */
export function niceStep(v) { const p = 10 ** Math.floor(Math.log10(Math.max(v, 1e-9))), n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; }
export function lineChart(series, { marks = [], xl = i => i + 1, H = 190, dots = false } = {}) {
  const W = 640, pl = 36, pr = 10, pt = 12, pb = 24;
  const n = Math.max(...series.map(s => s.v.length));
  if (n < 2) return h('p', { class: 'sub', text: 'Todavía no hay suficientes datos para graficar.' });
  const vals = series.flatMap(s => s.v);
  const step = niceStep(Math.max(10, ...vals) / 4); const ymax = Math.ceil(Math.max(10, ...vals) / step) * step;
  const x = i => pl + (W - pl - pr) * i / (n - 1), y = v => pt + (H - pt - pb) * (1 - v / ymax);
  let s = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="gráfico">`;
  for (let v = 0; v <= ymax + 1e-9; v += step) s += `<line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${pl - 7}" y="${y(v) + 4}" class="ax" text-anchor="end">${Math.round(v)}</text>`;
  const every = Math.max(1, Math.ceil(n / 8));
  for (let i = 0; i < n; i += every) s += `<text x="${x(i)}" y="${H - 6}" class="ax" text-anchor="middle">${xl(i)}</text>`;
  series.forEach((se, k) => {
    const d = se.v.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
    if (k === 0) s += `<path class="area" d="${d}L${x(se.v.length - 1)},${y(0)}L${x(0)},${y(0)}Z"/>`;
    s += `<path class="${se.cls}" d="${d}"/>`;
    if (k === 0 && dots) { const li = se.v.length - 1; s += `<circle class="dot" cx="${x(li)}" cy="${y(se.v[li])}" r="4.5"/>`; }
  });
  marks.forEach((m, i) => { if (m) s += `<text x="${x(i)}" y="${pt + 4}" class="mk" text-anchor="middle">×</text>`; });
  const wrap = h('div'); wrap.innerHTML = s + '</svg>'; return wrap.firstChild;
}
