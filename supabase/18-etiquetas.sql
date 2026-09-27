-- ═══════════════════════════════════════════════════════════════════════
-- AnimaFilm — 18. Etiquetas en reseñas
--
-- Etiquetas mixtas: hay unas cuantas sugeridas por defecto, pero
-- cualquiera puede crear las suyas. Las más usadas se proponen al
-- escribir, así el vocabulario converge solo sin imponerlo.
--
-- Ejecutar en Supabase → SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────
-- 1. TABLA
--
--    Las etiquetas se guardan normalizadas (minúsculas, sin tildes) en
--    `slug`, y con su forma original en `nombre`. Así "Nostalgia" y
--    "nostalgia" son la misma, pero se muestra como la escribió quien
--    la creó primero.
-- ───────────────────────────────────────────────────────────────────────
create table if not exists public.etiquetas (
  review_id  bigint references public.reviews(id)  on delete cascade,
  slug       text not null,
  nombre     text not null,
  user_id    uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  primary key (review_id, slug)
);

alter table public.etiquetas enable row level security;

drop policy if exists "etiquetas_select_all" on public.etiquetas;
drop policy if exists "etiquetas_write_own"  on public.etiquetas;

create policy "etiquetas_select_all" on public.etiquetas for select using (true);

-- Solo el autor de la reseña etiqueta su propia reseña
create policy "etiquetas_write_own" on public.etiquetas for all
  using (
    auth.uid() = user_id
    and auth.uid() = (select rv.user_id from public.reviews rv where rv.id = review_id)
  )
  with check (
    auth.uid() = user_id
    and auth.uid() = (select rv.user_id from public.reviews rv where rv.id = review_id)
  );

alter table public.etiquetas drop constraint if exists etiquetas_nombre_len;
alter table public.etiquetas add  constraint etiquetas_nombre_len
  check (char_length(trim(nombre)) between 2 and 24);

alter table public.etiquetas drop constraint if exists etiquetas_slug_fmt;
alter table public.etiquetas add  constraint etiquetas_slug_fmt
  check (slug ~ '^[a-z0-9 -]{2,24}$');

create index if not exists idx_etiquetas_slug   on public.etiquetas(slug);
create index if not exists idx_etiquetas_review on public.etiquetas(review_id);


-- ───────────────────────────────────────────────────────────────────────
-- 2. NORMALIZACIÓN AUTOMÁTICA
--
--    Se hace en un trigger y no en el cliente: la anon key es pública y
--    cualquiera puede llamar a la API directamente. Si la normalización
--    viviera solo en el navegador, entrarían etiquetas sin normalizar y
--    el agrupado dejaría de funcionar.
-- ───────────────────────────────────────────────────────────────────────
create or replace function public.normalizar_etiqueta()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.nombre := trim(regexp_replace(new.nombre, '\s+', ' ', 'g'));
  -- unaccent no está disponible por defecto: se traducen las vocales
  -- acentuadas y la ñ a mano, que es lo que aparece en castellano.
  new.slug := lower(new.nombre);
  new.slug := translate(new.slug, 'áàäâéèëêíìïîóòöôúùüûñç', 'aaaaeeeeiiiioooouuuunc');
  new.slug := regexp_replace(new.slug, '[^a-z0-9 -]', '', 'g');
  new.slug := trim(regexp_replace(new.slug, '\s+', ' ', 'g'));

  if char_length(new.slug) < 2 then
    raise exception 'La etiqueta necesita al menos 2 caracteres válidos.';
  end if;

  -- Máximo 5 por reseña: una lista larga de etiquetas deja de informar
  if TG_OP = 'INSERT' and (
    select count(*) from public.etiquetas where review_id = new.review_id
  ) >= 5 then
    raise exception 'Una reseña admite como máximo 5 etiquetas.';
  end if;

  return new;
end;
$$;

drop trigger if exists etiquetas_normalizar on public.etiquetas;
create trigger etiquetas_normalizar
  before insert or update on public.etiquetas
  for each row execute function public.normalizar_etiqueta();


-- ───────────────────────────────────────────────────────────────────────
-- 3. ETIQUETAS SUGERIDAS
--
--    Las más usadas de toda la aplicación, para proponerlas al escribir.
--    Si aún no hay ninguna, se devuelven unas cuantas de arranque: una
--    lista vacía no ayuda a nadie a empezar.
-- ───────────────────────────────────────────────────────────────────────
drop function if exists public.etiquetas_populares(integer);

