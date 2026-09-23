// @ts-nocheck — módulo portado del prototipo; pendiente de tipar (ver README)
import { avg, baseKey, clamp, h, now } from '@/lib/tecla/utils';
import { isLetter, recordKey, saveKS } from '@/lib/tecla/keystats';
import { focusKb } from '@/lib/tecla/input';

/* =========================================================
   TypeBox — el motor de tipeo estilo monkeytype
   ========================================================= */
export class TypeBox {
  [key: string]: any;
  constructor(root, o = {}) {
    this.root = root; this.o = o; root.classList.add('tb'); root.replaceChildren();
    this.inner = h('div', { class: 'tb-inner' });
    this.wordsEl = h('div', { class: 'words' });
    this.caret = h('div', { class: 'caret' });
    this.gcaret = h('div', { class: 'caret ghost', hidden: true }, h('span', { class: 'gtag', text: o.ghostLabel || 'récord' }));
    this.inner.append(this.wordsEl, this.caret, this.gcaret); root.append(this.inner);
    root.addEventListener('mousedown', e => { e.preventDefault(); focusKb(); });
    this.words = []; this.wordEls = []; this.typed = ['']; this.wi = 0; this.done = false;
  }
  load(words, { ghost = null, extend = null, time = 0 } = {}) {
    this.stop();
    Object.assign(this, { words: words.slice(), typed: [''], wi: 0, t0: 0, done: false, keys: [], tl: [], ghost, extend, time, samples: [], lastT: 0, prev: null, gi: 0, lastSec: 0, errSec: 0, kstat: {} });
    this.wordsEl.replaceChildren(); this.wordEls = []; this.addWords(0);
    this.inner.style.transform = ''; this.gcaret.hidden = !ghost; this.root.classList.remove('typing');
    requestAnimationFrame(() => this.refresh());
  }
  refresh() {
    this.lineH = parseFloat(getComputedStyle(this.root).lineHeight) || 40;
    this.after();
    if (this.ghost) this.placeCaret(this.gcaret, 0, 0);
  }
  addWords(from) {
    const f = document.createDocumentFragment();
    for (let i = from; i < this.words.length; i++) { const el = h('span', { class: 'word' }); this.wordEls[i] = el; this.paint(i, el); f.append(el); }
    this.wordsEl.append(f);
  }
  paint(i, el = this.wordEls[i]) {
    if (!el) return;
    const w = this.words[i], t = this.typed[i] || ''; el.textContent = '';
    const n = Math.max(w.length, t.length);
    for (let j = 0; j < n; j++) {
      const s = document.createElement('span'); s.className = 'l';
      if (j < w.length) { s.textContent = w[j]; if (j < t.length) s.className += t[j] === w[j] ? ' ok' : ' bad'; }
      else { s.textContent = t[j]; s.className += ' extra'; }
      el.append(s);
    }
    el.classList.toggle('err', i < this.wi && t !== w);
  }
  placeCaret(el, wi, ci) {
    const wEl = this.wordEls[wi]; if (!wEl || !wEl.children.length) return;
    const ls = wEl.children; let x, y;
    if (ci < ls.length) { x = ls[ci].offsetLeft; y = ls[ci].offsetTop; }
    else { const last = ls[ls.length - 1]; x = last.offsetLeft + last.offsetWidth; y = last.offsetTop; }
    el.style.transform = `translate(${x}px,${y}px)`;
  }
  after() {
    if (!this.wordEls[this.wi]) return;
    this.placeCaret(this.caret, this.wi, (this.typed[this.wi] || '').length);
    const off = Math.max(0, this.wordEls[this.wi].offsetTop - (this.lineH || 40));
    this.inner.style.transform = `translateY(${-off}px)`;
  }
  // t0 también funciona como marca de "ya empezó" (acá y en las vistas): nunca puede valer 0
  begin() { this.t0 = Math.max(now(), 1e-3); this.o.onStart && this.o.onStart(); this.timer = setInterval(() => this.tick(), 100); }
  pulse() { this.root.classList.add('typing'); clearTimeout(this.pt); this.pt = setTimeout(() => this.root.classList.remove('typing'), 700); }
  log() { this.tl.push([Math.round(now() - this.t0), this.wi, (this.typed[this.wi] || '').length]); }
  char(c) {
    if (this.done) return;
    if (c === ' ') return this.space();
    if (!this.t0) this.begin();
    const t = now(), w = this.words[this.wi], ti = this.typed[this.wi];
    if (ti.length >= w.length + 10) return;
    const exp = w[ti.length], ok = c === exp, dt = this.lastT ? t - this.lastT : 0;
    this.lastT = t;
    this.keys.push(ok);
    if (!ok) this.errSec++;
    if (exp !== undefined) {
      recordKey(exp, c, dt, this.prev);
      const k = baseKey(exp);
      if (isLetter(exp)) { const s = this.kstat[k] || (this.kstat[k] = { n: 0, e: 0, t: 0, c: 0 }); s.n++; if (!ok) s.e++; else if (dt && dt < 1500) { s.t += dt; s.c++; } }
    }
    this.prev = ok ? c : null;
    this.typed[this.wi] = ti + c;
    this.paint(this.wi); this.log(); this.after(); this.pulse();
    this.o.onInput && this.o.onInput();
    if (!this.extend && this.wi === this.words.length - 1 && this.typed[this.wi] === w) this.finish();
  }
  space() {
    if (!this.t0 || this.done) return;
    const ti = this.typed[this.wi]; if (!ti) return;
    const w = this.words[this.wi], correct = ti === w;
    this.keys.push(correct); if (!correct) this.errSec++;
    this.lastT = now(); this.prev = null;
    this.wi++; this.typed[this.wi] = '';
    this.paint(this.wi - 1);
    this.o.onWord && this.o.onWord(correct, w, this.wi - 1);
    if (this.done) return;
    if (this.wi >= this.words.length && !this.extend) return this.finish();
    if (this.extend && this.words.length - this.wi < 30) this.more();
    this.log(); this.after(); this.pulse();
    this.o.onInput && this.o.onInput();
  }
  back(ctrl) {
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
  more() { const start = this.words.length; this.words.push(...this.extend(40)); this.addWords(start); }
  counts() {
    let correct = 0, all = 0;
    for (let i = 0; i < this.wi; i++) { const w = this.words[i], t = this.typed[i]; all += t.length + 1; if (t === w) correct += w.length + 1; }
    const cur = this.typed[this.wi] || '', w = this.words[this.wi] || '';
    all += cur.length; let k = 0; while (k < cur.length && cur[k] === w[k]) k++;
    if (k === cur.length) correct += k;
    return { correct, all };
  }
  charsDone() { let d = 0; for (let i = 0; i < this.wi; i++) d += this.words[i].length + 1; const cur = this.typed[this.wi] || '', w = this.words[this.wi] || ''; let k = 0; while (k < cur.length && cur[k] === w[k]) k++; return d + k; }
  totalChars() { return this.words.reduce((s, w) => s + w.length + 1, 0) - 1; }
  progress() { return Math.min(1, this.charsDone() / Math.max(1, this.totalChars())); }
  elapsed() { return this.t0 ? ((this.done ? this.tEnd * 1000 : now() - this.t0) / 1000) : 0; }
  tick() {
    if (this.done) return;
    const el = (now() - this.t0) / 1000, sec = Math.floor(el);
    while (this.lastSec < sec) { this.lastSec++; const c = this.counts(); this.samples.push({ t: this.lastSec, correct: c.correct, all: c.all, err: this.errSec }); this.errSec = 0; }
    if (this.ghost) {
      const ms = el * 1000, g = this.ghost;
      while (this.gi < g.length && g[this.gi][0] <= ms) this.gi++;
      const e = g[this.gi - 1]; if (e && this.wordEls[e[1]]) this.placeCaret(this.gcaret, e[1], e[2]);
    }
    this.o.onTick && this.o.onTick(el);
    if (this.time && el >= this.time) this.finish();
  }
  wpmNow() { const el = this.elapsed(); return el > 0.3 ? this.counts().correct / 5 / (el / 60) : 0; }
  stats() {
    const secs = Math.max(this.elapsed(), 0.5), c = this.counts();
    const oks = this.keys.filter(Boolean).length, acc = this.keys.length ? oks / this.keys.length * 100 : 100;
    const per = this.samples.map((s, i) => { const p = this.samples[i - 1] || { t: 0, correct: 0, all: 0 }; return { wpm: s.correct / 5 / (s.t / 60), raw: (s.all - p.all) / 5 / (Math.max(.2, s.t - p.t) / 60), err: s.err }; });
    const raws = per.map(p => p.raw), m = avg(raws), sd = Math.sqrt(avg(raws.map(v => (v - m) ** 2)));
    return { secs, wpm: c.correct / 5 / (secs / 60), raw: c.all / 5 / (secs / 60), acc, cons: m ? clamp(100 * (1 - sd / m), 0, 100) : 0, correct: c.correct, all: c.all, per, kstat: this.kstat };
  }
  finish() {
    if (this.done) return;
    this.done = true; this.tEnd = (now() - this.t0) / 1000; this.stop();
    const c = this.counts(); const last = this.samples[this.samples.length - 1];
    if (!last || this.tEnd - last.t > 0.25) this.samples.push({ t: this.tEnd, correct: c.correct, all: c.all, err: this.errSec });
    saveKS();
    this.o.onFinish && this.o.onFinish(this.stats());
  }
  stop() { clearInterval(this.timer); this.timer = null; }
}
