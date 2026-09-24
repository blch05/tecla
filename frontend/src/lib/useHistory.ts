'use client';

/* El historial (History) como hook de React: lo carga en el navegador (usa localStorage,
   así que nunca corre en el servidor) y vuelve a dibujar cuando cambia. */
import { useEffect, useState } from 'react';
import type { History as HistoryT } from '@/lib/tecla/history';

export function useHistory() {
  const [H, setH] = useState<typeof HistoryT | null>(null);
  const [, bump] = useState(0);
  useEffect(() => {
    let off = () => {}, alive = true;
    import('@/lib/tecla/history').then(({ History }) => {
      if (!alive) return;
      setH(History);
      off = History.subscribe(() => bump(x => x + 1));
    });
    import('@/lib/tecla/input').then(m => m.setConsumer(null)); // estas vistas no capturan el teclado
    return () => { alive = false; off(); };
  }, []);
  return H;
}
