'use client';

/* Los cinco modos de estudio. Cada uno recibe el documento procesado y avisa cada acierto con hit(). */
import { useEffect, useMemo, useRef, useState } from 'react';
import { avg, norm, now, shuffle } from '@/lib/tecla/utils';
import { TypeBox } from '@/lib/tecla/typebox';
import { useKeys, useStateRef } from '@/lib/useKeys';
import { paraKeywords, pickBlanks, tokens, type StudyDoc } from '@/lib/study/doc';

export interface ModeProps { doc: StudyDoc; name: string; desc: string; hit: (ok: boolean, pts: number) => void; again: () => void }

function Head({ name, desc, right }: { name: string; desc: string; right?: React.ReactNode }) {
  return (
    <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
      <div><span className="eyebrow">* {name}</span><p className="sub" style={{ fontSize: 13 }}>{desc}</p></div>
      {right}
    </div>
  );
}
const Kbd = ({ children }: { children: React.ReactNode }) => <kbd>{children}</kbd>;

/* ---------- tipear el texto ---------- */
export function CopyMode({ doc, name, desc, hit }: ModeProps) {
  const holder = useRef<HTMLDivElement>(null);
  const box = useRef<any>(null);
  const [i, setI] = useState(0);
  const [res, setRes] = useState<{ wpm: number; acc: number } | null>(null);
  const n = doc.paras.length, idx = (x: number) => (x + n) % n;
  useEffect(() => {
    box.current = new TypeBox(holder.current!, { onFinish: (s: any) => { hit(s.acc >= 90, Math.round(s.wpm * s.acc / 200)); setRes({ wpm: s.wpm, acc: s.acc }); } });
    return () => box.current?.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setRes(null); box.current?.load(doc.paras[i].split(/\s+/)); }, [i, doc]);
  const go = (x: number) => setI(idx(x));
  useKeys({ char: c => box.current?.char(c), back: x => box.current?.back(x), tab: () => { setRes(null); box.current?.load(doc.paras[i].split(/\s+/)); }, enter: () => { if (box.current?.done) go(i + 1); } });
  return (
    <>
      <Head name={name} desc={desc} right={
        <div className="row">
          <button className="btn ghost" type="button" onClick={() => go(i - 1)}>← anterior</button>
          <span className="sub" style={{ fontSize: 13 }}>párrafo {i + 1} de {n}</span>
          <button className="btn ghost" type="button" onClick={() => go(i + 1)}>siguiente →</button>
        </div>} />
      <div ref={holder} />
      <p className="sub" style={{ minHeight: '1.5em', marginTop: 10 }}>
        {res && <><b style={{ color: 'var(--accent)' }}>{Math.round(res.wpm)} ppm · {Math.round(res.acc)}% </b> — <Kbd>enter</Kbd> siguiente párrafo</>}
      </p>
    </>
  );
}

/* ---------- completar huecos ---------- */
type Mark = 'ok' | 'casi' | 'mal';
export function HuecosMode({ doc, name, desc, hit }: ModeProps) {
  const n = doc.paras.length;
  const firstWith = (from: number) => { for (let d = 0; d < n; d++) { const p = (from + d + n) % n; if (pickBlanks(doc.paras[p], doc.score).length) return p; } return (from + n) % n; };
  const [pi, setPi] = useState(() => firstWith(0));
  const blanks = useMemo(() => pickBlanks(doc.paras[pi], doc.score) as { w: string; i: number }[], [pi, doc]);
  const [bi, setBi, biRef] = useStateRef(0), [buf, setBuf, bufRef] = useStateRef(''), [res, setRes] = useState<{ r: Mark; typed: string }[]>([]);
  const [tot, setTot] = useState({ ok: 0, casi: 0, mal: 0 });
  const next = () => { setPi(firstWith(pi + 1)); setBi(0); setBuf(''); setRes([]); };
  const submit = () => {
    const typed = bufRef.current, k = biRef.current;
    if (!typed || k >= blanks.length) return;
    const w = blanks[k].w, r: Mark = typed.toLowerCase() === w.toLowerCase() ? 'ok' : norm(typed) === norm(w) ? 'casi' : 'mal';
    setRes(x => [...x, { r, typed }]); setTot(t => ({ ...t, [r]: t[r] + 1 })); hit(r !== 'mal', r === 'ok' ? 5 : r === 'casi' ? 2 : 0);
    setBi(k + 1); setBuf('');
  };
  const done = bi >= blanks.length;
  useKeys({
    char: c => { if (biRef.current >= blanks.length) return; if (c === ' ') submit(); else setBuf(b => b + c); },
    back: x => setBuf(b => (x ? '' : b.slice(0, -1))),
    enter: () => { if (biRef.current >= blanks.length) next(); else submit(); },
    tab: next,
  });
  const p = doc.paras[pi]; let last = 0;
  const parts: React.ReactNode[] = [];
  blanks.forEach((b, k) => {
    parts.push(p.slice(last, b.i)); last = b.i + b.w.length;
    const r = res[k];
    if (r) parts.push(<span key={k} className={'blank ' + r.r}>{r.r === 'mal' && <s>{r.typed}</s>}{r.r === 'ok' ? r.typed : b.w}</span>);
    else if (k === bi) parts.push(<span key={k} className="blank cur">{buf}<span className="cursor" /></span>);
    else parts.push(<span key={k} className="blank">{' '.repeat(Math.max(4, Math.round(b.w.length * 0.8)))}</span>);
  });
  parts.push(p.slice(last));
  return (
    <>
      <Head name={name} desc={desc} right={<span className="sub" style={{ fontSize: 13 }}>párrafo {pi + 1}/{n} · ✓ {tot.ok}  ~ {tot.casi}  × {tot.mal}</span>} />
      <div className="cloze">{parts}</div>
      <p className="hint" style={{ textAlign: 'left', marginTop: 14 }}>
        {done ? <><Kbd>enter</Kbd> siguiente párrafo</> : <><Kbd>espacio</Kbd> o <Kbd>enter</Kbd> confirmar · <Kbd>tab</Kbd> saltar párrafo · la tilde mal cuenta como &quot;casi&quot;</>}
      </p>
    </>
  );
}

