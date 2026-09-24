// @ts-nocheck — módulo portado del prototipo; pendiente de tipar (ver README)
import { $, $$, clamp, h, now, rng, shuffle, store, toast } from '@/lib/tecla/utils';
import { SENTENCES, VOCAB } from '@/lib/tecla/data/words';
import { focusKb, setConsumer } from '@/lib/tecla/input';
import { History } from '@/lib/tecla/history';
import { nav } from '@/lib/tecla/utils';
import { Sfx } from '@/lib/tecla/sfx';
import { tabs } from '@/lib/tecla/bits';
import { gameTabs } from '@/lib/games';
import { RUNNER_OBS, runnerBack, runnerChar, runnerDraw, runnerStart, runnerUpdate } from '@/lib/tecla/views/runner';
export { Sfx };

/* =========================================================
   vista: ARCADE (canvas)
   ========================================================= */
export const ARC: any = {
  caen: {
    name: 'palabras que caen',
    desc: 'Las palabras caen desde arriba: tipeá cada una antes de que toque el piso. Ojo con las rápidas (rojas), las que zigzaguean y las que se parten en dos. Encadená 10 aciertos para entrar en fiebre y sumar el doble.',
    missions: [{ t: 'llegá al nivel 5', ok: s => s.level >= 5 }, { t: 'hacé un combo de 15', ok: s => s.maxCombo >= 15 }, { t: 'atrapá 2 poderes', ok: s => s.powers >= 2 }],
  },
  torre: {
    name: 'defensa de torre',
    desc: 'Los enemigos avanzan por el camino hacia tu base. Hay exploradores rápidos, tanques con escudo (dos palabras) y un jefe cada 5 oleadas. Entre oleadas elegís una mejora, como una torreta que dispara sola.',
    missions: [{ t: 'superá 5 oleadas', ok: s => s.cleared >= 5 }, { t: 'vencé a un jefe', ok: s => s.bosses >= 1 }, { t: 'terminá una oleada sin daño', ok: s => s.perfect >= 1 }],
  },
  runner: {
    name: 'runner',
    desc: 'Una ola te persigue y tu tipeo es el motor: cada letra correcta del texto de abajo es un paso. Cuando un obstáculo se acerca, escribí la palabra de un carril libre para cambiarte. Tipear parejo sube el ritmo, y cada 500 m elegís un tramo difícil (x2) o uno seguro.',
    missions: [{ t: 'corré 500 metros', ok: s => s.dist >= 500 }, { t: 'juntá 5 monedas', ok: s => s.coins >= 5 }, { t: 'esquivá 20 obstáculos', ok: s => s.jumps >= 20 }],
  },
  bombas: {
    name: 'bombas',
    desc: 'Aparecen bombas con la mecha encendida. Si una explota perdés una vida y las de alrededor se aceleran. Desactivá varias seguidas para hacer cadena. Las doradas desactivan a sus vecinas, y las mega explotan fuerte.',
    missions: [{ t: 'desactivá 25 bombas', ok: s => s.kills >= 25 }, { t: 'hacé una cadena de 4', ok: s => s.maxChain >= 4 }, { t: 'desactivá una bomba dorada', ok: s => s.golden >= 1 }],
  },
};
export const POWERS: any = {
  hielo: { g: '❄', name: '¡hielo!', desc: 'congela todo 3 s' },
  boom: { g: '✸', name: '¡bum!', desc: 'limpia la pantalla' },
  vida: { g: '♥', name: '+1 vida', desc: 'recuperás una vida' },
  lento: { g: '◷', name: 'cámara lenta', desc: 'todo va a la mitad 5 s' },
};
export const UPGRADES = [
  { id: 'turret', name: 'torreta', desc: 'dispara sola al enemigo más avanzado cada pocos segundos' },
  { id: 'frost', name: 'escarcha', desc: 'los enemigos avanzan 15% más lento' },
  { id: 'wall', name: 'muralla', desc: '+3 vidas para tu base' },
  { id: 'shock', name: 'onda', desc: 'al destruir un enemigo, los cercanos retroceden' },
  { id: 'loot', name: 'botín', desc: '+25% de puntos por palabra' },
];

export const ADIFF: any = {
  facil: { name: 'fácil', speed: .8, spawn: 1.25, lives: 2, pts: .75, paths: 1, count: 1, fuse: 1.25 },
  medio: { name: 'medio', speed: 1, spawn: 1, lives: 0, pts: 1, paths: 2, count: 1.25, fuse: 1 },
  dificil: { name: 'difícil', speed: 1.22, spawn: .82, lives: -1, pts: 1.5, paths: 3, count: 1.5, fuse: .8 },
};
export const DIFF_DESC: any = {
  torre: { facil: '1 camino · palabras cortas', medio: '2 caminos · palabras comunes', dificil: '3 caminos · palabras largas y difíciles' },
  caen: { facil: 'más lento · +2 vidas · palabras cortas', medio: 'velocidad normal · palabras comunes', dificil: 'más rápido · 1 vida menos · palabras largas' },
  runner: { facil: 'ola lenta · +2 vidas · palabras cortas', medio: 'ola normal · palabras comunes', dificil: 'ola rápida · 2 vidas · palabras largas' },
  bombas: { facil: 'mechas largas · +2 vidas · palabras cortas', medio: 'mechas normales · palabras comunes', dificil: 'mechas cortas · 1 vida menos · palabras largas' },
};
// caminos del tower defense, en coordenadas relativas; todos terminan en la base
export const TD_PATHS: any = {
  // cada camino vive en su propia franja horizontal y solo se juntan cerca de la base
  solo: [[-.02, .16], [.6, .16], [.6, .44], [.2, .44], [.2, .82], [.74, .82], [.74, .5], [.91, .5]],
  top: [[-.02, .15], [.24, .15], [.24, .27], [.5, .27], [.5, .15], [.74, .15], [.74, .5], [.91, .5]],
  mid: [[-.02, .5], [.2, .5], [.2, .43], [.44, .43], [.44, .57], [.66, .57], [.66, .5], [.91, .5]],
  bot: [[-.02, .87], [.24, .87], [.24, .75], [.5, .75], [.5, .87], [.74, .87], [.74, .5], [.91, .5]],
};

