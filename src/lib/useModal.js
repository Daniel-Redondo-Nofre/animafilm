// src/lib/useModal.js
//
// Todo lo que un modal accesible necesita hacer y casi nadie implementa:
//
//  1. Atrapar el foco dentro. Sin esto, al tabular te vas a los enlaces
//     de detrás del velo: sigues "dentro" del modal visualmente pero
//     estás interactuando con una página que no ves.
//  2. Devolver el foco al elemento que lo abrió al cerrarse. Si no,
//     quien navega con teclado vuelve al principio del documento.
//  3. Bloquear el scroll del fondo, para que la rueda del ratón no
//     desplace la página de detrás.
//  4. Cerrar con Escape, de forma consistente en todos los modales.

import { useEffect, useRef } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "textarea:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function useModal(onClose) {
  const ref = useRef(null);

  useEffect(() => {
    const nodo = ref.current;
    const focoPrevio = document.activeElement;
    const overflowPrevio = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    // El foco entra en el modal: al primer campo si lo hay, si no al contenedor
    const visibles = () =>
      Array.from(nodo?.querySelectorAll(FOCUSABLE) ?? [])
        .filter(el => el.offsetParent !== null || el === document.activeElement);

    const primeros = visibles();
    (primeros[0] ?? nodo)?.focus?.({ preventScroll: true });

    function alPulsar(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose?.();
        return;
      }
      if (e.key !== "Tab") return;

      const items = visibles();
      if (items.length === 0) { e.preventDefault(); return; }

      const primero = items[0];
      const ultimo  = items[items.length - 1];

      // Ciclo: del último al primero y viceversa, sin salirse nunca
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault(); ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault(); primero.focus();
      } else if (nodo && !nodo.contains(document.activeElement)) {
        e.preventDefault(); primero.focus();
      }
    }

    document.addEventListener("keydown", alPulsar, true);

    return () => {
      document.removeEventListener("keydown", alPulsar, true);
      document.body.style.overflow = overflowPrevio;
      if (focoPrevio instanceof HTMLElement) {
        focoPrevio.focus?.({ preventScroll: true });
      }
    };
  }, [onClose]);

  return ref;
}
