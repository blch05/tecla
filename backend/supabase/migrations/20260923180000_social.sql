-- =========================================================
-- tecla* — social: nombres de usuario, perfiles públicos y rankings globales
-- =========================================================

-- ---------- nombre de usuario único (para /u/<usuario>) ----------
alter table public.profiles add column username text;

-- genera un usuario a partir de un texto: minúsculas, sin tildes ni símbolos, con sufijo aleatorio
create or replace function public.make_username(base text)
returns text
language sql
volatile
set search_path = ''
as $$
  select left(
           coalesce(nullif(regexp_replace(lower(translate(coalesce(base, ''), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunaeiouun')), '[^a-z0-9_]', '', 'g'), ''), 'jugador'),
           14
         ) || '_' || substr(md5(random()::text), 1, 4);
$$;

update public.profiles p
set username = public.make_username(coalesce(p.display_name, (select split_part(u.email, '@', 1) from auth.users u where u.id = p.id)))
where username is null;

alter table public.profiles
  alter column username set not null,
  add constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,20}$');

create unique index profiles_username_key on public.profiles (username);

-- el alta de usuarios ahora también elige un nombre de usuario
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  shown text := left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)), 40);
begin
  insert into public.profiles (id, display_name, avatar_url, username)
  values (new.id, shown, new.raw_user_meta_data ->> 'avatar_url', public.make_username(split_part(new.email, '@', 1)));
  return new;
end;
$$;

-- ---------- clave del modo de test (t15, t30-dificil, w25…) para los rankings ----------
alter table public.runs
  add column mode_key text check (mode_key ~ '^[a-z0-9-]{1,24}$');

create index runs_mode_key_idx on public.runs (mode_key, wpm desc) where kind = 'test';

-- ---------- perfil público: solo datos agregados, nunca el historial completo ----------
create or replace function public.public_profile(p_username text)
returns json
language sql
stable
security definer set search_path = ''
as $$
  select json_build_object(
    'username', p.username,
    'display_name', p.display_name,
    'avatar_url', p.avatar_url,
    'created_at', p.created_at,
    'points', coalesce((select sum(r.points) from public.runs r where r.user_id = p.id), 0),
    'tests', (select count(*) from public.runs r where r.user_id = p.id and r.kind = 'test'),
    'arcade_games', (select count(*) from public.runs r where r.user_id = p.id and r.kind = 'arcade'),
    'comp_games', (select count(*) from public.runs r where r.user_id = p.id and r.kind = 'comp'),
    'wins', (select count(*) from public.runs r where r.user_id = p.id and r.kind = 'comp' and r.won),
    'best_tests', coalesce((
      select json_agg(x order by x.wpm desc)
      from (
        select r.mode_key, max(r.wpm) as wpm, (array_agg(r.accuracy order by r.wpm desc))[1] as accuracy
        from public.runs r
        where r.user_id = p.id and r.kind = 'test' and r.mode_key is not null and r.accuracy >= 75
        group by r.mode_key
      ) x
    ), '[]'::json),
    'best_arcade', coalesce((
      select json_agg(x)
      from (
        select r.game, r.difficulty, max(r.score) as score
        from public.runs r
        where r.user_id = p.id and r.kind = 'arcade' and r.game is not null
        group by r.game, r.difficulty
      ) x
    ), '[]'::json),
    'recent', coalesce((
      select json_agg(x)
      from (
        select r.kind, r.mode, r.game, r.difficulty, r.wpm, r.accuracy, r.score, r.points, r.won, r.created_at
        from public.runs r
        where r.user_id = p.id
        order by r.created_at desc
        limit 8
      ) x
    ), '[]'::json)
  )
  from public.profiles p
  where p.username = lower(p_username);
$$;

grant execute on function public.public_profile(text) to anon, authenticated;

-- ---------- rankings globales ----------
-- p_board: 'points' o una clave de modo de test ('t15', 't30', 't60', 'w25'…)
-- p_period: 'day' | 'week' | 'all'
create or replace function public.leaderboard(p_board text, p_period text default 'all', p_limit integer default 50)
returns table (rank bigint, username text, display_name text, avatar_url text, value real, accuracy real, runs bigint)
language sql
stable
security definer set search_path = ''
as $$
  with span as (
    select case p_period
             when 'day' then now() - interval '1 day'
             when 'week' then now() - interval '7 days'
             else '-infinity'::timestamptz
           end as since
  ),
  base as (
    select
      r.user_id,
      case when p_board = 'points' then sum(r.points)::real else max(r.wpm) end as value,
      case when p_board = 'points' then null else (array_agg(r.accuracy order by r.wpm desc))[1] end as accuracy,
      count(*) as runs
    from public.runs r, span
    where r.created_at >= span.since
      and case when p_board = 'points' then true
               else r.kind = 'test' and r.mode_key = p_board and r.accuracy >= 75 end
    group by r.user_id
  )
  select
    rank() over (order by b.value desc, b.accuracy desc nulls last),
    p.username, p.display_name, p.avatar_url, b.value, b.accuracy, b.runs
  from base b
  join public.profiles p on p.id = b.user_id
  order by 1, p.username
  limit least(greatest(p_limit, 1), 100);
$$;

grant execute on function public.leaderboard(text, text, integer) to anon, authenticated;
