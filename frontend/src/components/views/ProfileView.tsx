'use client';

/* Perfil: nivel, resumen, récords de arcade e historial paginado. */
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Run } from '@/lib/tecla/history';
import { useHistory } from '@/lib/useHistory';
import { DIFF_NAMES, GAME_INFO, type Diff } from '@/lib/games';
import type { RoomGame } from '@/lib/rooms';
import Tabs from '@/components/ui/Tabs';
import PageHeader from '@/components/ui/PageHeader';
import { useShop } from '@/lib/shop/client';
import { EFFECT, titleOf } from '@/lib/shop/catalog';
import Avatar from '@/components/shop/Avatar';
import Badge from '@/components/shop/Badge';

const KINDS = [{ id: 'all', label: 'todo' }, { id: 'test', label: 'tests' }, { id: 'arcade', label: 'arcade' }, { id: 'comp', label: 'competir' }, { id: 'study', label: 'estudiar' }];
const GLYPH: Record<string, string> = { test: '|', arcade: '*', comp: '—', study: '/' };
const ARCADE: RoomGame[] = ['caen', 'torre', 'runner', 'bombas'];

/** nivel a partir de los puntos: cada nivel pide más que el anterior */
export function level(xp: number) {
  const lv = Math.floor(Math.sqrt(xp / 150)) + 1, a = 150 * (lv - 1) ** 2, b = 150 * lv ** 2;
  return { lv, pct: (xp - a) / (b - a), next: b - xp };
}
const title = (r: Run) =>
  r.t === 'test' ? 'test · ' + r.mode
    : r.t === 'arcade' ? `${GAME_INFO[r.game as RoomGame]?.name || r.game} · ${DIFF_NAMES[r.diff as Diff] || ''}`
      : r.t === 'comp' ? r.mode || 'competir' : 'estudio · ' + r.mode;
function dayLabel(d: number) {
  const x = new Date(d), t = new Date(), same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(x, t)) return 'hoy'; t.setDate(t.getDate() - 1); if (same(x, t)) return 'ayer';
  return x.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
}
const num = (n: number) => n.toLocaleString('es');

