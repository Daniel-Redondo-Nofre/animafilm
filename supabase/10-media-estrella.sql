-- ═══════════════════════════════════════════════════════════════════════
-- AnimaFilm — 10. Valoraciones con media estrella
--
-- Letterboxd puntúa de 0,5 a 5 en medios puntos. Guardarlo como decimal
-- invita a errores de redondeo, así que la columna pasa a almacenar
-- MEDIAS ESTRELLAS como entero: 1 = media, 2 = una, …, 10 = cinco.
-- El cliente divide entre 2 al mostrar.
--
-- Ejecutar en Supabase → SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────
-- 1. AMPLIAR LA ESCALA
--
--    Los datos que ya existen están en escala 1-5. Se multiplican por 2
--    para pasar a la nueva escala sin perder nada: un 4 se convierte en
--    8, que sigue siendo 4 estrellas.
-- ───────────────────────────────────────────────────────────────────────

-- Fuera la restricción vieja antes de tocar los valores
alter table public.ratings drop constraint if exists ratings_rating_check;

-- Conversión: solo si aún no se ha hecho (idempotente)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ratings'
      and column_name = 'escala_media'
  ) then
    update public.ratings set rating = rating * 2 where rating <= 5;
    alter table public.ratings add column escala_media boolean not null default true;
  end if;
end $$;

alter table public.ratings add constraint ratings_rating_check
  check (rating between 1 and 10);


-- ───────────────────────────────────────────────────────────────────────
-- 2. LAS ESTADÍSTICAS DEVUELVEN LA NOTA EN ESCALA 0–5
--
--    Así el cliente no tiene que dividir en cada sitio donde muestra una
--    media, y las notas antiguas siguen significando lo mismo.
-- ───────────────────────────────────────────────────────────────────────
create or replace view public.series_stats as
select
  s.id                                            as serie_id,
  count(distinct r.user_id)                       as votos,
  round((avg(r.rating) / 2)::numeric, 2)          as nota_media,
  count(distinct w.user_id)                       as vistas_totales,
  count(distinct rv.id)                           as num_resenas
from public.series s
left join public.ratings r  on r.serie_id  = s.id
left join public.watched w  on w.serie_id  = s.id
left join public.reviews rv on rv.serie_id = s.id
group by s.id;

alter view public.series_stats set (security_invoker = on);
grant select on public.series_stats to anon, authenticated;


drop view if exists public.perfiles_publicos;

create view public.perfiles_publicos as
select
  p.id, p.username, p.display_name, p.bio, p.created_at,
  p.avatar_emoji, p.avatar_color, p.favoritas,
  (select count(*)                            from public.watched  w  where w.user_id      = p.id) as vistas,
  (select count(*)                            from public.ratings  r  where r.user_id      = p.id) as valoraciones,
  (select count(*)                            from public.reviews  rv where rv.user_id     = p.id) as resenas,
  (select round((avg(r.rating)/2)::numeric,2) from public.ratings  r  where r.user_id      = p.id) as nota_media,
  (select count(*)                            from public.follows  f  where f.following_id = p.id) as seguidores,
  (select count(*)                            from public.follows  f  where f.follower_id  = p.id) as siguiendo,
  (select coalesce(sum(s.episodios), 0)
     from public.watched w join public.series s on s.id = w.serie_id
    where w.user_id = p.id)                                                                        as episodios
from public.profiles p;

alter view public.perfiles_publicos set (security_invoker = on);
grant select on public.perfiles_publicos to anon, authenticated;


create or replace view public.stats_generales as
select
  (select count(*) from public.profiles)                         as usuarios,
  (select count(*) from public.ratings)                          as valoraciones,
  (select count(*) from public.reviews)                          as resenas,
  (select count(*) from public.watched)                          as vistas_totales,
  (select count(*) from public.series)                           as series,
  (select count(*) from public.listas where publica)             as listas_publicas,
  (select round((avg(rating)/2)::numeric, 2) from public.ratings) as nota_media_global;

alter view public.stats_generales set (security_invoker = on);
grant select on public.stats_generales to anon, authenticated;


create or replace view public.stats_por_decada as
select
  s.decada,
  count(distinct s.id)                           as series,
  count(distinct w.user_id || '-' || w.serie_id) as vistas,
  round((avg(r.rating)/2)::numeric, 2)           as nota_media,
  count(r.id)                                     as votos
from public.series s
left join public.watched w on w.serie_id = s.id
left join public.ratings r on r.serie_id = s.id
group by s.decada;

alter view public.stats_por_decada set (security_invoker = on);
grant select on public.stats_por_decada to anon, authenticated;


-- ───────────────────────────────────────────────────────────────────────
-- 3. COMPARAR: las notas también en escala 0–5
-- ───────────────────────────────────────────────────────────────────────
drop function if exists public.comparar_con(uuid);

create or replace function public.comparar_con(otro uuid)
returns table (
  serie_id   integer,
  vista_yo   boolean,
  vista_otro boolean,
  nota_yo    numeric,
  nota_otro  numeric
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
    (select r.rating / 2.0 from public.ratings r where r.user_id = (select id from yo) and r.serie_id = s.id),
    (select r.rating / 2.0 from public.ratings r where r.user_id = otro                 and r.serie_id = s.id)
  from public.series s
  order by s.id;
$$;

grant execute on function public.comparar_con(uuid) to authenticated;


-- ───────────────────────────────────────────────────────────────────────
-- 4. COMPROBACIÓN
--    `rating` debe moverse entre 1 y 10; `nota_media`, entre 0,5 y 5.
-- ───────────────────────────────────────────────────────────────────────
select min(rating) as min_bruto, max(rating) as max_bruto, count(*) as total
from public.ratings;

select serie_id, votos, nota_media
from public.series_stats
where votos > 0
order by nota_media desc
limit 5;
