-- Tienda, tercera tanda: escenas para el test (lo que se ve detrás mientras tipeás)
-- y administradores (tienen todo lo de la tienda sin pagar, para probar).

-- ---------- nuevo lugar: escena ----------
alter table public.shop_items drop constraint if exists shop_items_slot_check;
alter table public.shop_items add constraint shop_items_slot_check check (slot in
  ('cursor', 'acento', 'marco', 'titulo', 'runner', 'festejo', 'sonido', 'fuente', 'fondo', 'avatar', 'insignia', 'efecto', 'escena'));
alter table public.equipped drop constraint if exists equipped_slot_check;
alter table public.equipped add constraint equipped_slot_check check (slot in
  ('cursor', 'acento', 'marco', 'titulo', 'runner', 'festejo', 'sonido', 'fuente', 'fondo', 'avatar', 'insignia', 'efecto', 'escena'));

-- el paisaje es la escena gratis (no es un objeto); estas se compran
insert into public.shop_items (id, slot, name, price, rarity, sort) values
  ('escena-jardin',           'escena', 'jardín',                 160, 'comun', 130),
  ('escena-acuario',          'escena', 'acuario',                160, 'comun', 131),
  ('escena-gato',             'escena', 'gatito que teje',        180, 'comun', 132),
  ('escena-robot',            'escena', 'robot que alienta',      200, 'comun', 133),
  ('escena-tren',             'escena', 'tren nocturno',          280, 'rara',  134),
  ('escena-fantasma',         'escena', 'vos contra tu fantasma', 280, 'rara',  135),
  ('escena-mago',             'escena', 'mago de runas',          340, 'rara',  136),
  ('escena-nave',             'escena', 'nave arcade',            360, 'rara',  137),
  ('escena-espadachin',       'escena', 'espadachín',             700, 'epica', 138),
  ('escena-espadachin-sombra','escena', 'espadachín de sombra',   950, 'epica', 139)
on conflict (id) do nothing;

-- ---------- administradores ----------
-- Se agregan a mano desde el panel de Supabase (SQL Editor); nadie puede leer ni escribir esta tabla desde la app.
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

-- solo responde por el usuario que pregunta (no se puede averiguar si otro es administrador)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = ''
as $$ select auth.uid() is not null and exists (select 1 from public.admins where user_id = auth.uid()); $$;

-- ---------- estado: un administrador tiene todo ----------
create or replace function public.shop_state()
returns json
language sql
stable
security definer set search_path = ''
as $$
  select json_build_object(
    'balance', coalesce((select balance from public.wallets where user_id = auth.uid()), 0),
    'earned_today', coalesce((select case when day = public.shop_today() then earned_today else 0 end from public.wallets where user_id = auth.uid()), 0),
    'cap', 250,
    'admin', public.is_admin(),
    'owned', case when public.is_admin()
      then coalesce((select json_agg(id) from public.shop_items where active), '[]'::json)
      else coalesce((select json_agg(item_id) from public.inventory where user_id = auth.uid()), '[]'::json) end,
    'equipped', coalesce((select json_object_agg(slot, item_id) from public.equipped where user_id = auth.uid()), '{}'::json)
  )
  where auth.uid() is not null;
$$;

-- ---------- comprar: gratis para un administrador ----------
create or replace function public.buy_item(p_item text)
returns json
language plpgsql
security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
  it public.shop_items;
  bal integer;
begin
  if me is null then return json_build_object('ok', false, 'error', 'Entrá con tu cuenta para comprar.'); end if;
  select * into it from public.shop_items where id = p_item and active;
  if not found then return json_build_object('ok', false, 'error', 'Ese objeto no existe.'); end if;
  if exists (select 1 from public.inventory where user_id = me and item_id = p_item) then
    return json_build_object('ok', false, 'error', 'Ya lo tenés.');
  end if;

  insert into public.wallets (user_id) values (me) on conflict (user_id) do nothing;
  if public.is_admin() then
    insert into public.inventory (user_id, item_id) values (me, p_item);
    return json_build_object('ok', true, 'balance', (select balance from public.wallets where user_id = me));
  end if;

  select balance into bal from public.wallets where user_id = me for update;
  if bal < it.price then return json_build_object('ok', false, 'error', 'No te alcanzan las teclas*.', 'balance', bal); end if;

  update public.wallets set balance = balance - it.price, updated_at = now() where user_id = me;
  insert into public.inventory (user_id, item_id) values (me, p_item);
  insert into public.coin_log (user_id, amount, reason, item_id) values (me, -it.price, 'compra · ' || it.name, p_item);
  return json_build_object('ok', true, 'balance', bal - it.price);
end;
$$;

-- ---------- equipar: acepta escenas; un administrador puede equipar cualquier objeto ----------
create or replace function public.equip_item(p_slot text, p_item text)
returns json
language plpgsql
security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then return json_build_object('ok', false, 'error', 'Entrá con tu cuenta.'); end if;
  if p_slot not in ('cursor', 'acento', 'marco', 'titulo', 'runner', 'festejo', 'sonido', 'fuente', 'fondo', 'avatar', 'insignia', 'efecto', 'escena') then
    return json_build_object('ok', false, 'error', 'Lugar inválido.');
  end if;
  if p_item is null then
    delete from public.equipped where user_id = me and slot = p_slot;
    return json_build_object('ok', true);
  end if;
  if public.is_admin() then
    if not exists (select 1 from public.shop_items where id = p_item and slot = p_slot and active) then
      return json_build_object('ok', false, 'error', 'Ese objeto no existe.');
    end if;
  elsif not exists (select 1 from public.inventory i join public.shop_items s on s.id = i.item_id
                    where i.user_id = me and i.item_id = p_item and s.slot = p_slot) then
    return json_build_object('ok', false, 'error', 'No tenés ese objeto.');
  end if;
  insert into public.equipped (user_id, slot, item_id) values (me, p_slot, p_item)
  on conflict (user_id, slot) do update set item_id = excluded.item_id;
  return json_build_object('ok', true);
end;
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.shop_state() from public;
revoke all on function public.buy_item(text) from public;
revoke all on function public.equip_item(text, text) from public;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.shop_state() to authenticated;
grant execute on function public.buy_item(text) to authenticated;
grant execute on function public.equip_item(text, text) to authenticated;
