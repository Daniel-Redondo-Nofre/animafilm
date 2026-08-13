// src/lib/resenas.js
// Reseñas de una serie y "me gusta".

import { supabase } from "./supabase";

/**
 * Reseñas de una serie con autor, nota, recuento de "me gusta" y si el
 * usuario actual lo ha dado. Todo en una consulta: hacerlo por partes
 * exigiría tres viajes al servidor y contar en el navegador.
 *
 * @param {number} serieId
 * @param {"populares"|"recientes"|"amigos"} orden
 */
export async function fetchResenas(serieId, orden = "populares", opciones = {}) {
  const { data, error } = await supabase.rpc("resenas_de_serie", {
    p_serie: serieId,
    p_orden: orden,
    p_limite: opciones.limite ?? 30,
    p_solo_seguidos:    opciones.soloSeguidos    ?? false,
    p_excluir_seguidos: opciones.excluirSeguidos ?? false,
  });
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Reparto de notas de una serie, para el histograma */
export async function fetchDistribucion(serieId) {
  const { data, error } = await supabase.rpc("distribucion_notas", { p_serie: serieId });
  if (error) return [];
  return data ?? [];
}

export async function darLike(reviewId, userId) {
  const { error } = await supabase
    .from("review_likes")
    .insert({ review_id: reviewId, user_id: userId });
  // 23505 = ya existía. La clave primaria compuesta lo impide por diseño,
  // así que no es un fallo que deba verse.
  if (error && error.code !== "23505") throw new Error(error.message);
}

export async function quitarLike(reviewId, userId) {
  const { error } = await supabase
    .from("review_likes")
    .delete()
    .eq("review_id", reviewId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

// ── COMENTARIOS ───────────────────────────────────────────────────────

export async function fetchComentarios(reviewId) {
  const { data, error } = await supabase.rpc("comentarios_de", { p_review: reviewId });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function comentar(reviewId, userId, texto) {
  const content = texto.trim();
  if (!content) throw new Error("El comentario está vacío.");
  if (content.length > 600) throw new Error("El comentario no puede pasar de 600 caracteres.");

  const { data, error } = await supabase
    .from("review_comments")
    .insert({ review_id: reviewId, user_id: userId, content })
    .select()
    .single();
  if (error) throw new Error(traducirComentario(error));
  return data;
}

export async function borrarComentario(id) {
  const { error } = await supabase.from("review_comments").delete().eq("id", id);
  if (error) throw new Error(traducirComentario(error));
}

function traducirComentario(error) {
  const m = (error?.message || "").toLowerCase();
  if (m.includes("demasiado en poco tiempo")) return "Has comentado demasiado seguido. Espera un rato.";
  if (m.includes("comentario_len"))           return "El comentario debe tener entre 1 y 600 caracteres.";
  return error?.message || "No hemos podido publicar el comentario.";
}
