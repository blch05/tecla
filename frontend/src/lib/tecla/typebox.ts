import { avg, baseKey, clamp, h, now } from '@/lib/tecla/utils';
import { isLetter, recordKey, saveKS } from '@/lib/tecla/keystats';
import { focusKb } from '@/lib/tecla/input';

/* =========================================================
   TypeBox — el motor de tipeo estilo monkeytype
   - pinta las palabras letra por letra (bien, mal, de más)
   - mueve el caret y el caret "fantasma" de tu récord
   - toma una muestra por segundo para el gráfico y las estadísticas
   Es imperativo a propósito: cada tecla toca solo la palabra actual del DOM,
   sin pasar por el render de React.
   ========================================================= */

/** Un punto de la línea de tiempo: [ms desde el inicio, palabra, letras escritas]. Sirve para reproducir el fantasma. */
export type TimelinePoint = [ms: number, word: number, chars: number];

/** estadísticas por letra de esta partida (mismas claves que el mapa de calor) */
export interface LetterStat { n: number; e: number; t: number; c: number }

interface Sample { t: number; correct: number; all: number; err: number }

export interface PerSecond { wpm: number; raw: number; err: number }

export interface TypeStats {
  secs: number;
  /** palabras por minuto contando solo letras correctas (5 letras = 1 palabra) */
  wpm: number;
  /** velocidad bruta: todo lo tipeado */
  raw: number;
  /** % de pulsaciones correctas */
  acc: number;
  /** consistencia: 100 − coeficiente de variación de la velocidad por segundo */
  cons: number;
  correct: number;
  all: number;
  per: PerSecond[];
  kstat: Record<string, LetterStat>;
}

export interface TypeBoxEvents {
  ghostLabel?: string;
  onStart?: () => void;
  onInput?: () => void;
  onTick?: (elapsed: number) => void;
  onWord?: (correct: boolean, word: string, index: number) => void;
  onFinish?: (s: TypeStats) => void;
}

export interface LoadOpts {
  /** línea de tiempo de la partida contra la que se corre */
  ghost?: TimelinePoint[] | null;
  /** generador de más palabras (modo por tiempo: el texto no se termina nunca) */
  extend?: ((n: number) => string[]) | null;
  /** duración en segundos; 0 = termina al completar las palabras */
  time?: number;
}

/** cuántas letras de más se aceptan por palabra antes de ignorar la tecla */
const MAX_EXTRA = 10;
/** en modo extendido, cuántas palabras quedan por delante antes de pedir más */
const REFILL_AT = 30;

export class TypeBox {
  readonly root: HTMLElement;
  private readonly o: TypeBoxEvents;
  private readonly inner: HTMLDivElement;
  private readonly wordsEl: HTMLDivElement;
  private readonly caret: HTMLDivElement;
  private readonly gcaret: HTMLDivElement;
  private wordEls: HTMLSpanElement[] = [];

  words: string[] = [];
  typed: string[] = [''];
  /** índice de la palabra actual */
  wi = 0;
  /** inicio en ms (performance.now). También marca "ya empezó": nunca vale 0 una vez arrancado. */
  t0 = 0;
  done = false;
  /** línea de tiempo de esta partida (se guarda con el récord para ser el próximo fantasma) */
  tl: TimelinePoint[] = [];
  kstat: Record<string, LetterStat> = {};

  private keys: boolean[] = [];
  private samples: Sample[] = [];
  private ghost: TimelinePoint[] | null = null;
  private extend: ((n: number) => string[]) | null = null;
  private time = 0;
  private tEnd = 0;
  private lastT = 0;
  private lastSec = 0;
  private errSec = 0;
  private prev: string | null = null;
  private gi = 0;
  private lineH = 40;
  private timer: ReturnType<typeof setInterval> | null = null;
  private pt: ReturnType<typeof setTimeout> | undefined;

  constructor(root: HTMLElement, o: TypeBoxEvents = {}) {
    this.root = root; this.o = o; root.classList.add('tb'); root.replaceChildren();
    this.inner = h('div', { class: 'tb-inner' });
    this.wordsEl = h('div', { class: 'words' });
    this.caret = h('div', { class: 'caret' });
    this.gcaret = h('div', { class: 'caret ghost', hidden: true }, h('span', { class: 'gtag', text: o.ghostLabel || 'récord' }));
    this.inner.append(this.wordsEl, this.caret, this.gcaret); root.append(this.inner);
    root.addEventListener('mousedown', e => { e.preventDefault(); focusKb(); });
  }

