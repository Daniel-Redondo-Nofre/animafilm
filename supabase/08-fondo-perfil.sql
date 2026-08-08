-- ═══════════════════════════════════════════════════════════════════════
-- AnimaFilm — 08. Fondo del perfil
--
-- Permite elegir una serie cuyo póster hace de fondo de TU página de
-- perfil, sustituyendo la trama de puntos del tebeo. Es una preferencia
-- por usuario y solo afecta a su propio perfil.
--
-- Ejecutar en Supabase → SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════

alter table public.profiles add column if not exists fondo_serie     integer;
alter table public.profiles add column if not exists fondo_intensidad smallint not null default 2;

alter table public.profiles drop constraint if exists profiles_fondo_fk;
alter table public.profiles add  constraint profiles_fondo_fk
  foreign key (fondo_serie) references public.series(id) on delete set null;

-- 1 = apenas se intuye · 2 = equilibrado · 3 = protagonista
alter table public.profiles drop constraint if exists profiles_fondo_int;
alter table public.profiles add  constraint profiles_fondo_int
  check (fondo_intensidad between 1 and 3);


-- ───────────────────────────────────────────────────────────────────────
-- La vista pública debe exponerlo.
-- Como en el paso 07: hay que borrarla y rehacerla, porque
-- `create or replace view` no sabe insertar columnas en medio.
-- ───────────────────────────────────────────────────────────────────────
drop view if exists public.perfiles_publicos;

create view public.perfiles_publicos as
select
  p.id,
  p.username,
  p.display_name,
  p.bio,
  p.created_at,
  p.avatar_emoji,
  p.avatar_color,
  p.portada_serie,
  p.fondo_serie,
  p.fondo_intensidad,
  p.favoritas,
  (select count(*)                        from public.watched  w  where w.user_id      = p.id) as vistas,
  (select count(*)                        from public.ratings  r  where r.user_id      = p.id) as valoraciones,
  (select count(*)                        from public.reviews  rv where rv.user_id     = p.id) as resenas,
  (select round(avg(r.rating)::numeric,2) from public.ratings  r  where r.user_id      = p.id) as nota_media,
  (select count(*)                        from public.follows  f  where f.following_id = p.id) as seguidores,
  (select count(*)                        from public.follows  f  where f.follower_id  = p.id) as siguiendo,
  (select coalesce(sum(s.episodios), 0)
     from public.watched w join public.series s on s.id = w.serie_id
    where w.user_id = p.id)                                                                    as episodios
from public.profiles p;

alter view public.perfiles_publicos set (security_invoker = on);
grant select on public.perfiles_publicos to anon, authenticated;


-- ───────────────────────────────────────────────────────────────────────
-- COMPROBACIÓN
-- ───────────────────────────────────────────────────────────────────────
select username, portada_serie, fondo_serie, fondo_intensidad
from public.perfiles_publicos
limit 5;