/* ---------- flashcards ---------- */
interface Card { a: string; q: string; miss: number }
export function FlashMode({ doc, name, desc, hit, again }: ModeProps) {
  const [q, setQ] = useState<Card[]>(() => shuffle(doc.cards.map(c => ({ ...c, miss: 0 }))));
  const total = doc.cards.length;
  const [learned, setLearned] = useState(0), [tries, setTries] = useState(0), [first, setFirst] = useState(0);
  const [buf, setBuf, bufRef] = useStateRef(''), [fb, setFb, fbRef] = useStateRef<{ cls: string; text: string } | null>(null), [anim, setAnim] = useState('');
  const t0 = useRef(now());
  const card = q[0];
  const lastCard = useRef<Card | undefined>(card);
  const answer = (giveUp: boolean) => {
    const secs = ((now() - t0.current) / 1000).toFixed(1);
    const b = bufRef.current.trim(), ok = !giveUp && b.toLowerCase() === card.a.toLowerCase(), casi = !giveUp && !ok && norm(b) === norm(card.a);
    setTries(t => t + 1); hit(ok || casi, ok ? 5 : casi ? 2 : 0);
    const rest = q.slice(1), c = { ...card };
    if (ok || casi) { if (c.miss === 0) { setLearned(l => l + 1); setFirst(f => f + 1); } else { c.miss = 0; rest.push(c); } }
    else { c.miss++; rest.splice(Math.min(3, rest.length), 0, c); }
    setFb({ cls: ok ? 'ok' : casi ? 'casi' : 'bad', text: ok ? `✓ correcto en ${secs}s` : casi ? `~ casi: se escribe "${card.a}"` : `× era "${card.a}" — vuelve en un rato` });
    setQ(rest); // la tarjeta respondida sigue en pantalla (fb) hasta pasar a la siguiente
  };
  const next = () => {
    if (anim) return;
    setAnim('out');
    setTimeout(() => { setFb(null); setBuf(''); t0.current = now(); setAnim('in'); setTimeout(() => setAnim(''), 260); }, 220);
  };
  // mientras se muestra la respuesta, en pantalla sigue la tarjeta que se respondió
  if (!fb) lastCard.current = card;
  const shown = fb ? lastCard.current : card;
  useKeys({
    char: c => { if (!fbRef.current && card) setBuf(b => b + c); },
    back: x => { if (!fbRef.current) setBuf(b => (x ? '' : b.slice(0, -1))); },
    enter: () => { if (!card && !fbRef.current) return again(); if (fbRef.current) next(); else if (bufRef.current.trim()) answer(false); },
    tab: () => { if (!fbRef.current && card) answer(true); },
  });
  if (!total) return <><Head name={name} desc={desc} /><p className="sub">No pudimos armar tarjetas con este texto. Probá con apuntes que tengan definiciones del tipo &quot;Concepto: explicación&quot;.</p></>;
  return (
    <>
      <Head name={name} desc={desc} right={<span className="sub" style={{ fontSize: 13 }}>{learned}/{total} aprendidas</span>} />
      <div className="progress" style={{ marginBottom: 18 }}><i style={{ width: (learned / total * 100) + '%' }} /></div>
      <div className="fstack">
        <div className={'card' + (anim ? ' ' + anim : '')}>
          {!shown && !fb ? (
            <>
              <h3 style={{ fontFamily: 'var(--display)', color: 'var(--accent)', margin: 0 }}>* mazo completo</h3>
              <p className="sub">{total} tarjetas · {Math.round(first / Math.max(1, tries) * 100)}% de respuestas correctas</p>
              <div className="row"><button className="btn primary" type="button" onClick={again}>repasar de nuevo</button><span className="hint"><Kbd>enter</Kbd></span></div>
            </>
          ) : (
            <>
              <span className="lbl">definición</span>
              <div className="q">{shown?.q}</div>
              <span className="lbl">¿qué concepto es?</span>
              <div className="answer">{buf}{!fb && <span className="cursor" />}</div>
              {fb ? <p className={'fb ' + fb.cls}>{fb.text}<span className="hint">  · <Kbd>enter</Kbd> seguir</span></p>
                : <p className="hint" style={{ textAlign: 'left' }}><Kbd>enter</Kbd> responder · <Kbd>tab</Kbd> no sé</p>}
            </>
          )}
        </div>
      </div>
    </>
  );
}