export class Arcade {
  [key: string]: any;
  constructor(stage) {
    this.stage = stage; this.cv = $('canvas', stage); this.ctx = this.cv.getContext('2d'); this.ov = $('.ov', stage);
    this.kind = 'caen'; this.running = false; this.ents = []; this.fx = []; this.floats = []; this.lasers = [];
    stage.addEventListener('mousedown', e => { if (e.target === this.cv) { e.preventDefault(); focusKb(); } });
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(stage);
  }
  colors() { const cs = getComputedStyle(document.documentElement), g = n => cs.getPropertyValue(n).trim(); this.c = { ink: g('--ink'), sub: g('--sub'), dim: g('--dim'), acc: g('--accent'), acc2: g('--accent-2'), soft: g('--soft'), err: g('--err'), ok: g('--ok'), gold: g('--warn'), bg: g('--surface'), pat: g('--pat') }; }
  resize() {
    const w = this.stage.clientWidth; if (!w) return;
    const hh = Math.max(220, this.stage.clientHeight || Math.round(w * 0.55)), dpr = window.devicePixelRatio || 1;
    this.W = w; this.H = hh; this.cv.width = w * dpr; this.cv.height = hh * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); this.sc = clamp(Math.min(w / 900, hh / 440), .55, 1.2);
    this.buildPath(); this.colors(); if (!this.running) this.drawBg(); else this.draw();
  }
  diffKey() { return this.mp ? this.mp.diff : store.get('arcDiff:' + this.kind, 'medio'); }
  get D() { return ADIFF[this.diffKey()] || ADIFF.medio; }
  bestKey(k = this.diffKey()) { return 'arc:' + this.kind + (this.kind === 'runner' ? '-p' : '') + (k === 'medio' ? '' : ':' + k); }
  buildPath() {
    if (!this.W) return;
    const n = this.D.paths, defs = n === 1 ? [TD_PATHS.solo] : n === 2 ? [TD_PATHS.top, TD_PATHS.bot] : [TD_PATHS.top, TD_PATHS.mid, TD_PATHS.bot];
    this.paths = defs.map(def => {
      const P = def.map(([x, y]) => [x * this.W, y * this.H]), segs = []; let len = 0;
      for (let i = 1; i < P.length; i++) { const [x1, y1] = P[i - 1], [x2, y2] = P[i], l = Math.hypot(x2 - x1, y2 - y1); segs.push({ x1, y1, x2, y2, l, s: len }); len += l; }
      return { segs, len, start: P[0] };
    });
    const end = TD_PATHS.solo[TD_PATHS.solo.length - 1]; this.base = [end[0] * this.W, end[1] * this.H];
  }
  at(d, p = 0) { const path = this.paths[p] || this.paths[0]; for (const s of path.segs) if (d <= s.s + s.l) { const k = (d - s.s) / s.l; return [s.x1 + (s.x2 - s.x1) * k, s.y1 + (s.y2 - s.y1) * k]; } return this.base; }
  prog(e) { return e.d / (this.paths[e.p || 0] || this.paths[0]).len; }
  setDiff(k) { this.abandon(); store.set('arcDiff:' + this.kind, k); this.buildPath(); this.hudReset(); this.drawBg(); this.intro(); }
  diffBar() {
    const cur = this.diffKey(), bar = $('#arc-diff'); if (!bar) return;
    bar.replaceChildren(h('span', { class: 'lbl', style: 'margin-right:4px', text: 'dificultad' }), ...Object.entries(ADIFF).map(([k, d], i) => h('button', { class: 'opt' + (k === cur ? ' on' : ''), type: 'button', title: 'tecla ' + (i + 1), text: d.name, onclick: () => this.setDiff(k) })));
    $('#arc-diff-desc').textContent = `${DIFF_DESC[this.kind][cur]} · puntos ×${String(this.D.pts).replace('.', ',')} · récord ${store.get(this.bestKey(), 0)}`;
  }
  diffLine() { return h('p', { class: 'hint', text: `dificultad ${this.D.name}: ${DIFF_DESC[this.kind][this.diffKey()]} · cambiala arriba o con 1, 2 y 3` }); }
  recordRun(fin) {
    if (this.saved || !this.t) return; this.saved = true;
    if (!fin && this.score <= 0) return;
    if (this.score > store.get(this.bestKey(), 0)) store.set(this.bestKey(), this.score);
    const where = this.kind === 'torre' ? `oleada ${this.wave}` : this.kind === 'runner' ? `${Math.round(this.dist)} m · ${this.coins} monedas` : `nivel ${this.level}`;
    History.record({ t: 'arcade', game: this.kind, diff: this.diffKey(), score: this.score, fin: !!fin, pts: this.score,
      wpm: Math.round(this.t > 1000 ? this.chars / 5 / (this.t / 60000) : 0), acc: this.keys ? Math.round(this.hits / this.keys * 100) : 100,
      detail: `${where} · ${this.kills} palabras · combo ${this.maxCombo}` });
    if (!fin) toast(`partida guardada: ${this.score} puntos`);
  }
  abandon() { if (this.running) this.recordRun(false); this.stop(); }
  diffRow() {
    const cur = this.diffKey();
    return h('div', { class: 'diffs' }, ...Object.entries(ADIFF).map(([k, d], i) => h('button', { class: 'btn diff' + (k === cur ? ' on' : ''), type: 'button', onclick: () => this.setDiff(k) },
      h('b', { text: `${i + 1} · ${d.name}` }), h('span', { text: DIFF_DESC[this.kind][k] }), h('small', { text: 'récord ' + store.get(this.bestKey(k), 0) }))));
  }
  misKey() { return 'mis:' + this.kind + (this.kind === 'runner' ? '-p' : ''); } // el runner nuevo tiene misiones nuevas
  missionsDone() { return store.get(this.misKey(), [false, false, false]); }
  missionsEl(fresh) {
    const done = this.missionsDone();
    return h('ul', { class: 'mis' }, ...ARC[this.kind].missions.map((m, i) => h('li', { class: (done[i] ? 'done' : '') + (fresh && fresh[i] ? ' new' : '') }, h('span', { class: 'star', text: done[i] ? '★' : '☆' }), m.t, fresh && fresh[i] ? h('b', { text: ' · ¡nueva!' }) : '')));
  }
  setKind(k) { this.abandon(); this.kind = k; this.colors(); this.drawBg(); this.hudReset(); this.intro(); }
  intro() {
    const m = ARC[this.kind];
    this.showOv(h('div', { class: 'inner' }, h('span', { class: 'eyebrow', text: '* — arcade' }), h('h2', { text: m.name }), h('p', { class: 'sub', text: m.desc }),
      this.kind === 'runner'
        ? h('div', { class: 'chips', style: 'justify-content:center' }, ...Object.values(RUNNER_OBS).map(o => h('span', { class: 'chip' }, h('b', { style: 'color:var(--accent)', text: o.name + ' ' }), o.desc)))
        : h('div', { class: 'chips', style: 'justify-content:center' }, ...Object.values(POWERS).map(p => h('span', { class: 'chip' }, h('b', { style: 'color:var(--accent)', text: p.g + ' ' }), p.desc))),
      h('div', {}, h('span', { class: 'lbl', style: 'margin-bottom:6px', text: 'misiones' }), this.missionsEl()),
      this.diffLine(),
      h('div', { class: 'row', style: 'justify-content:center' }, h('button', { class: 'btn primary', text: 'empezar', onclick: () => this.start() }), h('button', { class: 'btn', text: this.kind === 'torre' ? 'jugar en equipo online' : 'jugar online con amigos', onclick: () => nav.go(`/sala/${Math.random().toString(36).slice(2, 7)}?juego=${this.kind}`) }), h('span', { class: 'hint' }, h('kbd', { text: 'enter' }), ' empezar · ', h('kbd', { text: '1' }), ' ', h('kbd', { text: '2' }), ' ', h('kbd', { text: '3' }), ' dificultad · ', h('kbd', { text: 'tab' }), ' reiniciar · ', h('kbd', { text: 'esc' }), ' pausa · ', h('kbd', { text: '⌫' }), ' soltar objetivo'))));
    setConsumer(this);
  }
  showOv(content) { this.ov.replaceChildren(content); this.ov.hidden = false; }
  hudReset() { this.diffBar(); $('#arc-best').textContent = store.get(this.bestKey(), 0); $('#arc-lvl-l').textContent = this.kind === 'torre' ? 'oleada' : this.kind === 'runner' ? 'metros' : 'nivel'; $('#arc-combo').textContent = 'x0'; }
  start() {
    if (this.running) this.recordRun(false);
    this.stop(); this.colors(); Sfx.init();
    Object.assign(this, {
      ents: [], fx: [], floats: [], lasers: [], score: 0, level: 1, kills: 0, keys: 0, hits: 0, chars: 0, combo: 0, maxCombo: 0, target: null, t: 0, spawnT: 600, mult: 1,
      paused: false, userPaused: false, choices: null, flash: 0, shake: 0, dist: 0, jump: 0, fever: false, freezeT: 0, slowT: 0, powers: 0, cleared: 0, bosses: 0, perfect: 0,
      saved: false, coins: 0, coinT: 3500, jumps: 0, chain: 0, maxChain: 0, lastKill: -9999, golden: 0, turret: 0, turretT: 0, milestone: 100, runMis: [false, false, false],
    });
    this.rand = this.mp ? rng((this.mp.seed ^ this.kind.length * 7919) >>> 0) : Math.random;
    this.nextId = 1; this.lastSnap = 0; this.lastStatus = 0; this.atk = 0; this.killed = new Map();
    this.maxLives = this.lives = Math.max(2, { caen: 5, torre: 10, runner: 3, bombas: 5 }[this.kind] + this.D.lives);
    if (this.kind === 'runner') runnerStart(this);
    this.buildPath();
    if (this.kind === 'torre') { this.wave = 0; this.frost = 1; this.shock = 0; this.nextWave(); }
    this.ov.hidden = true; this.running = true; this.last = now(); setConsumer(this);
    this.raf = requestAnimationFrame(t => this.frame(t));
  }
  /* ---------- multijugador ----------
     mp = { seed, diff, role: 'host'|'guest'|'battle', me, roster:[{id,name,color}], coop,
            onStatus, onDead, onAttack, onHit, onSnapshot, onEnd } */
  startMp(mp) {
    this.mp = mp; this.mirror = mp.role === 'guest' && this.kind === 'torre';
    this.activeIds = (mp.roster || []).map(r => r.id);
    this.start();
    const mine = (mp.roster || []).find(r => r.id === mp.me);
    if (mp.coop && mine && (mp.roster || []).length >= 2) this.float(this.W / 2, this.H * .36, 'escribí las palabras de tu color', mine.color, 17);
  }
  /* torre cooperativa: cada bicho es de un jugador (su color) y solo ese jugador puede escribirlo */
  coopPlayers() {
    if (!this.mp?.coop) return [];
    const ids = new Set(this.activeIds || []);
    return (this.mp.roster || []).filter(r => ids.has(r.id));
  }
  assignOwner(e) {
    const ps = this.coopPlayers();
    if (ps.length < 2) { e.owner = null; e.color = null; return e; }
    // al que menos palabras tiene en pantalla (empate: al azar con la semilla)
    const load = id => this.ents.filter(o => o.owner === id && !o.done).length;
    const pl = shuffle(ps, this.rand).sort((a, b) => load(a.id) - load(b.id))[0];
    e.owner = pl.id; e.color = pl.color; return e;
  }
  /* el anfitrión avisa quién sigue en la sala: las palabras de quien se fue pasan a otro */
  setActivePlayers(ids) {
    if (!this.mp?.coop || this.mirror) return;
    const prev = (this.activeIds || []).join(','); this.activeIds = ids.slice();
    if (prev === this.activeIds.join(',')) return;
    const alive = new Set(ids), ps = this.coopPlayers();
    for (const e of this.ents) {
      if (ps.length < 2 && !e.link) { e.owner = null; e.color = null; continue; }
      if (e.owner && !alive.has(e.owner)) {
        if (e.link && ps.length < 2) { const pl = ps[0]; e.owner = pl ? pl.id : null; e.color = pl ? pl.color : null; }
        else this.assignOwner(e);
      }
    }
  }
  receiveGarbage(n) {
    if (!this.running || this.kind !== 'caen') return;
    const sc = this.sc, list = VOCAB.dificil;
    for (let i = 0; i < n; i++) {
      const w = list[Math.floor(Math.random() * list.length)], x = 40 + Math.random() * (this.W - 80 - w.length * 11 * sc);
      this.ents.push({ word: w, typed: 0, x, x0: x, y: -10 - i * 34, v: (34 + this.level * 6) * sc * this.D.speed, type: 'rapida', garbage: true, ph: 0 });
    }
    this.float(this.W / 2, this.H * .2, n > 1 ? `¡te mandaron ${n} palabras!` : '¡te mandaron basura!', this.c.err, 18); Sfx.miss();
  }
  winMp() { if (!this.running) return; this.recordRun(true); this.running = false; cancelAnimationFrame(this.raf); this.emitFever(false); Sfx.mission();
    this.showOv(h('div', { class: 'inner' }, h('span', { class: 'eyebrow', text: '* sala online' }), h('h2', { text: '¡ganaste!' }), h('p', { class: 'sub', text: `${this.score} puntos · último en pie` }))); }
  endRemote(sum) { this.running = false; cancelAnimationFrame(this.raf); this.emitFever(false); this.draw();
    this.showOv(h('div', { class: 'inner' }, h('span', { class: 'eyebrow', text: '* sala online' }), h('h2', { text: sum && sum.coop ? 'la base cayó' : 'fin de la ronda' }), h('p', { class: 'sub', text: sum && sum.coop ? `${sum.score} puntos en equipo · oleada ${sum.wave}` : '' }))); }
  snapshot() {
    return { lives: this.lives, wave: this.wave, score: this.score, banner: Math.round(this.banner || 0), boss: this.boss, frost: this.frost, choosing: !!this.choices, turret: this.turret,
      ents: this.ents.map(e => ({ id: e.id, w: e.word, d: Math.round(e.d * 10) / 10, p: e.p, v: e.v, type: e.type, boss: !!e.boss, link: e.link || 0, part: e.part || 0, owner: e.owner || null, color: e.color || null, done: !!e.done, stage: e.stage || 0, pw: e.pw || null })) };
  }
  applySnapshot(sn) {
    this.lives = sn.lives; this.wave = sn.wave; this.score = sn.score; this.banner = sn.banner; this.boss = sn.boss; this.frost = sn.frost; this.turret = sn.turret;
    const byId = new Map(this.ents.map(e => [e.id, e])), t = now(), next = [];
    for (const se of sn.ents) {
      const k = this.killed.get(se.id); if (k && t - k < 1500 && !se.link) continue;
      let e = byId.get(se.id); if (!e) e = { id: se.id, typed: 0 };
      if (e.word !== se.w) { e.typed = 0; if (this.target === e) this.target = null; }
      Object.assign(e, { word: se.w, d: se.d, p: se.p, v: se.v, type: se.type, boss: se.boss, link: se.link, part: se.part, owner: se.owner, color: se.color, done: se.done || (k && t - k < 1500 && se.link ? true : se.done), stage: se.stage, pw: se.pw });
      next.push(e);
    }
    this.ents = next; if (this.target && !next.includes(this.target)) this.target = null;
    if (sn.choosing && !this.waitOv) { this.waitOv = true; this.showOv(h('div', { class: 'inner' }, h('h2', { text: 'oleada superada' }), h('p', { class: 'sub', text: 'el anfitrión está eligiendo una mejora…' }))); }
    else if (!sn.choosing && this.waitOv) { this.waitOv = false; this.ov.hidden = true; }
  }
  /* runner online: posición de los rivales ([{ name, color, dist, alive }]) */
  setRivals(list) { const prev = new Map((this.rivals || []).map(r => [r.name + r.color, r.shown])); this.rivals = list.map(r => ({ ...r, shown: prev.get(r.name + r.color) })); }
  remoteHit(id) { const e = this.ents.find(o => o.id === id); if (e && !e.done && this.running) this.kill(e, true); }
  stop() { this.running = false; cancelAnimationFrame(this.raf); this.emitFever(false); }
  emitFever(on) { if (this._fever === on) return; this._fever = on; window.dispatchEvent(new CustomEvent('tecla:fever', { detail: on })); }
  destroy() { this.stop(); this.ro?.disconnect(); }
  enter() { if (this.mp) return; if (!this.running) this.start(); else if (this.userPaused) this.resume(); }
  tab() { if (this.mp) return; this.start(); }
  esc() { if (this.mp) return; if (this.running && !this.choices && !this.userPaused) { this.userPaused = this.paused = true; this.showOv(h('div', { class: 'inner' }, h('h2', { text: 'pausa' }), h('div', { class: 'row', style: 'justify-content:center' }, h('button', { class: 'btn primary', text: 'seguir', onclick: () => this.resume() }), h('span', { class: 'hint' }, h('kbd', { text: 'enter' }))))); } }
  resume() { this.userPaused = this.paused = false; this.ov.hidden = true; this.last = now(); focusKb(); }
  frame(t) {
    if (!this.running) return;
    const dt = Math.min(50, t - this.last); this.last = t;
    if (!this.paused) { this.t += dt; this.update(dt); }
    this.draw(); this.hud();
    if (this.mp) {
      if (this.mp.role === 'host' && this.kind === 'torre' && t - this.lastSnap > 250) { this.lastSnap = t; this.mp.onSnapshot?.(this.snapshot()); }
      if (t - this.lastStatus > 1000) { this.lastStatus = t; this.mp.onStatus?.({ lives: this.lives, score: this.score, level: this.kind === 'torre' ? this.wave : this.kind === 'runner' ? Math.round(this.dist) : this.level, alive: this.running }); }
    }
    if (this.running) this.raf = requestAnimationFrame(x => this.frame(x));
  }
  pickWord(minL, maxL) {
    const tier = this.diffKey(), list = VOCAB[tier] || VOCAB.medio;
    if (tier === 'dificil') { minL += 5; maxL += 6; } else if (tier === 'facil') { maxL = Math.min(maxL, 6); minL = Math.min(minL, maxL); }
    const used = new Set(this.ents.map(e => e.word[0])), bag = (this.bags = this.bags || {})[tier] || (this.bags[tier] = { b: [], recent: [] });
    const fits = w => w.length >= minL && w.length <= maxL, fresh = w => !bag.recent.includes(w);
    for (const pred of [w => fits(w) && fresh(w) && !used.has(w[0]), w => fits(w) && fresh(w), w => w.length <= maxL + 4 && fresh(w), fresh]) {
      for (let pass = 0; pass < 2; pass++) {
        if (!bag.b.length || pass) bag.b = shuffle(list, this.rand || Math.random);
        const i = bag.b.findIndex(pred);
        if (i >= 0) { const w = bag.b.splice(i, 1)[0]; bag.recent.push(w); if (bag.recent.length > 60) bag.recent.shift(); return w; }
      }
    }
    return list[Math.floor((this.rand || Math.random)() * list.length)];
  }
  maybePower(e) {
    const R = this.rand || Math.random;
    if (this.t > 5000 && R() < 0.075) { const ks = Object.keys(POWERS).filter(k => k !== 'vida' || this.lives < this.maxLives); e.pw = ks[Math.floor(R() * ks.length)]; }
    return e;
  }
  danger(e) { return { caen: e.y, torre: this.prog(e), runner: e.coin ? -1e5 : -e.x, bombas: -e.fuse }[this.kind]; }
  char(c) {
    if (!this.running) { if (this.mp) return; const i = '123'.indexOf(c); if (i >= 0) this.setDiff(Object.keys(ADIFF)[i]); return; }
    if (this.paused) { if (this.choices) { const i = '123'.indexOf(c); if (i >= 0 && this.choices[i]) this.choose(this.choices[i]); } return; }
    if (this.kind === 'runner') return runnerChar(this, c);
    if (this.target && !this.ents.includes(this.target)) this.target = null;
    if (!this.target) {
      if (c === ' ') return;
      const me = this.mp?.me, tnow = now();
      const cands = this.ents.filter(e => e.word[0] === c && !e.done && !(e.lock > tnow) && (!e.owner || e.owner === me) && !(this.kind === 'torre' && e.d < 0));
      this.keys++;
      if (!cands.length) return this.miss();
      cands.sort((a, b) => this.danger(b) - this.danger(a)); this.target = cands[0]; this.target.typed = 0;
    } else this.keys++;
    const e = this.target;
    if (e.word[e.typed] === c) { e.typed++; this.hits++; this.chars++; Sfx.key(); if (e.typed >= e.word.length) this.kill(e); }
    else this.miss();
  }
  back() { if (this.kind === 'runner') return runnerBack(this); if (this.target) { this.target.typed = 0; this.target = null; } }
  miss() {
    this.combo = 0; this.flash = 160; Sfx.miss();
    if (this.fever) { this.fever = false; this.float(this.W / 2, this.H * .3, 'fiebre perdida', this.c.sub, 16); }
  }
  float(x, y, text, col, size = 15) { this.floats.push({ x, y, text, col: col || this.c.acc, size, life: 1 }); }
  burst(x, y, n = 9, col) { const ch = ['*', '—', '|', '/', '*']; for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = 50 + Math.random() * 150; this.fx.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, life: 1, ch: ch[i % ch.length], col: col || (this.fever ? this.c.acc2 : this.c.acc) }); } }
  pos(e) { if (this.kind === 'torre') return this.at(Math.max(0, e.d), e.p); return [e.x, e.y]; }
  remove(e) { this.ents = this.ents.filter(x => x !== e); if (this.target === e) this.target = null; }
  kill(e, remote = false) {
    const [x, y] = this.pos(e);
    if (this.mirror && !remote) {
      // invitado de la torre: el anfitrión decide; acá solo mostramos el golpe al instante
      this.mp.onHit?.(e.id); this.combo++; this.kills++; Sfx.kill(this.combo); this.burst(x, y, 8, e.color || undefined);
      if (this.target === e) this.target = null; e.typed = 0;
      if (e.link) { e.done = true; this.killed.set(e.id, now()); }
      else if (e.words || e.type === 'tank') { e.lock = now() + 500; }
      else { this.killed.set(e.id, now()); this.remove(e); }
      return;
    }
    if (e.link) {
      e.done = true; e.typed = e.word.length; if (this.target === e) this.target = null;
      const mates = this.ents.filter(o => o.link === e.link);
      if (!mates.every(o => o.done)) { this.burst(x, y, 6, e.color || undefined); this.float(x, y - 44 * this.sc, 'falta tu compañero', e.color || this.c.acc2, 13); Sfx.key(); return; }
      mates.forEach(o => { if (o !== e) this.remove(o); });
      this.float(x, y - 60 * this.sc, '¡en equipo!', this.c.acc, 16);
    }
    if (e.words && e.stage < e.words.length - 1) {
      e.stage++; e.word = e.words[e.stage]; e.typed = 0; this.combo++;
      this.burst(x, y, 6, this.c.acc2); Sfx.kill(this.combo); this.float(x, y - 30 * this.sc, 'escudo roto', this.c.acc2, 13); return;
    }
    this.remove(e);
    this.combo++; this.kills++; this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.chain = this.t - this.lastKill < 1300 ? this.chain + 1 : 1; this.lastKill = this.t; this.maxChain = Math.max(this.maxChain, this.chain);
    if (this.mp && this.kind === 'caen' && !e.garbage) { this.atk++; if (this.atk % 4 === 0) this.mp.onAttack?.(this.fever ? 2 : 1); }
    let pts = e.word.length * 10 * (1 + Math.min(this.combo, 30) * 0.05) * this.mult * (e.boss ? 4 : 1) * (e.link ? 2.5 : 1) * (this.fever ? 2 : 1) * (e.type === 'rapida' ? 1.5 : 1) * (e.coin ? 3 : 1) * (e.type === 'mega' ? 2 : 1);
    if (this.kind === 'bombas' && this.chain >= 2) { pts *= 1 + this.chain * 0.25; this.float(x, y - 44 * this.sc, `cadena x${this.chain}`, this.c.acc2, 14); }
    pts = Math.round(pts * this.D.pts); this.score += pts;
    this.float(x, y - 22 * this.sc, '+' + pts, e.coin ? this.c.gold : this.c.acc, this.fever ? 17 : 15);
    Sfx.kill(this.combo);
    this.burst(x, y, e.boss ? 26 : 10, e.coin || e.type === 'gold' ? this.c.gold : undefined);
    if (!this.fever && this.combo >= 10) { this.fever = true; Sfx.fever(); this.float(this.W / 2, this.H * .35, '¡fiebre! puntos x2', this.c.acc, 24); this.shake = 120; }
    if (this.kind === 'torre') {
      if (e.boss) { this.bosses++; this.shake = 300; this.float(this.W / 2, this.H * .4, '¡jefe derrotado!', this.c.acc, 24); }
      if (this.shock) this.ents.forEach(o => { const [ox, oy] = this.at(Math.max(0, o.d), o.p); if (Math.hypot(ox - x, oy - y) < 90 + this.shock * 30) o.d = Math.max(-20, o.d - 50 * this.sc); });
    }
    if (this.kind === 'caen' && e.type === 'split') [-1, 1].forEach(s => this.ents.push({ word: this.pickWord(3, 4), typed: 0, x: clamp(e.x + s * 45 * this.sc, 20, this.W - 80), x0: e.x, y: e.y, v: e.v * 0.9, type: 'n', ph: 0 }));
    if (this.kind === 'bombas' && e.type === 'gold') {
      this.golden++; this.float(x, y - 60 * this.sc, '¡dorada!', this.c.gold, 18);
      this.ents.filter(o => Math.hypot(o.x - x, o.y - y) < 190 * this.sc).forEach(o => { if (this.ents.includes(o)) { o.type = o.type === 'gold' ? 'n' : o.type; this.kill(o); } });
    }
    if (e.pw) this.power(e.pw, x, y);
    if (this.kind !== 'torre') this.level = 1 + Math.floor(this.kills / (this.kind === 'bombas' ? 8 : 10));
  }
  power(p, x, y) {
    this.powers++; Sfx.power(); this.float(x, y - 60 * this.sc, POWERS[p].name, this.c.acc, 20);
    if (p === 'hielo') this.freezeT = 3000;
    else if (p === 'lento') this.slowT = 5000;
    else if (p === 'vida') this.lives = Math.min(this.lives + 1, this.maxLives + 3);
    else if (p === 'boom') {
      this.shake = 350; Sfx.noise(0.4, 0.12);
      this.ents.filter(o => !o.boss && !o.coin).forEach(o => { const [ox, oy] = this.pos(o); this.remove(o); this.score += o.word.length * 5; this.kills++; this.burst(ox, oy, 8); });
    }
  }
  hurt(n = 1, x, y) {
    this.lives -= n; this.combo = 0; this.chain = 0; this.flash = 260; this.shake = 280; this.waveHurt = true; Sfx.hurt();
    if (this.fever) this.fever = false;
    if (x != null) this.burst(x, y, 14, this.c.err);
    if (this.lives <= 0) { this.lives = 0; this.over(); }
  }
  nextWave() { this.wave++; this.toSpawn = Math.round((4 + this.wave * 2) * this.D.count); this.boss = this.wave % 5 === 0; this.spawnT = 1500; this.banner = 1600; this.waveHurt = false; }
  choose(u) {
    if (u.id === 'frost') this.frost *= 0.85; else if (u.id === 'wall') { this.lives += 3; this.maxLives += 3; } else if (u.id === 'shock') this.shock++; else if (u.id === 'turret') { this.turret++; this.turretT = 1500; } else this.mult *= 1.25;
    this.choices = null; this.paused = false; this.ov.hidden = true; this.last = now(); this.nextWave(); focusKb();
  }
  waveDone() {
    let bonus = this.wave * 40; this.cleared++;
    if (!this.waveHurt) { this.perfect++; bonus *= 2; this.float(this.W / 2, this.H * .45, `oleada perfecta +${bonus}`, this.c.acc, 20); }
    else this.float(this.W / 2, this.H * .45, `oleada superada +${bonus}`, this.c.acc, 18);
    this.score += bonus; Sfx.power();
    setTimeout(() => { if (this.running && this.kind === 'torre') this.offerUpgrades(); }, 700);
    this.betweenWaves = true;
  }
  offerUpgrades() {
    this.betweenWaves = false; this.paused = true; this.choices = shuffle(UPGRADES).slice(0, 3);
    this.showOv(h('div', { class: 'inner' }, h('span', { class: 'eyebrow', text: `* oleada ${this.wave} superada` }), h('h2', { text: 'elegí una mejora' }),
      h('div', { class: 'ups' }, ...this.choices.map((u, i) => h('button', { class: 'btn up', onclick: () => this.choose(u) }, h('b', { text: `${i + 1} · ${u.name}` + (u.id === 'turret' && this.turret ? ` (nivel ${this.turret + 1})` : '') }), h('span', { text: u.desc })))),
      h('p', { class: 'hint', text: 'tocá 1, 2 o 3' })));
  }
  update(dt) {
    const W = this.W, H = this.H, sc = this.sc, L = this.level;
    this.freezeT = Math.max(0, this.freezeT - dt); this.slowT = Math.max(0, this.slowT - dt);
    const mv = this.freezeT > 0 ? 0 : this.slowT > 0 ? 0.45 : 1, wdt = dt * mv, s = wdt / 1000;
    this.flash = Math.max(0, this.flash - dt); this.shake = Math.max(0, this.shake - dt); this.spawnT -= wdt;
    if (this.kind === 'caen') {
      if (this.spawnT <= 0) {
        this.spawnT = Math.max(620, 2100 - L * 130) * this.D.spawn;
        const r = this.rand(); let type = 'n';
        if (L >= 2 && r < 0.13) type = 'rapida'; else if (L >= 2 && r < 0.24) type = 'zig'; else if (L >= 3 && r < 0.34) type = 'split';
        const w = type === 'rapida' ? this.pickWord(3, 5) : this.pickWord(3 + Math.min(4, Math.floor(L / 3)), 5 + Math.min(6, Math.floor(L / 2)));
        const x = 40 + this.rand() * (W - 80 - w.length * 11 * sc);
        this.ents.push(this.maybePower({ word: w, typed: 0, x, x0: x, y: -10, v: (22 + L * 5 + this.rand() * 10) * sc * this.D.speed * (type === 'rapida' ? 1.8 : 1), type, ph: this.rand() * 6 }));
      }
      for (const e of this.ents.slice()) {
        e.y += e.v * s;
        if (e.type === 'zig') e.x = clamp(e.x0 + Math.sin(e.y / 38 + e.ph) * 55 * sc, 20, W - 90);
        if (e.y > H - 26) { this.remove(e); this.hurt(1, e.x + 20, H - 26); if (!this.running) return; }
      }
    } else if (this.kind === 'torre' && this.mirror) {
      this.banner = Math.max(0, (this.banner || 0) - dt);
      for (const e of this.ents) e.d += e.v * (this.frost || 1) * s;
    } else if (this.kind === 'torre') {
      this.banner = Math.max(0, (this.banner || 0) - dt);
      if (this.toSpawn > 0 && this.spawnT <= 0) {
        this.spawnT = Math.max(650, 1700 - this.wave * 70) * this.D.spawn; this.toSpawn--;
        const np = this.paths.length, p = np === 1 ? 0 : (this.lastP = ((this.lastP || 0) + 1 + (this.rand() < .35 ? 1 : 0)) % np);
        const r = this.rand(); let e;
        if (this.wave >= 3 && r < 0.2) { const ws = [this.pickWord(3, 5), this.pickWord(4, 6)]; e = { words: ws, stage: 0, word: ws[0], typed: 0, d: 0, v: (22 + this.wave * 2) * sc, type: 'tank' }; }
        else if (this.wave >= 2 && r < 0.45) e = { word: this.pickWord(3, 4), typed: 0, d: 0, v: (54 + this.wave * 4) * sc, type: 'scout' };
        else e = { word: this.pickWord(3, Math.min(9, 4 + Math.floor(this.wave / 2))), typed: 0, d: 0, v: (30 + this.wave * 3 + this.rand() * 8) * sc, type: 'n' };
        e.p = p; e.v *= this.D.speed; e.id = this.nextId++;
        const roster = this.coopPlayers();
        if (roster.length >= 2 && this.wave >= 2 && this.rand() < 0.3 && !e.words) {
          // bicho doble: una palabra para cada uno de dos jugadores, con su color
          const pair = shuffle(roster, this.rand).slice(0, 2), link = this.nextId++;
          pair.forEach((pl, i) => this.ents.push({ word: this.pickWord(3, 6), typed: 0, d: 0, v: e.v * 0.8, p, type: 'duo', owner: pl.id, color: pl.color, link, part: i, id: this.nextId++ }));
        } else this.ents.push(this.assignOwner(this.maybePower(e)));
        if (this.toSpawn === 0 && this.boss) { const ph = SENTENCES[Math.floor(this.rand() * SENTENCES.length)].toLowerCase().replace(/[.,]/g, '').split(' ').slice(0, 3 + Math.min(3, Math.floor(this.wave / 5))).join(' '); this.ents.push(this.assignOwner({ id: this.nextId++, word: ph, typed: 0, d: -80 * sc, v: 17 * sc * this.D.speed, boss: true, type: 'boss', p: Math.floor(this.rand() * this.paths.length) })); }
      }
      if (this.turret) {
        this.turretT -= wdt;
        if (this.turretT <= 0) {
          this.turretT = Math.max(2200, 8000 - this.turret * 1800);
          const tg = this.ents.filter(o => !o.boss && !o.link && o.d >= 0).sort((a, b) => this.prog(b) - this.prog(a))[0];
          if (tg) { const [tx, ty] = this.at(tg.d, tg.p); this.lasers.push({ x1: this.base[0], y1: this.base[1], x2: tx, y2: ty, life: 1 }); tg.words = null; this.kill(tg); }
        }
      }
      const hitLinks = new Set();
      for (const e of this.ents.slice()) { e.d += e.v * this.frost * s; if (e.d >= this.paths[e.p || 0].len) { this.remove(e); if (e.link) { if (hitLinks.has(e.link)) continue; hitLinks.add(e.link); this.ents.filter(o => o.link === e.link).forEach(o => this.remove(o)); } this.hurt(e.boss ? 3 : e.link ? 2 : 1, this.base[0], this.base[1]); if (!this.running) return; } }
      if (this.toSpawn === 0 && !this.ents.length && !this.paused && !this.betweenWaves) this.waveDone();
    } else if (this.kind === 'runner') {
      if (runnerUpdate(this, dt, wdt) === false) return;
    } else if (this.kind === 'bombas') {
      const maxB = 2 + Math.floor(L / 2);
      if (this.spawnT <= 0 && this.ents.length < maxB) {
        this.spawnT = Math.max(700, 1700 - L * 90) * this.D.spawn;
        for (let tries = 0; tries < 25; tries++) {
          const x = 60 + this.rand() * (W - 120), y = 50 + this.rand() * (H - 110);
          if (this.ents.every(e => Math.hypot(e.x - x, e.y - y) > 125 * sc)) {
            const r = this.rand(), type = r < 0.1 ? 'gold' : (L >= 3 && r < 0.22) ? 'mega' : 'n';
            const f = Math.max(3.8, 9 - L * 0.5) * 1000 * this.D.fuse * (type === 'mega' ? 1.4 : 1);
            const w = type === 'mega' ? this.pickWord(6, 10) : this.pickWord(3, Math.min(9, 4 + Math.floor(L / 2)));
            this.ents.push(this.maybePower({ word: w, typed: 0, x, y, fuse: f, total: f, type })); break;
          }
        }
      }
      for (const e of this.ents.slice()) {
        e.fuse -= wdt;
        if (e.fuse <= 0) {
          this.remove(e); const R = (e.type === 'mega' ? 230 : 160) * sc;
          this.ents.forEach(o => { if (Math.hypot(o.x - e.x, o.y - e.y) < R) o.fuse *= 0.5; });
          this.fx.push({ ring: true, x: e.x, y: e.y, r: 10, R, life: 1 });
          this.hurt(e.type === 'mega' ? 2 : 1, e.x, e.y); if (!this.running) return;
        }
      }
    }
    for (const p of this.fx) { if (p.ring) { p.life -= dt / 450; p.r = p.R * (1 - p.life); continue; } p.x += p.vx * dt / 1000; p.y += p.vy * dt / 1000; p.vy += 90 * dt / 1000; p.life -= dt / 1000 * 1.4; }
    this.fx = this.fx.filter(p => p.life > 0);
    for (const f of this.floats) { f.y -= 32 * dt / 1000; f.life -= dt / 1100; }
    this.floats = this.floats.filter(f => f.life > 0);
    for (const l of this.lasers) l.life -= dt / 300;
    this.lasers = this.lasers.filter(l => l.life > 0);
  }
  drawBg() {
    const x = this.ctx, W = this.W, H = this.H; if (!W) return;
    x.fillStyle = this.c.bg; x.fillRect(0, 0, W, H);
    x.font = `14px "IBM Plex Mono", monospace`; x.fillStyle = this.c.soft; x.textBaseline = 'alphabetic'; x.textAlign = 'left';
    const r = rng(7); for (let i = 0; i < 38; i++) x.fillText(['*', '—', '|', '* *', '— —', '|||'][Math.floor(r() * 6)], r() * W, r() * H);
  }
  word(e, cx, cy, big) {
    const x = this.ctx, fs = Math.round((big ? 16 : this.kind === "torre" ? 13.5 : 16) * clamp(this.sc, .85, 1.1));
    x.font = `500 ${fs}px "IBM Plex Mono", ui-monospace, monospace`; x.textBaseline = 'middle'; x.textAlign = 'left';
    const w = x.measureText(e.word).width, pad = e.pw ? fs + 4 : 0, left = cx - (w + pad) / 2 + pad, tgt = e === this.target;
    const bx = left - pad - 7, by = cy - fs * .78, bw = w + pad + 14, bh = fs * 1.56;
    x.fillStyle = this.c.bg; x.globalAlpha = .95; this.rr(bx, by, bw, bh, 7); x.fill(); x.globalAlpha = 1;
    const theirs = e.owner && this.mp && e.owner !== this.mp.me;
    if (e.done) x.globalAlpha = .35; else if (theirs) x.globalAlpha = .55;
    x.lineWidth = tgt || (e.color && !theirs) ? 2.5 : e.color ? 1.5 : 1; x.strokeStyle = e.color || (tgt ? this.c.acc : e.coin ? this.c.gold : e.type === 'rapida' ? this.c.err : this.c.dim); this.rr(bx, by, bw, bh, 7); x.stroke();
    if (e.color) { x.fillStyle = e.color; x.beginPath(); x.arc(bx + 1, by + 1, 4, 0, Math.PI * 2); x.fill(); }
    if (e.pw) { x.fillStyle = this.c.acc2; x.beginPath(); x.arc(left - pad / 2 - 2, cy, fs * .52, 0, Math.PI * 2); x.fill(); x.fillStyle = '#fff'; x.textAlign = 'center'; x.font = `600 ${Math.round(fs * .75)}px sans-serif`; x.fillText(POWERS[e.pw].g, left - pad / 2 - 2, cy + 1); x.textAlign = 'left'; x.font = `500 ${fs}px "IBM Plex Mono", ui-monospace, monospace`; }
    const done = e.word.slice(0, e.typed), rest = e.word.slice(e.typed);
    x.fillStyle = this.c.acc; x.fillText(done, left, cy);
    x.fillStyle = e.boss || e.type === 'rapida' ? this.c.err : e.coin ? this.c.gold : this.c.ink; x.fillText(rest, left + x.measureText(done).width, cy);
    x.globalAlpha = 1;
    if (e.type === 'split') { x.strokeStyle = this.c.acc2; x.setLineDash([3, 3]); x.beginPath(); x.moveTo(left, cy + fs * .62); x.lineTo(left + w, cy + fs * .62); x.stroke(); x.setLineDash([]); }
  }
  rr(x0, y0, w, hh, r) { const x = this.ctx; x.beginPath(); x.moveTo(x0 + r, y0); x.arcTo(x0 + w, y0, x0 + w, y0 + hh, r); x.arcTo(x0 + w, y0 + hh, x0, y0 + hh, r); x.arcTo(x0, y0 + hh, x0, y0, r); x.arcTo(x0, y0, x0 + w, y0, r); x.closePath(); }
  draw() {
    const x = this.ctx, W = this.W, H = this.H, sc = this.sc;
    x.save();
    if (this.shake > 0) { const a = this.shake / 60; x.translate((Math.random() - .5) * a, (Math.random() - .5) * a); }
    this.drawBg();
    if (this.kind === 'caen') {
      x.strokeStyle = this.c.dim; x.setLineDash([10, 7]); x.lineWidth = 2; x.beginPath(); x.moveTo(0, H - 22); x.lineTo(W, H - 22); x.stroke(); x.setLineDash([]);
      for (const e of this.ents) {
        const cx = e.x + e.word.length * 5 * sc;
        if (e.type === 'rapida') { x.strokeStyle = this.c.err; x.globalAlpha = .35; x.lineWidth = 1.5; for (let i = -1; i <= 1; i++) { x.beginPath(); x.moveTo(cx + i * 10, e.y - 20); x.lineTo(cx + i * 10, e.y - 38); x.stroke(); } x.globalAlpha = 1; }
        else { x.fillStyle = this.c.dim; x.fillRect(cx, e.y - 28, 1.5, 12); }
        this.word(e, cx, e.y);
      }
    } else if (this.kind === 'torre') {
      const trace = pth => { x.beginPath(); pth.segs.forEach((s, i) => { if (!i) x.moveTo(s.x1, s.y1); x.lineTo(s.x2, s.y2); }); x.stroke(); };
      x.strokeStyle = this.c.soft; x.lineWidth = 18 * sc; x.lineCap = 'round'; x.lineJoin = 'round'; this.paths.forEach(trace);
      x.lineWidth = 2; x.setLineDash([8, 8]); x.strokeStyle = this.c.dim; this.paths.forEach(trace); x.setLineDash([]);
      if (this.paths.length > 1) { x.font = `600 ${Math.round(11 * sc)}px "IBM Plex Mono", monospace`; x.fillStyle = this.c.acc2; x.textBaseline = 'middle'; x.textAlign = 'left'; this.paths.forEach((pth, i) => x.fillText('›› ' + 'ABC'[i], 6, pth.start[1] - 16 * sc)); }
      const [bx, by] = this.base, bs = 32 * sc;
      x.fillStyle = this.c.soft; x.strokeStyle = this.c.acc; x.lineWidth = 2; this.rr(bx - bs / 2, by - bs / 2, bs, bs, 6); x.fill(); x.stroke();
      x.fillStyle = this.c.acc; x.font = `800 ${Math.round(22 * sc)}px "Martian Mono", monospace`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('*', bx, by + 2);
      if (this.turret) { x.font = `600 ${Math.round(11 * sc)}px "IBM Plex Mono", monospace`; x.fillStyle = this.c.acc2; x.fillText('torreta ' + '|'.repeat(this.turret), bx, by + bs * .9); }
      x.textAlign = 'left';
      for (const l of this.lasers) { x.globalAlpha = l.life; x.strokeStyle = this.c.acc2; x.lineWidth = 3; x.beginPath(); x.moveTo(l.x1, l.y1); x.lineTo(l.x2, l.y2); x.stroke(); x.globalAlpha = 1; }
      for (const e of this.ents) {
        if (e.d < 0) continue;
        const [ex, ey] = this.at(e.d, e.p);
        if (e.boss) { const s = 22 * sc; x.fillStyle = e.color || this.c.err; this.rr(ex - s / 2, ey - s / 2, s, s, 4); x.fill(); }
        else if (e.type === 'scout') { const s = 9 * sc; x.fillStyle = e.color || this.c.acc2; x.beginPath(); x.moveTo(ex + s, ey); x.lineTo(ex - s, ey - s * .8); x.lineTo(ex - s, ey + s * .8); x.closePath(); x.fill(); }
        else if (e.type === 'duo') { const s = 16 * sc; x.fillStyle = e.color || this.c.sub; x.globalAlpha = e.done ? .4 : 1; x.beginPath(); x.moveTo(ex, ey - s / 2); x.lineTo(ex, ey + s / 2); if (e.part === 0) x.arc(ex, ey, s / 2, Math.PI / 2, Math.PI * 1.5); else x.arc(ex, ey, s / 2, -Math.PI / 2, Math.PI / 2); x.fill(); x.globalAlpha = 1; }
        else if (e.type === 'tank') { const s = 15 * sc; x.fillStyle = e.color || this.c.sub; this.rr(ex - s / 2, ey - s / 2, s, s, 3); x.fill(); if (e.stage === 0) { x.strokeStyle = this.c.acc2; x.lineWidth = 2.5; x.beginPath(); x.arc(ex, ey, s * .95, 0, Math.PI * 2); x.stroke(); } }
        else { const s = 11 * sc; x.fillStyle = e.color || this.c.sub; this.rr(ex - s / 2, ey - s / 2, s, s, 3); x.fill(); }
        this.word(e, ex, ey - (19 + (e.link ? e.part * 24 : 0)) * clamp(sc, .8, 1.1), e.boss);
      }
      if (this.banner > 0) { x.globalAlpha = Math.min(1, this.banner / 500); x.fillStyle = this.c.acc; x.font = `800 ${Math.round(26 * sc)}px "Martian Mono", monospace`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(this.boss ? `oleada ${this.wave} · ¡jefe!` : `oleada ${this.wave}`, W / 2, H * .5); x.textAlign = 'left'; x.globalAlpha = 1; }
    } else if (this.kind === 'runner') {
      runnerDraw(this);
    } else if (this.kind === 'bombas') {
      for (const e of this.ents) {
        const r = (e.type === 'mega' ? 32 : 24) * sc, k = e.fuse / e.total, col = e.type === 'gold' ? this.c.gold : k < .3 ? this.c.err : this.c.acc;
        const pulse = k < .3 ? 1 + Math.sin(this.t / 60) * .06 : 1;
        x.lineWidth = 4; x.strokeStyle = this.c.soft; x.beginPath(); x.arc(e.x, e.y, r * pulse, 0, Math.PI * 2); x.stroke();
        if (e.type === 'mega') { x.lineWidth = 1.5; x.strokeStyle = this.c.err; x.beginPath(); x.arc(e.x, e.y, r * pulse + 7, 0, Math.PI * 2); x.stroke(); }
        x.lineWidth = 4; x.strokeStyle = col; x.beginPath(); x.arc(e.x, e.y, r * pulse, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); x.stroke();
        x.fillStyle = col; x.font = `800 ${Math.round((e.type === 'mega' ? 22 : 16) * sc)}px "Martian Mono", monospace`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('*', e.x, e.y + 1); x.textAlign = 'left';
        this.word(e, e.x, e.y + r + 16 * sc);
      }
    }
    x.textAlign = 'center'; x.textBaseline = 'middle';
    for (const p of this.fx) {
      if (p.ring) { x.globalAlpha = Math.max(0, p.life); x.strokeStyle = this.c.err; x.lineWidth = 3; x.beginPath(); x.arc(p.x, p.y, p.r, 0, Math.PI * 2); x.stroke(); continue; }
      x.globalAlpha = Math.max(0, p.life); x.fillStyle = p.col; x.font = `700 ${Math.round(15 * sc)}px "Martian Mono", monospace`; x.fillText(p.ch, p.x, p.y);
    }
    for (const f of this.floats) { x.globalAlpha = Math.min(1, f.life * 1.6); x.fillStyle = f.col; x.font = `800 ${Math.round(f.size * clamp(sc, .8, 1.1))}px "Martian Mono", monospace`; x.fillText(f.text, f.x, f.y); }
    x.globalAlpha = 1; x.textAlign = 'left';
    x.restore();
    if (this.freezeT > 0) { x.fillStyle = this.c.acc2; x.globalAlpha = .12; x.fillRect(0, 0, W, H); x.globalAlpha = 1; this.badge(`❄ ${(this.freezeT / 1000).toFixed(1)}s`, W / 2, 20); }
    else if (this.slowT > 0) this.badge(`◷ cámara lenta ${(this.slowT / 1000).toFixed(1)}s`, W / 2, 20);
    if (this.fever) { const a = .45 + Math.sin(this.t / 140) * .25; x.globalAlpha = a; x.strokeStyle = this.c.acc2; x.lineWidth = 6; x.strokeRect(3, 3, W - 6, H - 6); x.globalAlpha = 1; this.badge('fiebre x2', W - 60, 20); }
    if (this.flash > 0) { x.globalAlpha = this.flash / 1000; x.fillStyle = this.c.err; x.fillRect(0, 0, W, H); x.globalAlpha = 1; }
  }
  badge(text, cx, cy) {
    const x = this.ctx; x.font = `600 12px "IBM Plex Mono", monospace`; const w = x.measureText(text).width + 18;
    x.fillStyle = this.c.acc; this.rr(cx - w / 2, cy - 11, w, 22, 11); x.fill();
    x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, cx, cy + 1); x.textAlign = 'left';
  }
  checkMissions() {
    const ms = ARC[this.kind].missions, done = this.missionsDone(); let changed = false;
    ms.forEach((m, i) => { if (!this.runMis[i] && m.ok(this)) { this.runMis[i] = true; if (!done[i]) { done[i] = true; changed = true; this.newMis = this.newMis || []; this.newMis[i] = true; Sfx.mission(); this.float(this.W / 2, this.H * .22, '★ misión: ' + m.t, this.c.acc, 16); } } });
    if (changed) store.set(this.misKey(), done);
  }
  hud() {
    const set = (id, v) => { const el = $(id); if (el && el.textContent !== String(v)) el.textContent = v; };
    set('#arc-score', this.score);
    set('#arc-level', this.kind === 'torre' ? this.wave : this.kind === 'runner' ? Math.round(this.dist) : this.level);
    set('#arc-lives', this.lives > 8 ? `* ×${this.lives}` : '* '.repeat(this.lives).trim() || '—');
    set('#arc-wpm', this.t > 1000 ? Math.round(this.chars / 5 / (this.t / 60000)) : 0);
    set('#arc-acc', (this.keys ? Math.round(this.hits / this.keys * 100) : 100) + '%');
    set('#arc-combo', 'x' + this.combo + (this.fever ? ' · fiebre' : ''));
    $('#arc-combo')?.classList.toggle('hot', this.fever);
    if (this.running && !this.mp) this.checkMissions();
    this.emitFever(!!(this.running && this.fever));
  }
  over() {
    if (this.mp) {
      this.running = false; cancelAnimationFrame(this.raf); this.emitFever(false); this.draw(); Sfx.over(); this.recordRun(true);
      this.mp.onStatus?.({ lives: 0, score: this.score, level: this.kind === 'torre' ? this.wave : this.kind === 'runner' ? Math.round(this.dist) : this.level, alive: false });
      if (this.mp.coop) { this.mp.onEnd?.({ coop: true, score: this.score, wave: this.wave }); this.endRemote({ coop: true, score: this.score, wave: this.wave }); }
      else { this.mp.onDead?.({ score: this.score }); this.showOv(h('div', { class: 'inner' }, h('span', { class: 'eyebrow', text: '* sala online' }), h('h2', { text: 'quedaste afuera' }), h('p', { class: 'sub', text: `${this.score} puntos · mirá cómo sigue la ronda` }))); }
      return;
    }
    this.running = false; cancelAnimationFrame(this.raf); this.checkMissions(); this.draw(); this.hud(); Sfx.over();
    const best = store.get(this.bestKey(), 0), rec = this.score > best; this.recordRun(true); this.diffBar();
    const bestEl = $('#arc-best'); if (bestEl) bestEl.textContent = Math.max(best, this.score);
    const where = this.kind === 'torre' ? `llegaste a la oleada ${this.wave}` : this.kind === 'runner' ? `corriste ${Math.round(this.dist)} metros · ${this.coins} monedas` : `llegaste al nivel ${this.level}`;
    const fresh = this.newMis; this.newMis = null;
    this.showOv(h('div', { class: 'inner' }, h('span', { class: 'eyebrow', text: (rec ? '* nuevo récord' : '* fin del juego') + ' · ' + this.D.name }), h('h2', { text: `${this.score} puntos` }),
      h('p', { class: 'sub', text: `${where} · ${this.kills} palabras · combo máximo ${this.maxCombo} · ${Math.round(this.t > 1000 ? this.chars / 5 / (this.t / 60000) : 0)} ppm · ${this.keys ? Math.round(this.hits / this.keys * 100) : 100}% precisión` }),
      h('div', {}, h('span', { class: 'lbl', style: 'margin-bottom:6px', text: 'misiones' }), this.missionsEl(fresh)),
      h('p', { class: 'hint', text: 'guardado en tu perfil · ' + (History.mode === 'cloud' ? 'en tu cuenta' : 'en este navegador') }),
      h('div', { class: 'row', style: 'justify-content:center' }, h('button', { class: 'btn primary', text: 'otra vez', onclick: () => this.start() }), h('span', { class: 'hint' }, h('kbd', { text: 'enter' })))));
  }
}
export const Arc: any = {
  cur: store.get('arcMode', 'caen'),
  init() {
    this.game = new Arcade($('#arc-stage'));
    if (process.env.NODE_ENV !== 'production') (window as any).__teclaArc = this; // depuración en desarrollo
    this.renderTabs();
    const sfx = $('#arc-sfx'), lbl = () => sfx.textContent = Sfx.on ? '♪ sonido sí' : '♪ sonido no';
    lbl(); sfx.onclick = () => { Sfx.on = !Sfx.on; store.set('sfx', Sfx.on); lbl(); if (Sfx.on) { Sfx.init(); Sfx.power(); } focusKb(); };
  },
  renderTabs() { tabs($('#arc-tabs'), { items: gameTabs(Object.keys(ARC), false), value: this.cur, onChange: k => this.show(k), variant: 'card', label: 'juegos del arcade' }); },
  show(k) { this.cur = k; store.set('arcMode', k); this.renderTabs(); this.game.setKind(k); $('#arc-lives').textContent = ''; $('#arc-score').textContent = '0'; },
  enter() { this.game.resize(); this.show(this.cur); },
  leave() { this.game?.abandon(); this.game?.destroy(); },
};