create or replace function public.etiquetas_populares(limite integer default 12)
returns table (slug text, nombre text, usos bigint)
language sql
security invoker
set search_path = public
stable
as $$
  with usadas as (
    select e.slug, min(e.nombre) as nombre, count(*) as usos
    from public.etiquetas e
    group by e.slug
    order by count(*) desc, e.slug
    limit greatest(1, least(limite, 40))
  ),
  arranque (slug, nombre, usos) as (
    values
      ('nostalgia',              'nostalgia',              0::bigint),
      ('me marco',               'me marcó',               0::bigint),
      ('no envejecio bien',      'no envejeció bien',      0::bigint),
      ('mejor de lo que recordaba','mejor de lo que recordaba', 0::bigint),
      ('opening inolvidable',    'opening inolvidable',    0::bigint),
      ('la veia con mi familia', 'la veía con mi familia', 0::bigint),
      ('me daba miedo',          'me daba miedo',          0::bigint),
      ('sobrevalorada',          'sobrevalorada',          0::bigint)
  )
  select * from usadas
  union all
  select * from arranque
  where not exists (select 1 from usadas)
  limit greatest(1, least(limite, 40));
$$;

grant execute on function public.etiquetas_populares(integer) to anon, authenticated;


-- ───────────────────────────────────────────────────────────────────────
-- 4. LAS RESEÑAS DEVUELVEN SUS ETIQUETAS
-- ───────────────────────────────────────────────────────────────────────
drop function if exists public.resenas_de_serie(integer, text, integer);
drop function if exists public.resenas_de_serie(integer, text, integer, boolean, boolean);
drop function if exists public.resenas_de_serie(integer, text, integer, boolean, boolean, text);

create or replace function public.resenas_de_serie(
  p_serie            integer,
  p_orden            text    default 'populares',
  p_limite           integer default 30,
  p_solo_seguidos    boolean default false,
  p_excluir_seguidos boolean default false,
  p_etiqueta         text    default null
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
  comentarios  bigint,
  etiquetas    text[]
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
    (select count(*) from public.review_comments c where c.review_id = rv.id),
    array(select e.nombre from public.etiquetas e
           where e.review_id = rv.id order by e.created_at)
  from public.reviews rv
  join public.profiles p on p.id = rv.user_id
  where rv.serie_id = p_serie
    and (not p_solo_seguidos or exists (
          select 1 from public.follows f
          where f.follower_id = auth.uid() and f.following_id = rv.user_id))
    and (not p_excluir_seguidos or not exists (
          select 1 from public.follows f
          where f.follower_id = auth.uid() and f.following_id = rv.user_id))
    and (not p_solo_seguidos or rv.user_id <> auth.uid())
    and (p_etiqueta is null or exists (
          select 1 from public.etiquetas e
          where e.review_id = rv.id and e.slug = p_etiqueta))
  order by
    (rv.user_id = auth.uid()) desc,
    case when p_orden = 'populares' then
      (select count(*) from public.review_likes l where l.review_id = rv.id)
    end desc nulls last,
    rv.created_at desc
  limit greatest(1, least(p_limite, 100));
$$;

grant execute on function public.resenas_de_serie(integer, text, integer, boolean, boolean, text)
  to anon, authenticated;


-- ───────────────────────────────────────────────────────────────────────
-- 5. ETIQUETAS DE UNA SERIE
--    Las que ha usado la gente al reseñar esa serie concreta, para
--    poder filtrar por ellas desde su ficha.
-- ───────────────────────────────────────────────────────────────────────
drop function if exists public.etiquetas_de_serie(integer);

create or replace function public.etiquetas_de_serie(p_serie integer)
returns table (slug text, nombre text, usos bigint)
language sql
security invoker
set search_path = public
stable
as $$
  select e.slug, min(e.nombre), count(*)
  from public.etiquetas e
  join public.reviews rv on rv.id = e.review_id
  where rv.serie_id = p_serie
  group by e.slug
  order by count(*) desc, e.slug
  limit 12;
$$;

grant execute on function public.etiquetas_de_serie(integer) to anon, authenticated;


-- ───────────────────────────────────────────────────────────────────────
-- 6. COMPROBACIÓN
-- ───────────────────────────────────────────────────────────────────────
select slug, nombre, usos from public.etiquetas_populares(8);
