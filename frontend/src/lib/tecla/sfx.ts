/* sonidos sintetizados con Web Audio: arcade y teclado del test */
import { store } from '@/lib/tecla/utils';

/** perfiles de teclado del test (los paquetes de la tienda van por lib/shop/sounds) */
export type KeyProfile = string; // off, mecanico, suave, maquina

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };

class SfxEngine {
  /** interruptor de sonido del arcade */
  on = store.get('sfx', true);
  ctx: AudioContext | null = null;

  /** Hay que llamarlo desde un gesto del usuario: los navegadores bloquean el audio hasta entonces. */
  init() {
    if (!this.ctx) {
      try { const Ctx = window.AudioContext || (window as WebkitWindow).webkitAudioContext; this.ctx = Ctx ? new Ctx() : null; } catch { this.ctx = null; }
    }
    if (this.ctx?.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  tone(f: number, d = 0.08, type: OscillatorType = 'sine', vol = 0.06, slide = 0, force = false) {
    if ((!this.on && !force) || !this.ctx) return;
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, f + slide), t + d);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(this.ctx.destination); o.start(t); o.stop(t + d + 0.03);
  }

  noise(d = 0.25, vol = 0.1) {
    if (!this.on || !this.ctx) return;
    const c = this.ctx, b = c.createBuffer(1, Math.floor(c.sampleRate * d), c.sampleRate), data = b.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = b; f.type = 'lowpass'; f.frequency.value = 900; g.gain.value = vol;
    s.connect(f).connect(g).connect(c.destination); s.start();
  }

  seq(fs: number[], gap = 70, type: OscillatorType = 'triangle', vol = 0.055, d = 0.13) {
    fs.forEach((f, i) => setTimeout(() => this.tone(f, d, type, vol), i * gap));
  }

  /* ---------- arcade ---------- */
  key() { this.tone(1500 + Math.random() * 400, 0.025, 'square', 0.012); }
  /** acierto: sube un semitono por cada paso del combo */
  kill(combo: number) { const f = 392 * Math.pow(2, Math.min(combo, 24) / 12); this.tone(f, 0.12, 'triangle', 0.07); this.tone(f * 1.5, 0.09, 'sine', 0.035); }
  miss() { this.tone(170, 0.12, 'sawtooth', 0.035, -70); }
  hurt() { this.noise(0.32, 0.14); this.tone(120, 0.25, 'square', 0.045, -60); }
  power() { this.seq([660, 880, 1320]); }
  fever() { this.seq([523, 659, 784, 1046], 55); }
  mission() { this.seq([784, 988, 1175, 1568], 80, 'sine', 0.06, 0.18); }
  over() { this.seq([392, 330, 262], 170, 'triangle', 0.06, 0.28); }

  /* ---------- sonidos de teclado para el test ---------- */
  // el sonido del test es independiente del interruptor del arcade (por eso `force`)
  typeKey(profile: KeyProfile, space = false) {
    if (!this.ctx || profile === 'off') return;
    const c = this.ctx, t = c.currentTime;
    if (profile === 'suave') { this.tone(space ? 520 : 780 + Math.random() * 120, 0.03, 'sine', 0.035, 0, true); return; }
    // clic: ráfaga corta de ruido filtrado + golpe grave
    const maquina = profile === 'maquina';
    const len = Math.floor(c.sampleRate * (maquina ? 0.05 : 0.035)), b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = b; f.type = maquina ? 'highpass' : 'bandpass';
    f.frequency.value = maquina ? 2400 : (space ? 900 : 1700 + Math.random() * 500); f.Q.value = 1.2;
    g.gain.value = maquina ? 0.22 : 0.16;
    src.connect(f).connect(g).connect(c.destination); src.start(t);
    this.tone(space ? 90 : 140 + Math.random() * 30, 0.05, 'sine', maquina ? 0.05 : 0.08, -40, true);
  }
  typeErr(profile: KeyProfile) { if (profile !== 'off') this.tone(210, 0.07, 'triangle', 0.03, -60, true); }
}

export const Sfx = new SfxEngine();
