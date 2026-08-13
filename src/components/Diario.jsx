// src/components/Diario.jsx
// Apuntar visionados y ver el diario de un usuario.

import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  fetchDiario, fetchMisVisionados, apuntar, editarEntrada, borrarEntrada,
  hoy, formatearFecha,
} from "../lib/diario";
import { poster as posterTam } from "../lib/series";
import { slugify } from "../lib/slug";
import { useModal } from "../lib/useModal";
import { toast } from "../lib/toast.jsx";
import { avisar, useCambios, CAMBIO } from "../lib/eventos";
import { EstrellasNota } from "./Estrellas.jsx";
import Portal from "./Portal.jsx";

const MESES = ["enero","febrero","marzo","abril","mayo","junio",
               "julio","agosto","septiembre","octubre","noviembre","diciembre"];

/* ═══════════════════════════════════════════════════════════════════════
   APUNTAR UN VISIONADO
   ═══════════════════════════════════════════════════════════════════════ */
export function ApuntarVisionado({ user, serie, onClose }) {
  const modalRef = useModal(onClose);
  const [fecha, setFecha]       = useState(hoy());
  const [nota, setNota]         = useState("");
  const [previos, setPrevios]   = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuard]   = useState(false);

  const recargar = useCallback(() => {
    fetchMisVisionados(serie.id)
      .then(setPrevios)
      .catch(() => setPrevios([]))
      .finally(() => setCargando(false));
  }, [serie.id]);

  useEffect(recargar, [recargar]);

  // Si ya la ha visto antes, esta vez es una revisión
  const esRevision = previos.length > 0;

  async function guardar() {
    if (guardando) return;
    setGuard(true);
    try {
      await apuntar({
        serieId: serie.id,
        userId: user.id,
        fecha,
        revision: esRevision,
        nota,
      });
      toast.ok(esRevision ? "Revisión apuntada" : "Visionado apuntado");
      avisar(CAMBIO.ACTIVIDAD, { serie: serie.id });
      onClose();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setGuard(false);
    }
  }

  async function borrar(id) {
    try {
      await borrarEntrada(id);
      setPrevios(p => p.filter(x => x.id !== id));
      avisar(CAMBIO.ACTIVIDAD, { serie: serie.id });
      toast.ok("Entrada borrada");
    } catch (e) {
      toast.error(e.message);
    }
  }

  return (
    <Portal>
      <div className="overlay" onClick={onClose}>
        <div ref={modalRef} className="modal" role="dialog" aria-modal="true"
             aria-labelledby="apuntar-titulo" tabIndex={-1}
             style={{ maxWidth: 430, padding: "1.8rem" }}
             onClick={e => e.stopPropagation()}>

          <h2 id="apuntar-titulo" className="font-display"
              style={{ fontSize: 24, color: "var(--accent)", marginBottom: 3 }}>
            📅 {esRevision ? "Apuntar una revisión" : "Apuntar visionado"}
          </h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 700, marginBottom: "1.3rem" }}>
            {serie.titulo}
          </p>

          <label style={{ display: "block", marginBottom: "1rem" }}>
            <span className="pers-label">¿Cuándo la viste?</span>
            <input className="input" type="date" value={fecha} max={hoy()}
                   onChange={e => setFecha(e.target.value)} />
            <div className="fechas-rapidas">
              {[
                { t: "Hoy", d: 0 },
                { t: "Ayer", d: 1 },
                { t: "Hace una semana", d: 7 },
              ].map(o => {
                const f = new Date();
                f.setDate(f.getDate() - o.d);
                const iso = new Date(f - f.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
                return (
                  <button key={o.t} className={`sort-btn${fecha === iso ? " active" : ""}`}
                          onClick={() => setFecha(iso)}>{o.t}</button>
                );
              })}
            </div>
          </label>

          <label style={{ display: "block", marginBottom: "1.3rem" }}>
            <span className="pers-label">Una nota (opcional)</span>
            <textarea className="textarea" rows={2} value={nota} maxLength={280}
                      onChange={e => setNota(e.target.value)}
                      placeholder="¿Con quién la viste? ¿Qué recuerdas?" />
          </label>

          {/* Visionados anteriores */}
          {!cargando && previos.length > 0 && (
            <div className="previos">
              <p className="pers-label">
                Ya la has visto {previos.length} {previos.length === 1 ? "vez" : "veces"}
              </p>
              {previos.map(v => (
                <div key={v.id} className="previo">
                  <span className="previo-fecha">{formatearFecha(v.vista_el)}</span>
                  {v.revision && <span className="chip previo-chip">revisión</span>}
                  {v.nota && <em className="previo-nota">{v.nota}</em>}
                  <button className="previo-borrar" onClick={() => borrar(v.id)}
                          aria-label={`Borrar visionado del ${formatearFecha(v.vista_el)}`}>✕</button>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: "1.4rem" }}>
            <button className="btn btn-primary" style={{ flex: 1, padding: "11px 0", fontSize: 15 }}
                    onClick={guardar} disabled={guardando}>
              {guardando ? "Guardando…" : esRevision ? "Apuntar revisión" : "Apuntar"}
            </button>
            <button className="btn btn-ghost" style={{ padding: "11px 18px", fontSize: 15 }}
                    onClick={onClose}>Cancelar</button>
          </div>
        </div>
      </div>
    </Portal>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   DIARIO DE UN USUARIO
   Agrupado por mes, como el de Letterboxd.
   ═══════════════════════════════════════════════════════════════════════ */
export default function Diario({ userId, esMio }) {
  const [entradas, setEntradas] = useState(null);

  const cargar = useCallback(() => {
    if (!userId) { setEntradas([]); return; }
    fetchDiario(userId).then(setEntradas).catch(() => setEntradas([]));
  }, [userId]);

  useEffect(cargar, [cargar]);
  useCambios([CAMBIO.ACTIVIDAD], cargar);

  async function borrar(id) {
    setEntradas(p => p.filter(e => e.id !== id));   // optimista
    try {
      await borrarEntrada(id);
      avisar(CAMBIO.ACTIVIDAD);
    } catch (e) {
      toast.error(e.message);
      cargar();
    }
  }

  if (entradas === null) return <div className="skeleton" style={{ height: 160, marginTop: "1rem" }} />;

  if (entradas.length === 0) return (
    <p style={{ color: "var(--text-muted)", fontWeight: 700, padding: "2.5rem 0", textAlign: "center" }}>
      {esMio
        ? "Tu diario está vacío. Abre una serie y pulsa 📅 para apuntar cuándo la viste."
        : "Todavía no ha apuntado ningún visionado."}
    </p>
  );

  // Agrupar por año y mes conservando el orden que ya trae el servidor
  const grupos = [];
  for (const e of entradas) {
    const [a, m] = e.vista_el.split("-").map(Number);
    const clave = `${a}-${m}`;
    const ultimo = grupos[grupos.length - 1];
    if (ultimo?.clave === clave) ultimo.items.push(e);
    else grupos.push({ clave, anio: a, mes: m, items: [e] });
  }

  return (
    <div className="diario" style={{ marginTop: "1rem" }}>
      {grupos.map(g => (
        <section key={g.clave} className="diario-mes">
          <h3 className="diario-titulo font-display">
            {MESES[g.mes - 1]} <span>{g.anio}</span>
            <em>{g.items.length}</em>
          </h3>

          <div className="diario-lista">
            {g.items.map(e => (
              <article key={e.id} className="diario-entrada">
                <span className="diario-dia">{e.vista_el.split("-")[2]}</span>

                <Link to={`/serie/${slugify(e.titulo)}`} className="diario-poster"
                      style={{ background: e.color }} aria-hidden="true" tabIndex={-1}>
                  {e.poster_url && <img src={posterTam(e.poster_url, "w185")} alt="" loading="lazy" />}
                </Link>

                <div className="diario-datos">
                  <Link to={`/serie/${slugify(e.titulo)}`} className="diario-serie">
                    {e.titulo} <span>{e.anio}</span>
                  </Link>
                  <div className="diario-meta">
                    {e.rating != null && <EstrellasNota nota={e.rating / 2} size={12} />}
                    {e.revision && <span className="chip previo-chip">↻ revisión</span>}
                  </div>
                  {e.nota && <p className="diario-nota">{e.nota}</p>}
                </div>

                {esMio && (
                  <button className="diario-borrar" onClick={() => borrar(e.id)}
                          aria-label={`Borrar ${e.titulo} del ${formatearFecha(e.vista_el)}`}>✕</button>
                )}
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
