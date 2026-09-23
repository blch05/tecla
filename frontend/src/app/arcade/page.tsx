import ViewRunner from '@/components/ViewRunner';
import ArcadeStage from '@/components/ArcadeStage';

export const metadata = { title: 'arcade · tecla*' };

export default function ArcadePage() {
  return (
    <section className="view" id="v-arcade">
      <div className="arc-top">
        <div className="subtabs" id="arc-tabs" />
        <div className="diffbar"><div className="cfgbar" id="arc-diff" /><span className="hint" id="arc-diff-desc" /></div>
      </div>
      <div className="hud">
        <span>puntos <b id="arc-score">0</b></span>
        <span><span id="arc-lvl-l">nivel</span> <b id="arc-level">1</b></span>
        <span>vidas <b id="arc-lives" className="lives" /></span>
        <span>combo <b id="arc-combo">x0</b></span>
        <span>ppm <b id="arc-wpm">0</b></span>
        <span>precisión <b id="arc-acc">100%</b></span>
        <span>récord <b id="arc-best">0</b></span>
        <button className="opt" id="arc-sfx" type="button" />
      </div>
      <ArcadeStage />
      <ViewRunner view="arcade" />
    </section>
  );
}
