'use client';

/* Dibuja una escena del test (lib/scenes). Dos modos:
   - en el test: escucha "tecla:flow" (velocidad) y "tecla:scene" (teclas, palabras, fin);
   - demo (vista previa de la tienda): se inventa un tipeo para mostrar cómo reacciona.
   Las escenas pixeladas dibujan a baja resolución y el canvas se agranda sin suavizar.
   Con "reducir movimiento" se dibuja un solo cuadro. */
import { useEffect, useRef } from 'react';
import { DEFAULT_SCENE, SCENES, type SceneEvent } from '@/lib/scenes';
import { readPalette } from '@/lib/scenes/pixel';
import type { Env } from '@/lib/scenes/types';

export const emitScene = (e: SceneEvent) => window.dispatchEvent(new CustomEvent('tecla:scene', { detail: e }));

export default function SceneCanvas({ scene, demo = false, className = 'flow-bg' }: { scene?: string; demo?: boolean; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const id = scene && SCENES[scene] ? scene : DEFAULT_SCENE;

  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext('2d'); if (!ctx) return;
    const def = SCENES[id], s = def.make(), px = def.pixel;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const env: Env = { W: 0, H: 0, pal: readPalette(), t: 0, flow: 0 };
    const mo = new MutationObserver(() => { env.pal = readPalette(); });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-accent', 'style'] });

    const resize = () => {
      const dpr = px > 1 ? 1 : Math.min(2, window.devicePixelRatio || 1);
      env.W = Math.max(1, Math.round(cv.clientWidth / px)); env.H = Math.max(1, Math.round(cv.clientHeight / px));
      cv.width = env.W * dpr; cv.height = env.H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.imageSmoothingEnabled = px === 1;
      if (still) s.frame(ctx, env, 0);
    };
    resize(); const ro = new ResizeObserver(resize); ro.observe(cv);

    let target = 0, raf = 0, last = performance.now();
    const onFlow = (e: Event) => { target = Math.max(0, Math.min(1, Number((e as CustomEvent).detail) || 0)); };
    const onScene = (e: Event) => s.on?.((e as CustomEvent<SceneEvent>).detail, env);
    if (!demo) { window.addEventListener('tecla:flow', onFlow); window.addEventListener('tecla:scene', onScene); }

    // demo: un tipeo inventado a ~6 letras por segundo, con algún error de vez en cuando
    let demoT = 0, letters = 0;
    const fakeTyping = (dt: number) => {
      demoT -= dt; target = 0.55 + 0.4 * Math.sin(env.t * 0.4);
      if (demoT > 0) return;
      demoT = 0.12 + Math.random() * 0.1;
      const ok = Math.random() > 0.06;
      s.on?.({ type: 'key', ok }, env);
      if (++letters % 5 === 0) s.on?.({ type: 'word', ok }, env);
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (demo) fakeTyping(dt);
      env.flow += (target - env.flow) * Math.min(1, dt * 1.2); env.t += dt;
      s.frame(ctx, env, dt);
      raf = requestAnimationFrame(frame);
    };
    if (!still) raf = requestAnimationFrame(frame);
    // depuración en desarrollo: avanzar la escena a mano (window.__teclaScene.step(segundos))
    if (process.env.NODE_ENV !== 'production') (window as unknown as { __teclaScene: unknown }).__teclaScene = {
      step: (secs: number) => { for (let i = 0; i < secs * 60; i++) { if (demo) fakeTyping(1 / 60); env.flow += (target - env.flow) * 0.02; env.t += 1 / 60; s.frame(ctx, env, 1 / 60); } },
      fire: (e: SceneEvent) => s.on?.(e, env),
    };
    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); mo.disconnect();
      window.removeEventListener('tecla:flow', onFlow); window.removeEventListener('tecla:scene', onScene);
    };
  }, [id, demo]);

  return <canvas ref={ref} className={className + (SCENES[id].pixel > 1 ? ' pixelated' : '')} aria-hidden="true" />;
}
