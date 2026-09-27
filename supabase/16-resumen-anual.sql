-- ═══════════════════════════════════════════════════════════════════════
-- AnimaFilm — 16. Estadísticas anuales por usuario
--
-- El resumen de un año: cuánto vio, qué nota puso, en qué meses estuvo
-- más activo, qué década prefirió y cuáles fueron sus mejores series.
--
-- Todo se calcula sobre el DIARIO, no sobre `watched`: lo que interesa
-- de un año es lo que se vio ESE año, y `watched` solo guarda la primera
-- vez. Un revisionado en 2026 de algo marcado en 2024 cuenta para 2026.
--
-- Ejecutar en Supabase → SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────
-- 1. AÑOS CON ACTIVIDAD
--    Para no ofrecer en el selector años en los que no hay nada.
-- ───────────────────────────────────────────────────────────────────────
drop function if exists public.anios_con_actividad(uuid);

create or replace function public.anios_con_actividad(usuario uuid)
returns table (anio integer, total bigint)
language sql
security invoker
set search_path = public
stable
as $$
  select extract(year from d.vista_el)::integer, count(*)
  from public.diario d
  where d.user_id = usuario
  group by 1
  order by 1 desc;
$$;

grant execute on function public.anios_con_actividad(uuid) to anon, authenticated;


-- ───────────────────────────────────────────────────────────────────────
-- 2. RESUMEN DEL AÑO
-- ───────────────────────────────────────────────────────────────────────
drop function if exists public.resumen_anual(uuid, integer);

create or replace function public.resumen_anual(usuario uuid, p_anio integer)
returns table (
  visionados      bigint,
  series_unicas   bigint,
  revisiones      bigint,
  episodios       bigint,
  valoraciones    bigint,
  nota_media      numeric,
  resenas         bigint,
  mes_top         integer,
  mes_top_total   bigint,
  decada_top      text,
  decada_top_total bigint,
  dias_activos    bigint,
  racha_max       integer
)
language sql
security invoker
set search_path = public
stable
as $$
  with v as (
    select d.*, s.episodios as eps, s.decada
    from public.diario d
    join public.series s on s.id = d.serie_id
    where d.user_id = usuario
      and extract(year from d.vista_el) = p_anio
  ),
  -- Racha: días consecutivos con al menos un visionado. El truco es
  -- restar a cada fecha su número de fila; los días seguidos dan el
  -- mismo resultado y se agrupan solos.
  dias as (
    select distinct vista_el from v
  ),
  grupos as (
    select vista_el,
           vista_el - (row_number() over (order by vista_el))::integer as grupo
    from dias
  ),
  rachas as (
    select count(*) as largo from grupos group by grupo
  )
  select
    (select count(*) from v),
    (select count(distinct serie_id) from v),
    (select count(*) from v where revision),
    (select coalesce(sum(eps), 0) from v),
    (select count(*) from public.ratings r
      where r.user_id = usuario and extract(year from r.created_at) = p_anio),
    (select round((avg(r.rating)/2)::numeric, 2) from public.ratings r
      where r.user_id = usuario and extract(year from r.created_at) = p_anio),
    (select count(*) from public.reviews rv
      where rv.user_id = usuario and extract(year from rv.created_at) = p_anio),
    (select extract(month from vista_el)::integer from v
      group by 1 order by count(*) desc, 1 limit 1),
    (select count(*) from v
      group by extract(month from vista_el) order by count(*) desc limit 1),
    (select decada from v group by decada order by count(*) desc, decada limit 1),
    (select count(*) from v group by decada order by count(*) desc limit 1),
    (select count(*) from dias),
    (select coalesce(max(largo), 0)::integer from rachas);
$$;

grant execute on function public.resumen_anual(uuid, integer) to anon, authenticated;


-- ───────────────────────────────────────────────────────────────────────
-- 3. DESGLOSE MENSUAL DEL AÑO
--    Devuelve los doce meses, incluidos los vacíos: si faltaran, el
--    gráfico saldría descolocado y mentiría sobre la distribución.
-- ───────────────────────────────────────────────────────────────────────
drop function if exists public.meses_del_anio(uuid, integer);

create or replace function public.meses_del_anio(usuario uuid, p_anio integer)
returns table (mes integer, total bigint)
language sql
security invoker
set search_path = public
stable
as $$
  select
    g.n,
    coalesce((select count(*) from public.diario d
               where d.user_id = usuario
                 and extract(year from d.vista_el) = p_anio
                 and extract(month from d.vista_el) = g.n), 0)
  from generate_series(1, 12) as g(n)
  order by g.n;
$$;

grant execute on function public.meses_del_anio(uuid, integer) to anon, authenticated;


-- ───────────────────────────────────────────────────────────────────────
-- 4. LAS MEJORES DEL AÑO
--    Series vistas ese año, ordenadas por la nota que les puso.
-- ───────────────────────────────────────────────────────────────────────
drop function if exists public.mejores_del_anio(uuid, integer, integer);

create or replace function public.mejores_del_anio(
  usuario uuid, p_anio integer, limite integer default 5
)
returns table (
  serie_id   integer,
  titulo     text,
  anio       integer,
  color      text,
  poster_url text,
  rating     integer,
  vista_el   date
)
language sql
security invoker
set search_path = public
stable
as $$
  select distinct on (s.id)
    s.id, s.titulo, s.anio, s.color, s.poster_url,
    r.rating, d.vista_el
  from public.diario d
  join public.series s  on s.id = d.serie_id
  join public.ratings r on r.serie_id = s.id and r.user_id = usuario
  where d.user_id = usuario
    and extract(year from d.vista_el) = p_anio
  order by s.id, d.vista_el desc;
$$;

grant execute on function public.mejores_del_anio(uuid, integer, integer) to anon, authenticated;


-- ───────────────────────────────────────────────────────────────────────
-- 5. COMPROBACIÓN
-- ───────────────────────────────────────────────────────────────────────
select * from public.anios_con_actividad((select id from public.profiles limit 1));
