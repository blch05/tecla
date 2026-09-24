// @ts-nocheck — módulo portado del prototipo; pendiente de tipar (ver README)
import { $, $$, h, now, rand, rng, shuffle, store, toast, todayKey } from '@/lib/tecla/utils';
import { BOT_NAMES, VOCAB, compVocab, passage, wordGen } from '@/lib/tecla/data/words';
import { TypeBox } from '@/lib/tecla/typebox';
import { Bot, botBase, countdown, diffMul, makeLanes, ord } from '@/lib/tecla/views/shared';
import { setConsumer } from '@/lib/tecla/input';
import { History } from '@/lib/tecla/history';

/* =========================================================
   Juegos de competir contra bots (carrera, battle royale, ataque, tira y afloja, desafío diario).
   Cada juego dibuja su arena dentro de "area" y avisa el final con api.end(resultado);
   la pantalla previa, las pestañas y el panel del final son de React (components/views/CompeteView).
   ========================================================= */
export interface EndResult { title: string; lines: string[]; share?: string; daily?: { day: string; wpm: number; acc: number } }
export interface GameApi { again: () => void; end: (r: EndResult) => void }
export const Race: any = {
  id: 'race', name: 'carrera', bots: true,
  desc: 'Vos contra tres rivales en el mismo texto. La pista avanza con cada letra correcta y gana quien llega primero.',
  start(area, api: GameApi) {
    const seed = rand(), r = rng(seed), words = passage(seed, 34);
    const base = botBase() * diffMul();
    const you = { name: 'vos', you: true, p: 0 };
    const racers = [you, ...shuffle(BOT_NAMES, r).slice(0, 3).map(n => ({ name: n, bot: new Bot(n, base * (0.82 + r() * 0.36), r), p: 0 }))];
    area.replaceChildren(h('div', { class: 'arena' }, h('div', { class: 'lanes' }), h('div', { class: 'cmp-box' })));
    const upd = makeLanes($('.lanes', area), racers);
    let place = 0, t0 = 0, youDone = 0, loop, ended = false;
    const fin = x => { if (!x.place) x.place = ++place; };
    const box = new TypeBox($('.cmp-box', area), { onFinish: s => { you.wpm = s.wpm; you.p = 1; fin(you); youDone = now(); } });
    box.load(words); upd();
    const total = box.totalChars();
    const step = () => {
      const t = now(), dt = t - (step.l || t); step.l = t;
      racers.forEach(x => { if (x.bot && !x.place) { x.bot.step(dt); x.p = x.bot.chars / total; x.wpm = x.bot.chars / 5 / ((t - t0) / 60000); if (x.p >= 1) fin(x); } });
      if (!you.place) { you.p = box.progress(); you.wpm = box.wpmNow(); }
      upd();
      if (!ended && (racers.every(x => x.place) || (youDone && t - youDone > 2200))) end();
    };
    const end = () => {
      ended = true; clearInterval(loop);
      racers.filter(x => !x.place).sort((a, b) => b.p - a.p).forEach(fin); upd();
      if (!box.done) box.stop();
      const s = box.t0 ? box.stats() : null;
      History.record({ t: 'comp', mode: 'carrera', win: you.place === 1, detail: `${ord(you.place)} de ${racers.length}` + (s ? ` · ${Math.round(s.wpm)} ppm` : ''), pts: [150, 90, 50, 20][you.place - 1] || 0 });
      api.end({ title: you.place === 1 ? '* ganaste la carrera' : `llegaste ${ord(you.place)} de ${racers.length}`, lines: s ? [`${Math.round(s.wpm)} ppm · ${Math.round(s.acc)}% de precisión`] : [] });
    };
    const stopCd = countdown(area, () => {
      t0 = now(); step.l = t0; loop = setInterval(step, 100);
      setConsumer({ char: c => box.char(c), back: x => box.back(x), tab: api.again });
      requestAnimationFrame(() => box.refresh());
    });
    return () => { stopCd(); clearInterval(loop); box.stop(); };
  },
};

