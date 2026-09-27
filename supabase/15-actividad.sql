-- ═══════════════════════════════════════════════════════════════════════
-- AnimaFilm — 15. Actividad reciente en el perfil
--
-- Una línea de tiempo con lo último que ha hecho un usuario: visionados,
-- valoraciones, reseñas, listas y seguimientos, todo mezclado y ordenado
-- por fecha.
--
-- Se resuelve con un UNION ALL en el servidor. La alternativa —cinco
-- consultas desde el cliente y mezclarlas en el navegador— traería cinco
-- veces más filas de las necesarias para descartar el 80 %.
--
-- Ejecutar en Supabase → SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════

drop function if exists public.actividad_de(uuid, integer);

create or replace function public.actividad_de(usuario uuid, limite integer default 15)
returns table (
  tipo        text,
  cuando      timestamptz,
  serie_id    integer,
  titulo      text,
  color       text,
  poster_url  text,
  valor       text,      -- nota, extracto de reseña o nombre de lista
  extra       text       -- id de lista, username seguido… según el tipo
)
language sql
security invoker
set search_path = public
stable
as $$
  with todo (tipo, cuando, serie_id, titulo, color, poster_url, valor, extra) as (
    -- Visionados del diario
    select 'visionado'::text,
           d.created_at,
           s.id, s.titulo, s.color, s.poster_url,
           case when d.revision then 'revisión' else null end::text,
           d.vista_el::text
    from public.diario d
    join public.series s on s.id = d.serie_id
    where d.user_id = usuario

    union all

    -- Valoraciones
    select 'valoracion',
           r.created_at,
           s.id, s.titulo, s.color, s.poster_url,
           (r.rating / 2.0)::text,
           null::text
    from public.ratings r
    join public.series s on s.id = r.serie_id
    where r.user_id = usuario

    union all

    -- Reseñas
    select 'resena',
           rv.created_at,
           s.id, s.titulo, s.color, s.poster_url,
           left(rv.content, 120),
           rv.id::text
    from public.reviews rv
    join public.series s on s.id = rv.serie_id
    where rv.user_id = usuario

    union all

    -- Listas públicas creadas
    select 'lista',
           l.created_at,
           null::integer, null::text, null::text, null::text,
           l.nombre,
           l.id::text
    from public.listas l
    where l.user_id = usuario and l.publica

    union all

    -- A quién ha empezado a seguir
    select 'sigue',
           f.created_at,
           null::integer, null::text, null::text, null::text,
           coalesce(p.display_name, p.username),
           p.username
    from public.follows f
    join public.profiles p on p.id = f.following_id
    where f.follower_id = usuario
  )
  select * from todo
  order by cuando desc
  limit greatest(1, least(limite, 50));
$$;

grant execute on function public.actividad_de(uuid, integer) to anon, authenticated;


-- ───────────────────────────────────────────────────────────────────────
-- COMPROBACIÓN
-- ───────────────────────────────────────────────────────────────────────
select tipo, cuando, titulo, valor
from public.actividad_de((select id from public.profiles limit 1), 10);
