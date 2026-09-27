-- ═══════════════════════════════════════════════════════════════════════
-- AnimaFilm — 17. Listas de la comunidad
--
-- Hasta ahora las listas solo se veían entrando al perfil de alguien.
-- Esto añade una sección para descubrirlas y poder guardarlas.
--
-- Ejecutar en Supabase → SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────
-- 1. GUARDAR LISTAS AJENAS
-- ───────────────────────────────────────────────────────────────────────
create table if not exists public.lista_guardada (
  lista_id  uuid references public.listas(id)   on delete cascade,
  user_id   uuid references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (lista_id, user_id)
);

alter table public.lista_guardada enable row level security;

drop policy if exists "guardada_select_all" on public.lista_guardada;
drop policy if exists "guardada_insert_own" on public.lista_guardada;
drop policy if exists "guardada_delete_own" on public.lista_guardada;

create policy "guardada_select_all" on public.lista_guardada for select using (true);
create policy "guardada_insert_own" on public.lista_guardada for insert with check (auth.uid() = user_id);
create policy "guardada_delete_own" on public.lista_guardada for delete using (auth.uid() = user_id);

create index if not exists idx_guardada_lista on public.lista_guardada(lista_id);
create index if not exists idx_guardada_user  on public.lista_guardada(user_id);


-- ───────────────────────────────────────────────────────────────────────
-- 2. LISTAS PÚBLICAS, CON PORTADA Y RECUENTOS
--
--    `p_orden`:
--      'populares' → más guardadas
--      'recientes' → actualizadas hace menos
--      'guardadas' → solo las que ha guardado el usuario actual
--
--    Las portadas son los cuatro primeros pósters de la lista: sin ellas
--    una lista es solo un título, y no invita a entrar.
-- ───────────────────────────────────────────────────────────────────────
drop function if exists public.listas_comunidad(text, integer);

create or replace function public.listas_comunidad(
  p_orden  text default 'populares',
  p_limite integer default 20
)
returns table (
  id           uuid,
  nombre       text,
  descripcion  text,
  num_series   bigint,
  guardados    bigint,
  la_guardo    boolean,
  updated_at   timestamptz,
  user_id      uuid,
  username     text,
  display_name text,
  avatar_emoji text,
  avatar_color text,
  portadas     text[]
)
language sql
security invoker
set search_path = public
stable
as $$
  select
    l.id, l.nombre, l.descripcion,
    (select count(*) from public.lista_series ls where ls.lista_id = l.id),
    (select count(*) from public.lista_guardada g where g.lista_id = l.id),
    exists (select 1 from public.lista_guardada g
             where g.lista_id = l.id and g.user_id = auth.uid()),
    l.updated_at,
    p.id, p.username, p.display_name, p.avatar_emoji, p.avatar_color,
    array(
      select s.poster_url
      from public.lista_series ls
      join public.series s on s.id = ls.serie_id
      where ls.lista_id = l.id and s.poster_url is not null
      order by ls.orden, ls.added_at
      limit 4
    )
  from public.listas l
  join public.profiles p on p.id = l.user_id
  where l.publica
    -- Una lista vacía no aporta nada a quien la descubre
    and (select count(*) from public.lista_series ls where ls.lista_id = l.id) > 0
    and (p_orden <> 'guardadas' or exists (
          select 1 from public.lista_guardada g
          where g.lista_id = l.id and g.user_id = auth.uid()))
  order by
    case when p_orden = 'populares' then
      (select count(*) from public.lista_guardada g where g.lista_id = l.id)
    end desc nulls last,
    l.updated_at desc
  limit greatest(1, least(p_limite, 60));
$$;

grant execute on function public.listas_comunidad(text, integer) to anon, authenticated;


-- ───────────────────────────────────────────────────────────────────────
-- 3. LÍMITE ANTI-ABUSO
-- ───────────────────────────────────────────────────────────────────────
create or replace function public.limite_guardadas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.lista_guardada
      where user_id = new.user_id and created_at > now() - interval '1 hour') >= 100 then
    raise exception 'Has guardado demasiadas listas en poco tiempo.';
  end if;
  return new;
end;
$$;

drop trigger if exists guardadas_limite on public.lista_guardada;
create trigger guardadas_limite
  before insert on public.lista_guardada
  for each row execute function public.limite_guardadas();


-- ───────────────────────────────────────────────────────────────────────
-- 4. LA VISTA DE LISTAS EXPONE LOS GUARDADOS
-- ───────────────────────────────────────────────────────────────────────
create or replace view public.listas_con_datos as
select
  l.id, l.user_id, l.nombre, l.descripcion, l.publica,
  l.created_at, l.updated_at,
  p.username, p.display_name,
  (select count(*) from public.lista_series   ls where ls.lista_id = l.id) as num_series,
  (select count(*) from public.lista_guardada g  where g.lista_id  = l.id) as guardados
from public.listas l
join public.profiles p on p.id = l.user_id;

alter view public.listas_con_datos set (security_invoker = on);
grant select on public.listas_con_datos to anon, authenticated;


-- ───────────────────────────────────────────────────────────────────────
-- 5. COMPROBACIÓN
-- ───────────────────────────────────────────────────────────────────────
select nombre, username, num_series, guardados
from public.listas_comunidad('populares', 10);
