-- ═══════════════════════════════════════════════════════════════════════
-- AnimaFilm — 14. Ficha de serie mejorada
--
-- Tres añadidos:
--   · Distribución de notas en barras
--   · Marca de spoiler en las reseñas
--   · Reseñas de quienes sigues, separadas del resto
--
-- Ejecutar en Supabase → SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────
-- 1. MARCA DE SPOILER
-- ───────────────────────────────────────────────────────────────────────
alter table public.reviews add column if not exists spoiler boolean not null default false;


-- ───────────────────────────────────────────────────────────────────────
-- 2. DISTRIBUCIÓN DE NOTAS
--
--    Devuelve las diez medias estrellas con su recuento, incluidas las
--    que nadie ha votado: si faltaran, las barras saldrían descolocadas
--    y el histograma mentiría sobre la forma real de la distribución.
-- ───────────────────────────────────────────────────────────────────────
drop function if exists public.distribucion_notas(integer);

create or replace function public.distribucion_notas(p_serie integer)
returns table (media_estrellas integer, votos bigint)
language sql
security invoker
set search_path = public
stable
as $$
  select
    g.n,
    coalesce((select count(*) from public.ratings r
               where r.serie_id = p_serie and r.rating = g.n), 0)
  from generate_series(1, 10) as g(n)
  order by g.n;
$$;

grant execute on function public.distribucion_notas(integer) to anon, authenticated;


-- ───────────────────────────────────────────────────────────────────────
-- 3. RESEÑAS: SPOILER Y SEPARACIÓN POR SEGUIDOS
--
--    `solo_seguidos` permite pedir por separado las de quienes sigues,
--    para destacarlas arriba sin duplicarlas en la lista general.
-- ───────────────────────────────────────────────────────────────────────
-- Se borran todas las firmas anteriores: la función ha ido cambiando de
-- parámetros y de columnas, y `create or replace` no puede con ninguno
-- de los dos cambios.
drop function if exists public.resenas_de_serie(integer, text, integer);
drop function if exists public.resenas_de_serie(integer, text, integer, boolean, boolean);

create or replace function public.resenas_de_serie(
  p_serie          integer,
  p_orden          text    default 'populares',
  p_limite         integer default 30,
  p_solo_seguidos  boolean default false,
  p_excluir_seguidos boolean default false
)
returns table (
  id           bigint,
  user_id      uuid,
  content      text,
  spoiler      boolean,
  created_at   timestamptz,
  updated_at   timestamptz,
  username     text,
  display_name text,
  avatar_emoji text,
  avatar_color text,
  rating       integer,
  likes        bigint,
  me_gusta     boolean,
  la_sigo      boolean,
  comentarios  bigint
)
language sql
security invoker
set search_path = public
stable
as $$
  select
    rv.id, rv.user_id, rv.content, rv.spoiler, rv.created_at, rv.updated_at,
    p.username, p.display_name, p.avatar_emoji, p.avatar_color,
    (select r.rating from public.ratings r
      where r.user_id = rv.user_id and r.serie_id = rv.serie_id),
    (select count(*) from public.review_likes l where l.review_id = rv.id),
    exists (select 1 from public.review_likes l
             where l.review_id = rv.id and l.user_id = auth.uid()),
    exists (select 1 from public.follows f
             where f.follower_id = auth.uid() and f.following_id = rv.user_id),
    (select count(*) from public.review_comments c where c.review_id = rv.id)
  from public.reviews rv
  join public.profiles p on p.id = rv.user_id
  where rv.serie_id = p_serie
    and (not p_solo_seguidos or exists (
          select 1 from public.follows f
          where f.follower_id = auth.uid() and f.following_id = rv.user_id))
    and (not p_excluir_seguidos or not exists (
          select 1 from public.follows f
          where f.follower_id = auth.uid() and f.following_id = rv.user_id))
    -- La propia nunca va en el bloque de seguidos
    and (not p_solo_seguidos or rv.user_id <> auth.uid())
  order by
    (rv.user_id = auth.uid()) desc,
    case when p_orden = 'populares' then
      (select count(*) from public.review_likes l where l.review_id = rv.id)
    end desc nulls last,
    rv.created_at desc
  limit greatest(1, least(p_limite, 100));
$$;

grant execute on function public.resenas_de_serie(integer, text, integer, boolean, boolean) to anon, authenticated;


-- ───────────────────────────────────────────────────────────────────────
-- 4. COMPROBACIÓN
-- ───────────────────────────────────────────────────────────────────────
select media_estrellas, votos from public.distribucion_notas(1);
