/* Espadachín: un guerrero de tapado largo y katana en el centro; los monstruos llegan de los costados.
   - palabra correcta: corta al más cercano (si está lejos, le lanza un corte que vuela);
   - cada 5 palabras seguidas sin errores: corte en círculo que barre a todos los cercanos;
   - error: trastabilla y el monstruo más cercano le pega;
   - la racha sube un medidor de estilo: D, C, B, A, S.
   Variante "sombra": tapado oscuro, cortes violetas y ojos rojos. */
import { burst, mix, pixelText, pixelTextWidth, sprite, stepBits, type Bit } from '@/lib/scenes/pixel';
import type { Env, Scene } from '@/lib/scenes/types';

// tapado largo, pelo peinado hacia atrás; mira a la derecha. h pelo · s piel · e ojo · c tapado · d sombra del tapado · b pantalón/botas · g guante
const HERO = [
  '.....hhhh.....',
  '....hhhhhh....',
  '...hhhhhsss...',
  '...hh..ssse...',
  '.......sss....',
  '.....ddcc.....',
  '....dccccccg..',
  '...dcccdcccg..',
  '...dccbbccc...',
  '...dccbbccc...',
  '..dcccbbcccc..',
  '..dccc..cccc..',
  '.dccc...bcccd.',
  '.dcc....b..ccd',
  '.dc.....b...cd',
  '.......b.b....',
  '.......b.b....',
  '......bb.bb...',
];
// pose de ataque: brazo extendido hacia adelante
const HERO_ATK = [
  '.....hhhh.....',
  '....hhhhhh....',
  '...hhhhhsss...',
  '...hh..ssse...',
  '.......sss....',
  '.....ddcc.....',
  '....dcccccccgg',
  '...dcccdcc....',
  '...dccbbccc...',
  '...dccbbccc...',
  '..dcccbbcccc..',
  '.dccc...cccc..',
  'dccc....bcccd.',
  'dcc.....b..ccd',
  'dc......b...cd',
  '.......b.b....',
  '......b...b...',
  '.....bb...bb..',
];
const SLIME = [['..xxxx..', '.xxxxxx.', 'xxwxxwxx', 'xxkxxkxx', 'xxxxxxxx', '.xxxxxx.'], ['........', '..xxxx..', '.xxxxxx.', 'xxwxxwxx', 'xxkxxkxx', 'xxxxxxxx']];
const BAT = [['x.......x', 'xx.xxx.xx', '.xxwxwxx.', '..xxxxx..', '...x.x...'], ['.........', '...xxx...', '.xxwxwxx.', 'xxxxxxxxx', 'x..x.x..x']];

interface Mob { x: number; y: number; dir: 1 | -1; kind: 'slime' | 'bat'; hp: number; ph: number; hitT: number; atkT: number }
interface Wave { x: number; y: number; dir: 1 | -1; life: number }

const RANKS: [number, string][] = [[15, 'S'], [10, 'A'], [6, 'B'], [3, 'C'], [1, 'D']];

