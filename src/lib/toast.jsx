// src/lib/toast.jsx
//
// Avisos flotantes. Se emiten con un evento del navegador en lugar de un
// contexto de React: así cualquier componente puede llamar a toast() sin
// que haya que ir pasando la función por props hasta el fondo del árbol.

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

const CANAL = "animafilm:toast";
const DURACION = 4500;

export function toast(mensaje, tipo = "error") {
  window.dispatchEvent(new CustomEvent(CANAL, {
    detail: { mensaje, tipo, id: `${Date.now()}-${Math.random()}` },
  }));
}

// Atajos para los casos habituales
toast.error = (m) => toast(m, "error");
toast.ok    = (m) => toast(m, "ok");
toast.info  = (m) => toast(m, "info");

const ICONO = { error: "💥", ok: "✓", info: "ℹ️" };

export function Toasts() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    function alRecibir(e) {
      const t = e.detail;
      setItems(prev => [...prev, t]);
      setTimeout(() => {
        setItems(prev => prev.filter(x => x.id !== t.id));
      }, DURACION);
    }
    window.addEventListener(CANAL, alRecibir);
    return () => window.removeEventListener(CANAL, alRecibir);
  }, []);

  if (items.length === 0) return null;

  return createPortal(
    <div className="toast-stack" role="status" aria-live="polite">
      {items.map(t => (
        <div key={t.id} className={`toast toast-${t.tipo}`}>
          <span className="toast-icono" aria-hidden="true">{ICONO[t.tipo] ?? "•"}</span>
          <span>{t.mensaje}</span>
          <button
            className="toast-cerrar"
            aria-label="Cerrar aviso"
            onClick={() => setItems(prev => prev.filter(x => x.id !== t.id))}
          >✕</button>
        </div>
      ))}
    </div>,
    document.body
  );
}

// Mensaje adecuado según la causa del fallo
export function mensajeDeError(error) {
  if (!navigator.onLine) return "Parece que no hay conexión. El cambio no se ha guardado.";
  const m = (error?.message || "").toLowerCase();
  if (m.includes("jwt") || m.includes("token") || error?.code === "PGRST301")
    return "Tu sesión ha caducado. Vuelve a iniciar sesión.";
  if (m.includes("demasiad") || m.includes("rate"))
    return "Vas muy rápido. Espera un momento e inténtalo otra vez.";
  if (m.includes("network") || m.includes("fetch"))
    return "No hemos podido conectar. El cambio no se ha guardado.";
  return "No hemos podido guardar el cambio. Inténtalo de nuevo.";
}
