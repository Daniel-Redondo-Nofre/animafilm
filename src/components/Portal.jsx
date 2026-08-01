// src/components/Portal.jsx
//
// Los modales se montan directamente en <body>, fuera del árbol de la app.
//
// Por qué: cualquier ancestro con `transform`, `filter` o `backdrop-filter`
// crea un "containing block" y hace que `position: fixed` se posicione
// respecto a ese ancestro en lugar de respecto a la ventana. Nuestras
// animaciones de entrada (.page-enter, .animate-fadeUp) usan transform con
// fill-mode `both`, así que lo conservan al acabar. Resultado: el velo del
// modal quedaba recortado al área del contenido en vez de cubrir la pantalla.
//
// Con un portal el modal es hijo de <body> y ese problema desaparece.

import { createPortal } from "react-dom";

export default function Portal({ children }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}
