-- =========================================================
-- tecla* — tests de salas online (pgTAP)
-- =========================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(16);

set local role anon;

select throws_ok($$ select upsert_room('abc12', null, 'torre', 'medio', true, 'Ana', 2, 'lobby') $$, 'P0001', 'token de sala inválido', 'token nulo se rechaza');
select throws_ok($$ select upsert_room('ab', repeat('t', 20), 'torre', 'medio', true, 'Ana', 2, 'lobby') $$, '23514', null, 'código de 2 letras se rechaza');
select throws_ok($$ select upsert_room('abc12', repeat('t', 20), 'ajedrez', 'medio', true, 'Ana', 2, 'lobby') $$, '23514', null, 'juego inexistente se rechaza');
select throws_ok($$ select upsert_room('abc12', repeat('t', 20), 'torre', 'imposible', true, 'Ana', 2, 'lobby') $$, '23514', null, 'dificultad inexistente se rechaza');
select throws_ok($$ select upsert_room('abc12', repeat('t', 20), 'torre', 'medio', true, 'Ana', 2, 'cerrada') $$, '23514', null, 'estado inexistente se rechaza');

select lives_ok($$ select upsert_room('ABC12', repeat('a', 20), 'torre', 'medio', true, '   ', 999, 'lobby') $$, 'sala pública válida (código en mayúsculas)');
select results_eq($$ select code, host_name, players from list_rooms() where code = 'abc12' $$, $$ values ('abc12', 'anfitrión', 50) $$,
                  'se guarda en minúsculas, nombre vacío → "anfitrión" y jugadores acotados a 50');
select lives_ok($$ select upsert_room('priv1', repeat('b', 20), 'carrera', null, false, 'Beto', 1, 'lobby') $$, 'sala privada válida');
select is_empty($$ select 1 from list_rooms() where code = 'priv1' $$, 'las privadas no aparecen en la lista');
select is(find_room('PRIV1'), 'carrera', 'pero se encuentran con el código (sin importar mayúsculas)');
select is(find_room('nohay'), null, 'código inexistente devuelve null');
select is_empty($$ select * from rooms $$, 'la tabla no se puede leer directo');

-- alguien sin el token no puede pisar una sala activa
select upsert_room('abc12', repeat('z', 20), 'bombas', 'facil', true, 'Intruso', 1, 'lobby');
select results_eq($$ select host_name from list_rooms() where code = 'abc12' $$, $$ values ('anfitrión') $$, 'otro token no pisa una sala activa');

-- cerrar con token equivocado no hace nada; con el correcto la borra
select close_room('abc12', repeat('z', 20));
select isnt(find_room('abc12'), null, 'cerrar con token equivocado no borra');
select close_room('abc12', repeat('a', 20));
select is(find_room('abc12'), null, 'cerrar con el token correcto la borra');

-- una sala abandonada (más de 2 min sin actividad) la puede tomar otro, y deja de listarse a los 75 s
reset role;
update rooms set updated_at = now() - interval '3 minutes' where code = 'priv1';
set local role anon;
select upsert_room('priv1', repeat('c', 20), 'torre', 'dificil', true, 'Nuevo', 3, 'lobby');
select results_eq($$ select host_name, game from list_rooms() where code = 'priv1' $$, $$ values ('Nuevo', 'torre') $$, 'una sala abandonada la puede heredar otro anfitrión');

select * from finish();
rollback;
