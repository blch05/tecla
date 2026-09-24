-- =========================================================
-- tecla* — tienda: moneda propia ("teclas*"), catálogo, inventario y objetos equipados.
-- Solo cosas estéticas. Nunca plata real.
--
-- La moneda se gana SOLO del lado del servidor: un trigger sobre runs acredita al guardarse
-- cada partida, con topes (por partida, por día y un mínimo de tiempo entre partidas).
-- El navegador no puede sumarse monedas: no hay políticas de escritura en estas tablas
-- y todo pasa por funciones security definer.
-- =========================================================

-- el "día" de la tienda es el de Argentina (el servidor está en UTC)
create or replace function public.shop_today()
returns date
language sql
stable
set search_path = ''
as $$ select (now() at time zone 'America/Argentina/Buenos_Aires')::date; $$;

-- ---------- monedero ----------
create table public.wallets (
  user_id uuid primary key references auth.users (id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  day date not null default public.shop_today(),  -- día al que corresponde earned_today
  earned_today integer not null default 0 check (earned_today >= 0),
  last_earn_at timestamptz,
  total_earned integer not null default 0 check (total_earned >= 0),
  updated_at timestamptz not null default now()
);
alter table public.wallets enable row level security;
create policy "cada usuario ve su monedero" on public.wallets for select using (auth.uid() = user_id);

-- movimientos (para mostrar de dónde salieron las monedas)
create table public.coin_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  amount integer not null,
  reason text not null check (char_length(reason) <= 80),
  run_id uuid,
  item_id text,
  created_at timestamptz not null default now()
);
create index coin_log_user_idx on public.coin_log (user_id, created_at desc);
create unique index coin_log_run_once on public.coin_log (run_id) where run_id is not null;
alter table public.coin_log enable row level security;
create policy "cada usuario ve sus movimientos" on public.coin_log for select using (auth.uid() = user_id);

-- ---------- catálogo ----------
create table public.shop_items (
  id text primary key check (id ~ '^[a-z0-9-]{2,40}$'),
  slot text not null check (slot in ('cursor', 'acento', 'marco', 'titulo', 'runner')),
  name text not null check (char_length(name) <= 40),
  price integer not null check (price > 0 and price <= 100000),
  rarity text not null default 'comun' check (rarity in ('comun', 'rara', 'epica')),
  sort integer not null default 0,
  active boolean not null default true
);
alter table public.shop_items enable row level security;
create policy "el catálogo es público" on public.shop_items for select using (true);

insert into public.shop_items (id, slot, name, price, rarity, sort) values
  ('cursor-grueso',     'cursor', 'cursor grueso',        60,  'comun', 10),
  ('cursor-bloque',     'cursor', 'cursor bloque',        90,  'comun', 11),
  ('cursor-subrayado',  'cursor', 'cursor subrayado',     90,  'comun', 12),
  ('cursor-arcoiris',   'cursor', 'cursor arcoíris',      420, 'epica', 13),
  ('acento-atardecer',  'acento', 'acento atardecer',     150, 'rara',  20),
  ('acento-neon',       'acento', 'acento neón',          150, 'rara',  21),
  ('acento-noche',      'acento', 'acento noche',         150, 'rara',  22),
  ('acento-oro',        'acento', 'acento oro',           480, 'epica', 23),
  ('marco-punteado',    'marco',  'marco punteado',       70,  'comun', 30),
  ('marco-doble',       'marco',  'marco doble',          120, 'comun', 31),
  ('marco-neon',        'marco',  'marco neón',           220, 'rara',  32),
  ('marco-arcoiris',    'marco',  'marco arcoíris',       520, 'epica', 33),
  ('titulo-velocista',  'titulo', 'velocista',            80,  'comun', 40),
  ('titulo-cazabichos', 'titulo', 'cazabichos',           80,  'comun', 41),
  ('titulo-lector',     'titulo', 'rata de biblioteca',   80,  'comun', 42),
  ('titulo-leyenda',    'titulo', 'leyenda del teclado',  600, 'epica', 43),
  ('runner-rojo',       'runner', 'corredor rojo',        100, 'comun', 50),
  ('runner-fantasma',   'runner', 'corredor fantasma',    200, 'rara',  51),
  ('runner-dorado',     'runner', 'corredor dorado',      260, 'rara',  52),
  ('runner-arcoiris',   'runner', 'corredor arcoíris',    450, 'epica', 53);

-- ---------- inventario y equipados ----------
create table public.inventory (
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id text not null references public.shop_items (id),
  acquired_at timestamptz not null default now(),
  primary key (user_id, item_id)
);
alter table public.inventory enable row level security;
create policy "cada usuario ve su inventario" on public.inventory for select using (auth.uid() = user_id);

create table public.equipped (
  user_id uuid not null references auth.users (id) on delete cascade,
  slot text not null check (slot in ('cursor', 'acento', 'marco', 'titulo', 'runner')),
  item_id text not null references public.shop_items (id),
  primary key (user_id, slot)
);
alter table public.equipped enable row level security;
create policy "cada usuario ve lo que tiene equipado" on public.equipped for select using (auth.uid() = user_id);

revoke insert, update, delete on public.wallets, public.coin_log, public.shop_items, public.inventory, public.equipped from anon, authenticated;

