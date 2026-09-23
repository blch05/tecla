/* =========================================================
   entrada de teclado: un input oculto recibe todo y lo reparte
   al "consumidor" activo (el test, un juego, un modo de estudio…)
   ========================================================= */
export interface Consumer {
  char?: (c: string) => void;
  back?: (ctrl: boolean) => void;
  enter?: () => void;
  tab?: () => void;
  esc?: () => void;
}

let kb: HTMLInputElement | null = null;
let consumer: Consumer | null = null;
let composedSkip: string | null = null;

export function getConsumer() { return consumer; }
export function setConsumer(c: Consumer | null) { consumer = c; if (c) focusKb(); }
export function focusKb() { if (kb && consumer && document.activeElement !== kb) kb.focus({ preventScroll: true }); }
export function blurKb() { kb?.blur(); }

function feed(str: string) { if (!consumer || !consumer.char) return; for (const ch of str) consumer.char(ch); }

/** Se llama una sola vez, cuando el layout monta el input oculto. */
export function initInput(el: HTMLInputElement) {
  if (kb === el) return;
  kb = el;
  el.addEventListener('input', (e: Event) => {
    const ev = e as InputEvent;
    if (ev.isComposing) return;
    const d = ev.data; el.value = '';
    if (d == null) return;
    if (composedSkip !== null && d === composedSkip) { composedSkip = null; return; }
    feed(d);
  });
  el.addEventListener('compositionend', (e: CompositionEvent) => {
    el.value = '';
    if (e.data) { composedSkip = e.data; setTimeout(() => (composedSkip = null), 60); feed(e.data); }
  });
  el.addEventListener('paste', e => e.preventDefault());
  el.addEventListener('keydown', (e: KeyboardEvent) => {
    if (!consumer) return;
    if (e.key === 'Backspace') { e.preventDefault(); consumer.back?.(e.ctrlKey || e.altKey || e.metaKey); }
    else if (e.key === 'Enter') { e.preventDefault(); consumer.enter?.(); }
    else if (e.key === 'Tab') { e.preventDefault(); consumer.tab?.(); }
    else if (e.key === 'Escape') { el.blur(); consumer.esc?.(); }
  });
  // si el foco está en otro lado (un botón, el fondo), igual redirigimos las teclas
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (!consumer || e.target === el) return;
    const t = e.target as HTMLElement | null;
    if (t && t.matches && t.matches('input,textarea,select,[contenteditable]')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const isBtn = !!(t && t.matches && t.matches('button,a,label'));
    if (e.key.length === 1 || e.key === 'Backspace' || (!isBtn && (e.key === 'Enter' || e.key === 'Tab'))) {
      e.preventDefault(); el.focus({ preventScroll: true });
      if (e.key.length === 1) consumer.char?.(e.key);
      else if (e.key === 'Backspace') consumer.back?.(false);
      else if (e.key === 'Enter') consumer.enter?.();
      else consumer.tab?.();
    }
  });
}
