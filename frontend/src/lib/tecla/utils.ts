// @ts-nocheck — módulo portado del prototipo; pendiente de tipar (ver README)
/* =========================================================
   tecla* — utilidades
   ========================================================= */
export const $ = (s: string, r: any = document): any => r.querySelector(s);
export const $$ = (s: string, r: any = document): any[] => [...r.querySelectorAll(s)];
export function h(tag: string, attrs: Record<string, any> | null = {}, ...kids: any[]): any {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) {
    if (k == null || k === false || k === '') continue;
    el.append(k.nodeType ? k : document.createTextNode(k));
  }
  return el;
}
export const store: any = {
  get(k, d) { try { const v = localStorage.getItem('tecla:' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('tecla:' + k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem('tecla:' + k); } catch {} },
};
export const now = () => performance.now();
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
export const rand = () => Math.floor(Math.random() * 2 ** 31);
export function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function shuffle(arr, r = Math.random) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export const ACC: any = { 'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ü': 'u' };
export const baseKey = k => { k = k.toLowerCase(); return ACC[k] || k; };
export function toast(msg, ms = 2200) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, ms); }
export function todayKey() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

/* navegación: la reemplaza el router de Next al montar la app */
export const nav = { go: (p: string) => { location.href = p; } };
