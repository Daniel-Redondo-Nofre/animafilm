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
export async function fetchResenas(serieId, orden = "populares") {
  const { data, error } = await supabase.rpc("resenas_de_serie", {
    p_serie: serieId,
    p_orden: orden,
    p_limite: 30,
  });
  if (error) throw new Error(error.message);
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
