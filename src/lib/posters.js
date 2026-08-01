// src/lib/posters.js
//
// Intenta leer los pósters de una tabla `posters` en Supabase (una sola
// consulta, y la clave de TMDB no viaja al navegador). Si esa tabla no
// existe todavía, cae de vuelta a pedirlos a TMDB como antes.
//
// Así funciona tengas o no hecha la migración.

import { supabase } from "./supabase";

async function fromSupabase() {
  const { data, error } = await supabase
    .from("posters")
    .select("serie_id, poster_url");

  if (error || !data || data.length === 0) return null;
  return Object.fromEntries(data.map(p => [p.serie_id, p.poster_url]));
}

async function fromTMDB(series) {
  if (!series || series.length === 0) return {};
  try {
    const mod = await import("./tmdb.js");
    const fn = mod.fetchAllPosters;
    if (typeof fn !== "function") return {};
    return await fn(series, 6);
  } catch {
    return {};
  }
}

/**
 * @param {Array} series  catálogo, necesario solo para el fallback a TMDB
 * @returns {Promise<Object>} { [serie_id]: url }
 */
export async function fetchPosters(series = []) {
  const cached = await fromSupabase();
  if (cached) return cached;
  return fromTMDB(series);
}
