/* =========================================================
   puente para usar componentes de React Bits dentro de las vistas
   imperativas (test, estudio…): monta una raíz de React chiquita
   sobre un elemento que ya existe en el DOM.
   ========================================================= */
import type { ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import CountUp from '@/components/bits/CountUp';
import ShinyText from '@/components/bits/ShinyText';
import Tabs, { type TabItem } from '@/components/ui/Tabs';

const roots = new WeakMap<Element, Root>();

function render(el: Element | null | undefined, node: ReactNode) {
  if (!el) return;
  let root = roots.get(el);
  if (!root) { el.textContent = ''; root = createRoot(el); roots.set(el, root); }
  root.render(node);
}

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Número que sube contando hasta `to`. */
export function countUp(el: Element | null | undefined, to: number, opts: { suffix?: string; duration?: number; separator?: string } = {}) {
  if (!el) return;
  if (reduced()) { el.textContent = to.toLocaleString('es') + (opts.suffix || ''); return; }
  render(el, <><CountUp to={to} duration={opts.duration ?? 0.9} separator={opts.separator ?? '.'} />{opts.suffix}</>);
}

/** Texto con un brillo que lo recorre. */
export function shiny(el: Element | null | undefined, text: string) {
  if (!el) return;
  if (reduced()) { el.textContent = text; return; }
  render(el, <ShinyText text={text} color="var(--accent)" shineColor="#ffffff" speed={2.2} spread={110} />);
}

/** Pestañas (las mismas que usan los componentes de React): se vuelven a dibujar al cambiar la elegida. */
export function tabs(el: Element | null | undefined, props: { items: TabItem[]; value: string; onChange: (id: string) => void; variant?: 'text' | 'card'; label?: string }) {
  render(el, <Tabs {...props} />);
}

