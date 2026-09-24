// @ts-nocheck — mismo estilo que arcade.ts (canvas imperativo)
/* =========================================================
   RUNNER · persecución por carriles
   - el motor es el tipeo: el texto de abajo, cada letra correcta es un paso
   - una ola te persigue; si te alcanza perdés una vida
   - tres carriles; los obstáculos cambian: roca (quieta), carga (viene hacia vos), muro (ocupa dos carriles)
   - cuando se acerca un obstáculo, los carriles libres muestran una palabra: escribila para cambiarte
   - tipear parejo sube el ritmo (más velocidad y más puntos)
   - cada 500 m elegís el tramo: difícil (puntos x2) o seguro
   Se engancha a la clase Arcade (usa sus colores, efectos, vidas y HUD).
   ========================================================= */
import { clamp } from '@/lib/tecla/utils';
import { VOCAB } from '@/lib/tecla/data/words';
import { Sfx } from '@/lib/tecla/sfx';

const M_PER_CPS = 1.3;      // metros por segundo por cada letra/s
const GAP0 = 20, GAP_MAX = 35, TRAMO_M = 500;
export const RUNNER_OBS = {
  roca: { name: 'roca', desc: 'se queda quieta' },
  carga: { name: 'carga', desc: 'viene hacia vos' },
  muro: { name: 'muro', desc: 'ocupa dos carriles' },
};
const TRAMOS = {
  normal: { name: 'tramo inicial', mult: 1, spacing: 1, mix: [60, 20, 20], chase: 0 },
  seguro: { name: 'tramo seguro', mult: 1, spacing: 1.3, mix: [70, 15, 15], chase: 0 },
  dificil: { name: 'tramo difícil', mult: 2, spacing: 0.68, mix: [30, 40, 30], chase: 0.3 },
};

/* ---------- palabras ---------- */
const short = (g, avoid = '') => {
  const pool = VOCAB.facil.filter(w => w.length >= 3 && w.length <= 5);
  for (let i = 0; i < 40; i++) { const w = pool[Math.floor(g.rand() * pool.length)]; if (!avoid.includes(w[0])) return w; }
  return pool[Math.floor(g.rand() * pool.length)];
};
function fillTape(g) {
  while (g.tape.length - g.si < 18) g.tape.push({ w: g.pickWord(3, Math.min(8, 4 + Math.floor(g.level / 2))), err: false });
  if (g.si > 30) { g.tape.splice(0, 20); g.si -= 20; }
}
const nextTapeChars = g => { const wd = g.tape[g.si]; return (wd ? wd.w.slice(g.ci) : '') + ' ' + (g.tape[g.si + 1]?.w || ''); };

/* ---------- inicio ---------- */
function layout(g) {
  const top = g.H * 0.13, laneH = g.H * 0.17;
  g.laneTop = top; g.laneH = laneH; g.px = g.W * 0.3;
  g.laneCenter = l => top + laneH * (l + 0.5);
}
export function runnerStart(g) {
  layout(g);
  Object.assign(g, {
    tape: [], si: 0, ci: 0, gap: GAP0, cps: 0, recent: [], beats: [], ritmo: 0, grace: 1600,
    chaseCps: 2.4 * g.D.speed, lane: 1, laneY: 1, laneWords: null, laneTarget: null, choice: null,
    tramo: 'normal', nextFork: TRAMO_M, nextObs: 14, dodged: 0, runPh: 0, rivals: g.rivals || [],
  });
  g.mult = 1; fillTape(g);
}

