'use client';

import { useEffect, useRef } from 'react';

/** Muestra un nodo del DOM armado fuera de React (por ejemplo, los gráficos SVG de lib/tecla/charts). */
export default function DomNode({ node, className }: { node: Node | null; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const el = ref.current; if (!el) return; el.replaceChildren(); if (node) el.append(node); }, [node]);
  return <div ref={ref} className={className} />;
}
