import { $, clamp, now, rng, shuffle, store, toast } from '@/lib/tecla/utils';
import { SENTENCES, VOCAB } from '@/lib/tecla/data/words';
import { focusKb, setConsumer, type Consumer } from '@/lib/tecla/input';
import { History } from '@/lib/tecla/history';
import { Sfx } from '@/lib/tecla/sfx';
import { cosmetics } from '@/lib/shop/client';
import { celebrate } from '@/lib/shop/celebrate';
import type { PixiFx } from '@/lib/shop/pixifx';
import { ADIFF, ARC, BASE_LIVES, POWERS, TD_PATHS, UPGRADES } from '@/lib/arcade/config';
import { runnerBack, runnerChar, runnerDraw, runnerStart, runnerUpdate, type RunnerState } from '@/lib/arcade/runner';
import type {
  ArcadeDiff, ArcadeKind, ArcadeUi, CoopSummary, Entity, FloatText, HudState, Laser, MpConfig, OverlaySpec,
  Palette, Particle, PathSeg, PowerKind, Rival, Snapshot, TdPath, Upgrade, WordLike,
} from '@/lib/arcade/types';

/* =========================================================
   ARCADE: los cuatro minijuegos en un canvas (caen, torre, runner, bombas),
   solos o en una sala online. La interfaz alrededor (pantallas, HUD, botones)
   la dibuja React: el juego le avisa por `ui`.
   ========================================================= */

/** Entidad con valores por defecto: cada juego completa solo los campos que usa. */
const mk = (e: Partial<Entity> & { word: string }): Entity => ({ typed: 0, type: 'n', x: 0, y: 0, x0: 0, ph: 0, v: 0, d: 0, p: 0, fuse: 0, total: 0, ...e });

const FONT = '"IBM Plex Mono", ui-monospace, monospace';
const FONT_BOLD = '"Martian Mono", monospace';

export class Arcade implements Consumer {
  readonly stage: HTMLElement;
  private readonly ui: ArcadeUi;
  private readonly cv: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  private readonly ro: ResizeObserver;
  private readonly onCos: () => void;
  private pfx: { kind: string; fx: PixiFx | null } | null = null;
  private dead = false;

  kind: ArcadeKind = 'caen';
  running = false;
  c: Palette = { ink: '', sub: '', dim: '', acc: '', acc2: '', soft: '', err: '', ok: '', gold: '', bg: '', pat: '' };
  /** medidas del canvas en px CSS y escala de los dibujos */
  W = 0; H = 0; sc = 1;

  /* ---------- estado de la partida ---------- */
  ents: Entity[] = [];
  fx: Particle[] = [];
  floats: FloatText[] = [];
  lasers: Laser[] = [];
  target: Entity | null = null;
  bad: { c: string; e: Entity; until: number } | null = null;
  /** ms jugados (sin contar pausas) */
  t = 0;
  score = 0; level = 1; lives = 0; maxLives = 0;
  kills = 0; keys = 0; hits = 0; chars = 0;
  combo = 0; maxCombo = 0; chain = 0; maxChain = 0; lastKill = -9999;
  mult = 1; fever = false; freezeT = 0; slowT = 0; flash = 0; shake = 0; spawnT = 600;
  paused = false; userPaused = false;
  /** contadores para las misiones */
  powers = 0; cleared = 0; bosses = 0; perfect = 0; golden = 0; jumps = 0; coins = 0; dist = 0;
  milestone = 100;
  private runMis = [false, false, false];
  private newMis: boolean[] | null = null;
  private saved = false;
  private overBest = 0;
  rand: () => number = Math.random;
  private bags: Record<string, { b: string[]; recent: string[] }> = {};
  private last = 0;
  private raf = 0;
  private lastHud = '';
  private feverShown = false;
  overlay: OverlaySpec | null = null;

  /* torre */
  paths: TdPath[] = [];
  base: [number, number] = [0, 0];
  wave = 0; toSpawn = 0; boss = false; banner = 0; frost = 1; shock = 0; turret = 0; turretT = 0;
  choices: Upgrade[] | null = null;
  private betweenWaves = false;
  private waveHurt = false;
  private lastP = 0;

  /* runner (su estado vive en lib/arcade/runner) */
  rn!: RunnerState;
  rivals: Rival[] = [];

  /* multijugador */
  mp: MpConfig | null = null;
  /** invitado de la torre cooperativa: copia lo que simula el anfitrión */
  mirror = false;
  private activeIds: string[] = [];
  private nextId = 1;
  private lastSnap = 0;
  private lastStatus = 0;
  private atk = 0;
  private killed = new Map<number, number>();
  private waitOv = false;

  constructor(stage: HTMLElement, ui: ArcadeUi = {}) {
    this.stage = stage; this.ui = ui;
    this.cv = $<HTMLCanvasElement>('canvas', stage); this.ctx = this.cv.getContext('2d')!;
    stage.addEventListener('mousedown', e => { if (e.target === this.cv) { e.preventDefault(); focusKb(); } });
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(stage);
    this.fxOn(); this.onCos = () => this.fxOn(); window.addEventListener('tecla:cos', this.onCos);
  }

  get D() { return ADIFF[this.diffKey()] || ADIFF.medio; }
  diffKey(): ArcadeDiff { return this.mp ? this.mp.diff : store.get<ArcadeDiff>('arcDiff:' + this.kind, 'medio'); }
  bestKey(k = this.diffKey()) { return 'arc:' + this.kind + (this.kind === 'runner' ? '-p' : '') + (k === 'medio' ? '' : ':' + k); }
  // el runner nuevo tiene misiones nuevas
  private misKey() { return 'mis:' + this.kind + (this.kind === 'runner' ? '-p' : ''); }
  missionsDone() { return store.get<boolean[]>(this.misKey(), [false, false, false]); }

  /** efecto de la tienda (PixiJS) encima del canvas; se carga solo si hay uno equipado */
  private fxOn() {
    const kind = cosmetics().efecto || '';
    if (this.pfx?.kind === kind) return;
    this.pfx?.fx?.destroy(); this.pfx = null; if (!kind || this.dead) return;
    const slot: { kind: string; fx: PixiFx | null } = { kind, fx: null }; this.pfx = slot;
    import('@/lib/shop/pixifx').then(m => m.PixiFx.attach(this.stage, this.cv, kind)).then(fx => {
      if (this.pfx === slot && !this.dead) slot.fx = fx ?? null; else fx?.destroy();
    }).catch(() => {});
  }

