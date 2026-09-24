// @ts-nocheck — módulo portado del prototipo; pendiente de tipar (ver README)
import { $, $$, avg, h, norm, now, shuffle, store, toast } from '@/lib/tecla/utils';
import { SAMPLE_DOC, STOP } from '@/lib/tecla/data/words';
import { TypeBox } from '@/lib/tecla/typebox';
import { blurKb, setConsumer } from '@/lib/tecla/input';
import { History } from '@/lib/tecla/history';
import { tabs } from '@/lib/tecla/bits';

/* =========================================================
   vista: ESTUDIAR
   ========================================================= */
export const Doc: any = {};
export function chunkSentences(p, max) { const ss = p.split(/(?<=[.!?])\s+/); const out = []; let cur = ''; for (const s of ss) { if ((cur + ' ' + s).length > max && cur) { out.push(cur.trim()); cur = s; } else cur += ' ' + s; } if (cur.trim()) out.push(cur.trim()); return out; }
export function tokens(s) { return [...s.matchAll(/[\p{L}\d]+/gu)].map(m => ({ w: m[0], i: m.index })); }
export function processDoc(raw, title) {
  let t = raw.replace(/\r/g, '').replace(/-\n(?=\p{Ll})/gu, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  let blocks = t.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
  if (!title && blocks[0] && blocks[0].length < 80 && !/[.:]$/.test(blocks[0]) && !blocks[0].includes('\n')) title = blocks.shift();
  let paras = [];
  for (const b of blocks) {
    const lines = b.split('\n').map(l => l.trim()).filter(Boolean);
    const defs = lines.filter(l => /^[^:]{2,40}:\s+\S/.test(l));
    if (lines.length > 1 && defs.length >= 2) paras.push(...lines); else paras.push(lines.join(' '));
  }
  paras = paras.flatMap(p => p.length > 480 ? chunkSentences(p, 380) : [p]).filter(p => p.length >= 40);
  const freq = {}, disp = {};
  paras.forEach(p => tokens(p).forEach(({ w }) => { const l = w.toLowerCase(); if (l.length < 4 || STOP.has(l) || /^\d+$/.test(l)) return; freq[l] = (freq[l] || 0) + 1; disp[l] = disp[l] || l; }));
  const score = {}; Object.keys(freq).forEach(l => score[l] = freq[l] * Math.log(l.length));
  const kws = Object.keys(score).sort((a, b) => score[b] - score[a]);
  const sentences = paras.flatMap(p => p.split(/(?<=[.!?])\s+/)).map(s => s.trim()).filter(s => s.length > 20);
  const cards = [];
  paras.forEach(p => { const m = p.match(/^([^:]{2,40}):\s+(.+)$/); if (m) { const term = m[1].trim(); cards.push({ a: term, q: m[2].replace(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '____') }); } });
  sentences.forEach(s => {
    if (cards.length >= 20) return;
    const m = s.match(/^(?:(?:el|la|los|las|un|una)\s+)?([\p{L} ]{3,28}?)\s+(es|son|se define como|consiste en)\s+(.{20,})$/iu);
    if (m && !cards.some(c => c.a.toLowerCase() === m[1].toLowerCase())) cards.push({ a: m[1].trim(), q: `____ ${m[2]} ${m[3]}` });
  });
  if (cards.length < 5) sentences.forEach(s => {
    if (cards.length >= 12) return;
    const tk = tokens(s).filter(x => score[x.w.toLowerCase()] && x.w.length >= 5).sort((a, b) => score[b.w.toLowerCase()] - score[a.w.toLowerCase()])[0];
    if (tk && !cards.some(c => c.a === tk.w)) cards.push({ a: tk.w, q: s.slice(0, tk.i) + '____' + s.slice(tk.i + tk.w.length) });
  });
  return { title: title || 'Tu material', paras, kws, score, sentences, cards, words: tokens(t).length };
}
export function pickBlanks(p) {
  const tk = tokens(p), seen = new Set();
  let c = tk.filter(x => { const l = x.w.toLowerCase(); if (l.length < 4 || STOP.has(l) || !Doc.score[l] || seen.has(l)) return false; seen.add(l); return true; });
  c = c.sort((a, b) => Doc.score[b.w.toLowerCase()] - Doc.score[a.w.toLowerCase()]).slice(0, Math.min(4, Math.max(2, Math.round(tk.length / 14))));
  return c.sort((a, b) => a.i - b.i);
}
export function paraKeywords(p, n = 6) { const seen = new Set(); return tokens(p).map(x => x.w.toLowerCase()).filter(l => { if (l.length < 4 || STOP.has(l) || !Doc.score[l] || seen.has(l)) return false; seen.add(l); return true; }).sort((a, b) => Doc.score[b] - Doc.score[a]).slice(0, n); }
export let pdfReady = null;
export function loadScript(src) { return new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error('No se pudo cargar el lector de PDF.')); document.head.append(s); }); }
async function pdfText(file) {
  const V = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
  pdfReady = pdfReady || loadScript(V + 'pdf.min.js').then(() => loadScript(V + 'pdf.worker.min.js')).then(() => { (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = V + 'pdf.worker.min.js'; });
  await pdfReady;
  const pdf = await (window as any).pdfjsLib.getDocument({ data: await file.arrayBuffer(), isEvalSupported: false }).promise;
  let out = '';
  for (let i = 1; i <= Math.min(pdf.numPages, 80); i++) {
    const tc = await (await pdf.getPage(i)).getTextContent(); let lastY = null, line = '';
    for (const it of tc.items) { const y = it.transform ? it.transform[5] : null; if (lastY != null && y != null && Math.abs(y - lastY) > 14) line += '\n'; else if (lastY != null && y != null && Math.abs(y - lastY) > 2 && !line.endsWith(' ')) line += ' '; line += it.str; if (it.hasEOL) line += '\n'; lastY = y; }
    out += line + '\n\n';
  }
  return out;
}

export const Study: any = {
  modes: [
    { id: 'copy', name: 'tipear el texto', desc: 'Practicá tipeo con tu propio material, párrafo por párrafo.' },
    { id: 'huecos', name: 'completar huecos', desc: 'Los conceptos clave aparecen tapados: escribilos de memoria.' },
    { id: 'flash', name: 'flashcards', desc: 'Leé la definición y tipeá el concepto. Las que fallás vuelven más tarde.' },
    { id: 'resumen', name: 'resumen a ciegas', desc: 'Leé un párrafo, se oculta y lo reescribís con tus palabras. Se puntúa cuántos conceptos clave recordaste.' },
    { id: 'dictado', name: 'dictado', desc: 'Escuchá una oración y escribila sin verla.' },
  ],
  cur: store.get('studyMode', 'huecos'), cleanup: null, sess: null,
  hit(ok, pts) { if (!this.sess) this.sess = { mode: this.cur, ok: 0, n: 0, pts: 0 }; this.sess.n++; if (ok) this.sess.ok++; this.sess.pts += pts; },
  flush() {
    const x = this.sess; this.sess = null; if (!x || !x.n) return;
    const unit = { copy: 'párrafos', huecos: 'huecos', flash: 'tarjetas', resumen: 'resúmenes', dictado: 'oraciones' }[x.mode];
    History.record({ t: 'study', mode: this.modes.find(m => m.id === x.mode).name, detail: `${x.ok}/${x.n} ${unit} bien · ${Doc.title}`, pts: x.pts });
  },
  init() {
    const saved = store.get('doc', null);
    this.setDoc(saved ? saved.text : SAMPLE_DOC, saved ? saved.title : null, false);
    this.renderTabs();
    $('#doc-edit').onclick = () => { $('#v-study').classList.add('pasting'); $('#doc-paste').hidden = false; $('#doc-text').value = ''; $('#doc-text').focus(); };
    $('#doc-cancel').onclick = () => { $('#doc-paste').hidden = true; $('#v-study').classList.remove('pasting'); };
    $('#doc-use').onclick = () => { const v = $('#doc-text').value.trim(); if (v.length < 80) return toast('Pegá un texto un poco más largo (al menos un par de párrafos).'); $('#doc-paste').hidden = true; $('#v-study').classList.remove('pasting'); this.setDoc(v, null, true); };
    $('#doc-file').onchange = async e => {
      const inp = e.target as HTMLInputElement; const f = inp.files && inp.files[0]; inp.value = ''; if (!f) return;
      try {
        toast('Leyendo ' + f.name + '…', 6000);
        const txt = /\.pdf$/i.test(f.name) || f.type === 'application/pdf' ? await pdfText(f) : await f.text();
        if (txt.replace(/\s/g, '').length < 80) return toast('No encontramos texto en ese archivo. Si es un PDF escaneado, probá pegando el texto.', 4000);
        this.setDoc(txt, f.name.replace(/\.[^.]+$/, ''), true); toast('Listo: ' + f.name);
      } catch (err) { toast('No se pudo leer el archivo: ' + (err.message || 'formato no compatible'), 4000); }
    };
  },
  setDoc(text, title, rerender) {
    if (rerender) this.flush();
    const d = processDoc(text, title);
    if (!d.paras.length) { toast('No encontramos párrafos útiles en ese texto.'); return; }
    Object.keys(Doc).forEach(k => delete Doc[k]); Object.assign(Doc, d);
    store.set('doc', { text: text.slice(0, 250000), title: d.title });
    $('#doc-title').textContent = d.title;
    $('#doc-meta').textContent = `${d.words} palabras · ${d.paras.length} párrafos · ${d.cards.length} tarjetas · ${d.sentences.length} oraciones` + (text === SAMPLE_DOC ? ' · texto de ejemplo' : '');
    $('#doc-kw').replaceChildren(...d.kws.slice(0, 10).map(k => h('span', { class: 'chip', text: k })));
    if (rerender) this.show(this.cur);
  },
  renderTabs() { tabs($('#study-tabs'), { items: this.modes.map(m => ({ id: m.id, label: m.name })), value: this.cur, onChange: id => this.show(id), label: 'modos de estudio' }); },
  show(id) {
    this.flush(); if (this.cleanup) this.cleanup(); this.cleanup = null;
    if (!this.modes.find(m => m.id === id)) id = 'huecos';
    this.cur = id; store.set('studyMode', id);
    this.renderTabs();
    const area = $('#study-area'); area.replaceChildren();
    this.cleanup = ({ copy: studyCopy, huecos: studyHuecos, flash: studyFlash, resumen: studyResumen, dictado: studyDictado })[id](area, this.modes.find(m => m.id === id)) || null;
  },
  enter() { this.show(this.cur); }, leave() { this.flush(); if (this.cleanup) this.cleanup(); this.cleanup = null; },
};
export function studyHead(area, mode, right) { area.append(h('div', { class: 'row', style: 'justify-content:space-between;margin-bottom:14px' }, h('div', {}, h('span', { class: 'eyebrow', text: '* ' + mode.name }), h('p', { class: 'sub', style: 'font-size:13px', text: mode.desc })), right || '')); }

export function studyCopy(area, mode) {
  let i = 0; const lbl = h('span', { class: 'sub', style: 'font-size:13px' }), res = h('p', { class: 'sub', style: 'min-height:1.5em;margin-top:10px' });
  studyHead(area, mode, h('div', { class: 'row' }, h('button', { class: 'btn ghost', text: '← anterior', onclick: () => load(i - 1) }), lbl, h('button', { class: 'btn ghost', text: 'siguiente →', onclick: () => load(i + 1) })));
  const holder = h('div'); area.append(holder, res);
  const box = new TypeBox(holder, { onFinish: s => { Study.hit(s.acc >= 90, Math.round(s.wpm * s.acc / 200)); res.replaceChildren(h('b', { style: 'color:var(--accent)', text: `${Math.round(s.wpm)} ppm · ${Math.round(s.acc)}% ` }), ' — ', h('kbd', { text: 'enter' }), ' siguiente párrafo'); } });
  const load = n => { i = (n + Doc.paras.length) % Doc.paras.length; lbl.textContent = `párrafo ${i + 1} de ${Doc.paras.length}`; res.textContent = ''; box.load(Doc.paras[i].split(/\s+/)); };
  load(0);
  setConsumer({ char: c => box.char(c), back: x => box.back(x), tab: () => load(i), enter: () => { if (box.done) load(i + 1); } });
  return () => box.stop();
}

export function studyHuecos(area, mode) {
  let pi = 0, blanks = [], bi = 0, buf = '', res = [], tot = { ok: 0, casi: 0, mal: 0 };
  const score = h('span', { class: 'sub', style: 'font-size:13px' });
  studyHead(area, mode, score);
  const box = h('div', { class: 'cloze' }), foot = h('p', { class: 'hint', style: 'text-align:left;margin-top:14px' });
  area.append(box, foot);
  const setup = (n, depth = 0) => { pi = (n + Doc.paras.length) % Doc.paras.length; blanks = pickBlanks(Doc.paras[pi]); bi = 0; buf = ''; res = []; if (!blanks.length && depth < Doc.paras.length) return setup(pi + 1, depth + 1); render(); };
  const render = () => {
    const p = Doc.paras[pi]; box.replaceChildren(); let last = 0;
    blanks.forEach((b, k) => {
      box.append(p.slice(last, b.i)); last = b.i + b.w.length;
      const r = res[k]; let el;
      if (r) el = h('span', { class: 'blank ' + r.r }, r.r === 'mal' ? h('s', { text: r.typed }) : '', r.r === 'ok' ? r.typed : b.w);
      else if (k === bi) el = h('span', { class: 'blank cur' }, buf, h('span', { class: 'cursor' }));
      else el = h('span', { class: 'blank', text: ' '.repeat(Math.max(4, Math.round(b.w.length * .8))) });
      box.append(el);
    });
    box.append(p.slice(last));
    score.textContent = `párrafo ${pi + 1}/${Doc.paras.length} · ✓ ${tot.ok}  ~ ${tot.casi}  × ${tot.mal}`;
    foot.replaceChildren(...(bi >= blanks.length ? [h('kbd', { text: 'enter' }), ' siguiente párrafo'] : [h('kbd', { text: 'espacio' }), ' o ', h('kbd', { text: 'enter' }), ' confirmar · ', h('kbd', { text: 'tab' }), ' saltar párrafo · la tilde mal cuenta como "casi"']));
  };
  const submit = () => {
    if (!buf || bi >= blanks.length) return;
    const w = blanks[bi].w, r = buf.toLowerCase() === w.toLowerCase() ? 'ok' : norm(buf) === norm(w) ? 'casi' : 'mal';
    res[bi] = { r, typed: buf }; tot[r]++; Study.hit(r !== 'mal', r === 'ok' ? 5 : r === 'casi' ? 2 : 0); bi++; buf = ''; render();
  };
  setup(0);
  setConsumer({ char: c => { if (bi >= blanks.length) return; if (c === ' ') submit(); else { buf += c; render(); } }, back: x => { buf = x ? '' : buf.slice(0, -1); render(); }, enter: () => { if (bi >= blanks.length) setup(pi + 1); else submit(); }, tab: () => setup(pi + 1) });
}

export function studyFlash(area, mode) {
  if (!Doc.cards.length) { area.append(h('p', { class: 'sub', text: 'No pudimos armar tarjetas con este texto. Probá con apuntes que tengan definiciones del tipo "Concepto: explicación".' })); setConsumer({}); return; }
  let q = shuffle(Doc.cards.map(c => ({ ...c, miss: 0 }))), learned = 0, total = q.length, buf = '', state = 'ask', card = null, t0 = now(), fb = null, tries = 0, rightFirst = 0;
  const prog = h('i'), progLbl = h('span', { class: 'sub', style: 'font-size:13px' });
  studyHead(area, mode, progLbl);
  // tarjetas apiladas: la de arriba sale deslizándose al responder
  const wrap = h('div', { class: 'card' }); const stack = h('div', { class: 'fstack' }, wrap);
  area.append(h('div', { class: 'progress', style: 'margin-bottom:18px' }, prog), stack);
  const render = () => {
    prog.style.width = (learned / total * 100) + '%'; progLbl.textContent = `${learned}/${total} aprendidas`;
    if (!q.length) { wrap.replaceChildren(h('h3', { style: 'font-family:var(--display);color:var(--accent);margin:0', text: '* mazo completo' }), h('p', { class: 'sub', text: `${total} tarjetas · ${Math.round(rightFirst / Math.max(1, tries) * 100)}% de respuestas correctas` }), h('div', { class: 'row' }, h('button', { class: 'btn primary', text: 'repasar de nuevo', onclick: () => Study.show('flash') }), h('span', { class: 'hint' }, h('kbd', { text: 'enter' })))); return; }
    card = card || q[0];
    wrap.replaceChildren(h('span', { class: 'lbl', text: 'definición' }), h('div', { class: 'q', text: card.q }), h('span', { class: 'lbl', text: '¿qué concepto es?' }), h('div', { class: 'answer' }, buf, state === 'ask' ? h('span', { class: 'cursor' }) : ''), fb || h('p', { class: 'hint', style: 'text-align:left' }, h('kbd', { text: 'enter' }), ' responder · ', h('kbd', { text: 'tab' }), ' no sé'));
  };
  const answer = giveUp => {
    const secs = ((now() - t0) / 1000).toFixed(1); tries++;
    const ok = !giveUp && buf.trim().toLowerCase() === card.a.toLowerCase(), casi = !giveUp && !ok && norm(buf.trim()) === norm(card.a);
    Study.hit(ok || casi, ok ? 5 : casi ? 2 : 0);
    q.shift();
    if (ok || casi) { if (card.miss === 0) { learned++; rightFirst++; } else { card.miss = 0; q.push(card); } }
    else { card.miss++; q.splice(Math.min(3, q.length), 0, card); }
    fb = h('p', { class: 'fb ' + (ok ? 'ok' : casi ? 'casi' : 'bad') }, ok ? `✓ correcto en ${secs}s` : casi ? `~ casi: se escribe "${card.a}"` : `× era "${card.a}" — vuelve en un rato`, h('span', { class: 'hint' }, '  · ', h('kbd', { text: 'enter' }), ' seguir'));
    state = 'fb'; render();
  };
  const next = () => {
    if (wrap.classList.contains('out')) return;
    wrap.classList.add('out');
    setTimeout(() => { state = 'ask'; buf = ''; fb = null; card = null; t0 = now(); render(); wrap.classList.remove('out'); wrap.classList.add('in'); setTimeout(() => wrap.classList.remove('in'), 260); }, 220);
  };
  render();
  setConsumer({ char: c => { if (state === 'ask' && q.length) { buf += c; render(); } }, back: x => { if (state === 'ask') { buf = x ? '' : buf.slice(0, -1); render(); } }, enter: () => { if (!q.length) return Study.show('flash'); if (state === 'ask') { if (buf.trim()) answer(false); } else next(); }, tab: () => { if (state === 'ask' && q.length) answer(true); } });
}

export function studyResumen(area, mode) {
  let pi = 0; const scoreEl = h('span', { class: 'sub', style: 'font-size:13px' }); let hist = [];
  studyHead(area, mode, scoreEl);
  const body = h('div', { style: 'display:flex;flex-direction:column;gap:14px' }); area.append(body);
  const read = () => {
    scoreEl.textContent = `párrafo ${pi + 1}/${Doc.paras.length}` + (hist.length ? ` · promedio ${Math.round(avg(hist))}%` : '');
    body.replaceChildren(h('span', { class: 'lbl', text: 'leé con atención' }), h('p', { class: 'para', text: Doc.paras[pi] }), h('div', { class: 'row' }, h('button', { class: 'btn primary', text: 'ya lo leí, ocultar', onclick: write }), h('span', { class: 'hint' }, h('kbd', { text: 'enter' }))));
    setConsumer({ enter: write, tab: () => { pi = (pi + 1) % Doc.paras.length; read(); } });
  };
  const write = () => {
    const ta = h('textarea', { id: 'sum-text', rows: '6', placeholder: 'Escribí lo que recuerdes, con tus palabras…' });
    ta.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); evaluate(ta.value); } });
    body.replaceChildren(h('span', { class: 'lbl', text: 'reescribí el párrafo de memoria' }), ta, h('div', { class: 'row' }, h('button', { class: 'btn primary', text: 'evaluar', onclick: () => evaluate(ta.value) }), h('span', { class: 'hint' }, h('kbd', { text: 'ctrl' }), '+', h('kbd', { text: 'enter' }))));
    setConsumer(null); blurKb(); ta.focus();
  };
  const evaluate = txt => {
    const kws = paraKeywords(Doc.paras[pi]); const typed = tokens(txt).map(x => norm(x.w));
    const hit = kw => { const n = norm(kw), pre = n.slice(0, Math.min(n.length, 6)); return typed.some(t => t === n || (n.length >= 6 && t.startsWith(pre))); };
    const found = kws.filter(hit), miss = kws.filter(k => !hit(k)), pct = kws.length ? found.length / kws.length * 100 : 0; hist.push(pct); Study.hit(pct >= 50, Math.round(pct / 10));
    const p = Doc.paras[pi], re = new RegExp(`\\b(${kws.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'giu');
    const para = h('p', { class: 'para' }); let last = 0; for (const m of p.matchAll(re)) { para.append(p.slice(last, m.index), h('mark', { text: m[0] })); last = m.index + m[0].length; } para.append(p.slice(last));
    body.replaceChildren(
      h('div', { class: 'bigs', style: 'flex-direction:row;gap:28px' }, h('div', { class: 'big' }, h('span', { class: 'lbl', text: 'conceptos recordados' }), h('b', { text: Math.round(pct) + '%' })), h('div', { class: 'big b2' }, h('span', { class: 'lbl', text: 'palabras escritas' }), h('b', { text: tokens(txt).length }))),
      h('div', { class: 'chips' }, ...found.map(k => h('span', { class: 'chip ok', text: '✓ ' + k })), ...miss.map(k => h('span', { class: 'chip bad', text: '× ' + k }))),
      h('span', { class: 'lbl', text: 'el original' }), para,
      h('div', { class: 'row' }, h('button', { class: 'btn primary', text: 'siguiente párrafo', onclick: nextP }), h('span', { class: 'hint' }, h('kbd', { text: 'enter' }))));
    setConsumer({ enter: nextP });
  };
  const nextP = () => { pi = (pi + 1) % Doc.paras.length; read(); };
  read();
}

export function studyDictado(area, mode) {
  const list = Doc.sentences.filter(s => s.length >= 25 && s.length <= 180); let si = 0, buf = '', checked = false, slow = false;
  const has = 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
  const lbl = h('span', { class: 'sub', style: 'font-size:13px' });
  studyHead(area, mode, lbl);
  if (!list.length) { area.append(h('p', { class: 'sub', text: 'No encontramos oraciones para dictar en este texto.' })); setConsumer({}); return; }
  const typedEl = h('div', { class: 'typed' }), out = h('div', { class: 'cmp' }), note = h('p', { class: 'sub', style: 'font-size:13px' }), peek = h('p', { class: 'para', hidden: true });
  area.append(h('div', { class: 'dict' },
    h('div', { class: 'row' }, h('button', { class: 'btn primary', text: '▶ escuchar', onclick: () => speak(false) }), h('button', { class: 'btn', text: 'más lento', onclick: () => speak(true) }), h('span', { class: 'hint' }, h('kbd', { text: 'tab' }), ' repetir · ', h('kbd', { text: 'enter' }), ' corregir')),
    note, peek, typedEl, out));
  const speak = s => {
    if (!has) { peek.hidden = false; peek.textContent = list[si]; setTimeout(() => peek.hidden = true, 2500); return; }
    slow = s; speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(list[si]); const v = speechSynthesis.getVoices().find(v => /^es/i.test(v.lang));
    if (v) u.voice = v; u.lang = v ? v.lang : 'es-ES'; u.rate = s ? 0.7 : 0.95; speechSynthesis.speak(u);
  };
  note.textContent = has ? '' : 'Tu navegador no tiene voces para leer en voz alta: la oración se muestra 2,5 segundos y después la escribís de memoria.';
  const render = () => { lbl.textContent = `oración ${si + 1}/${list.length}`; typedEl.replaceChildren(buf, checked ? '' : h('span', { class: 'cursor' })); };
  const check = () => {
    const a = list[si].split(/\s+/), b = buf.trim().split(/\s+/).filter(Boolean), A = a.map(norm).map(w => w.replace(/[^\p{L}\d]/gu, '')), B = b.map(norm).map(w => w.replace(/[^\p{L}\d]/gu, ''));
    const dp = Array.from({ length: A.length + 1 }, () => new Array(B.length + 1).fill(0));
    for (let i = A.length - 1; i >= 0; i--) for (let j = B.length - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    const ok = new Set(); let i = 0, j = 0; while (i < A.length && j < B.length) { if (A[i] === B[j]) { ok.add(i); i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) i++; else j++; }
    const pct = ok.size / a.length * 100; Study.hit(pct >= 80, Math.round(pct / 10));
    checked = true; render();
    out.replaceChildren(h('span', { class: 'lbl', style: 'margin-bottom:6px', text: `${Math.round(ok.size / a.length * 100)}% de palabras correctas` }), h('div', {}, ...a.map((w, k) => h('span', { class: ok.has(k) ? 'ok' : 'miss', text: w }))), h('p', { class: 'hint', style: 'text-align:left;margin-top:10px' }, h('kbd', { text: 'enter' }), ' siguiente oración'));
  };
  const next = () => { si = (si + 1) % list.length; buf = ''; checked = false; out.replaceChildren(); render(); speak(false); };
  render();
  setConsumer({ char: c => { if (!checked) { buf += c; render(); } }, back: x => { if (!checked) { buf = x ? buf.replace(/\S+\s*$/, '') : buf.slice(0, -1); render(); } }, enter: () => { if (checked) next(); else if (buf.trim()) check(); }, tab: () => speak(slow) });
  return () => { if (has) speechSynthesis.cancel(); };
}
