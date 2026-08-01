// src/lib/series.js
// El catálogo vive en Supabase, no en el código. Una sola consulta trae
// series y pósters; antes eran 30 peticiones a TMDB en cada carga.

import { supabase } from "./supabase";

let cache = null;
let inflight = null;

// La base usa `anio` (sin ñ ni tildes, más seguro en SQL); la interfaz
// venía usando `año`. Traducimos aquí para no tocar el resto del código.
function normalize(row) {
  return {
    id:          row.id,
    titulo:      row.titulo,
    englishTitle: row.titulo_en,
    año:         row.anio,
    decada:      row.decada,
    cadena:      row.cadena,
    episodios:   row.episodios,
    generos:     row.generos ?? [],
    descripcion: row.descripcion,
    color:       row.color || "#8B1A00",
    poster:      row.poster_url || null,
  };
}

export async function fetchSeries() {
  if (cache) return cache;
  if (inflight) return inflight;

  inflight = (async () => {
    const { data, error } = await supabase
      .from("series")
      .select("*")
      .order("anio", { ascending: true });

    if (error) {
      inflight = null;
      throw new Error(error.message);
    }
    cache = (data ?? []).map(normalize);
    inflight = null;
    return cache;
  })();

  return inflight;
}

// Nota media de la comunidad, votos, vistas y reseñas por serie.
// Se calcula en el servidor: el navegador no descarga las valoraciones.
export async function fetchSeriesStats() {
  const { data, error } = await supabase
    .from("series_stats")
    .select("serie_id, votos, nota_media, vistas_totales, num_resenas");

  if (error) {
    console.warn("No se pudieron cargar las estadísticas:", error.message);
    return {};
  }
  return Object.fromEntries(data.map(r => [r.serie_id, r]));
}

export function clearSeriesCache() { cache = null; }

// Los pósters se guardan en w342. En la rejilla las tarjetas miden ~165px,
// así que servir w342 gasta el doble de datos de lo necesario. w185 cubre
// pantallas normales y de retina razonablemente.
export function poster(url, tam = "w185") {
  if (!url) return null;
  return url.replace(/\/w\d+\//, `/${tam}/`);
}