/* ---------- teclado ---------- */
export function runnerChar(g, c) {
  g.keys++;
  // elegir tramo
  if (g.choice) {
    const ch = g.choice;
    if (!ch.target) { ch.target = ch.opts.find(o => o.w[0] === c) || null; if (!ch.target) return g.miss(); ch.i = 0; }
    if (ch.target.w[ch.i] === c) { ch.i++; g.hits++; Sfx.key(); if (ch.i >= ch.target.w.length) pickTramo(g, ch.target.kind); }
    else g.miss();
    return;
  }
  // cambiando de carril (el texto queda en pausa hasta terminar la palabra)
  if (g.laneTarget) {
    const t = g.laneTarget;
    // las letras de la palabra de carril también empujan: cualquier tipeo correcto es motor
    if (t.w[t.i] === c) { t.i++; step(g); if (t.i >= t.w.length) moveLane(g, t.lane); }
    else g.miss();
    return;
  }
  if (g.laneWords) {
    const lw = g.laneWords.find(o => o.w[0] === c);
    if (lw) { g.laneTarget = { ...lw, i: 1 }; step(g); if (lw.w.length === 1) moveLane(g, lw.lane); return; }
  }
  // el texto: cada letra correcta es un paso
  const wd = g.tape[g.si], expect = g.ci < wd.w.length ? wd.w[g.ci] : ' ';
  if (c !== expect) { wd.err = true; g.miss(); g.gap -= 0.8; g.stumble = 1; return; }
  step(g);
  if (expect === ' ') { g.si++; g.ci = 0; fillTape(g); return; }
  g.ci++;
  if (g.ci >= wd.w.length) wordDone(g, wd);
}
// una letra correcta: un paso del corredor y un golpe de ritmo
function step(g) {
  g.hits++; g.chars++; g.recent.push(g.t); g.beats.push(g.t); if (g.beats.length > 14) g.beats.shift();
  g.runPh += 1; Sfx.key();
}
export function runnerBack(g) {
  if (g.choice) { g.choice.target = null; return; }
  if (g.laneTarget) { g.laneTarget = null; }
}
function wordDone(g, wd) {
  g.kills++;
  if (wd.err) { g.combo = 0; } else { g.combo++; g.maxCombo = Math.max(g.maxCombo, g.combo); }
  const pts = Math.round(wd.w.length * 8 * (1 + Math.min(g.combo, 30) * 0.05) * g.mult * (1 + g.ritmo * 0.25) * (g.fever ? 2 : 1) * g.D.pts);
  g.score += pts;
  g.float(g.px + 40, g.laneTop - 8, '+' + pts, g.c.acc, 13);
  if (!g.fever && g.combo >= 10) { g.fever = true; Sfx.fever(); g.float(g.W / 2, g.H * .3, '¡fiebre! puntos x2', g.c.acc, 22); }
  g.level = 1 + Math.floor(g.dist / 150);
}
function moveLane(g, lane) {
  g.lane = lane; g.laneTarget = null; g.laneWords = null;
  g.score += Math.round(30 * g.mult * g.D.pts); Sfx.seq([520, 780], 50);
}
function pickTramo(g, kind) {
  g.choice = null; g.tramo = kind; const T = TRAMOS[kind];
  g.mult = T.mult; g.chaseCps += 0.15 + T.chase; g.grace = 1400; g.recent = []; g.nextObs = g.dist + 14;
  g.banner = { text: kind === 'dificil' ? 'tramo difícil · puntos x2' : 'tramo seguro', life: 1 };
  Sfx.power();
}

