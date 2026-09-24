'use client';

/* Pantallas encima del canvas del arcade: inicio, pausa, mejoras, fin y los avisos de las salas online.
   El juego (Arcade) avisa qué mostrar con un "spec"; acá se dibuja y los botones llaman al juego. */
import Link from 'next/link';
import { ADIFF, ARC, DIFF_DESC, POWERS, RUNNER_OBS } from '@/lib/tecla/views/arcade';
import { newRoomCode } from '@/lib/rooms';

export type OverlaySpec =
  | { kind: 'intro' } | { kind: 'pause' } | { kind: 'upgrades' } | { kind: 'wait' }
  | { kind: 'over'; rec: boolean; where: string; stats: string; fresh?: boolean[] | null; cloud: boolean }
  | { kind: 'mpWin'; score: number } | { kind: 'mpOut'; score: number } | { kind: 'mpEnd'; coop: boolean; score: number; wave: number };

const Kbd = ({ children }: { children: React.ReactNode }) => <kbd>{children}</kbd>;

function Missions({ game, fresh }: { game: any; fresh?: boolean[] | null }) {
  const done: boolean[] = game.missionsDone();
  return (
    <div>
      <span className="lbl" style={{ marginBottom: 6 }}>misiones</span>
      <ul className="mis">
        {ARC[game.kind].missions.map((m: { t: string }, i: number) => (
          <li key={m.t} className={(done[i] ? 'done' : '') + (fresh?.[i] ? ' new' : '')}>
            <span className="star">{done[i] ? '★' : '☆'}</span>{m.t}{fresh?.[i] && <b> · ¡nueva!</b>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ArcadeOverlay({ game, spec }: { game: any; spec: OverlaySpec | null }) {
  if (!spec || !game) return null;
  const m = ARC[game.kind], D = ADIFF[game.diffKey()] || ADIFF.medio;
  let body: React.ReactNode = null;

  if (spec.kind === 'intro') {
    const chips = game.kind === 'runner'
      ? Object.values(RUNNER_OBS as Record<string, { name: string; desc: string }>).map(o => <span key={o.name} className="chip"><b style={{ color: 'var(--accent)' }}>{o.name} </b>{o.desc}</span>)
      : Object.values(POWERS as Record<string, { g: string; desc: string }>).map(p => <span key={p.g} className="chip"><b style={{ color: 'var(--accent)' }}>{p.g} </b>{p.desc}</span>);
    body = <>
      <span className="eyebrow">* — arcade</span>
      <h2>{m.name}</h2>
      <p className="sub">{m.desc}</p>
      <div className="chips" style={{ justifyContent: 'center' }}>{chips}</div>
      <Missions game={game} />
      <p className="hint">dificultad {D.name}: {DIFF_DESC[game.kind][game.diffKey()]} · cambiala arriba o con 1, 2 y 3</p>
      <div className="row" style={{ justifyContent: 'center' }}>
        <button className="btn primary" type="button" onClick={() => game.start()}>empezar</button>
        <Link className="btn" href={`/sala/${newRoomCode()}?juego=${game.kind}`}>{game.kind === 'torre' ? 'jugar en equipo online' : 'jugar online con amigos'}</Link>
        <span className="hint"><Kbd>enter</Kbd> empezar · <Kbd>1</Kbd> <Kbd>2</Kbd> <Kbd>3</Kbd> dificultad · <Kbd>tab</Kbd> reiniciar · <Kbd>esc</Kbd> pausa{game.kind !== 'runner' && <> · <Kbd>⌫</Kbd> soltar objetivo</>}</span>
      </div>
    </>;
  } else if (spec.kind === 'pause') {
    body = <>
      <h2>pausa</h2>
      <div className="row" style={{ justifyContent: 'center' }}><button className="btn primary" type="button" onClick={() => game.resume()}>seguir</button><span className="hint"><Kbd>enter</Kbd></span></div>
    </>;
  } else if (spec.kind === 'upgrades') {
    body = <>
      <span className="eyebrow">* oleada {game.wave} superada</span>
      <h2>elegí una mejora</h2>
      <div className="ups">
        {(game.choices || []).map((u: { id: string; name: string; desc: string }, i: number) => (
          <button key={u.id} className="btn up" type="button" onClick={() => game.choose(u)}>
            <b>{i + 1} · {u.name}{u.id === 'turret' && game.turret ? ` (nivel ${game.turret + 1})` : ''}</b><span>{u.desc}</span>
          </button>
        ))}
      </div>
      <p className="hint">tocá 1, 2 o 3</p>
    </>;
  } else if (spec.kind === 'over') {
    body = <>
      <span className="eyebrow">{spec.rec ? '* nuevo récord' : '* fin del juego'} · {D.name}</span>
      <h2>{game.score} puntos</h2>
      <p className="sub">{spec.where} · {spec.stats}</p>
      <Missions game={game} fresh={spec.fresh} />
      <p className="hint">guardado en tu perfil · {spec.cloud ? 'en tu cuenta' : 'en este navegador'}</p>
      <div className="row" style={{ justifyContent: 'center' }}><button className="btn primary" type="button" onClick={() => game.start()}>otra vez</button><span className="hint"><Kbd>enter</Kbd></span></div>
    </>;
  } else if (spec.kind === 'wait') {
    body = <><h2>oleada superada</h2><p className="sub">el anfitrión está eligiendo una mejora…</p></>;
  } else if (spec.kind === 'mpWin') {
    body = <><span className="eyebrow">* sala online</span><h2>¡ganaste!</h2><p className="sub">{spec.score} puntos · último en pie</p></>;
  } else if (spec.kind === 'mpOut') {
    body = <><span className="eyebrow">* sala online</span><h2>quedaste afuera</h2><p className="sub">{spec.score} puntos · mirá cómo sigue la ronda</p></>;
  } else if (spec.kind === 'mpEnd') {
    body = <><span className="eyebrow">* sala online</span><h2>{spec.coop ? 'la base cayó' : 'fin de la ronda'}</h2>{spec.coop && <p className="sub">{spec.score} puntos en equipo · oleada {spec.wave}</p>}</>;
  }
  return <div className="ov"><div className="inner">{body}</div></div>;
}
