-- ═══════════════════════════════════════════════════════════════════════
-- AnimaFilm — 03. Migración del catálogo a la base de datos
--
-- Hasta ahora las 30 series vivían en un array dentro de App.jsx. Eso
-- significaba que `ratings.serie_id` no apuntaba a ninguna tabla real:
-- si quitabas una serie del código, quedaban valoraciones huérfanas
-- apuntando a un id inexistente.
--
-- Ejecutar entero en Supabase → SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────
-- 1. TABLA DE SERIES
-- ───────────────────────────────────────────────────────────────────────
create table if not exists public.series (
  id          integer primary key,
  titulo      text    not null,
  titulo_en   text,
  anio        integer not null check (anio between 1950 and 2030),
  decada      text    not null check (decada in ('70s','80s','90s','00s')),
  cadena      text,
  episodios   integer check (episodios >= 0),
  generos     text[]  not null default '{}',
  descripcion text,
  color       text    not null default '#8B1A00',
  poster_url  text,
  created_at  timestamptz default now()
);

alter table public.series enable row level security;

drop policy if exists "series_select_all" on public.series;
create policy "series_select_all" on public.series for select using (true);
-- Sin políticas de escritura: el catálogo solo se toca desde el panel.

create index if not exists idx_series_decada on public.series(decada);
create index if not exists idx_series_anio   on public.series(anio);