/* ---------- lógica por cuadro ---------- */
export function runnerUpdate(g, dt, wdt) {
  const s = wdt / 1000;
  if (g.banner) { g.banner.life -= dt / 1800; if (g.banner.life <= 0) g.banner = null; }
  g.stumble = Math.max(0, (g.stumble || 0) - dt / 300);
  g.laneY += (g.lane - g.laneY) * Math.min(1, dt / 90);

  // elegir tramo: el mundo se congela (con tiempo límite; si no elegís, va el seguro)
  if (g.choice) { g.choice.t -= dt; if (g.choice.t <= 0) pickTramo(g, 'seguro'); return true; }

  // velocidad = tu ritmo de tipeo de los últimos 2 s
  g.recent = g.recent.filter(t => g.t - t < 2000);
  const inst = g.recent.length / clamp(g.t / 1000, 0.6, 2);
  g.cps += (inst - g.cps) * Math.min(1, dt / 300);
  g.ritmo = rhythm(g);
  const speed = g.cps * M_PER_CPS * (1 + g.ritmo * 0.05);
  g.speed = speed;
  g.dist += speed * s;
  // la ola acelera sola con el tiempo (~4 ppm por minuto) y además en cada tramo
  g.chaseCps += 0.006 * s * g.D.speed;
  if (g.grace > 0) g.grace -= dt;
  else g.gap = Math.min(GAP_MAX, g.gap + (speed - g.chaseCps * M_PER_CPS) * s);

  // la ola te alcanzó
  if (g.gap <= 0) {
    g.hurt(1, g.px, g.laneCenter(g.laneY)); if (!g.running) return false;
    g.gap = 14; g.grace = 800; g.float(g.W / 2, g.H * .3, '¡te alcanzó la ola!', g.c.err, 20);
  }
  // hitos y tramos
  if (g.dist >= g.milestone) { g.float(g.W / 2, g.laneTop - 4, `${g.milestone} m`, g.c.acc, 18); Sfx.seq([660, 990], 80); g.milestone += 100; }
  if (g.dist >= g.nextFork) { g.nextFork += TRAMO_M; openChoice(g); return true; }

  spawn(g);
  // obstáculos y monedas
  for (const o of g.ents.slice()) {
    if (o.v) o.m -= o.v * s;
    const rel = o.m - g.dist;
    if (!o.passed && rel <= 0.6) {
      o.passed = true;
      if (o.coin) { if (o.lanes.includes(g.lane)) { g.coins++; g.score += Math.round(80 * g.mult * g.D.pts); g.float(g.px, g.laneCenter(g.lane) - 30, '+1 moneda', g.c.gold, 13); Sfx.seq([990, 1320], 60); g.remove(o); } continue; }
      if (o.lanes.includes(g.lane)) {
        o.hit = true; g.gap -= 6; g.combo = 0; g.flash = 260; g.shake = 260; Sfx.hurt(); g.fever = false;
        g.burst(g.px + 10, g.laneCenter(g.lane), 12, g.c.err); g.float(g.px, g.laneCenter(g.lane) - 34, '¡golpe!', g.c.err, 15);
      } else { g.jumps++; g.dodged++; const p = Math.round(60 * g.mult * g.D.pts); g.score += p; g.float(g.px + 18, g.laneCenter(g.lane) - 30, '+' + p, g.c.acc2, 12); }
    }
    if (rel < -14) g.remove(o);
  }
  // amenaza en mi carril: mostrar las palabras de los carriles libres
  const threat = g.ents.filter(o => !o.coin && !o.passed && o.lanes.includes(g.lane) && (o.m - g.dist < 24 || (o.v && (o.m - g.dist) / (speed + o.v + 0.01) < 3.2)))
    .sort((a, b) => a.m - b.m)[0];
  if (threat && !g.laneTarget) {
    // carriles libres de verdad: nada desde acá hasta un poco después de la amenaza
    const blocked = l => g.ents.some(o => !o.coin && !o.passed && o.lanes.includes(l) && o.m - g.dist > -0.5 && o.m <= threat.m + 10);
    const free = [0, 1, 2].filter(l => l !== g.lane && !blocked(l));
    const prev = new Map((g.laneWords || []).map(o => [o.lane, o.w]));
    let avoid = nextTapeChars(g).slice(0, 3) + [...prev.values()].map(w => w[0]).join('');
    // se conservan las palabras de los carriles que siguen libres (no cambian mientras las leés)
    g.laneWords = free.length ? free.map(l => { if (prev.has(l)) return { lane: l, w: prev.get(l) }; const w = short(g, avoid); avoid += w[0]; return { lane: l, w }; }) : null;
  } else if (!threat && !g.laneTarget) g.laneWords = null;
  g.level = 1 + Math.floor(g.dist / 150);
  return true;
}
function rhythm(g) {
  const b = g.beats; if (b.length < 8 || g.t - b[b.length - 1] > 700) return 0;
  const iv = []; for (let i = 1; i < b.length; i++) iv.push(b[i] - b[i - 1]);
  const m = iv.reduce((a, x) => a + x, 0) / iv.length; if (m > 450) return 0;
  const sd = Math.sqrt(iv.reduce((a, x) => a + (x - m) ** 2, 0) / iv.length), cv = sd / m;
  return cv < 0.22 ? 3 : cv < 0.3 ? 2 : cv < 0.42 ? 1 : 0;
}
function openChoice(g) {
  const a = short(g), b = short(g, a[0]);
  g.choice = { t: 9000, target: null, i: 0, opts: [{ kind: 'dificil', w: a }, { kind: 'seguro', w: b }] };
  g.laneWords = null; g.laneTarget = null; g.floats = []; Sfx.seq([440, 660, 880], 70);
}
function spawn(g) {
  const T = TRAMOS[g.tramo];
  while (g.dist + 55 >= g.nextObs) {
    const at = g.nextObs, r = g.rand() * 100, [pr, pc] = T.mix;
    const kind = r < pr ? 'roca' : r < pr + pc ? 'carga' : 'muro';
    let lanes;
    if (kind === 'muro') lanes = g.rand() < 0.5 ? [0, 1] : [1, 2];
    else lanes = [Math.floor(g.rand() * 3)];
    const o = { kind, lanes, m: at, word: '', v: kind === 'carga' ? (2.6 + g.rand() * 1.6 + (g.tramo === 'dificil' ? 1 : 0)) * g.D.speed : 0 };
    g.ents.push(o);
    const spacing = (17 - Math.min(6, g.level)) * T.spacing * (0.8 + g.rand() * 0.5);
    if (g.rand() < 0.35) { const free = [0, 1, 2].filter(l => !lanes.includes(l)); g.ents.push({ coin: true, lanes: [free[Math.floor(g.rand() * free.length)]], m: at + spacing / 2, word: '' }); }
    g.nextObs = at + spacing;
  }
}

