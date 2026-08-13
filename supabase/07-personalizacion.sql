-- ═══════════════════════════════════════════════════════════════════════
-- AnimaFilm — 07. Personalización del perfil
--
-- Avatar propio, series favoritas destacadas y portada.
-- Las insignias NO se guardan: se deducen de la actividad que ya existe,
-- así no hay nada que mantener sincronizado.
--
-- Ejecutar en Supabase → SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────
-- 1. COLUMNAS NUEVAS EN PERFILES
-- ───────────────────────────────────────────────────────────────────────
alter table public.profiles add column if not exists avatar_emoji  text;
alter table public.profiles add column if not exists avatar_color  text;
alter table public.profiles add column if not exists portada_serie integer;
alter table public.profiles add column if not exists favoritas     integer[] not null default '{}';

-- El emoji ocupa entre 1 y 8 caracteres: algunos llevan modificadores de
-- tono de piel o secuencias ZWJ y pasan de un solo carácter.
alter table public.profiles drop constraint if exists profiles_emoji_len;
alter table public.profiles add  constraint profiles_emoji_len
  check (avatar_emoji is null or char_length(avatar_emoji) between 1 and 8);

-- Color en hexadecimal de 6 dígitos. Sin esto, el valor acaba insertado
-- en un atributo style: hay que validarlo en el servidor, no solo en el
-- navegador, porque la anon key es pública.
alter table public.profiles drop constraint if exists profiles_color_fmt;
alter table public.profiles add  constraint profiles_color_fmt
  check (avatar_color is null or avatar_color ~ '^#[0-9A-Fa-f]{6}$');

-- Como mucho cuatro favoritas.
-- Un CHECK no puede llevar subconsultas (Postgres lo prohíbe), así que
-- la comprobación de duplicados va en el trigger de más abajo.
alter table public.profiles drop constraint if exists profiles_favoritas_max;
alter table public.profiles add  constraint profiles_favoritas_max
  check (favoritas is null or coalesce(array_length(favoritas, 1), 0) <= 4);

alter table public.profiles drop constraint if exists profiles_portada_fk;
alter table public.profiles add  constraint profiles_portada_fk
  foreign key (portada_serie) references public.series(id) on delete set null;


-- ───────────────────────────────────────────────────────────────────────
-- 2. VALIDACIÓN AMPLIADA
--
--    El trigger de 04-cuenta-y-perfil ya normalizaba usuario, nombre y
--    bio. Le añadimos las comprobaciones de los campos nuevos.
-- ───────────────────────────────────────────────────────────────────────
create or replace function public.validar_perfil()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.username := lower(trim(new.username));

  if new.username !~ '^[a-z0-9_.-]{3,20}$' then
    raise exception 'El nombre de usuario debe tener entre 3 y 20 caracteres: letras, números, guion, punto o guion bajo.';
  end if;

  new.display_name := nullif(trim(coalesce(new.display_name, '')), '');
  new.bio          := nullif(trim(coalesce(new.bio, '')), '');
  new.avatar_emoji := nullif(trim(coalesce(new.avatar_emoji, '')), '');

  if new.display_name is not null and char_length(new.display_name) > 40 then
    raise exception 'El nombre visible no puede pasar de 40 caracteres.';
  end if;
  if new.bio is not null and char_length(new.bio) > 300 then
    raise exception 'La biografía no puede pasar de 300 caracteres.';
  end if;

  -- Las favoritas deben existir en el catálogo y no repetirse.
  -- Aquí sí podemos usar subconsultas: en un CHECK no estaría permitido.
  if coalesce(array_length(new.favoritas, 1), 0) > 0 then
    if exists (
      select 1 from unnest(new.favoritas) f
      where not exists (select 1 from public.series s where s.id = f)
    ) then
      raise exception 'Alguna de las series favoritas no existe.';
    end if;

    if array_length(new.favoritas, 1) <> (select count(distinct f) from unnest(new.favoritas) f) then
      raise exception 'No puedes repetir la misma serie en tus favoritas.';
    end if;
  end if;

  if TG_OP = 'UPDATE' and new.id <> old.id then
    raise exception 'Operación no permitida';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_validar on public.profiles;
create trigger profiles_validar
  before insert or update on public.profiles
  for each row execute function public.validar_perfil();


-- ───────────────────────────────────────────────────────────────────────
-- 3. LA VISTA PÚBLICA DEBE EXPONER LO NUEVO
--
--    `create or replace view` solo sabe AÑADIR columnas al final: no
--    puede insertarlas en medio ni reordenarlas. Como los campos nuevos
--    van tras created_at, hay que borrar la vista y rehacerla.
--    Nada depende de ella salvo el cliente, así que es seguro.
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
-- 4. VISTAS POR DÉCADA DE UN USUARIO
--    Lo necesitan las insignias de "década completada".
-- ───────────────────────────────────────────────────────────────────────
drop function if exists public.vistas_por_decada(uuid);

create or replace function public.vistas_por_decada(usuario uuid)
returns table (decada text, vistas bigint, total bigint)
language sql
security invoker
set search_path = public
stable
as $$
  select
    s.decada,
    count(*) filter (where w.user_id is not null),
    count(*)
  from public.series s
  left join public.watched w on w.serie_id = s.id and w.user_id = usuario
  group by s.decada;
$$;

grant execute on function public.vistas_por_decada(uuid) to anon, authenticated;


-- ───────────────────────────────────────────────────────────────────────
-- 5. EL BUSCADOR DEBE DEVOLVER EL AVATAR
-- ───────────────────────────────────────────────────────────────────────
drop function if exists public.buscar_usuarios(text);

create or replace function public.buscar_usuarios(texto text)
returns table (id uuid, username text, display_name text, vistas bigint,
               avatar_emoji text, avatar_color text)
language sql
security invoker
set search_path = public
stable
as $$
  select p.id, p.username, p.display_name,
         (select count(*) from public.watched w where w.user_id = p.id),
         p.avatar_emoji, p.avatar_color
  from public.profiles p
  where char_length(trim(texto)) >= 2
    and (p.username ilike '%' || trim(texto) || '%'
      or p.display_name ilike '%' || trim(texto) || '%')
  order by p.username
  limit 10;
$$;

grant execute on function public.buscar_usuarios(text) to anon, authenticated;


-- ───────────────────────────────────────────────────────────────────────
-- 6. COMPROBACIÓN
-- ───────────────────────────────────────────────────────────────────────
select username, avatar_emoji, avatar_color, favoritas, portada_serie, episodios
from public.perfiles_publicos
limit 5;