-- ───────────────────────────────────────────────────────────────────────
-- 2. LOS DATOS
-- ───────────────────────────────────────────────────────────────────────
insert into public.series (id, titulo, titulo_en, anio, decada, cadena, episodios, generos, descripcion, color)
values
  (1, 'Heidi', 'Heidi', 1974, '70s', 'TVE 1', 52, array['Drama', 'Aventura']::text[], 'Niña huérfana que vive en los Alpes suizos con su abuelo. Una de las series más queridas de la infancia española.', '#C47A3A'),
  (2, 'Marco', '3000 Leagues', 1976, '70s', 'TVE 1', 52, array['Drama', 'Aventura']::text[], 'Un niño genovés viaja desde Italia hasta Argentina en busca de su madre emigrante.', '#4A7E5A'),
  (3, 'Érase una vez el hombre', 'Once Upon a Time Man', 1978, '70s', 'TVE 1', 26, array['Educativo', 'Historia']::text[], 'Serie educativa que narra la historia de la humanidad desde la prehistoria hasta el siglo XX.', '#4A6E9A'),
  (4, 'Don Quijote de la Mancha', 'Don Quixote', 1979, '70s', 'TVE 1', 39, array['Aventura', 'Comedia']::text[], 'Adaptación animada de la obra maestra de Cervantes. Producción íntegramente española.', '#8A5E30'),
  (5, 'La abeja Maya', 'Maya the Bee', 1975, '70s', 'TVE 1', 104, array['Infantil', 'Aventura']::text[], 'Las aventuras de Maya, una pequeña abeja curiosa que explora el mundo de los insectos.', '#C8A820'),
  (6, 'Mazinger Z', 'Mazinger Z', 1978, '70s', 'TVE 1', 92, array['Acción', 'Mecha']::text[], 'El robot gigante pilotado por Koji Kabuto lucha contra el infame Doctor Infierno.', '#2A5E8A'),
  (7, 'Vicky el vikingo', 'Vicky the Viking', 1974, '70s', 'TVE 1', 78, array['Aventura', 'Comedia']::text[], 'El pequeño Vicky usa su ingenio en lugar de la fuerza para resolver problemas.', '#B85A40'),
  (8, 'Los Pitufos', 'The Smurfs', 1981, '80s', 'TVE 1', 256, array['Infantil', 'Fantasía']::text[], 'Los pequeños seres azules del bosque, siempre perseguidos por el malvado Gargamel.', '#2A50A0'),
  (9, 'David el gnomo', 'The World of David the Gnome', 1985, '80s', 'TVE 1', 26, array['Infantil', 'Fantasía']::text[], 'Producción española sobre un médico gnomo que ayuda a los animales del bosque.', '#3A8A4A'),
  (10, 'Oliver y Benji', 'Captain Tsubasa', 1983, '80s', 'TVE 1', 128, array['Deporte', 'Drama']::text[], 'Las aventuras futbolísticas de Oliver Atom y su mejor amigo Benji.', '#1A7040'),
  (11, 'Bola de Dragón', 'Dragon Ball', 1986, '80s', 'TVE 1', 153, array['Acción', 'Aventura']::text[], 'Las aventuras del joven Goku en busca de las siete esferas del dragón.', '#C07010'),
  (12, 'Inspector Gadget', 'Inspector Gadget', 1983, '80s', 'La 2', 86, array['Comedia', 'Acción']::text[], 'El torpe inspector biónico lucha contra MAD, ayudado en secreto por su sobrina Penny.', '#6A4A90'),
  (13, 'Doraemon', 'Doraemon', 1988, '80s', 'TVE 1', 1787, array['Comedia', 'Ciencia ficción']::text[], 'El gato robot del futuro ayuda al torpe Nobita con sus fantásticos inventos.', '#1A70C0'),
  (14, 'Thundercats', 'ThunderCats', 1985, '80s', 'TVE 1', 130, array['Acción', 'Fantasía']::text[], 'Los felinos humanoides del planeta Thundera luchan con la Espada del Augurio.', '#A04030'),
  (15, 'Candy Candy', 'Candy Candy', 1982, '80s', 'TVE 1', 115, array['Romance', 'Drama']::text[], 'Las peripecias de la huerfanita Candy en su búsqueda del amor y la felicidad.', '#B84870'),
  (16, 'Dragon Ball Z', 'Dragon Ball Z', 1990, '90s', 'Telecinco', 291, array['Acción', 'Aventura']::text[], 'Goku y sus amigos defienden la Tierra contra supervillanos. La infancia de toda una generación.', '#C02010'),
  (17, 'Sailor Moon', 'Sailor Moon', 1993, '90s', 'Telecinco', 200, array['Acción', 'Romance']::text[], 'Usagi Tsukino protege el amor y la justicia como la guerrera Sailor Moon.', '#B03878'),
  (18, 'Los Caballeros del Zodiaco', 'Saint Seiya', 1991, '90s', 'TVE 1', 114, array['Acción', 'Aventura']::text[], 'Los Caballeros de Atenea luchan para proteger a la diosa y a la humanidad.', '#2A4890'),
  (19, 'Shin Chan', 'Crayon Shin-chan', 1993, '90s', 'Telecinco', 1200, array['Comedia']::text[], 'Las gamberradas del irreverente niño de cinco años Shinnosuke Nohara.', '#C09010'),
  (20, 'Pokémon', 'Pokemon', 1998, '90s', 'TVE 1', 1200, array['Aventura', 'Acción']::text[], 'Ash Ketchum y Pikachu viajan para convertirse en Maestros Pokémon.', '#C09A00'),
  (21, 'Digimon', 'Digimon', 1999, '90s', 'Fox Kids', 54, array['Aventura', 'Acción']::text[], 'Niños transportados al Mundo Digital donde hacen amistad con criaturas que evolucionan.', '#2858A0'),
  (22, 'Ranma 1/2', 'Ranma 1/2', 1992, '90s', 'TVE 1', 161, array['Comedia', 'Acción']::text[], 'Un joven que se transforma en chica al contacto con el agua fría.', '#A01818'),
  (23, 'Dexter', 'Dexter''s Laboratory', 1998, '90s', 'Cartoon Network', 78, array['Comedia', 'Ciencia ficción']::text[], 'Un joven genio con laboratorio secreto que su hermana Dee Dee siempre acaba destrozando.', '#6030A0'),
  (24, 'Cardcaptor Sakura', 'Cardcaptor Sakura', 1999, '90s', 'TVE 1', 70, array['Fantasía', 'Romance']::text[], 'Sakura debe recuperar las Cartas Clow que liberó accidentalmente.', '#A03878'),
  (25, 'Bob Esponja', 'SpongeBob SquarePants', 1999, '00s', 'Nickelodeon', 400, array['Comedia', 'Infantil']::text[], 'Las aventuras de la esponja más optimista del fondo marino en el colorido Fondo de Bikini.', '#A08800'),
  (26, 'Naruto', 'Naruto', 2002, '00s', 'Jetix', 220, array['Acción', 'Aventura']::text[], 'Un joven ninja sueña con convertirse en Hokage y ser reconocido por todos.', '#C06010'),
  (27, 'Yu-Gi-Oh!', 'Yu-Gi-Oh!', 2001, '00s', 'Cartoon Network', 224, array['Acción', 'Deporte']::text[], 'Yugi y el espíritu del Faraón compiten en duelos de cartas mágicas para salvar el mundo.', '#6830A0'),
  (28, 'Kim Possible', 'Kim Possible', 2002, '00s', 'Disney Channel', 87, array['Acción', 'Comedia']::text[], 'Una adolescente salva el mundo de supervillanos mientras lidia con el instituto.', '#2A7040'),
  (29, 'Los Lunnis', 'Los Lunnis', 2003, '00s', 'La 2', 1000, array['Infantil', 'Musical']::text[], 'Los coloridos muñecos de TVE acompañaban a los más pequeños con canciones y aventuras.', '#208070'),
  (30, 'Inuyasha', 'Inuyasha', 2002, '00s', 'Jetix', 167, array['Acción', 'Romance']::text[], 'Una chica moderna viaja al Japón feudal y lucha junto al semidemon Inuyasha.', '#903060')
