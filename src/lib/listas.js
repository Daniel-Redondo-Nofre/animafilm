// src/lib/listas.js
// Listas personalizadas y estadísticas globales.

import { supabase } from "./supabase";

// ── LISTAS ────────────────────────────────────────────────────────────

export async function fetchMisListas(userId) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from("listas_con_datos")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

// Las públicas de cualquiera. RLS ya oculta las privadas ajenas.
export async function fetchListasDe(userId) {
  const { data } = await supabase
    .from("listas_con_datos")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  return data ?? [];
}

export async function fetchListasPublicas(limite = 20) {
  const { data } = await supabase
    .from("listas_con_datos")
    .select("*")
    .eq("publica", true)
    .gt("num_series", 0)
    .order("updated_at", { ascending: false })
    .limit(limite);
  return data ?? [];
}

export async function fetchLista(id) {
  const { data, error } = await supabase
    .from("listas_con_datos")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const { data: contenido } = await supabase
    .from("lista_series")
    .select("serie_id, orden, added_at")
    .eq("lista_id", id)
    .order("orden")
    .order("added_at");

  return { ...data, series: (contenido ?? []).map(c => c.serie_id) };
}

export async function crearLista({ nombre, descripcion, publica = true }) {
  const { data: sesion } = await supabase.auth.getUser();
  const uid = sesion?.user?.id;
  if (!uid) throw new Error("Necesitas iniciar sesión");

  const { data, error } = await supabase
    .from("listas")
    .insert({ user_id: uid, nombre: nombre.trim(), descripcion: descripcion?.trim() || null, publica })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function actualizarLista(id, cambios) {
  const { error } = await supabase.from("listas").update(cambios).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function borrarLista(id) {
  const { error } = await supabase.from("listas").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function anadirSerie(listaId, serieId) {
  const { error } = await supabase
    .from("lista_series")
    .insert({ lista_id: listaId, serie_id: serieId });
  // 23505 = ya estaba en la lista. No es un fallo que deba verse.
  if (error && error.code !== "23505") throw new Error(error.message);
  await supabase.from("listas").update({ updated_at: new Date().toISOString() }).eq("id", listaId);
}

export async function quitarSerie(listaId, serieId) {
  const { error } = await supabase
    .from("lista_series")
    .delete()
    .eq("lista_id", listaId)
    .eq("serie_id", serieId);
  if (error) throw new Error(error.message);
}

// Para el diálogo "añadir a lista": qué listas ya contienen esta serie
export async function listasConSerie(userId, serieId) {
  if (!userId) return [];
  const { data } = await supabase
    .from("lista_series")
    .select("lista_id, listas!inner(user_id)")
    .eq("serie_id", serieId)
    .eq("listas.user_id", userId);
  return (data ?? []).map(d => d.lista_id);
}

// ── ESTADÍSTICAS ──────────────────────────────────────────────────────

export async function fetchEstadisticas() {
  const [generales, decadas, topNota, topVistas] = await Promise.all([
    supabase.from("stats_generales").select("*").maybeSingle(),
    supabase.from("stats_por_decada").select("*"),
    supabase.rpc("top_series", { criterio: "nota",   limite: 10 }),
    supabase.rpc("top_series", { criterio: "vistas", limite: 10 }),
  ]);

  const orden = { "70s": 0, "80s": 1, "90s": 2, "00s": 3 };
  return {
    generales: generales.data ?? null,
    decadas: (decadas.data ?? []).sort((a, b) => orden[a.decada] - orden[b.decada]),
    topNota: topNota.data ?? [],
    topVistas: topVistas.data ?? [],
  };
}
