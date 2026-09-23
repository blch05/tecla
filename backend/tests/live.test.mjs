// =========================================================
// tecla* — tests contra el proyecto real de Supabase, como usuario SIN sesión.
// Prueban que la seguridad rechace lo que tiene que rechazar y que las
// funciones públicas aguanten entradas raras. No dejan datos: las salas de
// prueba se borran al final.
//   npm run test:live
// Lee la URL y la clave pública de ../frontend/.env.local (o de las variables
// SUPABASE_URL / SUPABASE_KEY).
// =========================================================
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function env() {
  let url = process.env.SUPABASE_URL, key = process.env.SUPABASE_KEY;
  if (!url || !key) {
    const txt = readFileSync(new URL('../../frontend/.env.local', import.meta.url), 'utf8');
    const get = k => (txt.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1]?.trim();
    url = url || get('NEXT_PUBLIC_SUPABASE_URL');
    key = key || get('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') || get('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  if (!url || !key) throw new Error('Faltan SUPABASE_URL y SUPABASE_KEY');
  return { url, key };
}
const { url: URL_, key: KEY } = env();
const H = { apikey: KEY, 'Content-Type': 'application/json' };

async function rest(path, { method = 'GET', body, prefer } = {}) {
  const res = await fetch(`${URL_}/rest/v1/${path}`, { method, headers: { ...H, ...(prefer ? { Prefer: prefer } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, json };
}
const rpc = (fn, args = {}) => rest(`rpc/${fn}`, { method: 'POST', body: args });
const denied = r => [401, 403].includes(r.status) && (r.json?.code === '42501' || /permission|row-level/i.test(r.json?.message || ''));

// ---------------------------------------------------------
describe('historial (runs)', () => {
  test('sin sesión no se puede guardar una partida', async () => {
    const r = await rest('runs', { method: 'POST', body: { id: crypto.randomUUID(), kind: 'test', points: 1 } });
    assert.ok(denied(r), `esperaba 42501, llegó ${r.status} ${JSON.stringify(r.json)}`);
  });
  test('sin sesión no se puede guardar a nombre de otro usuario', async () => {
    const r = await rest('runs', { method: 'POST', body: { id: crypto.randomUUID(), user_id: '00000000-0000-0000-0000-000000000001', kind: 'test', points: 1 } });
    assert.ok(denied(r) || r.status === 409, `llegó ${r.status}`);
  });
  test('sin sesión no se ve el historial de nadie', async () => {
    const r = await rest('runs?select=id&limit=5');
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, []);
  });
  test('sin sesión no se pueden borrar partidas', async () => {
    const r = await rest('runs?id=neq.00000000-0000-0000-0000-000000000000', { method: 'DELETE', prefer: 'return=representation' });
    assert.ok(denied(r) || (r.status === 200 && Array.isArray(r.json) && r.json.length === 0), `llegó ${r.status}`);
  });
});

describe('perfiles', () => {
  test('los perfiles se pueden leer (son públicos)', async () => {
    const r = await rest('profiles?select=username&limit=1');
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.json));
  });
  test('sin sesión no se puede editar ningún perfil', async () => {
    const r = await rest('profiles?id=neq.00000000-0000-0000-0000-000000000000', { method: 'PATCH', body: { display_name: 'hackeado' }, prefer: 'return=representation' });
    assert.ok(denied(r) || (r.status === 200 && r.json.length === 0), `llegó ${r.status} ${JSON.stringify(r.json)}`);
  });
});

describe('desafío diario', () => {
  test('sin sesión no se puede anotar un resultado', async () => {
    const r = await rpc('submit_daily', { p_day: new Date().toISOString().slice(0, 10), p_wpm: 80, p_accuracy: 95 });
    assert.ok(denied(r), `llegó ${r.status} ${JSON.stringify(r.json)}`);
  });
  test('no se puede escribir directo en la tabla de resultados', async () => {
    const r = await rest('daily_results', { method: 'POST', body: { user_id: '00000000-0000-0000-0000-000000000001', day: '2026-09-23', wpm: 300, accuracy: 100 } });
    assert.ok(denied(r), `llegó ${r.status}`);
  });
  test('el ranking del día se puede leer', async () => {
    const r = await rest('daily_leaderboard?select=rank,wpm&limit=3');
    assert.equal(r.status, 200);
  });
});

describe('perfil público', () => {
  let someone = null;
  before(async () => { const r = await rest('profiles?select=username&limit=1'); someone = r.json?.[0]?.username ?? null; });

  test('usuario inexistente devuelve null', async () => {
    const r = await rpc('public_profile', { p_username: 'nadie_existe_zz' });
    assert.equal(r.status, 200); assert.equal(r.json, null);
  });
  for (const [name, value] of [['inyección SQL', "x' or '1'='1"], ['texto vacío', ''], ['texto gigante', 'a'.repeat(10000)], ['emoji', '🙂🙂'], ['comodines', '%_%']]) {
    test(`entrada rara (${name}) no rompe ni filtra datos`, async () => {
      const r = await rpc('public_profile', { p_username: value });
      assert.equal(r.status, 200); assert.equal(r.json, null);
    });
  }
  test('un usuario existente se encuentra aunque venga en mayúsculas', async t => {
    if (!someone) return t.skip('no hay perfiles todavía');
    const r = await rpc('public_profile', { p_username: someone.toUpperCase() });
    assert.equal(r.status, 200);
    assert.equal(r.json?.username, someone);
    // nunca expone el historial completo ni datos privados
    assert.ok(!('email' in r.json) && !('user_id' in r.json));
    assert.ok(r.json.recent.length <= 8);
  });
});

describe('rankings globales', () => {
  test('período inválido se trata como "siempre"', async () => {
    const a = await rpc('leaderboard', { p_board: 't30', p_period: 'nunca' });
    const b = await rpc('leaderboard', { p_board: 't30', p_period: 'all' });
    assert.equal(a.status, 200); assert.deepEqual(a.json, b.json);
  });
  test('límite negativo o cero devuelve como mucho 1 fila', async () => {
    for (const p_limit of [-5, 0]) {
      const r = await rpc('leaderboard', { p_board: 'points', p_period: 'all', p_limit });
      assert.equal(r.status, 200); assert.ok(r.json.length <= 1);
    }
  });
  test('límite enorme se acota a 100', async () => {
    const r = await rpc('leaderboard', { p_board: 'points', p_period: 'all', p_limit: 100000 });
    assert.equal(r.status, 200); assert.ok(r.json.length <= 100);
  });
  test('tabla inexistente o con símbolos no devuelve nada', async () => {
    for (const p_board of ['no-existe', "t30'; drop table runs; --", '']) {
      const r = await rpc('leaderboard', { p_board, p_period: 'all' });
      assert.equal(r.status, 200); assert.deepEqual(r.json, []);
    }
  });
  test('las filas vienen ordenadas por puesto y sin datos privados', async () => {
    const r = await rpc('leaderboard', { p_board: 'points', p_period: 'all', p_limit: 50 });
    const ranks = r.json.map(x => Number(x.rank));
    assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b));
    for (const row of r.json) assert.ok(!('user_id' in row) && !('email' in row));
  });
});

