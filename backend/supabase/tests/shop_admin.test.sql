-- =========================================================
-- tecla* — tienda: escenas y administradores (pgTAP). Se corren con:  npx supabase test db
-- =========================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(12);

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'admin@test.com', '{"name":"Admin"}', 'authenticated', 'authenticated'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'comun@test.com', '{"name":"Comun"}', 'authenticated', 'authenticated');
insert into admins (user_id) values ('aaaaaaaa-0000-0000-0000-000000000001');

-- ========== el catálogo trae escenas ==========
select ok((select count(*) >= 9 from shop_items where slot = 'escena' and active), 'escenas: están en el catálogo');

-- ========== un usuario común ==========
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}';

select is(is_admin(), false, 'común: no es administrador');
select is((shop_state()->>'admin')::boolean, false, 'común: el estado no lo marca como admin');
select is((select (buy_item('escena-espadachin')->>'ok')::boolean), false, 'común: sin teclas* no puede comprar el espadachín');
select is((select (equip_item('escena', 'escena-espadachin')->>'ok')::boolean), false, 'común: no puede equipar lo que no tiene');
select throws_ok($$ select * from admins $$, '42501', null, 'común: no puede leer la tabla de administradores');
select throws_ok($$ insert into admins (user_id) values ('aaaaaaaa-0000-0000-0000-000000000002') $$, '42501', null, 'común: no puede hacerse administrador');

-- ========== un administrador ==========
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';

select is(is_admin(), true, 'admin: es administrador');
select is(json_array_length(shop_state()->'owned'), (select count(*)::int from shop_items where active), 'admin: tiene todo el catálogo');
select is((select (buy_item('escena-mago')->>'ok')::boolean), true, 'admin: compra sin teclas*');
select is((select (equip_item('escena', 'escena-espadachin-sombra')->>'ok')::boolean), true, 'admin: puede equipar cualquier escena');
select is((select (equip_item('escena', 'cursor-grueso')->>'ok')::boolean), false, 'admin: igual respeta el lugar de cada objeto');

select * from finish();
rollback;
