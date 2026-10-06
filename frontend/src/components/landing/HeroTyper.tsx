'use client';

/* El título de la portada se tipea: el visitante empieza a escribir apenas entra.
   Cada tecla se avisa con "tecla:press" (el teclado 3D la hunde); al completar la frase
   se muestra la velocidad, el teclado festeja con una ola y aparece la siguiente frase. */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useKeys, useStateRef } from '@/lib/useKeys';
import { focusKb } from '@/lib/tecla/input';

const PHRASES = ['escribí más rápido.', 'ganale a tu fantasma.', 'estudiá tipeando.', 'jugá con palabras.'];
const emit = (name: string, detail?: string) => window.dispatchEvent(new CustomEvent(name, { detail }));

export default function HeroTyper() {
  const [pi, setPi, piRef] = useStateRef(0);
  const [typed, setTyped, typedRef] = useStateRef('');
  const [done, setDone, doneRef] = useStateRef<{ wpm: number; acc: number } | null>(null);
  const t0 = useRef(0), keys = useRef({ all: 0, ok: 0 });
  const phrase = PHRASES[pi];

  const next = () => { setPi((piRef.current + 1) % PHRASES.length); setTyped(''); setDone(null); t0.current = 0; keys.current = { all: 0, ok: 0 }; };

  useKeys({
    char: c => {
      // las teclas llegan más rápido que los renders: se lee lo último desde las refs
      const phrase = PHRASES[piRef.current], typed = typedRef.current;
      if (doneRef.current) { if (c === ' ') return; next(); return; }
      if (typed.length >= phrase.length) return;
      if (!t0.current) t0.current = performance.now();
      emit('tecla:press', c);
      const ok = phrase[typed.length] === c;
      keys.current.all++; if (ok) keys.current.ok++;
      const nt = typed + c;
      setTyped(nt);
      if (nt === phrase) {
        const secs = Math.max(0.5, (performance.now() - t0.current) / 1000);
        setDone({ wpm: Math.round(phrase.length / 5 / (secs / 60)), acc: Math.round(keys.current.ok / keys.current.all * 100) });
        emit('tecla:wave');
      }
    },
    back: ctrl => { if (doneRef.current) return; setTyped(ctrl ? '' : typedRef.current.slice(0, -1)); },
    tab: next,
    enter: () => { if (doneRef.current) next(); },
  });

  // sin interacción, a los pocos segundos aparece una pista
  const [hint, setHint] = useState(false);
  useEffect(() => { const t = setTimeout(() => setHint(true), 2500); return () => clearTimeout(t); }, []);

  return (
    <>
      {/* tocar el título enfoca la entrada de teclado (en el celular abre el teclado virtual) */}
      <h1 className="hero-title hero-typer" aria-label={phrase} onMouseDown={e => { e.preventDefault(); focusKb(); }}>
        {[...phrase].map((ch, i) => {
          const t = typed[i], cls = t == null ? 'todo' : t === ch ? 'ok' : 'bad';
          return (
            <span key={i} className={'ht-l ' + cls}>
              {i === typed.length && !done && <span className="ht-caret" aria-hidden="true" />}
              {cls === 'bad' && ch === ' ' ? '·' : ch}
            </span>
          );
        })}
        {done && <span className="ht-caret end" aria-hidden="true" />}
      </h1>
      <p className={'hero-typer-hint' + (hint || typed ? ' on' : '')} aria-live="polite">
        {done
          ? <><b>{done.wpm} ppm</b> · {done.acc}% de precisión · <Link href="/test">medite en serio →</Link> <span className="sub">(o seguí tipeando)</span></>
          : typed ? <>seguí… <kbd>tab</kbd> cambia la frase</> : <>empezá a escribir la frase de arriba</>}
      </p>
    </>
  );
}
