'use client';

/* Competir: pestañas, pantalla previa (dificultad de los rivales o la sala en vivo) y panel del final.
   Los juegos contra bots dibujan su arena por su cuenta (lib/compete/modes.ts). */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Tabs from '@/components/ui/Tabs';
import RoomBrowser from '@/components/RoomBrowser';
import { useKeys } from '@/lib/useKeys';
import type { EndResult } from '@/lib/compete/modes';
import { newRoomCode } from '@/lib/rooms';

interface Mode { id: string; name: string; desc: string; bots: boolean; start?: (area: HTMLElement, api: { again: () => void; end: (r: EndResult) => void }) => (() => void) | void }
const LIVE: Mode = { id: 'live', name: 'en vivo', bots: false, desc: 'Jugá con personas reales: carreras, arcade multijugador y juegos de palabras (palabra oculta, sopa de letras, pistas y tutti frutti). Enter abre una carrera rápida.' };
const DIFFS: [string, string][] = [['facil', 'fácil'], ['parejo', 'parejo'], ['dificil', 'difícil']];

export default function CompeteView() {
  const router = useRouter();
  const [modes, setModes] = useState<Mode[] | null>(null);
  const [cur, setCur] = useState('race');
  const [phase, setPhase] = useState<'pre' | 'play'>('pre');
  const [run, setRun] = useState(0);
  const [end, setEnd] = useState<EndResult | null>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const store = useRef<any>(null);

  useEffect(() => {
    Promise.all([import('@/lib/compete/modes'), import('@/lib/tecla/utils')]).then(([m, u]) => {
      store.current = u.store;
      const all = [LIVE, ...(m.MODES as Mode[])];
      setModes(all);
      const saved = u.store.get('compMode', 'race');
      setCur(all.some(x => x.id === saved) ? saved : 'race');
    });
  }, []);

  const mode = modes?.find(m => m.id === cur);
  const pick = (id: string) => { setCur(id); store.current?.set('compMode', id); setPhase('pre'); setEnd(null); };
  const start = useCallback(() => {
    if (!mode) return;
    if (mode.id === 'live') { router.push('/carrera/' + newRoomCode()); return; }
    setEnd(null); setPhase('play'); setRun(r => r + 1);
  }, [mode, router]);
  const again = useCallback(() => { setEnd(null); setRun(r => r + 1); }, []);

  // arrancar el juego (y volver a arrancarlo con "otra vez")
  useEffect(() => {
    if (phase !== 'play' || !mode?.start || !areaRef.current) return;
    const area = areaRef.current; area.replaceChildren();
    const stop = mode.start(area, { again, end: r => setEnd(r) });
    return () => { stop?.(); area.replaceChildren(); };
  }, [phase, run, mode, again]);
  useEffect(() => () => { import('@/lib/tecla/input').then(m => m.setConsumer(null)); }, []);

  if (!modes || !mode) return null;
  return (
    <>
      <div className="subtabs"><Tabs items={modes.map(m => ({ id: m.id, label: m.name }))} value={cur} onChange={pick} label="modos de competir" /></div>
      <div className="panel" id="comp-area">
        {phase === 'pre'
          ? <PreStart mode={mode} onStart={start} go={p => router.push(p)} store={store.current} />
          : (
            <div className="arena-host">
              <div ref={areaRef} className="arena-area" />
              {end && <EndPanel r={end} again={again} />}
            </div>
          )}
      </div>
    </>
  );
}

function PreStart({ mode, onStart, go, store }: { mode: Mode; onStart: () => void; go: (p: string) => void; store: any }) {
  useKeys({ enter: onStart });
  return (
    <div className="prestart">
      <span className="eyebrow">* — modo</span>
      <h2>{mode.name}</h2>
      <p className="sub">{mode.desc}</p>
      {mode.id === 'live' && <div className="rooms-host"><RoomBrowser go={go} /></div>}
      {mode.bots && <DiffSelector store={store} />}
      {mode.id !== 'live' && (
        <div className="row"><button className="btn primary" type="button" onClick={onStart}>empezar</button><span className="hint">o presioná <kbd>enter</kbd></span></div>
      )}
    </div>
  );
}

