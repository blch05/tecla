'use client';

/* Competir: pestañas, pantalla previa (dificultad de los rivales o la sala en vivo) y panel del final.
   Los juegos contra bots dibujan su arena por su cuenta (lib/compete/modes.ts). */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Tabs from '@/components/ui/Tabs';
import PageHeader from '@/components/ui/PageHeader';
import RoomBrowser from '@/components/RoomBrowser';
import { useKeys } from '@/lib/useKeys';
import { MODES, type CompeteMode, type EndResult } from '@/lib/compete/modes';
import { botBase, DIFFS, type BotDiff } from '@/lib/compete/bots';
import { store } from '@/lib/tecla/utils';
import { setConsumer } from '@/lib/tecla/input';
import { History } from '@/lib/tecla/history';
import { useQuery } from '@tanstack/react-query';
import { dailyTopQuery } from '@/lib/queries';
import { useSession } from '@/lib/useHistory';
import { newRoomCode } from '@/lib/rooms';

const LIVE: CompeteMode = { id: 'live', name: 'en vivo', bots: false, desc: 'Jugá con personas reales: carreras, arcade multijugador y juegos de palabras (palabra oculta, sopa de letras, pistas y tutti frutti). Enter abre una carrera rápida.' };
const ALL: CompeteMode[] = [LIVE, ...MODES];

export default function CompeteView() {
  const router = useRouter();
  const [cur, setCur] = useState('race');
  const [phase, setPhase] = useState<'pre' | 'play'>('pre');
  const [run, setRun] = useState(0);
  const [end, setEnd] = useState<EndResult | null>(null);
  const areaRef = useRef<HTMLDivElement>(null);

  // el último modo elegido (se lee en el navegador para no desentonar con el HTML del servidor)
  useEffect(() => {
    const saved = store.get('compMode', 'race');
    setCur(ALL.some(x => x.id === saved) ? saved : 'race');
  }, []);

  const mode = ALL.find(m => m.id === cur) || ALL[1];
  const pick = (id: string) => { setCur(id); store.set('compMode', id); setPhase('pre'); setEnd(null); };
  const start = useCallback(() => {
    if (mode.id === 'live') { router.push('/carrera/' + newRoomCode()); return; }
    setEnd(null); setPhase('play'); setRun(r => r + 1);
  }, [mode, router]);
  const again = useCallback(() => { setEnd(null); setRun(r => r + 1); }, []);

  // arrancar el juego (y volver a arrancarlo con "otra vez")
  useEffect(() => {
    if (phase !== 'play' || !mode.start || !areaRef.current) return;
    const area = areaRef.current; area.replaceChildren();
    const stop = mode.start(area, { again, end: r => setEnd(r) });
    return () => { stop(); area.replaceChildren(); };
  }, [phase, run, mode, again]);
  useEffect(() => () => setConsumer(null), []);

  return (
    <>
      <PageHeader eyebrow="* — contra bots o personas" title="competir">
        <Tabs items={ALL.map(m => ({ id: m.id, label: m.name }))} value={cur} onChange={pick} label="modos de competir" />
      </PageHeader>
      <div className="panel" id="comp-area">
        {phase === 'pre'
          ? <PreStart mode={mode} onStart={start} go={p => router.push(p)} />
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

function PreStart({ mode, onStart, go }: { mode: CompeteMode; onStart: () => void; go: (p: string) => void }) {
  useKeys({ enter: onStart });
  return (
    <div className="prestart">
      <span className="eyebrow">* — modo</span>
      <h2>{mode.name}</h2>
      <p className="sub">{mode.desc}</p>
      {mode.id === 'live' && <div className="rooms-host"><RoomBrowser go={go} /></div>}
      {mode.bots && <DiffSelector />}
      {mode.id !== 'live' && (
        <div className="row"><button className="btn primary" type="button" onClick={onStart}>empezar</button><span className="hint">o presioná <kbd>enter</kbd></span></div>
      )}
    </div>
  );
}

/** Dificultad de los rivales: se ajustan a tu promedio de los últimos tests. */
function DiffSelector() {
  const [diff, setDiff] = useState<BotDiff>('parejo');
  const [base, setBase] = useState<number | null>(null);
  useEffect(() => { setDiff(store.get<BotDiff>('diff', 'parejo')); setBase(Math.round(botBase())); }, []);
  return (
    <div className="row">
      <span className="lbl">rivales</span>
      <Tabs className="cfgbar" items={Object.entries(DIFFS).map(([id, d]) => ({ id, label: d.label }))} value={diff} onChange={id => { setDiff(id as BotDiff); store.set('diff', id); }} label="dificultad de los rivales" />
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
  const cloud = useSession(s => s.mode === 'cloud');
  const me = useSession(s => s.user?.id ?? null);
  // primero se guarda mi resultado y recién después se pide el ranking (para aparecer en él)
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => {
    if (!cloud) return;
    let alive = true;
    History.submitDaily(day, wpm, acc).then(() => { if (alive) setSubmitted(true); });
    return () => { alive = false; };
  }, [cloud, day, wpm, acc]);
  const rows = useQuery({ ...dailyTopQuery(day), enabled: cloud && submitted }).data ?? null;
  return (
    <div className="board">
      <span className="lbl">ranking de hoy</span>
      {!cloud && <p className="hint">entrá con tu cuenta para aparecer en el ranking del día</p>}
      {cloud && !rows && <p className="hint">cargando…</p>}
      {rows && (rows.length
        ? <ol>{rows.map(x => <li key={x.user_id} className={x.user_id === me ? 'me' : ''}><span>{x.display_name || 'alguien'}</span><b>{Math.round(x.wpm)} ppm</b></li>)}</ol>
        : <p className="hint">todavía no hay resultados</p>)}
    </div>
  );
}