export const Royale: any = {
  id: 'royale', name: 'battle royale', bots: true,
  desc: 'Diez jugadores escribiendo a la vez. Cada 20 segundos queda afuera quien menos letras correctas escribió en esa ronda. El último en pie gana.',
  start(area, api: GameApi) {
    const seed = rand(), r = rng(seed), gen = wordGen(seed, compVocab()), base = botBase() * diffMul(), ROUND = 20;
    const you = { name: 'vos', you: true, rc: 0 };
    const players = [you, ...shuffle(BOT_NAMES, r).slice(0, 9).map((n, i) => ({ name: n, bot: new Bot(n, base * (0.62 + r() * 0.62), r), rc: 0 }))];
    const grid = h('div', { class: 'roy' }), rlabel = h('span'), tl = h('i'), cards = new Map();
    players.forEach(p => { const bar = h('i'), cnt = h('span', { class: 'sub', style: 'font-size:12px' }); const el = h('div', { class: 'pc' + (p.you ? ' you' : '') }, h('span', { class: 'nm', text: p.name }), h('div', { class: 'bar' }, bar), cnt); cards.set(p, { el, bar, cnt }); grid.append(el); });
    area.replaceChildren(h('div', { class: 'arena' }, h('div', { class: 'rbar' }, rlabel, h('div', { class: 'tl' }, tl)), grid, h('div', { class: 'cmp-box' })));
    const box = new TypeBox($('.cmp-box', area), {}); box.load(gen(80), { extend: gen });
    let round = 1, rt = 0, startC = 0, loop, alive = players.length, over = false;
    const render = () => {
      const max = Math.max(1, ...players.filter(p => !p.out).map(p => p.rc));
      const low = players.filter(p => !p.out).sort((a, b) => a.rc - b.rc)[0];
      players.forEach(p => { const c = cards.get(p); c.bar.style.width = (p.out ? 0 : p.rc / max * 100) + '%'; c.cnt.textContent = p.out ? `fuera · ${ord(p.place)}` : `${Math.round(p.rc)} letras`; c.el.classList.toggle('out', !!p.out); c.el.classList.toggle('low', p === low && !p.out && rt > ROUND * 500); });
      rlabel.textContent = `ronda ${round} · quedan ${alive}`; tl.style.width = (100 - rt / (ROUND * 10)) + '%';
    };
    const finish = (won) => {
      over = true; clearInterval(loop); box.stop();
      const s = box.t0 ? box.stats() : null;
      History.record({ t: 'comp', mode: 'battle royale', win: won, detail: `puesto ${ord(you.place)} · ${round - (won ? 0 : 1)} rondas` + (s ? ` · ${Math.round(s.wpm)} ppm` : ''), pts: (round - (won ? 0 : 1)) * 20 + (won ? 200 : 0) });
      api.end({ title: won ? '* sos el último en pie' : `quedaste afuera en el puesto ${ord(you.place)}`, lines: [`sobreviviste ${round - (won ? 0 : 1)} ronda${round - (won ? 0 : 1) === 1 ? '' : 's'}` + (s ? ` · ${Math.round(s.wpm)} ppm · ${Math.round(s.acc)}%` : '')] });
    };
    const step = () => {
      const t = now(), dt = t - (step.l || t); step.l = t; rt += dt;
      players.forEach(p => { if (!p.out && p.bot) p.rc += p.bot.step(dt); });
      you.rc = box.counts().correct - startC;
      if (rt >= ROUND * 1000) {
        const live = players.filter(p => !p.out).sort((a, b) => a.rc - b.rc), loser = live[0];
        loser.out = true; loser.place = alive; alive--;
        if (loser.you) { render(); return finish(false); }
        toast(`${loser.name} quedó afuera`);
        if (alive === 1) { you.place = 1; render(); return finish(true); }
        round++; rt = 0; startC = box.counts().correct; players.forEach(p => p.rc = 0);
      }
      render();
    };
    render();
    const stopCd = countdown(area, () => { step.l = now(); loop = setInterval(step, 100); setConsumer({ char: c => !over && box.char(c), back: x => box.back(x), tab: api.again }); requestAnimationFrame(() => box.refresh()); });
    return () => { stopCd(); clearInterval(loop); box.stop(); };
  },
};

