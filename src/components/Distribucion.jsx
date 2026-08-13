// src/components/Distribucion.jsx
// Histograma del reparto de notas de una serie.

import { useState, useEffect } from "react";
import { fetchDistribucion } from "../lib/resenas";

export default function Distribucion({ serieId, notaMedia, votos }) {
  const [datos, setDatos] = useState(null);

  useEffect(() => {
    let vivo = true;
    fetchDistribucion(serieId).then(d => vivo && setDatos(d)).catch(() => vivo && setDatos([]));
    return () => { vivo = false; };
  }, [serieId]);

  if (!datos || datos.length === 0 || !votos) return null;

  const max = Math.max(1, ...datos.map(d => Number(d.votos)));
  const total = datos.reduce((a, d) => a + Number(d.votos), 0);
  if (total === 0) return null;

  return (
    <div className="distribucion">
      <div className="dist-resumen">
        <span className="dist-nota font-display">{Number(notaMedia).toFixed(1)}</span>
        <span className="dist-detalle">
          <strong>Reparto de notas</strong>
          <em>{total} {total === 1 ? "voto" : "votos"}</em>
        </span>
      </div>

      <div className="dist-barras" role="img"
           aria-label={`Reparto: ${datos.map(d => `${Number(d.media_estrellas)/2} estrellas, ${d.votos} votos`).join("; ")}`}>
        {datos.map(d => {
          const n = Number(d.votos);
          const estrellas = Number(d.media_estrellas) / 2;
          return (
            <div key={d.media_estrellas} className="dist-col"
                 title={`${estrellas} ${estrellas === 1 ? "estrella" : "estrellas"}: ${n} ${n === 1 ? "voto" : "votos"}`}>
              <span className="dist-valor">{n > 0 ? n : ""}</span>
              <div className="dist-barra-hueco">
                <div
                  className="dist-barra"
                  style={{ height: `${(n / max) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="dist-eje">
        <span>½★</span>
        <span>5★</span>
      </div>
    </div>
  );
}
