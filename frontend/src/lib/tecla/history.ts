/* =========================================================
   historial y puntos del usuario.
   - Siempre se guarda primero en localStorage (nunca se pierde una partida).
   - Si hay sesión de Supabase, se sube a la tabla `runs` y se lee de ahí.
   ========================================================= */
import type { Session } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase/client';
import { store } from '@/lib/tecla/utils';

export type RunKind = 'test' | 'arcade' | 'comp' | 'study';
export interface Run {
  id: string;
  d: number; // timestamp en ms
  t: RunKind;
  pts: number;
  mode?: string;
  key?: string; // clave del modo de test para los rankings: t30, w25, t30-dificil…
  game?: string;
  diff?: string;
  score?: number;
  wpm?: number;
  acc?: number;
  detail?: string;
  fin?: boolean;
  win?: boolean;
  s?: 1; // ya sincronizada con la nube
}
export interface HistoryUser { id: string; name: string; username: string | null; avatarUrl: string | null; email: string | null }
export interface DailyRow { rank: number; user_id: string; display_name: string | null; avatar_url: string | null; wpm: number; accuracy: number }

/** fecha del runner nuevo (persecución por carriles) */
const RUNNER_V2 = Date.UTC(2026, 8, 24);
const uuid = () => (crypto && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`);

function toRow(r: Run) {
  return {
    id: r.id, kind: r.t, mode: r.mode ?? null, mode_key: r.key ?? null, game: r.game ?? null, difficulty: r.diff ?? null,
    score: r.score ?? null, wpm: r.wpm ?? null, accuracy: r.acc ?? null, points: r.pts, detail: r.detail ?? null,
    finished: r.fin ?? true, won: r.win ?? null, created_at: new Date(r.d).toISOString(),
  };
}
function fromRow(x: any): Run {
  return {
    id: x.id, d: new Date(x.created_at).getTime(), t: x.kind, pts: x.points ?? 0, mode: x.mode ?? undefined, key: x.mode_key ?? undefined, game: x.game ?? undefined,
    diff: x.difficulty ?? undefined, score: x.score ?? undefined, wpm: x.wpm ?? undefined, acc: x.accuracy ?? undefined,
    detail: x.detail ?? undefined, fin: x.finished ?? undefined, win: x.won ?? undefined, s: 1,
  };
}

type Listener = () => void;

export const History = {
  mode: 'local' as 'local' | 'cloud',
  user: null as HistoryUser | null,
  cloud: new Map<string, Run>(),
  listeners: new Set<Listener>(),
  started: false,
  writing: false,
  fails: 0,
  noModeKey: false,

  local(): Run[] { return store.get('runs', []); },
  saveLocal(list: Run[]) { store.set('runs', list.slice(0, 800)); },
  all(): Run[] {
    const m = new Map<string, Run>();
    this.local().forEach(r => m.set(r.id, r));
    this.cloud.forEach((r, id) => m.set(id, r));
    return [...m.values()].sort((a, b) => b.d - a.d);
  },
  pending(): number { return this.mode === 'cloud' ? this.local().filter(r => !r.s && !this.cloud.has(r.id)).length : 0; },

  record(run: Omit<Run, 'id' | 'd'> & Partial<Pick<Run, 'id' | 'd'>>): Run {
    const r: Run = { ...run, id: uuid(), d: Date.now(), pts: Math.max(0, Math.round(run.pts || 0)) } as Run;
    const list = this.local(); list.unshift(r); this.saveLocal(list);
    this.push(); this.changed();
    return r;
  },

  subscribe(fn: Listener) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; },
  changed() { this.listeners.forEach(fn => fn()); },

  async init() {
    if (this.started) return; this.started = true;
    const sb = getSupabase(); if (!sb) return;
    const { data } = await sb.auth.getSession();
    await this.setSession(data.session);
    sb.auth.onAuthStateChange((_event, session) => { setTimeout(() => this.setSession(session), 0); });
  },

  async setSession(session: Session | null) {
    const sb = getSupabase(); if (!sb) return;
    if (!session) { this.mode = 'local'; this.user = null; this.cloud = new Map(); this.changed(); return; }
    if (this.user && this.user.id === session.user.id && this.mode === 'cloud') return;
    const u = session.user, meta: any = u.user_metadata || {};
    this.user = { id: u.id, username: null, name: meta.full_name || meta.name || (u.email ? u.email.split('@')[0] : 'vos'), avatarUrl: meta.avatar_url || meta.picture || null, email: u.email ?? null };
    this.mode = 'cloud'; this.changed();
    await this.loadProfile();
    await this.pull();
    await this.push();
    this.changed();
  },

  async loadProfile() {
    const sb = getSupabase(); if (!sb || !this.user) return;
    // select(*) para no romper si la migración social todavía no está aplicada
    const { data: prof } = await sb.from('profiles').select('*').eq('id', this.user.id).maybeSingle();
    if (!prof) return;
    if (prof.display_name) this.user.name = prof.display_name;
    if (prof.avatar_url) this.user.avatarUrl = prof.avatar_url;
    this.user.username = prof.username ?? null;
    this.changed();
  },

  /** Cambia nombre visible y/o usuario. Devuelve un mensaje de error legible o null. */
  async updateProfile(patch: { display_name?: string; username?: string }): Promise<string | null> {
    const sb = getSupabase(); if (!sb || !this.user) return 'Tenés que entrar con tu cuenta.';
    if (patch.username !== undefined && !/^[a-z0-9_]{3,20}$/.test(patch.username)) return 'El usuario va en minúsculas, de 3 a 20 caracteres: letras, números y guion bajo.';
    if (patch.display_name !== undefined && !patch.display_name.trim()) return 'El nombre no puede quedar vacío.';
    const { error } = await sb.from('profiles').update(patch).eq('id', this.user.id);
    if (error) return error.code === '23505' ? 'Ese usuario ya está tomado.' : error.message;
    await this.loadProfile();
    return null;
  },

  async pull() {
    const sb = getSupabase(); if (!sb || this.mode !== 'cloud') return;
    const { data, error } = await sb.from('runs').select('*').order('created_at', { ascending: false }).limit(2000);
    if (error) return;
    this.cloud = new Map((data || []).map(x => [x.id, fromRow(x)]));
  },

  async push() {
    const sb = getSupabase();
    if (!sb || this.mode !== 'cloud' || this.writing || this.fails > 3) return;
    const pending = this.local().filter(r => !r.s && !this.cloud.has(r.id));
    if (!pending.length) return;
    this.writing = true;
    try {
      const rows = pending.map(toRow).map(r => (this.noModeKey ? { ...r, mode_key: undefined } : r));
      let { error } = await sb.from('runs').upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
      // si la migración social todavía no está aplicada, la columna mode_key no existe: reintentar sin ella
      if (error && /mode_key/.test(error.message) && !this.noModeKey) {
        this.noModeKey = true;
        ({ error } = await sb.from('runs').upsert(rows.map(r => ({ ...r, mode_key: undefined })), { onConflict: 'id', ignoreDuplicates: true }));
      }
      if (error) throw error;
      const ok = new Set(pending.map(r => r.id));
      pending.forEach(r => this.cloud.set(r.id, { ...r, s: 1 }));
      this.saveLocal(this.local().map(r => (ok.has(r.id) ? { ...r, s: 1 as const } : r)));
      this.fails = 0;
      // la base acredita teclas* al guardar partidas (ver migración shop): la tienda se entera y avisa
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('tecla:runs-saved'));
    } catch {
      this.fails++;
      setTimeout(() => this.push(), 2500 * this.fails);
    } finally {
      this.writing = false; this.changed();
    }
  },

  /** Mejor puntaje de arcade entre lo local y la nube. */
  bestArcade(game: string, diff: string): number {
    // el runner cambió por completo el 24/09/2026: sus récords viejos no cuentan
    const runner = game === 'runner', since = runner ? RUNNER_V2 : 0;
    const key = 'arc:' + game + (runner ? '-p' : '') + (diff === 'medio' ? '' : ':' + diff);
    let best = store.get(key, 0);
    this.cloud.forEach(r => { if (r.t === 'arcade' && r.game === game && r.diff === diff && (r.d || 0) >= since) best = Math.max(best, r.score || 0); });
    return best;
  },

  /* ---------- ranking del desafío diario ---------- */
  async submitDaily(day: string, wpm: number, acc: number) {
    const sb = getSupabase(); if (!sb || this.mode !== 'cloud') return;
    await sb.rpc('submit_daily', { p_day: day, p_wpm: Math.round(wpm * 10) / 10, p_accuracy: Math.round(acc * 10) / 10 });
  },
  async dailyTop(day: string): Promise<DailyRow[]> {
    const sb = getSupabase(); if (!sb) return [];
    const { data, error } = await sb.from('daily_leaderboard').select('*').eq('day', day).order('rank').limit(10);
    return error ? [] : (data as DailyRow[]);
  },

  async signOut() { const sb = getSupabase(); if (sb) await sb.auth.signOut(); },
};
