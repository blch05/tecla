'use client';

/* Pantallas de los juegos sociales. Cada una recibe el estado público (view) y manda acciones al anfitrión. */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Mark } from '@/lib/social/logic';
import { norm } from '@/lib/social/data';
import { MAX_CLUES, MAX_TRIES } from '@/lib/social/host';
import type { View, ById } from './SocialRoom';

type Act = (a: Record<string, unknown>) => void;
const stop = (e: React.KeyboardEvent) => e.stopPropagation();

/* =================== palabra oculta =================== */
const KEYS = ['qwertyuiop', 'asdfghjklñ', 'zxcvbnm'];

export function OcultaGame({ view, me, act, reply, byId }: { view: View; me: string; act: Act; reply: { event: string; payload: any; n: number } | null; byId: ById }) {
  const o = view.o!, len = o.len;
  const [mine, setMine] = useState<{ g: string; marks: Mark[] }[]>([]);
  const [cur, setCur] = useState('');
  const [msg, setMsg] = useState('');
  const [wait, setWait] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const round = view.round;
  useEffect(() => { setMine([]); setCur(''); setMsg(''); setWait(false); }, [round]);
  useEffect(() => {
    if (!reply || reply.event !== 'marks') return;
    setWait(false);
    if (reply.payload.error) { setMsg(reply.payload.error); return; }
    setMine(m => [...m, { g: reply.payload.g, marks: reply.payload.marks }]); setCur('');
  }, [reply]);
  const solved = o.solved[me] != null, out = mine.length >= MAX_TRIES || solved || view.phase !== 'playing';
  const submit = () => { if (out || wait) return; if (norm(cur).length !== len) { setMsg(`Tiene que tener ${len} letras.`); return; } setMsg(''); setWait(true); act({ type: 'guess', g: cur }); };
  const press = (k: string) => { if (out) return; if (k === '⏎') return submit(); if (k === '⌫') return setCur(c => c.slice(0, -1)); setCur(c => (norm(c).length < len ? c + k : c)); inputRef.current?.focus(); };
  const keyState = useMemo(() => { const st: Record<string, Mark> = {}; const rank = { no: 0, near: 1, ok: 2 }; for (const r of mine) [...r.g].forEach((ch, i) => { const m = r.marks[i]; if (!st[ch] || rank[m] > rank[st[ch]]) st[ch] = m; }); return st; }, [mine]);

  const rows = Array.from({ length: MAX_TRIES }, (_, i) => mine[i] || (i === mine.length && !out ? { g: norm(cur), marks: null } : null));
  return (
    <div className="oculta">
      <div className="oculta-main" onClick={() => inputRef.current?.focus()}>
        <div className="wgrid" style={{ '--n': len } as React.CSSProperties}>
          {rows.map((r, i) => Array.from({ length: len }, (_, j) => (
            <span key={i + '-' + j} className={'wcell ' + (r?.marks ? r.marks[j] : r && r.g[j] ? 'typing' : '')}>{r?.g[j] || ''}</span>
          )))}
        </div>
        <input ref={inputRef} className="oculta-input" value={cur} autoFocus disabled={out} maxLength={len + 2} aria-label="tu intento"
          onChange={e => setCur(e.target.value.replace(/[^a-zA-ZñÑáéíóúüÁÉÍÓÚÜ]/g, '').toLowerCase().slice(0, len))}
          onKeyDown={e => { stop(e); if (e.key === 'Enter') { e.preventDefault(); submit(); } }} />
        {msg && <p className="msg err">{msg}</p>}
        {view.phase === 'playing' && solved && <p className="msg">¡La sacaste en {mine.length}! Esperá a los demás…</p>}
        {view.phase === 'playing' && !solved && mine.length >= MAX_TRIES && <p className="msg">Te quedaste sin intentos. Esperá a los demás…</p>}
        {view.phase === 'reveal' && <p className="reveal-word">la palabra era <b>{o.reveal}</b></p>}
        <div className="wkeys">
          {KEYS.map((row, i) => (
            <div key={i} className="wkrow">
              {i === 2 && <button type="button" className="wkey wide" onClick={() => press('⏎')}>enviar</button>}
              {[...row].map(k => <button key={k} type="button" className={'wkey ' + (keyState[k] || '')} onClick={() => press(k)}>{k}</button>)}
              {i === 2 && <button type="button" className="wkey wide" onClick={() => press('⌫')}>⌫</button>}
            </div>
          ))}
        </div>
      </div>
      <div className="oculta-others">
        {view.roster.filter(r => r.id !== me).map(r => (
          <div key={r.id} className="mini">
            <span className="mini-name" style={{ color: byId[r.id]?.color || r.color }}>{byId[r.id]?.name || r.name}{o.solved[r.id] != null ? ' ✓' : ''}</span>
            <div className="mini-grid" style={{ '--n': len } as React.CSSProperties}>
              {Array.from({ length: MAX_TRIES }, (_, i) => Array.from({ length: len }, (_, j) => <span key={i + '-' + j} className={'mcell ' + (o.rows[r.id]?.[i]?.[j] || '')} />))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* =================== sopa de letras =================== */
export function SopaGame({ view, me, act, byId }: { view: View; me: string; act: Act; byId: ById }) {
  const s = view.s!, n = s.grid.length;
  const [start, setStart] = useState<[number, number] | null>(null);
  const [hover, setHover] = useState<[number, number] | null>(null);
  const dragging = useRef(false);
  const owner = useMemo(() => { const m: Record<string, string> = {}; for (const f of Object.values(s.found)) for (const [r, c] of f.cells) m[r + ',' + c] = f.by; return m; }, [s.found]);
  const line = (a: [number, number] | null, b: [number, number] | null) => {
    if (!a || !b) return new Set<string>();
    const dr = Math.sign(b[0] - a[0]), dc = Math.sign(b[1] - a[1]), lr = Math.abs(b[0] - a[0]), lc = Math.abs(b[1] - a[1]);
    if (!(lr === 0 || lc === 0 || lr === lc)) return new Set([a.join(',')]);
    const len = Math.max(lr, lc); return new Set(Array.from({ length: len + 1 }, (_, i) => `${a[0] + dr * i},${a[1] + dc * i}`));
  };
  const sel = line(start, hover || start);
  const finish = (end: [number, number]) => {
    if (!start) return;
    if (end[0] === start[0] && end[1] === start[1]) return; // tocó la misma: espera la segunda letra
    act({ type: 'pick', r1: start[0], c1: start[1], r2: end[0], c2: end[1] }); setStart(null); setHover(null);
  };
  const cellAt = (e: React.PointerEvent) => { const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null; const d = el?.dataset; return d?.r ? [Number(d.r), Number(d.c)] as [number, number] : null; };
  const playing = view.phase === 'playing';
  return (
    <div className="sopa">
      <div className="sopa-grid" style={{ '--n': n } as React.CSSProperties}
        onPointerMove={e => { if (!start) return; const c = cellAt(e); if (c) setHover(c); }}
        onPointerUp={e => { if (!dragging.current) return; dragging.current = false; const c = cellAt(e); if (c) finish(c); }}
        onPointerLeave={() => { dragging.current = false; }}>
        {s.grid.map((row, r) => [...row].map((ch, c) => {
          const k = r + ',' + c, by = owner[k];
          return (
            <button key={k} type="button" data-r={r} data-c={c} disabled={!playing}
              className={'scell' + (sel.has(k) ? ' sel' : '') + (by ? ' found' : '')}
              style={by ? { '--c': byId[by]?.color || '#999' } as React.CSSProperties : undefined}
              onPointerDown={e => { e.preventDefault(); (e.target as HTMLElement).releasePointerCapture?.(e.pointerId); if (start && !(start[0] === r && start[1] === c)) { finish([r, c]); return; } setStart([r, c]); setHover([r, c]); dragging.current = true; }}>
              {ch}
            </button>
          );
        }))}
      </div>
      <div className="sopa-side">
        <span className="lbl">palabras · {Object.keys(s.found).length}/{s.words.length}</span>
        <ul className="sopa-words">
          {s.words.map(w => { const f = s.found[w]; return <li key={w} className={f ? 'done' : ''} style={f ? { color: byId[f.by]?.color } : undefined}>{w}{f && <small> · {f.by === me ? 'vos' : byId[f.by]?.name}</small>}</li>; })}
        </ul>
        {start && <button className="btn ghost" type="button" onClick={() => { setStart(null); setHover(null); }}>cancelar selección</button>}
      </div>
    </div>
  );
}

/* =================== pistas =================== */
export function PistasGame({ view, me, act, reply, secret, byId }: { view: View; me: string; act: Act; reply: { event: string; payload: any; n: number } | null; secret: string | null; byId: ById }) {
  const p = view.p!, giver = p.giver === me, playing = view.phase === 'playing';
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const feedRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setText(''); setErr(''); }, [view.round]);
  useEffect(() => { if (reply?.event === 'clue-error') setErr(reply.payload.error); }, [reply]);
  useEffect(() => { feedRef.current?.scrollTo({ top: 1e6 }); }, [p.guesses.length]);
  const submit = () => {
    const t = text.trim(); if (!t) return; setErr('');
    act(giver ? { type: 'clue', text: t } : { type: 'answer', text: t }); setText('');
  };
  const giverName = byId[p.giver]?.name || 'alguien';
  return (
    <div className="pistas">
      <div className="pistas-main">
        {giver ? (
          <div className="pistas-secret"><span className="lbl">tu palabra (no la digas)</span><b>{secret || '…'}</b></div>
        ) : (
          <div className="pistas-secret"><span className="lbl">{giverName} da las pistas</span><b className="blanks">{'_ '.repeat(p.len).trim()}</b><small>{p.len} letras</small></div>
        )}
        <div className="pistas-clues">
          {p.clues.length ? p.clues.map((c, i) => <span key={i} className="clue">{c}</span>) : <span className="hint">{giver ? 'escribí tu primera pista' : 'esperando la primera pista…'}</span>}
        </div>
        {playing && (giver ? p.clues.length < MAX_CLUES : p.clues.length > 0) && (
          <form className="pistas-form" onSubmit={e => { e.preventDefault(); submit(); }}>
            <input className="live-nick big-input" value={text} autoFocus onChange={e => setText(e.target.value)} onKeyDown={stop} maxLength={30}
              placeholder={giver ? `pista ${p.clues.length + 1} de ${MAX_CLUES} · una sola palabra` : 'tu respuesta'} />
            <button className="btn primary" type="submit">{giver ? 'dar pista' : 'adivinar'}</button>
            {giver && !p.clues.length && p.skips < 2 && <button className="btn ghost" type="button" onClick={() => act({ type: 'skip' })}>otra palabra</button>}
          </form>
        )}
        {err && <p className="msg err">{err}</p>}
        {view.phase === 'reveal' && <p className="reveal-word">{p.winner ? <>¡<b style={{ color: byId[p.winner]?.color }}>{byId[p.winner]?.name}</b> adivinó! era <b>{p.reveal}</b></> : <>nadie adivinó · era <b>{p.reveal}</b></>}</p>}
      </div>
      <div className="pistas-feed" ref={feedRef}>
        <span className="lbl">respuestas</span>
        {p.guesses.map((g, i) => <div key={i} className={'guess' + (g.ok ? ' ok' : '')}><b style={{ color: byId[g.id]?.color }}>{byId[g.id]?.name || '?'}</b> {g.text}</div>)}
      </div>
    </div>
  );
}

/* =================== tutti frutti =================== */
export function TuttiGame({ view, me, act, byId }: { view: View; me: string; act: Act; byId: ById }) {
  const t = view.t!, n = t.cats.length;
  const [ans, setAns] = useState<string[]>(() => Array(n).fill(''));
  const timer = useRef<number | null>(null);
  useEffect(() => { setAns(Array(t.cats.length).fill('')); }, [view.round, t.cats.length]);
  const change = (i: number, v: string) => {
    const next = ans.slice(); next[i] = v.slice(0, 40); setAns(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = window.setTimeout(() => act({ type: 'fill', answers: next }), 250);
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  // al cantar basta, mando lo último que tengo
  useEffect(() => { if (t.bastaBy) act({ type: 'fill', answers: ans }); }, [t.bastaBy]); // eslint-disable-line react-hooks/exhaustive-deps
  const L = t.letter.toUpperCase(), full = ans.every(a => a.trim());

  if (view.phase === 'playing') return (
    <div className="tutti">
      <div className="tutti-head">
        <span className="tutti-letter">{L}</span>
        {t.bastaBy ? <span className="tutti-basta">¡{t.bastaBy === me ? 'cantaste' : byId[t.bastaBy]?.name + ' cantó'} basta! terminá lo que puedas</span> : <span className="hint">todas empiezan con {L}</span>}
      </div>
      <div className="tutti-grid">
        {t.cats.map((c, i) => (
          <label key={c} className={'tutti-field' + (ans[i] && !norm(ans[i]).startsWith(t.letter) ? ' bad' : '')}>
            <span>{c}</span>
            <input value={ans[i]} onChange={e => change(i, e.target.value)} onKeyDown={stop} placeholder={L + '…'} />
          </label>
        ))}
      </div>
      <button className="btn primary big basta" type="button" disabled={!full || !!t.bastaBy} onClick={() => { act({ type: 'fill', answers: ans }); act({ type: 'basta' }); }}>¡basta!</button>
    </div>
  );

  // votación y resultado
  const answers = t.answers || {}, players = view.roster;
  const voting = view.phase === 'vote';
  return (
    <div className="tutti">
      <div className="tutti-head">
        <span className="tutti-letter">{L}</span>
        {voting ? <span className="hint">tocá las respuestas que no valen · se anula con la mayoría</span> : <span className="hint">resultado de la ronda</span>}
        {voting && <button className="btn" type="button" disabled={t.ready.includes(me)} onClick={() => act({ type: 'ready' })}>{t.ready.includes(me) ? `listo (${t.ready.length}/${players.length})` : 'listo'}</button>}
      </div>
      <div className="tutti-table" style={{ '--p': players.length } as React.CSSProperties}>
        <span />
        {players.map(p => <b key={p.id} style={{ color: byId[p.id]?.color || p.color }}>{byId[p.id]?.name || p.name}</b>)}
        {t.cats.map((c, k) => [
          <span key={c} className="tt-cat">{c}</span>,
          ...players.map(p => {
            const cell = `${p.id}:${k}`, a = answers[p.id]?.[k] || '', votes = t.votes[cell] || [], mineVote = votes.includes(me), pts = t.cell?.[cell] ?? 0;
            return (
              <button key={cell} type="button" className={'tt-ans' + (pts === 0 ? ' zero' : '') + (mineVote ? ' voted' : '')}
                disabled={!voting || p.id === me || !a} onClick={() => act({ type: 'vote', cell, against: !mineVote })}>
                <span>{a || '—'}</span>{a && <small>{pts}{votes.length ? ` · ✗${votes.length}` : ''}</small>}
              </button>
            );
          }),
        ])}
      </div>
    </div>
  );
}
