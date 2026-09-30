/* =========================================================
   Procesamiento del material de estudio: párrafos, conceptos clave,
   oraciones y tarjetas a partir de un texto o un PDF.
   Todo corre en el navegador: el material nunca sale de la compu del usuario.
   ========================================================= */
import { STOP } from '@/lib/tecla/data/words';

export interface Card { a: string; q: string }
export interface StudyDoc {
  title: string;
  paras: string[];
  /** conceptos clave, del más importante al menos */
  kws: string[];
  /** importancia de cada palabra (en minúsculas): frecuencia × log(largo) */
  score: Record<string, number>;
  sentences: string[];
  /** tarjetas pregunta/respuesta: la respuesta aparece como ____ en la pregunta */
  cards: Card[];
  words: number;
}
export interface Token { w: string; i: number }

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Parte un párrafo largo en trozos de hasta `max` caracteres sin cortar oraciones. */
export function chunkSentences(p: string, max: number) {
  const out: string[] = []; let cur = '';
  for (const s of p.split(/(?<=[.!?])\s+/)) {
    if ((cur + ' ' + s).length > max && cur) { out.push(cur.trim()); cur = s; } else cur += ' ' + s;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** Palabras (letras y números) con su posición en el texto. */
export function tokens(s: string): Token[] { return [...s.matchAll(/[\p{L}\d]+/gu)].map(m => ({ w: m[0], i: m.index! })); }

const isKeyword = (l: string, score: Record<string, number>) => l.length >= 4 && !STOP.has(l) && !!score[l];

export function processDoc(raw: string, title?: string | null): StudyDoc {
  // une palabras cortadas con guion al final de línea (típico de PDFs) y normaliza espacios
  const t = raw.replace(/\r/g, '').replace(/-\n(?=\p{Ll})/gu, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  const blocks = t.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
  // la primera línea corta, sin punto final, es el título
  if (!title && blocks[0] && blocks[0].length < 80 && !/[.:]$/.test(blocks[0]) && !blocks[0].includes('\n')) title = blocks.shift();

  let paras: string[] = [];
  for (const b of blocks) {
    const lines = b.split('\n').map(l => l.trim()).filter(Boolean);
    // un bloque de "término: definición" se separa en un párrafo por línea
    const defs = lines.filter(l => /^[^:]{2,40}:\s+\S/.test(l));
    if (lines.length > 1 && defs.length >= 2) paras.push(...lines); else paras.push(lines.join(' '));
  }
  paras = paras.flatMap(p => p.length > 480 ? chunkSentences(p, 380) : [p]).filter(p => p.length >= 40);

  const freq: Record<string, number> = {};
  paras.forEach(p => tokens(p).forEach(({ w }) => {
    const l = w.toLowerCase(); if (l.length < 4 || STOP.has(l) || /^\d+$/.test(l)) return;
    freq[l] = (freq[l] || 0) + 1;
  }));
  const score: Record<string, number> = {};
  Object.keys(freq).forEach(l => { score[l] = freq[l] * Math.log(l.length); });
  const kws = Object.keys(score).sort((a, b) => score[b] - score[a]);
  const sentences = paras.flatMap(p => p.split(/(?<=[.!?])\s+/)).map(s => s.trim()).filter(s => s.length > 20);

  const cards: Card[] = [];
  // 1) definiciones explícitas: "Término: definición"
  paras.forEach(p => {
    const m = p.match(/^([^:]{2,40}):\s+(.+)$/);
    if (m) { const term = m[1].trim(); cards.push({ a: term, q: m[2].replace(new RegExp(escapeRe(term), 'gi'), '____') }); }
  });
  // 2) oraciones del tipo "X es / son / consiste en …"
  sentences.forEach(s => {
    if (cards.length >= 20) return;
    const m = s.match(/^(?:(?:el|la|los|las|un|una)\s+)?([\p{L} ]{3,28}?)\s+(es|son|se define como|consiste en)\s+(.{20,})$/iu);
    if (m && !cards.some(c => c.a.toLowerCase() === m[1].toLowerCase())) cards.push({ a: m[1].trim(), q: `____ ${m[2]} ${m[3]}` });
  });
  // 3) si quedaron pocas: la palabra más importante de cada oración
  if (cards.length < 5) sentences.forEach(s => {
    if (cards.length >= 12) return;
    const tk = tokens(s).filter(x => score[x.w.toLowerCase()] && x.w.length >= 5).sort((a, b) => score[b.w.toLowerCase()] - score[a.w.toLowerCase()])[0];
    if (tk && !cards.some(c => c.a === tk.w)) cards.push({ a: tk.w, q: s.slice(0, tk.i) + '____' + s.slice(tk.i + tk.w.length) });
  });

  return { title: title || 'Tu material', paras, kws, score, sentences, cards, words: tokens(t).length };
}

/** Huecos de un párrafo: sus palabras más importantes (según el puntaje del documento), en orden de aparición. */
export function pickBlanks(p: string, score: Record<string, number>): Token[] {
  const tk = tokens(p), seen = new Set<string>();
  const c = tk.filter(x => { const l = x.w.toLowerCase(); if (!isKeyword(l, score) || seen.has(l)) return false; seen.add(l); return true; })
    .sort((a, b) => score[b.w.toLowerCase()] - score[a.w.toLowerCase()])
    .slice(0, Math.min(4, Math.max(2, Math.round(tk.length / 14))));
  return c.sort((a, b) => a.i - b.i);
}

/** Conceptos clave de un párrafo (en minúsculas). */
export function paraKeywords(p: string, score: Record<string, number>, n = 6): string[] {
  const seen = new Set<string>();
  return tokens(p).map(x => x.w.toLowerCase())
    .filter(l => { if (!isKeyword(l, score) || seen.has(l)) return false; seen.add(l); return true; })
    .sort((a, b) => score[b] - score[a]).slice(0, n);
}

/* ---------- PDF ---------- */
interface PdfTextItem { str: string; transform?: number[]; hasEOL?: boolean }
interface PdfJs {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument(src: { data: ArrayBuffer; isEvalSupported: boolean }): {
    promise: Promise<{ numPages: number; getPage(i: number): Promise<{ getTextContent(): Promise<{ items: PdfTextItem[] }> }> }>;
  };
}
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
const MAX_PAGES = 80;
let pdfReady: Promise<void> | null = null;

function loadScript(src: string) {
  return new Promise<void>((ok, no) => {
    const s = document.createElement('script'); s.src = src;
    s.onload = () => ok(); s.onerror = () => no(new Error('No se pudo cargar el lector de PDF.'));
    document.head.append(s);
  });
}

/** Texto de un PDF con pdf.js (se carga la primera vez que se usa, así no pesa en el resto de la app). */
export async function pdfText(file: File) {
  const w = window as Window & { pdfjsLib?: PdfJs };
  pdfReady = pdfReady || loadScript(PDFJS + 'pdf.min.js').then(() => loadScript(PDFJS + 'pdf.worker.min.js'))
    .then(() => { w.pdfjsLib!.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js'; });
  await pdfReady;
  const pdf = await w.pdfjsLib!.getDocument({ data: await file.arrayBuffer(), isEvalSupported: false }).promise;
  let out = '';
  for (let i = 1; i <= Math.min(pdf.numPages, MAX_PAGES); i++) {
    const tc = await (await pdf.getPage(i)).getTextContent(); let lastY: number | null = null, line = '';
    for (const it of tc.items) {
      // salto de renglón grande = párrafo nuevo; salto chico = misma línea con espacio
      const y = it.transform ? it.transform[5] : null;
      if (lastY != null && y != null && Math.abs(y - lastY) > 14) line += '\n';
      else if (lastY != null && y != null && Math.abs(y - lastY) > 2 && !line.endsWith(' ')) line += ' ';
      line += it.str; if (it.hasEOL) line += '\n'; lastY = y;
    }
    out += line + '\n\n';
  }
  return out;
}