/* ---------- dibujo ---------- */
export function runnerDraw(g) {
  const x = g.ctx, W = g.W, H = g.H, sc = g.sc, c = g.c;
  layout(g);
  const top = g.laneTop, laneH = g.laneH;
  const px = g.px, pxm = (W - px) / 48, gapPx = px / 24;

  // fondo que se desplaza
  x.fillStyle = c.soft; x.font = `20px "Martian Mono", monospace`; x.textBaseline = 'middle'; x.textAlign = 'left';
  for (let i = 0; i < 7; i++) { const cx = ((i * 170 - g.dist * 7) % (W + 140) + W + 140) % (W + 140) - 70; x.fillText(['* — —', '| | |', '— * —'][i % 3], cx, H * 0.08 + (i % 2) * 6); }
  // carriles
  for (let l = 0; l < 3; l++) {
    const y0 = top + laneH * l;
    x.fillStyle = l % 2 ? c.bg : c.soft; x.fillRect(0, y0, W, laneH);
    x.strokeStyle = c.dim; x.lineWidth = 1.5; x.setLineDash([14, 12]); x.lineDashOffset = (g.dist * pxm) % 26;
    x.beginPath(); x.moveTo(0, y0); x.lineTo(W, y0); x.stroke();
  }
  x.beginPath(); x.moveTo(0, top + laneH * 3); x.lineTo(W, top + laneH * 3); x.stroke(); x.setLineDash([]); x.lineDashOffset = 0;

  // obstáculos y monedas
  for (const o of g.ents) {
    const ox = px + (o.m - g.dist) * pxm; if (ox < -40 || ox > W + 60) continue;
    if (o.coin) {
      const cy = g.laneCenter(o.lanes[0]) + Math.sin(g.t / 200 + o.m) * 3;
      x.fillStyle = c.gold; x.beginPath(); x.arc(ox, cy, 9 * sc, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#fff'; x.font = `800 ${Math.round(11 * sc)}px "Martian Mono", monospace`; x.textAlign = 'center'; x.fillText('*', ox, cy + 1); x.textAlign = 'left';
      continue;
    }
    x.globalAlpha = o.hit ? 0.35 : 1;
    if (o.kind === 'muro') {
      const y0 = top + laneH * o.lanes[0] + 5, hh = laneH * 2 - 10, w = 22 * sc;
      x.fillStyle = c.sub; g.rr(ox - w / 2, y0, w, hh, 5); x.fill();
      x.strokeStyle = c.bg; x.lineWidth = 1.5; for (let k = 1; k < 7; k++) { const yy = y0 + hh * k / 7; x.beginPath(); x.moveTo(ox - w / 2, yy); x.lineTo(ox + w / 2, yy); x.stroke(); }
    } else if (o.kind === 'carga') {
      const cy = g.laneCenter(o.lanes[0]), s = 15 * sc;
      x.fillStyle = c.err; x.beginPath(); x.moveTo(ox - s, cy); x.lineTo(ox + s * .6, cy - s * .8); x.lineTo(ox + s * .6, cy + s * .8); x.closePath(); x.fill();
      x.strokeStyle = c.err; x.globalAlpha *= .45; x.lineWidth = 2; for (let k = 0; k < 3; k++) { x.beginPath(); x.moveTo(ox + s + 4 + k * 7, cy - 6 + k * 6); x.lineTo(ox + s + 14 + k * 7, cy - 6 + k * 6); x.stroke(); }
    } else {
      const cy = g.laneCenter(o.lanes[0]), s = 17 * sc;
      x.fillStyle = c.sub; g.rr(ox - s / 2, cy - s / 2, s, s, 6); x.fill();
      x.fillStyle = c.bg; x.fillRect(ox - s * .15, cy - s * .3, s * .12, s * .12);
    }
    x.globalAlpha = 1;
  }

  // la ola
  const wx = px - g.gap * gapPx;
  if (wx > -30) {
    const g0 = x.createLinearGradient(Math.max(0, wx - 90), 0, wx, 0); g0.addColorStop(0, 'transparent'); g0.addColorStop(1, c.err);
    x.globalAlpha = .14; x.fillStyle = g0; x.fillRect(0, top, Math.max(0, wx), laneH * 3); x.globalAlpha = 1;
    x.fillStyle = c.err; x.font = `800 ${Math.round(16 * sc)}px "Martian Mono", monospace`; x.textAlign = 'center';
    for (let k = 0; k < 9; k++) { const yy = top + laneH * 3 * (k + .5) / 9; x.fillText('*', wx + Math.sin(g.t / 120 + k) * 5, yy); }
    x.textAlign = 'left';
  } else {
    x.fillStyle = c.err; x.font = `600 ${Math.round(11 * sc)}px "IBM Plex Mono", monospace`; x.fillText(`« ola a ${Math.round(g.gap)} m`, 8, top + laneH * 1.5);
  }

  // corredor
  const ry = top + laneH * (g.laneY + 0.5);
  drawRunner(g, px, ry + laneH * 0.32, sc * 0.9);

  // palabras de carril
  if (g.laneWords) for (const lw of g.laneWords) {
    const cy = g.laneCenter(lw.lane), typed = g.laneTarget && g.laneTarget.lane === lw.lane ? g.laneTarget.i : 0;
    const arrow = lw.lane < g.lane ? '↑' : '↓';
    x.fillStyle = c.acc; x.font = `700 ${Math.round(14 * sc)}px "Martian Mono", monospace`; x.textAlign = 'center'; x.fillText(arrow, px - 26 * sc, cy); x.textAlign = 'left';
    g.word({ word: lw.w, typed, color: c.acc }, px + 10 * sc, cy, false);
  }

  // cinta de texto (el motor)
  drawTape(g, top + laneH * 3 + 14 * sc);

  // HUD: ola, ritmo, tramo, rivales
  const bw = Math.min(170, W * 0.22), k = clamp(g.gap / GAP_MAX, 0, 1);
  x.font = `600 ${Math.round(11 * clamp(sc, .85, 1.1))}px "IBM Plex Mono", monospace`; x.textBaseline = 'middle';
  x.fillStyle = c.sub; x.fillText('ola', 10, 16);
  x.fillStyle = c.soft; g.rr(38, 11, bw, 10, 5); x.fill();
  x.fillStyle = k < .3 ? c.err : k < .55 ? c.gold : c.ok; g.rr(38, 11, bw * k, 10, 5); x.fill();
  x.fillStyle = c.sub; x.fillText(`${Math.round(g.gap)} m · vos ${Math.round(g.cps * 12)} ppm · ola ${Math.round(g.chaseCps * 12)} ppm`, 46 + bw, 16);
  // segunda línea: ritmo y tramo (arriba a la derecha va el cartel de fiebre)
  x.fillStyle = c.acc; x.fillText('ritmo ' + '●'.repeat(g.ritmo) + '○'.repeat(3 - g.ritmo), 10, 34);
  x.fillStyle = g.tramo === 'dificil' ? c.err : c.sub; x.fillText(`· ${TRAMOS[g.tramo].name}${g.mult > 1 ? ' x' + g.mult : ''}`, 10 + x.measureText('ritmo ●●● ').width, 34);
  if (g.rivals?.length) drawRivals(g, 36);

  if (g.banner) { x.globalAlpha = Math.min(1, g.banner.life * 2); x.fillStyle = g.tramo === 'dificil' ? c.err : c.acc; x.font = `800 ${Math.round(22 * sc)}px "Martian Mono", monospace`; x.textAlign = 'center'; x.fillText(g.banner.text, W / 2, top + laneH * 1.5); x.textAlign = 'left'; x.globalAlpha = 1; }
  if (g.choice) drawChoice(g);
}

function drawRunner(g, px, py, sc) {
  const x = g.ctx, ph = g.runPh * 0.9 + g.t / 400, st = g.stumble || 0;
  x.save(); x.translate(px, py); x.rotate(st * 0.35);
  x.strokeStyle = g.c.acc; x.fillStyle = g.c.acc; x.lineWidth = 2.6; x.lineCap = 'round';
  x.beginPath(); x.arc(0, -34 * sc, 6.5 * sc, 0, Math.PI * 2); x.fill();
  const lg = Math.sin(ph), ar = Math.cos(ph);
  x.beginPath(); x.moveTo(0, -27 * sc); x.lineTo(0, -12 * sc);
  x.moveTo(0, -12 * sc); x.lineTo(lg * 8 * sc, 0); x.moveTo(0, -12 * sc); x.lineTo(-lg * 8 * sc, 0);
  x.moveTo(0, -23 * sc); x.lineTo(ar * 8 * sc, -16 * sc); x.moveTo(0, -23 * sc); x.lineTo(-ar * 8 * sc, -16 * sc); x.stroke();
  if (g.ritmo >= 2 || g.fever) { x.globalAlpha = .5; x.strokeStyle = g.c.acc2; for (let i = 1; i <= 3; i++) { x.beginPath(); x.moveTo(-12 - i * 9, -30 * sc + i * 5); x.lineTo(-22 - i * 9, -30 * sc + i * 5); x.stroke(); } x.globalAlpha = 1; }
  x.restore();
}

function drawTape(g, y0) {
  const x = g.ctx, W = g.W, c = g.c, fs = Math.round(19 * clamp(g.sc, .8, 1.15));
  const bandH = Math.max(fs * 2.2, g.H - y0 - 8);
  x.fillStyle = c.soft; g.rr(8, y0, W - 16, bandH, 12); x.fill();
  x.font = `500 ${fs}px "IBM Plex Mono", ui-monospace, monospace`; x.textBaseline = 'middle'; x.textAlign = 'left';
  const cw = x.measureText('m').width, cx = W * 0.3, cy = y0 + bandH / 2;
  const paused = !!(g.laneTarget || g.choice);
  // posición (en letras) del comienzo de cada palabra respecto del cursor
  const start = {}; start[g.si] = -g.ci;
  for (let i = g.si - 1; i >= Math.max(0, g.si - 6); i--) start[i] = start[i + 1] - 1 - g.tape[i].w.length;
  for (let i = g.si + 1; i < g.tape.length; i++) start[i] = start[i - 1] + g.tape[i - 1].w.length + 1;
  x.save(); x.beginPath(); x.rect(14, y0, W - 28, bandH); x.clip();
  for (let i = Math.max(0, g.si - 6); i < g.tape.length; i++) {
    const wd = g.tape[i], sx = cx + start[i] * cw; if (sx > W) break; if (sx + wd.w.length * cw < 0) continue;
    for (let j = 0; j < wd.w.length; j++) {
      const px = sx + j * cw, past = i < g.si || (i === g.si && j < g.ci);
      const fade = past ? clamp(1 - (cx - px) / (W * 0.3), .15, 1) : 1;
      x.globalAlpha = fade * (paused && !past ? .45 : 1);
      x.fillStyle = past ? (wd.err ? c.err : c.acc) : i === g.si && wd.err ? c.err : c.ink;
      x.fillText(wd.w[j], px, cy);
    }
  }
  x.globalAlpha = 1;
  // cursor
  const blink = paused ? .3 : .6 + Math.sin(g.t / 160) * .4;
  x.globalAlpha = blink; x.fillStyle = c.acc; x.fillRect(cx - 1, cy + fs * .62, cw, 2.5); x.globalAlpha = 1;
  x.restore();
  if (paused) { x.fillStyle = c.sub; x.font = `600 ${Math.round(11 * clamp(g.sc, .85, 1.1))}px "IBM Plex Mono", monospace`; x.fillText(g.choice ? 'elegí el tramo' : 'cambiando de carril… (⌫ cancela)', 20, y0 + 12); }
}

function drawRivals(g, y) {
  const x = g.ctx, W = g.W, c = g.c, x0 = W * 0.36, x1 = W * 0.64, mid = (x0 + x1) / 2, span = 120;
  x.strokeStyle = c.dim; x.lineWidth = 1.5; x.beginPath(); x.moveTo(x0, y); x.lineTo(x1, y); x.stroke();
  x.fillStyle = c.acc; x.beginPath(); x.arc(mid, y, 5, 0, Math.PI * 2); x.fill();
  x.font = `600 10px "IBM Plex Mono", monospace`; x.textAlign = 'center';
  for (const r of g.rivals) {
    r.shown = r.shown == null ? r.dist : r.shown + (r.dist - r.shown) * 0.08;
    const d = r.shown - g.dist, rx = clamp(mid + d / span * (x1 - x0) / 2, x0, x1);
    x.globalAlpha = r.alive ? 1 : .35; x.fillStyle = r.color || c.sub;
    x.beginPath(); x.arc(rx, y, 4.5, 0, Math.PI * 2); x.fill();
    x.fillText((r.name || '').slice(0, 10) + (Math.abs(d) > span ? (d > 0 ? ' »' : ' «') : ''), rx, y - 10);
  }
  x.globalAlpha = 1; x.textAlign = 'left';
}

function drawChoice(g) {
  const x = g.ctx, W = g.W, H = g.H, c = g.c, ch = g.choice, sc = clamp(g.sc, .8, 1.1);
  x.globalAlpha = .82; x.fillStyle = c.bg; x.fillRect(0, 0, W, H); x.globalAlpha = 1;
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = c.ink; x.font = `800 ${Math.round(20 * sc)}px "Martian Mono", monospace`; x.fillText(`${Math.round(g.dist)} m · elegí el próximo tramo`, W / 2, H * 0.2);
  x.fillStyle = c.sub; x.font = `500 ${Math.round(12 * sc)}px "IBM Plex Mono", monospace`; x.fillText(`escribí la palabra · ${Math.ceil(ch.t / 1000)} s (si no, va el seguro)`, W / 2, H * 0.2 + 24 * sc);
  const cards = [
    { o: ch.opts[0], title: 'difícil · puntos x2', lines: ['más obstáculos, más cargas', 'la ola acelera más'], col: c.err },
    { o: ch.opts[1], title: 'seguro · puntos x1', lines: ['menos obstáculos', 'la ola acelera poco'], col: c.ok },
  ];
  const cw = Math.min(260, W * 0.36), chh = H * 0.42, gap = 24;
  cards.forEach((cd, i) => {
    const cx = W / 2 + (i ? gap / 2 : -gap / 2 - cw), cy = H * 0.34;
    const on = ch.target === cd.o;
    x.fillStyle = c.bg; g.rr(cx, cy, cw, chh, 14); x.fill();
    x.strokeStyle = on ? cd.col : c.line || c.dim; x.lineWidth = on ? 3 : 1.5; g.rr(cx, cy, cw, chh, 14); x.stroke();
    x.fillStyle = cd.col; x.font = `800 ${Math.round(15 * sc)}px "Martian Mono", monospace`; x.fillText(cd.title, cx + cw / 2, cy + chh * 0.18);
    x.fillStyle = c.sub; x.font = `500 ${Math.round(12 * sc)}px "IBM Plex Mono", monospace`;
    cd.lines.forEach((l, k) => x.fillText(l, cx + cw / 2, cy + chh * (0.36 + k * 0.13)));
    x.textAlign = 'left';
    g.word({ word: cd.o.w, typed: on ? ch.i : 0, color: cd.col }, cx + cw / 2, cy + chh * 0.78, true);
    x.textAlign = 'center';
  });
  x.textAlign = 'left';
}
