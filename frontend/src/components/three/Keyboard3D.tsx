'use client';

/* Teclado en 3D (three.js + React Three Fiber), estilo cartoon: sombreado plano de dos tonos
   (toon), contorno marcado en cada tecla y una sombra plana debajo. Distribución en español.
   Dos usos:
   - portada: las teclas se hunden con lo que tipeás (evento "tecla:press") y festejan en ola;
   - progreso: mapa de calor, cada tecla sube según `heat` (0–1) y se puede girar arrastrando.
   Los colores salen del tema (variables CSS) y se actualizan si cambia el acento o el modo.
   Se carga aparte (next/dynamic) para no sumar three.js al resto de la app. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { cssColor } from '@/lib/theme';

const U = 1, GAP = 0.14, CAP_H = 0.42, PRESS = 0.2, OUTLINE = 0.055;

/* fila por fila: [leyenda, ancho en unidades, letra que la activa] (sin letra = modificador) */
type K = [label: string, w?: number, ch?: string];
const ROWS: K[][] = [
  [['º'], ['1'], ['2'], ['3'], ['4'], ['5'], ['6'], ['7'], ['8'], ['9'], ['0'], ["'"], ['¡'], ['⌫', 2]],
  [['⇥', 1.5], ...[...'qwertyuiop'].map((c): K => [c]), ['`'], ['+'], ['ç', 1.5]],
  [['⇪', 1.75], ...[...'asdfghjklñ'].map((c): K => [c]), ['´'], ['↵', 2.25]],
  [['⇧', 2.25], ...[...'zxcvbnm'].map((c): K => [c]), [','], ['.'], ['-'], ['⇧', 2.75]],
  [['ctrl', 1.5], ['⌘', 1.25], ['alt', 1.25], ['', 6.5, ' '], ['alt', 1.25], ['fn', 1.25], ['ctrl', 2]],
];
const MODS = new Set(['⌫', '⇥', '⇪', '↵', '⇧', 'ctrl', '⌘', 'alt', 'fn']);

export interface Keyboard3DProps {
  /** 0–1 por tecla (letra en minúscula): altura y color del mapa de calor */
  heat?: Record<string, number> | null;
  /** girar arrastrando con el mouse (mapa de calor) */
  draggable?: boolean;
  /** texto que aparece al pasar por una tecla en el mapa de calor */
  tooltip?: (k: string) => string;
  className?: string;
}

interface Theme { white: string; ink: string; acc: string; acc2: string; hot: string; shade: string }
const readTheme = (): Theme => {
  const dark = document.documentElement.dataset.theme === 'dark';
  return {
    white: dark ? cssColor('--surface', '#131C26') : '#ffffff',
    ink: cssColor('--ink', '#1D2B38'),
    acc: cssColor('--accent', '#34A3F0'), acc2: cssColor('--accent-2', '#92D2FF'), hot: cssColor('--err', '#F0607A'),
    // las caras en sombra toman un tinte del acento (no gris): queda más limpio y "dibujado"
    shade: cssColor('--accent-2', '#92D2FF'),
  };
};

function useTheme() {
  const [t, setT] = useState<Theme | null>(null);
  useEffect(() => {
    const read = () => setT(readTheme());
    read();
    window.addEventListener('tecla:theme', read);
    // el modo claro/oscuro y el acento cambian atributos del <html>
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-accent', 'style'] });
    return () => { window.removeEventListener('tecla:theme', read); mo.disconnect(); };
  }, []);
  return t;
}

