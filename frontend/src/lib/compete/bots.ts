import { avg, clamp, h, store } from '@/lib/tecla/utils';
import { setConsumer } from '@/lib/tecla/input';
import { testHistory } from '@/lib/tecla/testHistory';

/* =========================================================
   bots y piezas compartidas de los juegos de competir
   ========================================================= */
export type BotDiff = 'facil' | 'parejo' | 'dificil';
export const DIFFS: Record<BotDiff, { label: string; mul: number }> = {
  facil: { label: 'fácil', mul: 0.72 },
  parejo: { label: 'parejo', mul: 1 },
  dificil: { label: 'difícil', mul: 1.28 },
};
export const diffMul = () => (DIFFS[store.get<BotDiff>('diff', 'parejo')] || DIFFS.parejo).mul;

/** Velocidad base de los bots: tu promedio de los últimos 10 tests (45 ppm si todavía no hay). */
export function botBase() {
  const hist = testHistory.all().slice(-10);
  return clamp(hist.length ? avg(hist.map(x => x.wpm)) : 45, 20, 170);
}

/** Un rival que tipea a `wpm` con variación y pausas al azar (reproducibles con la semilla de `r`). */
export class Bot {
  chars = 0;
  private pause = 0;
  constructor(readonly name: string, readonly wpm: number, private readonly r: () => number) {}
  /** Avanza `dt` ms y devuelve cuántas letras escribió en ese lapso. */
  step(dt: number) {
    if (this.pause > 0) { this.pause -= dt; return 0; }
    if (this.r() < dt / 1000 * 0.35) { this.pause = 200 + this.r() * 700; return 0; }
    const d = this.wpm * 5 / 60 * (0.8 + this.r() * 0.4) * dt / 1000; this.chars += d; return d;
  }
}

/** Cuenta regresiva 3-2-1 sobre la arena (bloquea el teclado mientras tanto). Devuelve cómo cancelarla. */
export function countdown(area: HTMLElement, cb: () => void) {
  const ov = h('div', { class: 'count', text: '3' }); area.append(ov); setConsumer({});
  let n = 3;
  const iv = setInterval(() => { n--; if (n <= 0) { clearInterval(iv); ov.remove(); cb(); } else ov.textContent = String(n); }, 650);
  return () => { clearInterval(iv); ov.remove(); };
}

export interface Racer {
  name: string;
  /** progreso de 0 a 1 */
  p: number;
  wpm?: number;
  place?: number;
  you?: boolean;
  /** fantasma (se dibuja más tenue) */
  gh?: boolean;
  bot?: Bot;
}

/** Arma los carriles de una carrera y devuelve la función que los actualiza. */
export function makeLanes(el: HTMLElement, racers: Racer[]) {
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

export const ord = (n: number | undefined) => n + 'º';