-- ---------- ganar monedas (solo al guardarse una partida) ----------
-- Cuánto paga una partida. Pura, para poder testearla.
create or replace function public.run_coins(p_kind text, p_finished boolean, p_won boolean, p_wpm real, p_accuracy real, p_score integer, p_points integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when p_kind = 'test' then
      case when coalesce(p_finished, true) and coalesce(p_accuracy, 0) >= 75 then 3 + least(floor(coalesce(p_wpm, 0) / 15)::int, 6) else 0 end
    when p_kind = 'arcade' then
      case when coalesce(p_score, 0) > 0 then 2 + least(floor(coalesce(p_score, 0) / 400.0)::int, 8) else 0 end
    when p_kind = 'comp' then case when p_won then 8 else 3 end
    when p_kind = 'study' then
      case when coalesce(p_points, 0) > 0 then 2 + least(floor(coalesce(p_points, 0) / 10.0)::int, 4) else 0 end
    else 0
  end;
$$;

create or replace function public.credit_run_coins()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  w public.wallets;
  base integer;
  bonus integer := 0;
  cap constant integer := 250;       -- tope por día (sin contar el bonus diario)
  gap constant interval := interval '15 seconds';
  amount integer;
begin
  base := public.run_coins(new.kind, new.finished, new.won, new.wpm, new.accuracy, new.score, new.points);
  -- solo pagan las partidas recién jugadas (no las que se suben días después desde otro dispositivo)
  if base <= 0 or new.created_at < now() - interval '10 minutes' then return new; end if;

  insert into public.wallets (user_id) values (new.user_id) on conflict (user_id) do nothing;
  select * into w from public.wallets where user_id = new.user_id for update;

  if w.day <> public.shop_today() then w.day := public.shop_today(); w.earned_today := 0; end if;
  if w.last_earn_at is not null and w.last_earn_at > now() - gap then return new; end if;
  if w.earned_today = 0 then bonus := 10; end if;  -- bonus por la primera partida del día

  amount := least(base, cap - w.earned_today);
  if amount <= 0 then return new; end if;

  update public.wallets set
    balance = balance + amount + bonus,
    day = w.day,
    earned_today = w.earned_today + amount,
    last_earn_at = now(),
    total_earned = total_earned + amount + bonus,
    updated_at = now()
  where user_id = new.user_id;
  insert into public.coin_log (user_id, amount, reason, run_id) values (new.user_id, amount, 'partida · ' || new.kind, new.id);
  if bonus > 0 then insert into public.coin_log (user_id, amount, reason) values (new.user_id, bonus, 'bonus del día'); end if;
  return new;
end;
$$;

create trigger runs_credit_coins
  after insert on public.runs
  for each row execute function public.credit_run_coins();

-- ---------- estado de la tienda del usuario ----------
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
    'owned', coalesce((select json_agg(item_id) from public.inventory where user_id = auth.uid()), '[]'::json),
    'equipped', coalesce((select json_object_agg(slot, item_id) from public.equipped where user_id = auth.uid()), '{}'::json)
  )
  where auth.uid() is not null;
$$;

-- ---------- comprar ----------
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
  select balance into bal from public.wallets where user_id = me for update;
  if bal < it.price then return json_build_object('ok', false, 'error', 'No te alcanzan las teclas*.', 'balance', bal); end if;

  update public.wallets set balance = balance - it.price, updated_at = now() where user_id = me;
  insert into public.inventory (user_id, item_id) values (me, p_item);
  insert into public.coin_log (user_id, amount, reason, item_id) values (me, -it.price, 'compra · ' || it.name, p_item);
  return json_build_object('ok', true, 'balance', bal - it.price);
end;
$$;

-- ---------- equipar (p_item null = sacar lo de ese lugar) ----------
create or replace function public.equip_item(p_slot text, p_item text)
returns json
language plpgsql
security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then return json_build_object('ok', false, 'error', 'Entrá con tu cuenta.'); end if;
  if p_slot not in ('cursor', 'acento', 'marco', 'titulo', 'runner') then return json_build_object('ok', false, 'error', 'Lugar inválido.'); end if;
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

-- ---------- lo que otros ven de tu perfil (marco y título) ----------
create or replace function public.public_cosmetics(p_username text)
returns json
language sql
stable
security definer set search_path = ''
as $$
  select coalesce(json_object_agg(e.slot, e.item_id), '{}'::json)
  from public.equipped e
  join public.profiles p on p.id = e.user_id
  where p.username = lower(p_username) and e.slot in ('marco', 'titulo');
$$;

revoke all on function public.shop_today() from public;
grant execute on function public.shop_today() to anon, authenticated;
revoke all on function public.run_coins(text, boolean, boolean, real, real, integer, integer) from public;
revoke all on function public.credit_run_coins() from public;
revoke all on function public.shop_state() from public;
revoke all on function public.buy_item(text) from public;
revoke all on function public.equip_item(text, text) from public;
revoke all on function public.public_cosmetics(text) from public;
grant execute on function public.run_coins(text, boolean, boolean, real, real, integer, integer) to anon, authenticated;
grant execute on function public.shop_state() to authenticated;
grant execute on function public.buy_item(text) to authenticated;
grant execute on function public.equip_item(text, text) to authenticated;
grant execute on function public.public_cosmetics(text) to anon, authenticated;
