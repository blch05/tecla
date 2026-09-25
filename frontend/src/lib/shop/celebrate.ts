/* Festejos (canvas-confetti): lo que salta al terminar un test, batir un récord o ganar.
   Solo si hay uno equipado; la librería se descarga la primera vez que se usa. */
import { cosmetics } from '@/lib/shop/client';
import { cssColor } from '@/lib/theme';

export type Moment = 'fin' | 'record' | 'win';

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Festeja con lo equipado (o con `fx`, para la vista previa de la tienda). */
export async function celebrate(moment: Moment, fx = cosmetics().festejo) {
  if (!fx || typeof window === 'undefined' || reduced()) return;
  const { default: confetti } = await import('canvas-confetti');
  const colors = [cssColor('--accent', '#34A3F0'), cssColor('--accent-2', '#92D2FF'), '#F2B13C', '#F0607A', '#1DB386'];
  const big = moment !== 'fin', base = { colors, disableForReducedMotion: true, zIndex: 60 };

  if (fx === 'confeti') {
    confetti({ ...base, particleCount: big ? 140 : 70, spread: 80, startVelocity: 42, origin: { y: .72 } });
    if (big) {
      confetti({ ...base, particleCount: 60, angle: 60, spread: 60, origin: { x: 0, y: .8 } });
      confetti({ ...base, particleCount: 60, angle: 120, spread: 60, origin: { x: 1, y: .8 } });
    }
  } else if (fx === 'asteriscos') {
    // el asterisco de tecla*, en los colores del tema
    const scalar = 2.2, shapes = colors.map(color => confetti.shapeFromText({ text: '✱', scalar, color }));
    const shot = (x: number) => confetti({ ...base, shapes, scalar, particleCount: big ? 45 : 26, spread: 110, startVelocity: 36, gravity: .7, ticks: 260, origin: { x, y: .65 } });
    shot(.5); if (big) { setTimeout(() => shot(.25), 180); setTimeout(() => shot(.75), 360); }
  } else if (fx === 'estrellas') {
    const shot = () => confetti({ ...base, shapes: ['star'], colors: ['#F2D27A', '#F2B13C', colors[1]], particleCount: big ? 30 : 18, spread: 360, startVelocity: 26, gravity: .35, decay: .92, scalar: 1.3, ticks: 120, origin: { x: .5, y: .45 } });
    shot(); setTimeout(shot, 120); if (big) { setTimeout(shot, 260); setTimeout(shot, 420); }
  } else if (fx === 'fuegos') {
    // varios estallidos en lugares al azar durante un rato
    const end = Date.now() + (big ? 2600 : 1300);
    const id = setInterval(() => {
      if (Date.now() > end) return clearInterval(id);
      confetti({ ...base, particleCount: 46, spread: 360, startVelocity: 28, ticks: 70, gravity: .9, origin: { x: .15 + Math.random() * .7, y: .15 + Math.random() * .35 } });
    }, 260);
  }
}
