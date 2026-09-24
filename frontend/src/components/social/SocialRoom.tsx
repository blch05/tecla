'use client';

/* Sala de juegos sociales (palabra oculta, sopa de letras, pistas, tutti frutti).
   El anfitrión (el primero que entró) tiene el estado completo y los secretos; los demás mandan
   acciones ("act") y reciben el estado público ("gs"). Ver lib/social/host.ts. */
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { closeRoom, publishRoom, roomToken, type SocialGame, SOCIAL_GAMES } from '@/lib/rooms';
import { resolveColor } from '@/lib/roomLogic';
import { act as hostAct, canStart, type GS, newGame, publicView, ranking, tick } from '@/lib/social/host';
import { useRoom, type Member } from '@/lib/social/useRoom';
import { OcultaGame, PistasGame, SopaGame, TuttiGame } from './SocialGames';
import Tabs from '@/components/ui/Tabs';
import PageHeader from '@/components/ui/PageHeader';
import { GAME_INFO, gameTabs } from '@/lib/games';

export const PLAYER_COLORS = ['#34A3F0', '#F0735F', '#1DB386', '#8A7BF4', '#F2B13C', '#E85D9E', '#14B8C4', '#6B7C8F'];
/* reglas de cada juego (el nombre y el glifo salen de lib/games) */
export const SOCIAL_RULES: Record<SocialGame, string[]> = {
  oculta: ['verde: letra en su lugar', 'amarillo: está en otro lugar', 'suma más quien la saca en menos intentos y más rápido'],
  sopa: ['arrastrá de la primera a la última letra (o tocá las dos)', 'cada palabra es de quien la encuentra primero', 'las palabras van en cualquier dirección'],
  pistas: ['las pistas son de una sola palabra', 'no vale usar la palabra ni parte de ella', 'menos pistas, más puntos para los dos'],
  tutti: ['completá todo y cantá ¡basta!', 'después votan las respuestas que no valen', '10 si es única, 5 si alguien más la puso'],
};

interface Cfg { game: SocialGame; rounds: number; spicy: boolean; pub: boolean; phase: 'lobby' | 'playing' }
export type View = GS & { left: number };

