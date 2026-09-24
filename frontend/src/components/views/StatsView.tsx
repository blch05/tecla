'use client';

/* Progreso: resumen de tests, gráfico de velocidad, mapa de calor del teclado y combinaciones lentas. */
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Tabs from '@/components/ui/Tabs';
import DomNode from '@/components/ui/DomNode';

interface Mods {
  store: any; avg: (a: number[]) => number; baseKey: (k: string) => string;
  KS: any; weakData: () => { bis: { b: string; ms: number; err: number }[] };
  lineChart: (series: any[], opts: any) => Node;
}
interface HistRow { wpm: number; acc: number; weak?: boolean }
const ROWS = ['qwertyuiop', 'asdfghjklñ', 'zxcvbnm'];

/** Tendencia de los últimos tests (regresión lineal): cuánto mejorás por test y cuándo llegás a la próxima decena. */
export function projection(ys: number[]) {
  if (ys.length < 6) return 'Hacé algunos tests más y te mostramos a qué ritmo estás mejorando.';
  const n = ys.length, xs = ys.map((_, i) => i), mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
  const mx = mean(xs), my = mean(ys);
  const slope = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  const target = Math.ceil((my + 1) / 10) * 10;
  if (slope <= 0.05) return 'Tu velocidad está estable. Probá el modo de puntos débiles para destrabarte.';
  const tests = Math.max(1, Math.ceil((target - (my + slope * (n - 1 - mx))) / slope));
  return `Venís sumando ${slope.toFixed(2)} ppm por test. A este ritmo llegás a ${target} ppm en unos ${tests} tests más.`;
}