export const Attack: any = {
  id: 'attack', name: 'ataque', bots: true,
  desc: 'Uno contra uno. Cada pila recibe palabras nuevas todo el tiempo. Cada 3 palabras seguidas sin errores le mandás una palabra basura al rival. Si tu pila pasa de 12, perdés.',
  start(area, api: GameApi) {
    const MAX = 12, seed = rand(), r = rng(seed), gen = wordGen(seed, compVocab()), long = VOCAB.dificil;
    const bot = new Bot(shuffle(BOT_NAMES, r)[0], botBase() * diffMul(), r);
    const garb = () => ({ w: long[Math.floor(r() * long.length)], g: true });
    let badC = '', badUntil = 0, mine = gen(5).map(w => ({ w })), theirs = gen(5).map(w => ({ w })), buf = '', combo = 0, bcombo = 0, spawn = 2600, st = 0, bt = 1200, keys = 0, hits = 0, words = 0, t0 = 0, loop, over = false;
    const col = (title) => { const meter = h('div', { class: 'meter' }), wl = h('div', { class: 'wl' }); for (let i = 0; i < MAX; i++) meter.append(h('i')); return { el: h('div', { class: 'stack' }, h('h4', { text: title }), meter, wl), meter, wl }; };
    const A = col('tu pila'), B = col(bot.name), cur = h('div', { class: 'curw' }), comboEl = h('div', { class: 'combo' });
    area.replaceChildren(h('div', { class: 'arena' }, h('div', { class: 'atk' }, A.el, h('div', { class: 'mid' }, cur, comboEl), B.el)));
    const paint = (C, list, skipFirst) => {
      $$('i', C.meter).forEach((m, i) => { m.className = i < list.length ? (list.length > MAX - 3 ? 'f hot' : 'f') : ''; });
      C.wl.replaceChildren(...list.slice(skipFirst ? 1 : 0, 9).map(x => h('span', { class: x.g ? 'g' : '', text: x.w })));
    };
    const render = () => {
      paint(A, mine, true); paint(B, theirs, false);
      const c = mine[0];
      // la tecla errada se ve tachada un momento, en el lugar de la letra que iba
      const bad = badC && now() < badUntil ? badC : '';
      cur.replaceChildren(c ? h('span', { class: 't', text: buf }) : '', bad && c ? h('span', { class: 'bad', text: bad }) : '', c ? h('span', { class: 'r', text: c.w.slice(buf.length + (bad ? 1 : 0)) }) : h('span', { class: 'r', text: '…' }));
      comboEl.textContent = `racha ${combo % 3}/3 · ${words} palabras`;
    };
    const finish = won => {
      over = true; clearInterval(loop);
      const secs = (now() - t0) / 1000;
      History.record({ t: 'comp', mode: 'ataque', win: won, detail: `${won ? 'ganaste' : 'perdiste'} contra ${bot.name} · ${words} palabras`, pts: (won ? 150 : 30) + words * 2 });
      api.end({ title: won ? `* ${bot.name} se tapó de palabras` : 'tu pila se desbordó', lines: [`${words} palabras en ${Math.round(secs)}s · ${Math.round(keys ? hits / keys * 100 : 100)}% de precisión`] });
    };
    const consumerObj = {
      char: c => {
        if (over || c === ' ') return; const w = mine[0]; if (!w) return;
        keys++;
        if (c === w.w[buf.length]) {
          hits++; buf += c;
          if (buf === w.w) { mine.shift(); buf = ''; combo++; words++; if (combo % 3 === 0) { theirs.push(garb()); toast('* le mandaste basura', 900); } }
        } else { combo = 0; badC = c; badUntil = now() + 550; setTimeout(render, 600); cur.classList.remove('shake'); void cur.offsetWidth; cur.classList.add('shake'); }
        render();
      },
      back: () => { buf = buf.slice(0, -1); render(); }, tab: api.again,
    };
    const step = () => {
      const t = now(), dt = t - (step.l || t); step.l = t; st += dt; bt -= dt;
      if (st >= spawn) { st = 0; spawn = Math.max(900, spawn * 0.965); const [a, b] = gen(2); mine.push({ w: a }); theirs.push({ w: b }); }
      if (bt <= 0 && theirs.length) {
        const w = theirs.shift(); bcombo++;
        if (bcombo % 3 === 0 && r() < 0.75) mine.push(garb());
        bt = (w.w.length + 1) / (bot.wpm * 5 / 60) * 1000 * (r() < 0.1 ? 2.4 : 0.85 + r() * 0.3);
      } else if (bt <= 0) bt = 300;
      render();
      if (mine.length > MAX) return finish(false);
      if (theirs.length > MAX) return finish(true);
    };
    render();
    const stopCd = countdown(area, () => { t0 = now(); step.l = t0; loop = setInterval(step, 100); setConsumer(consumerObj); });
    return () => { stopCd(); clearInterval(loop); };
  },
};

