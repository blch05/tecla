'use client';

/* Fondo "estado de flujo" del test: un shader WebGL con el color de acento que respira
   según tu velocidad. Calmo si vas tranquilo; más vivo, con líneas de velocidad, cuando
   pasás tu promedio; un destello cálido cuando le errás.
   - "tecla:flow" (detail: 0–1) fija la intensidad; "tecla:flow-err" dispara el destello.
   - WebGL puro, sin librerías. Con "reducir movimiento" no se dibuja. */
import { useEffect, useRef } from 'react';
import { cssColor } from '@/lib/theme';

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }`;
const FRAG = `
precision mediump float;
uniform vec2 res; uniform float t, flow, err;
uniform vec3 bg, acc, acc2, hot;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
  return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 5; i++){ v += a*n(p); p *= 2.02; a *= .5; } return v; }
void main(){
  vec2 uv = gl_FragCoord.xy / res; vec2 q = uv * vec2(res.x/res.y, 1.) * 1.6;
  float sp = .04 + flow * .35;
  float f = fbm(q + vec2(t*sp, t*sp*.4) + fbm(q*1.3 - t*.05));
  // manchas de color que se intensifican con el flujo
  float blob = smoothstep(.32, .78, f) * (.18 + flow * .66);
  vec3 col = mix(bg, mix(acc2, acc, smoothstep(.4, .9, f) * (.4 + flow * .6)), blob);
  // líneas de velocidad horizontales cuando vas rápido
  float lane = floor(uv.y * 38.);
  float streak = smoothstep(.93, 1., fract(uv.x * .5 - t * (.6 + h(vec2(lane)) * 1.6) + h(vec2(lane, 3.))));
  col = mix(col, acc, streak * smoothstep(.45, 1., flow) * .5 * step(.5, h(vec2(lane, 7.))));
  // el centro (donde está el texto) queda más calmo; los bordes se encienden
  float center = smoothstep(.62, .1, length((uv - vec2(.5, .55)) * vec2(1.1, 1.5)));
  col = mix(col, bg, center * .65);
  col = mix(col, hot, err * .22 * (1. - center * .6));
  gl_FragColor = vec4(col, 1.);
}`;

function hex(c: string): [number, number, number] {
  const m = c.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return [1, 1, 1];
  const n = parseInt(m[1], 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}

export default function FlowBackground() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const gl = cv.getContext('webgl', { antialias: false, premultipliedAlpha: false });
    if (!gl) return;
    const sh = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog); gl.useProgram(prog);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u = (n: string) => gl.getUniformLocation(prog, n);
    const U = { res: u('res'), t: u('t'), flow: u('flow'), err: u('err'), bg: u('bg'), acc: u('acc'), acc2: u('acc2'), hot: u('hot') };

    const colors = () => {
      gl.uniform3fv(U.bg, hex(cssColor('--bg', '#ffffff'))); gl.uniform3fv(U.acc, hex(cssColor('--accent', '#34A3F0')));
      gl.uniform3fv(U.acc2, hex(cssColor('--accent-2', '#92D2FF'))); gl.uniform3fv(U.hot, hex(cssColor('--err', '#F0607A')));
    };
    colors();
    const mo = new MutationObserver(colors);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-accent', 'style'] });

    // media resolución: es un fondo difuso, no hace falta más (y cuida la batería)
    const resize = () => { const s = 0.5; cv.width = Math.max(1, cv.clientWidth * s); cv.height = Math.max(1, cv.clientHeight * s); gl.viewport(0, 0, cv.width, cv.height); gl.uniform2f(U.res, cv.width, cv.height); };
    resize(); const ro = new ResizeObserver(resize); ro.observe(cv);

    let target = 0, flow = 0, err = 0, raf = 0, last = performance.now(), t = 0;
    const onFlow = (e: Event) => { target = Math.max(0, Math.min(1, Number((e as CustomEvent).detail) || 0)); };
    const onErr = () => { err = 1; };
    window.addEventListener('tecla:flow', onFlow); window.addEventListener('tecla:flow-err', onErr);
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      flow += (target - flow) * Math.min(1, dt * 1.6); err = Math.max(0, err - dt * 3);
      t += dt * (1 + flow * 2);
      gl.uniform1f(U.t, t); gl.uniform1f(U.flow, flow); gl.uniform1f(U.err, err);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); mo.disconnect();
      window.removeEventListener('tecla:flow', onFlow); window.removeEventListener('tecla:flow-err', onErr);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, []);

  return <canvas ref={ref} className="flow-bg" aria-hidden="true" />;
}
