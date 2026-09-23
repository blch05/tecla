'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import SpotlightCard from '@/components/bits/SpotlightCard';
import { cssColor } from '@/lib/theme';
import DotGrid from '@/components/bits/DotGrid';
import StarBorder from '@/components/bits/StarBorder';
import TextType from '@/components/bits/TextType';

const FEATURES = [
  { href: '/test', glyph: '|', title: 'test con fantasma', text: 'Corré contra tu mejor marca y mirá qué teclas te frenan.' },
  { href: '/arcade', glyph: '*', title: 'arcade', text: 'Palabras que caen, defensa de torre, runner y bombas.' },
  { href: '/competir', glyph: '—', title: 'competir', text: 'Carreras, battle royale y un desafío nuevo cada día.' },
  { href: '/estudiar', glyph: '/', title: 'estudiar', text: 'Subí tu PDF y repasalo con huecos, flashcards y dictado.' },
];

export default function Landing() {
  // la grilla de puntos necesita colores concretos: los leemos del tema y los actualizamos si cambia
  const [dots, setDots] = useState({ base: '#D6E8F7', active: '#34A3F0' });
  useEffect(() => {
    const read = () => setDots({ base: cssColor('--dim', '#D6E8F7'), active: cssColor('--accent', '#34A3F0') });
    read(); window.addEventListener('tecla:theme', read);
    return () => window.removeEventListener('tecla:theme', read);
  }, []);

  return (
    <section className="view landing">
      <div className="landing-bg" aria-hidden="true">
        <DotGrid
          dotSize={4}
          gap={26}
          baseColor={dots.base}
          activeColor={dots.active}
          proximity={130}
          shockRadius={220}
          shockStrength={4}
          resistance={750}
          returnDuration={1.4}
        />
      </div>

      <div className="hero">
        <span className="eyebrow">* — práctica de tipeo</span>
        <h1 className="hero-title">
          <TextType
            as="span"
            text={['escribí más rápido.', 'estudiá tipeando.', 'ganale a tu fantasma.', 'jugá con palabras.']}
            typingSpeed={55}
            deletingSpeed={28}
            pauseDuration={1900}
            variableSpeed={{ min: 35, max: 95 }}
            cursorCharacter="|"
            cursorClassName="hero-cursor"
          />
        </h1>
        <p className="hero-sub">
          Un teclado, un texto y nada más. Medí tu velocidad, entrená tus puntos débiles, competí y repasá tus apuntes mientras tipeás.
        </p>
        <div className="hero-cta">
          <StarBorder
            as={Link}
            href="/test"
            className="cta-star"
            color="var(--accent-2)"
            speed="5s"
            thickness={2}
            backgroundColor="var(--accent)"
            textColor="#FFFFFF"
            borderColor="var(--accent)"
          >
            empezar un test
          </StarBorder>
          <Link className="btn ghost" href="/competir">desafío del día →</Link>
        </div>
        <p className="hero-meta">2.087 palabras · 3 dificultades · 4 juegos · 5 modos de estudio</p>
      </div>

      <div className="features">
        {FEATURES.map(f => (
          <Link key={f.href} href={f.href} className="feature-link">
            <SpotlightCard className="feature" spotlightColor="rgba(52, 163, 240, 0.22)">
              <span className="feature-glyph" aria-hidden="true">{f.glyph}</span>
              <b>{f.title}</b>
              <span>{f.text}</span>
            </SpotlightCard>
          </Link>
        ))}
      </div>
    </section>
  );
}
