/* =========================================================
   historial local de tests y récords por modo.
   Es independiente del historial general (history.ts): guarda los datos finos
   que usan el gráfico de progreso, el fantasma y la dificultad de los bots.
   ========================================================= */
import type { TimelinePoint } from '@/lib/tecla/typebox';
import { store } from '@/lib/tecla/utils';

export interface TestRow {
  d: number;
  /** clave del modo: t30, w25, t60-dificil… */
  k: string;
  wpm: number;
  acc: number;
  raw: number;
  cons: number;
  /** test de puntos débiles: no cuenta para el promedio ni el gráfico */
  weak?: boolean;
}

/** récord de un modo: con su semilla y línea de tiempo para correr contra el fantasma */
export interface PersonalBest { wpm: number; acc: number; seed: number; tl: TimelinePoint[]; d: number }

const MAX_ROWS = 300;

export const testHistory = {
  all: () => store.get<TestRow[]>('hist', []),
  /** sin los tests de puntos débiles */
  regular: () => testHistory.all().filter(x => !x.weak),
  push(row: TestRow) { store.set('hist', [...testHistory.all(), row].slice(-MAX_ROWS)); },
  clear() { store.del('hist'); },
};

export const personalBest = {
  get: (key: string) => store.get<PersonalBest | null>('pb:' + key, null),
  set: (key: string, pb: PersonalBest) => store.set('pb:' + key, pb),
};
