/* textos y cálculos compartidos entre páginas (sin dependencias del DOM) */

export const GAME_NAMES: Record<string, string> = {
  caen: 'palabras que caen',
  torre: 'defensa de torre',
  runner: 'runner',
  bombas: 'bombas',
};

export const DIFF_NAMES: Record<string, string> = { facil: 'fácil', medio: 'medio', dificil: 'difícil' };

const VOCAB_LABEL: Record<string, string> = { facil: 'fácil', dificil: 'difícil' };

/** t30 → "30 s" · w25-dificil → "25 palabras · difícil" */
export function modeLabel(key: string | null | undefined): string {
  if (!key) return 'test';
  const [base, vocab] = key.split('-');
  const n = base.slice(1);
  const main = base[0] === 't' ? `${n} s` : `${n} palabras`;
  return vocab && VOCAB_LABEL[vocab] ? `${main} · ${VOCAB_LABEL[vocab]}` : main;
}

/** Nivel a partir de los puntos totales: cada nivel cuesta un poco más que el anterior. */
export function levelFor(xp: number) {
  const lv = Math.floor(Math.sqrt(xp / 150)) + 1;
  const a = 150 * (lv - 1) ** 2, b = 150 * lv ** 2;
  return { lv, pct: (xp - a) / (b - a), next: b - xp };
}

export const fmt = (n: number) => Math.round(n).toLocaleString('es');
