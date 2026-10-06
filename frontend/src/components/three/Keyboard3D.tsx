'use client';

/* Teclado en 3D (three.js + React Three Fiber). Dos usos:
   - portada: las teclas se hunden con lo que tipeás (evento "tecla:press") y festejan en ola;
   - progreso: mapa de calor, cada tecla sube según `heat` (0–1) y se puede girar arrastrando.
   Los colores salen del tema (variables CSS) y se actualizan si cambia el acento o el modo.
   Se carga aparte (next/dynamic) para no sumar three.js al resto de la app. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { cssColor } from '@/lib/theme';

export const KB_ROWS = ['qwertyuiop', 'asdfghjklñ', 'zxcvbnm'];
const ROW_SHIFT = [0, 0.28, 0.82];
const U = 1, GAP = 0.14, CAP_H = 0.42, PRESS = 0.2;

export interface Keyboard3DProps {
  /** 0–1 por tecla: altura y color del mapa de calor */
  heat?: Record<string, number> | null;
  /** girar arrastrando con el mouse (mapa de calor) */
  draggable?: boolean;
  /** texto que aparece al pasar por una tecla en el mapa de calor */
  tooltip?: (k: string) => string;
  className?: string;
}

interface Theme { cap: string; side: string; soft: string; ink: string; acc: string; acc2: string; hot: string; bg: string }
const readTheme = (): Theme => ({
  cap: cssColor('--surface', '#ffffff'), side: cssColor('--dim', '#D6E8F7'), soft: cssColor('--soft', '#F0F8FF'), ink: cssColor('--ink', '#1D2B38'),
  acc: cssColor('--accent', '#34A3F0'), acc2: cssColor('--accent-2', '#92D2FF'), hot: cssColor('--err', '#F0607A'), bg: cssColor('--bg', '#ffffff'),
});

function useTheme() {
  const [t, setT] = useState<Theme | null>(null);
  useEffect(() => {
    const read = () => setT(readTheme());
    read();
    window.addEventListener('tecla:theme', read);
    // el modo claro/oscuro cambia un atributo del <html>
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-accent', 'style'] });
    return () => { window.removeEventListener('tecla:theme', read); mo.disconnect(); };
  }, []);
  return t;
}

/** Textura con la letra de una tecla. */
function legend(ch: string, color: string) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d')!;
  x.fillStyle = color; x.font = '600 64px "IBM Plex Mono", ui-monospace, monospace';
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(ch, 64, 70);
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

