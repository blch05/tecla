import ViewRunner from '@/components/ViewRunner';

export const metadata = { title: 'estudiar · tecla*' };

export default function EstudiarPage() {
  return (
    <section className="view" id="v-study">
      <div className="panel src">
        <span className="corner" aria-hidden="true">* — |</span>
        <div className="src-head">
          <div>
            <div className="eyebrow">tu material</div>
            <h2 id="doc-title" />
            <p className="sub" id="doc-meta" />
          </div>
          <div className="chips kw" id="doc-kw" title="conceptos detectados" />
          <div className="row">
            <label className="btn primary" htmlFor="doc-file">subir PDF o TXT</label>
            <input type="file" id="doc-file" accept=".pdf,.txt,.md,text/plain,application/pdf" hidden />
            <button className="btn" id="doc-edit" type="button">pegar texto</button>
          </div>
        </div>
        <div id="doc-paste" hidden>
          <textarea id="doc-text" rows={6} placeholder="Pegá acá tus apuntes, un artículo o un capítulo…" />
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn primary" id="doc-use" type="button">usar este texto</button>
            <button className="btn ghost" id="doc-cancel" type="button">cancelar</button>
          </div>
        </div>
      </div>
      <div className="subtabs" id="study-tabs" />
      <div className="panel" id="study-area" />
      <ViewRunner view="study" />
    </section>
  );
}
