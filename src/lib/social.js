// src/lib/social.js
// Perfiles públicos, seguidores y comparación de colecciones.

import { supabase } from "./supabase";

// ── PERFILES ──────────────────────────────────────────────────────────

export async function fetchPerfilPublico(username) {
  const { data, error } = await supabase
    .from("perfiles_publicos")
    .select("*")
    .ilike("username", username)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;   // null si no existe
}

// Series vistas y valoradas por un usuario, para pintar su colección
export async function fetchColeccion(userId) {
  const [{ data: vistas }, { data: notas }] = await Promise.all([
    supabase.from("watched").select("serie_id, watched_at").eq("user_id", userId),
    supabase.from("ratings").select("serie_id, rating").eq("user_id", userId),
  ]);

  const mapaNotas = Object.fromEntries((notas ?? []).map(r => [r.serie_id, r.rating]));
  return {
    vistas: (vistas ?? []).map(v => v.serie_id),
    notas: mapaNotas,
  };
}

export async function fetchResenasDe(userId, limite = 20) {
  const { data } = await supabase
    .from("reviews")
    .select("id, serie_id, content, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limite);
  return data ?? [];
}

// ── SEGUIR ────────────────────────────────────────────────────────────

export async function seguir(objetivo) {
  const { error } = await supabase.rpc("seguir", { objetivo });
  if (error) throw new Error(error.message);
}

export async function dejarDeSeguir(objetivo) {
  const { error } = await supabase.rpc("dejar_de_seguir", { objetivo });
  if (error) throw new Error(error.message);
}

export async function estoySiguiendo(miId, objetivo) {
  if (!miId || !objetivo) return false;
  const { data } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("follower_id", miId)
    .eq("following_id", objetivo)
    .maybeSingle();
  return !!data;
}

// Ids de las personas a las que sigue alguien. Se usa para filtrar el feed.
export async function fetchSeguidos(userId) {
  if (!userId) return [];
  const { data } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", userId);
  return (data ?? []).map(f => f.following_id);
}

// Listas de seguidores / seguidos con sus perfiles
export async function fetchRelaciones(userId, tipo = "seguidores") {
  const columna  = tipo === "seguidores" ? "following_id" : "follower_id";
  const opuesta  = tipo === "seguidores" ? "follower_id"  : "following_id";

  const { data } = await supabase
    .from("follows")
    .select(`${opuesta}`)
    .eq(columna, userId)
    .limit(100);

  const ids = (data ?? []).map(f => f[opuesta]);
  if (ids.length === 0) return [];

  const { data: perfiles } = await supabase
    .from("perfiles_publicos")
    .select("id, username, display_name, vistas")
    .in("id", ids);

  return perfiles ?? [];
}

// ── BUSCAR ────────────────────────────────────────────────────────────

export async function buscarUsuarios(texto) {
  if (!texto || texto.trim().length < 2) return [];
  const { data, error } = await supabase.rpc("buscar_usuarios", { texto });
  if (error) return [];
  return data ?? [];
}

// ── COMPARAR ──────────────────────────────────────────────────────────

/**
 * Devuelve el resumen de coincidencias con otro usuario.
 * Solo tiene sentido con sesión iniciada.
 */
export async function compararCon(otroId) {
  const { data, error } = await supabase.rpc("comparar_con", { otro: otroId });
  if (error) throw new Error(error.message);

  const filas = data ?? [];
  const ambos     = filas.filter(f => f.vista_yo && f.vista_otro);
  const soloYo    = filas.filter(f => f.vista_yo && !f.vista_otro);
  const soloOtro  = filas.filter(f => !f.vista_yo && f.vista_otro);

  // Afinidad de gusto: sobre las series que ambos han puntuado, cuánto
  // se parecen las notas. 100 % = puntuáis exactamente igual.
  const conNotas = filas.filter(f => f.nota_yo != null && f.nota_otro != null);
  let afinidad = null;
  if (conNotas.length >= 3) {
    const distancia = conNotas.reduce((a, f) => a + Math.abs(f.nota_yo - f.nota_otro), 0);
    afinidad = Math.round((1 - distancia / (conNotas.length * 4)) * 100);
  }

  return {
    ambos:      ambos.map(f => f.serie_id),
    soloYo:     soloYo.map(f => f.serie_id),
    soloOtro:   soloOtro.map(f => f.serie_id),
    comparadas: conNotas.length,
    afinidad,
  };
}
