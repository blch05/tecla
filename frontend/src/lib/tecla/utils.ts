/* =========================================================
   tecla* — utilidades
   ========================================================= */

/** Primer elemento que coincide con el selector. Se usa sobre markup que la propia vista acaba de armar. */
export const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document): T => r.querySelector(s) as T;
export const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document): T[] => [...r.querySelectorAll<T>(s)];

type Attr = string | number | boolean | null | undefined | EventListener;
type Kid = Node | string | number | null | undefined | false | Kid[];

/** Crea un elemento: `h('div', { class: 'x', onclick: fn }, hijo1, 'texto')`. */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs?: Record<string, Attr> | null, ...kids: Kid[]): HTMLElementTagNameMap[K];
export function h(tag: string, attrs?: Record<string, Attr> | null, ...kids: Kid[]): HTMLElement;
export function h(tag: string, attrs: Record<string, Attr> | null = {}, ...kids: Kid[]): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = String(v);
    else if (k === 'text') el.textContent = String(v);
    else if (k === 'style') el.style.cssText = String(v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v as EventListener);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const k of (kids as unknown[]).flat(Infinity) as Kid[]) {
    if (k == null || k === false || k === '') continue;
    el.append(typeof k === 'object' ? (k as Node) : String(k));
  }
  return el;
}

/** localStorage con prefijo y JSON; nunca tira (modo privado, cuota llena, SSR). */
export const store = {
  get<T>(k: string, d: T): T { try { const v = localStorage.getItem('tecla:' + k); return v ? (JSON.parse(v) as T) : d; } catch { return d; } },
  set(k: string, v: unknown) { try { localStorage.setItem('tecla:' + k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } },
  del(k: string) { try { localStorage.removeItem('tecla:' + k); } catch { /* sin almacenamiento */ } },
};

export const now = () => performance.now();
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
export const rand = () => Math.floor(Math.random() * 2 ** 31);

/** Generador pseudoaleatorio con semilla (mulberry32): misma semilla, misma secuencia en todos los jugadores. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
export function shuffle<T>(arr: readonly T[], r: () => number = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** minúsculas y sin tildes */
export const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export const ACC: Record<string, string> = { 'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ü': 'u' };
/** La tecla física de una letra: "Á" y "á" cuentan como "a" en el mapa de calor. */
export const baseKey = (k: string) => { k = k.toLowerCase(); return ACC[k] || k; };

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(msg: string, ms = 2200) {
  const t = $('#toast'); if (!t) return;
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), ms);
}
/** fecha local como AAAA-MM-DD */
export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const todayKey = () => dayKey(new Date());

/* navegación: la reemplaza el router de Next al montar la app */
export const nav = { go: (p: string) => { location.href = p; } };
