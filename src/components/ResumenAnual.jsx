// src/components/ResumenAnual.jsx
// "Tu año en AnimaFilm": resumen de lo visto en un año concreto.

import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { fetchAniosConActividad, fetchResumenAnual } from "../lib/diario";
import { poster as posterTam } from "../lib/series";
import { slugify } from "../lib/slug";
import { EstrellasNota } from "./Estrellas.jsx";

const MESES_CORTOS = ["E","F","M","A","M","J","J","A","S","O","N","D"];
const MESES = ["enero","febrero","marzo","abril","mayo","junio",
               "julio","agosto","septiembre","octubre","noviembre","diciembre"];

const DECADAS = { "70s":"los setenta", "80s":"los ochenta",
                  "90s":"los noventa", "00s":"los dos mil" };

export default function ResumenAnual({ userId, esMio, nombre }) {
  const [anios, setAnios] = useState(null);
  const [anio, setAnio]   = useState(null);
  const [datos, setDatos] = useState(null);

  useEffect(() => {
    fetchAniosConActividad(userId).then(lista => {
      setAnios(lista);
      if (lista.length > 0) setAnio(Number(lista[0].anio));
    }).catch(() => setAnios([]));
  }, [userId]);

  const cargar = useCallback(() => {
    if (!anio) return;
    setDatos(null);
    fetchResumenAnual(userId, anio).then(setDatos).catch(() => setDatos(null));
  }, [userId, anio]);

  useEffect(cargar, [cargar]);

  if (anios === null) return <div className="skeleton" style={{ height: 200, marginTop: "1rem" }} />;

  if (anios.length === 0) return (
    <p style={{ color: "var(--text-muted)", fontWeight: 700, padding: "2.5rem 0", textAlign: "center" }}>
      {esMio
        ? "Apunta visionados en el diario y aquí verás el resumen de tu año."
        : "Todavía no hay nada que resumir."}
    </p>
  );

  const r = datos?.resumen;
  const maxMes = Math.max(1, ...(datos?.meses ?? []).map(m => Number(m.total)));

  return (
    <div className="anual" style={{ marginTop: "1rem" }}>
      {/* Selector de año */}
      {anios.length > 1 && (
        <div className="sort-bar" role="group" aria-label="Elegir año">
          {anios.map(a => (
            <button key={a.anio}
                    className={`sort-btn${Number(a.anio) === anio ? " active" : ""}`}
                    aria-pressed={Number(a.anio) === anio}
                    onClick={() => setAnio(Number(a.anio))}>
              {a.anio}
            </button>
          ))}
        </div>
      )}

      {!datos ? (
        <div className="skeleton" style={{ height: 240, marginTop: "1rem" }} />
      ) : !r || Number(r.visionados) === 0 ? (
        <p style={{ color: "var(--text-muted)", fontWeight: 700, padding: "2rem 0", textAlign: "center" }}>
          Sin actividad en {anio}.
        </p>
      ) : (
        <>
          {/* Titular */}
          <div className="anual-titular">
            <span className="anual-anio font-display">{anio}</span>
            <p>
              <strong>{r.visionados}</strong> {Number(r.visionados) === 1 ? "visionado" : "visionados"}
              {Number(r.series_unicas) !== Number(r.visionados) && (
                <> de <strong>{r.series_unicas}</strong> series distintas</>
              )}
              {Number(r.episodios) > 0 && (
                <em> · {Number(r.episodios).toLocaleString("es-ES")} episodios</em>
              )}
            </p>
          </div>

          {/* Cifras */}
          <div className="perfil-cifras" style={{ marginBottom: "1.2rem" }}>
            {[
              { v: r.valoraciones,             l: "valoradas" },
              { v: r.nota_media ?? "—",        l: "nota media" },
              { v: r.resenas,                  l: "reseñas" },
              { v: r.revisiones,               l: "revisiones" },
              { v: r.dias_activos,             l: "días activos" },
              { v: r.racha_max,                l: "racha máxima" },
            ].map(x => (
              <div key={x.l} className="perfil-cifra">
                <span className="font-display">{x.v}</span>
                <span>{x.l}</span>
              </div>
            ))}
          </div>

          {/* Destacados en frases */}
          <div className="anual-frases">
            {r.mes_top && (
              <p>
                <span aria-hidden="true">📆</span>
                {esMio ? "Tu mes" : "Su mes"} más intenso fue{" "}
                <strong>{MESES[Number(r.mes_top) - 1]}</strong>, con {r.mes_top_total} visionados.
              </p>
            )}
            {r.decada_top && (
              <p>
                <span aria-hidden="true">📺</span>
                La década que más {esMio ? "viste" : "vio"} fue{" "}
                <strong>{DECADAS[r.decada_top] ?? r.decada_top}</strong>, con {r.decada_top_total}.
              </p>
            )}
            {Number(r.racha_max) > 1 && (
              <p>
                <span aria-hidden="true">🔥</span>
                {esMio ? "Encadenaste" : "Encadenó"}{" "}
                <strong>{r.racha_max} días seguidos</strong> viendo algo.
              </p>
            )}
          </div>

          {/* Gráfico mensual */}
          <div className="anual-meses">
            <p className="anual-label">Visionados por mes</p>
            <div className="anual-barras">
              {datos.meses.map(m => {
                const n = Number(m.total);
                return (
                  <div key={m.mes} className="anual-col"
                       title={`${MESES[Number(m.mes) - 1]}: ${n} ${n === 1 ? "visionado" : "visionados"}`}>
                    <span className="anual-valor">{n > 0 ? n : ""}</span>
                    <div className="anual-hueco">
                      <div className="anual-barra" style={{ height: `${(n / maxMes) * 100}%` }} />
                    </div>
                    <span className="anual-mes">{MESES_CORTOS[Number(m.mes) - 1]}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mejores del año */}
          {datos.mejores.length > 0 && (
            <div className="anual-mejores">
              <p className="anual-label">
                {esMio ? "Tus" : "Sus"} mejor valoradas del año
              </p>
              <div className="anual-grid">
                {datos.mejores.map((m, i) => (
                  <Link key={m.serie_id} to={`/serie/${slugify(m.titulo)}`}
                        className="anual-serie" style={{ background: m.color }}>
                    <span className="anual-puesto">{i + 1}</span>
                    {m.poster_url
                      ? <img src={posterTam(m.poster_url, "w185")} alt={m.titulo} loading="lazy" />
                      : <span className="font-display">{m.titulo}</span>}
                    <span className="anual-pie">
                      <strong>{m.titulo}</strong>
                      <EstrellasNota nota={m.rating / 2} size={11} />
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
