'use client';

/* El teclado de la app (el input oculto que reparte las teclas) como hook de React.
   Los manejadores pueden cambiar en cada render: el consumidor registrado siempre llama a los últimos.
   Pasá null para no capturar el teclado (por ejemplo, mientras se escribe en un textarea). */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Consumer } from '@/lib/tecla/input';

export function useKeys(handlers: Consumer | null) {
  const ref = useRef<Consumer | null>(handlers);
  ref.current = handlers;
  const on = !!handlers;
  useEffect(() => {
    let off = false;
    const proxy: Consumer = {
      char: c => ref.current?.char?.(c),
      back: x => ref.current?.back?.(x),
      enter: () => ref.current?.enter?.(),
      tab: () => ref.current?.tab?.(),
      esc: () => ref.current?.esc?.(),
    };
    import('@/lib/tecla/input').then(m => {
      if (off) return;
      if (on) m.setConsumer(proxy); else { m.setConsumer(null); m.blurKb(); }
    });
    return () => { off = true; import('@/lib/tecla/input').then(m => { if (m.getConsumer() === proxy) m.setConsumer(null); }); };
  }, [on]);
}

/** useState que además guarda el valor al instante en una ref: las teclas llegan más rápido que los renders,
 *  así que los manejadores de teclado leen siempre lo último (ref.current) y no el valor del último render. */
export function useStateRef<T>(initial: T) {
  const [val, setVal] = useState(initial);
  const ref = useRef(val);
  const set = useCallback((v: T | ((prev: T) => T)) => {
    const next = typeof v === 'function' ? (v as (p: T) => T)(ref.current) : v;
    ref.current = next; setVal(next);
  }, []);
  return [val, set, ref] as const;
}
