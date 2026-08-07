-- ═══════════════════════════════════════════════════════════════════════
-- AnimaFilm — 02. Endurecimiento de seguridad
-- Ejecutar en Supabase → SQL Editor → New query
-- Es seguro correrlo sobre la base de datos que ya tienes.
-- ═══════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────
-- 1. TRIGGER DE PERFIL: search_path fijo + antichoque de usernames
--
--    Dos problemas del trigger original:
--    a) Sin `set search_path`, una función SECURITY DEFINER es vulnerable
--       a search_path hijacking: alguien crea un esquema propio con una
--       tabla `profiles` falsa y la función escribe ahí con permisos de
--       superusuario. Supabase lo marca en su Security Advisor.
--    b) Si el username ya existía, el INSERT fallaba y con él TODO el
--       registro del usuario. Un atacante podía bloquear registros
--       ocupando nombres previsibles.
-- ───────────────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_name  text;
  final_name text;
  n          int := 0;
begin
  base_name := lower(coalesce(
    nullif(trim(new.raw_user_meta_data->>'username'), ''),
    split_part(coalesce(new.email, ''), '@', 1),
    ''
  ));
  base_name := regexp_replace(base_name, '[^a-z0-9_.-]', '', 'g');

  if base_name is null or length(base_name) < 3 then
    base_name := 'usuario' || substr(replace(new.id::text, '-', ''), 1, 6);
  end if;
  base_name := left(base_name, 20);

  final_name := base_name;
  while exists (select 1 from public.profiles where username = final_name) loop
    n := n + 1;
    final_name := left(base_name, greatest(1, 20 - length(n::text))) || n::text;
    exit when n > 200;
  end loop;

  -- Último recurso: nombre derivado del uuid, imposible que choque
  if exists (select 1 from public.profiles where username = final_name) then
    final_name := 'u' || substr(replace(new.id::text, '-', ''), 1, 19);
  end if;

  insert into public.profiles (id, username, display_name)
  values (new.id, final_name, final_name);

  return new;

exception when others then
  -- Si algo sale mal, dejamos constancia pero NO bloqueamos el alta.
  raise warning 'handle_new_user fallo para %: % (%)', new.id, sqlerrm, sqlstate;
  begin
    insert into public.profiles (id, username, display_name)
    values (new.id,
            'u' || substr(replace(new.id::text, '-', ''), 1, 19),
            'Usuario');
  exception when others then
    null;   -- ni siquiera esto puede impedir el registro
  end;
  return new;
end;
$$;

-- Asegura que el trigger sigue enganchado
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- Lo mismo para la función de updated_at
create or replace function public.update_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ───────────────────────────────────────────────────────────────────────
-- 2. POLÍTICAS RLS EXPLÍCITAS
--
--    `FOR ALL USING (...)` funciona porque Postgres reutiliza USING como
--    WITH CHECK cuando este se omite. Pero depender de un comportamiento
--    implícito es frágil: basta que alguien edite la política más adelante
--    para abrir un agujero. Las dejamos escritas del todo.
-- ───────────────────────────────────────────────────────────────────────

-- PROFILES
drop policy if exists "Perfiles: visibles para todos"              on public.profiles;
drop policy if exists "Perfiles: solo el propietario puede actualizar" on public.profiles;

create policy "profiles_select_all" on public.profiles
  for select using (true);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Nadie borra perfiles desde el cliente (se hace en cascada al borrar
-- la cuenta en auth.users). Sin política de DELETE = DELETE denegado.

-- RATINGS
drop policy if exists "Ratings: visibles para todos" on public.ratings;
drop policy if exists "Ratings: solo el propietario" on public.ratings;

create policy "ratings_select_all" on public.ratings for select using (true);
create policy "ratings_insert_own" on public.ratings for insert with check (auth.uid() = user_id);
create policy "ratings_update_own" on public.ratings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "ratings_delete_own" on public.ratings for delete using (auth.uid() = user_id);

-- REVIEWS
drop policy if exists "Reseñas: visibles para todos" on public.reviews;
drop policy if exists "Reseñas: solo el propietario" on public.reviews;

create policy "reviews_select_all" on public.reviews for select using (true);
create policy "reviews_insert_own" on public.reviews for insert with check (auth.uid() = user_id);
create policy "reviews_update_own" on public.reviews for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "reviews_delete_own" on public.reviews for delete using (auth.uid() = user_id);

-- WATCHED
drop policy if exists "Watched: visible para todos" on public.watched;
drop policy if exists "Watched: solo el propietario" on public.watched;

create policy "watched_select_all" on public.watched for select using (true);
create policy "watched_insert_own" on public.watched for insert with check (auth.uid() = user_id);
create policy "watched_delete_own" on public.watched for delete using (auth.uid() = user_id);

-- WATCHLIST
drop policy if exists "Watchlist: visible para todos" on public.watchlist;
drop policy if exists "Watchlist: solo el propietario" on public.watchlist;

