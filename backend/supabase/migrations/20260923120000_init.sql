-- =========================================================
-- tecla* — esquema inicial
-- perfiles, historial de actividad y ranking del desafío diario
-- =========================================================

-- ---------- perfiles ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) between 1 and 40),
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "los perfiles son públicos"
  on public.profiles for select using (true);

create policy "cada usuario edita su perfil"
  on public.profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);

-- crea el perfil automáticamente al registrarse (Google o email)
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)), 40),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- historial (tests, arcade, competir, estudio) ----------
create table public.runs (
  id uuid primary key,                        -- lo genera el cliente: permite reintentar sin duplicar
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('test', 'arcade', 'comp', 'study')),
  mode text check (char_length(mode) <= 80),
  game text check (char_length(game) <= 40),
  difficulty text check (difficulty in ('facil', 'medio', 'dificil')),
  score integer check (score >= 0),
  wpm real check (wpm between 0 and 350),
  accuracy real check (accuracy between 0 and 100),
  points integer not null default 0 check (points between 0 and 1000000),
  detail text check (char_length(detail) <= 300),
  finished boolean not null default true,
  won boolean,
  created_at timestamptz not null default now()
);

create index runs_user_created_idx on public.runs (user_id, created_at desc);

alter table public.runs enable row level security;

create policy "cada usuario ve su historial"
  on public.runs for select using (auth.uid() = user_id);

create policy "cada usuario guarda su historial"
  on public.runs for insert with check (auth.uid() = user_id);

-- ---------- ranking del desafío diario ----------
create table public.daily_results (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  wpm real not null check (wpm between 0 and 350),
  accuracy real not null check (accuracy between 0 and 100),
  attempts integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.daily_results enable row level security;

create policy "el ranking es público"
  on public.daily_results for select using (true);
-- no hay policies de insert/update: solo se escribe a través de submit_daily()

-- guarda el mejor resultado del día de cada usuario
create function public.submit_daily(p_day date, p_wpm real, p_accuracy real)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  today date := (now() at time zone 'utc')::date;
begin
  if auth.uid() is null then
    raise exception 'hay que iniciar sesión';
  end if;
  if p_day not between today - 1 and today + 1 then
    raise exception 'día inválido';
  end if;
  if p_wpm not between 0 and 350 or p_accuracy not between 0 and 100 then
    raise exception 'resultado fuera de rango';
  end if;

  insert into public.daily_results (user_id, day, wpm, accuracy)
  values (auth.uid(), p_day, p_wpm, p_accuracy)
  on conflict (user_id, day) do update set
    accuracy = case when excluded.wpm > public.daily_results.wpm then excluded.accuracy else public.daily_results.accuracy end,
    wpm = greatest(public.daily_results.wpm, excluded.wpm),
    attempts = public.daily_results.attempts + 1,
    updated_at = now();
end;
$$;

revoke all on function public.submit_daily(date, real, real) from public, anon;
grant execute on function public.submit_daily(date, real, real) to authenticated;

create view public.daily_leaderboard
with (security_invoker = true) as
select
  d.day,
  d.user_id,
  p.display_name,
  p.avatar_url,
  d.wpm,
  d.accuracy,
  rank() over (partition by d.day order by d.wpm desc, d.accuracy desc) as rank
from public.daily_results d
left join public.profiles p on p.id = d.user_id;

grant select on public.daily_leaderboard to anon, authenticated;
