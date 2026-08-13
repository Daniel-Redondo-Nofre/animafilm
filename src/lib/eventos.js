// src/lib/eventos.js
//
// Aviso de cambios entre partes de la app.
//
// El problema: cada componente consulta sus datos al montarse y ahí se
// queda. Si valoras una serie desde el catálogo, tu perfil sigue diciendo
// "0 vistas" hasta que recargas; si sigues a alguien, el feed no se
// entera. Cada pantalla vive en su burbuja.
//
// La solución: quien escribe algo lo anuncia, y quien muestra datos
// derivados de eso se vuelve a consultar. Se usa un evento del navegador
// en vez de un contexto de React para no tener que pasar nada por props
// ni re-renderizar ramas enteras del árbol.

import { useEffect } from "react";

const CANAL = "animafilm:cambio";

export const CAMBIO = {
  ACTIVIDAD:   "actividad",    // valoración, vista, pendiente
  RESENA:      "resena",
  PERFIL:      "perfil",       // avatar, favoritas, nombre, bio
  SEGUIMIENTO: "seguimiento",  // seguir / dejar de seguir
  LISTAS:      "listas",
};

export function avisar(tipo, detalle = {}) {
  window.dispatchEvent(new CustomEvent(CANAL, { detail: { tipo, ...detalle } }));
}

/**
 * Vuelve a ejecutar `accion` cuando ocurre alguno de los tipos indicados.
 *
 * @param {string[]} tipos   valores de CAMBIO a los que atender
 * @param {Function} accion  qué hacer (normalmente, recargar datos)
 */
export function useCambios(tipos, accion) {
  useEffect(() => {
    function alCambiar(e) {
      if (tipos.includes(e.detail?.tipo)) accion(e.detail);
    }
    window.addEventListener(CANAL, alCambiar);
    return () => window.removeEventListener(CANAL, alCambiar);
    // `tipos` se pasa como literal en cada render; lo comparamos por
    // contenido para no resuscribirnos en cada pasada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipos.join(","), accion]);
}
