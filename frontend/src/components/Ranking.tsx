'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import CountUp from '@/components/bits/CountUp';
import SplitFlapText from '@/components/bits/SplitFlapText';
import { getSupabase } from '@/lib/supabase/client';
import { fmt } from '@/lib/format';

interface Row { rank: number; username: string; display_name: string | null; avatar_url: string | null; value: number; accuracy: number | null; runs: number }

const BOARDS = [
  { key: 't15', label: '15 s', unit: 'ppm' },
  { key: 't30', label: '30 s', unit: 'ppm' },
  { key: 't60', label: '60 s', unit: 'ppm' },
  { key: 'w25', label: '25 palabras', unit: 'ppm' },
  { key: 'points', label: 'puntos', unit: 'pts' },
];
const PERIODS = [
  { key: 'day', label: 'hoy' },
  { key: 'week', label: 'semana' },
  { key: 'all', label: 'siempre' },
];

export default function Ranking() {
  const [board, setBoard] = useState('t30');
  const [period, setPeriod] = useState('week');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState('');
  const [me, setMe] = useState<string | null>(null);

  useEffect(() => {
    let unsub = () => {};
    import('@/lib/tecla/history').then(({ History }) => {
      const sync = () => setMe(History.user?.username ?? null);
      sync(); unsub = History.subscribe(sync);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) { setError('Falta conectar Supabase.'); setRows([]); return; }
    let alive = true;
    setRows(null); setError('');
    sb.rpc('leaderboard', { p_board: board, p_period: period, p_limit: 50 }).then(({ data, error }) => {
      if (!alive) return;
      if (error) { setError(/leaderboard/.test(error.message) ? 'El ranking todavía no está activado en la base de datos.' : error.message); setRows([]); return; }
      setRows((data as Row[]) || []);
    });
    return () => { alive = false; };
  }, [board, period]);

  const unit = BOARDS.find(b => b.key === board)!.unit;
  const podium = (rows || []).slice(0, 3);
  const rest = (rows || []).slice(3);

  return (
    <section className="view ranking">
      <div className="rk-top">
        <SplitFlapText words={["RANKING"]} padTo={7} charset="alpha" fontSize={26} gap={4} tileRadius={6} flipDuration={70} stagger={60} loop={false}
          tileColor="var(--soft)" textColor="var(--accent)" className="rk-flap" />
        <div className="rk-filters">
          <div className="cfgbar">{BOARDS.map(b => <button key={b.key} type="button" className={'opt' + (b.key === board ? ' on' : '')} onClick={() => setBoard(b.key)}>{b.label}</button>)}</div>
          <div className="cfgbar">{PERIODS.map(p => <button key={p.key} type="button" className={'opt' + (p.key === period ? ' on' : '')} onClick={() => setPeriod(p.key)}>{p.label}</button>)}</div>
        </div>
      </div>

      {rows === null && <p className="hint">cargando…</p>}
      {error && <p className="hint">{error}</p>}
      {rows && !rows.length && !error && (
        <div className="panel rk-empty">
          <p className="sub">Todavía nadie juega en esta tabla. ¡Podés ser el primero!</p>
          <Link className="btn primary" href="/test">hacer un test</Link>
        </div>
      )}

      {rows && rows.length > 0 && (
        <div className="rk-body fill">
          <div className="podium">
            {podium.map(r => (
              <Link key={r.username} href={`/u/${r.username}`} className={`pod pod-${r.rank <= 3 ? r.rank : 3}` + (r.username === me ? ' me' : '')}>
                <span className="pod-rank">{r.rank}º</span>
                <span className="avatar">{/* eslint-disable-next-line @next/next/no-img-element */}{r.avatar_url ? <img src={r.avatar_url} alt="" referrerPolicy="no-referrer" /> : <span>{(r.display_name || r.username)[0]?.toUpperCase()}</span>}</span>
                <b className="pod-name">{r.display_name || r.username}</b>
                <span className="pod-val"><CountUp to={Math.round(r.value)} duration={1} separator="." /> {unit}</span>
                {r.accuracy != null && <span className="hint">{Math.round(r.accuracy)}% precisión</span>}
              </Link>
            ))}
          </div>
          {rest.length > 0 && (
            <div className="panel rk-list">
              {rest.map(r => (
                <Link key={r.username} href={`/u/${r.username}`} className={'rk-row' + (r.username === me ? ' me' : '')}>
                  <span className="rk-n">{r.rank}</span>
                  <span className="rk-name">{r.display_name || r.username} <small>@{r.username}</small></span>
                  <span className="rk-acc">{r.accuracy != null ? `${Math.round(r.accuracy)}%` : `${r.runs} partidas`}</span>
                  <b className="rk-v">{fmt(r.value)} {unit}</b>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
      <p className="hint">Solo cuentan tests con 75% de precisión o más.</p>
    </section>
  );
}
