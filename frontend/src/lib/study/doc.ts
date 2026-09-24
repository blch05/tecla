// @ts-nocheck — portado del prototipo; pendiente de tipar
/* =========================================================
   Procesamiento del material de estudio: párrafos, conceptos clave,
   oraciones y tarjetas a partir de un texto o un PDF.
   ========================================================= */
import { STOP } from '@/lib/tecla/data/words';

export interface StudyDoc { title: string; paras: string[]; kws: string[]; score: Record<string, number>; sentences: string[]; cards: { a: string; q: string }[]; words: number }

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
/** Huecos de un párrafo: sus palabras más importantes (según el puntaje del documento). */
export function pickBlanks(p, score) {
  const tk = tokens(p), seen = new Set();
  let c = tk.filter(x => { const l = x.w.toLowerCase(); if (l.length < 4 || STOP.has(l) || !score[l] || seen.has(l)) return false; seen.add(l); return true; });
  c = c.sort((a, b) => score[b.w.toLowerCase()] - score[a.w.toLowerCase()]).slice(0, Math.min(4, Math.max(2, Math.round(tk.length / 14))));
  return c.sort((a, b) => a.i - b.i);
}
/** Conceptos clave de un párrafo. */
export function paraKeywords(p, score, n = 6) { const seen = new Set(); return tokens(p).map(x => x.w.toLowerCase()).filter(l => { if (l.length < 4 || STOP.has(l) || !score[l] || seen.has(l)) return false; seen.add(l); return true; }).sort((a, b) => score[b] - score[a]).slice(0, n); }
export let pdfReady = null;
export function loadScript(src) { return new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error('No se pudo cargar el lector de PDF.')); document.head.append(s); }); }
/** Texto de un PDF con pdf.js (se carga la primera vez desde cdnjs). */
export async function pdfText(file) {
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
