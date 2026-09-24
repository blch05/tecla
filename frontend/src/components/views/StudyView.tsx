'use client';

/* Estudiar: tu material (texto o PDF) y cinco modos para repasarlo.
   Cada modo es un componente (study/modes.tsx); acá se maneja el documento y la sesión
   (los aciertos se guardan en el historial al cambiar de modo, de documento o al salir). */
import { useCallback, useEffect, useRef, useState } from 'react';
import Tabs from '@/components/ui/Tabs';
import { CopyMode, DictadoMode, FlashMode, HuecosMode, ResumenMode, type ModeProps } from './study/modes';
import { pdfText, processDoc, type StudyDoc } from '@/lib/study/doc';
import { SAMPLE_DOC } from '@/lib/tecla/data/words';
import { store, toast } from '@/lib/tecla/utils';

const MODES: { id: string; name: string; desc: string; unit: string; C: (p: ModeProps) => React.ReactNode }[] = [
  { id: 'copy', name: 'tipear el texto', desc: 'Practicá tipeo con tu propio material, párrafo por párrafo.', unit: 'párrafos', C: CopyMode },
  { id: 'huecos', name: 'completar huecos', desc: 'Los conceptos clave aparecen tapados: escribilos de memoria.', unit: 'huecos', C: HuecosMode },
  { id: 'flash', name: 'flashcards', desc: 'Leé la definición y tipeá el concepto. Las que fallás vuelven más tarde.', unit: 'tarjetas', C: FlashMode },
  { id: 'resumen', name: 'resumen a ciegas', desc: 'Leé un párrafo, se oculta y lo reescribís con tus palabras. Se puntúa cuántos conceptos clave recordaste.', unit: 'resúmenes', C: ResumenMode },
  { id: 'dictado', name: 'dictado', desc: 'Escuchá una oración y escribila sin verla.', unit: 'oraciones', C: DictadoMode },
];

export default function StudyView() {
  const [doc, setDocState] = useState<{ d: StudyDoc; sample: boolean } | null>(null);
  const [mode, setMode] = useState('huecos');
  const [pasting, setPasting] = useState(false);
  const [paste, setPaste] = useState('');
  const [round, setRound] = useState(0); // para reiniciar un modo (ej. "repasar de nuevo")
  const sess = useRef<{ mode: string; ok: number; n: number; pts: number } | null>(null);
  const docRef = useRef<StudyDoc | null>(null);

  /* sesión: se guarda en el historial al cambiar de modo, de documento o al salir */
  const flush = useCallback(() => {
    const x = sess.current; sess.current = null; if (!x || !x.n) return;
    const m = MODES.find(mm => mm.id === x.mode)!;
    import('@/lib/tecla/history').then(({ History }) => History.record({ t: 'study', mode: m.name, detail: `${x.ok}/${x.n} ${m.unit} bien · ${docRef.current?.title || ''}`, pts: x.pts }));
  }, []);
  const hit = useCallback((ok: boolean, pts: number) => {
    const s = (sess.current ||= { mode, ok: 0, n: 0, pts: 0 }); s.n++; if (ok) s.ok++; s.pts += pts;
  }, [mode]);

  const setDoc = useCallback((text: string, title: string | null, save: boolean) => {
    const d = processDoc(text, title) as StudyDoc;
    if (!d.paras.length) { toast('No encontramos párrafos útiles en ese texto.'); return false; }
    flush(); docRef.current = d;
    if (save) store.set('doc', { text: text.slice(0, 250000), title: d.title });
    setDocState({ d, sample: text === SAMPLE_DOC }); setRound(r => r + 1);
    return true;
  }, [flush]);

  useEffect(() => {
    const saved = store.get('doc', null) as { text: string; title: string } | null;
    setDoc(saved ? saved.text : SAMPLE_DOC, saved ? saved.title : null, false);
    setMode(store.get('studyMode', 'huecos'));
    const onHide = () => flush();
    window.addEventListener('pagehide', onHide);
    return () => { window.removeEventListener('pagehide', onHide); flush(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (id: string) => { flush(); setMode(id); store.set('studyMode', id); setRound(r => r + 1); };
  const usePaste = () => {
    const v = paste.trim();
    if (v.length < 80) { toast('Pegá un texto un poco más largo (al menos un par de párrafos).'); return; }
    if (setDoc(v, null, true)) { setPasting(false); setPaste(''); }
  };
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
    try {
      toast('Leyendo ' + f.name + '…', 6000);
      const txt = /\.pdf$/i.test(f.name) || f.type === 'application/pdf' ? await pdfText(f) : await f.text();
      if (txt.replace(/\s/g, '').length < 80) { toast('No encontramos texto en ese archivo. Si es un PDF escaneado, probá pegando el texto.', 4000); return; }
      if (setDoc(txt, f.name.replace(/\.[^.]+$/, ''), true)) toast('Listo: ' + f.name);
    } catch (err: any) { toast('No se pudo leer el archivo: ' + (err?.message || 'formato no compatible'), 4000); }
  };

  const d = doc?.d, M = MODES.find(m => m.id === mode) || MODES[1];
  return (
    <>
      <div className="panel src">
        <span className="corner" aria-hidden="true">* — |</span>
        <div className="src-head">
          <div>
            <div className="eyebrow">tu material</div>
            <h2>{d?.title}</h2>
            <p className="sub">{d && `${d.words} palabras · ${d.paras.length} párrafos · ${d.cards.length} tarjetas · ${d.sentences.length} oraciones${doc?.sample ? ' · texto de ejemplo' : ''}`}</p>
          </div>
          <div className="chips kw" title="conceptos detectados">{d?.kws.slice(0, 10).map(k => <span key={k} className="chip">{k}</span>)}</div>
          <div className="row">
            <label className="btn primary" htmlFor="doc-file">subir PDF o TXT</label>
            <input type="file" id="doc-file" accept=".pdf,.txt,.md,text/plain,application/pdf" hidden onChange={onFile} />
            <button className="btn" type="button" onClick={() => { setPasting(true); setPaste(''); }}>pegar texto</button>
          </div>
        </div>
        {pasting && (
          <div id="doc-paste">
            <textarea rows={6} autoFocus placeholder="Pegá acá tus apuntes, un artículo o un capítulo…" value={paste} onChange={e => setPaste(e.target.value)} />
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn primary" type="button" onClick={usePaste}>usar este texto</button>
              <button className="btn ghost" type="button" onClick={() => setPasting(false)}>cancelar</button>
            </div>
          </div>
        )}
      </div>
      {!pasting && d && (
        <>
          <div className="subtabs"><Tabs items={MODES.map(m => ({ id: m.id, label: m.name }))} value={mode} onChange={pick} label="modos de estudio" /></div>
          <div className="panel" id="study-area">
            <M.C key={mode + ':' + round} doc={d} name={M.name} desc={M.desc} hit={hit} again={() => { flush(); setRound(r => r + 1); }} />
          </div>
        </>
      )}
    </>
  );
}