create policy "watchlist_select_all" on public.watchlist for select using (true);
create policy "watchlist_insert_own" on public.watchlist for insert with check (auth.uid() = user_id);
create policy "watchlist_delete_own" on public.watchlist for delete using (auth.uid() = user_id);

-- FOLLOWS
drop policy if exists "Follows: visibles para todos" on public.follows;
drop policy if exists "Follows: solo el propietario" on public.follows;

create policy "follows_select_all" on public.follows for select using (true);
create policy "follows_insert_own" on public.follows for insert with check (auth.uid() = follower_id);
create policy "follows_delete_own" on public.follows for delete using (auth.uid() = follower_id);


-- ───────────────────────────────────────────────────────────────────────
-- 3. LÍMITES DE CONTENIDO
--
--    Sin esto, cualquiera con la anon key (que es pública, va en el
--    bundle) puede meter una reseña de 50 MB y llenarte la base de datos.
--    Las políticas RLS controlan QUIÉN escribe, no CUÁNTO.
-- ───────────────────────────────────────────────────────────────────────
alter table public.reviews  drop constraint if exists reviews_content_len;
alter table public.reviews  add  constraint reviews_content_len
  check (char_length(content) between 1 and 2000);

alter table public.profiles drop constraint if exists profiles_username_fmt;
alter table public.profiles add  constraint profiles_username_fmt
  check (username ~ '^[a-z0-9_.-]{3,20}$') not valid;   -- not valid: no revisa filas viejas

alter table public.profiles drop constraint if exists profiles_bio_len;
alter table public.profiles add  constraint profiles_bio_len
  check (bio is null or char_length(bio) <= 300);

alter table public.profiles drop constraint if exists profiles_display_len;
alter table public.profiles add  constraint profiles_display_len
  check (display_name is null or char_length(display_name) <= 40);

-- El id de serie debe existir en el catálogo (ahora mismo 1..30).
-- Si amplías el catálogo, sube este número.
alter table public.ratings   drop constraint if exists ratings_serie_range;
alter table public.ratings   add  constraint ratings_serie_range   check (serie_id between 1 and 500);
alter table public.reviews   drop constraint if exists reviews_serie_range;
alter table public.reviews   add  constraint reviews_serie_range   check (serie_id between 1 and 500);
alter table public.watched   drop constraint if exists watched_serie_range;
alter table public.watched   add  constraint watched_serie_range   check (serie_id between 1 and 500);
alter table public.watchlist drop constraint if exists watchlist_serie_range;
alter table public.watchlist add  constraint watchlist_serie_range check (serie_id between 1 and 500);


-- ───────────────────────────────────────────────────────────────────────
-- 4. ANTI-SPAM: límite de escrituras por hora
--
--    Un script con la anon key puede insertar miles de filas por minuto.
--    Esto lo frena en la propia base de datos, que es donde de verdad
--    importa (validar solo en el frontend no sirve de nada).
-- ───────────────────────────────────────────────────────────────────────
create or replace function public.rate_limit_reviews()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    select count(*) from public.reviews
    where user_id = new.user_id
      and created_at > now() - interval '1 hour'
  ) >= 30 then
    raise exception 'Has publicado demasiadas reseñas en poco tiempo. Prueba dentro de un rato.';
  end if;
  return new;
end;
$$;

drop trigger if exists reviews_rate_limit on public.reviews;
create trigger reviews_rate_limit
  before insert on public.reviews
  for each row execute function public.rate_limit_reviews();


create or replace function public.rate_limit_ratings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    select count(*) from public.ratings
    where user_id = new.user_id
      and created_at > now() - interval '1 hour'
  ) >= 300 then
    raise exception 'Demasiadas valoraciones en poco tiempo.';
  end if;
  return new;
end;
$$;

drop trigger if exists ratings_rate_limit on public.ratings;
create trigger ratings_rate_limit
  before insert on public.ratings
  for each row execute function public.rate_limit_ratings();


-- ───────────────────────────────────────────────────────────────────────
-- 5. ÍNDICES (rendimiento + resistencia a consultas abusivas)
-- ───────────────────────────────────────────────────────────────────────
create index if not exists idx_ratings_user     on public.ratings(user_id);
create index if not exists idx_ratings_serie    on public.ratings(serie_id);
create index if not exists idx_ratings_created  on public.ratings(created_at desc);
create index if not exists idx_reviews_serie    on public.reviews(serie_id);
create index if not exists idx_reviews_created  on public.reviews(created_at desc);
create index if not exists idx_watched_user     on public.watched(user_id);
create index if not exists idx_watched_at       on public.watched(watched_at desc);
create index if not exists idx_watchlist_user   on public.watchlist(user_id);
create index if not exists idx_follows_follower on public.follows(follower_id);
create index if not exists idx_follows_following on public.follows(following_id);


-- ───────────────────────────────────────────────────────────────────────
-- 6. COMPROBACIÓN FINAL
--    Las seis tablas deben salir con rowsecurity = true.
-- ───────────────────────────────────────────────────────────────────────
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
