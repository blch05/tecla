// @ts-nocheck — módulo portado del prototipo; pendiente de tipar (ver README)
import { avg, clamp, h, store } from '@/lib/tecla/utils';
import { setConsumer } from '@/lib/tecla/input';

/* =========================================================
   helpers de bots y competencia
   ========================================================= */
export const DIFFS: any = { facil: ['fácil', .72], parejo: ['parejo', 1], dificil: ['difícil', 1.28] };
export function diffMul() { return DIFFS[store.get('diff', 'parejo')][1]; }
export function botBase() { const hist = store.get('hist', []).slice(-10); return clamp(hist.length ? avg(hist.map(x => x.wpm)) : 45, 20, 170); }
export class Bot {
  [key: string]: any;
  constructor(name, wpm, r) { this.name = name; this.wpm = wpm; this.r = r; this.chars = 0; this.pause = 0; }
  step(dt) {
    if (this.pause > 0) { this.pause -= dt; return 0; }
    if (this.r() < dt / 1000 * 0.35) { this.pause = 200 + this.r() * 700; return 0; }
    const d = this.wpm * 5 / 60 * (0.8 + this.r() * 0.4) * dt / 1000; this.chars += d; return d;
  }
}
export function countdown(area, cb) {
  const ov = h('div', { class: 'count', text: '3' }); area.append(ov); setConsumer({});
  let n = 3; const iv = setInterval(() => { n--; if (n <= 0) { clearInterval(iv); ov.remove(); cb(); } else ov.textContent = n; }, 650);
  return () => { clearInterval(iv); ov.remove(); };
}
export function makeLanes(el, racers) {
  el.replaceChildren();
  const rows = racers.map(r => {
    const trail = h('div', { class: 'trail' }), mk = h('span', { class: 'runner', text: '*' }), info = h('span', { class: 'lane-info' });
    el.append(h('div', { class: 'lane' + (r.you ? ' you' : '') + (r.gh ? ' gh' : '') }, h('span', { class: 'lane-name', text: r.name }), h('div', { class: 'track' }, trail, mk, h('span', { class: 'flag', text: '|||' })), info));
    return { r, trail, mk, info };
  });
  return () => rows.forEach(({ r, trail, mk, info }) => {
    const p = clamp(r.p || 0, 0, 1) * 100; trail.style.width = p + '%'; mk.style.left = p + '%';
    info.textContent = r.place ? `${r.place}º · ${Math.round(r.wpm || 0)} ppm` : (r.wpm ? Math.round(r.wpm) + ' ppm' : '');
  });
}
export function ord(n) { return n + 'º'; }
