'use client';

/* Test de tipeo: configuración, caja de tipeo con fantasma y resultados.
   La caja (TypeBox) sigue siendo imperativa por rendimiento; todo lo demás es React. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CountUp from '@/components/bits/CountUp';
import ShinyText from '@/components/bits/ShinyText';
import DomNode from '@/components/ui/DomNode';
import PageHeader from '@/components/ui/PageHeader';

type Mode = 'time' | 'words';
type Sound = 'off' | 'mecanico' | 'suave' | 'maquina';
export interface TestCfg { mode: Mode; time: number; words: number; ghost: boolean; weak: boolean; vocab: string; sound: Sound }
export const DEFAULT_CFG: TestCfg = { mode: 'time', time: 30, words: 25, ghost: true, weak: false, vocab: 'medio', sound: 'off' };
const SOUNDS: [Sound, string][] = [['off', 'sin sonido'], ['mecanico', 'mecánico'], ['suave', 'suave'], ['maquina', 'máquina']];
const VOCAB_TIPS: Record<string, string> = { facil: 'palabras cortas y cotidianas', medio: 'palabras de uso común', dificil: 'palabras largas, con tildes, ñ y términos técnicos' };

/** clave del modo (para el récord y el fantasma): t30, w25, t60-dificil… */
export const testKey = (c: TestCfg) => (c.mode === 'time' ? 't' + c.time : 'w' + c.words) + (c.vocab && c.vocab !== 'medio' ? '-' + c.vocab : '');

