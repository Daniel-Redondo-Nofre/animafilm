// src/lib/diario.js
// Diario de visionado: qué viste y cuándo.

import { supabase } from "./supabase";

export async function fetchDiario(userId, limite = 60) {
  const { data, error } = await supabase.rpc("diario_de", {
    usuario: userId,
    limite,
  });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchMisVisionados(serieId) {
  const { data, error } = await supabase.rpc("mis_visionados", { p_serie: serieId });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchDiarioPorMes(userId, anio) {
  const { data, error } = await supabase.rpc("diario_por_mes", { usuario: userId, anio });
  if (error) return [];
  return data ?? [];
}

/**
 * Apunta un visionado. La fecha es la del visionado, no la del registro:
 * se puede anotar algo que viste la semana pasada.
 */
export async function apuntar({ serieId, userId, fecha, revision = false, nota = null }) {
  const { data, error } = await supabase
    .from("diario")
    .insert({
      user_id: userId,
      serie_id: serieId,
      vista_el: fecha ?? hoy(),
      revision,
      nota: nota?.trim() || null,
    })
    .select()
    .single();
  if (error) throw new Error(traducir(error));
  return data;
}

export async function editarEntrada(id, cambios) {
  const { error } = await supabase.from("diario").update(cambios).eq("id", id);
  if (error) throw new Error(traducir(error));
}

export async function borrarEntrada(id) {
  const { error } = await supabase.from("diario").delete().eq("id", id);
  if (error) throw new Error(traducir(error));
}

// Fecha de hoy en formato ISO, en hora local. `toISOString()` usa UTC y
// de madrugada devolvería el día anterior.
export function hoy() {
  const d = new Date();
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d - off).toISOString().slice(0, 10);
}

export function formatearFecha(iso, largo = false) {
  const [a, m, d] = iso.split("-").map(Number);
  const fecha = new Date(a, m - 1, d);
  return fecha.toLocaleDateString("es-ES", largo
    ? { day: "numeric", month: "long", year: "numeric" }
    : { day: "numeric", month: "short", year: "numeric" });
}

function traducir(error) {
  const m = (error?.message || "").toLowerCase();
  if (m.includes("ya tienes esa serie apuntada")) return "Ya tienes esa serie apuntada ese día.";
  if (m.includes("demasiadas entradas"))          return "Vas muy rápido. Espera un momento.";
  if (m.includes("diario_fecha_valida"))          return "Esa fecha no es válida.";
  return error?.message || "No hemos podido guardar el visionado.";
}