export const Tug: any = {
  id: 'tug', name: 'tira y afloja', bots: true,
  desc: 'Una cuerda en el medio. Cada palabra correcta la tira hacia tu lado y cada palabra del rival hacia el suyo. Gana quien la lleva al borde, o quien vaya adelante a los 90 segundos.',
  start(area, api: GameApi) {
    const LIM = 10, TIME = 90, seed = rand(), r = rng(seed), gen = wordGen(seed, compVocab());
    const bot = new Bot(shuffle(BOT_NAMES, r)[0], botBase() * diffMul(), r);
    let pos = 0, bt = 2500, t0 = 0, loop, over = false;
    const rope = h('div', { class: 'rope', 'aria-label': 'cuerda' }), timeEl = h('span');
    area.replaceChildren(h('div', { class: 'arena' },
      h('div', { class: 'ropelbl' }, h('span', { style: 'color:var(--accent)', text: '← vos' }), timeEl, h('span', { text: bot.name + ' →' })), rope, h('div', { class: 'cmp-box' })));
    const render = () => {
      rope.replaceChildren();
      for (let i = -LIM; i <= LIM; i++) {
        const idx = -pos; let cls = '', ch = '—';
        if (i === idx) { cls = 'm'; ch = '*'; } else if (i === 0) { cls = 'c'; ch = '|'; } else if (i === -LIM) { cls = 'w'; ch = '['; } else if (i === LIM) { cls = 'l'; ch = ']'; }
        rope.append(h('span', { class: cls, text: ch }));
      }
      timeEl.textContent = t0 ? Math.max(0, Math.ceil(TIME - (now() - t0) / 1000)) + 's' : TIME + 's';
    };
    const finish = () => {
      over = true; clearInterval(loop); box.stop();
      const s = box.t0 ? box.stats() : null;
      const title = pos > 0 ? '* ganaste la cinchada' : pos < 0 ? `ganó ${bot.name}` : 'empate exacto';
      History.record({ t: 'comp', mode: 'tira y afloja', win: pos > 0, detail: (pos > 0 ? 'ganaste' : pos < 0 ? 'perdiste' : 'empate') + ` contra ${bot.name}` + (s ? ` · ${Math.round(s.wpm)} ppm` : ''), pts: pos > 0 ? 120 : pos === 0 ? 50 : 20 });
      api.end({ title, lines: s ? [`${Math.round(s.wpm)} ppm · ${Math.round(s.acc)}% de precisión`] : [] });
    };
    const box = new TypeBox($('.cmp-box', area), { onWord: ok => { if (ok && !over) { pos++; render(); if (pos >= LIM) finish(); } } });
    box.load(gen(60), { extend: gen });
    const step = () => {
      const t = now(), dt = t - (step.l || t); step.l = t; bt -= dt;
      if (bt <= 0) { pos--; bt = 6 / (bot.wpm * 5 / 60) * 1000 * (r() < 0.1 ? 2 : 0.8 + r() * 0.4); if (pos <= -LIM) { render(); return finish(); } }
      render();
      if ((t - t0) / 1000 >= TIME) finish();
    };
    render();
    const stopCd = countdown(area, () => { t0 = now(); step.l = t0; loop = setInterval(step, 100); setConsumer({ char: c => !over && box.char(c), back: x => box.back(x), tab: api.again }); requestAnimationFrame(() => box.refresh()); });
    return () => { stopCd(); clearInterval(loop); box.stop(); };
  },
};