  colors() {
    const cs = getComputedStyle(document.documentElement), g = (n: string) => cs.getPropertyValue(n).trim();
    this.c = { ink: g('--ink'), sub: g('--sub'), dim: g('--dim'), acc: g('--accent'), acc2: g('--accent-2'), soft: g('--soft'), err: g('--err'), ok: g('--ok'), gold: g('--warn'), bg: g('--surface'), pat: g('--pat') };
  }
  resize() {
    const w = this.stage.clientWidth; if (!w) return;
    const hh = Math.max(220, this.stage.clientHeight || Math.round(w * 0.55)), dpr = window.devicePixelRatio || 1;
    this.W = w; this.H = hh; this.cv.width = w * dpr; this.cv.height = hh * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); this.sc = clamp(Math.min(w / 900, hh / 440), .55, 1.2);
    this.buildPath(); this.colors(); if (!this.running) this.drawBg(); else this.draw();
  }

  /* ---------- torre: caminos ---------- */
  private buildPath() {
    if (!this.W) return;
    const n = this.D.paths, defs = n === 1 ? [TD_PATHS.solo] : n === 2 ? [TD_PATHS.top, TD_PATHS.bot] : [TD_PATHS.top, TD_PATHS.mid, TD_PATHS.bot];
    this.paths = defs.map(def => {
      const P = def.map(([x, y]): [number, number] => [x * this.W, y * this.H]), segs: PathSeg[] = []; let len = 0;
      for (let i = 1; i < P.length; i++) { const [x1, y1] = P[i - 1], [x2, y2] = P[i], l = Math.hypot(x2 - x1, y2 - y1); segs.push({ x1, y1, x2, y2, l, s: len }); len += l; }
      return { segs, len, start: P[0] };
    });
    const end = TD_PATHS.solo[TD_PATHS.solo.length - 1]; this.base = [end[0] * this.W, end[1] * this.H];
  }
  /** punto a distancia `d` del camino `p` */
  at(d: number, p = 0): [number, number] {
    const path = this.paths[p] || this.paths[0];
    for (const s of path.segs) if (d <= s.s + s.l) { const k = (d - s.s) / s.l; return [s.x1 + (s.x2 - s.x1) * k, s.y1 + (s.y2 - s.y1) * k]; }
    return this.base;
  }
  /** cuánto recorrió del camino (0–1) */
  private prog(e: Entity) { return e.d / (this.paths[e.p || 0] || this.paths[0]).len; }

  /* ---------- ciclo de vida ---------- */
  setDiff(k: ArcadeDiff) { this.abandon(); store.set('arcDiff:' + this.kind, k); this.buildPath(); this.hudReset(); this.drawBg(); this.intro(); }
  setKind(k: ArcadeKind) { this.abandon(); this.kind = k; this.colors(); this.drawBg(); this.hudReset(); this.intro(); }
  private recordRun(fin: boolean) {
    if (this.saved || !this.t) return; this.saved = true;
    if (!fin && this.score <= 0) return;
    if (this.score > store.get(this.bestKey(), 0)) store.set(this.bestKey(), this.score);
    const where = this.kind === 'torre' ? `oleada ${this.wave}` : this.kind === 'runner' ? `${Math.round(this.dist)} m · ${this.coins} monedas` : `nivel ${this.level}`;
    History.record({
      t: 'arcade', game: this.kind, diff: this.diffKey(), score: this.score, fin: !!fin, pts: this.score,
      wpm: this.wpm(), acc: this.accuracy(),
      detail: `${where} · ${this.kills} palabras · combo ${this.maxCombo}`,
    });
    if (!fin) toast(`partida guardada: ${this.score} puntos`);
  }
  /** Sale de la partida en curso guardando lo jugado. */
  abandon() { if (this.running) this.recordRun(false); this.stop(); }
  private intro() { this.show({ kind: 'intro' }); setConsumer(this); }
  private show(spec: OverlaySpec) { this.overlay = spec; this.ui.overlay?.(spec); }
  private hideOv() { this.overlay = null; this.ui.overlay?.(null); }
  private hudReset() { this.lastHud = ''; this.ui.changed?.(); this.hud(true); }

  start() {
    if (this.running) this.recordRun(false);
    this.stop(); this.colors(); Sfx.init();
    this.ents = []; this.fx = []; this.floats = []; this.lasers = []; this.target = null; this.bad = null;
    this.score = 0; this.level = 1; this.kills = 0; this.keys = 0; this.hits = 0; this.chars = 0; this.combo = 0; this.maxCombo = 0;
    this.t = 0; this.spawnT = 600; this.mult = 1; this.paused = false; this.userPaused = false; this.choices = null;
    this.flash = 0; this.shake = 0; this.dist = 0; this.fever = false; this.freezeT = 0; this.slowT = 0;
    this.powers = 0; this.cleared = 0; this.bosses = 0; this.perfect = 0; this.saved = false; this.coins = 0; this.jumps = 0;
    this.chain = 0; this.maxChain = 0; this.lastKill = -9999; this.golden = 0; this.turret = 0; this.turretT = 0;
    this.milestone = 100; this.runMis = [false, false, false];
    // en las salas todos usan la misma semilla: mismas palabras en el mismo orden
    this.rand = this.mp ? rng((this.mp.seed ^ this.kind.length * 7919) >>> 0) : Math.random;
    this.nextId = 1; this.lastSnap = 0; this.lastStatus = 0; this.atk = 0; this.killed = new Map();
    this.maxLives = this.lives = Math.max(2, BASE_LIVES[this.kind] + this.D.lives);
    if (this.kind === 'runner') runnerStart(this);
    this.buildPath();
    if (this.kind === 'torre') { this.wave = 0; this.frost = 1; this.shock = 0; this.nextWave(); }
    this.hideOv(); this.running = true; this.last = now(); setConsumer(this);
    this.raf = requestAnimationFrame(t => this.frame(t));
  }

  /* ---------- multijugador ---------- */
  startMp(mp: MpConfig) {
    this.mp = mp; this.mirror = mp.role === 'guest' && this.kind === 'torre';
    this.activeIds = (mp.roster || []).map(r => r.id);
    this.start();
    const mine = (mp.roster || []).find(r => r.id === mp.me);
    if (mp.coop && mine && (mp.roster || []).length >= 2) this.float(this.W / 2, this.H * .36, 'escribí las palabras de tu color', mine.color, 17);
  }
  /* torre cooperativa: si se fue el anfitrión, el que hereda la ronda deja de copiar y pasa a simular el juego
     (con lo último que mandó el anfitrión: bichos, vidas, oleada; la oleada en curso termina con los que quedan) */
  promote() {
    if (!this.mirror || !this.mp) return;
    this.mirror = false; this.waitOv = false; this.mp.role = 'host';
    this.toSpawn = 0; this.spawnT = 0; this.betweenWaves = false; this.frost = this.frost || 1; this.shock = this.shock || 0;
    this.nextId = Math.max(this.nextId || 1, ...this.ents.map(e => (e.id || 0) + 1), ...this.ents.map(e => (e.link || 0) + 1));
    for (const e of this.ents) { if (e.done && e.link) continue; e.done = false; }
    if (this.overlay?.kind === 'wait') { this.hideOv(); this.offerUpgrades(); } // estaba eligiendo mejora el anfitrión
    this.float(this.W / 2, this.H * .3, 'ahora sos el anfitrión', this.c.acc, 18);
  }
  /* torre cooperativa: cada bicho es de un jugador (su color) y solo ese jugador puede escribirlo */
  private coopPlayers() {
    if (!this.mp?.coop) return [];
    const ids = new Set(this.activeIds);
    return (this.mp.roster || []).filter(r => ids.has(r.id));
  }
  private assignOwner(e: Entity) {
    const ps = this.coopPlayers();
    if (ps.length < 2) { e.owner = null; e.color = null; return e; }
    // al que menos palabras tiene en pantalla (empate: al azar con la semilla)
    const load = (id: string) => this.ents.filter(o => o.owner === id && !o.done).length;
    const pl = shuffle(ps, this.rand).sort((a, b) => load(a.id) - load(b.id))[0];
    e.owner = pl.id; e.color = pl.color; return e;
  }
  /** el anfitrión avisa quién sigue en la sala: las palabras de quien se fue pasan a otro */
  setActivePlayers(ids: string[]) {
    if (!this.mp?.coop || this.mirror) return;
    const prev = this.activeIds.join(','); this.activeIds = ids.slice();
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
  /** caen online: palabras basura que manda un rival */
  receiveGarbage(n: number) {
    if (!this.running || this.kind !== 'caen') return;
    const sc = this.sc, list = VOCAB.dificil;
    for (let i = 0; i < n; i++) {
      const w = list[Math.floor(Math.random() * list.length)], x = 40 + Math.random() * (this.W - 80 - w.length * 11 * sc);
      this.ents.push(mk({ word: w, x, x0: x, y: -10 - i * 34, v: (34 + this.level * 6) * sc * this.D.speed, type: 'rapida', garbage: true }));
    }
    this.float(this.W / 2, this.H * .2, n > 1 ? `¡te mandaron ${n} palabras!` : '¡te mandaron basura!', this.c.err, 18); Sfx.miss();
  }
  winMp() {
    if (!this.running) return;
    this.recordRun(true); this.running = false; cancelAnimationFrame(this.raf); this.emitFever(false); Sfx.mission(); celebrate('win');
    this.show({ kind: 'mpWin', score: this.score });
  }
  endRemote(sum?: Partial<CoopSummary> | null) {
    this.running = false; cancelAnimationFrame(this.raf); this.emitFever(false); this.draw();
    this.show({ kind: 'mpEnd', coop: !!sum?.coop, score: sum?.score || 0, wave: sum?.wave || 0 });
  }
  private snapshot(): Snapshot {
    return {
      lives: this.lives, wave: this.wave, score: this.score, banner: Math.round(this.banner || 0), boss: this.boss, frost: this.frost, choosing: !!this.choices, turret: this.turret,
      ents: this.ents.map(e => ({ id: e.id, w: e.word, d: Math.round(e.d * 10) / 10, p: e.p, v: e.v, type: e.type, boss: !!e.boss, link: e.link || 0, part: e.part || 0, owner: e.owner || null, color: e.color || null, done: !!e.done, stage: e.stage || 0, pw: e.pw || null })),
    };
  }
  applySnapshot(sn: Snapshot) {
    this.lives = sn.lives; this.wave = sn.wave; this.score = sn.score; this.banner = sn.banner; this.boss = sn.boss; this.frost = sn.frost; this.turret = sn.turret;
    const byId = new Map(this.ents.map(e => [e.id, e])), t = now(), next: Entity[] = [];
    for (const se of sn.ents) {
      // lo que acabo de destruir no vuelve por un snapshot viejo
      const k = se.id != null ? this.killed.get(se.id) : undefined; if (k && t - k < 1500 && !se.link) continue;
      const e = byId.get(se.id) || mk({ id: se.id, word: se.w });
      if (e.word !== se.w) { e.typed = 0; if (this.target === e) this.target = null; }
      Object.assign(e, { word: se.w, d: se.d, p: se.p, v: se.v, type: se.type, boss: se.boss, link: se.link, part: se.part, owner: se.owner, color: se.color, done: se.done || (k && t - k < 1500 && se.link ? true : se.done), stage: se.stage, pw: se.pw });
      next.push(e);
    }
    this.ents = next; if (this.target && !next.includes(this.target)) this.target = null;
    if (sn.choosing && !this.waitOv) { this.waitOv = true; this.show({ kind: 'wait' }); }
    else if (!sn.choosing && this.waitOv) { this.waitOv = false; this.hideOv(); }
  }
  /** runner online: posición de los rivales */
  setRivals(list: Rival[]) {
    const prev = new Map(this.rivals.map(r => [r.name + r.color, r.shown]));
    this.rivals = list.map(r => ({ ...r, shown: prev.get(r.name + r.color) }));
  }
  remoteHit(id: number) { const e = this.ents.find(o => o.id === id); if (e && !e.done && this.running) this.kill(e, true); }
  stop() { this.running = false; cancelAnimationFrame(this.raf); this.emitFever(false); }
  private emitFever(on: boolean) { if (this.feverShown === on) return; this.feverShown = on; window.dispatchEvent(new CustomEvent('tecla:fever', { detail: on })); }
  destroy() { this.stop(); this.ro.disconnect(); this.dead = true; this.pfx?.fx?.destroy(); this.pfx = null; window.removeEventListener('tecla:cos', this.onCos); }

  /* ---------- teclado (el juego es el consumidor del input) ---------- */
  enter() { if (this.mp) return; if (!this.running) this.start(); else if (this.userPaused) this.resume(); }
  tab() { if (this.mp) return; this.start(); }
  esc() { if (this.mp) return; if (this.running && !this.choices && !this.userPaused) { this.userPaused = this.paused = true; this.show({ kind: 'pause' }); } }
  resume() { this.userPaused = this.paused = false; this.hideOv(); this.last = now(); focusKb(); }

  char(c: string) {
    if (!this.running) { if (this.mp) return; const i = '123'.indexOf(c); if (i >= 0) this.setDiff(Object.keys(ADIFF)[i] as ArcadeDiff); return; }
    if (this.paused) { if (this.choices) { const i = '123'.indexOf(c); if (i >= 0 && this.choices[i]) this.choose(this.choices[i]); } return; }
    if (this.kind === 'runner') return runnerChar(this, c);
    if (this.target && !this.ents.includes(this.target)) this.target = null;
    if (!this.target) {
      if (c === ' ') return;
      const me = this.mp?.me, tnow = now();
      const cands = this.ents.filter(e => e.word[0] === c && !e.done && !(e.lock && e.lock > tnow) && (!e.owner || e.owner === me) && !(this.kind === 'torre' && e.d < 0));
      this.keys++;
      if (!cands.length) return this.miss(c);
      // entre las que empiezan con esa letra, la más peligrosa
      cands.sort((a, b) => this.danger(b) - this.danger(a)); this.target = cands[0]; this.target.typed = 0;
    } else this.keys++;
    const e = this.target;
    if (e.word[e.typed] === c) { e.typed++; this.hits++; this.chars++; Sfx.key(); if (e.typed >= e.word.length) this.kill(e); }
    else this.miss(c, e);
  }
  back() { if (this.kind === 'runner') return runnerBack(this); if (this.target) { this.target.typed = 0; this.target = null; } }

  private danger(e: Entity) { return this.kind === 'caen' ? e.y : this.kind === 'torre' ? this.prog(e) : -e.fuse; }

  /** c = la tecla que se tocó mal: se ve tachada en la palabra (en el lugar de la que iba) o, si no había palabra, flotando abajo */
  miss(c?: string, e?: Entity) {
    this.combo = 0; this.flash = 160; Sfx.miss();
    if (c && c !== ' ') {
      if (e) this.bad = { c, e, until: now() + 550 };
      else this.floats.push({ x: this.W / 2, y: this.H - 36, text: c, col: this.c.err, size: 22, life: 0.8, strike: true });
    }
    if (this.fever) { this.fever = false; this.float(this.W / 2, this.H * .3, 'fiebre perdida', this.c.sub, 16); }
  }
  float(x: number, y: number, text: string, col?: string, size = 15) { this.floats.push({ x, y, text, col: col || this.c.acc, size, life: 1 }); }
  burst(x: number, y: number, n = 9, col?: string) {
    const color = col || (this.fever ? this.c.acc2 : this.c.acc);
    this.pfx?.fx?.burst(x, y, n, color);
    const ch = ['*', '—', '|', '/', '*'];
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = 50 + Math.random() * 150; this.fx.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, life: 1, ch: ch[i % ch.length], col: color }); }
  }
  private pos(e: Entity): [number, number] { if (this.kind === 'torre') return this.at(Math.max(0, e.d), e.p); return [e.x, e.y]; }
  private remove(e: Entity) { this.ents = this.ents.filter(x => x !== e); if (this.target === e) this.target = null; }

  private kill(e: Entity, remote = false) {
    const [x, y] = this.pos(e);
    if (this.mirror && !remote) {
      // invitado de la torre: el anfitrión decide; acá solo mostramos el golpe al instante
      this.mp?.onHit?.(e.id!); this.combo++; this.kills++; Sfx.kill(this.combo); this.burst(x, y, 8, e.color || undefined);
      if (this.target === e) this.target = null; e.typed = 0;
      if (e.link) { e.done = true; this.killed.set(e.id!, now()); }
      else if (e.words || e.type === 'tank') { e.lock = now() + 500; }
      else { this.killed.set(e.id!, now()); this.remove(e); }
      return;
    }
    if (e.link) {
      e.done = true; e.typed = e.word.length; if (this.target === e) this.target = null;
      const mates = this.ents.filter(o => o.link === e.link);
      if (!mates.every(o => o.done)) { this.burst(x, y, 6, e.color || undefined); this.float(x, y - 44 * this.sc, 'falta tu compañero', e.color || this.c.acc2, 13); Sfx.key(); return; }
      mates.forEach(o => { if (o !== e) this.remove(o); });
      this.float(x, y - 60 * this.sc, '¡en equipo!', this.c.acc, 16);
    }
    if (e.words && (e.stage || 0) < e.words.length - 1) {
      e.stage = (e.stage || 0) + 1; e.word = e.words[e.stage]; e.typed = 0; this.combo++;
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
    if (this.kind === 'caen' && e.type === 'split') [-1, 1].forEach(s => this.ents.push(mk({ word: this.pickWord(3, 4), x: clamp(e.x + s * 45 * this.sc, 20, this.W - 80), x0: e.x, y: e.y, v: e.v * 0.9 })));
    if (this.kind === 'bombas' && e.type === 'gold') {
      // la dorada desactiva a sus vecinas
      this.golden++; this.float(x, y - 60 * this.sc, '¡dorada!', this.c.gold, 18);
      this.ents.filter(o => Math.hypot(o.x - x, o.y - y) < 190 * this.sc).forEach(o => { if (this.ents.includes(o)) { o.type = o.type === 'gold' ? 'n' : o.type; this.kill(o); } });
    }
    if (e.pw) this.power(e.pw, x, y);
    if (this.kind !== 'torre') this.level = 1 + Math.floor(this.kills / (this.kind === 'bombas' ? 8 : 10));
  }

  private power(p: PowerKind, x: number, y: number) {
    this.powers++; Sfx.power(); this.float(x, y - 60 * this.sc, POWERS[p].name, this.c.acc, 20);
    if (p === 'hielo') this.freezeT = 3000;
    else if (p === 'lento') this.slowT = 5000;
    else if (p === 'vida') this.lives = Math.min(this.lives + 1, this.maxLives + 3);
    else if (p === 'boom') {
      this.shake = 350; Sfx.noise(0.4, 0.12);
      this.ents.filter(o => !o.boss && !o.coin).forEach(o => { const [ox, oy] = this.pos(o); this.remove(o); this.score += o.word.length * 5; this.kills++; this.burst(ox, oy, 8); });
    }
  }
  hurt(n = 1, x?: number, y?: number) {
    this.lives -= n; this.combo = 0; this.chain = 0; this.flash = 260; this.shake = 280; this.waveHurt = true; Sfx.hurt();
    if (this.fever) this.fever = false;
    if (x != null && y != null) this.burst(x, y, 14, this.c.err);
    if (this.lives <= 0) { this.lives = 0; this.over(); }
  }

  /* ---------- torre: oleadas y mejoras ---------- */
  private nextWave() { this.wave++; this.toSpawn = Math.round((4 + this.wave * 2) * this.D.count); this.boss = this.wave % 5 === 0; this.spawnT = 1500; this.banner = 1600; this.waveHurt = false; }
  choose(u: Upgrade) {
    if (u.id === 'frost') this.frost *= 0.85;
    else if (u.id === 'wall') { this.lives += 3; this.maxLives += 3; }
    else if (u.id === 'shock') this.shock++;
    else if (u.id === 'turret') { this.turret++; this.turretT = 1500; }
    else this.mult *= 1.25;
    this.choices = null; this.paused = false; this.hideOv(); this.last = now(); this.nextWave(); focusKb();
  }
  private waveDone() {
    let bonus = this.wave * 40; this.cleared++;
    if (!this.waveHurt) { this.perfect++; bonus *= 2; this.float(this.W / 2, this.H * .45, `oleada perfecta +${bonus}`, this.c.acc, 20); }
    else this.float(this.W / 2, this.H * .45, `oleada superada +${bonus}`, this.c.acc, 18);
    this.score += bonus; Sfx.power();
    setTimeout(() => { if (this.running && this.kind === 'torre') this.offerUpgrades(); }, 700);
    this.betweenWaves = true;
  }
  private offerUpgrades() {
    this.betweenWaves = false; this.paused = true; this.choices = shuffle(UPGRADES).slice(0, 3);
    this.show({ kind: 'upgrades' });
  }

  /* ---------- palabras ---------- */
  /** Palabra nueva de la bolsa de la dificultad: sin repetir las recientes y, si se puede, sin repetir la inicial de otra en pantalla. */
  pickWord(minL: number, maxL: number) {
    const tier = this.diffKey(), list = VOCAB[tier] || VOCAB.medio;
    if (tier === 'dificil') { minL += 5; maxL += 6; } else if (tier === 'facil') { maxL = Math.min(maxL, 6); minL = Math.min(minL, maxL); }
    const used = new Set(this.ents.map(e => e.word[0])), bag = this.bags[tier] || (this.bags[tier] = { b: [], recent: [] });
    const fits = (w: string) => w.length >= minL && w.length <= maxL, fresh = (w: string) => !bag.recent.includes(w);
    const prefs = [(w: string) => fits(w) && fresh(w) && !used.has(w[0]), (w: string) => fits(w) && fresh(w), (w: string) => w.length <= maxL + 4 && fresh(w), fresh];
    for (const pred of prefs) {
      for (let pass = 0; pass < 2; pass++) {
        if (!bag.b.length || pass) bag.b = shuffle(list, this.rand);
        const i = bag.b.findIndex(pred);
        if (i >= 0) { const w = bag.b.splice(i, 1)[0]; bag.recent.push(w); if (bag.recent.length > 60) bag.recent.shift(); return w; }
      }
    }
    return list[Math.floor(this.rand() * list.length)];
  }
  private maybePower(e: Entity) {
    const R = this.rand;
    if (this.t > 5000 && R() < 0.075) { const ks = (Object.keys(POWERS) as PowerKind[]).filter(k => k !== 'vida' || this.lives < this.maxLives); e.pw = ks[Math.floor(R() * ks.length)]; }
    return e;
  }

  /* ---------- bucle ---------- */
  private frame(t: number) {
    if (!this.running) return;
    const dt = Math.min(50, t - this.last); this.last = t;
    if (!this.paused) { this.t += dt; this.update(dt); }
    this.draw(); this.hud();
    if (this.mp) {
      if (this.mp.role === 'host' && this.kind === 'torre' && t - this.lastSnap > 250) { this.lastSnap = t; this.mp.onSnapshot?.(this.snapshot()); }
      if (t - this.lastStatus > 1000) { this.lastStatus = t; this.mp.onStatus?.({ lives: this.lives, score: this.score, level: this.levelValue(), alive: this.running }); }
    }
    if (this.running) this.raf = requestAnimationFrame(x => this.frame(x));
  }
  private levelValue() { return this.kind === 'torre' ? this.wave : this.kind === 'runner' ? Math.round(this.dist) : this.level; }

  private update(dt: number) {
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
        this.ents.push(this.maybePower(mk({ word: w, x, x0: x, y: -10, v: (22 + L * 5 + this.rand() * 10) * sc * this.D.speed * (type === 'rapida' ? 1.8 : 1), type, ph: this.rand() * 6 })));
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
      this.updateTower(dt, wdt, s);
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
            this.ents.push(this.maybePower(mk({ word: w, x, y, fuse: f, total: f, type }))); break;
          }
        }
      }
      for (const e of this.ents.slice()) {
        e.fuse -= wdt;
        if (e.fuse <= 0) {
          // al explotar acelera las mechas de las vecinas
          this.remove(e); const R = (e.type === 'mega' ? 230 : 160) * sc;
          this.ents.forEach(o => { if (Math.hypot(o.x - e.x, o.y - e.y) < R) o.fuse *= 0.5; });
          this.fx.push({ ring: true, x: e.x, y: e.y, r: 10, R, life: 1 });
          this.hurt(e.type === 'mega' ? 2 : 1, e.x, e.y); if (!this.running) return;
        }
      }
    }
    for (const p of this.fx) {
      if (p.ring) { p.life -= dt / 450; p.r = p.R * (1 - p.life); continue; }
      p.x += p.vx * dt / 1000; p.y += p.vy * dt / 1000; p.vy += 90 * dt / 1000; p.life -= dt / 1000 * 1.4;
    }
    this.fx = this.fx.filter(p => p.life > 0);
    for (const f of this.floats) { f.y -= 32 * dt / 1000; f.life -= dt / 1100; }
    this.floats = this.floats.filter(f => f.life > 0);
    for (const l of this.lasers) l.life -= dt / 300;
    this.lasers = this.lasers.filter(l => l.life > 0);
  }

  private updateTower(dt: number, wdt: number, s: number) {
    const sc = this.sc;
    this.banner = Math.max(0, (this.banner || 0) - dt);
    if (this.toSpawn > 0 && this.spawnT <= 0) {
      this.spawnT = Math.max(650, 1700 - this.wave * 70) * this.D.spawn; this.toSpawn--;
      const np = this.paths.length, p = np === 1 ? 0 : (this.lastP = ((this.lastP || 0) + 1 + (this.rand() < .35 ? 1 : 0)) % np);
      const r = this.rand(); let e: Entity;
      if (this.wave >= 3 && r < 0.2) { const ws = [this.pickWord(3, 5), this.pickWord(4, 6)]; e = mk({ words: ws, stage: 0, word: ws[0], v: (22 + this.wave * 2) * sc, type: 'tank' }); }
      else if (this.wave >= 2 && r < 0.45) e = mk({ word: this.pickWord(3, 4), v: (54 + this.wave * 4) * sc, type: 'scout' });
      else e = mk({ word: this.pickWord(3, Math.min(9, 4 + Math.floor(this.wave / 2))), v: (30 + this.wave * 3 + this.rand() * 8) * sc });
      e.p = p; e.v *= this.D.speed; e.id = this.nextId++;
      const roster = this.coopPlayers();
      if (roster.length >= 2 && this.wave >= 2 && this.rand() < 0.3 && !e.words) {
        // bicho doble: una palabra para cada uno de dos jugadores, con su color
        const pair = shuffle(roster, this.rand).slice(0, 2), link = this.nextId++;
        pair.forEach((pl, i) => this.ents.push(mk({ word: this.pickWord(3, 6), v: e.v * 0.8, p, type: 'duo', owner: pl.id, color: pl.color, link, part: i, id: this.nextId++ })));
      } else this.ents.push(this.assignOwner(this.maybePower(e)));
      if (this.toSpawn === 0 && this.boss) {
        // el jefe es una frase de 3 a 6 palabras
        const ph = SENTENCES[Math.floor(this.rand() * SENTENCES.length)].toLowerCase().replace(/[.,]/g, '').split(' ').slice(0, 3 + Math.min(3, Math.floor(this.wave / 5))).join(' ');
        this.ents.push(this.assignOwner(mk({ id: this.nextId++, word: ph, d: -80 * sc, v: 17 * sc * this.D.speed, boss: true, type: 'boss', p: Math.floor(this.rand() * this.paths.length) })));
      }
    }
    if (this.turret) {
      this.turretT -= wdt;
      if (this.turretT <= 0) {
        this.turretT = Math.max(2200, 8000 - this.turret * 1800);
        const tg = this.ents.filter(o => !o.boss && !o.link && o.d >= 0).sort((a, b) => this.prog(b) - this.prog(a))[0];
        if (tg) { const [tx, ty] = this.at(tg.d, tg.p); this.lasers.push({ x1: this.base[0], y1: this.base[1], x2: tx, y2: ty, life: 1 }); tg.words = null; this.kill(tg); }
      }
    }
    const hitLinks = new Set<number>();
    for (const e of this.ents.slice()) {
      e.d += e.v * this.frost * s;
      if (e.d >= this.paths[e.p || 0].len) {
        this.remove(e);
        if (e.link) { if (hitLinks.has(e.link)) continue; hitLinks.add(e.link); this.ents.filter(o => o.link === e.link).forEach(o => this.remove(o)); }
        this.hurt(e.boss ? 3 : e.link ? 2 : 1, this.base[0], this.base[1]); if (!this.running) return;
      }
    }
    if (this.toSpawn === 0 && !this.ents.length && !this.paused && !this.betweenWaves) this.waveDone();
  }

  /* ---------- dibujo ---------- */
  drawBg() {
    const x = this.ctx, W = this.W, H = this.H; if (!W) return;
    x.fillStyle = this.c.bg; x.fillRect(0, 0, W, H);
    x.font = `14px ${FONT}`; x.fillStyle = this.c.soft; x.textBaseline = 'alphabetic'; x.textAlign = 'left';
    const r = rng(7); for (let i = 0; i < 38; i++) x.fillText(['*', '—', '|', '* *', '— —', '|||'][Math.floor(r() * 6)], r() * W, r() * H);
  }
  /** Una palabra en su cajita: lo escrito en color, la letra errada tachada y el resto en tinta. */
  word(e: WordLike, cx: number, cy: number, big?: boolean) {
    const x = this.ctx, fs = Math.round((big ? 16 : this.kind === 'torre' ? 13.5 : 16) * clamp(this.sc, .85, 1.1));
    x.font = `500 ${fs}px ${FONT}`; x.textBaseline = 'middle'; x.textAlign = 'left';
    const w = x.measureText(e.word).width, pad = e.pw ? fs + 4 : 0, left = cx - (w + pad) / 2 + pad, tgt = e === this.target;
    const bx = left - pad - 7, by = cy - fs * .78, bw = w + pad + 14, bh = fs * 1.56;
    x.fillStyle = this.c.bg; x.globalAlpha = .95; this.rr(bx, by, bw, bh, 7); x.fill(); x.globalAlpha = 1;
    const theirs = e.owner && this.mp && e.owner !== this.mp.me;
    if (e.done) x.globalAlpha = .35; else if (theirs) x.globalAlpha = .55;
    x.lineWidth = tgt || (e.color && !theirs) ? 2.5 : e.color ? 1.5 : 1; x.strokeStyle = e.color || (tgt ? this.c.acc : e.coin ? this.c.gold : e.type === 'rapida' ? this.c.err : this.c.dim); this.rr(bx, by, bw, bh, 7); x.stroke();
    if (e.color) { x.fillStyle = e.color; x.beginPath(); x.arc(bx + 1, by + 1, 4, 0, Math.PI * 2); x.fill(); }
    if (e.pw) { x.fillStyle = this.c.acc2; x.beginPath(); x.arc(left - pad / 2 - 2, cy, fs * .52, 0, Math.PI * 2); x.fill(); x.fillStyle = '#fff'; x.textAlign = 'center'; x.font = `600 ${Math.round(fs * .75)}px sans-serif`; x.fillText(POWERS[e.pw].g, left - pad / 2 - 2, cy + 1); x.textAlign = 'left'; x.font = `500 ${fs}px ${FONT}`; }
    const done = e.word.slice(0, e.typed), rest = e.word.slice(e.typed), dw = x.measureText(done).width;
    const badC = this.bad && this.bad.e === e && now() < this.bad.until ? this.bad.c : e.bad && now() < (e.badUntil || 0) ? e.bad : null;
    const restCol = e.boss || e.type === 'rapida' ? this.c.err : e.coin ? this.c.gold : this.c.ink;
    x.fillStyle = this.c.acc; x.fillText(done, left, cy);
    if (badC) {
      const bw2 = x.measureText(badC).width;
      x.fillStyle = this.c.err; x.fillText(badC, left + dw, cy);
      x.strokeStyle = this.c.err; x.lineWidth = 2; x.beginPath(); x.moveTo(left + dw - 1, cy); x.lineTo(left + dw + bw2 + 1, cy); x.stroke();
      x.fillStyle = restCol; x.fillText(rest.slice(1), left + dw + bw2, cy);
    } else {
      x.fillStyle = restCol; x.fillText(rest, left + dw, cy);
    }
    x.globalAlpha = 1;
    if (e.type === 'split') { x.strokeStyle = this.c.acc2; x.setLineDash([3, 3]); x.beginPath(); x.moveTo(left, cy + fs * .62); x.lineTo(left + w, cy + fs * .62); x.stroke(); x.setLineDash([]); }
  }
  /** rectángulo redondeado (solo el trazo; después fill o stroke) */
  rr(x0: number, y0: number, w: number, hh: number, r: number) {
    const x = this.ctx; x.beginPath(); x.moveTo(x0 + r, y0);
    x.arcTo(x0 + w, y0, x0 + w, y0 + hh, r); x.arcTo(x0 + w, y0 + hh, x0, y0 + hh, r); x.arcTo(x0, y0 + hh, x0, y0, r); x.arcTo(x0, y0, x0 + w, y0, r);
    x.closePath();
  }
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
      this.drawTower();
    } else if (this.kind === 'runner') {
      runnerDraw(this);
    } else if (this.kind === 'bombas') {
      for (const e of this.ents) {
        const r = (e.type === 'mega' ? 32 : 24) * sc, k = e.fuse / e.total, col = e.type === 'gold' ? this.c.gold : k < .3 ? this.c.err : this.c.acc;
        const pulse = k < .3 ? 1 + Math.sin(this.t / 60) * .06 : 1;
        x.lineWidth = 4; x.strokeStyle = this.c.soft; x.beginPath(); x.arc(e.x, e.y, r * pulse, 0, Math.PI * 2); x.stroke();
        if (e.type === 'mega') { x.lineWidth = 1.5; x.strokeStyle = this.c.err; x.beginPath(); x.arc(e.x, e.y, r * pulse + 7, 0, Math.PI * 2); x.stroke(); }
        x.lineWidth = 4; x.strokeStyle = col; x.beginPath(); x.arc(e.x, e.y, r * pulse, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); x.stroke();
        x.fillStyle = col; x.font = `800 ${Math.round((e.type === 'mega' ? 22 : 16) * sc)}px ${FONT_BOLD}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('*', e.x, e.y + 1); x.textAlign = 'left';
        this.word(e, e.x, e.y + r + 16 * sc);
      }
    }
    x.textAlign = 'center'; x.textBaseline = 'middle';
    for (const p of this.fx) {
      if (p.ring) { x.globalAlpha = Math.max(0, p.life); x.strokeStyle = this.c.err; x.lineWidth = 3; x.beginPath(); x.arc(p.x, p.y, p.r, 0, Math.PI * 2); x.stroke(); continue; }
      x.globalAlpha = Math.max(0, p.life); x.fillStyle = p.col; x.font = `700 ${Math.round(15 * sc)}px ${FONT_BOLD}`; x.fillText(p.ch, p.x, p.y);
    }
    for (const f of this.floats) {
      x.globalAlpha = Math.min(1, f.life * 1.6); x.fillStyle = f.col; x.font = `800 ${Math.round(f.size * clamp(sc, .8, 1.1))}px ${FONT_BOLD}`; x.fillText(f.text, f.x, f.y);
      if (f.strike) { const w2 = x.measureText(f.text).width / 2 + 3; x.strokeStyle = f.col; x.lineWidth = 2.5; x.beginPath(); x.moveTo(f.x - w2, f.y); x.lineTo(f.x + w2, f.y); x.stroke(); }
    }
    x.globalAlpha = 1; x.textAlign = 'left';
    x.restore();
    if (this.freezeT > 0) { x.fillStyle = this.c.acc2; x.globalAlpha = .12; x.fillRect(0, 0, W, H); x.globalAlpha = 1; this.badge(`❄ ${(this.freezeT / 1000).toFixed(1)}s`, W / 2, 20); }
    else if (this.slowT > 0) this.badge(`◷ cámara lenta ${(this.slowT / 1000).toFixed(1)}s`, W / 2, 20);
    if (this.fever) { const a = .45 + Math.sin(this.t / 140) * .25; x.globalAlpha = a; x.strokeStyle = this.c.acc2; x.lineWidth = 6; x.strokeRect(3, 3, W - 6, H - 6); x.globalAlpha = 1; this.badge('fiebre x2', W - 60, 20); }
    if (this.flash > 0) { x.globalAlpha = this.flash / 1000; x.fillStyle = this.c.err; x.fillRect(0, 0, W, H); x.globalAlpha = 1; }
  }
  private drawTower() {
    const x = this.ctx, W = this.W, H = this.H, sc = this.sc;
    const trace = (pth: TdPath) => { x.beginPath(); pth.segs.forEach((s, i) => { if (!i) x.moveTo(s.x1, s.y1); x.lineTo(s.x2, s.y2); }); x.stroke(); };
    x.strokeStyle = this.c.soft; x.lineWidth = 18 * sc; x.lineCap = 'round'; x.lineJoin = 'round'; this.paths.forEach(trace);
    x.lineWidth = 2; x.setLineDash([8, 8]); x.strokeStyle = this.c.dim; this.paths.forEach(trace); x.setLineDash([]);
    if (this.paths.length > 1) { x.font = `600 ${Math.round(11 * sc)}px ${FONT}`; x.fillStyle = this.c.acc2; x.textBaseline = 'middle'; x.textAlign = 'left'; this.paths.forEach((pth, i) => x.fillText('›› ' + 'ABC'[i], 6, pth.start[1] - 16 * sc)); }
    const [bx, by] = this.base, bs = 32 * sc;
    x.fillStyle = this.c.soft; x.strokeStyle = this.c.acc; x.lineWidth = 2; this.rr(bx - bs / 2, by - bs / 2, bs, bs, 6); x.fill(); x.stroke();
    x.fillStyle = this.c.acc; x.font = `800 ${Math.round(22 * sc)}px ${FONT_BOLD}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('*', bx, by + 2);
    if (this.turret) { x.font = `600 ${Math.round(11 * sc)}px ${FONT}`; x.fillStyle = this.c.acc2; x.fillText('torreta ' + '|'.repeat(this.turret), bx, by + bs * .9); }
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
      this.word(e, ex, ey - (19 + (e.link ? (e.part || 0) * 24 : 0)) * clamp(sc, .8, 1.1), e.boss);
    }
    if (this.banner > 0) { x.globalAlpha = Math.min(1, this.banner / 500); x.fillStyle = this.c.acc; x.font = `800 ${Math.round(26 * sc)}px ${FONT_BOLD}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(this.boss ? `oleada ${this.wave} · ¡jefe!` : `oleada ${this.wave}`, W / 2, H * .5); x.textAlign = 'left'; x.globalAlpha = 1; }
  }
  private badge(text: string, cx: number, cy: number) {
    const x = this.ctx; x.font = `600 12px ${FONT}`; const w = x.measureText(text).width + 18;
    x.fillStyle = this.c.acc; this.rr(cx - w / 2, cy - 11, w, 22, 11); x.fill();
    x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, cx, cy + 1); x.textAlign = 'left';
  }

  /* ---------- misiones, HUD y fin ---------- */
  private checkMissions() {
    const ms = ARC[this.kind].missions, done = this.missionsDone(); let changed = false;
    ms.forEach((m, i) => {
      if (this.runMis[i] || !m.ok(this)) return;
      this.runMis[i] = true;
      if (!done[i]) { done[i] = true; changed = true; this.newMis = this.newMis || []; this.newMis[i] = true; Sfx.mission(); this.float(this.W / 2, this.H * .22, '★ misión: ' + m.t, this.c.acc, 16); }
    });
    if (changed) store.set(this.misKey(), done);
  }
  private wpm() { return Math.round(this.t > 1000 ? this.chars / 5 / (this.t / 60000) : 0); }
  private accuracy() { return this.keys ? Math.round(this.hits / this.keys * 100) : 100; }
  private hudState(): HudState {
    return {
      score: this.score || 0,
      levelLabel: this.kind === 'torre' ? 'oleada' : this.kind === 'runner' ? 'metros' : 'nivel',
      level: this.kind === 'torre' ? this.wave || 0 : this.kind === 'runner' ? Math.round(this.dist || 0) : this.level || 1,
      lives: this.running || this.t ? (this.lives > 8 ? `* ×${this.lives}` : '* '.repeat(Math.max(0, this.lives || 0)).trim() || '—') : '',
      wpm: this.wpm(),
      acc: this.accuracy() + '%',
      combo: 'x' + (this.combo || 0) + (this.fever ? ' · fiebre' : ''), hot: !!this.fever,
      best: Math.max(store.get(this.bestKey(), 0), this.overBest || 0),
    };
  }
  private hud(force = false) {
    const st = this.hudState(), key = JSON.stringify(st);
    if (force || key !== this.lastHud) { this.lastHud = key; this.ui.hud?.(st); }
    if (this.running && !this.mp) this.checkMissions();
    this.emitFever(!!(this.running && this.fever));
  }
  private over() {
    if (this.mp) {
      this.running = false; cancelAnimationFrame(this.raf); this.emitFever(false); this.draw(); Sfx.over(); this.recordRun(true);
      this.mp.onStatus?.({ lives: 0, score: this.score, level: this.levelValue(), alive: false });
      if (this.mp.coop) { const sum = { coop: true, score: this.score, wave: this.wave }; this.mp.onEnd?.(sum); this.endRemote(sum); }
      else { this.mp.onDead?.({ score: this.score }); this.show({ kind: 'mpOut', score: this.score }); }
      return;
    }
    this.running = false; cancelAnimationFrame(this.raf); this.checkMissions(); this.draw(); this.hud(); Sfx.over();
    const best = store.get(this.bestKey(), 0), rec = this.score > best;
    this.recordRun(true); if (rec && this.score > 0) celebrate('record');
    this.overBest = Math.max(best, this.score); this.hud(true); this.ui.changed?.();
    const where = this.kind === 'torre' ? `llegaste a la oleada ${this.wave}` : this.kind === 'runner' ? `corriste ${Math.round(this.dist)} metros · ${this.coins} monedas` : `llegaste al nivel ${this.level}`;
    const fresh = this.newMis; this.newMis = null;
    this.show({
      kind: 'over', rec, where, fresh, cloud: History.mode === 'cloud',
      stats: `${this.kills} palabras · combo máximo ${this.maxCombo} · ${this.wpm()} ppm · ${this.accuracy()}% precisión`,
    });
  }
}
