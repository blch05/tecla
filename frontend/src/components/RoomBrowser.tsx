'use client';

import { useEffect, useRef, useState } from 'react';
import { cleanCode, findRoom, isSocial, listRooms, newRoomCode, roomPath, type RoomGame, type RoomInfo } from '@/lib/rooms';
import { GAME_GROUPS, GAME_INFO, gameTabs } from '@/lib/games';
import Tabs from '@/components/ui/Tabs';

const DIFFS: Record<string, string> = { facil: 'fácil', medio: 'medio', dificil: 'difícil' };

const pathOf = (game: RoomGame, code: string) => (game === 'carrera' ? `/carrera/${code}` : `/sala/${code}?juego=${game}`);

/** Lista de salas públicas + crear sala (pública o privada) + entrar con código. */
export default function RoomBrowser({ go }: { go: (path: string) => void }) {
  const [rooms, setRooms] = useState<RoomInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [game, setGame] = useState<RoomGame>('carrera');
  const [isPublic, setIsPublic] = useState(true);
  const [group, setGroup] = useState('tipeo');
  const [spicy, setSpicy] = useState(false);
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

  const create = () => go(roomPath(game, newCode || newRoomCode(), isPublic) + (isSocial(game) && spicy ? '&picante=1' : ''));
  const pickGroup = (id: string) => { setGroup(id); setGame(GAME_GROUPS.find(g => g.id === id)!.games[0]); };
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
              <span className="room-glyph" aria-hidden>{GAME_INFO[r.game]?.glyph || '*'}</span>
              <span className="room-meta">
                <b>{GAME_INFO[r.game]?.name || r.game}{r.spicy && <span className="spicy-badge">picante</span>}</b>
                <span>{GAME_INFO[r.game]?.how}{r.difficulty ? ` · ${DIFFS[r.difficulty] || r.difficulty}` : ''} · de {r.host_name}</span>
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
        <Tabs className="game-groups" items={GAME_GROUPS.map(g => ({ id: g.id, label: g.name }))} value={group} onChange={pickGroup} label="tipo de juego" />
        <Tabs variant="card" items={gameTabs(GAME_GROUPS.find(g => g.id === group)!.games)} value={game} onChange={id => setGame(id as RoomGame)} label="juego" />
        <p className="gt-blurb"><b>{GAME_INFO[game]?.name}:</b> {GAME_INFO[game]?.blurb}</p>
        {isSocial(game) && (
          <label className="spicy-toggle">
            <input type="checkbox" checked={spicy} onChange={e => setSpicy(e.target.checked)} />
            <span><b>modo picante</b> · palabras subidas de tono (+18)</span>
          </label>
        )}

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
          <button className="btn primary big" type="button" onClick={create}>crear sala de {GAME_INFO[game]?.name} →</button>
          <span className="code-preview" title="el código de tu sala">
            código <b>{newCode || '·····'}</b>
            <button type="button" className="reroll" aria-label="otro código" title="otro código" onClick={() => setNewCode(newRoomCode())}>↻</button>
          </span>
        </div>

      </section>
    </div>
  );
}
