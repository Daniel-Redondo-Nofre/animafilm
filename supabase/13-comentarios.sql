-- ═══════════════════════════════════════════════════════════════════════
-- AnimaFilm — 13. Comentarios en reseñas
--
-- Hasta ahora las reseñas eran monólogos: alguien escribía y nadie podía
-- responder. Esto abre la conversación.
--
-- Un solo nivel de anidamiento, a propósito: los hilos infinitos exigen
-- consultas recursivas y una interfaz que se rompe en móvil. Responder a
-- alguien menciona su nombre, y con eso basta.
--
-- Ejecutar en Supabase → SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────
-- 1. TABLA
-- ───────────────────────────────────────────────────────────────────────
create table if not exists public.review_comments (
  id         bigserial primary key,
  review_id  bigint references public.reviews(id)   on delete cascade not null,
  user_id    uuid   references public.profiles(id)  on delete cascade not null,
  content    text   not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.review_comments enable row level security;

alter table public.review_comments drop constraint if exists comentario_len;
alter table public.review_comments add  constraint comentario_len
  check (char_length(trim(content)) between 1 and 600);

drop policy if exists "comentarios_select_all" on public.review_comments;
drop policy if exists "comentarios_insert_own" on public.review_comments;
drop policy if exists "comentarios_update_own" on public.review_comments;
drop policy if exists "comentarios_delete"     on public.review_comments;

create policy "comentarios_select_all" on public.review_comments for select using (true);
create policy "comentarios_insert_own" on public.review_comments for insert with check (auth.uid() = user_id);
create policy "comentarios_update_own" on public.review_comments for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Puede borrar el autor del comentario Y el autor de la reseña: es su
-- espacio, y debe poder retirar algo que no quiere debajo de lo suyo.
create policy "comentarios_delete" on public.review_comments for delete
  using (
    auth.uid() = user_id
    or auth.uid() = (select rv.user_id from public.reviews rv where rv.id = review_id)
  );

create index if not exists idx_comentarios_review on public.review_comments(review_id, created_at);
create index if not exists idx_comentarios_user   on public.review_comments(user_id);

drop trigger if exists comentarios_updated_at on public.review_comments;
create trigger comentarios_updated_at
  before update on public.review_comments
  for each row execute function public.update_updated_at();


-- ───────────────────────────────────────────────────────────────────────
-- 2. LÍMITE ANTI-SPAM
-- ───────────────────────────────────────────────────────────────────────
create or replace function public.limite_comentarios()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.review_comments
      where user_id = new.user_id and created_at > now() - interval '1 hour') >= 60 then
    raise exception 'Has comentado demasiado en poco tiempo. Espera un rato.';
  end if;
  return new;
end;
$$;

drop trigger if exists comentarios_limite on public.review_comments;
create trigger comentarios_limite
  before insert on public.review_comments
  for each row execute function public.limite_comentarios();


-- ───────────────────────────────────────────────────────────────────────
-- 3. COMENTARIOS DE UNA RESEÑA
--
--    Devuelve el comentario, su autor y si quien consulta puede borrarlo.
--    Calcular el permiso en el servidor evita que el cliente tenga que
--    conocer quién escribió la reseña para decidir qué botones mostrar.
-- ───────────────────────────────────────────────────────────────────────
drop function if exists public.comentarios_de(bigint);

create or replace function public.comentarios_de(p_review bigint)
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
  puedo_borrar boolean
)
language sql
security invoker
set search_path = public
stable
as $$
  select
    c.id, c.user_id, c.content, c.created_at, c.updated_at,
    p.username, p.display_name, p.avatar_emoji, p.avatar_color,
    (auth.uid() = c.user_id
     or auth.uid() = (select rv.user_id from public.reviews rv where rv.id = c.review_id))
  from public.review_comments c
  join public.profiles p on p.id = c.user_id
  where c.review_id = p_review
  order by c.created_at asc
  limit 100;
$$;

grant execute on function public.comentarios_de(bigint) to anon, authenticated;


-- ───────────────────────────────────────────────────────────────────────
-- 4. LAS RESEÑAS DEVUELVEN SU RECUENTO DE COMENTARIOS
--    Así se puede mostrar "3 comentarios" sin consultar uno por uno.
-- ───────────────────────────────────────────────────────────────────────
-- Cambia el tipo de retorno (añade la columna `comentarios`), así que
-- Postgres exige borrarla antes: `create or replace` no puede alterar
-- las columnas que devuelve una función existente.
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
  la_sigo      boolean,
  comentarios  bigint
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
             where f.follower_id = auth.uid() and f.following_id = rv.user_id),
    (select count(*) from public.review_comments c where c.review_id = rv.id)
  from public.reviews rv
  join public.profiles p on p.id = rv.user_id
  where rv.serie_id = p_serie
  order by
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
-- 5. COMPROBACIÓN
-- ───────────────────────────────────────────────────────────────────────
select count(*) as comentarios_totales from public.review_comments;
