-- =========================================================
-- tecla* — refuerzos de seguridad encontrados en la revisión
-- =========================================================

-- 1) Fechas de partidas: el navegador manda created_at (sirve para subir partidas
--    jugadas sin conexión), pero una fecha futura quedaba para siempre en el ranking
--    de "hoy". Se acota a [ahora - 30 días, ahora].
create or replace function public.clamp_run_created_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_at := least(greatest(coalesce(new.created_at, now()), now() - interval '30 days'), now());
  return new;
end;
$$;

create trigger runs_clamp_created_at
  before insert on public.runs
  for each row execute function public.clamp_run_created_at();

-- 2) Perfiles: cada usuario solo puede cambiar nombre, usuario y avatar
--    (antes podía tocar cualquier columna de su fila, por ejemplo created_at).
revoke update on public.profiles from anon, authenticated;
grant update (display_name, username, avatar_url) on public.profiles to authenticated;

alter table public.profiles
  add constraint profiles_avatar_url_format check (avatar_url is null or (avatar_url ~ '^https://' and char_length(avatar_url) <= 500)) not valid;

-- el alta ignora avatares que no sean https (así la restricción nunca bloquea un registro)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  shown text := left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)), 40);
  avatar text := new.raw_user_meta_data ->> 'avatar_url';
begin
  if avatar is not null and (avatar !~ '^https://' or char_length(avatar) > 500) then avatar := null; end if;
  insert into public.profiles (id, display_name, avatar_url, username)
  values (new.id, coalesce(nullif(shown, ''), 'jugador'), avatar, public.make_username(split_part(new.email, '@', 1)));
  return new;
end;
$$;

-- 3) Historial: nadie modifica ni borra partidas ya guardadas desde el cliente
--    (no hay policies de update/delete; esto lo deja explícito también a nivel de permisos).
revoke update, delete on public.runs from anon, authenticated;
revoke insert, update, delete on public.daily_results from anon, authenticated;