export default function SocialRoom({ code, initialGame, initialPublic, initialSpicy }: { code: string; initialGame: SocialGame; initialPublic: boolean; initialSpicy: boolean }) {
  const gsRef = useRef<GS | null>(null);            // solo el anfitrión: el estado completo
  const [view, setView] = useState<View | null>(null);
  const [deadline, setDeadline] = useState(0);
  const [secret, setSecret] = useState<string | null>(null);
  const [reply, setReply] = useState<{ event: string; payload: any; n: number } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [copied, setCopied] = useState(false);
  const [name, setName] = useState('');
  const viewFrom = useRef<string | null>(null);
  const initialCfg: Cfg = { game: initialGame, rounds: 3, spicy: initialSpicy, pub: initialPublic, phase: 'lobby' };

  const room = useRoom(code, initialCfg as unknown as Record<string, unknown>, {
    gs: (p: View & { from?: string }) => {
      const host = hostIdRef.current; if (!p || p.from !== host) return;
      viewFrom.current = p.from || null; setView(p); setDeadline(p.left >= 0 ? Date.now() + p.left : 0);
    },
    act: (p: { from?: string; a?: any }) => {
      if (!amHostRef.current || !gsRef.current || !p?.from) return;
      const r = hostAct(gsRef.current, p.from, p.a, Date.now());
      if (r.reply) sendRef.current(r.reply.event, { ...r.reply.payload, to: r.reply.to });
      if (r.changed) { gsRef.current = r.gs; broadcast(); }
    },
    marks: (p: any) => { if (p?.to === meIdRef.current && p.from === hostIdRef.current) setReply({ event: 'marks', payload: p, n: Date.now() }); },
    'clue-error': (p: any) => { if (p?.to === meIdRef.current && p.from === hostIdRef.current) setReply({ event: 'clue-error', payload: p, n: Date.now() }); },
    secret: (p: any) => { if (p?.to === meIdRef.current && p.from === hostIdRef.current) setSecret(p.w); },
    lobby: (p: any) => { if (p?.from === hostIdRef.current) { setView(null); setSecret(null); } },
    joined: () => { if (amHostRef.current && gsRef.current) broadcast(); },
  });
  const { players, meRef, track, send, error, host, isHost } = room;
  const hostIdRef = useRef<string | undefined>(undefined); hostIdRef.current = host?.id;
  const amHostRef = useRef(false); amHostRef.current = isHost;
  const meIdRef = useRef<string | undefined>(undefined); meIdRef.current = meRef.current?.id;
  const sendRef = useRef(send); sendRef.current = send;

  const cfg = ((host?.cfg as unknown as Cfg) || initialCfg);
  const me = meRef.current?.id || '';

  /* ---------- anfitrión: publicar estado, reloj y secretos ---------- */
  const broadcast = useCallback(() => {
    const gs = gsRef.current; if (!gs) return;
    const t = Date.now();
    sendRef.current('gs', publicView(gs, t) as unknown as Record<string, unknown>);
    if (gs.p?.secret && gs.phase === 'playing') sendRef.current('secret', { to: gs.p.giver, w: gs.p.shown || gs.p.secret });
  }, []);
  useEffect(() => {
    if (!isHost) return;
    const iv = setInterval(() => {
      const gs = gsRef.current; if (!gs) return;
      const r = tick(gs, Date.now(), Math.random);
      if (r.changed) { gsRef.current = r.gs; broadcast(); }
    }, 250);
    const hb = setInterval(broadcast, 3000); // para los que se reconectan o llegan tarde
    return () => { clearInterval(iv); clearInterval(hb); };
  }, [isHost, broadcast]);

  // si el anfitrión cambió a mitad de partida, el nuevo no tiene los secretos: vuelven todos a la sala
  useEffect(() => {
    if (view && viewFrom.current && host && viewFrom.current !== host.id && view.phase !== 'over') { setView(null); setSecret(null); gsRef.current = null; }
  }, [host, view]);

  // colores únicos
  useEffect(() => {
    const m = meRef.current; if (!m) return;
    const next = resolveColor({ ...m, round: 0, alive: true }, players.map(p => ({ ...p, round: 0, alive: true })), PLAYER_COLORS);
    if (next) track({ color: next }, true);
    if (!name && m.name) setName(m.name);
  }, [players, track, meRef, name]);

  // reloj de pantalla
  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(iv); }, []);

  // el anfitrión publica la sala en la lista
  useEffect(() => {
    if (!isHost || !meRef.current) return;
    const tok = roomToken(code, (host?.cfg as any)?.tok);
    if ((meRef.current.cfg as any)?.tok !== tok) track({ cfg: { ...(meRef.current.cfg || {}), tok } }, true);
    const pub = () => publishRoom({ code, token: tok, game: cfg.game, difficulty: null, isPublic: cfg.pub, hostName: meRef.current?.name || 'anfitrión', players: players.length, status: view && view.phase !== 'over' ? 'playing' : 'lobby', spicy: cfg.spicy });
    pub(); const iv = setInterval(pub, 20000);
    return () => clearInterval(iv);
  }, [isHost, code, cfg.game, cfg.pub, cfg.spicy, players.length, view?.phase]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (amHostRef.current && players.length <= 1) closeRoom(code, roomToken(code)); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- acciones ---------- */
  const setCfg = (patch: Partial<Cfg>) => track({ cfg: { ...(meRef.current?.cfg || {}), ...patch } }, true);
  const start = () => {
    const roster = players.map(p => ({ id: p.id, name: p.name, color: p.color }));
    gsRef.current = newGame(cfg.game, roster, cfg.rounds, cfg.spicy, Date.now(), Math.random);
    setCfg({ phase: 'playing' }); broadcast();
  };
  const toLobby = () => { gsRef.current = null; setView(null); setSecret(null); setCfg({ phase: 'lobby' }); send('lobby'); };
  const doAct = useCallback((a: Record<string, unknown>) => send('act', { a }), [send]);
  const rename = (v: string) => { const n = v.slice(0, 24) || 'invitado'; setName(n); try { localStorage.setItem('tecla:nick', n); } catch {} track({ name: n }); };
  const pickColor = (c: string) => { if (players.some(p => p.id !== me && p.color === c)) return; track({ color: c }, true); };
  const copy = async () => { const url = `${window.location.origin}/sala/${code}?juego=${cfg.game}`; try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { window.prompt('Copiá el link de la sala:', url); } };

  const byId = useMemo(() => { const m: Record<string, { name: string; color: string }> = {}; for (const p of players) m[p.id] = p; for (const r of view?.roster || []) m[r.id] = m[r.id] || r; return m; }, [players, view]);
  const left = deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : null;
  const inGame = !!view && view.roster.some(r => r.id === me);
  const curGame = view?.game || cfg.game, info = { name: GAME_INFO[curGame].name, rules: SOCIAL_RULES[curGame] };
  // puntos en vivo: los ya sumados más los de la ronda en curso
  const live = (id: string) => (view?.scores[id] || 0) + (view && (view.phase === 'playing' || view.phase === 'vote') ? view.roundPts[id] || 0 : 0);
  const taken = new Set(players.filter(p => p.id !== me).map(p => p.color));

  return (
    <section className="view social">
      <PageHeader eyebrow={<>* — sala {code} · <span className={'room-badge ' + (cfg.pub ? 'pub' : 'priv')}>{cfg.pub ? 'pública' : 'privada'}</span>{cfg.spicy && <span className="spicy-badge">picante</span>}</>} title={<>{info.name}{view && view.phase !== 'over' && <span className="social-round"> · ronda {view.round}/{view.rounds}</span>}</>}>
        {view && view.phase !== 'over' && left != null && <div className={'social-timer' + (left <= 10 ? ' hot' : '')}>{left}s</div>}
        <button className="btn" type="button" onClick={copy}>{copied ? 'link copiado' : 'invitar (copiar link)'}</button>
        <Link className="btn ghost" href="/competir">salir</Link>
      </PageHeader>
      {error && <p className="msg err">{error}</p>}

      <div className="social-body">
        <div className="social-main panel">
          {!view && (
            <div className="social-lobby">
              <Tabs variant="card" items={gameTabs(SOCIAL_GAMES)} value={cfg.game} onChange={g => setCfg({ game: g as SocialGame })} readOnly={!isHost} label="juego" />
              <ul className="social-rules">{info.rules.map(r => <li key={r}>{r}</li>)}</ul>
              {isHost ? (
                <div className="social-opts">
                  <span className="lbl">rondas</span>
                  <div className="cfgbar">{[3, 5, 8].map(n => <button key={n} type="button" className={'opt' + (cfg.rounds === n ? ' on' : '')} onClick={() => setCfg({ rounds: n })}>{n}</button>)}</div>
                  <label className="spicy-toggle"><input type="checkbox" checked={cfg.spicy} onChange={e => setCfg({ spicy: e.target.checked })} /><span><b>modo picante</b> · palabras subidas de tono (+18)</span></label>
                  <div className="cfgbar">
                    <button type="button" className={'opt' + (cfg.pub ? ' on' : '')} onClick={() => setCfg({ pub: true })}>pública</button>
                    <button type="button" className={'opt' + (!cfg.pub ? ' on' : '')} onClick={() => setCfg({ pub: false })}>privada</button>
                  </div>
                  <button className="btn primary big" type="button" disabled={!canStart(cfg.game, players.length)} onClick={start}>
                    {canStart(cfg.game, players.length) ? `empezar con ${players.length} ${players.length === 1 ? 'jugador' : 'jugadores'}` : 'hacen falta al menos 2 jugadores'}
                  </button>
                </div>
              ) : <p className="hint" style={{ textAlign: 'left' }}>{host?.name || 'El anfitrión'} elige el juego y arranca · {cfg.rounds} rondas{cfg.spicy ? ' · picante' : ''}</p>}
            </div>
          )}

          {view && view.phase !== 'over' && !inGame && <p className="hint">Llegaste con la partida empezada: mirás esta y jugás la próxima.</p>}
          {view && view.phase !== 'over' && view.game === 'oculta' && <OcultaGame view={view} me={me} act={doAct} reply={reply} byId={byId} />}
          {view && view.phase !== 'over' && view.game === 'sopa' && <SopaGame view={view} me={me} act={doAct} byId={byId} />}
          {view && view.phase !== 'over' && view.game === 'pistas' && <PistasGame view={view} me={me} act={doAct} reply={reply} secret={secret} byId={byId} />}
          {view && view.phase !== 'over' && view.game === 'tutti' && <TuttiGame view={view} me={me} act={doAct} byId={byId} />}
          {view && view.phase === 'reveal' && <RoundPoints view={view} byId={byId} />}

          {view && view.phase === 'over' && (
            <div className="social-over">
              <span className="eyebrow">* fin de la partida</span>
              <div className="podium">
                {ranking(view).slice(0, 3).map((r, i) => (
                  <div key={r.id} className={'pod p' + (i + 1)} style={{ '--c': byId[r.id]?.color || r.color } as React.CSSProperties}>
                    <span className="pod-name">{byId[r.id]?.name || r.name}</span>
                    <span className="pod-pts">{view.scores[r.id] || 0}</span>
                    <span className="pod-place">{i + 1}º</span>
                  </div>
                ))}
              </div>
              {isHost ? <button className="btn primary big" type="button" onClick={toLobby}>volver a la sala</button> : <p className="hint">el anfitrión puede armar otra partida</p>}
            </div>
          )}
        </div>

        <aside className="social-side panel">
          <span className="eyebrow">jugadores · {players.length}</span>
          <div className="room-players">
            {(view ? [...players].sort((a, b) => live(b.id) - live(a.id)) : players).map(p => (
              <div key={p.id} className={'rp' + (p.id === me ? ' me' : '')}>
                <span className="rp-dot" style={{ background: p.color || 'var(--dim)' }} />
                <span className="rp-name">{p.name}{p.id === host?.id ? ' ★' : ''}</span>
                <span className="rp-info">{view ? `${live(p.id)} pts` : 'listo'}</span>
              </div>
            ))}
          </div>
          {!view && (
            <>
              <label className="lbl" htmlFor="soc-nick">tu nombre</label>
              <input id="soc-nick" className="live-nick" value={name} onChange={e => rename(e.target.value)} maxLength={24} />
              <span className="lbl">tu color</span>
              <div className="swatches">
                {PLAYER_COLORS.map(c => (
                  <button key={c} type="button" className={'swatch-btn' + (meRef.current?.color === c ? ' on' : '')} disabled={taken.has(c)} onClick={() => pickColor(c)} title={taken.has(c) ? 'lo tiene otro jugador' : 'elegir'}>
                    <span className="swatch" style={{ background: c, opacity: taken.has(c) ? 0.25 : 1 }} />
                  </button>
                ))}
              </div>
            </>
          )}
        </aside>
      </div>
    </section>
  );
}

function RoundPoints({ view, byId }: { view: View; byId: Record<string, { name: string; color: string }> }) {
  const list = Object.entries(view.roundPts).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  return (
    <div className="round-pts">
      <b>{view.round >= view.rounds ? 'última ronda' : 'fin de la ronda'}</b>
      {list.length ? list.map(([id, v]) => <span key={id} className="chip" style={{ borderColor: byId[id]?.color }}>{byId[id]?.name || '?'} +{v}</span>) : <span className="hint">nadie sumó en esta ronda</span>}
    </div>
  );
}

export type ById = Record<string, { name: string; color: string }>;
export type { Member };
