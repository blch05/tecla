'use client';

/* Arcade: pestañas de juego, dificultad, panel de puntos y las pantallas encima del canvas.
   El juego en sí (Arcade, lib/arcade/engine.ts) dibuja en el canvas y avisa a React qué mostrar. */
import { useEffect, useRef, useState } from 'react';
import Tabs from '@/components/ui/Tabs';
import PageHeader from '@/components/ui/PageHeader';
import ArcadeStage from '@/components/ArcadeStage';
import ArcadeOverlay from './arcade/ArcadeOverlay';
import { Arcade } from '@/lib/arcade/engine';
import { ADIFF, DIFF_DESC } from '@/lib/arcade/config';
import type { ArcadeDiff, ArcadeKind, HudState, OverlaySpec } from '@/lib/arcade/types';
import { Sfx } from '@/lib/tecla/sfx';
import { store } from '@/lib/tecla/utils';
import { focusKb, setConsumer } from '@/lib/tecla/input';
import { gameTabs } from '@/lib/games';

const KINDS: ArcadeKind[] = ['caen', 'torre', 'runner', 'bombas'];

export default function ArcadeView() {
  const stageRef = useRef<HTMLDivElement>(null);
  const [game, setGame] = useState<Arcade | null>(null);
  const [kind, setKind] = useState<ArcadeKind>('caen');
  const [spec, setSpec] = useState<OverlaySpec | null>(null);
  const [hud, setHud] = useState<HudState | null>(null);
  const [sound, setSound] = useState(false);
  const [, bump] = useState(0);

  useEffect(() => {
    if (!stageRef.current) return;
    const g = new Arcade(stageRef.current, { overlay: s => setSpec(s ? { ...s } : null), hud: setHud, changed: () => bump(x => x + 1) });
    if (process.env.NODE_ENV !== 'production') (window as unknown as { __teclaArc: unknown }).__teclaArc = { game: g }; // depuración en desarrollo
    const k = store.get<ArcadeKind>('arcMode', 'caen');
    setSound(Sfx.on); setKind(k); setGame(g);
    g.resize(); g.setKind(k);

    // al cerrar o esconder la pestaña: guardar lo jugado y pausar
    const onHide = () => g.abandon();
    const onVis = () => { if (document.hidden && g.running) g.esc(); };
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('pagehide', onHide); document.removeEventListener('visibilitychange', onVis);
      g.abandon(); g.destroy();
      setConsumer(null);
    };
  }, []);

  const pickGame = (k: string) => { const kk = k as ArcadeKind; setKind(kk); store.set('arcMode', kk); game?.setKind(kk); };
  const toggleSound = () => {
    Sfx.on = !Sfx.on; store.set('sfx', Sfx.on); setSound(Sfx.on);
    if (Sfx.on) { Sfx.init(); Sfx.power(); }
    focusKb();
  };

  const diff = game?.diffKey() || 'medio', D = ADIFF[diff];
  return (
    <>
      <PageHeader eyebrow="* — minijuegos" title="arcade">
        <Tabs variant="card" items={gameTabs(KINDS, false)} value={kind} onChange={pickGame} label="juegos del arcade" />
      </PageHeader>
      <div className="arc-top">
        {game && (
          <div className="diffbar">
            <div className="cfgbar">
              <span className="lbl" style={{ marginRight: 4 }}>dificultad</span>
              <Tabs items={Object.entries(ADIFF).map(([id, d]) => ({ id, label: d.name }))} value={diff} onChange={k => game.setDiff(k as ArcadeDiff)} label="dificultad" />
            </div>
            <span className="hint">{DIFF_DESC[kind][diff]} · puntos ×{String(D.pts).replace('.', ',')} · récord {store.get(game.bestKey(), 0)}</span>
          </div>
        )}
        <div className="hud">
          <span>puntos <b>{hud?.score ?? 0}</b></span>
          <span>{hud?.levelLabel ?? 'nivel'} <b>{hud?.level ?? 1}</b></span>
          <span>vidas <b className="lives">{hud?.lives ?? ''}</b></span>
          <span>combo <b className={hud?.hot ? 'hot' : ''}>{hud?.combo ?? 'x0'}</b></span>
          <span>ppm <b>{hud?.wpm ?? 0}</b></span>
          <span>precisión <b>{hud?.acc ?? '100%'}</b></span>
          <span>récord <b>{hud?.best ?? 0}</b></span>
          <button className="opt" type="button" onClick={toggleSound} disabled={!game}>{sound ? '♪ sonido sí' : '♪ sonido no'}</button>
        </div>
      </div>
      <ArcadeStage stageRef={stageRef}>
        <ArcadeOverlay game={game} spec={spec} />
      </ArcadeStage>
    </>
  );
}
