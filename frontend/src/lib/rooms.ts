/* salas online: registro en Supabase para que las públicas aparezcan en la lista */
import { getSupabase } from '@/lib/supabase/client';

export type RoomGame = 'carrera' | 'bombas' | 'runner' | 'caen' | 'torre' | 'royale' | SocialGame;
/** juegos sociales: por turnos o rondas, sin depender de tipear rápido */
export type SocialGame = 'oculta' | 'sopa' | 'pistas' | 'tutti';
export const SOCIAL_GAMES: SocialGame[] = ['oculta', 'sopa', 'pistas', 'tutti'];
export const isSocial = (g: string): g is SocialGame => (SOCIAL_GAMES as string[]).includes(g);

export interface RoomInfo {
  code: string;
  game: RoomGame;
  difficulty: string | null;
  host_name: string;
  players: number;
  max_players: number;
  status: 'lobby' | 'playing';
  updated_at: string;
  spicy?: boolean;
}


export const newRoomCode = () => Math.random().toString(36).slice(2, 7);
export const cleanCode = (c: string) => c.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
export const roomPath = (game: RoomGame, code: string, isPublic = true) =>
  (game === 'carrera' ? `/carrera/${code}` : `/sala/${code}?juego=${game}`) + (isPublic ? '' : (game === 'carrera' ? '?privada=1' : '&privada=1'));

/** Token del anfitrión para esta sala (se comparte con los demás por presencia, para poder heredar la sala). */
export function roomToken(code: string, inherited?: string | null): string {
  const key = 'tecla:roomtok:' + code;
  try {
    if (inherited) { localStorage.setItem(key, inherited); return inherited; }
    let t = localStorage.getItem(key);
    if (!t) { t = crypto.randomUUID().replace(/-/g, ''); localStorage.setItem(key, t); }
    return t;
  } catch { return inherited || crypto.randomUUID().replace(/-/g, ''); }
}

export async function publishRoom(r: { code: string; token: string; game: RoomGame; difficulty?: string | null; isPublic: boolean; hostName: string; players: number; status: 'lobby' | 'playing'; spicy?: boolean }) {
  const sb = getSupabase(); if (!sb) return;
  const args: Record<string, unknown> = {
    p_code: r.code, p_token: r.token, p_game: r.game, p_difficulty: r.difficulty ?? null, p_public: r.isPublic,
    p_host_name: r.hostName, p_players: r.players, p_status: r.status,
  };
  // p_spicy solo existe desde la migración de juegos sociales: si falta, se publica igual sin la marca
  if (r.spicy) { const { error } = await sb.rpc('upsert_room', { ...args, p_spicy: true }); if (!error) return; }
  await sb.rpc('upsert_room', args);
}

export async function closeRoom(code: string, token: string) {
  const sb = getSupabase(); if (!sb) return;
  await sb.rpc('close_room', { p_code: code, p_token: token });
}

export async function listRooms(): Promise<{ rooms: RoomInfo[]; error: string | null }> {
  const sb = getSupabase();
  if (!sb) return { rooms: [], error: 'Falta conectar Supabase.' };
  const { data, error } = await sb.rpc('list_rooms');
  if (error) return { rooms: [], error: /list_rooms/.test(error.message) ? 'La lista de salas todavía no está activada en la base de datos.' : error.message };
  return { rooms: (data as RoomInfo[]) || [], error: null };
}

/** Busca a qué juego corresponde un código (sirve también para salas privadas). */
export async function findRoom(code: string): Promise<RoomGame | null> {
  const sb = getSupabase(); if (!sb) return null;
  const { data, error } = await sb.rpc('find_room', { p_code: code });
  return error ? null : ((data as RoomGame | null) ?? null);
}

/* Identidad dentro de una sala: una por pestaña (y por carga de página).
   Antes se usaba el id de la cuenta o del navegador, y dos pestañas o dos
   dispositivos con la misma cuenta se pisaban como si fueran un solo jugador. */
const TAB = Math.random().toString(36).slice(2, 8);
export const seatId = (base: string) => `${base}-${TAB}`;
