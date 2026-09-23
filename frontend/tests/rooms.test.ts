const rpc = vi.fn();
vi.mock('@/lib/supabase/client', () => ({ getSupabase: () => ({ rpc }) }));

import { cleanCode, closeRoom, findRoom, listRooms, newRoomCode, publishRoom, roomPath, roomToken } from '@/lib/rooms';

beforeEach(() => rpc.mockReset());

describe('códigos de sala', () => {
  it('cleanCode deja solo minúsculas y números, hasta 8', () => {
    expect(cleanCode('AbC-12 34')).toBe('abc1234');
    expect(cleanCode('ñandú')).toBe('and');
    expect(cleanCode('')).toBe('');
    expect(cleanCode('abcdefghijkl')).toBe('abcdefgh');
    expect(cleanCode("x'; drop table rooms; --")).toBe('xdroptab');
  });
  it('newRoomCode genera códigos válidos para la base (3 a 8 caracteres a-z0-9)', () => {
    for (let i = 0; i < 200; i++) expect(newRoomCode()).toMatch(/^[a-z0-9]{3,8}$/);
  });
});

describe('roomPath', () => {
  it('las carreras van a /carrera y el resto a /sala con el juego', () => {
    expect(roomPath('carrera', 'abc12')).toBe('/carrera/abc12');
    expect(roomPath('torre', 'abc12')).toBe('/sala/abc12?juego=torre');
  });
  it('las privadas agregan el parámetro con el separador correcto', () => {
    expect(roomPath('carrera', 'abc12', false)).toBe('/carrera/abc12?privada=1');
    expect(roomPath('bombas', 'abc12', false)).toBe('/sala/abc12?juego=bombas&privada=1');
  });
});

describe('roomToken', () => {
  it('es estable para la misma sala y distinto entre salas', () => {
    const a = roomToken('sala1'), b = roomToken('sala1'), c = roomToken('sala2');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a.length).toBeGreaterThanOrEqual(16); // la base exige 16 o más
  });
  it('si se hereda un token, lo adopta y lo recuerda', () => {
    roomToken('sala3');
    expect(roomToken('sala3', 'heredado-0123456789')).toBe('heredado-0123456789');
    expect(roomToken('sala3')).toBe('heredado-0123456789');
  });
});

describe('llamadas a la base', () => {
  it('publishRoom manda todos los parámetros con los nombres de la función SQL', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await publishRoom({ code: 'abc12', token: 't'.repeat(20), game: 'torre', difficulty: 'dificil', isPublic: false, hostName: 'Ana', players: 3, status: 'playing' });
    expect(rpc).toHaveBeenCalledWith('upsert_room', {
      p_code: 'abc12', p_token: 't'.repeat(20), p_game: 'torre', p_difficulty: 'dificil', p_public: false,
      p_host_name: 'Ana', p_players: 3, p_status: 'playing',
    });
  });
  it('carrera sin dificultad manda null', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await publishRoom({ code: 'abc12', token: 't'.repeat(20), game: 'carrera', isPublic: true, hostName: 'Ana', players: 1, status: 'lobby' });
    expect(rpc.mock.calls[0][1].p_difficulty).toBeNull();
  });
  it('closeRoom pasa código y token', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await closeRoom('abc12', 'tok');
    expect(rpc).toHaveBeenCalledWith('close_room', { p_code: 'abc12', p_token: 'tok' });
  });
  it('listRooms traduce el error de función inexistente a un mensaje entendible', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'Could not find the function public.list_rooms' } });
    const r = await listRooms();
    expect(r.rooms).toEqual([]);
    expect(r.error).toMatch(/todavía no está activada/);
  });
  it('listRooms con datos nulos devuelve lista vacía', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await listRooms()).toEqual({ rooms: [], error: null });
  });
  it('findRoom devuelve null ante error o sala inexistente', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'x' } });
    expect(await findRoom('abc')).toBeNull();
    rpc.mockResolvedValueOnce({ data: null, error: null });
    expect(await findRoom('abc')).toBeNull();
    rpc.mockResolvedValueOnce({ data: 'torre', error: null });
    expect(await findRoom('abc')).toBe('torre');
  });
});