// ---------------------------------------------------------
const ready = (await rpc('find_room', { p_code: 'zzzzz' })).status === 200;
describe('salas online', () => {
  const code = 'zt' + Math.random().toString(36).slice(2, 7);
  const tokA = 'a'.repeat(24), tokB = 'b'.repeat(24);
  const room = (over = {}) => ({ p_code: code, p_token: tokA, p_game: 'torre', p_difficulty: 'medio', p_public: true, p_host_name: 'test', p_players: 2, p_status: 'lobby', ...over });
  const listed = async () => (await rpc('list_rooms')).json?.find(r => r.code === code);

  after(async () => { if (ready) { await rpc('close_room', { p_code: code, p_token: tokA }); await rpc('close_room', { p_code: code, p_token: tokB }); } });

  test('token corto se rechaza', { skip: !ready && 'migración de salas sin aplicar' }, async () => {
    const r = await rpc('upsert_room', room({ p_token: 'corto' }));
    assert.equal(r.status, 400); assert.match(r.json.message, /token/);
  });
  test('código o juego inválidos se rechazan', { skip: !ready && 'migración de salas sin aplicar' }, async () => {
    assert.equal((await rpc('upsert_room', room({ p_code: 'A!' }))).status, 400);
    assert.equal((await rpc('upsert_room', room({ p_game: 'ajedrez' }))).status, 400);
    assert.equal((await rpc('upsert_room', room({ p_status: 'rota' }))).status, 400);
  });
  test('una sala pública aparece en la lista con los jugadores acotados', { skip: !ready && 'migración de salas sin aplicar' }, async () => {
    const r = await rpc('upsert_room', room({ p_players: 999 }));
    assert.equal(r.status, 204);
    const l = await listed();
    assert.ok(l, 'no aparece en la lista'); assert.equal(l.players, 50);
  });
  test('otro token no puede pisar la sala', { skip: !ready && 'migración de salas sin aplicar' }, async () => {
    await rpc('upsert_room', room({ p_token: tokB, p_host_name: 'intruso', p_game: 'bombas' }));
    const l = await listed();
    assert.equal(l.host_name, 'test'); assert.equal(l.game, 'torre');
  });
  test('al pasarla a privada desaparece de la lista pero se encuentra con el código', { skip: !ready && 'migración de salas sin aplicar' }, async () => {
    await rpc('upsert_room', room({ p_public: false }));
    assert.equal(await listed(), undefined);
    const f = await rpc('find_room', { p_code: code.toUpperCase() });
    assert.equal(f.json, 'torre');
  });
  test('cerrar con token equivocado no hace nada; con el correcto la borra', { skip: !ready && 'migración de salas sin aplicar' }, async () => {
    await rpc('close_room', { p_code: code, p_token: tokB });
    assert.equal((await rpc('find_room', { p_code: code })).json, 'torre');
    await rpc('close_room', { p_code: code, p_token: tokA });
    assert.equal((await rpc('find_room', { p_code: code })).json, null);
  });
  test('la tabla de salas no se puede leer directo', { skip: !ready && 'migración de salas sin aplicar' }, async () => {
    const r = await rest('rooms?select=*&limit=5');
    assert.ok(r.status === 200 ? r.json.length === 0 : denied(r));
  });
});
