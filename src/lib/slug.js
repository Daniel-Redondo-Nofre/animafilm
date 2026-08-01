// src/lib/slug.js
// Convierte "Érase una vez el hombre" → "erase-una-vez-el-hombre"
// para tener URLs legibles y compartibles.

export function slugify(texto = "") {
  return texto
    .normalize("NFD")                      // separa las tildes de la letra
    .replace(/[\u0300-\u036f]/g, "")       // y las elimina
    .replace(/ñ/gi, "n")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")           // todo lo demás pasa a guion
    .replace(/^-+|-+$/g, "");              // sin guiones sueltos en los extremos
}

// Busca una serie por slug. Acepta también el id numérico como respaldo,
// por si alguien comparte /serie/13 o cambia el título de una serie.
export function findBySlug(series, slug) {
  if (!slug || !series?.length) return null;
  const limpio = String(slug).toLowerCase();
  return (
    series.find(s => slugify(s.titulo) === limpio) ||
    series.find(s => String(s.id) === limpio) ||
    null
  );
}
