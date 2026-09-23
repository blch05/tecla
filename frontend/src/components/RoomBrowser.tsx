'use client';

import { useEffect, useState } from 'react';
import { ROOM_GAMES, cleanCode, findRoom, listRooms, newRoomCode, roomPath, type RoomGame, type RoomInfo } from '@/lib/rooms';

const DIFFS: Record<string, string> = { facil: 'fácil', medio: 'medio', dificil: 'difícil' };

/** Lista de salas públicas + crear sala (pública o privada) + entrar con código. */
export default function RoomBrowser({ go }: { go: (path: string) => void }) {
  const [rooms, setRooms] = useState<RoomInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [game, setGame] = useState<RoomGame>('carrera');
  const [isPublic, setIsPublic] = useState(true);
  const [code, setCode] = useState('');

  useEffect(() => {
    let alive = true;
    const load = () => listRooms().then(r => { if (!alive) return; setRooms(r.rooms); setError(r.error); });
    load();
    const iv = setInterval(load, 5000);
    return () => { alive = false; clearInterval(iv); };
  }, []);

  const create = () => go(roomPath(game, newRoomCode(), isPublic));
  const [joinMsg, setJoinMsg] = useState('');
  const join = async () => {
    const c = cleanCode(code); if (!c) return;
    const g = await findRoom(c);
    if (!g) { setJoinMsg('No encontramos una sala abierta con ese código.'); return; }
    go(g === 'carrera' ? `/carrera/${c}` : `/sala/${c}?juego=${g}`);
  };

  return (
    <div className="rooms">
      <div className="rooms-list">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="lbl">salas públicas abiertas</span>
          <span className="hint">se actualiza sola</span>
        </div>
        {rooms === null && <p className="hint" style={{ textAlign: 'left' }}>buscando salas…</p>}
        {error && <p className="hint" style={{ textAlign: 'left' }}>{error}</p>}
        {rooms && !rooms.length && !error && <p className="sub" style={{ fontSize: 13 }}>No hay salas públicas ahora. Creá una y compartí el link.</p>}
        {rooms && rooms.map(r => (
          <div key={r.code} className="room-row">
            <span className="room-badge pub">pública</span>
            <div className="room-meta">
              <b>{ROOM_GAMES[r.game]?.name || r.game}</b>
              <span className="hint" style={{ textAlign: 'left' }}>{ROOM_GAMES[r.game]?.tag}{r.difficulty ? ` · ${DIFFS[r.difficulty] || r.difficulty}` : ''} · de {r.host_name}</span>
            </div>
            <span className="room-count">{r.players}/{r.max_players}</span>
            <span className={'chip' + (r.status === 'playing' ? ' bad' : ' ok')}>{r.status === 'playing' ? 'jugando' : 'esperando'}</span>
            <button className="btn" type="button" onClick={() => go(r.game === 'carrera' ? `/carrera/${r.code}` : `/sala/${r.code}?juego=${r.game}`)} disabled={r.players >= r.max_players}>unirme</button>
          </div>
        ))}
      </div>

      <div className="rooms-create">
        <span className="lbl">crear una sala</span>
        <div className="cfgbar" style={{ alignSelf: 'flex-start' }}>
          {(Object.keys(ROOM_GAMES) as RoomGame[]).map(k => (
            <button key={k} type="button" className={'opt' + (game === k ? ' on' : '')} onClick={() => setGame(k)}>{ROOM_GAMES[k].name}</button>
          ))}
        </div>
        <div className="cfgbar" style={{ alignSelf: 'flex-start' }}>
          <button type="button" className={'opt' + (isPublic ? ' on' : '')} onClick={() => setIsPublic(true)}>pública · aparece en la lista</button>
          <button type="button" className={'opt' + (!isPublic ? ' on' : '')} onClick={() => setIsPublic(false)}>privada · solo con el link</button>
        </div>
        <div className="row">
          <button className="btn primary" type="button" onClick={create}>crear sala de {ROOM_GAMES[game].name}</button>
          <span className="sep">|</span>
          <input className="live-nick" id="join-code" placeholder="código de sala" value={code} maxLength={8}
            onChange={e => setCode(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); join(); } }} style={{ maxWidth: 150 }} />
          <button className="btn" type="button" onClick={join}>entrar con código</button>
        </div>
        {joinMsg && <p className="msg err">{joinMsg}</p>}
      </div>
    </div>
  );
}
