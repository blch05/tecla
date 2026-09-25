/* Efectos del arcade de la tienda, con PixiJS (WebGL): una capa transparente sobre el canvas del juego
   que suma brillo a las explosiones. El juego sigue dibujándose igual; esto es solo decoración. */
import { Application, Container, Graphics, Sprite, type Texture } from 'pixi.js';

interface P { s: Sprite; vx: number; vy: number; life: number; decay: number; g: number; spin: number }
interface Ring { g: Graphics; x: number; y: number; r: number; max: number; life: number; color: string; w: number }

export class PixiFx {
  private app = new Application();
  private layer = new Container();
  private parts: P[] = [];
  private rings: Ring[] = [];
  private glow!: Texture;
  private square!: Texture;
  private dead = false;

  constructor(private kind: string) {}

  /** Crea la capa encima del canvas del juego; null si no hay WebGL o si se destruyó mientras cargaba. */
  static async attach(stage: HTMLElement, under: HTMLElement, kind: string) {
    const fx = new PixiFx(kind);
    try {
      await fx.app.init({ backgroundAlpha: 0, resizeTo: stage, antialias: true, autoDensity: true, resolution: Math.min(2, window.devicePixelRatio || 1), preference: 'webgl' });
    } catch { return null; }
    const cv = fx.app.canvas;
    cv.className = 'pixi-fx'; under.after(cv);
    fx.app.stage.addChild(fx.layer);
    // punto con brillo (círculos superpuestos) y cuadradito para los pixeles
    const g = new Graphics();
    for (let i = 6; i >= 1; i--) g.circle(0, 0, i * 2.4).fill({ color: 0xffffff, alpha: 0.1 + (6 - i) * 0.06 });
    fx.glow = fx.app.renderer.generateTexture(g);
    fx.square = fx.app.renderer.generateTexture(new Graphics().rect(0, 0, 6, 6).fill(0xffffff));
    g.destroy();
    fx.app.ticker.add(t => fx.step(t.deltaMS / 1000));
    return fx;
  }

  private spark(x: number, y: number, color: string, o: { v: number; size: number; life: number; g?: number; tex?: Texture; add?: boolean }) {
    const s = new Sprite(o.tex || this.glow), a = Math.random() * Math.PI * 2, v = o.v * (0.35 + Math.random() * 0.65);
    s.anchor.set(0.5); s.position.set(x, y); s.scale.set(o.size * (0.6 + Math.random() * 0.6));
    try { s.tint = color; } catch { s.tint = 0xffffff; }
    if (o.add !== false) s.blendMode = 'add';
    this.layer.addChild(s);
    this.parts.push({ s, vx: Math.cos(a) * v, vy: Math.sin(a) * v - v * 0.25, life: 1, decay: 1 / o.life, g: o.g ?? 0, spin: (Math.random() - 0.5) * 8 });
  }

  private ring(x: number, y: number, color: string, max: number, w = 3) {
    const g = new Graphics(); g.blendMode = 'add'; this.layer.addChild(g);
    this.rings.push({ g, x, y, r: 4, max, life: 1, color, w });
  }

  /** Una explosión donde se destruyó una palabra (n: tamaño, como en el juego). */
  burst(x: number, y: number, n: number, color: string) {
    if (this.dead || this.parts.length > 600) return;
    const big = n >= 14;
    if (this.kind === 'chispas') {
      for (let i = 0; i < n * 3; i++) this.spark(x, y, i % 3 ? color : '#FFF4C2', { v: 260, size: 0.45, life: 0.7, g: 420 });
    } else if (this.kind === 'neon') {
      this.ring(x, y, color, big ? 120 : 60); if (big) this.ring(x, y, '#ffffff', 80, 2);
      for (let i = 0; i < n * 2; i++) this.spark(x, y, color, { v: 150, size: 0.35, life: 0.5 });
    } else if (this.kind === 'pixeles') {
      for (let i = 0; i < n * 3; i++) this.spark(x, y, color, { v: 220, size: 1, life: 0.9, g: 600, tex: this.square, add: false });
    } else if (this.kind === 'supernova') {
      this.ring(x, y, '#ffffff', big ? 170 : 90, 4); this.ring(x, y, color, big ? 130 : 70, 6);
      for (let i = 0; i < n * 4; i++) this.spark(x, y, i % 4 ? color : '#ffffff', { v: 380, size: 0.55, life: 0.9, g: 120 });
      this.spark(x, y, '#ffffff', { v: 0, size: big ? 5 : 3, life: 0.25 }); // destello
    }
  }

  private step(dt: number) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= p.decay * dt; p.vy += p.g * dt; p.vx *= 0.985; p.vy *= 0.985;
      p.s.x += p.vx * dt; p.s.y += p.vy * dt; p.s.alpha = Math.max(0, p.life); p.s.rotation += p.spin * dt;
      if (p.life <= 0) { p.s.destroy(); this.parts.splice(i, 1); }
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt * 2.2; r.r += (r.max - r.r) * Math.min(1, dt * 9);
      r.g.clear().circle(r.x, r.y, r.r).stroke({ width: r.w * Math.max(0.2, r.life), color: r.color, alpha: Math.max(0, r.life) });
      if (r.life <= 0) { r.g.destroy(); this.rings.splice(i, 1); }
    }
  }

  destroy() {
    if (this.dead) return; this.dead = true;
    try { this.app.destroy(true, { children: true, texture: true }); } catch {}
  }
}
