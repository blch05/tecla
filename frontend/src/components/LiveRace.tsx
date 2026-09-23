'use client';

/* Carrera en vivo entre personas: una sala por link, sincronizada con Supabase Realtime.
   - presencia: quién está en la sala, su nombre y su progreso
   - broadcast "start": el anfitrión arranca la ronda con una semilla (mismo texto para todos) */
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase/client';
import { closeRoom, publishRoom, roomToken } from '@/lib/rooms';

interface Racer { id: string; name: string; joinedAt: number; round: number; progress: number; wpm: number; done: boolean; finishMs: number | null; pub?: boolean; tok?: string }
type Phase = 'lobby' | 'countdown' | 'racing' | 'done';

const guestId = () => {
  try {
    let id = localStorage.getItem('tecla:guest');
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('tecla:guest', id); }
    return id;
  } catch { return crypto.randomUUID(); }
};
const guestNick = () => {
  try { return localStorage.getItem('tecla:nick') || 'invitado-' + Math.floor(Math.random() * 900 + 100); } catch { return 'invitado'; }
};

export default function LiveRace({ code, initialPublic = true }: { code: string; initialPublic?: boolean }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const chRef = useRef<RealtimeChannel | null>(null);
  const meRef = useRef<Racer | null>(null);
  const tbRef = useRef<any>(null);
  const lastTrack = useRef(0);
  const racersRef = useRef<Racer[]>([]);
  const [racers, setRacers] = useState<Racer[]>([]);
  const [phase, setPhase] = useState<Phase>('lobby');
  const [round, setRound] = useState(0);
  const [count, setCount] = useState(3);
  const [name, setName] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [myResult, setMyResult] = useState<{ place: number; wpm: number; acc: number } | null>(null);

  const trailing = useRef<number | null>(null);
  const track = useCallback((patch: Partial<Racer>, force = false) => {
    if (!meRef.current || !chRef.current) return;
    meRef.current = { ...meRef.current, ...patch };
    const send = () => { trailing.current = null; lastTrack.current = Date.now(); chRef.current?.track(meRef.current!); };
    const wait = 200 - (Date.now() - lastTrack.current);
    if (force || wait <= 0) { if (trailing.current) clearTimeout(trailing.current); send(); return; }
    // no saturar el canal, pero siempre mandar el último estado (antes se perdía y la barra quedaba trabada)
    if (!trailing.current) trailing.current = window.setTimeout(send, wait);
  }, []);

  // arranca una ronda: mismo texto para todos a partir de la semilla
  const begin = useCallback(async (seed: number, r: number) => {
    const [{ TypeBox }, words, input, { History }] = await Promise.all([
      import('@/lib/tecla/typebox'), import('@/lib/tecla/data/words'), import('@/lib/tecla/input'), import('@/lib/tecla/history'),
    ]);
    setRound(r); setMyResult(null); setPhase('countdown');
    track({ round: r, progress: 0, wpm: 0, done: false, finishMs: null }, true);
    input.setConsumer({});
    let n = 3; setCount(n);
    const iv = setInterval(() => {
      n--; setCount(n);
      if (n > 0) return;
      clearInterval(iv);
      setPhase('racing');
      const t0 = Date.now();
      const box = new TypeBox(boxRef.current!, {
        onInput: () => track({ progress: box.progress(), wpm: Math.round(box.wpmNow()) }),
        onFinish: (s: any) => {
          const finishMs = Date.now() - t0;
          track({ progress: 1, wpm: Math.round(s.wpm), done: true, finishMs }, true);
          setPhase('done');
          // puesto = cuántos terminaron antes que yo en esta ronda + 1
          const chState = chRef.current?.presenceState() as Record<string, Racer[]> | undefined;
          const others = Object.values(chState || {}).map(a => a[0]).filter(x => x && x.id !== meRef.current?.id && x.round === r && x.done && x.finishMs != null && x.finishMs < finishMs);
          const place = others.length + 1, total = Object.values(chState || {}).filter(a => a[0]?.round === r).length || 1;
          setMyResult({ place, wpm: s.wpm, acc: s.acc });
          History.record({ t: 'comp', mode: 'carrera en vivo', win: place === 1 && total > 1, detail: `${place}º de ${total} · ${Math.round(s.wpm)} ppm · sala ${code}`, pts: total > 1 ? [200, 120, 70, 40][place - 1] || 20 : 20 });
        },
      });
      tbRef.current = box;
      box.load(words.passage(seed, 28));
      input.setConsumer({ char: (c: string) => box.char(c), back: (x: boolean) => box.back(x) });
      requestAnimationFrame(() => box.refresh());
    }, 700);
  }, [code, track]);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) { setError('Las carreras en vivo necesitan Supabase conectado.'); return; }
    let cancelled = false;
    import('@/lib/tecla/history').then(({ History }) => {
      if (cancelled) return;
      const id = History.user?.id || guestId();
      const nick = History.user?.name || guestNick();
      setName(nick);
      meRef.current = { id, name: nick, joinedAt: Date.now(), round: 0, progress: 0, wpm: 0, done: false, finishMs: null, pub: initialPublic };
      const ch = sb.channel(`race-${code}`, { config: { presence: { key: id }, broadcast: { self: true } } });
      chRef.current = ch;
      ch.on('presence', { event: 'sync' }, () => {
        const st = ch.presenceState() as Record<string, Racer[]>;
        const list = Object.values(st).map(a => a[0]).filter(Boolean).sort((a, b) => a.joinedAt - b.joinedAt);
        racersRef.current = list; setRacers(list);
      });
      // solo el anfitrión (el primero que entró) puede arrancar la carrera
      ch.on('broadcast', { event: 'start' }, ({ payload }) => { if (payload?.from && payload.from === racersRef.current[0]?.id) begin(payload.seed, payload.round); });
      ch.subscribe(status => {
        if (status === 'SUBSCRIBED') ch.track(meRef.current!);
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setError('No se pudo conectar a la sala. Probá recargar la página.');
      });
    });
    return () => {
      cancelled = true;
      tbRef.current?.stop();
      if (trailing.current) clearTimeout(trailing.current);
      if (racersRef.current[0]?.id === meRef.current?.id && racersRef.current.length <= 1) closeRoom(code, roomToken(code, racersRef.current[0]?.tok));
      if (chRef.current) sb.removeChannel(chRef.current);
      import('@/lib/tecla/input').then(m => m.setConsumer(null));
    };
  }, [code, begin, initialPublic]);

  const host = racers[0];
  const isHost = !!host && host.id === meRef.current?.id;
  const pub = host?.pub ?? initialPublic;

  // el anfitrión registra la sala para que las públicas aparezcan en la lista
  useEffect(() => {
    if (!isHost || !meRef.current) return;
    const tok = roomToken(code, host?.tok);
    if (meRef.current.tok !== tok) track({ tok }, true);
    const send = () => publishRoom({ code, token: tok, game: 'carrera', difficulty: null, isPublic: pub, hostName: meRef.current?.name || 'anfitrión', players: racersRef.current.length, status: phase === 'lobby' ? 'lobby' : 'playing' });
    send(); const iv = setInterval(send, 20000);
    return () => clearInterval(iv);
  }, [isHost, code, pub, phase, racers.length, host?.tok, track]);
  const current = useMemo(() => racers.filter(r => r.round === round), [racers, round]);
  const allDone = phase !== 'lobby' && current.length > 0 && current.every(r => r.done);

  const start = () => {
    chRef.current?.send({ type: 'broadcast', event: 'start', payload: { seed: Math.floor(Math.random() * 2 ** 31), round: round + 1, from: meRef.current?.id } });
  };
  const rename = (v: string) => {
    const nick = v.slice(0, 24) || 'invitado';
    setName(nick);
    try { localStorage.setItem('tecla:nick', nick); } catch {}
    track({ name: nick }, true);
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { window.prompt('Copiá el link de la sala:', window.location.href); }
  };

  const ranked = [...current].sort((a, b) => (a.done && b.done ? (a.finishMs! - b.finishMs!) : a.done ? -1 : b.done ? 1 : b.progress - a.progress));

  return (
    <section className="view live">
      <div className="panel live-panel">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <span className="eyebrow">* — carrera en vivo · sala {code} · <span className={'room-badge ' + (pub ? 'pub' : 'priv')}>{pub ? 'pública' : 'privada'}</span></span>
            <h2 className="live-title">{phase === 'lobby' ? 'esperando jugadores' : phase === 'countdown' ? 'preparados…' : phase === 'racing' ? '¡a tipear!' : allDone ? 'ronda terminada' : 'esperando a los demás'}</h2>
          </div>
          <div className="row">
            <button className="btn" type="button" onClick={copy}>{copied ? 'link copiado' : 'invitar (copiar link)'}</button>
            <Link className="btn ghost" href="/competir">salir</Link>
          </div>
        </div>

        {error && <p className="msg err">{error}</p>}

        <div className="lanes">
          {(phase === 'lobby' ? racers : ranked).map((r, i) => {
            const p = Math.min(1, r.progress) * 100, you = r.id === meRef.current?.id;
            return (
              <div key={r.id} className={'lane' + (you ? ' you' : '')}>
                <span className="lane-name">{r.name}{r.id === host?.id ? ' ★' : ''}</span>
                <div className="track"><div className="trail" style={{ width: p + '%' }} /><span className="runner" style={{ left: p + '%' }}>*</span><span className="flag">|||</span></div>
                <span className="lane-info">{r.done && r.round === round && phase !== 'lobby' ? `${i + 1}º · ${r.wpm} ppm` : r.round === round && phase !== 'lobby' ? `${r.wpm} ppm` : r.round < round ? 'espera' : 'listo'}</span>
              </div>
            );
          })}
        </div>

        {phase === 'lobby' && (
          <div className="live-lobby">
            <label className="lbl" htmlFor="live-nick">tu nombre en la sala</label>
            <input id="live-nick" className="live-nick" value={name} onChange={e => rename(e.target.value)} maxLength={24} />
            {isHost && (
              <div className="cfgbar" style={{ alignSelf: 'flex-start' }}>
                <button type="button" className={'opt' + (pub ? ' on' : '')} onClick={() => track({ pub: true }, true)}>pública · aparece en la lista</button>
                <button type="button" className={'opt' + (!pub ? ' on' : '')} onClick={() => track({ pub: false }, true)}>privada · solo con el link</button>
              </div>
            )}
            {isHost
              ? <button className="btn primary" type="button" onClick={start} disabled={racers.length < 1}>{racers.length < 2 ? 'empezar solo (o esperá a alguien)' : `empezar con ${racers.length} jugadores`}</button>
              : <p className="hint">El anfitrión ({host?.name || '…'}) arranca la carrera.</p>}
          </div>
        )}

        <div className="live-box-wrap" hidden={phase === 'lobby'}>
          {phase === 'countdown' && <div className="count">{count}</div>}
          <div ref={boxRef} />
        </div>

        {myResult && (
          <div className="live-result">
            <b>{myResult.place === 1 && current.length > 1 ? '* ganaste' : `llegaste ${myResult.place}º`}</b>
            <span className="sub">{Math.round(myResult.wpm)} ppm · {Math.round(myResult.acc)}% de precisión</span>
            {isHost && allDone && <button className="btn primary" type="button" onClick={start}>otra ronda</button>}
            {!isHost && <span className="hint">el anfitrión puede arrancar otra ronda</span>}
          </div>
        )}
      </div>
    </section>
  );
}
