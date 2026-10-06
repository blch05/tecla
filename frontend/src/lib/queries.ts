/* =========================================================
   Lecturas a Supabase con TanStack Query: caché, estados de carga y error,
   reintentos y refresco al volver a la pestaña, iguales en toda la app.
   Cada consulta exporta sus opciones (clave + función) para usarlas con useQuery
   o para invalidarlas después de escribir.
   Lo que es tiempo real (salas, carreras) no pasa por acá: va por Supabase Realtime.
   ========================================================= */
import { queryOptions } from '@tanstack/react-query';
import { getSupabase } from '@/lib/supabase/client';
import { listRooms } from '@/lib/rooms';
import type { DailyRow } from '@/lib/tecla/history';

export interface LeaderRow { rank: number; username: string; display_name: string | null; avatar_url: string | null; value: number; accuracy: number | null; runs: number }
export interface CoinMove { amount: number; reason: string; created_at: string }

/** Error con un mensaje listo para mostrar. */
const fail = (msg: string): never => { throw new Error(msg); };
const sbOrFail = () => getSupabase() ?? fail('Falta conectar Supabase.');

export const leaderboardQuery = (board: string, period: string) => queryOptions({
  queryKey: ['leaderboard', board, period],
  queryFn: async () => {
    const { data, error } = await sbOrFail().rpc('leaderboard', { p_board: board, p_period: period, p_limit: 50 });
    if (error) fail(/leaderboard/.test(error.message) ? 'El ranking todavía no está activado en la base de datos.' : error.message);
    return (data as LeaderRow[]) || [];
  },
  staleTime: 30_000,
});

/** Salas públicas abiertas: se refresca sola cada 5 s mientras la lista está a la vista. */
export const roomsQuery = queryOptions({
  queryKey: ['rooms'],
  queryFn: async () => {
    const r = await listRooms();
    if (r.error) fail(r.error);
    return r.rooms;
  },
  refetchInterval: 5000,
});

export const dailyTopQuery = (day: string) => queryOptions({
  queryKey: ['daily', day],
  queryFn: async () => {
    const { data, error } = await sbOrFail().from('daily_leaderboard').select('*').eq('day', day).order('rank').limit(10);
    if (error) fail(error.message);
    return (data as DailyRow[]) || [];
  },
});

/** Últimos movimientos de teclas* (solo con sesión). Con el saldo en la clave, se vuelve a pedir cuando cambia. */
export const coinLogQuery = (userId: string | null, balance: number | undefined) => queryOptions({
  queryKey: ['coin_log', userId, balance],
  queryFn: async () => {
    const { data, error } = await sbOrFail().from('coin_log').select('amount, reason, created_at').order('created_at', { ascending: false }).limit(12);
    if (error) fail(error.message);
    return (data as CoinMove[]) || [];
  },
  enabled: !!userId,
});
