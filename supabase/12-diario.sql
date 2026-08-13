-- ═══════════════════════════════════════════════════════════════════════
-- AnimaFilm — 12. Diario de visionado
--
-- Hasta ahora `watched` guardaba un sí/no por serie: la habías visto o
-- no. Letterboxd funciona al revés: su unidad no es la película, es la
-- SESIÓN. Puedes registrar que viste algo el 3 de marzo, y otra vez en
-- julio, y cada visionado tiene su fecha.
--
-- Esta migración convierte `watched` en un diario:
--   · varias entradas por serie
--   · fecha de visionado editable (no solo "cuándo lo marqué")
--   · marca de "revisión" para los revisionados
--
-- Los datos existentes se conservan como la primera entrada de cada uno.
--
-- Ejecutar en Supabase → SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────
-- 1. TABLA DEL DIARIO
-- ───────────────────────────────────────────────────────────────────────
create table if not exists public.diario (
  id         bigserial primary key,
  user_id    uuid    references public.profiles(id) on delete cascade not null,
  serie_id   integer references public.series(id)   on delete cascade not null,
  -- Fecha del visionado, no del registro: se puede apuntar algo que
  -- viste la semana pasada.
  vista_el   date    not null default current_date,
  revision   boolean not null default false,
  nota       text,
  created_at timestamptz default now()
);

alter table public.diario enable row level security;

drop policy if exists "diario_select_all" on public.diario;
drop policy if exists "diario_insert_own" on public.diario;
drop policy if exists "diario_update_own" on public.diario;
drop policy if exists "diario_delete_own" on public.diario;

create policy "diario_select_all" on public.diario for select using (true);
create policy "diario_insert_own" on public.diario for insert with check (auth.uid() = user_id);
create policy "diario_update_own" on public.diario for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "diario_delete_own" on public.diario for delete using (auth.uid() = user_id);

-- No se puede apuntar un visionado en el futuro
alter table public.diario drop constraint if exists diario_fecha_valida;
alter table public.diario add  constraint diario_fecha_valida
  check (vista_el <= current_date + 1 and vista_el >= '1970-01-01');

alter table public.diario drop constraint if exists diario_nota_len;
alter table public.diario add  constraint diario_nota_len
  check (nota is null or char_length(nota) <= 280);

create index if not exists idx_diario_user   on public.diario(user_id, vista_el desc);
create index if not exists idx_diario_serie  on public.diario(serie_id);
create index if not exists idx_diario_fecha  on public.diario(vista_el desc);


-- ───────────────────────────────────────────────────────────────────────
-- 2. LÍMITE ANTI-ABUSO
-- ───────────────────────────────────────────────────────────────────────
create or replace function public.limite_diario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.diario
      where user_id = new.user_id and created_at > now() - interval '1 hour') >= 200 then
    raise exception 'Demasiadas entradas en poco tiempo. Espera un rato.';
  end if;
  -- Un mismo día, una misma serie, una sola vez: evita duplicados por
  -- doble clic sin impedir revisionados en fechas distintas.
  if exists (select 1 from public.diario
             where user_id = new.user_id and serie_id = new.serie_id
               and vista_el = new.vista_el
               and (TG_OP = 'INSERT' or id <> new.id)) then
    raise exception 'Ya tienes esa serie apuntada ese día.';
  end if;
  return new;
end;
$$;

drop trigger if exists diario_limite on public.diario;
create trigger diario_limite
  before insert or update on public.diario
  for each row execute function public.limite_diario();


-- ───────────────────────────────────────────────────────────────────────
-- 3. MIGRAR LO QUE YA EXISTE
--
--    Cada fila de `watched` pasa a ser la primera entrada del diario.
--    `watched` se conserva: sigue siendo la respuesta rápida a "¿la he
--    visto?", y mantenerla evita reescribir media aplicación.
-- ───────────────────────────────────────────────────────────────────────
insert into public.diario (user_id, serie_id, vista_el, revision, created_at)
select w.user_id, w.serie_id, w.watched_at::date, false, w.watched_at
from public.watched w
where not exists (
  select 1 from public.diario d
  where d.user_id = w.user_id and d.serie_id = w.serie_id
)
on conflict do nothing;


