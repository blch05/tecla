/* historial: guardado local, sincronización con Supabase y sus casos límite */
const upsert = vi.fn();
const fakeSb = { from: vi.fn(() => ({ upsert })), rpc: vi.fn(), auth: { signOut: vi.fn() } };
let sbAvailable = true;
vi.mock('@/lib/supabase/client', () => ({ getSupabase: () => (sbAvailable ? fakeSb : null) }));

import { History } from '@/lib/tecla/history';

function reset(mode: 'local' | 'cloud' = 'cloud') {
  Object.assign(History, { mode, user: mode === 'cloud' ? { id: 'u1', name: 'Ana', username: 'ana', avatarUrl: null, email: null } : null, cloud: new Map(), writing: false, fails: 0, noModeKey: false });
  History.listeners.clear();
  upsert.mockReset(); fakeSb.from.mockClear();
  sbAvailable = true;
}

beforeEach(() => { reset(); vi.useFakeTimers(); });
afterEach(() => vi.useRealTimers());

describe('record', () => {
  it('siempre guarda primero en el navegador, aunque no haya sesión', () => {
    reset('local');
    const r = History.record({ t: 'test', pts: 10.7 });
    expect(History.local()[0].id).toBe(r.id);
    expect(r.pts).toBe(11);              // redondea
    expect(upsert).not.toHaveBeenCalled(); // sin sesión no sube nada
  });
  it('los puntos negativos o inválidos quedan en 0', () => {
    reset('local');
    expect(History.record({ t: 'test', pts: -50 }).pts).toBe(0);
    expect(History.record({ t: 'test', pts: NaN as unknown as number }).pts).toBe(0);
  });
  it('avisa a los suscriptores y se puede desuscribir', () => {
    reset('local');
    const fn = vi.fn();
    const off = History.subscribe(fn);
    History.record({ t: 'test', pts: 1 });
    off();
    History.record({ t: 'test', pts: 1 });
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it('el historial local no crece sin límite', () => {
    reset('local');
    for (let i = 0; i < 850; i++) History.record({ t: 'test', pts: 1 });
    expect(History.local().length).toBe(800);
  });
});

describe('sincronización', () => {
  it('sube las partidas pendientes y las marca como sincronizadas', async () => {
    upsert.mockResolvedValue({ error: null });
    const r = History.record({ t: 'arcade', pts: 100, game: 'torre', diff: 'dificil', score: 100 });
    await vi.runAllTimersAsync();
    expect(upsert).toHaveBeenCalledTimes(1);
    const [rows, opts] = upsert.mock.calls[0];
    expect(opts).toEqual({ onConflict: 'id', ignoreDuplicates: true });
    expect(rows[0]).toMatchObject({ id: r.id, kind: 'arcade', game: 'torre', difficulty: 'dificil', points: 100 });
    expect(History.local()[0].s).toBe(1);
    expect(History.pending()).toBe(0);
  });
  it('si falta la columna mode_key (migración sin aplicar) reintenta sin ella', async () => {
    upsert.mockResolvedValueOnce({ error: { message: 'Could not find the \'mode_key\' column of \'runs\'' } }).mockResolvedValueOnce({ error: null });
    History.record({ t: 'test', pts: 5, key: 't30' });
    await vi.runAllTimersAsync();
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert.mock.calls[1][0][0].mode_key).toBeUndefined();
    expect(History.noModeKey).toBe(true);
    expect(History.pending()).toBe(0);
  });
  it('ante errores reintenta con espera creciente y se rinde después de 4 fallos', async () => {
    upsert.mockResolvedValue({ error: { message: 'network down' } });
    History.record({ t: 'test', pts: 5 });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(upsert.mock.calls.length).toBe(4);
    expect(History.pending()).toBe(1); // no se pierde: sigue pendiente en el navegador
  });
  it('no sube dos veces a la vez (evita duplicados por carrera)', async () => {
    let resolve!: (v: unknown) => void;
    upsert.mockReturnValue(new Promise(r => (resolve = r)));
    History.record({ t: 'test', pts: 1 });
    History.record({ t: 'test', pts: 1 });
    expect(upsert).toHaveBeenCalledTimes(1);
    resolve({ error: null });
    await vi.runAllTimersAsync();
  });
  it('sin Supabase configurado no intenta subir', async () => {
    sbAvailable = false;
    History.record({ t: 'test', pts: 1 });
    await vi.runAllTimersAsync();
    expect(upsert).not.toHaveBeenCalled();
  });
});

describe('lectura combinada', () => {
  it('all() une local y nube sin duplicar y ordena de más nuevo a más viejo', () => {
    reset('local');
    const a = History.record({ t: 'test', pts: 1 });
    vi.advanceTimersByTime(1000);
    const b = History.record({ t: 'test', pts: 2 });
    History.cloud.set(a.id, { ...a, s: 1 });
    History.cloud.set('otra', { id: 'otra', d: b.d + 5000, t: 'study', pts: 3 });
    const all = History.all();
    expect(all.map(r => r.id)).toEqual(['otra', b.id, a.id]);
  });
  it('bestArcade toma el máximo entre récord local y partidas en la nube, por dificultad', () => {
    localStorage.setItem('tecla:arc:torre:dificil', '500');
    History.cloud.set('x', { id: 'x', d: 1, t: 'arcade', pts: 0, game: 'torre', diff: 'dificil', score: 900 });
    History.cloud.set('y', { id: 'y', d: 1, t: 'arcade', pts: 0, game: 'torre', diff: 'facil', score: 9999 });
    expect(History.bestArcade('torre', 'dificil')).toBe(900);
    expect(History.bestArcade('torre', 'medio')).toBe(0);
  });
});

describe('updateProfile (validación antes de ir a la base)', () => {
  it.each([
    ['ab', 'muy corto'], ['UsuarioConMayus', 'mayúsculas'], ['con espacio', 'espacios'], ['ñandu', 'eñe'], ['a'.repeat(21), 'muy largo'],
  ])('rechaza el usuario "%s" (%s)', async (username) => {
    const err = await History.updateProfile({ username });
    expect(err).toMatch(/minúsculas/);
    expect(fakeSb.from).not.toHaveBeenCalled();
  });
  it('rechaza un nombre vacío o de puros espacios', async () => {
    expect(await History.updateProfile({ display_name: '   ' })).toMatch(/vacío/);
  });
  it('traduce el error de usuario tomado', async () => {
    const eq = vi.fn().mockResolvedValue({ error: { code: '23505', message: 'duplicate key' } });
    fakeSb.from.mockReturnValueOnce({ update: () => ({ eq }) } as never);
    expect(await History.updateProfile({ username: 'tomado' })).toBe('Ese usuario ya está tomado.');
  });
  it('sin sesión pide entrar', async () => {
    reset('local');
    expect(await History.updateProfile({ username: 'libre' })).toMatch(/entrar/);
  });
});
