// src/lib/insignias.js
//
// Las insignias no se guardan en ninguna tabla: se deducen de la
// actividad que ya existe. Así no hay nada que recalcular ni mantener
// sincronizado, y aparecen solas en cuanto se cumple la condición.

const DECADAS = { "70s": "los setenta", "80s": "los ochenta", "90s": "los noventa", "00s": "los dos mil" };

/**
 * @param {object} perfil       fila de perfiles_publicos
 * @param {array}  porDecada    [{decada, vistas, total}]
 * @returns {array} insignias conseguidas
 */
export function calcularInsignias(perfil, porDecada = []) {
  const out = [];
  const n = (v) => Number(v ?? 0);

  const vistas   = n(perfil?.vistas);
  const notas    = n(perfil?.valoraciones);
  const resenas  = n(perfil?.resenas);
  const episodios= n(perfil?.episodios);
  const media    = perfil?.nota_media != null ? Number(perfil.nota_media) : null;
  const siguiendo= n(perfil?.siguiendo);
  const seguidores = n(perfil?.seguidores);
  const likes      = n(perfil?.likes_recibidos);

  // ── Décadas completadas ──
  porDecada.forEach(d => {
    if (n(d.total) > 0 && n(d.vistas) === n(d.total)) {
      out.push({
        id: `decada-${d.decada}`,
        icono: "🏆",
        nombre: `Rey de ${d.decada}`,
        desc: `Ha visto todas las series de ${DECADAS[d.decada] ?? d.decada}`,
        rango: "oro",
      });
    }
  });

  const conVistas = porDecada.filter(d => n(d.vistas) > 0).length;
  if (conVistas === 4) {
    out.push({ id: "explorador", icono: "🗺️", nombre: "Explorador",
               desc: "Ha visto series de las cuatro décadas", rango: "oro" });
  }

  // ── Volumen ──
  if (vistas >= 25) out.push({ id:"coleccionista", icono:"📚", nombre:"Coleccionista", desc:"25 series o más vistas", rango:"oro" });
  else if (vistas >= 10) out.push({ id:"aficionado", icono:"📀", nombre:"Aficionado", desc:"10 series o más vistas", rango:"plata" });
  else if (vistas >= 1) out.push({ id:"primeros", icono:"🌱", nombre:"Primeros pasos", desc:"Ha marcado su primera serie", rango:"bronce" });

  if (episodios >= 2000) out.push({ id:"maraton", icono:"🍿", nombre:"Maratoniano", desc:`${episodios.toLocaleString("es-ES")} episodios acumulados`, rango:"oro" });
  else if (episodios >= 500) out.push({ id:"sofa", icono:"🛋️", nombre:"Sofá profesional", desc:`${episodios.toLocaleString("es-ES")} episodios acumulados`, rango:"plata" });

  // ── Opinión ──
  if (resenas >= 10) out.push({ id:"critico", icono:"✍️", nombre:"Crítico", desc:"10 reseñas o más", rango:"oro" });
  else if (resenas >= 3) out.push({ id:"opinador", icono:"💬", nombre:"Opinador", desc:"3 reseñas o más", rango:"plata" });

  if (notas >= 20 && media != null) {
    if (media >= 4.3)      out.push({ id:"generoso", icono:"💛", nombre:"Corazón blando", desc:`Nota media de ${media}`, rango:"plata" });
    else if (media <= 2.7) out.push({ id:"exigente", icono:"🧊", nombre:"Hueso duro",     desc:`Nota media de ${media}`, rango:"plata" });
  }

  // ── Comunidad ──
  if (siguiendo >= 5)  out.push({ id:"sociable", icono:"🤝", nombre:"Sociable", desc:"Sigue a 5 personas o más", rango:"plata" });
  if (seguidores >= 5) out.push({ id:"popular",  icono:"📣", nombre:"Popular",  desc:"5 seguidores o más", rango:"oro" });

  if (likes >= 25)      out.push({ id:"pluma",    icono:"🖋️", nombre:"Pluma de oro", desc:`${likes} me gusta en sus reseñas`, rango:"oro" });
  else if (likes >= 10) out.push({ id:"leido",    icono:"❤️", nombre:"Se le lee",    desc:`${likes} me gusta en sus reseñas`, rango:"plata" });

  return out;
}