interface Result {
  wpm: number; acc: number; raw: number; cons: number; secs: number; correct: number; all: number;
  chart: Node; slow: { k: string; err: number; ms: number }[]; label: string;
  newPb: boolean; pb: { wpm: number } | null;
}

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Un grupo de opciones de la barra de configuración. */
function Opt({ on, title, onClick, children }: { on: boolean; title?: string; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" className={'opt' + (on ? ' on' : '')} title={title} onClick={onClick}>{children}</button>;
}

export default function TestView() {
  const boxRef = useRef<HTMLDivElement>(null);
  const M = useRef<any>(null);                         // módulos de lib/tecla (solo en el navegador)
  const eng = useRef<{ box: any; pb: any; seed: number; ghost: boolean }>({ box: null, pb: null, seed: 0, ghost: false });
  const cfgRef = useRef<TestCfg>(DEFAULT_CFG);
  const [cfg, setCfgState] = useState<TestCfg | null>(null);
  const [live, setLive] = useState({ count: '', wpm: '', ghost: '' });
  const [res, setRes] = useState<Result | null>(null);
  const consumer = useRef<any>(null);

  const vlabel = (c: TestCfg) => (c.vocab && c.vocab !== 'medio' ? ' · ' + M.current.VOCAB_NAMES[c.vocab] : '');

  const updateLive = useCallback(() => {
    const b = eng.current.box, c = cfgRef.current, e = eng.current; if (!b) return;
    const started = !!b.t0;
    let ghost = '';
    if (e.ghost && e.pb) {
      if (started) {
        // letras de ventaja o desventaja contra el récord en el mismo momento
        const g = e.pb.tl as [number, number, number][], ms = b.elapsed() * 1000; let at: [number, number, number] | null = null;
        for (let i = 0; i < g.length && g[i][0] <= ms; i++) at = g[i];
        let gc = 0; if (at) { for (let i = 0; i < at[1]; i++) gc += b.words[i].length + 1; gc += at[2]; }
        const diff = b.charsDone() - gc; ghost = `vs récord ${diff >= 0 ? '+' : '−'}${Math.abs(diff)} letras`;
      } else ghost = `fantasma: ${Math.round(e.pb.wpm)} ppm`;
    }
    setLive({
      count: c.mode === 'time' ? String(Math.max(0, Math.ceil(c.time - b.elapsed()))) : `${b.wi}/${c.words}`,
      wpm: started ? Math.round(b.wpmNow()) + ' ppm' : (c.weak ? 'entrenando tus puntos débiles' : ''),
      ghost,
    });
  }, []);

  const restart = useCallback((seed?: number, vsGhost = false) => {
    const m = M.current, c = cfgRef.current, e = eng.current; if (!m || !e.box) return;
    const pb = m.store.get('pb:' + testKey(c)); e.pb = pb;
    let ghost = null; e.ghost = false;
    if (seed == null) seed = m.rand();
    if (vsGhost && c.ghost && pb && !c.weak) { seed = pb.seed; ghost = pb.tl; e.ghost = true; }
    if (c.weak && !Object.keys(m.KS.keys).length) m.toast('Todavía no hay datos de tus teclas: hacé un par de tests primero.');
    e.seed = seed!;
    const gen = c.weak ? m.weakWordGen(seed) : m.wordGen(seed, m.VOCAB[c.vocab] || m.VOCAB.medio), timed = c.mode === 'time';
    e.box.load(gen(timed ? 80 : c.words), { ghost, extend: timed ? gen : null, time: timed ? c.time : 0 });
    setRes(null); updateLive();
    requestAnimationFrame(() => e.box?.refresh());
    const cur = m.getConsumer(); if (cur === consumer.current || !cur) m.setConsumer(consumer.current);
  }, [updateLive]);

  const finish = useCallback((s: any) => {
    const m = M.current, c = cfgRef.current, e = eng.current;
    const hist = m.store.get('hist', []);
    hist.push({ d: Date.now(), k: testKey(c), wpm: +s.wpm.toFixed(1), acc: +s.acc.toFixed(1), raw: +s.raw.toFixed(1), cons: Math.round(s.cons), weak: c.weak });
    m.store.set('hist', hist.slice(-300));
    const label = (c.mode === 'time' ? `tiempo ${c.time}` : `palabras ${c.words}`) + vlabel(c);
    m.History.record({ t: 'test', key: c.weak ? undefined : testKey(c), mode: label + (c.weak ? ' · débiles' : ''), wpm: Math.round(s.wpm), acc: Math.round(s.acc), detail: `${Math.round(s.wpm)} ppm · ${Math.round(s.acc)}% · consistencia ${Math.round(s.cons)}%`, pts: Math.round(s.wpm * s.acc / 100) });
    const pb = e.pb; let newPb = false;
    if (!c.weak && s.acc >= 75 && s.wpm > 5 && (!pb || s.wpm > pb.wpm)) { m.store.set('pb:' + testKey(c), { wpm: s.wpm, acc: s.acc, seed: e.seed, tl: e.box.tl, d: Date.now() }); newPb = true; }
    const slow = Object.entries(s.kstat as Record<string, { e: number; n: number; t: number; c: number }>)
      .map(([k, v]) => ({ k, err: v.e / v.n, ms: v.c ? v.t / v.c : 0, n: v.n })).filter(x => x.n >= 2)
      .sort((a, b) => (b.err * 600 + b.ms) - (a.err * 600 + a.ms)).slice(0, 6);
    const chart = m.lineChart([{ v: s.per.map((p: any) => p.wpm), cls: 'ln' }, { v: s.per.map((p: any) => p.raw), cls: 'ln2' }], { marks: s.per.map((p: any) => p.err), xl: (i: number) => (i + 1) + 's', H: 150 });
    setRes({ wpm: s.wpm, acc: s.acc, raw: s.raw, cons: s.cons, secs: s.secs, correct: s.correct, all: s.all, chart, slow, label: label + (c.weak ? ' · débiles' : ''), newPb, pb });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // cargar los módulos y armar la caja de tipeo
  useEffect(() => {
    let alive = true;
    Promise.all([
      import('@/lib/tecla/utils'), import('@/lib/tecla/sfx'), import('@/lib/tecla/data/words'), import('@/lib/tecla/keystats'),
      import('@/lib/tecla/typebox'), import('@/lib/tecla/charts'), import('@/lib/tecla/input'), import('@/lib/tecla/history'),
    ]).then(([u, sfx, w, ks, tb, ch, input, hi]) => {
      if (!alive || !boxRef.current) return;
      M.current = { store: u.store, rand: u.rand, toast: u.toast, Sfx: sfx.Sfx, VOCAB: w.VOCAB, VOCAB_NAMES: w.VOCAB_NAMES, wordGen: w.wordGen, KS: ks.KS, weakWordGen: ks.weakWordGen, lineChart: ch.lineChart, getConsumer: input.getConsumer, setConsumer: input.setConsumer, History: hi.History };
      const c: TestCfg = { ...DEFAULT_CFG, ...u.store.get('cfg', {}) };
      cfgRef.current = c; setCfgState(c);
      const box = new tb.TypeBox(boxRef.current, { onTick: updateLive, onInput: updateLive, onFinish: finish });
      eng.current.box = box;
      consumer.current = {
        char: (ch2: string) => { if (box.done) return; playSound(ch2); box.char(ch2); },
        back: (x: boolean) => box.back(x),
        tab: () => restart(),
        enter: () => { if (box.done) restart(); },
      };
      input.setConsumer(consumer.current);
      restart(undefined, true); // al entrar: contra tu récord (si el fantasma está activado)
    });
    return () => {
      alive = false;
      const b = eng.current.box; if (b?.t0 && !b.done) b.stop();
      M.current?.setConsumer(null);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const playSound = (c: string) => {
    const m = M.current, p = cfgRef.current.sound || 'off'; if (p === 'off') return;
    m.Sfx.init();
    const b = eng.current.box, w = b.words[b.wi] || '', typed = b.typed[b.wi] || '';
    if (c !== ' ' && w[typed.length] !== c) m.Sfx.typeErr(p); else m.Sfx.typeKey(p, c === ' ');
  };

  const change = (patch: Partial<TestCfg>) => {
    const next = { ...cfgRef.current, ...patch };
    cfgRef.current = next; setCfgState(next); M.current.store.set('cfg', next); restart(undefined, true);
  };
  const soundIdx = Math.max(0, SOUNDS.findIndex(([k]) => k === (cfg?.sound || 'off')));
  const nextSound = () => {
    const k = SOUNDS[(soundIdx + 1) % SOUNDS.length][0];
    if (k !== 'off') { M.current.Sfx.init(); M.current.Sfx.typeKey(k); }
    change({ sound: k });
  };
  const repeat = () => restart(eng.current.seed);
  const vsRecord = () => restart(undefined, true);
  const hasPb = !!(cfg && M.current?.store.get('pb:' + testKey(cfg)) && !cfg.weak && cfg.ghost);
  const vocabNames = useMemo(() => (M.current ? Object.entries(M.current.VOCAB_NAMES as Record<string, string>) : []), [cfg]); // eslint-disable-line react-hooks/exhaustive-deps
  const motion = !reduced();

  return (
    <>
      <PageHeader eyebrow="* — tipeo" title="test">
      {cfg && (
        <div className="cfgbar">
          <div className="grp">
            <Opt on={cfg.ghost} title="Corré contra tu mejor marca en el mismo texto" onClick={() => change({ ghost: !cfg.ghost })}>* fantasma</Opt>
            <Opt on={cfg.weak} title="Palabras con tus teclas y combinaciones más flojas" onClick={() => change({ weak: !cfg.weak })}>* puntos débiles</Opt>
          </div>
          <span className="sep">|</span>
          <div className="grp">{vocabNames.map(([k, l]) => <Opt key={k} on={(cfg.vocab || 'medio') === k} title={VOCAB_TIPS[k]} onClick={() => change({ vocab: k })}>{l}</Opt>)}</div>
          <span className="sep">|</span>
          <div className="grp">
            <Opt on={cfg.mode === 'time'} onClick={() => change({ mode: 'time' })}>tiempo</Opt>
            <Opt on={cfg.mode === 'words'} onClick={() => change({ mode: 'words' })}>palabras</Opt>
          </div>
          <span className="sep">|</span>
          <div className="grp">
            {cfg.mode === 'time'
              ? [15, 30, 60, 120].map(n => <Opt key={n} on={cfg.time === n} onClick={() => change({ time: n })}>{n}</Opt>)
              : [10, 25, 50, 100].map(n => <Opt key={n} on={cfg.words === n} onClick={() => change({ words: n })}>{n}</Opt>)}
          </div>
          <span className="sep">|</span>
          <div className="grp"><Opt on={soundIdx > 0} title="sonido al tipear: tocá para cambiar" onClick={nextSound}>♪ {SOUNDS[soundIdx][1]}</Opt></div>
        </div>
      )}

      </PageHeader>

      <div className="page-body center">
      <div className="typing-wrap" hidden={!!res}>
        <div className="live"><span>{live.count}</span><span className="sm">{live.wpm}</span><span className="gh">{live.ghost}</span></div>
        <div ref={boxRef} />
        {hasPb && !live.ghost && <button className="btn ghost ghost-back" type="button" onClick={vsRecord}>correr contra tu récord</button>}
        <p className="hint"><kbd>tab</kbd> texto nuevo &nbsp;·&nbsp; <kbd>esc</kbd> soltar el foco &nbsp;·&nbsp; <kbd>ctrl</kbd>+<kbd>⌫</kbd> borrar palabra</p>
      </div>

      {res && (
        <div className="results">
          <div className="res-top">
            <div className="bigs">
              <div className="big"><span className="lbl">ppm</span><b>{motion ? <CountUp to={Math.round(res.wpm)} duration={0.9} separator="." /> : Math.round(res.wpm)}</b></div>
              <div className="big b2"><span className="lbl">precisión</span><b>{motion ? <CountUp to={Math.round(res.acc)} duration={0.9} /> : Math.round(res.acc)}%</b></div>
            </div>
            <div>
              <DomNode node={res.chart} />
              <div className="legend"><span><i />ppm</span><span><i className="d" />crudo por segundo</span><span><b style={{ color: 'var(--err)' }}>× </b>errores</span></div>
            </div>
          </div>
          <div className="minis">
            {[['modo', res.label], ['crudo', String(Math.round(res.raw))], ['consistencia', Math.round(res.cons) + '%'], ['tiempo', res.secs.toFixed(1) + 's'], ['caracteres', `${res.correct}/${res.all}`]]
              .map(([l, v]) => <div key={l} className="mini"><span className="lbl">{l}</span><b>{v}</b></div>)}
          </div>
          {res.newPb ? (
            <div className="note">
              <b>{motion ? <ShinyText text={res.pb ? '* nuevo récord' : '* primer récord'} color="var(--accent)" shineColor="#ffffff" speed={2.2} spread={110} /> : res.pb ? '* nuevo récord' : '* primer récord'}</b>
              {res.pb ? `superaste tu marca anterior de ${Math.round(res.pb.wpm)} ppm por ${Math.round(res.wpm - res.pb.wpm)} ppm. El fantasma ahora sos vos.` : 'guardamos este intento como fantasma: la próxima vez vas a correr contra él.'}
            </div>
          ) : res.pb ? <div className="note">tu récord en este modo es {Math.round(res.pb.wpm)} ppm · te faltaron {Math.max(1, Math.round(res.pb.wpm - res.wpm))} ppm</div> : null}
          {res.slow.length > 0 && (
            <div>
              <span className="lbl" style={{ marginBottom: 6 }}>teclas que más te frenaron en este test</span>
              <div className="chips">{res.slow.map(x => <span key={x.k} className={'chip' + (x.err > 0.1 ? ' bad' : '')}>{x.k}<small>{x.err > 0 ? Math.round(x.err * 100) + '% err' : Math.round(x.ms) + ' ms'}</small></span>)}</div>
            </div>
          )}
          <div className="row">
            <button className="btn primary" type="button" onClick={() => restart()}>siguiente</button>
            <button className="btn" type="button" onClick={repeat}>repetir texto</button>
            {hasPb && <button className="btn" type="button" onClick={vsRecord}>correr contra tu récord</button>}
            <button className="btn" type="button" onClick={() => change({ weak: true })}>entrenar puntos débiles</button>
            <span className="hint"><kbd>tab</kbd> siguiente</span>
          </div>
        </div>
      )}
      </div>
    </>
  );
}
