'use client';

import { useEffect, useRef, useState } from 'react';
import { ROOM_GAMES, cleanCode, findRoom, listRooms, newRoomCode, roomPath, type RoomGame, type RoomInfo } from '@/lib/rooms';

const DIFFS: Record<string, string> = { facil: 'fácil', medio: 'medio', dificil: 'difícil' };

/* cómo se ve cada juego en el selector: un glifo, cómo se gana y un resumen corto */
const LOOK: Record<RoomGame, { glyph: string; how: string; blurb: string }> = {
  carrera: { glyph: '›››', how: 'todos contra todos', blurb: 'mismo texto, gana el primero en terminar' },
  royale: { glyph: '*|*', how: 'eliminación', blurb: 'cada 20 s queda afuera el más lento' },
  bombas: { glyph: '(*)', how: 'último en pie', blurb: 'desactivá tus bombas antes de que exploten' },
  runner: { glyph: '_/‾', how: 'último en pie', blurb: 'saltá los obstáculos escribiendo' },
  caen: { glyph: '↓↓↓', how: 'ataque', blurb: 'tus aciertos le mandan basura a otro' },
  torre: { glyph: '[*]', how: 'cooperativo', blurb: 'cada uno escribe las palabras de su color' },
};
const ORDER: RoomGame[] = ['carrera', 'royale', 'caen', 'bombas', 'runner', 'torre'];
const pathOf = (game: RoomGame, code: string) => (game === 'carrera' ? `/carrera/${code}` : `/sala/${code}?juego=${game}`);

/** Lista de salas públicas + crear sala (pública o privada) + entrar con código. */
export default function RoomBrowser({ go }: { go: (path: string) => void }) {
  const [rooms, setRooms] = useState<RoomInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [game, setGame] = useState<RoomGame>('carrera');
  const [isPublic, setIsPublic] = useState(true);
  const [newCode, setNewCode] = useState('');
  const [code, setCode] = useState('');
  const [joinMsg, setJoinMsg] = useState('');
  const [joining, setJoining] = useState(false);
  const joinRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setNewCode(newRoomCode()); }, []);
  useEffect(() => {
    let alive = true;
    const load = () => listRooms().then(r => { if (!alive) return; setRooms(r.rooms); setError(r.error); });
    load();
    const iv = setInterval(load, 5000);
    return () => { alive = false; clearInterval(iv); };
  }, []);

  const create = () => go(roomPath(game, newCode || newRoomCode(), isPublic));
  const join = async () => {
    const c = cleanCode(code);
    if (!c) { setJoinMsg('Escribí el código que te pasaron.'); joinRef.current?.focus(); return; }
    setJoining(true); setJoinMsg('');
    const g = await findRoom(c);
    setJoining(false);
    if (!g) { setJoinMsg('No hay una sala abierta con ese código.'); return; }
    go(pathOf(g, c));
  };
  // que las teclas del campo no las agarre el juego de fondo
  const keep = (e: React.KeyboardEvent) => e.stopPropagation();

  return (
    <div className="rooms">
      <div className="rooms-left">
      <section className="rooms-list" aria-label="salas públicas">
        <span className="lbl">salas públicas</span>
        {rooms === null && !error && <div className="rooms-empty"><span className="glyph">· · ·</span><span className="hint">buscando salas…</span></div>}
        {error && <div className="rooms-empty"><span className="glyph">—</span><span className="hint">{error}</span></div>}
        {rooms && !rooms.length && !error && (
          <div className="rooms-empty">
            <span className="glyph">* — *</span>
            <b>No hay salas abiertas ahora</b>
            <span className="hint">Creá una y pasale el link o el código a tus amigos.</span>
          </div>
        )}
        {rooms && rooms.map(r => {
          const full = r.players >= r.max_players;
          return (
            <button key={r.code} type="button" className="room-row" disabled={full} onClick={() => go(pathOf(r.game, r.code))}>
              <span className="room-glyph" aria-hidden>{LOOK[r.game]?.glyph || '*'}</span>
              <span className="room-meta">
                <b>{ROOM_GAMES[r.game]?.name || r.game}</b>
                <span>{LOOK[r.game]?.how}{r.difficulty ? ` · ${DIFFS[r.difficulty] || r.difficulty}` : ''} · de {r.host_name}</span>
              </span>
              <span className="room-count">{r.players}<small>/{r.max_players}</small></span>
              <span className={'room-state ' + (r.status === 'playing' ? 'playing' : 'waiting')}>{r.status === 'playing' ? 'jugando' : 'esperando'}</span>
              <span className="room-go">{full ? 'llena' : 'unirme →'}</span>
            </button>
          );
        })}
      </section>
        <div className="join-box">
          <span className="lbl">¿te pasaron un código?</span>
          <div className="join-group">
            <input ref={joinRef} className="join-input" id="join-code" placeholder="ab3k9" value={code} maxLength={8} autoComplete="off" spellCheck={false}
              onChange={e => { setCode(cleanCode(e.target.value)); setJoinMsg(''); }}
              onKeyDown={e => { keep(e); if (e.key === 'Enter') { e.preventDefault(); join(); } }} onKeyUp={keep} />
            <button className="btn" type="button" onClick={join} disabled={joining}>{joining ? 'buscando…' : 'entrar →'}</button>
          </div>
          {joinMsg && <p className="msg err">{joinMsg}</p>}
        </div>
      </div>

      <section className="rooms-create" aria-label="crear una sala">
        <div className="rooms-step"><span className="step-n">1</span><span className="lbl">¿a qué juegan?</span></div>
        <div className="game-tiles" role="radiogroup" aria-label="juego">
          {ORDER.map(k => (
            <button key={k} type="button" role="radio" aria-checked={game === k} className={'game-tile' + (game === k ? ' on' : '')} onClick={() => setGame(k)}>
              <span className="gt-glyph" aria-hidden>{LOOK[k].glyph}</span>
              <span className="gt-name">{ROOM_GAMES[k].name}</span>
              <span className="gt-how">{LOOK[k].how}</span>
            </button>
          ))}
        </div>
        <p className="gt-blurb"><b>{ROOM_GAMES[game].name}:</b> {LOOK[game].blurb}</p>

        <div className="rooms-step"><span className="step-n">2</span><span className="lbl">¿quién puede entrar?</span></div>
        <div className="vis-toggle" role="radiogroup" aria-label="visibilidad">
          <button type="button" role="radio" aria-checked={isPublic} className={'vis pub' + (isPublic ? ' on' : '')} onClick={() => setIsPublic(true)}>
            <b>○ pública</b><span>aparece en la lista</span>
          </button>
          <button type="button" role="radio" aria-checked={!isPublic} className={'vis priv' + (!isPublic ? ' on' : '')} onClick={() => setIsPublic(false)}>
            <b>● privada</b><span>solo con el link</span>
          </button>
        </div>

        <div className="create-cta">
          <button className="btn primary big" type="button" onClick={create}>crear sala de {ROOM_GAMES[game].name} →</button>
          <span className="code-preview" title="el código de tu sala">
            código <b>{newCode || '·····'}</b>
            <button type="button" className="reroll" aria-label="otro código" title="otro código" onClick={() => setNewCode(newRoomCode())}>↻</button>
          </span>
        </div>

      </section>
    </div>
  );
}
