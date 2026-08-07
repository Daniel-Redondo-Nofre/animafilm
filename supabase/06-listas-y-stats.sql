-- ═══════════════════════════════════════════════════════════════════════
-- AnimaFilm — 06. Listas personalizadas y estadísticas globales
-- Ejecutar en Supabase → SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────
-- 1. LISTAS
-- ───────────────────────────────────────────────────────────────────────
create table if not exists public.listas (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles(id) on delete cascade not null,
  nombre      text not null check (char_length(trim(nombre)) between 1 and 60),
  descripcion text check (descripcion is null or char_length(descripcion) <= 300),
  publica     boolean not null default true,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create table if not exists public.lista_series (
  lista_id uuid    references public.listas(id) on delete cascade,
  serie_id integer references public.series(id) on delete cascade,
  orden    integer not null default 0,
  added_at timestamptz default now(),
  primary key (lista_id, serie_id)
);

alter table public.listas       enable row level security;
alter table public.lista_series enable row level security;

-- ── Políticas de listas ────────────────────────────────────────────────
drop policy if exists "listas_select" on public.listas;
drop policy if exists "listas_insert" on public.listas;
drop policy if exists "listas_update" on public.listas;
drop policy if exists "listas_delete" on public.listas;

-- Las públicas las ve cualquiera; las privadas, solo su dueño
create policy "listas_select" on public.listas for select
  using (publica or auth.uid() = user_id);
create policy "listas_insert" on public.listas for insert
  with check (auth.uid() = user_id);
create policy "listas_update" on public.listas for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "listas_delete" on public.listas for delete
  using (auth.uid() = user_id);

-- ── Políticas del contenido ────────────────────────────────────────────
-- Se derivan de la lista padre: si puedes ver la lista, ves su contenido.
drop policy if exists "lista_series_select" on public.lista_series;
drop policy if exists "lista_series_write"  on public.lista_series;

create policy "lista_series_select" on public.lista_series for select
  using (exists (
    select 1 from public.listas l
    where l.id = lista_id and (l.publica or l.user_id = auth.uid())
  ));

create policy "lista_series_write" on public.lista_series for all
  using (exists (
    select 1 from public.listas l where l.id = lista_id and l.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.listas l where l.id = lista_id and l.user_id = auth.uid()
  ));

-- ── updated_at ─────────────────────────────────────────────────────────
drop trigger if exists listas_updated_at on public.listas;
create trigger listas_updated_at
  before update on public.listas
  for each row execute function public.update_updated_at();

-- ── Límites ────────────────────────────────────────────────────────────
-- Sin esto, alguien con la anon key puede crear listas hasta llenar la
-- base de datos. Las políticas dicen QUIÉN escribe, no CUÁNTO.
create or replace function public.limite_listas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.listas where user_id = new.user_id) >= 40 then
    raise exception 'Has alcanzado el máximo de 40 listas.';
  end if;
  return new;
end;
$$;

drop trigger if exists listas_limite on public.listas;
create trigger listas_limite
  before insert on public.listas
  for each row execute function public.limite_listas();

create or replace function public.limite_lista_series()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.lista_series where lista_id = new.lista_id) >= 200 then
    raise exception 'Una lista no puede tener más de 200 series.';
  end if;
  return new;
end;
$$;

drop trigger if exists lista_series_limite on public.lista_series;
create trigger lista_series_limite
  before insert on public.lista_series
  for each row execute function public.limite_lista_series();

-- ── Índices ────────────────────────────────────────────────────────────
create index if not exists idx_listas_user     on public.listas(user_id);
create index if not exists idx_listas_publica  on public.listas(publica, updated_at desc);
create index if not exists idx_lista_series_l  on public.lista_series(lista_id);

-- ── Vista con el recuento y el autor ───────────────────────────────────
create or replace view public.listas_con_datos as
select
  l.id, l.user_id, l.nombre, l.descripcion, l.publica,
  l.created_at, l.updated_at,
  p.username, p.display_name,
  (select count(*) from public.lista_series ls where ls.lista_id = l.id) as num_series
from public.listas l
join public.profiles p on p.id = l.user_id;

alter view public.listas_con_datos set (security_invoker = on);
grant select on public.listas_con_datos to anon, authenticated;


-- ───────────────────────────────────────────────────────────────────────
-- 2. ESTADÍSTICAS GLOBALES
--
--    Se calculan en el servidor. Traer todas las valoraciones al
--    navegador para contarlas allí no escalaría.
-- ───────────────────────────────────────────────────────────────────────
create or replace view public.stats_generales as
select
  (select count(*) from public.profiles)                     as usuarios,
  (select count(*) from public.ratings)                      as valoraciones,
  (select count(*) from public.reviews)                      as resenas,
  (select count(*) from public.watched)                      as vistas_totales,
  (select count(*) from public.series)                       as series,
  (select count(*) from public.listas where publica)         as listas_publicas,
  (select round(avg(rating)::numeric, 2) from public.ratings) as nota_media_global;

alter view public.stats_generales set (security_invoker = on);
grant select on public.stats_generales to anon, authenticated;


create or replace view public.stats_por_decada as
select
  s.decada,
  count(distinct s.id)                          as series,
  count(distinct w.user_id || '-' || w.serie_id) as vistas,
  round(avg(r.rating)::numeric, 2)              as nota_media,
  count(r.id)                                    as votos
from public.series s
left join public.watched w on w.serie_id = s.id
left join public.ratings r on r.serie_id = s.id
group by s.decada;

alter view public.stats_por_decada set (security_invoker = on);
grant select on public.stats_por_decada to anon, authenticated;


-- Ranking: mejor valoradas, con un mínimo de votos para que una serie
-- con un solo 5 no se coloque por delante de una con cincuenta cuatros.
create or replace function public.top_series(criterio text default 'nota', limite integer default 10)
returns table (
  serie_id integer,
  titulo   text,
  decada   text,
  anio     integer,
  poster_url text,
  color    text,
  valor    numeric,
  votos    bigint
)
language sql
security invoker
set search_path = public
stable
as $$
  select
    s.id, s.titulo, s.decada, s.anio, s.poster_url, s.color,
    case criterio
      when 'nota'   then st.nota_media
      when 'vistas' then st.vistas_totales::numeric
      else               st.votos::numeric
    end,
    st.votos
  from public.series s
  join public.series_stats st on st.serie_id = s.id
  where case criterio
          when 'nota' then st.nota_media is not null and st.votos >= 3
          else             true
        end
  order by
    case criterio
      when 'nota'   then st.nota_media
      when 'vistas' then st.vistas_totales::numeric
      else               st.votos::numeric
    end desc nulls last,
    s.titulo
  limit greatest(1, least(limite, 50));
$$;

grant execute on function public.top_series(text, integer) to anon, authenticated;


-- ───────────────────────────────────────────────────────────────────────
-- 3. COMPROBACIÓN
-- ───────────────────────────────────────────────────────────────────────
select * from public.stats_generales;
select * from public.stats_por_decada order by decada;
select titulo, valor, votos from public.top_series('vistas', 5);