  load(words: string[], { ghost = null, extend = null, time = 0 }: LoadOpts = {}) {
    this.stop();
    this.words = words.slice(); this.typed = ['']; this.wi = 0; this.t0 = 0; this.done = false;
    this.keys = []; this.tl = []; this.samples = []; this.kstat = {};
    this.ghost = ghost; this.extend = extend; this.time = time;
    this.lastT = 0; this.prev = null; this.gi = 0; this.lastSec = 0; this.errSec = 0;
    this.wordsEl.replaceChildren(); this.wordEls = []; this.addWords(0);
    this.inner.style.transform = ''; this.gcaret.hidden = !ghost; this.root.classList.remove('typing');
    requestAnimationFrame(() => this.refresh());
  }

  /** Recalcula medidas (al cargar o si cambió la fuente/tamaño). */
  refresh() {
    this.lineH = parseFloat(getComputedStyle(this.root).lineHeight) || 40;
    this.after();
    if (this.ghost) this.placeCaret(this.gcaret, 0, 0);
  }

  private addWords(from: number) {
    const f = document.createDocumentFragment();
    for (let i = from; i < this.words.length; i++) { const el = h('span', { class: 'word' }); this.wordEls[i] = el; this.paint(i, el); f.append(el); }
    this.wordsEl.append(f);
  }

  private paint(i: number, el = this.wordEls[i]) {
    if (!el) return;
    const w = this.words[i], t = this.typed[i] || ''; el.textContent = '';
    const n = Math.max(w.length, t.length);
    for (let j = 0; j < n; j++) {
      const s = document.createElement('span'); s.className = 'l';
      if (j < w.length) {
        // letra errada: se ve la que escribiste, tachada, y arriba chiquita la que iba
        if (j < t.length && t[j] !== w[j]) { s.textContent = t[j]; s.className += ' bad'; s.dataset.exp = w[j]; }
        else { s.textContent = w[j]; if (j < t.length) s.className += ' ok'; }
      }
      else { s.textContent = t[j]; s.className += ' extra'; }
      el.append(s);
    }
    el.classList.toggle('err', i < this.wi && t !== w);
  }

  private placeCaret(el: HTMLElement, wi: number, ci: number) {
    const wEl = this.wordEls[wi]; if (!wEl || !wEl.children.length) return;
    const ls = wEl.children as HTMLCollectionOf<HTMLElement>; let x: number, y: number;
    if (ci < ls.length) { x = ls[ci].offsetLeft; y = ls[ci].offsetTop; }
    else { const last = ls[ls.length - 1]; x = last.offsetLeft + last.offsetWidth; y = last.offsetTop; }
    el.style.transform = `translate(${x}px,${y}px)`;
  }

  /** caret en su lugar y scroll para que la línea actual quede siempre segunda */
  private after() {
    if (!this.wordEls[this.wi]) return;
    this.placeCaret(this.caret, this.wi, (this.typed[this.wi] || '').length);
    const off = Math.max(0, this.wordEls[this.wi].offsetTop - this.lineH);
    this.inner.style.transform = `translateY(${-off}px)`;
  }

  private begin() { this.t0 = Math.max(now(), 1e-3); this.o.onStart?.(); this.timer = setInterval(() => this.tick(), 100); }
  private pulse() { this.root.classList.add('typing'); clearTimeout(this.pt); this.pt = setTimeout(() => this.root.classList.remove('typing'), 700); }
  private log() { this.tl.push([Math.round(now() - this.t0), this.wi, (this.typed[this.wi] || '').length]); }

  char(c: string) {
    if (this.done) return;
    if (c === ' ') return this.space();
    if (!this.t0) this.begin();
    const t = now(), w = this.words[this.wi], ti = this.typed[this.wi];
    if (ti.length >= w.length + MAX_EXTRA) return;
    const exp = w[ti.length] as string | undefined, ok = c === exp, dt = this.lastT ? t - this.lastT : 0;
    this.lastT = t;
    this.keys.push(ok);
    if (!ok) this.errSec++;
    if (exp !== undefined) {
      recordKey(exp, c, dt, this.prev);
      const k = baseKey(exp);
      if (isLetter(exp)) {
        const s = this.kstat[k] || (this.kstat[k] = { n: 0, e: 0, t: 0, c: 0 });
        s.n++; if (!ok) s.e++; else if (dt && dt < 1500) { s.t += dt; s.c++; }
      }
    }
    this.prev = ok ? c : null;
    this.typed[this.wi] = ti + c;
    this.paint(this.wi); this.log(); this.after(); this.pulse();
    this.o.onInput?.();
    if (!this.extend && this.wi === this.words.length - 1 && this.typed[this.wi] === w) this.finish();
  }

  private space() {
    if (!this.t0 || this.done) return;
    const ti = this.typed[this.wi]; if (!ti) return;
    const w = this.words[this.wi], correct = ti === w;
    this.keys.push(correct); if (!correct) this.errSec++;
    this.lastT = now(); this.prev = null;
    this.wi++; this.typed[this.wi] = '';
    this.paint(this.wi - 1);
    this.o.onWord?.(correct, w, this.wi - 1);
    if (this.done) return; // onWord puede terminar la partida (p. ej. en competir)
    if (this.wi >= this.words.length && !this.extend) return this.finish();
    if (this.extend && this.words.length - this.wi < REFILL_AT) this.more();
    this.log(); this.after(); this.pulse();
    this.o.onInput?.();
  }

