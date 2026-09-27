// src/components/ListasComunidad.jsx
// Descubrir listas públicas de otros usuarios.

import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { fetchListasComunidad, guardarLista, quitarGuardada } from "../lib/listas";
import { poster as posterTam } from "../lib/series";
import { toast } from "../lib/toast.jsx";
import { avisar, useCambios, CAMBIO } from "../lib/eventos";
import Avatar from "./Avatar.jsx";

function Tarjeta({ l, user, onShowAuth, onCambio }) {
  const [ocupado, setOcupado] = useState(false);

  async function alternar(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) { onShowAuth?.(); return; }
    if (l.user_id === user.id) {
      toast("Esta lista ya es tuya.", "info");
      return;
    }
    if (ocupado) return;

    const estaba = l.la_guardo;
    setOcupado(true);
    onCambio(l.id, !estaba);   // optimista

    try {
      estaba ? await quitarGuardada(l.id, user.id) : await guardarLista(l.id, user.id);
      avisar(CAMBIO.LISTAS);
    } catch (err) {
      onCambio(l.id, estaba);  // reversión
      toast.error(err.message || "No hemos podido guardar la lista.");
    } finally {
      setOcupado(false);
    }
  }

  const portadas = l.portadas ?? [];

  return (
    <Link to={`/lista/${l.id}`} className="lc-card">
      {/* Mosaico con los cuatro primeros pósters: una lista sin imágenes
          es solo un título y no invita a entrar. */}
      <div className={`lc-portada huecos-${Math.min(portadas.length, 4)}`}>
        {portadas.length > 0
          ? portadas.slice(0, 4).map((p, i) => (
              <img key={i} src={posterTam(p, "w185")} alt="" loading="lazy" />
            ))
          : <span className="lc-sin-portada" aria-hidden="true">📋</span>}
      </div>

      <div className="lc-cuerpo">
        <strong className="lc-nombre">{l.nombre}</strong>
        {l.descripcion && <p className="lc-desc">{l.descripcion}</p>}

        <div className="lc-pie">
          <span className="lc-autor">
            <Avatar perfil={l} size={20} />
            {l.display_name || l.username}
          </span>
          <span className="lc-num">
            {l.num_series} {Number(l.num_series) === 1 ? "serie" : "series"}
          </span>
        </div>
      </div>

      <button
        className={`lc-guardar${l.la_guardo ? " activo" : ""}`}
        onClick={alternar}
        disabled={ocupado}
        aria-pressed={!!l.la_guardo}
        aria-label={l.la_guardo ? `Quitar ${l.nombre} de guardadas` : `Guardar ${l.nombre}`}
        title={l.la_guardo ? "Quitar de guardadas" : "Guardar lista"}
      >
        <span aria-hidden="true">{l.la_guardo ? "🔖" : "🏷️"}</span>
        {Number(l.guardados) > 0 && <span>{l.guardados}</span>}
      </button>
    </Link>
  );
}

export default function ListasComunidad({ user, onShowAuth }) {
  const [orden, setOrden] = useState("populares");
  const [listas, setListas] = useState(null);

  const cargar = useCallback(() => {
    setListas(null);
    fetchListasComunidad(orden).then(setListas).catch(() => setListas([]));
  }, [orden]);

  useEffect(cargar, [cargar]);
  useCambios([CAMBIO.LISTAS], cargar);

  // Actualiza una tarjeta sin recargar toda la lista
  const marcar = useCallback((id, guardada) => {
    setListas(prev => prev?.map(l => l.id === id
      ? { ...l, la_guardo: guardada, guardados: Number(l.guardados) + (guardada ? 1 : -1) }
      : l));
  }, []);

  const OPCIONES = [
    { id: "populares", label: "🔖 Más guardadas" },
    { id: "recientes", label: "🕐 Más nuevas" },
    ...(user ? [{ id: "guardadas", label: "⭐ Mis guardadas" }] : []),
  ];

  return (
    <section className="lc">
      <div className="resenas-cabecera">
        <h2 className="font-display" style={{ fontSize: 22, color: "var(--accent)" }}>
          📋 Listas de la comunidad
        </h2>
        <div className="resenas-orden" role="group" aria-label="Ordenar listas">
          {OPCIONES.map(o => (
            <button key={o.id} className={`sort-btn${orden === o.id ? " active" : ""}`}
                    aria-pressed={orden === o.id}
                    onClick={() => setOrden(o.id)}>{o.label}</button>
          ))}
        </div>
      </div>

      {listas === null ? (
        <div className="lc-grid">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="skeleton" style={{ height: 210, borderRadius: "var(--radius)" }} />
          ))}
        </div>
      ) : listas.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontWeight: 700, padding: "2.5rem 0", textAlign: "center" }}>
          {orden === "guardadas"
            ? "Todavía no has guardado ninguna lista."
            : "Aún no hay listas públicas. Crea una desde cualquier serie."}
        </p>
      ) : (
        <div className="lc-grid">
          {listas.map(l => (
            <Tarjeta key={l.id} l={l} user={user} onShowAuth={onShowAuth} onCambio={marcar} />
          ))}
        </div>
      )}
    </section>
  );
}
