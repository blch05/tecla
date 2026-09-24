'use client';

/* Arcade: pestañas de juego, dificultad, panel de puntos y las pantallas encima del canvas.
   El juego en sí (Arcade, lib/tecla/views/arcade.ts) sigue dibujando en el canvas. */
import { useEffect, useRef, useState } from 'react';
import Tabs from '@/components/ui/Tabs';
import ArcadeStage from '@/components/ArcadeStage';
import ArcadeOverlay, { type OverlaySpec } from './arcade/ArcadeOverlay';
import { gameTabs } from '@/lib/games';
import type { RoomGame } from '@/lib/rooms';

interface Hud { score: number; levelLabel: string; level: number; lives: string; wpm: number; acc: string; combo: string; hot: boolean; best: number }
const KINDS: RoomGame[] = ['caen', 'torre', 'runner', 'bombas'];

export default function ArcadeView() {
  const stageRef = useRef<HTMLDivElement>(null);
  const [game, setGame] = useState<any>(null);
  const [mods, setMods] = useState<any>(null);
  const [kind, setKind] = useState<string>('caen');
  const [spec, setSpec] = useState<OverlaySpec | null>(null);
  const [hud, setHud] = useState<Hud | null>(null);
  const [sound, setSound] = useState(false);
  const [, bump] = useState(0);

  useEffect(() => {
    let g: any = null, alive = true;
    const onHide = () => g?.abandon();
    const onVis = () => { if (document.hidden && g?.running) g.esc(); };
    Promise.all([import('@/lib/tecla/views/arcade'), import('@/lib/tecla/utils')]).then(([a, u]) => {
      if (!alive || !stageRef.current) return;
      g = new a.Arcade(stageRef.current, { overlay: (s: OverlaySpec | null) => setSpec(s ? { ...s } : null), hud: (h: Hud) => setHud(h), changed: () => bump(x => x + 1) });
      if (process.env.NODE_ENV !== 'production') (window as any).__teclaArc = { game: g }; // depuración en desarrollo
      const k = u.store.get('arcMode', 'caen');
      setMods({ ADIFF: a.ADIFF, DIFF_DESC: a.DIFF_DESC, Sfx: a.Sfx, store: u.store });
      setSound(!!a.Sfx.on); setKind(k); setGame(g);
      g.resize(); g.setKind(k);
    });
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      alive = false;
      window.removeEventListener('pagehide', onHide); document.removeEventListener('visibilitychange', onVis);
      g?.abandon(); g?.destroy();
      import('@/lib/tecla/input').then(m => m.setConsumer(null));
    };
  }, []);

  const pickGame = (k: string) => { setKind(k); mods?.store.set('arcMode', k); game?.setKind(k); };
  const toggleSound = () => {
    const S = mods.Sfx; S.on = !S.on; mods.store.set('sfx', S.on); setSound(S.on);
    if (S.on) { S.init(); S.power(); }
    import('@/lib/tecla/input').then(m => m.focusKb());
  };

  const diff = game?.diffKey?.() || 'medio', D = mods?.ADIFF[diff];
  return (
    <>
      <div className="arc-top">
        <div className="subtabs"><Tabs variant="card" items={gameTabs(KINDS, false)} value={kind} onChange={pickGame} label="juegos del arcade" /></div>
        {mods && game && (
          <div className="diffbar">
            <div className="cfgbar">
              <span className="lbl" style={{ marginRight: 4 }}>dificultad</span>
              <Tabs items={Object.entries(mods.ADIFF as Record<string, { name: string }>).map(([id, d]) => ({ id, label: d.name }))} value={diff} onChange={k => game.setDiff(k)} label="dificultad" />
            </div>
            <span className="hint">{mods.DIFF_DESC[kind]?.[diff]} · puntos ×{String(D?.pts).replace('.', ',')} · récord {mods.store.get(game.bestKey(), 0)}</span>
          </div>
        )}
      </div>
      <div className="hud">
        <span>puntos <b>{hud?.score ?? 0}</b></span>
        <span>{hud?.levelLabel ?? 'nivel'} <b>{hud?.level ?? 1}</b></span>
        <span>vidas <b className="lives">{hud?.lives ?? ''}</b></span>
        <span>combo <b className={hud?.hot ? 'hot' : ''}>{hud?.combo ?? 'x0'}</b></span>
        <span>ppm <b>{hud?.wpm ?? 0}</b></span>
        <span>precisión <b>{hud?.acc ?? '100%'}</b></span>
        <span>récord <b>{hud?.best ?? 0}</b></span>
        <button className="opt" type="button" onClick={toggleSound} disabled={!mods}>{sound ? '♪ sonido sí' : '♪ sonido no'}</button>
      </div>
      <ArcadeStage stageRef={stageRef}>
        <ArcadeOverlay game={game} spec={spec} />
      </ArcadeStage>
    </>
  );
}
