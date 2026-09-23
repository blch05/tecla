import ViewRunner from '@/components/ViewRunner';

export const metadata = { title: 'test · tecla*' };

export default function TestPage() {
  return (
    <section className="view" id="v-test">
      <div className="cfgbar" id="test-cfg" />
      <div className="typing-wrap" id="test-play">
        <div className="live"><span id="test-count" /><span className="sm" id="test-wpm" /><span className="gh" id="test-ghost" /></div>
        <div id="test-box" />
        <p className="hint"><kbd>tab</kbd> texto nuevo &nbsp;·&nbsp; <kbd>esc</kbd> soltar el foco &nbsp;·&nbsp; <kbd>ctrl</kbd>+<kbd>⌫</kbd> borrar palabra</p>
      </div>
      <div className="results" id="test-res" hidden />
      <ViewRunner view="test" />
    </section>
  );
}
