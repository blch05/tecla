-- =========================================================
-- tecla* — salas online (carreras, arcade multijugador, battle royale)
-- La partida en sí va por Supabase Realtime; esta tabla solo sirve para
-- listar las salas públicas abiertas. Las privadas nunca aparecen en la lista:
-- se entra solo con el link o el código.
-- =========================================================

create table public.rooms (
  code text primary key check (code ~ '^[a-z0-9]{3,8}$'),
  game text not null check (game in ('carrera', 'bombas', 'runner', 'caen', 'torre', 'royale')),
  difficulty text check (difficulty in ('facil', 'medio', 'dificil')),
  is_public boolean not null default true,
  host_name text not null default 'anfitrión' check (char_length(host_name) <= 40),
  host_token_hash text not null,          -- solo quien tiene el token de la sala puede actualizarla
  players integer not null default 1 check (players between 0 and 50),
  max_players integer not null default 8 check (max_players between 2 and 50),
  status text not null default 'lobby' check (status in ('lobby', 'playing')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index rooms_public_active_idx on public.rooms (updated_at desc) where is_public;

alter table public.rooms enable row level security;
-- sin policies: nadie lee ni escribe la tabla directo, todo pasa por las funciones de abajo

-- el anfitrión publica y actualiza su sala (la llama cada ~20 s mientras la sala está abierta)
create or replace function public.upsert_room(
  p_code text, p_token text, p_game text, p_difficulty text, p_public boolean,
  p_host_name text, p_players integer, p_status text
)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if p_token is null or char_length(p_token) < 16 then
    raise exception 'token de sala inválido';
  end if;

  -- limpieza: salas abandonadas
  delete from public.rooms where updated_at < now() - interval '1 day';

  insert into public.rooms as r (code, game, difficulty, is_public, host_name, host_token_hash, players, status)
  values (
    lower(p_code), p_game, p_difficulty, coalesce(p_public, true),
    left(coalesce(nullif(trim(p_host_name), ''), 'anfitrión'), 40),
    md5(p_token), greatest(0, least(coalesce(p_players, 1), 50)), coalesce(p_status, 'lobby')
  )
  on conflict (code) do update set
    game = excluded.game,
    difficulty = excluded.difficulty,
    is_public = excluded.is_public,
    host_name = excluded.host_name,
    players = excluded.players,
    status = excluded.status,
    host_token_hash = excluded.host_token_hash,
    updated_at = now()
  -- solo el dueño del token, o cualquiera si la sala quedó abandonada
  where r.host_token_hash = excluded.host_token_hash or r.updated_at < now() - interval '2 minutes';
end;
$$;

create or replace function public.close_room(p_code text, p_token text)
returns void
language sql
security definer set search_path = ''
as $$
  delete from public.rooms where code = lower(p_code) and host_token_hash = md5(p_token);
$$;

-- salas públicas con actividad en el último minuto y cuarto
create or replace function public.list_rooms()
returns table (code text, game text, difficulty text, host_name text, players integer, max_players integer, status text, updated_at timestamptz)
language sql
stable
security definer set search_path = ''
as $$
  select r.code, r.game, r.difficulty, r.host_name, r.players, r.max_players, r.status, r.updated_at
  from public.rooms r
  where r.is_public and r.updated_at > now() - interval '75 seconds'
  order by (r.status = 'lobby') desc, r.updated_at desc
  limit 40;
$$;

revoke all on function public.upsert_room(text, text, text, text, boolean, text, integer, text) from public;
revoke all on function public.close_room(text, text) from public;
revoke all on function public.list_rooms() from public;
grant execute on function public.upsert_room(text, text, text, text, boolean, text, integer, text) to anon, authenticated;
grant execute on function public.close_room(text, text) to anon, authenticated;
grant execute on function public.list_rooms() to anon, authenticated;

-- para entrar con código (también a salas privadas): devuelve solo el juego de la sala
create or replace function public.find_room(p_code text)
returns text
language sql
stable
security definer set search_path = ''
as $$
  select r.game from public.rooms r
  where r.code = lower(p_code) and r.updated_at > now() - interval '10 minutes';
$$;

revoke all on function public.find_room(text) from public;
grant execute on function public.find_room(text) to anon, authenticated;
