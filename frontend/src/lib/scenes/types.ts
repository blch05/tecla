/* =========================================================
   Escenas del test: lo que se ve detrás mientras tipeás.
   Cada escena dibuja en un canvas y reacciona a los eventos del test.
   Las pixeladas dibujan a baja resolución y el canvas se agranda sin suavizar.
   ========================================================= */

/** Lo que pasa en el test, en el orden en que pasa. */
export type SceneEvent =
  | { type: 'key'; ok: boolean }                     // una letra (o espacio)
  | { type: 'word'; ok: boolean }                    // terminó una palabra (ok = sin errores)
  | { type: 'ghost'; diff: number | null }           // letras de ventaja sobre tu récord (null = sin fantasma)
  | { type: 'start' }                                // texto nuevo
  | { type: 'finish'; wpm: number; acc: number; record: boolean };

export interface Palette {
  bg: string; ink: string; sub: string; acc: string; acc2: string; soft: string; dim: string;
  err: string; ok: string; warn: string; dark: boolean;
  /** mezcla dos colores del tema: k = 0 → a, k = 1 → b */
  mix: (a: string, b: string, k: number) => string;
}

export interface Env {
  /** medidas del lienzo en píxeles de dibujo (en las pixeladas, ya divididas) */
  W: number; H: number;
  pal: Palette;
  /** segundos desde que arrancó la escena */
  t: number;
  /** 0–1: qué tan rápido venís respecto de tu récord o tu promedio */
  flow: number;
}

export interface Scene {
  frame(ctx: CanvasRenderingContext2D, env: Env, dt: number): void;
  on?(e: SceneEvent, env: Env): void;
}

export interface SceneDef {
  name: string;
  /** 1 = resolución normal; 3 = cada píxel de dibujo ocupa 3×3 en pantalla */
  pixel: number;
  make: () => Scene;
}
