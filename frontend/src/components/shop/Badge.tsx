'use client';

/* Insignia animada junto al nombre (lottie-web, versión liviana con SVG). */
import { useEffect, useRef } from 'react';
import { badgeAnim } from '@/lib/shop/badges';

export default function Badge({ fx, size = 26, title }: { fx?: string; size?: number; title?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current, data = fx ? badgeAnim(fx) : null;
    if (!el || !data) return;
    let alive = true, off = () => {};
    import('lottie-web/build/player/lottie_light').then(({ default: lottie }) => {
      if (!alive) return;
      const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const a = lottie.loadAnimation({ container: el, renderer: 'svg', loop: !still, autoplay: !still, animationData: data });
      if (still) a.goToAndStop(20, true);
      off = () => a.destroy();
    });
    return () => { alive = false; off(); };
  }, [fx]);
  if (!fx || !badgeAnim(fx)) return null;
  return <span ref={ref} className="badge-anim" style={{ width: size, height: size }} title={title} aria-label={title} role="img" />;
}