interface KeyDef { k: string; x: number; z: number; w: number }
function layout(): KeyDef[] {
  const keys: KeyDef[] = [];
  KB_ROWS.forEach((row, r) => [...row].forEach((k, i) => keys.push({ k, x: ROW_SHIFT[r] + i * (U + GAP), z: r * (U + GAP), w: U })));
  keys.push({ k: ' ', x: 2.3, z: 3 * (U + GAP), w: 5.6 });
  // centrar
  const minX = Math.min(...keys.map(k => k.x - k.w / 2)), maxX = Math.max(...keys.map(k => k.x + k.w / 2));
  const cx = (minX + maxX) / 2 - U / 2, cz = 1.5 * (U + GAP);
  return keys.map(k => ({ ...k, x: k.x - cx + (k.w - U) / 2, z: k.z - cz }));
}

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function Keys({ theme, heat, draggable, onHover }: { theme: Theme; heat?: Record<string, number> | null; draggable?: boolean; onHover: (k: string | null) => void }) {
  const keys = useMemo(layout, []);
  const group = useRef<THREE.Group>(null);
  const meshes = useRef<(THREE.Group | null)[]>([]);
  const press = useRef(new Map<string, number>());   // tecla → momento en que se apretó
  const wave = useRef(-1);                              // momento de la ola de festejo
  const drag = useRef({ on: false, x: 0, rot: 0, vel: 0 });
  const still = useMemo(reduced, []);
  const { gl } = useThree();

  const geos = useMemo(() => {
    const m = new Map<number, THREE.BufferGeometry>();
    for (const k of keys) if (!m.has(k.w)) m.set(k.w, new RoundedBoxGeometry(k.w, CAP_H, U, 4, 0.14));
    return m;
  }, [keys]);
  const legendGeo = useMemo(() => new THREE.PlaneGeometry(0.62, 0.62), []);
  // base redondeada justo alrededor de las teclas
  const baseGeo = useMemo(() => {
    const xs = keys.flatMap(k => [k.x - k.w / 2, k.x + k.w / 2]), zs = keys.map(k => k.z);
    const w = Math.max(...xs) - Math.min(...xs) + 0.7, d = Math.max(...zs) - Math.min(...zs) + U + 0.7;
    return { geo: new RoundedBoxGeometry(w, 0.3, d, 4, 0.22), x: (Math.max(...xs) + Math.min(...xs)) / 2, z: (Math.max(...zs) + Math.min(...zs)) / 2 };
  }, [keys]);
  const textures = useMemo(() => new Map(keys.filter(k => k.k !== ' ').map(k => [k.k, legend(k.k, theme.ink)])), [keys, theme.ink]);
  useEffect(() => () => textures.forEach(t => t.dispose()), [textures]);

  // la portada avisa cada tecla con "tecla:press"; "tecla:wave" dispara la ola
  useEffect(() => {
    const onPress = (e: Event) => { const k = String((e as CustomEvent).detail || '').toLowerCase(); press.current.set(k === ' ' ? ' ' : k.normalize('NFD')[0], performance.now()); };
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

  const colors = useMemo(() => ({ cap: new THREE.Color(theme.cap), acc: new THREE.Color(theme.acc), acc2: new THREE.Color(theme.acc2), hot: new THREE.Color(theme.hot), side: new THREE.Color(theme.side) }), [theme]);
  const tmp = useMemo(() => new THREE.Color(), []);

  useFrame((state, dt) => {
    const now = performance.now(), t = state.clock.elapsedTime;
    const g = group.current; if (!g) return;
    // vaivén suave + seguir al mouse (o el giro arrastrado)
    const d = drag.current;
    if (draggable) { if (!d.on) { d.rot += d.vel; d.vel *= 0.92; } g.rotation.y = d.rot; }
    else if (!still) {
      g.rotation.y += ((state.pointer.x * 0.18) - g.rotation.y) * Math.min(1, dt * 3);
      g.rotation.x += ((-state.pointer.y * 0.08) - g.rotation.x) * Math.min(1, dt * 3);
      g.position.y = Math.sin(t * 0.8) * 0.06;
    }
    keys.forEach((k, i) => {
      const m = meshes.current[i]; if (!m) return;
      const h = heat ? heat[k.k] ?? 0 : 0;
      const scaleY = heat ? 0.35 + h * 3.2 : 1;
      // tecla apretada: baja y vuelve en ~260 ms
      const p = press.current.get(k.k), pt = p ? (now - p) / 260 : 1;
      let dy = pt < 1 ? -PRESS * Math.sin(Math.PI * Math.min(1, pt)) : 0;
      // ola: recorre el teclado de izquierda a derecha
      if (wave.current > 0 && !still) { const w = (now - wave.current) / 1000 - (k.x + 6) * 0.05; if (w > 0 && w < 0.5) dy += Math.sin(w / 0.5 * Math.PI) * 0.45; }
      m.position.y += ((CAP_H * scaleY) / 2 + dy - m.position.y) * Math.min(1, dt * 18);
      const box = m.children[0] as THREE.Mesh;
      box.scale.y += (scaleY - box.scale.y) * Math.min(1, dt * 6);
      box.position.y = 0;
      const mat = box.material as THREE.MeshStandardMaterial;
      if (heat) tmp.copy(colors.cap).lerp(h > 0.55 ? colors.hot : colors.acc, Math.min(1, h * 1.4));
      else tmp.copy(k.k === ' ' ? colors.acc : colors.cap).lerp(k.k === ' ' ? colors.acc2 : colors.acc, pt < 1 ? 1 - pt : 0);
      mat.color.lerp(tmp, Math.min(1, dt * 14));
      const lg = m.children[1] as THREE.Mesh | undefined;
      if (lg) lg.position.y = (CAP_H * box.scale.y) / 2 + 0.002;
    });
    if (wave.current > 0 && now - wave.current > 2200) wave.current = -1;
  });

  return (
    <group ref={group} rotation={[0, 0, 0]}>
      {keys.map((k, i) => (
        <group key={k.k} ref={el => { meshes.current[i] = el; }} position={[k.x, CAP_H / 2, k.z]}
          onPointerOver={heat ? e => { e.stopPropagation(); onHover(k.k); } : undefined}
          onPointerOut={heat ? () => onHover(null) : undefined}>
          <mesh geometry={geos.get(k.w)} castShadow receiveShadow>
            <meshStandardMaterial color={k.k === ' ' && !heat ? theme.acc : theme.cap} roughness={0.42} metalness={0.02} />
          </mesh>
          {k.k !== ' ' && (
            <mesh geometry={legendGeo} rotation={[-Math.PI / 2, 0, 0]} position={[0, CAP_H / 2 + 0.002, 0]}>
              <meshBasicMaterial map={textures.get(k.k)} transparent depthWrite={false} />
            </mesh>
          )}
        </group>
      ))}
      {/* base del teclado */}
      <mesh geometry={baseGeo.geo} position={[baseGeo.x, -0.16, baseGeo.z]} receiveShadow>
        <meshStandardMaterial color={theme.side} roughness={0.6} />
      </mesh>
      <mesh position={[baseGeo.x, -0.33, baseGeo.z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[30, 20]} />
        <shadowMaterial opacity={0.14} />
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
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: heat ? [0, 9, 9] : [0, 7.2, 6.4], fov: heat ? 40 : 30 }}
        gl={{ antialias: true, alpha: true }}
        onCreated={({ camera }) => camera.lookAt(0, 0, 0.4)}
        aria-hidden="true"
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[4, 10, 6]} intensity={1.9} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-8} shadow-camera-right={8} shadow-camera-top={6} shadow-camera-bottom={-6} />
        <directionalLight position={[-6, 4, -4]} intensity={0.35} color={theme.acc2} />
        <Keys theme={theme} heat={heat} draggable={draggable} onHover={setHover} />
      </Canvas>
      {tooltip && hover && <div className="kb3d-tip">{tooltip(hover)}</div>}
    </div>
  );
}
