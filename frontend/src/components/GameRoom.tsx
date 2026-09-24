'use client';

/* Sala online para el arcade y el battle royale de tipeo (Supabase Realtime).
   - presencia: quién está, su nombre, color y la configuración del anfitrión
   - broadcast "st": el estado de juego de cada uno (vivo, vidas, puntos), con versión (ver roomSync)
   - broadcast: start · garbage (ataque) · hit/snap (torre cooperativa) · elim (royale) · end
   El anfitrión es quien llegó primero; si se va, lo hereda el siguiente. */
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase/client';
import { closeRoom, publishRoom, roomToken, type RoomGame, seatId } from '@/lib/rooms';
import Tabs from '@/components/ui/Tabs';
import PageHeader from '@/components/ui/PageHeader';
import ArcadeOverlay, { type OverlaySpec } from '@/components/views/arcade/ArcadeOverlay';
import { gameTabs } from '@/lib/games';
import { clampGarbage, decideEnd, pickEliminated, resolveColor, standings as rankStandings } from '@/lib/roomLogic';
import { newestMetas, RoomMembers, sameMembers } from '@/lib/roomSync';

type GameKey = 'bombas' | 'runner' | 'caen' | 'torre' | 'royale';
type Diff = 'facil' | 'medio' | 'dificil';
type Phase = 'lobby' | 'countdown' | 'playing' | 'over';

const GAMES: Record<GameKey, { name: string; mode: 'battle' | 'coop' | 'royale'; desc: string }> = {
  bombas: { name: 'bombas', mode: 'battle', desc: 'Cada uno desactiva sus propias bombas, con la misma semilla para todos. Gana el último que queda con vidas.' },
  runner: { name: 'runner · persecución', mode: 'battle', desc: 'Todos corren la misma pista escapando de la ola: tu tipeo es el motor y ves a los demás arriba. Gana el último en pie.' },
  caen: { name: 'palabras que caen · ataque', mode: 'battle', desc: 'Cada 4 aciertos le mandás palabras basura a un rival al azar. Gana el último en pie.' },
  torre: { name: 'defensa de torre · cooperativo', mode: 'coop', desc: 'Defienden la misma base. Cada bicho tiene el color de un jugador y solo él puede escribir su palabra; los bichos dobles traen una palabra para cada uno de dos jugadores.' },
  royale: { name: 'battle royale de tipeo', mode: 'royale', desc: 'Todos tipean el mismo texto. Cada 20 segundos queda afuera quien menos letras correctas escribió en esa ronda.' },
};
const DIFFS: Record<Diff, string> = { facil: 'fácil', medio: 'medio', dificil: 'difícil' };
export const PLAYER_COLORS = ['#34A3F0', '#F0735F', '#1DB386', '#8A7BF4', '#F2B13C', '#E85D9E', '#14B8C4', '#6B7C8F'];
const ROUND_MS = 20000;

interface Cfg { game: GameKey; diff: Diff; pub: boolean; phase: Phase; round: number; tok?: string }
interface Player {
  id: string; name: string; color: string; joinedAt: number;
  round: number; alive: boolean; lives: number; score: number; level: number; deadAt: number | null;
  rr?: number; rc?: number; // royale: ronda y letras de esa ronda
  cfg?: Cfg;
  v?: number; // versión del estado: gana la más nueva
}
interface StartPayload { game: GameKey; diff: Diff; seed: number; round: number; roster: { id: string; name: string; color: string }[] }

const guestId = () => { try { let id = localStorage.getItem('tecla:guest'); if (!id) { id = crypto.randomUUID(); localStorage.setItem('tecla:guest', id); } return id; } catch { return crypto.randomUUID(); } };
const guestNick = () => { try { return localStorage.getItem('tecla:nick') || 'invitado-' + Math.floor(Math.random() * 900 + 100); } catch { return 'invitado'; } };

