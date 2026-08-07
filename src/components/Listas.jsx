// src/components/Listas.jsx
// Gestión de listas personalizadas y diálogo para añadir series.

import { useState, useEffect, useCallback } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  fetchMisListas, fetchListasDe, fetchLista, crearLista,
  actualizarLista, borrarLista, anadirSerie, quitarSerie, listasConSerie,
} from "../lib/listas";
import { slugify } from "../lib/slug";
import { poster as posterTam } from "../lib/series";
import { useModal } from "../lib/useModal";
import { toast } from "../lib/toast.jsx";
import Portal from "./Portal.jsx";

/* ═══════════════════════════════════════════════════════════════════════
   DIÁLOGO: AÑADIR UNA SERIE A MIS LISTAS
   ═══════════════════════════════════════════════════════════════════════ */
export function AnadirALista({ user, serie, onClose }) {
  const modalRef = useModal(onClose);
  const [listas, setListas]   = useState([]);
  const [dentro, setDentro]   = useState([]);
  const [cargando, setCarg]   = useState(true);
  const [nueva, setNueva]     = useState("");
  const [creando, setCreando] = useState(false);

  const recargar = useCallback(async () => {
    const [ls, ids] = await Promise.all([
      fetchMisListas(user.id),
      listasConSerie(user.id, serie.id),
    ]);
    setListas(ls);
    setDentro(ids);
    setCarg(false);
  }, [user.id, serie.id]);

  useEffect(() => { recargar().catch(() => setCarg(false)); }, [recargar]);

  async function alternar(listaId) {
    const estaba = dentro.includes(listaId);
    setDentro(p => estaba ? p.filter(x => x !== listaId) : [...p, listaId]);   // optimista
    try {
      estaba ? await quitarSerie(listaId, serie.id) : await anadirSerie(listaId, serie.id);
    } catch (e) {
      setDentro(p => estaba ? [...p, listaId] : p.filter(x => x !== listaId)); // reversión
      toast.error(e.message || "No hemos podido actualizar la lista.");
    }
  }

  async function crearYAnadir() {
    const nombre = nueva.trim();
    if (!nombre || creando) return;
    setCreando(true);
    try {
      const l = await crearLista({ nombre });
      await anadirSerie(l.id, serie.id);
      setNueva("");
      await recargar();
      toast.ok(`Añadida a "${nombre}"`);
    } catch (e) {
      toast.error(e.message || "No hemos podido crear la lista.");
    } finally {
      setCreando(false);
    }
  }

  return (
    <Portal>
      <div className="overlay" onClick={onClose}>
        <div ref={modalRef} className="modal" role="dialog" aria-modal="true"
             aria-labelledby="anadir-titulo" tabIndex={-1}
             style={{ maxWidth: 420, padding: "1.8rem" }}
             onClick={e => e.stopPropagation()}>
          <h2 id="anadir-titulo" className="font-display"
              style={{ fontSize: 24, color: "var(--accent)", marginBottom: 4 }}>
            📋 Añadir a una lista
          </h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 700, marginBottom: "1.2rem" }}>
            {serie.titulo}
          </p>

          {cargando ? (
            <div className="skeleton" style={{ height: 120 }} />
          ) : (
            <>
              {listas.length > 0 && (
                <div className="lista-selector">
                  {listas.map(l => {
                    const marcada = dentro.includes(l.id);
                    return (
                      <button key={l.id}
                              className={`lista-opcion${marcada ? " marcada" : ""}`}
                              onClick={() => alternar(l.id)}
                              aria-pressed={marcada}>
                        <span className="lista-check" aria-hidden="true">{marcada ? "✓" : ""}</span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <strong>{l.nombre}</strong>
                          <em>{l.num_series} {l.num_series === 1 ? "serie" : "series"}{!l.publica && " · privada"}</em>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              <div style={{ marginTop: listas.length ? "1.1rem" : 0 }}>
                <span style={{ display: "block", fontFamily: "var(--font-display)", fontSize: 13,
                               color: "var(--accent)", marginBottom: 6, letterSpacing: ".06em" }}>
                  Crear una lista nueva
                </span>
                <div style={{ display: "flex", gap: 8 }}>
                  <input className="input" value={nueva} maxLength={60}
                         onChange={e => setNueva(e.target.value)}
                         onKeyDown={e => e.key === "Enter" && crearYAnadir()}
                         placeholder="Ej: Las de después del cole" />
                  <button className="btn btn-primary" style={{ padding: "10px 16px", fontSize: 14 }}
                          onClick={crearYAnadir} disabled={!nueva.trim() || creando}>
                    {creando ? "…" : "Crear"}
                  </button>
                </div>
              </div>
            </>
          )}

          <button className="btn btn-ghost"
                  style={{ width: "100%", marginTop: "1.4rem", padding: "10px 0", fontSize: 14 }}
                  onClick={onClose}>
            Hecho
          </button>
        </div>
      </div>
    </Portal>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   MIS LISTAS — panel dentro del perfil
   ═══════════════════════════════════════════════════════════════════════ */
export function MisListas({ user, propias = true, userId }) {
  const [listas, setListas] = useState(null);
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState("");

  const objetivo = userId ?? user?.id;

  const recargar = useCallback(() => {
    if (!objetivo) { setListas([]); return; }
    (propias ? fetchMisListas(objetivo) : fetchListasDe(objetivo))
      .then(setListas)
      .catch(() => setListas([]));
  }, [objetivo, propias]);

  useEffect(recargar, [recargar]);

  async function crear() {
    const n = nombre.trim();
    if (!n) return;
    try {
      await crearLista({ nombre: n });
      setNombre(""); setCreando(false);
      recargar();
      toast.ok("Lista creada");
    } catch (e) {
      toast.error(e.message || "No hemos podido crear la lista.");
    }
  }

  if (listas === null) return <div className="skeleton" style={{ height: 90, marginTop: "1rem" }} />;

  return (
    <div style={{ marginTop: "1rem" }}>
      {propias && (
        creando ? (
          <div style={{ display: "flex", gap: 8, marginBottom: "1rem" }}>
            <input className="input" value={nombre} maxLength={60} autoFocus
                   onChange={e => setNombre(e.target.value)}
                   onKeyDown={e => e.key === "Enter" && crear()}
                   placeholder="Nombre de la lista" />
            <button className="btn btn-primary" style={{ padding: "10px 16px", fontSize: 14 }}
                    onClick={crear} disabled={!nombre.trim()}>Crear</button>
            <button className="btn btn-ghost" style={{ padding: "10px 14px", fontSize: 14 }}
                    onClick={() => { setCreando(false); setNombre(""); }}>✕</button>
          </div>
        ) : (
          <button className="btn btn-secondary" style={{ marginBottom: "1rem", fontSize: 13 }}
                  onClick={() => setCreando(true)}>+ Nueva lista</button>
        )
      )}

      {listas.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontWeight: 700, padding: "1.5rem 0", textAlign: "center" }}>
          {propias ? "Todavía no has creado ninguna lista." : "No tiene listas públicas."}
        </p>
      ) : (
        <div className="listas-grid">
          {listas.map(l => (
            <Link key={l.id} to={`/lista/${l.id}`} className="lista-card">
              <span className="lista-card-icono" aria-hidden="true">📋</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong>{l.nombre}</strong>
                <em>
                  {l.num_series} {l.num_series === 1 ? "serie" : "series"}
                  {!l.publica && " · 🔒 privada"}
                </em>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   PÁGINA DE UNA LISTA
   ═══════════════════════════════════════════════════════════════════════ */
export default function DetalleLista({ user, series }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lista, setLista]     = useState(null);
  const [cargando, setCarg]   = useState(true);
  const [editando, setEdit]   = useState(false);
  const [nombre, setNombre]   = useState("");
  const [descrip, setDescrip] = useState("");

  const esMia = user && lista && user.id === lista.user_id;

  useEffect(() => {
    let vivo = true;
    setCarg(true);
    fetchLista(id)
      .then(l => {
        if (!vivo) return;
        setLista(l);
        if (l) {
          setNombre(l.nombre);
          setDescrip(l.descripcion || "");
          document.title = `${l.nombre} — AnimaFilm`;
        }
      })
      .catch(() => toast.error("No hemos podido cargar la lista."))
      .finally(() => vivo && setCarg(false));
    return () => { vivo = false; };
  }, [id]);

  async function guardar() {
    try {
      await actualizarLista(id, { nombre: nombre.trim(), descripcion: descrip.trim() || null });
      setLista(l => ({ ...l, nombre: nombre.trim(), descripcion: descrip.trim() || null }));
      setEdit(false);
      toast.ok("Lista actualizada");
    } catch (e) { toast.error(e.message); }
  }

  async function alternarVisibilidad() {
    const nueva = !lista.publica;
    setLista(l => ({ ...l, publica: nueva }));
    try { await actualizarLista(id, { publica: nueva }); }
    catch (e) { setLista(l => ({ ...l, publica: !nueva })); toast.error(e.message); }
  }

  async function eliminar() {
    if (!window.confirm("¿Seguro que quieres borrar esta lista? No se puede deshacer.")) return;
    try {
      await borrarLista(id);
      toast.ok("Lista borrada");
      navigate("/perfil");
    } catch (e) { toast.error(e.message); }
  }

  async function quitar(serieId) {
    setLista(l => ({ ...l, series: l.series.filter(s => s !== serieId) }));
    try { await quitarSerie(id, serieId); }
    catch (e) { toast.error(e.message); }
  }

  if (cargando) return (
    <div className="page-enter">
      <div className="skeleton" style={{ height: 90, marginBottom: 18 }} />
      <div className="skeleton" style={{ height: 200 }} />
    </div>
  );

  if (!lista) return (
    <div className="empty-state page-enter">
      <div style={{ fontSize: 72, marginBottom: 8 }}>📋</div>
      <p className="font-display" style={{ fontSize: 28, color: "var(--accent)", marginBottom: 10 }}>
        Lista no encontrada
      </p>
      <p style={{ color: "var(--text-muted)", fontSize: 15, fontWeight: 700, marginBottom: "1.5rem" }}>
        O no existe, o es privada.
      </p>
      <Link className="btn btn-primary" to="/" style={{ fontSize: 15, padding: "11px 26px" }}>
        Volver al catálogo
      </Link>
    </div>
  );

  const contenido = lista.series.map(sid => series.find(s => s.id === sid)).filter(Boolean);

  return (
    <div className="page-enter">
      {/* Volver: usa el historial si venimos de dentro; si se entró por
          enlace directo, lleva al catálogo. */}
      <button className="volver"
              onClick={()=> window.history.length > 2 ? navigate(-1) : navigate("/")}>
        <span aria-hidden="true">←</span> Volver
      </button>

      <div className="lista-cabecera">
        {editando ? (
          <div style={{ flex: 1 }}>
            <input className="input" value={nombre} maxLength={60}
                   onChange={e => setNombre(e.target.value)} style={{ marginBottom: 8 }} />
            <textarea className="textarea" rows={2} value={descrip} maxLength={300}
                      onChange={e => setDescrip(e.target.value)}
                      placeholder="Descripción (opcional)" />
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={guardar}>Guardar</button>
              <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => setEdit(false)}>Cancelar</button>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 className="font-display" style={{ fontSize: 32, color: "var(--accent)", lineHeight: 1.1 }}>
              {lista.nombre}
            </h1>
            <p style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 700, marginTop: 4 }}>
              {contenido.length} {contenido.length === 1 ? "serie" : "series"} ·{" "}
              <Link to={`/u/${lista.username}`} className="enlace-usuario">
                <strong>{lista.display_name || lista.username}</strong>
              </Link>
              {!lista.publica && " · 🔒 privada"}
            </p>
            {lista.descripcion && (
              <p style={{ fontSize: 14, color: "var(--text-muted)", fontWeight: 700, marginTop: 10, lineHeight: 1.6, maxWidth: 560 }}>
                {lista.descripcion}
              </p>
            )}
            {esMia && (
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <button className="btn btn-secondary" style={{ fontSize: 12, padding: "6px 14px" }}
                        onClick={() => setEdit(true)}>✏️ Editar</button>
                <button className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 14px" }}
                        onClick={alternarVisibilidad}>
                  {lista.publica ? "🔒 Hacer privada" : "🌍 Hacer pública"}
                </button>
                <button className="btn btn-danger" style={{ fontSize: 12, padding: "6px 14px" }}
                        onClick={eliminar}>🗑️ Borrar</button>
              </div>
            )}
          </div>
        )}
      </div>

      {contenido.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontWeight: 700, padding: "3rem 0", textAlign: "center" }}>
          Esta lista está vacía. Abre una serie y usa <strong>📋 Añadir a lista</strong>.
        </p>
      ) : (
        <div className="series-grid" style={{ marginTop: "1.5rem" }}>
          {contenido.map((s, i) => (
            <article key={s.id} className="card animate-fadeUp"
                     style={{ animationDelay: `${Math.min(i * 30, 400)}ms` }}>
              <Link to={`/serie/${slugify(s.titulo)}`} className="card-poster-link"
                    tabIndex={-1} aria-hidden="true">
                <div className="card-poster" style={{ background: s.color }}>
                  {s.poster
                    ? <img src={posterTam(s.poster, "w185")} alt="" width="185" height="278"
                           loading={i < 6 ? "eager" : "lazy"} decoding="async" />
                    : <div className="card-poster-fallback">
                        <span className="font-display">{s.titulo}</span>
                      </div>}
                  <span className="poster-badge">{s.decada} · {s.año}</span>
                </div>
              </Link>

              <div className="card-body" style={{ paddingBottom: 12 }}>
                <h3 className="card-title truncate">
                  <Link to={`/serie/${slugify(s.titulo)}`}>{s.titulo}</Link>
                </h3>
                <div className="card-meta">
                  <span>{s.cadena} · {s.episodios} ep.</span>
                </div>
                {esMia && (
                  <button className="btn btn-ghost"
                          style={{ width: "100%", padding: "5px 0", fontSize: 11, borderRadius: 8 }}
                          onClick={() => quitar(s.id)}
                          aria-label={`Quitar ${s.titulo} de la lista`}>
                    ✕ Quitar
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