export default function ProfileView() {
  const H = useHistory();
  const shop = useShop();
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [per, setPer] = useState(8);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    const fit = () => setPer(Math.min(16, Math.max(4, Math.floor((window.innerHeight - 300) / 44))));
    fit(); window.addEventListener('resize', fit); return () => window.removeEventListener('resize', fit);
  }, []);
  if (!H) return null;

  const runs = H.all(), xp = runs.reduce((a, r) => a + (r.pts || 0), 0), L = level(xp), me = H.user;
  const name = me?.name || 'vos', cloud = H.mode === 'cloud', pend = H.pending();
  const of = (t: string) => runs.filter(r => r.t === t);
  const tests = of('test'), arc = of('arcade'), comp = of('comp');
  const list = runs.filter(r => filter === 'all' || r.t === filter);
  const pages = Math.max(1, Math.ceil(list.length / per)), p = Math.min(page, pages - 1);
  const shown = list.slice(p * per, p * per + per);

  return (
    <>
    <PageHeader eyebrow="* — tu cuenta" title="perfil">
      <span className={'chip sync' + (cloud ? ' ok' : '')}>{cloud ? (pend ? `guardando ${pend}…` : '* guardado en tu cuenta') : 'guardado solo en este navegador'}</span>
      {me?.username && <Link className="btn ghost" href={'/u/' + me.username}>perfil público</Link>}
      {cloud && <button className="btn ghost" type="button" onClick={() => setEditing(e => !e)}>{editing ? 'cerrar' : 'cambiar nombre'}</button>}
      {cloud ? <button className="btn ghost" type="button" onClick={() => H.signOut()}>salir</button> : <Link className="btn primary" href="/login">entrar</Link>}
    </PageHeader>
    <div className="two fill">
      <div className="col">
        <div className="panel phead">
          <span className="corner">* — |</span>
          <Avatar url={me?.avatarUrl} name={name} seed={me?.username || me?.id || name} style={EFFECT[shop.state?.equipped.avatar || '']} frame={EFFECT[shop.state?.equipped.marco || '']} />
          <div className="pinfo">
            <span className="eyebrow">{me?.username ? '@' + me.username : 'perfil'}</span>
            <h2 className="pname">{name}<Badge fx={EFFECT[shop.state?.equipped.insignia || '']} title={shop.items?.find(i => i.id === shop.state?.equipped.insignia)?.name} /></h2>
            {titleOf(shop.items || [], shop.state?.equipped.titulo) && <span className="ptitle">{titleOf(shop.items || [], shop.state?.equipped.titulo)}</span>}
            <p className="sub">nivel {L.lv} · {num(xp)} puntos · faltan {num(L.next)} para el nivel {L.lv + 1}</p>
            <div className="progress" style={{ maxWidth: 420 }}><i style={{ width: `${(L.pct * 100).toFixed(1)}%` }} /></div>
          </div>
        </div>

        {cloud && editing && me && <NameEditor name={me.name} username={me.username || ''} save={patch => H.updateProfile(patch)} done={() => setEditing(false)} />}

        <div className="tiles t2">
          {[
            ['puntos totales', num(xp), 'acc'],
            ['tests', tests.length ? `${tests.length} · mejor ${Math.max(...tests.map(r => r.wpm || 0))} ppm` : '0', ''],
            ['partidas arcade', String(arc.length), ''],
            ['victorias', `${comp.filter(r => r.win).length} de ${comp.length}`, ''],
          ].map(([l, v, c]) => <div key={l} className={'tile ' + c}><span className="lbl">{l}</span><b>{v}</b></div>)}
        </div>

        <div className="panel">
          <span className="eyebrow">récords de arcade</span>
          <div style={{ overflowX: 'auto', marginTop: 10 }}>
            <table className="rtable">
              <thead><tr><th>juego</th>{Object.values(DIFF_NAMES).map(d => <th key={d} className="num">{d}</th>)}</tr></thead>
              <tbody>
                {ARCADE.map(g => (
                  <tr key={g}>
                    <td>{GAME_INFO[g].name}</td>
                    {(Object.keys(DIFF_NAMES) as Diff[]).map(d => { const best = H.bestArcade(g, d); return <td key={d} className={'num' + (best ? '' : ' none')}>{best ? num(best) : '—'}</td>; })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="eyebrow">historial · {list.length} actividades</span>
          <Tabs items={KINDS} value={filter} onChange={id => { setFilter(id); setPage(0); }} label="filtrar historial" />
        </div>
        <div className="hist">
          {shown.map((r, i) => {
            const day = dayLabel(r.d), prevDay = i ? dayLabel(shown[i - 1].d) : '';
            return (
              <div key={r.id}>
                {day !== prevDay && <div className="hday">{day}</div>}
                <div className="hrow">
                  <span className="ht">{new Date(r.d).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="hg">{GLYPH[r.t] || '*'}</span>
                  <div className="hm"><span className="hti">{title(r)}</span><span className="det">{(r.detail || '') + (r.t === 'arcade' && r.fin === false ? ' · guardada al salir' : '')}</span></div>
                  <span className="hp">+{num(r.pts || 0)}</span>
                </div>
              </div>
            );
          })}
          {!list.length && <p className="sub">{runs.length ? 'No hay actividad de este tipo todavía.' : 'Todavía no hay actividad. Hacé un test, jugá en el arcade o estudiá un rato: todo queda acá.'}</p>}
        </div>
        {pages > 1 && (
          <div className="row pager">
            <button className="btn ghost" type="button" disabled={p === 0} onClick={() => setPage(p - 1)}>← más nuevas</button>
            <span className="hint">página {p + 1} de {pages}</span>
            <button className="btn ghost" type="button" disabled={p >= pages - 1} onClick={() => setPage(p + 1)}>más viejas →</button>
          </div>
        )}
      </div>
    </div>
    </>
  );
}

function NameEditor({ name, username, save, done }: { name: string; username: string; save: (p: { display_name?: string; username?: string }) => Promise<string | null>; done: () => void }) {
  const [n, setN] = useState(name), [u, setU] = useState(username), [msg, setMsg] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const patch: { display_name?: string; username?: string } = {};
    if (n.trim() !== name) patch.display_name = n.trim();
    const uu = u.trim().toLowerCase(); if (uu && uu !== username) patch.username = uu;
    if (!Object.keys(patch).length) return done();
    const err = await save(patch);
    if (err) setMsg(err); else done();
  };
  return (
    <form className="panel editor" onSubmit={submit}>
      <span className="eyebrow">editar perfil</span>
      <div className="row">
        <label className="lbl" htmlFor="edit-name">nombre</label>
        <input className="live-nick" id="edit-name" value={n} maxLength={40} onChange={e => setN(e.target.value)} onKeyDown={e => e.stopPropagation()} />
        <label className="lbl" htmlFor="edit-user">usuario</label>
        <input className="live-nick" id="edit-user" value={u} maxLength={20} onChange={e => setU(e.target.value)} onKeyDown={e => e.stopPropagation()} />
        <button className="btn primary" type="submit">guardar</button>
      </div>
      {msg ? <p className="msg err">{msg}</p> : <p className="hint" style={{ textAlign: 'left' }}>el nombre se puede repetir con el de otra persona · el usuario es único y es tu link público (tecla/u/tu-usuario)</p>}
    </form>
  );
}
