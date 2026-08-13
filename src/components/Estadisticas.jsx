// src/components/Estadisticas.jsx
import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { fetchEstadisticas } from "../lib/listas";
import { slugify } from "../lib/slug";
import { useCambios, CAMBIO } from "../lib/eventos";

function Skeleton({ height = 20, width = "100%" }) {
  return <div className="skeleton" style={{ height, width }} />;
}

function Ranking({ titulo, icono, series, sufijo, vacio }) {
  if (!series?.length) {
    return (
      <div className="ranking">
        <h2 className="font-display">{icono} {titulo}</h2>
        <p style={{ color: "var(--text-muted)", fontWeight: 700, fontSize: 13, padding: "1rem 0" }}>
          {vacio}
        </p>
      </div>
    );
  }
  return (
    <div className="ranking">
      <h2 className="font-display">{icono} {titulo}</h2>
      <ol className="ranking-lista">
        {series.map((s, i) => (
          <li key={s.serie_id}>
            <span className="ranking-puesto">{i + 1}</span>
            <Link to={`/serie/${slugify(s.titulo)}`} className="ranking-serie">
              <span className="ranking-color" style={{ background: s.color }} aria-hidden="true" />
              <span style={{ flex: 1, minWidth: 0 }}>
                <strong>{s.titulo}</strong>
                <em>{s.decada} · {s.anio}</em>
              </span>
              <span className="ranking-valor">
                {sufijo === "★"
                  ? <>{Number(s.valor).toFixed(1)}<small>★</small></>
                  : <>{s.valor}<small> {sufijo}</small></>}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function Estadisticas() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(false);

  const cargar = useCallback(() => {
    fetchEstadisticas().then(setDatos).catch(() => setError(true));
  }, []);

  useEffect(() => {
    document.title = "Estadísticas — AnimaFilm";
    cargar();
  }, [cargar]);

  // Los rankings dependen de lo que vote la comunidad
  useCambios([CAMBIO.ACTIVIDAD, CAMBIO.RESENA], cargar);

  if (error) return (
    <div className="empty-state page-enter">
      <div style={{ fontSize: 64, marginBottom: 10 }}>📉</div>
      <p className="font-display" style={{ fontSize: 26, color: "var(--accent)" }}>
        No hemos podido cargar las estadísticas
      </p>
    </div>
  );

  if (!datos) return (
    <div className="page-enter">
      <Skeleton height={44} width="45%" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 12, margin: "1.5rem 0" }}>
        {Array(5).fill(0).map((_, i) => <Skeleton key={i} height={90} />)}
      </div>
      <Skeleton height={260} />
    </div>
  );

  const { generales: g, decadas, topNota, topVistas } = datos;
  const maxVistas = Math.max(1, ...decadas.map(d => Number(d.vistas)));

  return (
    <div className="page-enter">
      <h1 className="font-display" style={{ fontSize: 34, color: "var(--accent)", marginBottom: "1.4rem" }}>
        📊 Estadísticas
      </h1>

      {/* Cifras generales */}
      {g && (
        <div className="perfil-cifras" style={{ marginBottom: "2rem" }}>
          {[
            { v: g.series,            l: "series" },
            { v: g.usuarios,          l: "usuarios" },
            { v: g.vistas_totales,    l: "vistas" },
            { v: g.valoraciones,      l: "valoraciones" },
            { v: g.resenas,           l: "reseñas" },
            { v: g.nota_media_global ?? "—", l: "nota media" },
          ].map(x => (
            <div key={x.l} className="perfil-cifra">
              <span className="font-display">{x.v}</span>
              <span>{x.l}</span>
            </div>
          ))}
        </div>
      )}

      {/* Por década */}
      <div className="ranking" style={{ marginBottom: "1.4rem" }}>
        <h2 className="font-display">📅 Por década</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
          {decadas.map(d => (
            <div key={d.decada}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13,
                            fontWeight: 800, color: "var(--text)", marginBottom: 5 }}>
                <span>{d.decada} <em style={{ fontStyle: "normal", color: "var(--text-muted)", fontWeight: 700 }}>
                  · {d.series} series
                </em></span>
                <span style={{ color: "var(--text-muted)" }}>
                  {d.vistas} vistas
                  {d.nota_media && ` · ${d.nota_media}★`}
                </span>
              </div>
              <div className="progress-track">
                <div className="progress-fill"
                     style={{ width: `${(Number(d.vistas) / maxVistas) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rankings */}
      <div className="rankings-grid">
        <Ranking
          titulo="Mejor valoradas" icono="⭐" sufijo="★"
          series={topNota}
          vacio="Hacen falta al menos 3 votos por serie para entrar en este ranking."
        />
        <Ranking
          titulo="Más vistas" icono="👁️" sufijo="personas"
          series={topVistas.filter(s => Number(s.valor) > 0)}
          vacio="Todavía nadie ha marcado series como vistas."
        />
      </div>

      <p style={{ fontSize: 12, color: "var(--text-faint)", fontWeight: 700,
                  textAlign: "center", marginTop: "2rem" }}>
        Las medias se calculan sobre las valoraciones de toda la comunidad.
        El ranking por nota exige un mínimo de 3 votos.
      </p>
    </div>
  );
}