export const Daily: any = {
  id: 'daily', name: 'desafío diario', bots: false,
  desc: 'Un texto nuevo cada día, igual para todos. Corrés contra tres fantasmas fijos (bronce, plata y oro) y contra tu mejor intento de hoy. Al terminar podés copiar tu resultado para compartirlo.',
  start(area, api: GameApi) {
    const key = todayKey(), seed = +key.replace(/-/g, ''), words = passage(seed, 30);
    const best = store.get('daily:' + key);
    const medals = [{ name: 'fantasma oro', wpm: 95 }, { name: 'fantasma plata', wpm: 70 }, { name: 'fantasma bronce', wpm: 45 }];
    const you = { name: 'vos', you: true, p: 0 };
    const mine = best ? { name: 'tu mejor de hoy', gh: true, p: 0 } : null;
    const racers = [you, ...(mine ? [mine] : []), ...medals.map(m => ({ ...m, gh: true, p: 0 }))];
    area.replaceChildren(h('div', { class: 'arena' }, h('div', { class: 'row', style: 'justify-content:space-between' }, h('span', { class: 'eyebrow', text: `* desafío del ${key.split('-').reverse().join('/')}` }), h('span', { class: 'sub', style: 'font-size:12.5px', text: `racha: ${(store.get('streak', { n: 0 })).n} días` })), h('div', { class: 'lanes' }), h('div', { class: 'cmp-box' })));
    const upd = makeLanes($('.lanes', area), racers);
    let loop, over = false;
    const box = new TypeBox($('.cmp-box', area), { ghostLabel: 'hoy', onFinish: s => done(s) });
    box.load(words, { ghost: best ? best.tl : null });
    const total = box.totalChars(), pre = []; let acc = 0; box.words.forEach(w => { pre.push(acc); acc += w.length + 1; });
    const ghostAt = ms => { const g = best.tl; let e = null; for (let i = 0; i < g.length && g[i][0] <= ms; i++) e = g[i]; return e ? (pre[e[1]] + e[2]) / total : 0; };
    const step = () => {
      const ms = box.t0 ? now() - box.t0 : 0;
      racers.forEach(x => { if (x.wpm && x.gh && x !== mine) x.p = Math.min(1, x.wpm * 5 / 60 * ms / 1000 / total); });
      if (mine) { mine.p = ghostAt(ms); mine.wpm = best.wpm; }
      you.p = box.progress(); you.wpm = box.wpmNow(); upd();
    };
    const done = s => {
      over = true; clearInterval(loop); step(); you.p = 1; upd();
      const improved = !best || s.wpm > best.wpm;
      if (improved) store.set('daily:' + key, { wpm: s.wpm, acc: s.acc, tl: box.tl });
      const st = store.get('streak', { n: 0, last: '' });
      if (st.last !== key) { const y = new Date(); y.setDate(y.getDate() - 1); const yk = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`; st.n = st.last === yk ? st.n + 1 : 1; st.last = key; store.set('streak', st); }
      const beaten = medals.filter(m => s.wpm > m.wpm).length;
      const medal = ['sin medalla', 'bronce', 'plata', 'oro'][beaten];
      History.record({ t: 'comp', mode: 'desafío diario', win: beaten === 3, detail: `${Math.round(s.wpm)} ppm · ${Math.round(s.acc)}% · ${medal}`, pts: 30 + beaten * 50 });
      const share = `tecla* · diario ${key.split('-').reverse().slice(0, 2).join('/')}\n${Math.round(s.wpm)} ppm · ${Math.round(s.acc)}% · ${medal}\n${'🟦'.repeat(beaten)}${'⬜'.repeat(3 - beaten)} racha ${st.n}`;
      api.end({ title: beaten ? `* medalla de ${medal}` : 'sin medalla esta vez', lines: [`${Math.round(s.wpm)} ppm · ${Math.round(s.acc)}% de precisión` + (improved && best ? ` · mejoraste tu intento de hoy (${Math.round(best.wpm)})` : ''), `racha de ${st.n} día${st.n === 1 ? '' : 's'} seguidos`], share, daily: { day: key, wpm: s.wpm, acc: s.acc } });
    };
    upd();
    loop = setInterval(step, 100);
    setConsumer({ char: c => !over && box.char(c), back: x => box.back(x), tab: api.again });
    requestAnimationFrame(() => box.refresh());
    return () => { clearInterval(loop); box.stop(); };
  },
};

export const MODES = [Race, Royale, Attack, Tug, Daily];
