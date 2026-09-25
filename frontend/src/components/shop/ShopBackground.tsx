'use client';

/* Fondo animado de la tienda (tsParticles): va detrás de toda la página, sin tapar nada ni recibir clics.
   La librería se descarga solo si hay un fondo equipado. */
import { useEffect, useRef, useState } from 'react';
import { cosmetics } from '@/lib/shop/client';
import { cssColor } from '@/lib/theme';

function options(fx: string, dark: boolean) {
  const acc = cssColor('--accent', '#34A3F0'), acc2 = cssColor('--accent-2', '#92D2FF');
  const base = { fullScreen: { enable: false }, fpsLimit: 40, detectRetina: true, background: { color: 'transparent' } };
  if (fx === 'nieve') return { ...base, particles: {
    number: { value: 70 }, color: { value: dark ? ['#ffffff', acc2] : [acc2, acc] }, opacity: { value: { min: .25, max: .7 } },
    size: { value: { min: 1, max: 3.5 } }, move: { enable: true, direction: 'bottom', speed: { min: .4, max: 1.3 }, drift: { min: -.4, max: .4 }, outModes: { default: 'out' } },
  } };
  if (fx === 'estrellas') return { ...base, particles: {
    number: { value: 90 }, color: { value: dark ? ['#ffffff', acc2, '#F2D27A'] : [acc, acc2, '#D9A21B'] },
    opacity: { value: { min: .05, max: .85 }, animation: { enable: true, speed: .7, sync: false } },
    size: { value: { min: .6, max: 2.2 } }, move: { enable: true, speed: .08, direction: 'none', random: true, outModes: { default: 'out' } },
  } };
  if (fx === 'burbujas') return { ...base, particles: {
    number: { value: 26 }, color: { value: [acc, acc2] }, opacity: { value: { min: .12, max: .35 } },
    size: { value: { min: 4, max: 14 } }, move: { enable: true, direction: 'top', speed: { min: .3, max: .9 }, drift: { min: -.3, max: .3 }, outModes: { default: 'out' } },
  } };
  if (fx === 'luciernagas') return { ...base, particles: {
    number: { value: 34 }, color: { value: ['#F2D27A', '#FFE9A8', acc2] },
    opacity: { value: { min: .1, max: .95 }, animation: { enable: true, speed: 1.1, sync: false } },
    size: { value: { min: 1.4, max: 3.4 }, animation: { enable: true, speed: 2, sync: false } },
    move: { enable: true, speed: { min: .3, max: .9 }, direction: 'none', random: true, straight: false, outModes: { default: 'bounce' } },
  } };
  return null;
}

export default function ShopBackground() {
  const ref = useRef<HTMLDivElement>(null);
  const [equipped, setFx] = useState('');
  const [preview, setPreview] = useState(''); // la tienda deja probar un fondo unos segundos
  const fx = preview || equipped;
  const [bump, setBump] = useState(0); // al cambiar el tema se rearma con los colores nuevos

  useEffect(() => {
    setFx(cosmetics().fondo || '');
    const onCos = (e: Event) => setFx((e as CustomEvent).detail?.fondo || '');
    const onTheme = () => setBump(b => b + 1);
    let t = 0;
    const onPreview = (e: Event) => { clearTimeout(t); setPreview((e as CustomEvent).detail || ''); t = window.setTimeout(() => setPreview(''), 8000); };
    window.addEventListener('tecla:bg-preview', onPreview);
    window.addEventListener('tecla:cos', onCos); window.addEventListener('tecla:theme', onTheme);
    return () => { clearTimeout(t); window.removeEventListener('tecla:cos', onCos); window.removeEventListener('tecla:theme', onTheme); window.removeEventListener('tecla:bg-preview', onPreview); };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!fx || !el || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    let alive = true, stop = () => {};
    (async () => {
      const [{ tsParticles }, { loadSlim }] = await Promise.all([import('@tsparticles/engine'), import('@tsparticles/slim')]);
      await loadSlim(tsParticles);
      const opts = options(fx, document.documentElement.dataset.theme === 'dark');
      if (!alive || !opts) return;
      const c = await tsParticles.load({ id: 'shop-bg', element: el, options: opts as never });
      if (!alive) c?.destroy(); else stop = () => c?.destroy();
    })();
    return () => { alive = false; stop(); };
  }, [fx, bump]);

  return fx ? <div ref={ref} id="shop-bg" className="shop-bg" aria-hidden="true" /> : null;
}