export function espadachin(variant: 'normal' | 'sombra' = 'normal'): Scene {
  const mobs: Mob[] = [], waves: Wave[] = [], bits: Bit[] = [];
  let spawnT = 1, combo = 0, slashT = 0, slashDir: 1 | -1 = 1, circleT = 0, hurtT = 0, face: 1 | -1 = 1, rankPop = 0, winT = 0;

  const colors = (env: Env) => {
    const p = env.pal, sombra = variant === 'sombra';
    return {
      h: sombra ? mix(p.ink, '#c9c9d6', 0.2) : (p.dark ? '#e8eef5' : '#dfe6ee'), s: '#f1c9a5', e: sombra ? '#ff3b4e' : p.ink,
      c: sombra ? mix('#2a2140', p.ink, 0.3) : p.acc, d: sombra ? '#17121f' : mix(p.acc, p.ink, 0.45),
      b: sombra ? '#0e0b14' : mix(p.ink, p.bg, 0.15), g: sombra ? '#5b4a7a' : mix(p.ink, p.bg, 0.3),
      slash: sombra ? '#a78bfa' : (p.dark ? '#e6f4ff' : mix(p.acc2, '#ffffff', 0.4)), blade: sombra ? '#c4b5fd' : '#f4f8fb',
    };
  };

  const ground = (env: Env) => env.H - 8;
  const heroX = (env: Env) => env.W / 2;
  const nearest = (env: Env) => mobs.reduce<Mob | null>((a, m) => (!a || Math.abs(m.x - heroX(env)) < Math.abs(a.x - heroX(env)) ? m : a), null);
  const kill = (m: Mob, env: Env, col: string) => {
    mobs.splice(mobs.indexOf(m), 1);
    burst(bits, m.x, m.y - 3, 10, col, 45, 70); burst(bits, m.x, m.y - 3, 5, env.pal.err, 30, 70);
  };
  const rank = () => RANKS.find(([n]) => combo >= n)?.[1] ?? '';

  return {
    on(e, env) {
      const hx = heroX(env);
      if (e.type === 'word' && e.ok) {
        combo++; rankPop = 0.25;
        const m = nearest(env);
        if (combo % 5 === 0) {
          // corte en círculo: barre todo lo que esté cerca y lanza ondas a los dos lados
          circleT = 0.45;
          for (const x of [...mobs]) if (Math.abs(x.x - hx) < 70) kill(x, env, colors(env).slash);
          waves.push({ x: hx, y: ground(env) - 10, dir: 1, life: 1.2 }, { x: hx, y: ground(env) - 10, dir: -1, life: 1.2 });
        } else if (m) {
          face = m.x >= hx ? 1 : -1; slashDir = face; slashT = 0.22;
          if (Math.abs(m.x - hx) < 26) kill(m, env, colors(env).slash);
          else waves.push({ x: hx + face * 8, y: ground(env) - 10, dir: face, life: 1.4 });
        } else { slashT = 0.22; slashDir = face; }
      } else if (e.type === 'word' && !e.ok) {
        combo = 0;
      } else if (e.type === 'key' && !e.ok) {
        combo = 0; hurtT = 0.35;
        const m = nearest(env);
        if (m && Math.abs(m.x - hx) < 34) { m.atkT = 0.3; burst(bits, hx, ground(env) - 10, 6, env.pal.err, 30, 60); }
      } else if (e.type === 'finish') {
        winT = 2.5; for (const m of [...mobs]) kill(m, env, colors(env).slash);
        if (e.record) combo = Math.max(combo, 15);
      } else if (e.type === 'start') { combo = 0; }
    },
    frame(ctx, env, dt) {
      const { W, H, pal, t, flow } = env, C = colors(env), gy = ground(env), hx = heroX(env);
      ctx.clearRect(0, 0, W, H);
      // luna detrás del guerrero y piso
      ctx.fillStyle = mix(pal.bg, variant === 'sombra' ? '#a78bfa' : pal.acc2, pal.dark ? 0.18 : 0.3);
      ctx.beginPath(); ctx.arc(hx + 20, gy - 36, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = mix(pal.bg, pal.ink, pal.dark ? 0.35 : 0.18); ctx.fillRect(0, gy, W, 1);
      ctx.fillStyle = mix(pal.bg, pal.ink, pal.dark ? 0.2 : 0.08); ctx.fillRect(0, gy + 1, W, H - gy);
      for (let i = 0; i < W; i += 7) if ((i * 13) % 5 === 0) { ctx.fillStyle = mix(pal.bg, pal.acc, 0.35); ctx.fillRect(i, gy - 1, 1, 1); }

      // aparecen monstruos (más seguido si vas rápido)
      spawnT -= dt;
      if (spawnT <= 0 && mobs.length < 7 && winT <= 0) {
        spawnT = 1.8 - flow * 1.1 + Math.random() * 0.6;
        const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1, kind = Math.random() < 0.35 ? 'bat' : 'slime';
        mobs.push({ x: dir === 1 ? -10 : W + 10, y: kind === 'bat' ? gy - 22 - Math.random() * 10 : gy, dir, kind, hp: 1, ph: Math.random() * 6, hitT: 0, atkT: 0 });
      }
      for (const m of mobs) {
        const dist = hx - m.x, speed = (m.kind === 'bat' ? 16 : 11) * (1 + flow * 0.6);
        if (Math.abs(dist) > 13) m.x += Math.sign(dist) * speed * dt;
        else { m.hitT += dt; if (m.hitT > 1.6) { m.hitT = 0; m.atkT = 0.3; hurtT = 0.3; m.x -= Math.sign(dist) * 14; } }
        m.atkT = Math.max(0, m.atkT - dt); m.ph += dt * (m.kind === 'bat' ? 10 : 5);
        const fr = Math.floor(m.ph) % 2, col = m.kind === 'bat' ? mix(pal.err, pal.ink, 0.45) : pal.err;
        const by = m.kind === 'bat' ? m.y + Math.sin(m.ph) * 2 : m.y;
        sprite(ctx, (m.kind === 'bat' ? BAT : SLIME)[fr], { x: m.atkT > 0 ? '#ffffff' : col, w: '#ffffff', k: pal.ink }, m.x + (m.atkT > 0 ? Math.sign(dist) * 2 : 0), by, m.dir === -1);
      }
      // ondas de corte que vuelan
      for (let i = waves.length - 1; i >= 0; i--) {
        const w = waves[i]; w.x += w.dir * 170 * dt; w.life -= dt;
        ctx.fillStyle = C.slash;
        for (let k = -6; k <= 6; k++) { const cx = w.x - w.dir * Math.round((k * k) / 8); ctx.fillRect(cx, w.y + k, 2, 1); }
        for (const m of [...mobs]) if (Math.abs(m.x - w.x) < 6) kill(m, env, C.slash);
        if (w.life <= 0 || w.x < -20 || w.x > W + 20) waves.splice(i, 1);
      }

      // el guerrero
      slashT = Math.max(0, slashT - dt); circleT = Math.max(0, circleT - dt); hurtT = Math.max(0, hurtT - dt); winT = Math.max(0, winT - dt);
      rankPop = Math.max(0, rankPop - dt);
      const breathe = Math.round(Math.sin(t * 2.4) * 0.5), shake = hurtT > 0 ? (Math.random() < 0.5 ? -1 : 1) : 0;
      const atk = slashT > 0 || circleT > 0;
      const heroCols = hurtT > 0 && Math.floor(hurtT * 20) % 2 ? Object.fromEntries(Object.keys(C).map(k => [k, pal.err])) : C;
      sprite(ctx, atk ? HERO_ATK : HERO, heroCols, hx + shake, gy + (atk ? 0 : breathe), (atk ? slashDir : face) === -1);
      // la katana: guardada en la cintura, o en arco mientras corta
      ctx.fillStyle = C.blade;
      if (circleT > 0) {
        const a0 = (1 - circleT / 0.45) * Math.PI * 2.4, r = 22;
        for (let k = 0; k < 40; k++) { const a = a0 - k * 0.11; ctx.globalAlpha = 1 - k / 40; ctx.fillStyle = C.slash; ctx.fillRect(Math.round(hx + Math.cos(a) * r), Math.round(gy - 10 + Math.sin(a) * r * 0.55), 2, 2); }
        ctx.globalAlpha = 1;
      } else if (slashT > 0) {
        const p = 1 - slashT / 0.22, a = (-1.9 + p * 2.6) * slashDir, cx = hx + slashDir * 5, cy = gy - 11;
        for (let k = 0; k < 18; k++) { const aa = a - slashDir * k * 0.07; ctx.globalAlpha = 1 - k / 18; ctx.fillStyle = C.slash; ctx.fillRect(Math.round(cx + Math.sin(aa) * 15 * slashDir), Math.round(cy - Math.cos(aa) * 15), 2, 1); }
        ctx.globalAlpha = 1; ctx.fillStyle = C.blade;
        for (let k = 3; k < 15; k++) ctx.fillRect(Math.round(cx + Math.sin(a) * k * slashDir), Math.round(cy - Math.cos(a) * k), 1, 1);
      } else {
        // vaina en diagonal detrás de la cadera
        ctx.fillStyle = C.b;
        for (let k = 0; k < 12; k++) ctx.fillRect(Math.round(hx - face * (2 + k * 0.85)), Math.round(gy - 9 + k * 0.45), 1, 1);
        ctx.fillStyle = C.g; ctx.fillRect(Math.round(hx - face * 1), gy - 10, 1, 1);
      }

      // medidor de estilo
      const r = rank();
      if (r) {
        const sc = rankPop > 0 ? 3 : 2, txt = r, w = pixelTextWidth(txt, sc);
        pixelText(ctx, txt, W - w - 8, 6, r === 'S' ? pal.warn : pal.acc, sc);
        pixelText(ctx, 'x' + combo, W - pixelTextWidth('x' + combo) - 8, 6 + sc * 5 + 3, pal.sub);
      }
      if (winT > 0 && Math.floor(winT * 4) % 2) pixelText(ctx, '!', hx - 1, gy - 26, pal.warn);
      stepBits(ctx, bits, dt);
    },
  };
}
