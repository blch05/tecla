-- =========================================================
-- tecla* — tests de la base (pgTAP). Se corren con:  npx supabase test db
-- (necesita Supabase local: npx supabase start, con Docker abierto)
-- Todo corre dentro de una transacción que se deshace al final.
-- =========================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(51);

-- ---------- usuarios de prueba (el trigger crea sus perfiles) ----------
insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'ana@test.com',  '{"full_name":"Ana Test","avatar_url":"https://x.test/a.png"}', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'beto@test.com', '{"name":"Beto","avatar_url":"javascript:alert(1)"}',            'authenticated', 'authenticated'),
  ('33333333-3333-3333-3333-333333333333', '@test.com',     '{}',                                                              'authenticated', 'authenticated');

-- ========== perfiles al registrarse ==========
select is((select display_name from profiles where id = '11111111-1111-1111-1111-111111111111'), 'Ana Test', 'perfil: toma el nombre de Google');
select ok((select username ~ '^[a-z0-9_]{3,20}$' from profiles where id = '11111111-1111-1111-1111-111111111111'), 'perfil: genera un usuario válido');
select is((select avatar_url from profiles where id = '22222222-2222-2222-2222-222222222222'), null, 'perfil: descarta avatares que no son https');
select ok((select username ~ '^jugador_' and display_name = 'jugador' from profiles where id = '33333333-3333-3333-3333-333333333333'), 'perfil: email sin nombre usa "jugador"');
select isnt((select username from profiles where id = '11111111-1111-1111-1111-111111111111'),
            (select username from profiles where id = '22222222-2222-2222-2222-222222222222'), 'perfil: usuarios distintos');

-- ========== historial (runs) como Ana ==========
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select lives_ok($$ insert into runs (id, kind, mode_key, wpm, accuracy, points) values (gen_random_uuid(), 'test', 't30', 70, 95, 67) $$, 'runs: guardar una partida propia');
select lives_ok($$ insert into runs (id, kind, mode_key, wpm, accuracy, points) values (gen_random_uuid(), 'test', 't30', 120, 60, 72) $$, 'runs: partida con baja precisión se guarda igual');
select lives_ok($$ insert into runs (id, kind, game, difficulty, score, points) values (gen_random_uuid(), 'arcade', 'torre', 'dificil', 500, 500) $$, 'runs: partida de arcade');
select lives_ok($$ insert into runs (id, kind, mode, won, points) values (gen_random_uuid(), 'comp', 'carrera', true, 150) $$, 'runs: victoria en competir');
select throws_ok($$ insert into runs (id, user_id, kind, points) values (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'test', 1) $$, '42501', null, 'runs: no se puede guardar a nombre de otro');
select throws_ok($$ insert into runs (id, kind, wpm, points) values (gen_random_uuid(), 'test', 351, 1) $$, '23514', null, 'runs: ppm > 350 se rechaza');
select throws_ok($$ insert into runs (id, kind, accuracy, points) values (gen_random_uuid(), 'test', 100.1, 1) $$, '23514', null, 'runs: precisión > 100 se rechaza');
select throws_ok($$ insert into runs (id, kind, points) values (gen_random_uuid(), 'trampa', 1) $$, '23514', null, 'runs: tipo inválido se rechaza');
select throws_ok($$ insert into runs (id, kind, points) values (gen_random_uuid(), 'test', -1) $$, '23514', null, 'runs: puntos negativos se rechazan');
select throws_ok($$ insert into runs (id, kind, detail, points) values (gen_random_uuid(), 'test', repeat('x', 301), 1) $$, '23514', null, 'runs: detalle de más de 300 letras se rechaza');
select throws_ok($$ insert into runs (id, kind, mode_key, points) values (gen_random_uuid(), 'test', 'T30; drop', 1) $$, '23514', null, 'runs: clave de modo con símbolos se rechaza');

insert into runs (id, kind, points, created_at) values ('aaaaaaaa-0000-0000-0000-000000000001', 'test', 1, now() + interval '1 year');
select ok((select created_at <= now() from runs where id = 'aaaaaaaa-0000-0000-0000-000000000001'), 'runs: una fecha futura se recorta a ahora');
insert into runs (id, kind, points, created_at) values ('aaaaaaaa-0000-0000-0000-000000000002', 'test', 1, now() - interval '5 years');
select ok((select created_at >= now() - interval '30 days 1 minute' from runs where id = 'aaaaaaaa-0000-0000-0000-000000000002'), 'runs: una fecha muy vieja se recorta a 30 días');
select throws_ok($$ insert into runs (id, kind, points) values ('aaaaaaaa-0000-0000-0000-000000000001', 'test', 1) $$, '23505', null, 'runs: id repetido no duplica la partida');
select throws_ok($$ update runs set points = 999999 where user_id = auth.uid() $$, '42501', null, 'runs: no se pueden editar partidas');
select throws_ok($$ delete from runs where user_id = auth.uid() $$, '42501', null, 'runs: no se pueden borrar partidas');

-- partida de hace 2 días (para los rankings por período)
insert into runs (id, kind, mode_key, wpm, accuracy, points, created_at) values (gen_random_uuid(), 'test', 't15', 99, 97, 96, now() - interval '2 days');