on conflict (id) do update set
  titulo      = excluded.titulo,
  titulo_en   = excluded.titulo_en,
  anio        = excluded.anio,
  decada      = excluded.decada,
  cadena      = excluded.cadena,
  episodios   = excluded.episodios,
  generos     = excluded.generos,
  descripcion = excluded.descripcion,
  color       = excluded.color;


-- ───────────────────────────────────────────────────────────────────────
-- 3. INTEGRIDAD REFERENCIAL
--
--    Ahora `serie_id` apunta de verdad al catálogo. Las viejas
--    restricciones de rango (1..500) sobran: la clave foránea es mejor.
-- ───────────────────────────────────────────────────────────────────────
alter table public.ratings   drop constraint if exists ratings_serie_range;
alter table public.reviews   drop constraint if exists reviews_serie_range;
alter table public.watched   drop constraint if exists watched_serie_range;
alter table public.watchlist drop constraint if exists watchlist_serie_range;

-- Limpia filas huérfanas antes de crear las claves foráneas
delete from public.ratings   where serie_id not in (select id from public.series);
delete from public.reviews   where serie_id not in (select id from public.series);
delete from public.watched   where serie_id not in (select id from public.series);
delete from public.watchlist where serie_id not in (select id from public.series);

alter table public.ratings   drop constraint if exists ratings_serie_fk;
alter table public.ratings   add  constraint ratings_serie_fk
  foreign key (serie_id) references public.series(id) on delete cascade;

alter table public.reviews   drop constraint if exists reviews_serie_fk;
alter table public.reviews   add  constraint reviews_serie_fk
  foreign key (serie_id) references public.series(id) on delete cascade;

alter table public.watched   drop constraint if exists watched_serie_fk;
alter table public.watched   add  constraint watched_serie_fk
  foreign key (serie_id) references public.series(id) on delete cascade;

alter table public.watchlist drop constraint if exists watchlist_serie_fk;
alter table public.watchlist add  constraint watchlist_serie_fk
  foreign key (serie_id) references public.series(id) on delete cascade;


-- ───────────────────────────────────────────────────────────────────────
-- 4. ESTADÍSTICAS DE LA COMUNIDAD
--
--    Una vista con la nota media, número de votos, cuánta gente la ha
--    visto y cuántas reseñas tiene cada serie. Se calcula en el servidor,
--    así que el navegador no tiene que descargarse todas las valoraciones.
-- ───────────────────────────────────────────────────────────────────────
create or replace view public.series_stats as
select
  s.id                                          as serie_id,
  count(distinct r.user_id)                     as votos,
  round(avg(r.rating)::numeric, 2)              as nota_media,
  count(distinct w.user_id)                     as vistas_totales,
  count(distinct rv.id)                         as num_resenas
from public.series s
left join public.ratings r  on r.serie_id  = s.id
left join public.watched w  on w.serie_id  = s.id
left join public.reviews rv on rv.serie_id = s.id
group by s.id;

-- security_invoker: la vista respeta las políticas RLS de quien consulta,
-- en lugar de ejecutarse con los permisos del propietario.
alter view public.series_stats set (security_invoker = on);

grant select on public.series_stats to anon, authenticated;


-- ───────────────────────────────────────────────────────────────────────
-- 5. COMPROBACIÓN
-- ───────────────────────────────────────────────────────────────────────
select count(*) as series_en_catalogo from public.series;
select * from public.series_stats order by nota_media desc nulls last limit 10;
