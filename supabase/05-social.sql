-- ═══════════════════════════════════════════════════════════════════════
-- AnimaFilm — Capa social
-- Perfiles públicos, seguidores y comparación de colecciones.
-- Ejecutar en Supabase → SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────
-- 1. VISTA DE PERFILES PÚBLICOS
--
--    Las cuentas se calculan en el servidor. Traer todas las valoraciones
--    al navegador para contarlas allí sería absurdo: crece con el número
--    de usuarios y expone datos que no hacen falta.
-- ───────────────────────────────────────────────────────────────────────
create or replace view public.perfiles_publicos as
select
  p.id,
  p.username,
  p.display_name,
  p.bio,
  p.created_at,
  (select count(*)                     from public.watched  w  where w.user_id      = p.id) as vistas,
  (select count(*)                     from public.ratings  r  where r.user_id      = p.id) as valoraciones,
  (select count(*)                     from public.reviews  rv where rv.user_id     = p.id) as resenas,
  (select round(avg(r.rating)::numeric,2) from public.ratings r where r.user_id     = p.id) as nota_media,
  (select count(*)                     from public.follows  f  where f.following_id = p.id) as seguidores,
  (select count(*)                     from public.follows  f  where f.follower_id  = p.id) as siguiendo
from public.profiles p;

alter view public.perfiles_publicos set (security_invoker = on);
grant select on public.perfiles_publicos to anon, authenticated;


-- ───────────────────────────────────────────────────────────────────────
-- 2. SEGUIR Y DEJAR DE SEGUIR
--
--    Podría hacerse con insert/delete directos (las políticas RLS ya lo
--    permiten), pero con funciones evitamos que el cliente tenga que
--    conocer su propio id y podemos validar de una sola vez.
-- ───────────────────────────────────────────────────────────────────────
create or replace function public.seguir(objetivo uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  yo uuid := auth.uid();
begin
  if yo is null then
    raise exception 'Necesitas iniciar sesión';
  end if;
  if yo = objetivo then
    raise exception 'No puedes seguirte a ti mismo';
  end if;
  if not exists (select 1 from public.profiles where id = objetivo) then
    raise exception 'Ese usuario no existe';
  end if;
  if (select count(*) from public.follows where follower_id = yo) >= 2000 then
    raise exception 'Has alcanzado el límite de personas a las que seguir';
  end if;

  insert into public.follows (follower_id, following_id)
  values (yo, objetivo)
  on conflict do nothing;
end;
$$;

create or replace function public.dejar_de_seguir(objetivo uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Necesitas iniciar sesión';
  end if;
  delete from public.follows
  where follower_id = auth.uid() and following_id = objetivo;
end;
$$;

revoke all on function public.seguir(uuid)          from public, anon;
revoke all on function public.dejar_de_seguir(uuid) from public, anon;
grant execute on function public.seguir(uuid)          to authenticated;
grant execute on function public.dejar_de_seguir(uuid) to authenticated;


-- ───────────────────────────────────────────────────────────────────────
-- 3. COMPARAR COLECCIONES
--
--    Devuelve qué series habéis visto los dos, cuáles solo uno, y en qué
--    medida coincidís puntuando. Todo en una consulta.
-- ───────────────────────────────────────────────────────────────────────
drop function if exists public.comparar_con(uuid);

create or replace function public.comparar_con(otro uuid)
returns table (
  serie_id      integer,
  vista_yo      boolean,
  vista_otro    boolean,
  nota_yo       integer,
  nota_otro     integer
)
language sql
security invoker
set search_path = public
stable
as $$
  with yo as (select auth.uid() as id)
  select
    s.id,
    exists (select 1 from public.watched w where w.user_id = (select id from yo) and w.serie_id = s.id),
    exists (select 1 from public.watched w where w.user_id = otro                 and w.serie_id = s.id),
    (select r.rating from public.ratings r where r.user_id = (select id from yo) and r.serie_id = s.id),
    (select r.rating from public.ratings r where r.user_id = otro                 and r.serie_id = s.id)
  from public.series s
  order by s.id;
$$;

grant execute on function public.comparar_con(uuid) to authenticated;


-- ───────────────────────────────────────────────────────────────────────
-- 4. BUSCAR USUARIOS
--
--    Devuelve como mucho 10 resultados y exige al menos 2 caracteres:
--    así no se puede volcar la lista completa de usuarios.
-- ───────────────────────────────────────────────────────────────────────
drop function if exists public.buscar_usuarios(text);

create or replace function public.buscar_usuarios(texto text)
returns table (id uuid, username text, display_name text, vistas bigint)
language sql
security invoker
set search_path = public
stable
as $$
  select p.id, p.username, p.display_name,
         (select count(*) from public.watched w where w.user_id = p.id)
  from public.profiles p
  where char_length(trim(texto)) >= 2
    and (p.username ilike '%' || trim(texto) || '%'
      or p.display_name ilike '%' || trim(texto) || '%')
  order by p.username
  limit 10;
$$;

grant execute on function public.buscar_usuarios(text) to anon, authenticated;


-- ───────────────────────────────────────────────────────────────────────
-- 5. ÍNDICES
-- ───────────────────────────────────────────────────────────────────────
create index if not exists idx_profiles_username_lower on public.profiles (lower(username));
create index if not exists idx_reviews_user            on public.reviews (user_id);


-- ───────────────────────────────────────────────────────────────────────
-- 6. COMPROBACIÓN
-- ───────────────────────────────────────────────────────────────────────
select username, vistas, valoraciones, seguidores, siguiendo
from public.perfiles_publicos
order by vistas desc
limit 10;
