-- =========================================================
-- tecla* — juegos sociales en las salas (palabra oculta, sopa de letras, pistas, tutti frutti)
-- y la marca de sala "picante" (palabras subidas de tono), visible en la lista de salas.
-- =========================================================

alter table public.rooms drop constraint if exists rooms_game_check;
alter table public.rooms add constraint rooms_game_check
  check (game in ('carrera', 'bombas', 'runner', 'caen', 'torre', 'royale', 'oculta', 'sopa', 'pistas', 'tutti'));

alter table public.rooms add column if not exists spicy boolean not null default false;

-- upsert_room suma p_spicy (con valor por defecto, así los clientes viejos siguen andando)
drop function if exists public.upsert_room(text, text, text, text, boolean, text, integer, text);
create function public.upsert_room(
  p_code text, p_token text, p_game text, p_difficulty text, p_public boolean,
  p_host_name text, p_players integer, p_status text, p_spicy boolean default false
)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if p_token is null or char_length(p_token) < 16 then
    raise exception 'token de sala inválido';
  end if;

  delete from public.rooms where updated_at < now() - interval '1 day';

  insert into public.rooms as r (code, game, difficulty, is_public, host_name, host_token_hash, players, status, spicy)
  values (
    lower(p_code), p_game, p_difficulty, coalesce(p_public, true),
    left(coalesce(nullif(trim(p_host_name), ''), 'anfitrión'), 40),
    md5(p_token), greatest(0, least(coalesce(p_players, 1), 50)), coalesce(p_status, 'lobby'), coalesce(p_spicy, false)
  )
  on conflict (code) do update set
    game = excluded.game,
    difficulty = excluded.difficulty,
    is_public = excluded.is_public,
    host_name = excluded.host_name,
    players = excluded.players,
    status = excluded.status,
    spicy = excluded.spicy,
    host_token_hash = excluded.host_token_hash,
    updated_at = now()
  where r.host_token_hash = excluded.host_token_hash or r.updated_at < now() - interval '2 minutes';
end;
$$;

drop function if exists public.list_rooms();
create function public.list_rooms()
returns table (code text, game text, difficulty text, host_name text, players integer, max_players integer, status text, updated_at timestamptz, spicy boolean)
language sql
stable
security definer set search_path = ''
as $$
  select r.code, r.game, r.difficulty, r.host_name, r.players, r.max_players, r.status, r.updated_at, r.spicy
  from public.rooms r
  where r.is_public and r.updated_at > now() - interval '75 seconds'
  order by (r.status = 'lobby') desc, r.updated_at desc
  limit 40;
$$;

revoke all on function public.upsert_room(text, text, text, text, boolean, text, integer, text, boolean) from public;
revoke all on function public.list_rooms() from public;
grant execute on function public.upsert_room(text, text, text, text, boolean, text, integer, text, boolean) to anon, authenticated;
grant execute on function public.list_rooms() to anon, authenticated;
