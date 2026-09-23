// @ts-nocheck — módulo portado del prototipo; pendiente de tipar (ver README)
import { $, $$, h, rand, store, toast } from '@/lib/tecla/utils';
import { Sfx } from '@/lib/tecla/sfx';
import { countUp, shiny } from '@/lib/tecla/bits';
import { VOCAB, VOCAB_NAMES, wordGen } from '@/lib/tecla/data/words';
import { KS, weakWordGen } from '@/lib/tecla/keystats';
import { TypeBox } from '@/lib/tecla/typebox';
import { lineChart } from '@/lib/tecla/charts';
import { getConsumer, setConsumer } from '@/lib/tecla/input';
import { History } from '@/lib/tecla/history';

/* =========================================================
   vista: TEST
   ========================================================= */
export const Test: any = {
  cfg: Object.assign({ mode: 'time', time: 30, words: 25, ghost: true, weak: false, vocab: 'medio', sound: 'off' }, store.get('cfg', {})),
  init() {
    this.box = new TypeBox($('#test-box'), { onTick: () => this.live(), onInput: () => this.live(), onFinish: s => this.finish(s) });
    this.consumer = { char: c => { if (this.box.done) return; this.sound(c); this.box.char(c); }, back: x => this.box.back(x), tab: () => this.restart(), enter: () => { if (this.box.done) this.restart(); } };
    this.renderCfg(); this.restart();
  },
  sound(c) {
    const p = this.cfg.sound || 'off'; if (p === 'off') return;
    Sfx.init();
    const b = this.box, w = b.words[b.wi] || '', typed = b.typed[b.wi] || '';
    if (c !== ' ' && w[typed.length] !== c) Sfx.typeErr(p); else Sfx.typeKey(p, c === ' ');
  },
  key() { return (this.cfg.mode === 'time' ? 't' + this.cfg.time : 'w' + this.cfg.words) + (this.cfg.vocab && this.cfg.vocab !== 'medio' ? '-' + this.cfg.vocab : ''); },
  vlabel() { return this.cfg.vocab && this.cfg.vocab !== 'medio' ? ' · ' + VOCAB_NAMES[this.cfg.vocab] : ''; },
  save() { store.set('cfg', this.cfg); },
  renderCfg() {
    const c = this.cfg, bar = $('#test-cfg'); bar.replaceChildren();
    const opt = (label, on, fn, title) => h('button', { class: 'opt' + (on ? ' on' : ''), text: label, title, onclick: () => { fn(); this.save(); this.renderCfg(); this.restart(); } });
    bar.append(
      h('div', { class: 'grp' }, opt('* fantasma', c.ghost, () => c.ghost = !c.ghost, 'Corré contra tu mejor marca en el mismo texto'), opt('* puntos débiles', c.weak, () => c.weak = !c.weak, 'Palabras con tus teclas y combinaciones más flojas')),
      h('span', { class: 'sep', text: '|' }),
      h('div', { class: 'grp' }, ...Object.entries(VOCAB_NAMES).map(([k, l]) => opt(l, (c.vocab || 'medio') === k, () => c.vocab = k, k === 'facil' ? 'palabras cortas y cotidianas' : k === 'dificil' ? 'palabras largas, con tildes, ñ y términos técnicos' : 'palabras de uso común'))),
      h('span', { class: 'sep', text: '|' }),
      h('div', { class: 'grp' }, opt('tiempo', c.mode === 'time', () => c.mode = 'time'), opt('palabras', c.mode === 'words', () => c.mode = 'words')),
      h('span', { class: 'sep', text: '|' }),
      h('div', { class: 'grp' }, ...(c.mode === 'time' ? [15, 30, 60, 120].map(n => opt(String(n), c.time === n, () => c.time = n)) : [10, 25, 50, 100].map(n => opt(String(n), c.words === n, () => c.words = n)))),
      h('span', { class: 'sep', text: '|' }),
      h('div', { class: 'grp' }, (() => {
        const SOUNDS = [['off', 'sin sonido'], ['mecanico', 'mecánico'], ['suave', 'suave'], ['maquina', 'máquina']];
        const i = Math.max(0, SOUNDS.findIndex(([k]) => k === (c.sound || 'off')));
        return opt('♪ ' + SOUNDS[i][1], i > 0, () => { const k = SOUNDS[(i + 1) % SOUNDS.length][0]; c.sound = k; if (k !== 'off') { Sfx.init(); Sfx.typeKey(k); } }, 'sonido al tipear: tocá para cambiar');
      })()));
  },
  restart(seed) {
    const pb = store.get('pb:' + this.key()); this.pb = pb;
    let ghost = null; this.usingGhost = false;
    if (seed == null) seed = rand();
    if (this.cfg.ghost && pb && !this.cfg.weak) { seed = pb.seed; ghost = pb.tl; this.usingGhost = true; }
    if (this.cfg.weak && !Object.keys(KS.keys).length) toast('Todavía no hay datos de tus teclas: hacé un par de tests primero.');
    this.seed = seed;
    const gen = this.cfg.weak ? weakWordGen(seed) : wordGen(seed, VOCAB[this.cfg.vocab] || VOCAB.medio), timed = this.cfg.mode === 'time';
    this.box.load(gen(timed ? 80 : this.cfg.words), { ghost, extend: timed ? gen : null, time: timed ? this.cfg.time : 0 });
    $('#test-res').hidden = true; $('#test-play').hidden = false;
    this.live();
    if (getConsumer() === this.consumer || !getConsumer()) setConsumer(this.consumer);
  },
  ghostChars(ms) {
    const g = this.pb && this.pb.tl; if (!g) return 0;
    let e = null; for (let i = 0; i < g.length && g[i][0] <= ms; i++) e = g[i];
    if (!e) return 0; let d = 0; for (let i = 0; i < e[1]; i++) d += this.box.words[i].length + 1; return d + e[2];
  },
  live() {
    const b = this.box, started = !!b.t0;
    $('#test-count').textContent = this.cfg.mode === 'time' ? Math.max(0, Math.ceil(this.cfg.time - b.elapsed())) : `${b.wi}/${this.cfg.words}`;
    $('#test-wpm').textContent = started ? Math.round(b.wpmNow()) + ' ppm' : (this.cfg.weak ? 'entrenando tus puntos débiles' : '');
    let g = '';
    if (this.usingGhost) {
      if (started) { const diff = b.charsDone() - this.ghostChars(b.elapsed() * 1000); g = `vs récord ${diff >= 0 ? '+' : '−'}${Math.abs(diff)} letras`; }
      else g = `fantasma: ${Math.round(this.pb.wpm)} ppm`;
    }
    $('#test-ghost').textContent = g;
  },
  finish(s) {
    const hist = store.get('hist', []);
    hist.push({ d: Date.now(), k: this.key(), wpm: +s.wpm.toFixed(1), acc: +s.acc.toFixed(1), raw: +s.raw.toFixed(1), cons: Math.round(s.cons), weak: this.cfg.weak });
    store.set('hist', hist.slice(-300));
    History.record({ t: 'test', key: this.cfg.weak ? undefined : this.key(), mode: (this.cfg.mode === 'time' ? 'tiempo ' + this.cfg.time : 'palabras ' + this.cfg.words) + this.vlabel() + (this.cfg.weak ? ' · débiles' : ''), wpm: Math.round(s.wpm), acc: Math.round(s.acc), detail: `${Math.round(s.wpm)} ppm · ${Math.round(s.acc)}% · consistencia ${Math.round(s.cons)}%`, pts: Math.round(s.wpm * s.acc / 100) });
    const pb = this.pb; let newPb = false;
    if (!this.cfg.weak && s.acc >= 75 && s.wpm > 5 && (!pb || s.wpm > pb.wpm)) { store.set('pb:' + this.key(), { wpm: s.wpm, acc: s.acc, seed: this.seed, tl: this.box.tl, d: Date.now() }); newPb = true; }
    this.showResults(s, newPb, pb);
  },
  showResults(s, newPb, pb) {
    const res = $('#test-res'); $('#test-play').hidden = true; res.hidden = false;
    const slow = Object.entries(s.kstat).map(([k, v]) => ({ k, err: v.e / v.n, ms: v.c ? v.t / v.c : 0, n: v.n })).filter(x => x.n >= 2)
      .sort((a, b) => (b.err * 600 + b.ms) - (a.err * 600 + a.ms)).slice(0, 6);
    let note;
    if (newPb && pb) note = h('div', { class: 'note' }, h('b', { text: '* nuevo récord' }), `superaste tu marca anterior de ${Math.round(pb.wpm)} ppm por ${Math.round(s.wpm - pb.wpm)} ppm. El fantasma ahora sos vos.`);
    else if (newPb) note = h('div', { class: 'note' }, h('b', { text: '* primer récord' }), 'guardamos este intento como fantasma: la próxima vez vas a correr contra él.');
    else if (pb) note = h('div', { class: 'note' }, `tu récord en este modo es ${Math.round(pb.wpm)} ppm · te faltaron ${Math.max(1, Math.round(pb.wpm - s.wpm))} ppm`);
    const label = (this.cfg.mode === 'time' ? `tiempo ${this.cfg.time}` : `palabras ${this.cfg.words}`) + this.vlabel();
    res.replaceChildren(
      h('div', { class: 'res-top' },
        h('div', { class: 'bigs' }, h('div', { class: 'big' }, h('span', { class: 'lbl', text: 'ppm' }), h('b', { text: Math.round(s.wpm) })), h('div', { class: 'big b2' }, h('span', { class: 'lbl', text: 'precisión' }), h('b', { text: Math.round(s.acc) + '%' }))),
        h('div', {}, lineChart([{ v: s.per.map(p => p.wpm), cls: 'ln' }, { v: s.per.map(p => p.raw), cls: 'ln2' }], { marks: s.per.map(p => p.err), xl: i => (i + 1) + 's', H: 150 }),
          h('div', { class: 'legend' }, h('span', {}, h('i'), 'ppm'), h('span', {}, h('i', { class: 'd' }), 'crudo por segundo'), h('span', {}, h('b', { style: 'color:var(--err)', text: '× ' }), 'errores')))),
      h('div', { class: 'minis' },
        ...[['modo', label + (this.cfg.weak ? ' · débiles' : '')], ['crudo', Math.round(s.raw)], ['consistencia', Math.round(s.cons) + '%'], ['tiempo', s.secs.toFixed(1) + 's'], ['caracteres', `${s.correct}/${s.all}`]].map(([l, v]) => h('div', { class: 'mini' }, h('span', { class: 'lbl', text: l }), h('b', { text: v })))),
      note || '',
      slow.length ? h('div', {}, h('span', { class: 'lbl', style: 'margin-bottom:6px', text: 'teclas que más te frenaron en este test' }), h('div', { class: 'chips' }, ...slow.map(x => h('span', { class: 'chip' + (x.err > .1 ? ' bad' : '') }, x.k, h('small', { text: x.err > 0 ? Math.round(x.err * 100) + '% err' : Math.round(x.ms) + ' ms' }))))) : '',
      h('div', { class: 'row' },
        h('button', { class: 'btn primary', text: 'siguiente', onclick: () => this.restart() }),
        h('button', { class: 'btn', text: 'repetir texto', onclick: () => { const g = this.cfg.ghost; this.cfg.ghost = false; this.restart(this.seed); this.cfg.ghost = g; } }),
        h('button', { class: 'btn', text: 'entrenar puntos débiles', onclick: () => { this.cfg.weak = true; this.save(); this.renderCfg(); this.restart(); } }),
        h('span', { class: 'hint' }, h('kbd', { text: 'tab' }), ' siguiente')));
    // números que cuentan y récord que brilla (React Bits: CountUp + ShinyText)
    const bigs = $$('.big b', res);
    countUp(bigs[0], Math.round(s.wpm));
    countUp(bigs[1], Math.round(s.acc), { suffix: '%' });
    if (newPb) shiny($('.note b', res), newPb && pb ? '* nuevo récord' : '* primer récord');
  },
  enter() { if (this.box.t0 && !this.box.done) this.restart(); else requestAnimationFrame(() => this.box.refresh()); setConsumer(this.consumer); },
  leave() { if (this.box.t0 && !this.box.done) this.box.stop(); },
};