/** Textura con la leyenda de una tecla. */
function legend(label: string, color: string, w: number) {
  const c = document.createElement('canvas'); c.width = 128 * Math.ceil(w); c.height = 128;
  const x = c.getContext('2d')!;
  const small = label.length > 1 || MODS.has(label);
  x.fillStyle = color; x.font = `${small ? 600 : 700} ${small ? 40 : 64}px "IBM Plex Mono", ui-monospace, monospace`;
  // los modificadores van abajo a la izquierda, como en un teclado real
  if (small) { x.textAlign = 'left'; x.textBaseline = 'alphabetic'; x.fillText(label, 24, 104); }
  else { x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(label, c.width / 2, 70); }
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Rampa de dos tonos para el sombreado toon (sin degradé). three la lee en 0.5 + 0.5·(N·L):
    con cuatro valores, las caras que miran poco a la luz (los costados) quedan en el tono de sombra. */
function toonRamp() {
  const lo = 70, hi = 255;
  const t = new THREE.DataTexture(new Uint8Array([lo, lo, lo, 255, lo, lo, lo, 255, lo, lo, lo, 255, hi, hi, hi, 255]), 4, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true;
  return t;
}

interface KeyDef { id: string; label: string; ch: string | null; x: number; z: number; w: number }
function layout(): KeyDef[] {
  const keys: KeyDef[] = [];
  ROWS.forEach((row, r) => {
    let x = 0;
    row.forEach(([label, w = 1, ch], i) => {
      const width = w * U + (w - 1) * GAP;
      keys.push({ id: `${r}-${i}`, label, ch: ch ?? (MODS.has(label) ? null : label), x: x + width / 2, z: r * (U + GAP), w: width });
      x += w * (U + GAP);
    });
  });
  const maxX = Math.max(...keys.map(k => k.x + k.w / 2)), maxZ = Math.max(...keys.map(k => k.z));
  return keys.map(k => ({ ...k, x: k.x - maxX / 2, z: k.z - maxZ / 2 }));
}

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
/** la tecla física de un carácter: "Á" → "a" */
const keyOf = (c: string) => (c === ' ' ? ' ' : c.toLowerCase().normalize('NFD')[0]);

function Keys({ theme, heat, draggable, onHover }: { theme: Theme; heat?: Record<string, number> | null; draggable?: boolean; onHover: (k: string | null) => void }) {
  const keys = useMemo(layout, []);
  const group = useRef<THREE.Group>(null);
  const meshes = useRef<(THREE.Group | null)[]>([]);
  const press = useRef(new Map<string, number>());   // carácter → momento en que se apretó
  const wave = useRef(-1);                              // momento de la ola de festejo
  const drag = useRef({ on: false, x: 0, rot: 0, vel: 0 });
  const still = useMemo(reduced, []);
  const { gl } = useThree();
  const ramp = useMemo(toonRamp, []);

  const geos = useMemo(() => {
    const m = new Map<number, THREE.BufferGeometry>();
    for (const k of keys) if (!m.has(k.w)) m.set(k.w, new RoundedBoxGeometry(k.w, CAP_H, U, 3, 0.12));
    return m;
  }, [keys]);
  const base = useMemo(() => {
    const xs = keys.flatMap(k => [k.x - k.w / 2, k.x + k.w / 2]), zs = keys.map(k => k.z);
    const w = Math.max(...xs) - Math.min(...xs) + 0.8, d = Math.max(...zs) - Math.min(...zs) + U + 0.8;
    return { geo: new RoundedBoxGeometry(w, 0.34, d, 3, 0.26), w, d };
  }, [keys]);
  const textures = useMemo(() => new Map(keys.filter(k => k.label).map(k => [k.id, legend(k.label, theme.ink, k.w)])), [keys, theme.ink]);
  useEffect(() => () => textures.forEach(t => t.dispose()), [textures]);

  // la portada avisa cada tecla con "tecla:press"; "tecla:wave" dispara la ola
  useEffect(() => {
    const onPress = (e: Event) => { press.current.set(keyOf(String((e as CustomEvent).detail || '')), performance.now()); };
    const onWave = () => { wave.current = performance.now(); };
    window.addEventListener('tecla:press', onPress); window.addEventListener('tecla:wave', onWave);
    return () => { window.removeEventListener('tecla:press', onPress); window.removeEventListener('tecla:wave', onWave); };
  }, []);

  // arrastrar para girar (mapa de calor)
  useEffect(() => {
    if (!draggable) return;
    const el = gl.domElement, d = drag.current;
    const down = (e: PointerEvent) => { d.on = true; d.x = e.clientX; el.setPointerCapture(e.pointerId); };
    const move = (e: PointerEvent) => { if (!d.on) return; const dx = (e.clientX - d.x) / 160; d.x = e.clientX; d.rot += dx; d.vel = dx; };
    const up = () => { d.on = false; };
    el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.style.cursor = 'grab';
    return () => { el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); };
  }, [draggable, gl]);

  const colors = useMemo(() => ({ white: new THREE.Color(theme.white), acc: new THREE.Color(theme.acc), hot: new THREE.Color(theme.hot) }), [theme]);
  const tmp = useMemo(() => new THREE.Color(), []);

  useFrame((state, dt) => {
    const now = performance.now(), t = state.clock.elapsedTime;
    const g = group.current; if (!g) return;
    // vaivén suave + seguir al mouse (o el giro arrastrado)
    const d = drag.current;
    if (draggable) { if (!d.on) { d.rot += d.vel; d.vel *= 0.92; } g.rotation.y = d.rot; }
    else if (!still) {
      g.rotation.y += ((state.pointer.x * 0.16) - g.rotation.y) * Math.min(1, dt * 3);
      g.rotation.x += ((-state.pointer.y * 0.07) - g.rotation.x) * Math.min(1, dt * 3);
      g.position.y = Math.sin(t * 0.8) * 0.06;
    }
    keys.forEach((k, i) => {
      const m = meshes.current[i]; if (!m) return;
      const h = heat && k.ch ? heat[k.ch] ?? 0 : 0;
      const scaleY = heat ? (k.ch && /\p{L}/u.test(k.ch) ? 0.35 + h * 3.2 : 0.35) : 1;
      // tecla apretada: baja y vuelve en ~260 ms
      const p = k.ch ? press.current.get(k.ch) : undefined, pt = p ? (now - p) / 260 : 1;
      let dy = pt < 1 ? -PRESS * Math.sin(Math.PI * Math.min(1, pt)) : 0;
      // ola: recorre el teclado de izquierda a derecha
      if (wave.current > 0 && !still) { const w = (now - wave.current) / 1000 - (k.x + 9) * 0.04; if (w > 0 && w < 0.5) dy += Math.sin(w / 0.5 * Math.PI) * 0.45; }
      m.position.y += ((CAP_H * scaleY) / 2 + dy - m.position.y) * Math.min(1, dt * 18);
      m.scale.y += (scaleY - m.scale.y) * Math.min(1, dt * 6);
      const mat = (m.children[1] as THREE.Mesh).material as THREE.MeshToonMaterial;
      if (heat) tmp.copy(colors.white).lerp(h > 0.55 ? colors.hot : colors.acc, Math.min(1, h * 1.4));
      else tmp.copy(colors.white).lerp(colors.acc, pt < 1 ? 1 - pt : 0);
      mat.color.lerp(tmp, Math.min(1, dt * 14));
    });
    if (wave.current > 0 && now - wave.current > 2600) wave.current = -1;
  });

  return (
    <group ref={group}>
      {keys.map((k, i) => (
        <group key={k.id} ref={el => { meshes.current[i] = el; }} position={[k.x, CAP_H / 2, k.z]}
          onPointerOver={heat && k.ch ? e => { e.stopPropagation(); onHover(k.ch); } : undefined}
          onPointerOut={heat ? () => onHover(null) : undefined}>
          {/* contorno: la misma forma un poco más grande, vista de atrás y en tinta */}
          <mesh geometry={geos.get(k.w)} scale={[1 + OUTLINE * 2 / k.w, 1 + OUTLINE * 2 / CAP_H, 1 + OUTLINE * 2 / U]}>
            <meshBasicMaterial color={theme.ink} side={THREE.BackSide} />
          </mesh>
          <mesh geometry={geos.get(k.w)}>
            <meshToonMaterial color={theme.white} gradientMap={ramp} />
          </mesh>
          {k.label && (
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, CAP_H / 2 + 0.003, 0]}>
              <planeGeometry args={[Math.ceil(k.w / U) * 0.66, 0.66]} />
              <meshBasicMaterial map={textures.get(k.id)} transparent depthWrite={false} />
            </mesh>
          )}
        </group>
      ))}
      {/* base, con su contorno */}
      <mesh geometry={base.geo} position={[0, -0.18, 0]} scale={[1 + OUTLINE * 2 / base.w, 1 + OUTLINE * 2 / 0.34, 1 + OUTLINE * 2 / base.d]}>
        <meshBasicMaterial color={theme.ink} side={THREE.BackSide} />
      </mesh>
      <mesh geometry={base.geo} position={[0, -0.18, 0]}>
        <meshToonMaterial color={theme.white} gradientMap={ramp} />
      </mesh>
      {/* sombra plana de dibujo animado, corrida hacia abajo a la derecha */}
      <mesh position={[0.35, -0.42, 0.45]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[base.w, base.d]} />
        <meshBasicMaterial color={theme.acc} transparent opacity={0.16} />
      </mesh>
    </group>
  );
}

export default function Keyboard3D({ heat, draggable, tooltip, className }: Keyboard3DProps) {
  const theme = useTheme();
  const [hover, setHover] = useState<string | null>(null);
  if (!theme) return <div className={className} />;
  return (
    <div className={className} style={{ position: 'relative' }}>
      {/* flat: sin mapeo de tonos, así el blanco queda blanco (estilo dibujo, no fotográfico) */}
      <Canvas
        flat
        dpr={[1, 2]}
        camera={{ position: heat ? [0, 12, 11] : [0, 8.2, 10.4], fov: heat ? 40 : 30 }}
        gl={{ antialias: true, alpha: true }}
        onCreated={({ camera }) => camera.lookAt(0, 0, 0.3)}
        aria-hidden="true"
      >
        {/* luz ambiente teñida del acento: las caras en sombra quedan celestes, no grises */}
        <ambientLight intensity={1.25} color={theme.shade} />
        <directionalLight position={[2.5, 10, 3]} intensity={3.1} />
        <Keys theme={theme} heat={heat} draggable={draggable} onHover={setHover} />
      </Canvas>
      {tooltip && hover && <div className="kb3d-tip">{tooltip(hover)}</div>}
    </div>
  );
}