-- ───────────────────────────────────────────────────────────────────────
-- 4. SINCRONÍA AUTOMÁTICA
--
--    Apuntar algo en el diario lo marca como visto. Borrar la última
--    entrada lo desmarca. Así las dos tablas nunca se contradicen sin
--    que el cliente tenga que acordarse de actualizar ambas.
-- ───────────────────────────────────────────────────────────────────────
create or replace function public.sincronizar_watched()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.watched (user_id, serie_id, watched_at)
    values (new.user_id, new.serie_id, new.vista_el::timestamptz)
    on conflict (user_id, serie_id) do nothing;
    -- Verla la saca de pendientes
    delete from public.watchlist
     where user_id = new.user_id and serie_id = new.serie_id;
    return new;
  end if;

  if TG_OP = 'DELETE' then
    if not exists (select 1 from public.diario
                   where user_id = old.user_id and serie_id = old.serie_id
                     and id <> old.id) then
      delete from public.watched
       where user_id = old.user_id and serie_id = old.serie_id;
    end if;
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists diario_sync_ins on public.diario;
create trigger diario_sync_ins
  after insert on public.diario
  for each row execute function public.sincronizar_watched();

drop trigger if exists diario_sync_del on public.diario;
create trigger diario_sync_del
  after delete on public.diario
  for each row execute function public.sincronizar_watched();


-- ───────────────────────────────────────────────────────────────────────
-- 5. CONSULTAS
-- ───────────────────────────────────────────────────────────────────────

-- Diario de un usuario, con los datos de la serie y su nota
create or replace function public.diario_de(usuario uuid, limite integer default 60)
returns table (
  id          bigint,
  serie_id    integer,
  vista_el    date,
  revision    boolean,
  nota        text,
  titulo      text,
  anio        integer,
  decada      text,
  color       text,
  poster_url  text,
  rating      integer
)
language sql
security invoker
set search_path = public
stable
as $$
  select
    d.id, d.serie_id, d.vista_el, d.revision, d.nota,
    s.titulo, s.anio, s.decada, s.color, s.poster_url,
    (select r.rating from public.ratings r
      where r.user_id = d.user_id and r.serie_id = d.serie_id)
  from public.diario d
  join public.series s on s.id = d.serie_id
  where d.user_id = usuario
  order by d.vista_el desc, d.created_at desc
  limit greatest(1, least(limite, 200));
$$;

grant execute on function public.diario_de(uuid, integer) to anon, authenticated;


-- Visionados de UNA serie por parte del usuario actual
create or replace function public.mis_visionados(p_serie integer)
returns table (id bigint, vista_el date, revision boolean, nota text)
language sql
security invoker
set search_path = public
stable
as $$
  select d.id, d.vista_el, d.revision, d.nota
  from public.diario d
  where d.user_id = auth.uid() and d.serie_id = p_serie
  order by d.vista_el desc;
$$;

grant execute on function public.mis_visionados(integer) to authenticated;


-- Resumen por meses: alimenta el calendario del perfil
create or replace function public.diario_por_mes(usuario uuid, anio integer)
returns table (mes integer, total bigint)
language sql
security invoker
set search_path = public
stable
as $$
  select extract(month from d.vista_el)::integer, count(*)
  from public.diario d
  where d.user_id = usuario
    and extract(year from d.vista_el) = anio
  group by 1
  order by 1;
$$;

grant execute on function public.diario_por_mes(uuid, integer) to anon, authenticated;


-- ───────────────────────────────────────────────────────────────────────
-- 6. EL PERFIL CUENTA VISIONADOS Y REVISIONES
-- ───────────────────────────────────────────────────────────────────────
drop view if exists public.perfiles_publicos;

create view public.perfiles_publicos as
select
  p.id, p.username, p.display_name, p.bio, p.created_at,
  p.avatar_emoji, p.avatar_color, p.favoritas,
  (select count(*)                            from public.watched  w  where w.user_id      = p.id) as vistas,
  (select count(*)                            from public.diario   d  where d.user_id      = p.id) as visionados,
  (select count(*)                            from public.diario   d  where d.user_id      = p.id and d.revision) as revisiones,
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
-- 7. COMPROBACIÓN
-- ───────────────────────────────────────────────────────────────────────
select count(*) as entradas_diario from public.diario;
select username, vistas, visionados, revisiones from public.perfiles_publicos
order by visionados desc limit 5;
