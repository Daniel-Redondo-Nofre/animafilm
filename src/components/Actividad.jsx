// src/components/Actividad.jsx
// Línea de tiempo con lo último que ha hecho un usuario.

import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { fetchActividad } from "../lib/social";
import { poster as posterTam } from "../lib/series";
import { slugify } from "../lib/slug";
import { useCambios, CAMBIO } from "../lib/eventos";
import { EstrellasNota } from "./Estrellas.jsx";

/**
 * Tiempo relativo en castellano. `Intl.RelativeTimeFormat` lo resuelve
 * sin tener que mantener plurales ni casos especiales a mano.
 */
function haceCuanto(iso) {
  const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
  const seg = (Date.now() - new Date(iso)) / 1000;

  const tramos = [
    ["year",   31536000],
    ["month",   2592000],
    ["week",     604800],
    ["day",       86400],
    ["hour",       3600],
    ["minute",       60],
  ];
  for (const [unidad, s] of tramos) {
    if (seg >= s) return rtf.format(-Math.floor(seg / s), unidad);
  }
  return "hace un momento";
}

const ICONO = {
  visionado:  "📅",
  valoracion: "⭐",
  resena:     "💬",
  lista:      "📋",
  sigue:      "👥",
};

function Linea({ a }) {
  const enlaceSerie = a.titulo ? `/serie/${slugify(a.titulo)}` : null;

  return (
    <li className="act-item">
      <span className="act-icono" aria-hidden="true">{ICONO[a.tipo] ?? "•"}</span>

      {a.poster_url && enlaceSerie && (
        <Link to={enlaceSerie} className="act-poster" style={{ background: a.color }}
              tabIndex={-1} aria-hidden="true">
          <img src={posterTam(a.poster_url, "w185")} alt="" loading="lazy" />
        </Link>
      )}

      <div className="act-cuerpo">
        <p className="act-texto">
          {a.tipo === "visionado" && (
            <>
              {a.valor === "revisión" ? "Revisó " : "Vio "}
              <Link to={enlaceSerie} className="enlace-usuario"><strong>{a.titulo}</strong></Link>
            </>
          )}

          {a.tipo === "valoracion" && (
            <>
              Valoró <Link to={enlaceSerie} className="enlace-usuario"><strong>{a.titulo}</strong></Link>
              {" "}<EstrellasNota nota={Number(a.valor)} size={12} />
            </>
          )}

          {a.tipo === "resena" && (
            <>
              Reseñó <Link to={enlaceSerie} className="enlace-usuario"><strong>{a.titulo}</strong></Link>
              <em className="act-cita">«{a.valor}{a.valor?.length >= 120 ? "…" : ""}»</em>
            </>
          )}

          {a.tipo === "lista" && (
            <>
              Creó la lista{" "}
              <Link to={`/lista/${a.extra}`} className="enlace-usuario"><strong>{a.valor}</strong></Link>
            </>
          )}

          {a.tipo === "sigue" && (
            <>
              Empezó a seguir a{" "}
              <Link to={`/u/${a.extra}`} className="enlace-usuario"><strong>{a.valor}</strong></Link>
            </>
          )}
        </p>

        <time className="act-fecha" dateTime={a.cuando}>{haceCuanto(a.cuando)}</time>
      </div>
    </li>
  );
}

export default function Actividad({ userId, nombre }) {
  const [items, setItems] = useState(null);
  const [todo, setTodo]   = useState(false);

  const cargar = useCallback(() => {
    fetchActividad(userId, 24).then(setItems).catch(() => setItems([]));
  }, [userId]);

  useEffect(cargar, [cargar]);
  useCambios([CAMBIO.ACTIVIDAD, CAMBIO.RESENA, CAMBIO.LISTAS, CAMBIO.SEGUIMIENTO], cargar);

  if (items === null) return <div className="skeleton" style={{ height: 130, marginBottom: "1.4rem" }} />;
  if (items.length === 0) return null;

  const visibles = todo ? items : items.slice(0, 6);

  return (
    <section className="actividad">
      <h2 className="font-display">⚡ Actividad reciente</h2>

      <ul className="act-lista">
        {visibles.map((a, i) => <Linea key={`${a.tipo}-${a.cuando}-${i}`} a={a} />)}
      </ul>

      {items.length > 6 && (
        <button className="act-mas" onClick={() => setTodo(t => !t)} aria-expanded={todo}>
          {todo ? "Mostrar menos" : `Ver las ${items.length} últimas`}
        </button>
      )}
    </section>
  );
}
