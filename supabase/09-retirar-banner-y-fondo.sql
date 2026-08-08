-- ═══════════════════════════════════════════════════════════════════════
-- AnimaFilm — 09. Retirada del banner y el fondo de perfil
--
-- Se probaron una banda de color en la cabecera y una imagen de fondo a
-- pantalla completa. Ninguna encaja con un diseño de viñetas opacas de
-- contorno grueso: la estética se apoya en color plano y bordes, y una
-- imagen de fondo va justo contra eso. Además, con tarjetas opacas la
-- imagen solo asomaba por las rendijas.
--
-- La personalización se queda en lo que sí funciona: avatar, series
-- favoritas e insignias.
--
-- Ejecutar en Supabase → SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────
-- 1. LA VISTA DEJA DE EXPONER ESAS COLUMNAS
--    Hay que rehacerla antes de borrarlas: una vista depende de ellas.
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
-- 2. FUERA LAS COLUMNAS
--    Dejar columnas muertas en el esquema confunde a quien lo lea
--    después: parece que hay una función que en realidad no existe.
-- ───────────────────────────────────────────────────────────────────────
alter table public.profiles drop constraint if exists profiles_portada_fk;
alter table public.profiles drop constraint if exists profiles_fondo_fk;
alter table public.profiles drop constraint if exists profiles_fondo_int;

alter table public.profiles drop column if exists portada_serie;
alter table public.profiles drop column if exists fondo_serie;
alter table public.profiles drop column if exists fondo_intensidad;


-- ───────────────────────────────────────────────────────────────────────
-- 3. COMPROBACIÓN
-- ───────────────────────────────────────────────────────────────────────
select username, avatar_emoji, avatar_color, favoritas, vistas, episodios
from public.perfiles_publicos
limit 5;