-- ========== Beto: aislamiento y edición de perfil ==========
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select is((select count(*) from runs where user_id = '11111111-1111-1111-1111-111111111111'), 0::bigint, 'runs: no se ve el historial de otro');
select results_eq($$ with u as (update profiles set display_name = 'hackeado' where id = '11111111-1111-1111-1111-111111111111' returning 1) select count(*)::int from u $$, $$ values (0) $$, 'perfil: no se puede editar el perfil de otro');
select throws_ok($$ update profiles set username = 'AB' where id = auth.uid() $$, '23514', null, 'perfil: usuario con formato inválido');
select throws_ok(format($$ update profiles set username = %L where id = auth.uid() $$, (select username from profiles where id = '11111111-1111-1111-1111-111111111111')), '23505', null, 'perfil: usuario ya tomado');
select throws_ok($$ update profiles set created_at = now() - interval '10 years' where id = auth.uid() $$, '42501', null, 'perfil: no se puede tocar created_at');
select throws_ok($$ update profiles set avatar_url = 'javascript:alert(1)' where id = auth.uid() $$, '23514', null, 'perfil: avatar debe ser https');
select lives_ok($$ update profiles set display_name = 'Beto B', username = 'beto_b' where id = auth.uid() $$, 'perfil: cambiar nombre y usuario propios');
select throws_ok($$ update profiles set display_name = repeat('x', 41) where id = auth.uid() $$, '23514', null, 'perfil: nombre de más de 40 letras');

-- ========== desafío diario ==========
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select throws_ok($$ select submit_daily(current_date, 80, 95) $$, '42501', null, 'diario: sin sesión no se puede anotar');
select throws_ok($$ insert into daily_results (user_id, day, wpm, accuracy) values ('11111111-1111-1111-1111-111111111111', current_date, 300, 100) $$, '42501', null, 'diario: no se escribe directo en la tabla');

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select throws_ok($$ select submit_daily(current_date - 5, 80, 95) $$, 'P0001', 'día inválido', 'diario: día fuera de rango');
select throws_ok($$ select submit_daily(current_date, 400, 95) $$, 'P0001', 'resultado fuera de rango', 'diario: ppm fuera de rango');
select throws_ok($$ select submit_daily(current_date, 80, -1) $$, 'P0001', 'resultado fuera de rango', 'diario: precisión negativa');
select lives_ok($$ select submit_daily((now() at time zone 'utc')::date, 80, 95) $$, 'diario: primer intento');
select lives_ok($$ select submit_daily((now() at time zone 'utc')::date, 60, 99) $$, 'diario: intento peor');
select results_eq($$ select wpm, accuracy, attempts from daily_results where user_id = auth.uid() $$, $$ values (80::real, 95::real, 2) $$, 'diario: un intento peor no pisa el mejor');
select lives_ok($$ select submit_daily((now() at time zone 'utc')::date, 90, 90) $$, 'diario: intento mejor');
select results_eq($$ select wpm, accuracy, attempts from daily_results where user_id = auth.uid() $$, $$ values (90::real, 90::real, 3) $$, 'diario: un intento mejor actualiza ppm y precisión');

set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select submit_daily((now() at time zone 'utc')::date, 90, 97);
select results_eq($$ select user_id::text from daily_leaderboard where day = (now() at time zone 'utc')::date order by rank $$,
                  $$ values ('22222222-2222-2222-2222-222222222222'), ('11111111-1111-1111-1111-111111111111') $$, 'diario: empate en ppm lo desempata la precisión');

-- ========== perfil público ==========
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select is((public_profile((select username from profiles where id = '11111111-1111-1111-1111-111111111111')) -> 'best_tests' -> 0 ->> 'wpm')::real, 99::real, 'perfil público: mejor test (ignora los de menos de 75% de precisión)');
select is((public_profile((select username from profiles where id = '11111111-1111-1111-1111-111111111111')) ->> 'points')::int, 67 + 72 + 500 + 150 + 1 + 1 + 96, 'perfil público: suma de puntos');
select isnt(public_profile(upper((select username from profiles where id = '11111111-1111-1111-1111-111111111111'))), null, 'perfil público: el usuario no distingue mayúsculas');
select is(public_profile('nadie_existe'), null, 'perfil público: usuario inexistente devuelve null');
select is(public_profile($$x' or '1'='1$$), null, 'perfil público: texto malicioso no devuelve nada');

-- ========== rankings globales ==========
select is((select count(*) from leaderboard('t30', 'all')), 1::bigint, 'ranking: 30 s tiene un jugador (Beto no hizo tests)');
select is((select value from leaderboard('t30', 'all')), 70::real, 'ranking: toma el mejor test con 75% o más');
select is((select count(*) from leaderboard('t15', 'day')), 0::bigint, 'ranking: un test de hace 2 días no cuenta para "hoy"');
select is((select count(*) from leaderboard('t15', 'week')), 1::bigint, 'ranking: sí cuenta para la semana');
select is((select count(*) from leaderboard('t30', 'all', 0)), 1::bigint, 'ranking: límite 0 se trata como 1');
select is((select count(*) from leaderboard(null, 'all')), 0::bigint, 'ranking: tabla nula no devuelve nada');

-- ========== salas online ==========



select * from finish();
rollback;