  /** Borrar. Con Ctrl borra la palabra entera. Solo se puede volver a la palabra anterior si quedó mal. */
  back(ctrl: boolean) {
    if (this.done || !this.t0) return;
    const ti = this.typed[this.wi];
    if (!ti) {
      if (this.wi > 0 && this.typed[this.wi - 1] !== this.words[this.wi - 1]) {
        this.typed.pop(); this.wi--;
        if (ctrl) this.typed[this.wi] = '';
        this.paint(this.wi); this.after();
      }
      return;
    }
    this.typed[this.wi] = ctrl ? '' : ti.slice(0, -1);
    this.paint(this.wi); this.log(); this.after(); this.pulse();
  }

  private more() { if (!this.extend) return; const start = this.words.length; this.words.push(...this.extend(40)); this.addWords(start); }

  /** Letras correctas y totales, contando el espacio de cada palabra terminada. */
  counts() {
    let correct = 0, all = 0;
    for (let i = 0; i < this.wi; i++) { const w = this.words[i], t = this.typed[i]; all += t.length + 1; if (t === w) correct += w.length + 1; }
    const cur = this.typed[this.wi] || '', w = this.words[this.wi] || '';
    all += cur.length; let k = 0; while (k < cur.length && cur[k] === w[k]) k++;
    if (k === cur.length) correct += k;
    return { correct, all };
  }
  /** Letras del texto ya recorridas (para las barras de progreso de las carreras). */
  charsDone() {
    let d = 0; for (let i = 0; i < this.wi; i++) d += this.words[i].length + 1;
    const cur = this.typed[this.wi] || '', w = this.words[this.wi] || '';
    let k = 0; while (k < cur.length && cur[k] === w[k]) k++;
    return d + k;
  }
  totalChars() { return this.words.reduce((s, w) => s + w.length + 1, 0) - 1; }
  progress() { return Math.min(1, this.charsDone() / Math.max(1, this.totalChars())); }
  /** segundos desde la primera tecla */
  elapsed() { return this.t0 ? ((this.done ? this.tEnd * 1000 : now() - this.t0) / 1000) : 0; }

  private tick() {
    if (this.done) return;
    const el = (now() - this.t0) / 1000, sec = Math.floor(el);
    while (this.lastSec < sec) { this.lastSec++; const c = this.counts(); this.samples.push({ t: this.lastSec, correct: c.correct, all: c.all, err: this.errSec }); this.errSec = 0; }
    if (this.ghost) {
      const ms = el * 1000, g = this.ghost;
      while (this.gi < g.length && g[this.gi][0] <= ms) this.gi++;
      const e = g[this.gi - 1]; if (e && this.wordEls[e[1]]) this.placeCaret(this.gcaret, e[1], e[2]);
    }
    this.o.onTick?.(el);
    if (this.time && el >= this.time) this.finish();
  }

  wpmNow() { const el = this.elapsed(); return el > 0.3 ? this.counts().correct / 5 / (el / 60) : 0; }

  stats(): TypeStats {
    const secs = Math.max(this.elapsed(), 0.5), c = this.counts();
    const oks = this.keys.filter(Boolean).length, acc = this.keys.length ? oks / this.keys.length * 100 : 100;
    const per = this.samples.map((s, i) => {
      const p = this.samples[i - 1] || { t: 0, correct: 0, all: 0 };
      return { wpm: s.correct / 5 / (s.t / 60), raw: (s.all - p.all) / 5 / (Math.max(.2, s.t - p.t) / 60), err: s.err };
    });
    const raws = per.map(p => p.raw), m = avg(raws), sd = Math.sqrt(avg(raws.map(v => (v - m) ** 2)));
    return { secs, wpm: c.correct / 5 / (secs / 60), raw: c.all / 5 / (secs / 60), acc, cons: m ? clamp(100 * (1 - sd / m), 0, 100) : 0, correct: c.correct, all: c.all, per, kstat: this.kstat };
  }

  finish() {
    if (this.done) return;
    this.done = true; this.tEnd = (now() - this.t0) / 1000; this.stop();
    const c = this.counts(); const last = this.samples[this.samples.length - 1];
    // la última fracción de segundo también cuenta (si no, un test de 15,9 s pierde casi un segundo)
    if (!last || this.tEnd - last.t > 0.25) this.samples.push({ t: this.tEnd, correct: c.correct, all: c.all, err: this.errSec });
    saveKS();
    this.o.onFinish?.(this.stats());
  }

  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; }
}