export default function StatsView() {
  const router = useRouter();
  const [m, setM] = useState<Mods | null>(null);
  const [mode, setMode] = useState<'err' | 'ms'>('err');
  const [sure, setSure] = useState(false);
  const [ver, bump] = useState(0);
  useEffect(() => {
    Promise.all([import('@/lib/tecla/utils'), import('@/lib/tecla/keystats'), import('@/lib/tecla/charts'), import('@/lib/tecla/input')])
      .then(([u, k, c, input]) => { input.setConsumer(null); setM({ store: u.store, avg: u.avg, baseKey: u.baseKey, KS: k.KS, weakData: k.weakData, lineChart: c.lineChart }); });
  }, []);
  useEffect(() => { if (!sure) return; const t = setTimeout(() => setSure(false), 4000); return () => clearTimeout(t); }, [sure]);

  const hist: HistRow[] = useMemo(() => (m ? (m.store.get('hist', []) as HistRow[]).filter(x => !x.weak) : []), [m, ver]);
  const recent = hist.slice(-40), last10 = hist.slice(-10);
  const chart = useMemo(() => (m ? m.lineChart([{ v: recent.map(x => x.wpm), cls: 'ln' }], { H: 170, dots: true, xl: (i: number) => hist.length - recent.length + i + 1 }) : null), [m, hist]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!m) return null;

  const best = hist.reduce((a, x) => Math.max(a, x.wpm), 0);
  // teclas: errores o lentitud, agrupando las acentuadas con su letra base
  const agg: Record<string, { n: number; e: number; t: number; c: number }> = {};
  Object.entries(m.KS.keys as Record<string, { n: number; e: number; t: number; c: number }>).forEach(([k, s]) => {
    const b = m.baseKey(k), a = (agg[b] ||= { n: 0, e: 0, t: 0, c: 0 }); a.n += s.n; a.e += s.e; a.t += s.t; a.c += s.c;
  });
  const vals: Record<string, number> = {};
  Object.entries(agg).filter(([, s]) => s.n >= 3).forEach(([k, s]) => { vals[k] = mode === 'err' ? s.e / s.n : (s.c ? s.t / s.c : 0); });
  const arr = Object.values(vals).filter(x => x > 0), mx = Math.max(...arr, 0), mn = mode === 'err' ? 0 : Math.min(...arr, mx);
  const slow = m.weakData().bis.filter(b => b.ms).sort((a, b) => (b.ms + b.err * 800) - (a.ms + a.err * 800)).slice(0, 10);
  const hc = mode === 'err' ? 'var(--err)' : 'var(--accent)';

  const reset = () => {
    if (!sure) { setSure(true); return; }
    Object.keys(localStorage).filter(k => k.startsWith('tecla:')).forEach(k => { try { localStorage.removeItem(k); } catch {} });
    m.KS.keys = {}; m.KS.bi = {}; setSure(false); bump(x => x + 1);
    import('@/lib/tecla/utils').then(u => u.toast('Progreso borrado'));
  };
  // el test lee su configuración del almacenamiento al abrirse
  const trainWeak = () => { m.store.set('cfg', { ...m.store.get('cfg', {}), weak: true }); router.push('/test'); };

  return (
    <>
      <div className="tiles">
        {[
          ['tests', String(hist.length), ''],
          ['promedio (últimos 10)', last10.length ? String(Math.round(m.avg(last10.map(x => x.wpm)))) : '—', 'acc'],
          ['mejor marca', best ? String(Math.round(best)) : '—', ''],
          ['precisión media', last10.length ? Math.round(m.avg(last10.map(x => x.acc))) + '%' : '—', ''],
        ].map(([l, v, c]) => <div key={l} className={'tile ' + c}><span className="lbl">{l}</span><b>{v}</b></div>)}
      </div>
      <div className="two fill">
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="corner">— — *</span>
          <span className="eyebrow">progreso · ppm por test</span>
          <div style={{ marginTop: 10 }}><DomNode node={chart} /></div>
          <p className="sub" style={{ marginTop: 8, fontSize: 13.5 }}>{projection(recent.map(x => x.wpm))}</p>
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 'auto' }}>
            <button className="btn ghost" type="button" onClick={reset}>{sure ? '¿seguro? tocá de nuevo para borrar todo' : 'borrar mi progreso'}</button>
          </div>
        </div>
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span className="corner">| * |</span>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="eyebrow">mapa de calor del teclado</span>
            <Tabs items={[{ id: 'err', label: 'errores' }, { id: 'ms', label: 'lentitud' }]} value={mode} onChange={id => setMode(id as 'err' | 'ms')} label="qué mostrar" />
          </div>
          {arr.length ? (
            <>
              <div className="kbd" style={{ '--hc': hc } as React.CSSProperties}>
                {ROWS.map((row, ri) => (
                  <div key={row} className="krow" style={{ marginLeft: ri * 16 }}>
                    {[...row].map(k => {
                      const s = agg[k], v = vals[k], t = v != null && mx > mn ? (v - mn) / (mx - mn) : 0;
                      return <div key={k} className={'key' + (t > 0.6 ? ' hot' : '')} style={{ '--v': (t * 0.85).toFixed(2) } as React.CSSProperties}
                        title={s ? `${k}: ${s.n} pulsaciones · ${Math.round(s.e / s.n * 100)}% errores · ${s.c ? Math.round(s.t / s.c) : '—'} ms` : `${k}: sin datos`}>{k}</div>;
                    })}
                  </div>
                ))}
              </div>
              <div className="klegend" style={{ '--hc': hc } as React.CSSProperties}>{mode === 'err' ? 'menos errores' : 'más rápida'}<span className="grad" />{mode === 'err' ? 'más errores' : 'más lenta'}</div>
            </>
          ) : <p className="sub">Todavía no hay datos. Cada test que hagas va llenando el mapa.</p>}
          <div style={{ borderTop: '1px dashed var(--line)', margin: '4px 0 2px' }} />
          <span className="eyebrow">combinaciones que te frenan</span>
          {slow.length ? (
            <div className="chips">{slow.map(b => <span key={b.b} className={'chip' + (b.err > 0.12 ? ' bad' : '')}>{b.b}<small>{Math.round(b.ms)} ms{b.err > 0.05 ? ' · ' + Math.round(b.err * 100) + '%' : ''}</small></span>)}</div>
          ) : <p className="sub">Aparecen cuando juntemos suficientes pulsaciones de cada par de letras.</p>}
          <p className="sub" style={{ fontSize: 13 }}>El modo de puntos débiles arma textos con las palabras que más usan estas teclas y combinaciones.</p>
          <div className="row"><button className="btn primary" type="button" onClick={trainWeak}>entrenar puntos débiles</button></div>
        </div>
      </div>
    </>
  );
}
