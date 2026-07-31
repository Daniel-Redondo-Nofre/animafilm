// src/lib/tmdb.js — carga lazy por lotes, no todo a la vez
const TMDB_KEY = import.meta.env.VITE_TMDB_API_KEY;
const BASE     = "https://api.themoviedb.org/3";
const IMG      = "https://image.tmdb.org/t/p/w300";

// Cache en memoria para no repetir peticiones
const cache = new Map();

async function searchPoster(query) {
  if (cache.has(query)) return cache.get(query);
  const res  = await fetch(`${BASE}/search/tv?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}&language=es-ES`);
  const data = await res.json();
  const url  = data.results?.[0]?.poster_path ? IMG + data.results[0].poster_path : null;
  cache.set(query, url);
  return url;
}

// Carga UN poster bajo demanda (para lazy loading por tarjeta)
export async function fetchPoster(serie) {
  if (!TMDB_KEY) return null;
  try {
    let url = await searchPoster(serie.titulo);
    if (!url && serie.englishTitle) url = await searchPoster(serie.englishTitle);
    return url;
  } catch { return null; }
}

// Carga en lotes de N para no saturar la API
export async function fetchAllPosters(series, batchSize = 6, onBatch) {
  if (!TMDB_KEY) return {};
  const posters = {};
  for (let i = 0; i < series.length; i += batchSize) {
    const batch = series.slice(i, i + batchSize);
    await Promise.all(batch.map(async (s) => {
      const url = await fetchPoster(s);
      if (url) posters[s.id] = url;
    }));
    if (onBatch) onBatch({ ...posters }); // actualiza la UI tras cada lote
    // pequeña pausa entre lotes para no saturar la API de TMDB
    if (i + batchSize < series.length) await new Promise(r => setTimeout(r, 120));
  }
  return posters;
}
