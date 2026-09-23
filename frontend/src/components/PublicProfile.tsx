'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import CountUp from '@/components/bits/CountUp';
import SpotlightCard from '@/components/bits/SpotlightCard';
import { DIFF_NAMES, GAME_NAMES, fmt, levelFor, modeLabel } from '@/lib/format';

export interface PublicProfileData {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  points: number;
  tests: number;
  arcade_games: number;
  comp_games: number;
  wins: number;
  best_tests: { mode_key: string; wpm: number; accuracy: number }[];
  best_arcade: { game: string; difficulty: string | null; score: number }[];
  recent: { kind: string; mode: string | null; game: string | null; difficulty: string | null; wpm: number | null; accuracy: number | null; score: number | null; points: number; won: boolean | null; created_at: string }[];
}

const SPOT = 'rgba(52, 163, 240, 0.18)' as const;

function recentTitle(r: PublicProfileData['recent'][number]) {
  if (r.kind === 'test') return `test · ${r.wpm ? Math.round(r.wpm) + ' ppm' : ''}`;
  if (r.kind === 'arcade') return `${GAME_NAMES[r.game || ''] || r.game} · ${fmt(r.score || 0)} puntos`;
  if (r.kind === 'comp') return `${r.mode}${r.won ? ' · ganó' : ''}`;
  return `estudio · ${r.mode}`;
}

export default function PublicProfile({ p }: { p: PublicProfileData }) {
  const name = p.display_name || p.username;
  const L = levelFor(p.points);
  const [copied, setCopied] = useState(false);
  const [isMe, setIsMe] = useState(false);

  useEffect(() => {
    let unsub = () => {};
    import('@/lib/tecla/history').then(({ History }) => {
      const check = () => setIsMe(History.user?.username === p.username);
      check();
      unsub = History.subscribe(check);
    });
    return () => unsub();
  }, [p.username]);

  const share = async () => {
    const url = window.location.href;
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { window.prompt('Copiá el link:', url); }
  };

  const since = new Date(p.created_at).toLocaleDateString('es', { month: 'long', year: 'numeric' });

  return (
    <section className="view pub">
      <div className="panel phead pub-head">
        <span className="corner" aria-hidden="true">* — |</span>
        <div className="avatar big-av">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {p.avatar_url ? <img src={p.avatar_url} alt="" referrerPolicy="no-referrer" /> : <span>{name[0]?.toUpperCase()}</span>}
        </div>
        <div className="pinfo">
          <span className="eyebrow">@{p.username} · juega desde {since}</span>
          <h2>{name}</h2>
          <p className="sub">nivel {L.lv} · {fmt(p.points)} puntos</p>
          <div className="progress" style={{ maxWidth: 420 }}><i style={{ width: `${(L.pct * 100).toFixed(1)}%` }} /></div>
        </div>
        <div className="pside">
          <button className="btn" type="button" onClick={share}>{copied ? 'link copiado' : 'compartir perfil'}</button>
          {isMe ? <Link className="btn ghost" href="/perfil">editar</Link> : <Link className="btn ghost" href="/ranking">ver ranking</Link>}
        </div>
      </div>

      <div className="tiles">
        {[
          ['puntos', p.points], ['tests', p.tests], ['partidas arcade', p.arcade_games], ['victorias', p.wins],
        ].map(([label, value]) => (
          <SpotlightCard key={label as string} className="tile spot" spotlightColor={SPOT}>
            <span className="lbl">{label}</span>
            <b><CountUp to={value as number} duration={1} separator="." /></b>
          </SpotlightCard>
        ))}
      </div>

      <div className="two fill">
        <div className="col">
          <div className="panel">
            <span className="eyebrow">mejores tests</span>
            {p.best_tests.length ? (
              <table className="rtable" style={{ marginTop: 10 }}>
                <thead><tr><th>modo</th><th className="num">ppm</th><th className="num">precisión</th></tr></thead>
                <tbody>
                  {p.best_tests.slice(0, 6).map(t => (
                    <tr key={t.mode_key}><td>{modeLabel(t.mode_key)}</td><td className="num">{Math.round(t.wpm)}</td><td className="num">{Math.round(t.accuracy)}%</td></tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="sub" style={{ marginTop: 8 }}>Todavía no hizo tests.</p>}
          </div>
          <div className="panel">
            <span className="eyebrow">récords de arcade</span>
            {p.best_arcade.length ? (
              <table className="rtable" style={{ marginTop: 10 }}>
                <tbody>
                  {p.best_arcade.sort((a, b) => b.score - a.score).slice(0, 6).map(a => (
                    <tr key={a.game + a.difficulty}><td>{GAME_NAMES[a.game] || a.game}</td><td>{DIFF_NAMES[a.difficulty || 'medio']}</td><td className="num">{fmt(a.score)}</td></tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="sub" style={{ marginTop: 8 }}>Todavía no jugó en el arcade.</p>}
          </div>
        </div>
        <div className="panel">
          <span className="eyebrow">actividad reciente</span>
          <div className="hist" style={{ marginTop: 8 }}>
            {p.recent.length ? p.recent.map((r, i) => (
              <div className="hrow" key={i}>
                <span className="ht">{new Date(r.created_at).toLocaleDateString('es', { day: 'numeric', month: 'short' })}</span>
                <span className="hg">{({ test: '|', arcade: '*', comp: '—', study: '/' } as Record<string, string>)[r.kind] || '*'}</span>
                <div className="hm"><span className="hti">{recentTitle(r)}</span></div>
                <span className="hp">+{fmt(r.points)}</span>
              </div>
            )) : <p className="sub">Sin actividad todavía.</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
