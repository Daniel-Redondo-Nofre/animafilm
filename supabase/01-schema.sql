-- ═══════════════════════════════════════════════════════════════════════
-- AnimaFilm — 01. Esquema base
--
-- Tablas de usuarios, valoraciones, reseñas, listas y seguidores, con
-- Row Level Security en todas. El catálogo de series NO está aquí: se
-- añade en 03-migracion-catalogo.sql.
--
-- Ejecutar el primero, en Supabase → SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────
-- PERFILES
-- Cuelga de auth.users con borrado en cascada: al eliminar la cuenta
-- desaparece todo lo demás automáticamente.
-- ───────────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id           uuid references auth.users on delete cascade primary key,
  username     text unique not null,
  display_name text,
  bio          text,
  created_at   timestamptz default now()
);

alter table public.profiles enable row level security;

-- El trigger definitivo (con search_path fijo y resolución de colisiones)
-- está en 02-security-hardening.sql. Aquí va la versión mínima para que
-- el registro funcione desde el primer momento.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ───────────────────────────────────────────────────────────────────────
-- VALORACIONES
-- ───────────────────────────────────────────────────────────────────────
create table if not exists public.ratings (
  id         bigserial primary key,
  user_id    uuid references public.profiles(id) on delete cascade not null,
  serie_id   integer not null,
  rating     integer not null check (rating between 1 and 5),
  created_at timestamptz default now(),
  unique(user_id, serie_id)
);
alter table public.ratings enable row level security;


-- ───────────────────────────────────────────────────────────────────────
-- RESEÑAS
-- ───────────────────────────────────────────────────────────────────────
create table if not exists public.reviews (
  id         bigserial primary key,
  user_id    uuid references public.profiles(id) on delete cascade not null,
  serie_id   integer not null,
  content    text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, serie_id)
);
alter table public.reviews enable row level security;

create or replace function public.update_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists reviews_updated_at on public.reviews;
create trigger reviews_updated_at
  before update on public.reviews
  for each row execute procedure public.update_updated_at();


-- ───────────────────────────────────────────────────────────────────────
-- SERIES VISTAS
-- ───────────────────────────────────────────────────────────────────────
create table if not exists public.watched (
  user_id    uuid references public.profiles(id) on delete cascade,
  serie_id   integer not null,
  watched_at timestamptz default now(),
  primary key(user_id, serie_id)
);
alter table public.watched enable row level security;


-- ───────────────────────────────────────────────────────────────────────
-- PENDIENTES
-- ───────────────────────────────────────────────────────────────────────
create table if not exists public.watchlist (
  user_id  uuid references public.profiles(id) on delete cascade,
  serie_id integer not null,
  added_at timestamptz default now(),
  primary key(user_id, serie_id)
);
alter table public.watchlist enable row level security;


-- ───────────────────────────────────────────────────────────────────────
-- SEGUIDORES
-- La restricción evita que alguien se siga a sí mismo.
-- ───────────────────────────────────────────────────────────────────────
create table if not exists public.follows (
  follower_id  uuid references public.profiles(id) on delete cascade,
  following_id uuid references public.profiles(id) on delete cascade,
  created_at   timestamptz default now(),
  primary key(follower_id, following_id),
  check (follower_id <> following_id)
);
alter table public.follows enable row level security;


-- ───────────────────────────────────────────────────────────────────────
-- POLÍTICAS
-- Patrón general: cualquiera puede leer (la app es pública), solo el
-- propietario puede escribir sus propios datos.
-- Las versiones definitivas y explícitas están en 02-security-hardening.
-- ───────────────────────────────────────────────────────────────────────
drop policy if exists "profiles_select_all"  on public.profiles;
drop policy if exists "profiles_update_own"  on public.profiles;
create policy "profiles_select_all" on public.profiles for select using (true);
create policy "profiles_update_own" on public.profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "ratings_select_all" on public.ratings;
drop policy if exists "ratings_own"        on public.ratings;
create policy "ratings_select_all" on public.ratings for select using (true);
create policy "ratings_own"        on public.ratings for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "reviews_select_all" on public.reviews;
drop policy if exists "reviews_own"        on public.reviews;
create policy "reviews_select_all" on public.reviews for select using (true);
create policy "reviews_own"        on public.reviews for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "watched_select_all" on public.watched;
drop policy if exists "watched_own"        on public.watched;
create policy "watched_select_all" on public.watched for select using (true);
create policy "watched_own"        on public.watched for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "watchlist_select_all" on public.watchlist;
drop policy if exists "watchlist_own"        on public.watchlist;
create policy "watchlist_select_all" on public.watchlist for select using (true);
create policy "watchlist_own"        on public.watchlist for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "follows_select_all" on public.follows;
drop policy if exists "follows_own"        on public.follows;
create policy "follows_select_all" on public.follows for select using (true);
create policy "follows_own"        on public.follows for all
  using (auth.uid() = follower_id) with check (auth.uid() = follower_id);


-- ───────────────────────────────────────────────────────────────────────
-- COMPROBACIÓN: las seis tablas deben salir con rowsecurity = true
-- ───────────────────────────────────────────────────────────────────────
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