/** Dificultad de los rivales: se ajustan a tu promedio de los últimos tests. */
function DiffSelector({ store }: { store: any }) {
  const [diff, setDiff] = useState<string>(() => store?.get('diff', 'parejo') || 'parejo');
  const [base, setBase] = useState<number | null>(null);
  useEffect(() => { import('@/lib/tecla/views/shared').then(m => setBase(Math.round(m.botBase()))); }, []);
  return (
    <div className="row">
      <span className="lbl">rivales</span>
      <Tabs className="cfgbar" items={DIFFS.map(([id, label]) => ({ id, label }))} value={diff} onChange={id => { setDiff(id); store?.set('diff', id); }} label="dificultad de los rivales" />
      <span className="sub" style={{ fontSize: 12.5 }}>se ajustan a tu promedio ({base ?? '…'} ppm) · también cambia el vocabulario</span>
    </div>
  );
}

function EndPanel({ r, again }: { r: EndResult; again: () => void }) {
  const [copied, setCopied] = useState<'' | 'ok' | 'manual'>('');
  useKeys({ enter: again, tab: again });
  const copy = () => {
    const ok = () => { setCopied('ok'); setTimeout(() => setCopied(''), 1500); };
    try { navigator.clipboard.writeText(r.share!).then(ok, () => setCopied('manual')); } catch { setCopied('manual'); }
  };
  return (
    <div className="endpanel">
      <h3>{r.title}</h3>
      {r.lines.map(l => <p key={l} className="sub">{l}</p>)}
      {r.share && (
        <div className="row">
          <pre style={{ margin: 0, font: 'inherit', fontSize: 12.5, color: 'var(--sub)', whiteSpace: 'pre-wrap' }}>{r.share}</pre>
          <button className="btn" type="button" onClick={copy}>{copied === 'ok' ? 'copiado' : copied === 'manual' ? 'seleccionalo y copialo' : 'copiar resultado'}</button>
          {copied === 'manual' && <textarea rows={3} readOnly value={r.share} onFocus={e => e.currentTarget.select()} autoFocus />}
        </div>
      )}
      {r.daily && <DailyBoard {...r.daily} />}
      <div className="row"><button className="btn primary" type="button" onClick={again}>otra vez</button><span className="hint"><kbd>enter</kbd> o <kbd>tab</kbd></span></div>
    </div>
  );
}

/** Ranking del desafío diario (solo con cuenta). */
function DailyBoard({ day, wpm, acc }: { day: string; wpm: number; acc: number }) {
  const [rows, setRows] = useState<{ user_id: string; display_name: string | null; wpm: number }[] | null>(null);
  const [cloud, setCloud] = useState<boolean | null>(null);
  const [me, setMe] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    import('@/lib/tecla/history').then(async ({ History }) => {
      const c = History.mode === 'cloud'; if (!alive) return; setCloud(c); setMe(History.user?.id || null);
      if (!c) return;
      await History.submitDaily(day, wpm, acc);
      const r = await History.dailyTop(day); if (alive) setRows(r);
    });
    return () => { alive = false; };
  }, [day, wpm, acc]);
  return (
    <div className="board">
      <span className="lbl">ranking de hoy</span>
      {cloud === false && <p className="hint">entrá con tu cuenta para aparecer en el ranking del día</p>}
      {cloud && !rows && <p className="hint">cargando…</p>}
      {rows && (rows.length
        ? <ol>{rows.map(x => <li key={x.user_id} className={x.user_id === me ? 'me' : ''}><span>{x.display_name || 'alguien'}</span><b>{Math.round(x.wpm)} ppm</b></li>)}</ol>
        : <p className="hint">todavía no hay resultados</p>)}
    </div>
  );
}