/* ---------- resumen a ciegas ---------- */
export function ResumenMode({ doc, name, desc, hit }: ModeProps) {
  const n = doc.paras.length;
  const [pi, setPi] = useState(0), [phase, setPhase] = useState<'read' | 'write' | 'result'>('read');
  const [txt, setTxt] = useState(''), [scores, setScores] = useState<number[]>([]);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [result, setResult] = useState<{ pct: number; words: number; found: string[]; miss: string[] } | null>(null);
  const p = doc.paras[pi];
  useEffect(() => { if (phase === 'write') taRef.current?.focus(); }, [phase]);
  const nextP = () => { setPi((pi + 1) % n); setPhase('read'); setTxt(''); setResult(null); };
  const evaluate = () => {
    const kws = paraKeywords(p, doc.score) as string[], typed = tokens(txt).map((x: any) => norm(x.w));
    const has = (kw: string) => { const k = norm(kw), pre = k.slice(0, Math.min(k.length, 6)); return typed.some((t: string) => t === k || (k.length >= 6 && t.startsWith(pre))); };
    const found = kws.filter(has), miss = kws.filter(k => !has(k)), pct = kws.length ? found.length / kws.length * 100 : 0;
    setScores(s => [...s, pct]); hit(pct >= 50, Math.round(pct / 10));
    setResult({ pct, words: tokens(txt).length, found, miss }); setPhase('result');
  };
  // mientras se escribe en el textarea, el teclado no lo agarra el input oculto
  useKeys(phase === 'write' ? null : { enter: () => (phase === 'read' ? setPhase('write') : nextP()), tab: () => { if (phase === 'read') nextP(); } });
  const highlighted = useMemo(() => {
    if (!result) return null;
    const kws = paraKeywords(p, doc.score) as string[]; if (!kws.length) return p;
    const re = new RegExp(`\\b(${kws.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'giu');
    const out: React.ReactNode[] = []; let last = 0;
    for (const m of p.matchAll(re)) { out.push(p.slice(last, m.index)); out.push(<mark key={m.index}>{m[0]}</mark>); last = (m.index || 0) + m[0].length; }
    out.push(p.slice(last)); return out;
  }, [result, p, doc]);
  return (
    <>
      <Head name={name} desc={desc} right={<span className="sub" style={{ fontSize: 13 }}>párrafo {pi + 1}/{n}{scores.length ? ` · promedio ${Math.round(avg(scores))}%` : ''}</span>} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {phase === 'read' && <>
          <span className="lbl">leé con atención</span>
          <p className="para">{p}</p>
          <div className="row"><button className="btn primary" type="button" onClick={() => setPhase('write')}>ya lo leí, ocultar</button><span className="hint"><Kbd>enter</Kbd></span></div>
        </>}
        {phase === 'write' && <>
          <span className="lbl">reescribí el párrafo de memoria</span>
          <textarea ref={taRef} id="sum-text" rows={6} placeholder="Escribí lo que recuerdes, con tus palabras…" value={txt} onChange={e => setTxt(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); evaluate(); } }} />
          <div className="row"><button className="btn primary" type="button" onClick={evaluate}>evaluar</button><span className="hint"><Kbd>ctrl</Kbd>+<Kbd>enter</Kbd></span></div>
        </>}
        {phase === 'result' && result && <>
          <div className="bigs" style={{ flexDirection: 'row', gap: 28 }}>
            <div className="big"><span className="lbl">conceptos recordados</span><b>{Math.round(result.pct)}%</b></div>
            <div className="big b2"><span className="lbl">palabras escritas</span><b>{result.words}</b></div>
          </div>
          <div className="chips">{result.found.map(k => <span key={'f' + k} className="chip ok">✓ {k}</span>)}{result.miss.map(k => <span key={'m' + k} className="chip bad">× {k}</span>)}</div>
          <span className="lbl">el original</span>
          <p className="para">{highlighted}</p>
          <div className="row"><button className="btn primary" type="button" onClick={nextP}>siguiente párrafo</button><span className="hint"><Kbd>enter</Kbd></span></div>
        </>}
      </div>
    </>
  );
}

/* ---------- dictado ---------- */
export function DictadoMode({ doc, name, desc, hit }: ModeProps) {
  const list = useMemo(() => doc.sentences.filter(s => s.length >= 25 && s.length <= 180), [doc]);
  const has = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
  const [si, setSi] = useState(0), [buf, setBuf, bufRef] = useStateRef(''), [checked, setChecked, checkedRef] = useStateRef<{ ok: Set<number>; pct: number } | null>(null);
  const [peek, setPeek] = useState(false), slow = useRef(false);
  const speak = (s: boolean) => {
    if (!list.length) return;
    if (!has) { setPeek(true); setTimeout(() => setPeek(false), 2500); return; }
    slow.current = s; speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(list[si]), v = speechSynthesis.getVoices().find(x => /^es/i.test(x.lang));
    if (v) u.voice = v; u.lang = v ? v.lang : 'es-ES'; u.rate = s ? 0.7 : 0.95; speechSynthesis.speak(u);
  };
  useEffect(() => () => { if (has) speechSynthesis.cancel(); }, [has]);
  const check = () => {
    const a = list[si].split(/\s+/), b = bufRef.current.trim().split(/\s+/).filter(Boolean);
    const clean = (w: string) => norm(w).replace(/[^\p{L}\d]/gu, ''), A = a.map(clean), B = b.map(clean);
    // palabras en común (subsecuencia más larga) para no castigar una palabra de más o de menos
    const dp = Array.from({ length: A.length + 1 }, () => new Array(B.length + 1).fill(0));
    for (let i = A.length - 1; i >= 0; i--) for (let j = B.length - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    const ok = new Set<number>(); let i = 0, j = 0;
    while (i < A.length && j < B.length) { if (A[i] === B[j]) { ok.add(i); i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) i++; else j++; }
    const pct = ok.size / a.length * 100; hit(pct >= 80, Math.round(pct / 10)); setChecked({ ok, pct });
  };
  const next = () => { setSi((si + 1) % list.length); setBuf(''); setChecked(null); setTimeout(() => speak(false), 0); };
  useKeys(list.length ? {
    char: c => { if (!checkedRef.current) setBuf(b => b + c); },
    back: x => { if (!checkedRef.current) setBuf(b => (x ? b.replace(/\S+\s*$/, '') : b.slice(0, -1))); },
    enter: () => { if (checkedRef.current) next(); else if (bufRef.current.trim()) check(); },
    tab: () => speak(slow.current),
  } : {});
  if (!list.length) return <><Head name={name} desc={desc} /><p className="sub">No encontramos oraciones para dictar en este texto.</p></>;
  return (
    <>
      <Head name={name} desc={desc} right={<span className="sub" style={{ fontSize: 13 }}>oración {si + 1}/{list.length}</span>} />
      <div className="dict">
        <div className="row">
          <button className="btn primary" type="button" onClick={() => speak(false)}>▶ escuchar</button>
          <button className="btn" type="button" onClick={() => speak(true)}>más lento</button>
          <span className="hint"><Kbd>tab</Kbd> repetir · <Kbd>enter</Kbd> corregir</span>
        </div>
        {!has && <p className="sub" style={{ fontSize: 13 }}>Tu navegador no tiene voces para leer en voz alta: la oración se muestra 2,5 segundos y después la escribís de memoria.</p>}
        {peek && <p className="para">{list[si]}</p>}
        <div className="typed">{buf}{!checked && <span className="cursor" />}</div>
        {checked && (
          <div className="cmp">
            <span className="lbl" style={{ marginBottom: 6 }}>{Math.round(checked.pct)}% de palabras correctas</span>
            <div>{list[si].split(/\s+/).map((w, k) => <span key={k} className={checked.ok.has(k) ? 'ok' : 'miss'}>{w}</span>)}</div>
            <p className="hint" style={{ textAlign: 'left', marginTop: 10 }}><Kbd>enter</Kbd> siguiente oración</p>
          </div>
        )}
      </div>
    </>
  );
}
