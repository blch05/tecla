// @ts-nocheck — módulo portado del prototipo; pendiente de tipar (ver README)
import { $, avg, baseKey, h, nav, store, toast } from '@/lib/tecla/utils';
import { KS, weakData } from '@/lib/tecla/keystats';
import { lineChart } from '@/lib/tecla/charts';
import { Test } from '@/lib/tecla/views/test';
import { ARC } from '@/lib/tecla/views/arcade';
import { setConsumer } from '@/lib/tecla/input';

/* =========================================================
   vista: PROGRESO
   ========================================================= */
export const Stats: any = {
  mode: 'err',
  enter() { setConsumer(null); this.render(); }, leave() {},
  render() {
    const v = $('#v-stats'), hist = store.get('hist', []).filter(x => !x.weak), last10 = hist.slice(-10);
    const best = hist.reduce((m, x) => Math.max(m, x.wpm), 0);
    const tiles = h('div', { class: 'tiles' }, ...[
      ['tests', hist.length, ''], ['promedio (últimos 10)', last10.length ? Math.round(avg(last10.map(x => x.wpm))) : '—', 'acc'],
      ['mejor marca', best ? Math.round(best) : '—', ''], ['precisión media', last10.length ? Math.round(avg(last10.map(x => x.acc))) + '%' : '—', ''],
    ].map(([l, n, c]) => h('div', { class: 'tile ' + c }, h('span', { class: 'lbl', text: l }), h('b', { text: n }))));
    const recent = hist.slice(-40);
    let proj = 'Hacé algunos tests más y te mostramos a qué ritmo estás mejorando.';
    if (recent.length >= 6) {
      const n = recent.length, xs = recent.map((_, i) => i), ys = recent.map(x => x.wpm), mx = avg(xs), my = avg(ys);
      const slope = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / xs.reduce((s, x) => s + (x - mx) ** 2, 0);
      const target = Math.ceil((my + 1) / 10) * 10;
      proj = slope > 0.05 ? `Venís sumando ${slope.toFixed(2)} ppm por test. A este ritmo llegás a ${target} ppm en unos ${Math.max(1, Math.ceil((target - (my + slope * (n - 1 - mx))) / slope))} tests más.` : 'Tu velocidad está estable. Probá el modo de puntos débiles para destrabarte.';
    }
    const prog = h('div', { class: 'panel' }, h('span', { class: 'corner', text: '— — *' }), h('span', { class: 'eyebrow', text: 'progreso · ppm por test' }), h('div', { style: 'margin-top:10px' }, lineChart([{ v: recent.map(x => x.wpm), cls: 'ln' }], { H: 170, dots: true, xl: i => hist.length - recent.length + i + 1 })), h('p', { class: 'sub', style: 'margin-top:8px;font-size:13.5px', text: proj }));

    const agg = {}; Object.entries(KS.keys).forEach(([k, s]) => { const b = baseKey(k); const a = agg[b] || (agg[b] = { n: 0, e: 0, t: 0, c: 0 }); a.n += s.n; a.e += s.e; a.t += s.t; a.c += s.c; });
    const vals = {}; Object.entries(agg).filter(([, s]) => s.n >= 3).forEach(([k, s]) => vals[k] = this.mode === 'err' ? s.e / s.n : (s.c ? s.t / s.c : 0));
    const arr = Object.values(vals).filter(x => x > 0), mx = Math.max(...arr, 0), mn = this.mode === 'err' ? 0 : Math.min(...arr, mx);
    const kbd = h('div', { class: 'kbd', style: `--hc:${this.mode === 'err' ? 'var(--err)' : 'var(--accent)'}` });
    ['qwertyuiop', 'asdfghjklñ', 'zxcvbnm'].forEach((row, ri) => kbd.append(h('div', { class: 'krow', style: `margin-left:${ri * 16}px` }, ...[...row].map(k => {
      const s = agg[k], val = vals[k]; const t = val != null && mx > mn ? (val - mn) / (mx - mn) : 0;
      return h('div', { class: 'key' + (t > .6 ? ' hot' : ''), style: `--v:${(t * .85).toFixed(2)}`, title: s ? `${k}: ${s.n} pulsaciones · ${Math.round(s.e / s.n * 100)}% errores · ${s.c ? Math.round(s.t / s.c) : '—'} ms` : `${k}: sin datos`, text: k });
    }))));
    const tog = h('div', { class: 'cfgbar', style: 'align-self:flex-start' }, h('button', { class: 'opt' + (this.mode === 'err' ? ' on' : ''), text: 'errores', onclick: () => { this.mode = 'err'; this.render(); } }), h('button', { class: 'opt' + (this.mode === 'ms' ? ' on' : ''), text: 'lentitud', onclick: () => { this.mode = 'ms'; this.render(); } }));
    const { bis } = weakData(); const slowB = bis.filter(b => b.ms).sort((a, b) => (b.ms + b.err * 800) - (a.ms + a.err * 800)).slice(0, 10);
    const heat = h('div', { class: 'panel', style: 'display:flex;flex-direction:column;gap:12px' }, h('span', { class: 'corner', text: '| * |' }),
      h('div', { class: 'row', style: 'justify-content:space-between' }, h('span', { class: 'eyebrow', text: 'mapa de calor del teclado' }), tog),
      arr.length ? kbd : h('p', { class: 'sub', text: 'Todavía no hay datos. Cada test que hagas va llenando el mapa.' }),
      arr.length ? h('div', { class: 'klegend', style: `--hc:${this.mode === 'err' ? 'var(--err)' : 'var(--accent)'}` }, this.mode === 'err' ? 'menos errores' : 'más rápida', h('span', { class: 'grad' }), this.mode === 'err' ? 'más errores' : 'más lenta') : '');
    const weak = h('div', { class: 'panel', style: 'display:flex;flex-direction:column;gap:12px' },
      h('span', { class: 'eyebrow', text: 'combinaciones que te frenan' }),
      slowB.length ? h('div', { class: 'chips' }, ...slowB.map(b => h('span', { class: 'chip' + (b.err > .12 ? ' bad' : '') }, b.b, h('small', { text: `${Math.round(b.ms)} ms${b.err > .05 ? ' · ' + Math.round(b.err * 100) + '%' : ''}` })))) : h('p', { class: 'sub', text: 'Aparecen cuando juntemos suficientes pulsaciones de cada par de letras.' }),
      h('p', { class: 'sub', style: 'font-size:13px', text: 'El modo de puntos débiles arma textos con las palabras que más usan estas teclas y combinaciones.' }),
      h('div', { class: 'row' }, h('button', { class: 'btn primary', text: 'entrenar puntos débiles', onclick: () => { Test.cfg.weak = true; Test.save(); Test.renderCfg(); nav.go('/test'); } })));
    const arcs = h('div', { class: 'panel', style: 'display:flex;flex-direction:column;gap:10px' }, h('span', { class: 'eyebrow', text: 'récords de arcade y racha diaria' }),
      h('div', { class: 'minis' }, ...Object.entries(ARC).map(([k, m]) => h('div', { class: 'mini' }, h('span', { class: 'lbl', text: m.name }), h('b', { text: Math.max(store.get('arc:' + k, 0), store.get('arc:' + k + ':facil', 0), store.get('arc:' + k + ':dificil', 0)) }))), h('div', { class: 'mini' }, h('span', { class: 'lbl', text: 'racha diaria' }), h('b', { text: store.get('streak', { n: 0 }).n + ' días' }))));
    const resetBtn = h('button', { class: 'btn ghost', text: 'borrar mi progreso', onclick: () => {
      if (resetBtn.dataset.sure) { Object.keys(localStorage).filter(k => k.startsWith('tecla:')).forEach(k => { try { localStorage.removeItem(k); } catch {} }); KS.keys = {}; KS.bi = {}; toast('Progreso borrado'); this.render(); }
      else { resetBtn.dataset.sure = '1'; resetBtn.textContent = '¿seguro? tocá de nuevo para borrar todo'; setTimeout(() => { if (resetBtn.isConnected) { delete resetBtn.dataset.sure; resetBtn.textContent = 'borrar mi progreso'; } }, 4000); }
    } });
    void arcs;
    prog.append(h('div', { class: 'row', style: 'justify-content:flex-end;margin-top:auto' }, resetBtn));
    heat.append(h('div', { style: 'border-top:1px dashed var(--line);margin:4px 0 2px' }), ...[...weak.childNodes]);
    prog.style.cssText = 'display:flex;flex-direction:column;gap:8px';
    v.replaceChildren(tiles, h('div', { class: 'two fill' }, prog, heat));
  },
};