export default function GameRoom({ code, initialGame, initialPublic }: { code: string; initialGame: GameKey; initialPublic: boolean }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const chRef = useRef<RealtimeChannel | null>(null);
  const meRef = useRef<Player | null>(null);
  const playersRef = useRef<Player[]>([]);
  const gameRef = useRef<any>(null);
  const royaleRef = useRef<{ box: any; timer: number | null; round: number; base: number; t0: number } | null>(null);
  const activeRef = useRef<StartPayload | null>(null);
  const endSent = useRef(0);
  const lastTrack = useRef(0);
  const trailing = useRef<number | null>(null);
  const inheritedTok = useRef<string | null>(null);
  const membersRef = useRef(new RoomMembers<Player>(5000));
  const lastSt = useRef(0);
  const stTrailing = useRef<number | null>(null);
  // el anfitrión de la ronda es quien la arrancó; no depende de la lista de presencia
  // (si un jugador deja de ver al anfitrión un instante, no se autoproclama anfitrión)
  const roundHostRef = useRef<string | null>(null);
  const hostGoneSince = useRef<number | null>(null);
  const [, forceRender] = useState(0);

  const [players, setPlayers] = useState<Player[]>([]);
  const [phase, setPhase] = useState<Phase>('lobby');
  const [active, setActive] = useState<StartPayload | null>(null);
  const [count, setCount] = useState(3);
  const [name, setName] = useState('');
  const [myCfg, setMyCfg] = useState<Cfg>({ game: initialGame, diff: 'medio', pub: initialPublic, phase: 'lobby', round: 0 });
  const [winner, setWinner] = useState<string | null>(null);
  const [coopSum, setCoopSum] = useState<{ score: number; wave: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [spectating, setSpectating] = useState(false);
  const [ovSpec, setOvSpec] = useState<OverlaySpec | null>(null); // avisos del juego (ganaste, quedaste afuera…)

  // depuración en desarrollo: window.__teclaRoom
  if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') (window as any).__teclaRoom = { meRef, playersRef, gameRef, chRef };

  /* ---------- mensajes: todos llevan quién los manda; los de control solo valen si vienen del anfitrión ---------- */
  const send = useCallback((event: string, payload: Record<string, unknown>) => {
    chRef.current?.send({ type: 'broadcast', event, payload: { ...payload, from: meRef.current?.id } });
  }, []);
  // la lista de jugadores con mi estado local (la presencia puede llegar tarde o no incluirme por un instante)
  const withMe = (list: Player[]) => { const m = meRef.current; return m ? [...list.filter(p => p.id !== m.id), m].sort((a, b) => a.joinedAt - b.joinedAt) : list; };
  const hostNowId = () => roundHostRef.current || playersRef.current[0]?.id;
  const fromHost = (p: { from?: string } | null | undefined) => !!p?.from && p.from === hostNowId();
  const fromRoster = (p: { from?: string } | null | undefined) => !!p?.from && !!activeRef.current?.roster.some(r => r.id === p.from);

  /* ---------- presencia ---------- */
  // la lista de jugadores sale de RoomMembers (presencia + estados + margen de 5 s)
  const refresh = useCallback(() => {
    const list = membersRef.current.list();
    if (sameMembers(list, playersRef.current)) return;
    playersRef.current = list; setPlayers(list);
  }, []);
  const sendSt = useCallback(() => {
    if (stTrailing.current) { clearTimeout(stTrailing.current); stTrailing.current = null; }
    lastSt.current = Date.now();
    chRef.current?.send({ type: 'broadcast', event: 'st', payload: meRef.current });
  }, []);
  const track = useCallback((patch: Partial<Player>, force = false) => {
    if (!meRef.current) return;
    meRef.current = { ...meRef.current, ...patch, v: (meRef.current.v || 0) + 1 };
    membersRef.current.state(meRef.current); refresh();
    if (!chRef.current) return;
    // nombre, color o configuración: a la presencia (máximo ~2 por segundo)
    if ('name' in patch || 'color' in patch || 'cfg' in patch) {
      const pres = () => { trailing.current = null; lastTrack.current = Date.now(); chRef.current?.track(meRef.current!); };
      const wait = 500 - (Date.now() - lastTrack.current);
      if (force || wait <= 0) { if (trailing.current) clearTimeout(trailing.current); pres(); }
      else if (!trailing.current) trailing.current = window.setTimeout(pres, wait);
    }
    // el estado de juego va siempre por broadcast (máximo ~3 por segundo, siempre llega el último)
    const wait = 300 - (Date.now() - lastSt.current);
    if (force || wait <= 0) sendSt();
    else if (!stTrailing.current) stTrailing.current = window.setTimeout(sendSt, wait);
  }, [refresh, sendSt]);

  const host = players[0];
  const me = players.find(p => p.id === meRef.current?.id);
  const isHost = !!host && host.id === meRef.current?.id;
  const cfg: Cfg = (host?.cfg as Cfg) || myCfg;
  const game = GAMES[cfg.game] || GAMES.bombas;

  /* ---------- fin de partida ---------- */
  const stopRoyale = () => {
    const r = royaleRef.current; if (!r) return;
    if (r.timer) clearInterval(r.timer);
    r.box?.stop(); royaleRef.current = null;
  };

  const finish = useCallback(async (payload: { winner?: string | null; coop?: boolean; score?: number; wave?: number }) => {
    setPhase('over'); setWinner(payload.winner ?? null);
    const input = await import('@/lib/tecla/input');
    if (payload.coop) { setCoopSum({ score: payload.score || 0, wave: payload.wave || 0 }); gameRef.current?.endRemote?.(payload); }
    else if (payload.winner && payload.winner === meRef.current?.id) {
      if (activeRef.current?.game === 'royale') {
        stopRoyale();
        const { History } = await import('@/lib/tecla/history');
        History.record({ t: 'comp', mode: 'battle royale online', win: true, detail: `ganaste en la sala ${code}`, pts: 220 });
      } else gameRef.current?.winMp?.();
    } else if (activeRef.current?.game === 'royale') stopRoyale();
    input.setConsumer(null);
    if (meRef.current?.id === playersRef.current[0]?.id) track({ cfg: { ...(meRef.current!.cfg as Cfg), phase: 'over' } }, true);
  }, [code, track]);

  /* ---------- arranque de una ronda ---------- */
  const begin = useCallback(async (p: StartPayload & { from?: string }) => {
    roundHostRef.current = p.from || playersRef.current[0]?.id || null; hostGoneSince.current = null;
    activeRef.current = p; setActive(p); setWinner(null); setCoopSum(null);
    const inRoster = p.roster.some(r => r.id === meRef.current?.id);
    setSpectating(!inRoster);
    track({ round: p.round, alive: inRoster, lives: 0, score: 0, level: 0, deadAt: null, rr: 0, rc: 0 }, true);
    gameRef.current?.destroy?.(); gameRef.current = null; stopRoyale();
    const input = await import('@/lib/tecla/input');
    input.setConsumer({});
    setPhase('countdown');
    let n = 3; setCount(n);
    await new Promise<void>(res => { const iv = setInterval(() => { n--; setCount(n); if (n <= 0) { clearInterval(iv); res(); } }, 700); });
    setPhase('playing');
    if (!inRoster) return;

    if (p.game === 'royale') {
      const [{ TypeBox }, words] = await Promise.all([import('@/lib/tecla/typebox'), import('@/lib/tecla/data/words')]);
      const list = words.VOCAB[p.diff] || words.VOCAB.medio;
      const gen = words.wordGen(p.seed, list);
      const box = new TypeBox(boxRef.current!, { onInput: () => { const r = royaleRef.current; if (r) track({ rc: box.counts().correct - r.base, rr: r.round }); } });
      (box as any).load(gen(80), { extend: gen });
      const state = { box, timer: null as number | null, round: 1, base: 0, t0: Date.now() };
      royaleRef.current = state;
      state.timer = window.setInterval(() => {
        const r = royaleRef.current; if (!r) return;
        const round = Math.floor((Date.now() - r.t0) / ROUND_MS) + 1;
        if (round !== r.round) {
          // cierra la ronda: publico mis letras finales y arranco a contar de nuevo
          const final = box.counts().correct - r.base;
          track({ rr: r.round, rc: final }, true);
          r.round = round; r.base = box.counts().correct;
        }
      }, 100);
      input.setConsumer({ char: (c: string) => box.char(c), back: (x: boolean) => box.back(x) });
      requestAnimationFrame(() => box.refresh());
      return;
    }

    const { Arcade } = await import('@/lib/tecla/views/arcade');
    setOvSpec(null);
    const g = new Arcade(stageRef.current!, { overlay: (sp: OverlaySpec | null) => setOvSpec(sp ? { ...sp } : null) });
    gameRef.current = g;
    g.kind = p.game; g.colors(); g.resize();
    const hostNow = roundHostRef.current === meRef.current?.id;
    g.startMp({
      seed: p.seed, diff: p.diff, me: meRef.current!.id, roster: p.roster,
      role: p.game === 'torre' ? (hostNow ? 'host' : 'guest') : 'battle', coop: p.game === 'torre',
      onStatus: (s: { lives: number; score: number; level: number; alive: boolean }) => track({ lives: s.lives, score: s.score, level: s.level }),
      onDead: () => track({ alive: false, deadAt: Date.now() }, true),
      onAttack: (n: number) => {
        const targets = playersRef.current.filter(o => o.id !== meRef.current?.id && o.round === p.round && o.alive);
        if (!targets.length) return;
        const to = targets[Math.floor(Math.random() * targets.length)].id;
        send('garbage', { to, n });
      },
      onHit: (id: number) => send('hit', { id }),
      onSnapshot: (sn: Record<string, unknown>) => send('snap', sn),
      onEnd: (sum: { score: number; wave: number }) => send('end', { coop: true, ...sum }),
    });
    track({ lives: g.lives, score: 0, level: 1 }, true);
  }, [track]);

  /* ---------- conexión a la sala (con reconexión automática) ---------- */
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) { setError('Las salas online necesitan Supabase conectado.'); return; }
    let cancelled = false;
    let retry: number | null = null;

    const connect = () => {
      if (cancelled || !meRef.current) return;
      const ch = sb.channel(`room-${code}`, { config: { presence: { key: meRef.current.id }, broadcast: { self: true } } });
      chRef.current = ch;
      ch.on('presence', { event: 'sync' }, () => {
        membersRef.current.presence(newestMetas(ch.presenceState() as Record<string, Player[]>));
        if (meRef.current) membersRef.current.state(meRef.current);
        refresh();
        const list = playersRef.current;
        const h = list[0]; if (h?.cfg?.tok) inheritedTok.current = h.cfg.tok;
        // si el anfitrión de la ronda se fue de verdad (más de 6 s), lo hereda el siguiente de la lista
        const rh = roundHostRef.current;
        if (rh && !list.some(p => p.id === rh)) {
          hostGoneSince.current = hostGoneSince.current || Date.now();
          if (Date.now() - hostGoneSince.current > 6000 && list[0]?.id === meRef.current?.id) { roundHostRef.current = meRef.current!.id; forceRender(x => x + 1); }
        } else hostGoneSince.current = null;
        // colores únicos: si alguien que llegó antes tiene el mío (o no tengo), tomo el primero libre
        const next = resolveColor(meRef.current!, list, PLAYER_COLORS);
        if (next) track({ color: next }, true);
      });
      ch.on('broadcast', { event: 'st' }, ({ payload }) => {
        if (!payload || typeof payload.id !== 'string' || typeof payload.joinedAt !== 'number' || payload.id === meRef.current?.id) return;
        membersRef.current.state(payload as Player); refresh();
      });
      ch.on('broadcast', { event: 'start' }, ({ payload }) => { if (fromHost(payload)) begin(payload as StartPayload); });
      ch.on('broadcast', { event: 'garbage' }, ({ payload }) => { if (payload.to === meRef.current?.id && fromRoster(payload)) gameRef.current?.receiveGarbage?.(clampGarbage(payload.n)); });
      ch.on('broadcast', { event: 'hit' }, ({ payload }) => { if (roundHostRef.current === meRef.current?.id && fromRoster(payload)) gameRef.current?.remoteHit?.(payload.id); });
      ch.on('broadcast', { event: 'snap' }, ({ payload }) => { const g = gameRef.current; if (g?.mirror && fromHost(payload)) g.applySnapshot(payload); });
      ch.on('broadcast', { event: 'elim' }, ({ payload }) => {
        if (!fromHost(payload)) return;
        if (payload.id === meRef.current?.id) {
          stopRoyale(); track({ alive: false, deadAt: Date.now() }, true);
          import('@/lib/tecla/input').then(m => m.setConsumer(null));
        }
      });
      ch.on('broadcast', { event: 'end' }, ({ payload }) => { if (fromHost(payload)) finish(payload); });
      ch.subscribe(status => {
        if (status === 'SUBSCRIBED') { setError(''); ch.track(meRef.current!); sendSt(); return; }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          if (cancelled || chRef.current !== ch) return; // cierre nuestro (al salir o al reconectar)
          setError('Se cortó la conexión con la sala. Reconectando…');
          chRef.current = null;
          sb.removeChannel(ch);
          if (retry) clearTimeout(retry);
          retry = window.setTimeout(connect, 1500);
        }
      });
    };

    // al volver a la pestaña, si el canal se cayó mientras estaba en segundo plano, reconectar ya
    const onVisible = () => {
      if (document.hidden || cancelled) return;
      const ch = chRef.current;
      if (!ch || ch.state !== 'joined') { if (ch) { chRef.current = null; sb.removeChannel(ch); } if (retry) clearTimeout(retry); connect(); }
    };
    document.addEventListener('visibilitychange', onVisible);
    const beat = window.setInterval(() => {
      if (!meRef.current) return;
      membersRef.current.state(meRef.current);
      if (chRef.current?.state === 'joined' && Date.now() - lastSt.current > 1500) sendSt();
      refresh();
    }, 1000);

    import('@/lib/tecla/history').then(({ History }) => {
      if (cancelled) return;
      const id = seatId(History.user?.id || guestId());
      const nick = History.user?.name || guestNick();
      setName(nick);
      meRef.current = { id, name: nick, color: '', joinedAt: Date.now(), round: 0, alive: false, lives: 0, score: 0, level: 0, deadAt: null, cfg: { game: initialGame, diff: 'medio', pub: initialPublic, phase: 'lobby', round: 0 } };
      connect();
    });
    return () => {
      cancelled = true;
      if (retry) clearTimeout(retry);
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(beat);
      gameRef.current?.destroy?.(); stopRoyale();
      if (trailing.current) clearTimeout(trailing.current);
      if (stTrailing.current) clearTimeout(stTrailing.current);
      const wasHost = playersRef.current[0]?.id === meRef.current?.id;
      if (wasHost && playersRef.current.length <= 1) closeRoom(code, roomToken(code, inheritedTok.current));
      const ch = chRef.current; chRef.current = null;
      if (ch) sb.removeChannel(ch);
      import('@/lib/tecla/input').then(m => m.setConsumer(null));
    };
  }, [code, begin, finish, initialGame, initialPublic, track, refresh, sendSt]);

  /* ---------- el anfitrión publica la sala (para la lista de salas públicas) ---------- */
  useEffect(() => {
    if (!isHost || !meRef.current) return;
    const tok = roomToken(code, inheritedTok.current);
    if (meRef.current.cfg?.tok !== tok) track({ cfg: { ...(meRef.current.cfg as Cfg), tok } }, true);
    const pub = () => publishRoom({ code, token: tok, game: cfg.game as RoomGame, difficulty: cfg.diff, isPublic: cfg.pub, hostName: meRef.current?.name || 'anfitrión', players: playersRef.current.length, status: phase === 'playing' || phase === 'countdown' ? 'playing' : 'lobby' });
    pub();
    const iv = setInterval(pub, 20000);
    return () => clearInterval(iv);
  }, [isHost, code, cfg.game, cfg.diff, cfg.pub, phase, players.length, track]);

  /* ---------- el anfitrión decide eliminaciones y quién ganó ---------- */
  const amRoundHost = !!active && roundHostRef.current === meRef.current?.id;
  useEffect(() => {
    if (!amRoundHost || phase !== 'playing' || !active || GAMES[active.game].mode === 'coop') return;
    if (endSent.current === active.round) return;
    // mi propio estado sale de mi memoria, no de la presencia (que puede no incluirme por un instante)
    const check = () => decideEnd(withMe(playersRef.current), active.roster, active.round);
    if (!check().end) return;
    // y el final tiene que sostenerse 1,2 s: evita declarar ganador por un parpadeo de la presencia
    const t = window.setTimeout(() => {
      const v = check();
      if (v.end && endSent.current !== active.round) { endSent.current = active.round; send('end', { winner: v.winner }); }
    }, 1200);
    return () => clearTimeout(t);
  }, [amRoundHost, phase, active, players]);

  useEffect(() => {
    if (!amRoundHost || phase !== 'playing' || active?.game !== 'royale') return;
    const t0 = Date.now(); let done = 0;
    const iv = setInterval(() => {
      const round = Math.floor((Date.now() - t0) / ROUND_MS);
      if (round <= done) return;
      done = round;
      // un segundo de margen para que lleguen las letras finales de todos
      setTimeout(() => {
        const loser = pickEliminated(withMe(playersRef.current), active.roster, active.round, done);
        if (loser) send('elim', { id: loser, round: done });
      }, 1000);
    }, 200);
    return () => clearInterval(iv);
  }, [amRoundHost, phase, active]);

  useEffect(() => {
    if (!amRoundHost || phase !== 'playing' || active?.game !== 'torre') return;
    const inRoster = new Set(active.roster.map(r => r.id));
    gameRef.current?.setActivePlayers?.(players.filter(p => inRoster.has(p.id)).map(p => p.id));
  }, [amRoundHost, phase, active, players]);

  // runner: cada uno ve dónde van los demás (los metros llegan en el estado de cada jugador)
  useEffect(() => {
    if (phase !== 'playing' || active?.game !== 'runner') return;
    const inRoster = new Set(active.roster.map(r => r.id));
    gameRef.current?.setRivals?.(players.filter(p => inRoster.has(p.id) && p.id !== meRef.current?.id && p.round === active.round)
      .map(p => ({ name: p.name, color: p.color, dist: p.level || 0, alive: p.alive })));
  }, [phase, active, players]);

  /* ---------- acciones ---------- */
  const setCfg = (patch: Partial<Cfg>) => {
    const next = { ...(meRef.current?.cfg as Cfg), ...patch };
    setMyCfg(next); track({ cfg: next }, true);
  };
  const start = () => {
    const roster = playersRef.current.map(p => ({ id: p.id, name: p.name, color: p.color }));
    const round = (cfg.round || 0) + 1;
    setCfg({ phase: 'playing', round });
    endSent.current = 0;
    send('start', { game: cfg.game, diff: cfg.diff, seed: Math.floor(Math.random() * 2 ** 31), round, roster });
  };
  const backToLobby = () => { roundHostRef.current = null; setCfg({ phase: 'lobby' }); gameRef.current?.destroy?.(); gameRef.current = null; stopRoyale(); setPhase('lobby'); };
  const rename = (v: string) => { const nick = v.slice(0, 24) || 'invitado'; setName(nick); try { localStorage.setItem('tecla:nick', nick); } catch {} track({ name: nick }, true); };
  const pickColor = (c: string) => { if (players.some(p => p.id !== meRef.current?.id && p.color === c)) return; track({ color: c }, true); };
  const copy = async () => { try { await navigator.clipboard.writeText(`${window.location.origin}/sala/${code}`); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { window.prompt('Copiá el link de la sala:', `${window.location.origin}/sala/${code}`); } };

  // si otro jugador vuelve al lobby (anfitrión), todos vuelven
  useEffect(() => { if (!isHost && cfg.phase === 'lobby' && phase === 'over') backToLobby(); }); // eslint-disable-line react-hooks/exhaustive-deps

  const roster = active?.roster || [];
  const standings = useMemo(() => {
    if (!active) return [];
    return rankStandings(players, roster, active.round) as Player[];
  }, [players, active, roster]);
  const taken = new Set(players.filter(p => p.id !== meRef.current?.id).map(p => p.color));
  const isArcade = active && active.game !== 'royale';

  return (
    <section className="view room">
      <PageHeader eyebrow={<>* — sala {code} · <span className={'room-badge ' + (cfg.pub ? 'pub' : 'priv')}>{cfg.pub ? 'pública' : 'privada'}</span></>} title={game.name}>
        <button className="btn" type="button" onClick={copy}>{copied ? 'link copiado' : 'invitar (copiar link)'}</button>
        <Link className="btn ghost" href="/competir">salir</Link>
      </PageHeader>
      <div className="room-grid fill">
        <div className="panel room-main">
          {error && <p className="msg err">{error}</p>}

          {phase === 'lobby' && (
            <div className="room-lobby">
              <p className="sub">{game.desc}</p>
              {isHost ? (
                <>
                  <span className="lbl">juego</span>
                  <Tabs variant="card" items={gameTabs(Object.keys(GAMES) as GameKey[])} value={cfg.game} onChange={k => setCfg({ game: k as GameKey })} label="juego" />
                  <span className="lbl">dificultad</span>
                  <div className="cfgbar" style={{ alignSelf: 'flex-start' }}>{(Object.keys(DIFFS) as Diff[]).map(k => <button key={k} type="button" className={'opt' + (cfg.diff === k ? ' on' : '')} onClick={() => setCfg({ diff: k })}>{DIFFS[k]}</button>)}</div>
                  <span className="lbl">visibilidad</span>
                  <div className="cfgbar" style={{ alignSelf: 'flex-start' }}>
                    <button type="button" className={'opt' + (cfg.pub ? ' on' : '')} onClick={() => setCfg({ pub: true })}>pública · aparece en la lista</button>
                    <button type="button" className={'opt' + (!cfg.pub ? ' on' : '')} onClick={() => setCfg({ pub: false })}>privada · solo con el link</button>
                  </div>
                  <button className="btn primary" type="button" onClick={start} style={{ alignSelf: 'flex-start' }}>
                    {players.length < 2 ? (game.mode === 'coop' ? 'empezar (mejor con amigos)' : 'empezar solo (o esperá a alguien)') : `empezar con ${players.length} jugadores`}
                  </button>
                </>
              ) : <p className="hint" style={{ textAlign: 'left' }}>Dificultad {DIFFS[cfg.diff]}. El anfitrión ({host?.name || '…'}) elige el juego y arranca la partida.</p>}
            </div>
          )}

          {phase !== 'lobby' && (
            <div className="room-play">
              {phase === 'countdown' && <div className="count">{count}</div>}
              {spectating && phase === 'playing' && <p className="hint">Llegaste con la ronda empezada: mirás esta y jugás la próxima.</p>}
              <div className="stage-wrap" hidden={!isArcade}><div className="stage" ref={stageRef}><canvas /><ArcadeOverlay game={gameRef.current} spec={ovSpec} /></div></div>
              <div hidden={active?.game !== 'royale'} className="room-royale">
                <div ref={boxRef} />
                {active?.game === 'royale' && phase === 'playing' && me?.alive && <p className="hint">ronda de 20 s · letras correctas en esta ronda: <b>{me.rc || 0}</b></p>}
                {active?.game === 'royale' && me && !me.alive && phase === 'playing' && <p className="hint">Quedaste afuera. Mirá cómo sigue la ronda.</p>}
              </div>
              {phase === 'over' && (
                <div className="live-result">
                  <b>{coopSum ? `la base cayó · ${coopSum.score} puntos en equipo · oleada ${coopSum.wave}` : winner ? (winner === meRef.current?.id ? '* ganaste' : `ganó ${players.find(p => p.id === winner)?.name || roster.find(r => r.id === winner)?.name || 'alguien'}`) : 'ronda terminada'}</b>
                  {isHost ? <button className="btn primary" type="button" onClick={backToLobby}>volver a la sala</button> : <span className="hint">el anfitrión puede armar otra ronda</span>}
                </div>
              )}
            </div>
          )}
        </div>

        <aside className="panel room-side">
          <span className="eyebrow">jugadores · {players.length}</span>
          <div className="room-players">
            {(phase === 'lobby' ? players : standings.length ? standings : players).map((p, i) => (
              <div key={p.id} className={'rp' + (p.id === meRef.current?.id ? ' me' : '') + (phase !== 'lobby' && !p.alive && p.round === active?.round ? ' out' : '')}>
                <span className="rp-dot" style={{ background: p.color || 'var(--dim)' }} />
                <span className="rp-name">{p.name}{p.id === host?.id ? ' ★' : ''}</span>
                <span className="rp-info">{phase === 'lobby' ? 'listo' : p.round !== active?.round ? 'mira' : active?.game === 'royale' ? (p.alive ? `${p.rc || 0} letras` : `afuera · ${i + 1}º`) : active?.game === 'torre' ? `${p.score} pts` : p.alive ? `${'*'.repeat(Math.min(p.lives, 6))} · ${p.score}` : `afuera · ${i + 1}º`}</span>
              </div>
            ))}
          </div>
          {phase === 'lobby' && (
            <>
              <label className="lbl" htmlFor="room-nick">tu nombre</label>
              <input id="room-nick" className="live-nick" value={name} onChange={e => rename(e.target.value)} maxLength={24} />
              <span className="lbl">tu color</span>
              <div className="swatches">
                {PLAYER_COLORS.map(c => (
                  <button key={c} type="button" className={'swatch-btn' + (me?.color === c ? ' on' : '')} disabled={taken.has(c)} title={taken.has(c) ? 'lo tiene otro jugador' : 'elegir'} onClick={() => pickColor(c)}>
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
