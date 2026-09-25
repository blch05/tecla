-- Tienda, segunda tanda: festejos, sonidos de teclado, tipografías, fondos, avatares, insignias,
-- efectos del arcade y más colores. Sigue siendo todo estético y se paga solo con teclas*.

-- ---------- nuevos lugares donde equipar ----------
alter table public.shop_items drop constraint if exists shop_items_slot_check;
alter table public.shop_items add constraint shop_items_slot_check check (slot in
  ('cursor', 'acento', 'marco', 'titulo', 'runner', 'festejo', 'sonido', 'fuente', 'fondo', 'avatar', 'insignia', 'efecto'));
alter table public.equipped drop constraint if exists equipped_slot_check;
alter table public.equipped add constraint equipped_slot_check check (slot in
  ('cursor', 'acento', 'marco', 'titulo', 'runner', 'festejo', 'sonido', 'fuente', 'fondo', 'avatar', 'insignia', 'efecto'));

insert into public.shop_items (id, slot, name, price, rarity, sort) values
  ('acento-sakura',       'acento',   'acento sakura',          160, 'rara',  24),
  ('acento-oceano',       'acento',   'acento océano',          160, 'rara',  25),
  ('acento-lava',         'acento',   'acento lava',            160, 'rara',  26),
  ('acento-bosque',       'acento',   'acento bosque',          160, 'rara',  27),
  ('acento-uva',          'acento',   'acento uva',             160, 'rara',  28),
  ('festejo-confeti',     'festejo',  'confeti',                120, 'comun', 60),
  ('festejo-asteriscos',  'festejo',  'lluvia de asteriscos',   220, 'rara',  61),
  ('festejo-estrellas',   'festejo',  'estrellas fugaces',      240, 'rara',  62),
  ('festejo-fuegos',      'festejo',  'fuegos artificiales',    480, 'epica', 63),
  ('sonido-cremoso',      'sonido',   'teclado cremoso',        150, 'comun', 70),
  ('sonido-azul',         'sonido',   'teclado azul',           150, 'comun', 71),
  ('sonido-burbujas',     'sonido',   'burbujas',               240, 'rara',  72),
  ('sonido-retro',        'sonido',   'consola retro',          240, 'rara',  73),
  ('sonido-antigua',      'sonido',   'máquina antigua',        500, 'epica', 74),
  ('fuente-jetbrains',    'fuente',   'JetBrains Mono',         100, 'comun', 80),
  ('fuente-fira',         'fuente',   'Fira Code',              100, 'comun', 81),
  ('fuente-space',        'fuente',   'Space Mono',             120, 'comun', 82),
  ('fuente-courier',      'fuente',   'Courier Prime',          180, 'rara',  83),
  ('fuente-vt323',        'fuente',   'VT323 (pantalla vieja)', 400, 'epica', 84),
  ('fondo-nieve',         'fondo',    'nieve',                  200, 'rara',  90),
  ('fondo-estrellas',     'fondo',    'cielo estrellado',       200, 'rara',  91),
  ('fondo-burbujas',      'fondo',    'burbujas',               220, 'rara',  92),
  ('fondo-luciernagas',   'fondo',    'luciérnagas',            520, 'epica', 93),
  ('avatar-pixel',        'avatar',   'avatar pixel art',       120, 'comun', 100),
  ('avatar-formas',       'avatar',   'avatar de formas',       100, 'comun', 101),
  ('avatar-pulgar',       'avatar',   'avatar pulgar',          120, 'comun', 102),
  ('avatar-lorelei',      'avatar',   'avatar dibujado',        240, 'rara',  103),
  ('avatar-robot',        'avatar',   'avatar robot',           240, 'rara',  104),
  ('insignia-estrella',   'insignia', 'insignia estrella',      150, 'comun', 110),
  ('insignia-rayo',       'insignia', 'insignia rayo',          260, 'rara',  111),
  ('insignia-corazon',    'insignia', 'insignia corazón',       260, 'rara',  112),
  ('insignia-corona',     'insignia', 'insignia corona',        600, 'epica', 113),
  ('efecto-chispas',      'efecto',   'chispas',                250, 'rara',  120),
  ('efecto-neon',         'efecto',   'anillos de neón',        300, 'rara',  121),
  ('efecto-pixeles',      'efecto',   'pixeles',                250, 'rara',  122),
  ('efecto-supernova',    'efecto',   'supernova',              650, 'epica', 123)
on conflict (id) do nothing;

-- ---------- equipar: acepta los lugares nuevos ----------
create or replace function public.equip_item(p_slot text, p_item text)
returns json
language plpgsql
security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then return json_build_object('ok', false, 'error', 'Entrá con tu cuenta.'); end if;
  if p_slot not in ('cursor', 'acento', 'marco', 'titulo', 'runner', 'festejo', 'sonido', 'fuente', 'fondo', 'avatar', 'insignia', 'efecto') then
    return json_build_object('ok', false, 'error', 'Lugar inválido.');
  end if;
  if p_item is null then
    delete from public.equipped where user_id = me and slot = p_slot;
    return json_build_object('ok', true);
  end if;
  if not exists (select 1 from public.inventory i join public.shop_items s on s.id = i.item_id
                 where i.user_id = me and i.item_id = p_item and s.slot = p_slot) then
    return json_build_object('ok', false, 'error', 'No tenés ese objeto.');
  end if;
  insert into public.equipped (user_id, slot, item_id) values (me, p_slot, p_item)
  on conflict (user_id, slot) do update set item_id = excluded.item_id;
  return json_build_object('ok', true);
end;
$$;

-- ---------- lo que otros ven de tu perfil: ahora también avatar e insignia ----------
create or replace function public.public_cosmetics(p_username text)
returns json
language sql
stable
security definer set search_path = ''
as $$
  select coalesce(json_object_agg(e.slot, e.item_id), '{}'::json)
  from public.equipped e
  join public.profiles p on p.id = e.user_id
  where p.username = lower(p_username) and e.slot in ('marco', 'titulo', 'avatar', 'insignia');
$$;

revoke all on function public.equip_item(text, text) from public;
revoke all on function public.public_cosmetics(text) from public;
grant execute on function public.equip_item(text, text) to authenticated;
grant execute on function public.public_cosmetics(text) to anon, authenticated;
