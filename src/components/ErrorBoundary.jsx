// src/components/ErrorBoundary.jsx
//
// Sin esto, cualquier error durante el renderizado —incluido un chunk
// diferido que no llega— desmonta el árbol entero y deja la pantalla en
// blanco, sin ninguna pista para el usuario.
//
// Con un límite de error el fallo queda acotado: se ve un mensaje, un
// botón de recargar y, en desarrollo, el detalle técnico.

import { Component } from "react";

export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[AnimaFilm] Error de renderizado:", error, info);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    // Un chunk que no carga suele significar que hay una versión nueva
    // desplegada y el navegador sigue con el índice antiguo en caché.
    const esChunk =
      /dynamically imported module|Loading chunk|Importing a module script failed/i
        .test(error?.message || "");

    return (
      <div className="empty-state">
        <div style={{ fontSize: 72, marginBottom: 8 }}>{esChunk ? "🔄" : "💥"}</div>
        <p className="font-display" style={{ fontSize: 28, color: "var(--accent)", marginBottom: 10 }}>
          {esChunk ? "Hay una versión nueva" : "Algo se ha roto"}
        </p>
        <p style={{ color: "var(--text-muted)", fontSize: 15, fontWeight: 700,
                    maxWidth: 420, margin: "0 auto 1.5rem", lineHeight: 1.6 }}>
          {esChunk
            ? "Tu navegador tiene guardada una copia antigua de la web. Recarga para ponerte al día."
            : "Ha ocurrido un error inesperado. Recargar suele bastar."}
        </p>

        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button className="btn btn-primary" style={{ fontSize: 15, padding: "11px 26px" }}
                  onClick={() => window.location.reload()}>
            Recargar
          </button>
          <button className="btn btn-ghost" style={{ fontSize: 15, padding: "11px 20px" }}
                  onClick={() => { window.location.href = "/"; }}>
            Ir al catálogo
          </button>
        </div>

        {import.meta.env.DEV && (
          <pre style={{ marginTop: "1.5rem", textAlign: "left", fontSize: 12,
                        background: "var(--bg-muted)", border: "2px solid var(--border)",
                        borderRadius: "var(--radius-sm)", padding: "12px",
                        overflow: "auto", maxWidth: 640, margin: "1.5rem auto 0" }}>
            {error?.stack || String(error)}
          </pre>
        )}
      </div>
    );
  }
}
