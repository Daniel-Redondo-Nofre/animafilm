-- ═══════════════════════════════════════════════════════════════════════
-- AnimaFilm — 11. Me gusta en reseñas
--
-- Permite dar y quitar "me gusta" a las reseñas de otros, y ordenar las
-- reseñas de una serie por popularidad.
--
-- Ejecutar en Supabase → SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────
-- 1. TABLA
--
--    La clave primaria compuesta (reseña + usuario) impide por diseño
--    que alguien dé dos veces "me gusta" a lo mismo: no hace falta
--    comprobarlo en el cliente.
-- ───────────────────────────────────────────────────────────────────────
create table if not exists public.review_likes (
  review_id bigint references public.reviews(id) on delete cascade,
  user_id   uuid   references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (review_id, user_id)
);

alter table public.review_likes enable row level security;

drop policy if exists "likes_select_all" on public.review_likes;
drop policy if exists "likes_insert_own" on public.review_likes;
drop policy if exists "likes_delete_own" on public.review_likes;

create policy "likes_select_all" on public.review_likes for select using (true);
create policy "likes_insert_own" on public.review_likes for insert with check (auth.uid() = user_id);
create policy "likes_delete_own" on public.review_likes for delete using (auth.uid() = user_id);

create index if not exists idx_likes_review on public.review_likes(review_id);
create index if not exists idx_likes_user   on public.review_likes(user_id);


-- ───────────────────────────────────────────────────────────────────────
-- 2. LÍMITE ANTI-ABUSO
--
--    Con la anon key, que es pública, alguien podría inflar los "me
--    gusta" con un script. El tope se aplica en la base de datos porque
--    validar solo en el navegador no sirve de nada.
-- ───────────────────────────────────────────────────────────────────────
create or replace function public.limite_likes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    select count(*) from public.review_likes
    where user_id = new.user_id
      and created_at > now() - interval '1 hour'
  ) >= 200 then
    raise exception 'Demasiados me gusta en poco tiempo. Espera un rato.';
  end if;
  return new;
end;
$$;

drop trigger if exists likes_limite on public.review_likes;
create trigger likes_limite
  before insert on public.review_likes
  for each row execute function public.limite_likes();


-- ───────────────────────────────────────────────────────────────────────
-- 3. RESEÑAS DE UNA SERIE, CON RECUENTO Y ORDEN
--
--    Devuelve en una sola consulta la reseña, su autor, cuántos "me
--    gusta" tiene y si el usuario actual se lo ha dado. Sin esto harían
--    falta tres viajes al servidor y contar en el navegador.
--
--    `orden`:
--      'populares' → más gustadas primero (lo que hace Letterboxd)
--      'recientes' → más nuevas primero
--      'amigos'    → primero las de quienes sigues
-- ───────────────────────────────────────────────────────────────────────
drop function if exists public.resenas_de_serie(integer, text, integer);

create or replace function public.resenas_de_serie(
  p_serie  integer,
  p_orden  text default 'populares',
  p_limite integer default 30
)
returns table (
  id           bigint,
  user_id      uuid,
  content      text,
  created_at   timestamptz,
  updated_at   timestamptz,
  username     text,
  display_name text,
  avatar_emoji text,
  avatar_color text,
  rating       integer,
  likes        bigint,
  me_gusta     boolean,
  la_sigo      boolean
)
language sql
security invoker
set search_path = public
stable
as $$
  select
    rv.id, rv.user_id, rv.content, rv.created_at, rv.updated_at,
    p.username, p.display_name, p.avatar_emoji, p.avatar_color,
    (select r.rating from public.ratings r
      where r.user_id = rv.user_id and r.serie_id = rv.serie_id),
    (select count(*) from public.review_likes l where l.review_id = rv.id),
    exists (select 1 from public.review_likes l
             where l.review_id = rv.id and l.user_id = auth.uid()),
    exists (select 1 from public.follows f
             where f.follower_id = auth.uid() and f.following_id = rv.user_id)
  from public.reviews rv
  join public.profiles p on p.id = rv.user_id
  where rv.serie_id = p_serie
  order by
    -- La propia siempre arriba: es la que el usuario quiere ver y editar
    (rv.user_id = auth.uid()) desc,
    case when p_orden = 'amigos' then
      (exists (select 1 from public.follows f
                where f.follower_id = auth.uid() and f.following_id = rv.user_id))
    end desc nulls last,
    case when p_orden = 'populares' then
      (select count(*) from public.review_likes l where l.review_id = rv.id)
    end desc nulls last,
    rv.created_at desc
  limit greatest(1, least(p_limite, 100));
$$;

grant execute on function public.resenas_de_serie(integer, text, integer) to anon, authenticated;


-- ───────────────────────────────────────────────────────────────────────
-- 4. LOS PERFILES CUENTAN LOS "ME GUSTA" RECIBIDOS
--    Sirve para insignias y para dar retorno a quien escribe.
-- ───────────────────────────────────────────────────────────────────────
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
    where w.user_id = p.id)                                                                        as episodios,
  (select count(*)
     from public.review_likes l
     join public.reviews rv2 on rv2.id = l.review_id
    where rv2.user_id = p.id)                                                                      as likes_recibidos
from public.profiles p;

alter view public.perfiles_publicos set (security_invoker = on);
grant select on public.perfiles_publicos to anon, authenticated;


-- ───────────────────────────────────────────────────────────────────────
-- 5. COMPROBACIÓN
-- ───────────────────────────────────────────────────────────────────────
select count(*) as likes_totales from public.review_likes;
select username, resenas, likes_recibidos from public.perfiles_publicos
order by likes_recibidos desc limit 5;
