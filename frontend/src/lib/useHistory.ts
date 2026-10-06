'use client';

/* La sesión y el historial como hooks de React, sobre el store de Zustand (sessionStore).
   El historial vive en localStorage: hasta montar en el navegador se devuelve null,
   así el HTML del servidor coincide con el primer render del cliente. */
import { useEffect, useState } from 'react';
import { useStore } from 'zustand';
import { History, sessionStore, type SessionState } from '@/lib/tecla/history';
import { setConsumer } from '@/lib/tecla/input';

/** Lee una parte de la sesión (usuario, modo) y vuelve a dibujar solo cuando esa parte cambia. */
export function useSession<T>(selector: (s: SessionState) => T): T {
  return useStore(sessionStore, selector);
}
export const useUser = () => useSession(s => s.user);

/** El historial completo; vuelve a dibujar con cada partida guardada o sincronizada. */
export function useHistory() {
  const [mounted, setMounted] = useState(false);
  useSession(s => s.rev);
  useEffect(() => {
    setMounted(true);
    setConsumer(null); // estas vistas no capturan el teclado
  }, []);
  return mounted ? History : null;
}
