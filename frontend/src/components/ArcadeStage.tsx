'use client';

import { useEffect, useState } from 'react';
import ElectricBorder from '@/components/bits/ElectricBorder';
import { cssColor } from '@/lib/theme';

/** Escenario del arcade. En modo fiebre aparece un borde eléctrico (React Bits) encima,
    sin tocar el canvas del juego. */
export default function ArcadeStage({ stageRef, children }: { stageRef?: React.Ref<HTMLDivElement>; children?: React.ReactNode }) {
  const [fever, setFever] = useState(false);
  const [color, setColor] = useState('#34A3F0');

  useEffect(() => {
    const onFever = (e: Event) => {
      const on = !!(e as CustomEvent).detail;
      if (on) setColor(cssColor('--accent', '#34A3F0'));
      setFever(on && !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    };
    window.addEventListener('tecla:fever', onFever);
    return () => window.removeEventListener('tecla:fever', onFever);
  }, []);

  return (
    <div className="stage-wrap">
      <div className="stage" id="arc-stage" ref={stageRef}><canvas />{children}</div>
      {fever && (
        <div className="fever-fx" aria-hidden="true">
          <ElectricBorder color={color} speed={1.3} chaos={0.14} borderRadius={14}>
            <div className="fever-fill" />
          </ElectricBorder>
        </div>
      )}
    </div>
  );
}
