'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Piezas globales que viven fuera de las vistas: el input oculto que recibe el teclado,
 * el aviso flotante, la decoración y el guardado al cerrar la pestaña.
 * Los módulos de tecla* se cargan dinámicamente para que nunca corran en el servidor.
 */
export default function AppShell() {
  const kbRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    let off = () => {};
    Promise.all([
      import('@/lib/tecla/input'),
      import('@/lib/tecla/utils'),
      import('@/lib/tecla/decor'),
      import('@/lib/tecla/history'),
      import('@/lib/tecla/keystats'),
      import('@/lib/tecla/views/arcade'),
      import('@/lib/tecla/views/study'),
    ]).then(([input, utils, decor, history, keystats, arcade, study]) => {
      if (kbRef.current) input.initInput(kbRef.current);
      utils.nav.go = (p: string) => router.push(p);
      decor.decorate();
      history.History.init();
      // al cerrar o esconder la pestaña: guardar lo que haya en curso
      const onHide = () => { keystats.saveKS(); arcade.Arc.game?.abandon(); study.Study.flush(); };
      const onVis = () => { if (document.hidden) { keystats.saveKS(); if (arcade.Arc.game?.running) arcade.Arc.game.esc(); } };
      window.addEventListener('pagehide', onHide);
      document.addEventListener('visibilitychange', onVis);
      off = () => { window.removeEventListener('pagehide', onHide); document.removeEventListener('visibilitychange', onVis); };
    });
    return () => off();
  }, [router]);

  return (
    <>
      <input
        id="kb"
        ref={kbRef}
        type="text"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-label="entrada de teclado"
      />
      <div className="toast" id="toast" hidden />
    </>
  );
}
