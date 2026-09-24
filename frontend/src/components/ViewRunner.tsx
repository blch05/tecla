'use client';

import { useEffect } from 'react';

type ViewName = 'arcade';

interface View { init?: () => void; enter?: () => void; leave?: () => void }

// cada vista es un módulo imperativo (DOM + canvas) que se monta sobre el markup de su página
const loaders: Record<ViewName, () => Promise<View>> = {
  arcade: () => import('@/lib/tecla/views/arcade').then(m => m.Arc),
};

export default function ViewRunner({ view }: { view: ViewName }) {
  useEffect(() => {
    let active: View | null = null;
    let cancelled = false;
    loaders[view]().then(v => {
      if (cancelled) return;
      active = v;
      v.init?.();
      v.enter?.();
    });
    return () => { cancelled = true; active?.leave?.(); };
  }, [view]);
  return null;
}
