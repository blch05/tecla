'use client';

/* Conexión a una sala social por Supabase Realtime.
   - presencia: quién está (nombre, color, configuración del anfitrión)
   - broadcast "st": estado de cada jugador, con versión (ver roomSync)
   - el resto de los eventos los maneja quien usa el hook
   Se reconecta sola si el canal se corta. */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase/client';
import { seatId } from '@/lib/rooms';
import { newestMetas, RoomMembers, sameMembers } from '@/lib/roomSync';

export interface Member { id: string; name: string; color: string; joinedAt: number; v?: number; cfg?: Record<string, unknown> }
type Handler = (payload: any) => void;

const guestId = () => { try { let id = localStorage.getItem('tecla:guest'); if (!id) { id = crypto.randomUUID(); localStorage.setItem('tecla:guest', id); } return id; } catch { return crypto.randomUUID(); } };
const guestNick = () => { try { return localStorage.getItem('tecla:nick') || 'invitado-' + Math.floor(Math.random() * 900 + 100); } catch { return 'invitado'; } };

export function useRoom(code: string, initialCfg: Record<string, unknown>, handlers: Record<string, Handler>) {
  const chRef = useRef<RealtimeChannel | null>(null);
  const meRef = useRef<Member | null>(null);
  const membersRef = useRef(new RoomMembers<Member>(6000));
  const listRef = useRef<Member[]>([]);
  const handlersRef = useRef(handlers); handlersRef.current = handlers;
  const lastPres = useRef(0), presT = useRef<number | null>(null);
  const [players, setPlayers] = useState<Member[]>([]);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  const refresh = useCallback(() => {
    const list = membersRef.current.list();
    if (sameMembers(list, listRef.current)) return;
    listRef.current = list; setPlayers(list);
  }, []);

  /** Cambia mis datos (nombre, color, configuración) y los publica en la presencia. */
  const track = useCallback((patch: Partial<Member>, force = false) => {
    if (!meRef.current) return;
    meRef.current = { ...meRef.current, ...patch, v: (meRef.current.v || 0) + 1 };
    membersRef.current.state(meRef.current); refresh();
    const ch = chRef.current; if (!ch) return;
    const go = () => { presT.current = null; lastPres.current = Date.now(); ch.track(meRef.current!); ch.send({ type: 'broadcast', event: 'st', payload: meRef.current }); };
    const wait = 400 - (Date.now() - lastPres.current);
    if (force || wait <= 0) { if (presT.current) clearTimeout(presT.current); go(); }
    else if (!presT.current) presT.current = window.setTimeout(go, wait);
  }, [refresh]);

  /** Manda un evento a todos (con quién lo manda). */
  const send = useCallback((event: string, payload: Record<string, unknown> = {}) => {
    chRef.current?.send({ type: 'broadcast', event, payload: { ...payload, from: meRef.current?.id } });
  }, []);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) { setError('Las salas online necesitan Supabase conectado.'); return; }
    let cancelled = false, retry: number | null = null;

    const connect = () => {
      if (cancelled || !meRef.current) return;
      const ch = sb.channel(`social-${code}`, { config: { presence: { key: meRef.current.id }, broadcast: { self: true } } });
      chRef.current = ch;
      ch.on('presence', { event: 'sync' }, () => {
        membersRef.current.presence(newestMetas(ch.presenceState() as Record<string, Member[]>));
        if (meRef.current) membersRef.current.state(meRef.current);
        refresh(); handlersRef.current.presence?.(listRef.current);
      });
      ch.on('broadcast', { event: 'st' }, ({ payload }) => {
        if (!payload || typeof payload.id !== 'string' || typeof payload.joinedAt !== 'number' || payload.id === meRef.current?.id) return;
        membersRef.current.state(payload as Member); refresh();
      });
      ch.on('broadcast', { event: '*' }, ({ event, payload }) => { if (event !== 'st') handlersRef.current[event]?.(payload); });
      ch.subscribe(status => {
        if (status === 'SUBSCRIBED') { setError(''); setReady(true); ch.track(meRef.current!); ch.send({ type: 'broadcast', event: 'st', payload: meRef.current }); handlersRef.current.joined?.(null); return; }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          if (cancelled || chRef.current !== ch) return;
          setError('Se cortó la conexión con la sala. Reconectando…'); setReady(false);
          chRef.current = null; sb.removeChannel(ch);
          if (retry) clearTimeout(retry); retry = window.setTimeout(connect, 1500);
        }
      });
    };
    const onVisible = () => {
      if (document.hidden || cancelled) return;
      const ch = chRef.current;
      if (!ch || ch.state !== 'joined') { if (ch) { chRef.current = null; sb.removeChannel(ch); } if (retry) clearTimeout(retry); connect(); }
    };
    document.addEventListener('visibilitychange', onVisible);
    const beat = window.setInterval(() => {
      if (!meRef.current) return;
      membersRef.current.state(meRef.current);
      if (chRef.current?.state === 'joined') chRef.current.send({ type: 'broadcast', event: 'st', payload: meRef.current });
      refresh();
    }, 2000);

    import('@/lib/tecla/history').then(({ History }) => {
      if (cancelled) return;
      meRef.current = { id: seatId(History.user?.id || guestId()), name: History.user?.name || guestNick(), color: '', joinedAt: Date.now(), cfg: initialCfg };
      connect();
    });
    import('@/lib/tecla/input').then(m => m.setConsumer(null)); // en estos juegos se escribe en campos normales
    return () => {
      cancelled = true; if (retry) clearTimeout(retry); clearInterval(beat);
      document.removeEventListener('visibilitychange', onVisible);
      if (presT.current) clearTimeout(presT.current);
      const ch = chRef.current; chRef.current = null; if (ch) sb.removeChannel(ch);
    };
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  const host = players[0];
  const isHost = !!host && host.id === meRef.current?.id;
  return { players, meRef, track, send, error, ready, host, isHost };
}
