// src/components/Comentarios.jsx
// Hilo de comentarios de una reseña.

import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { fetchComentarios, comentar, borrarComentario } from "../lib/resenas";
import { toast } from "../lib/toast.jsx";
import Avatar from "./Avatar.jsx";

function haceCuanto(iso) {
  const seg = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (seg < 60)     return "ahora";
  if (seg < 3600)   return `hace ${Math.floor(seg / 60)} min`;
  if (seg < 86400)  return `hace ${Math.floor(seg / 3600)} h`;
  if (seg < 604800) return `hace ${Math.floor(seg / 86400)} d`;
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

export default function Comentarios({ reviewId, autorResena, user, onShowAuth, onCambio }) {
  const [lista, setLista]       = useState(null);
  const [texto, setTexto]       = useState("");
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(() => {
    fetchComentarios(reviewId)
      .then(setLista)
      .catch(() => setLista([]));
  }, [reviewId]);

  useEffect(cargar, [cargar]);

  async function enviar() {
    if (!user) { onShowAuth?.(); return; }
    const t = texto.trim();
    if (!t || enviando) return;

    setEnviando(true);
    try {
      await comentar(reviewId, user.id, t);
      setTexto("");
      cargar();
      onCambio?.(+1);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setEnviando(false);
    }
  }

  async function borrar(id) {
    const copia = lista;
    setLista(l => l.filter(c => c.id !== id));   // optimista
    try {
      await borrarComentario(id);
      onCambio?.(-1);
    } catch (e) {
      setLista(copia);
      toast.error(e.message);
    }
  }

  // Enter envía; Mayús+Enter salta de línea
  function alTeclear(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  }

  return (
    <div className="comentarios">
      {lista === null ? (
        <div className="skeleton" style={{ height: 44 }} />
      ) : (
        lista.map(c => (
          <div key={c.id} className="comentario">
            <Link to={`/u/${c.username}`} aria-label={`Ver perfil de ${c.username}`}>
              <Avatar perfil={c} size={26} />
            </Link>

            <div className="comentario-cuerpo">
              <div className="comentario-cabecera">
                <Link to={`/u/${c.username}`} className="enlace-usuario">
                  <strong>{c.display_name || c.username}</strong>
                </Link>
                {c.user_id === autorResena && (
                  <span className="chip comentario-autor">autor</span>
                )}
                <span className="comentario-fecha">{haceCuanto(c.created_at)}</span>
              </div>
              <p className="comentario-texto">{c.content}</p>
            </div>

            {c.puedo_borrar && (
              <button className="comentario-borrar" onClick={() => borrar(c.id)}
                      aria-label="Borrar comentario">✕</button>
            )}
          </div>
        ))
      )}

      {user ? (
        <div className="comentario-nuevo">
          <Avatar perfil={user.profile} size={26} />
          <textarea
            className="textarea comentario-campo"
            value={texto}
            onChange={e => setTexto(e.target.value)}
            onKeyDown={alTeclear}
            maxLength={600}
            rows={1}
            placeholder="Responder…"
          />
          <button className="btn btn-primary comentario-enviar"
                  onClick={enviar} disabled={!texto.trim() || enviando}>
            {enviando ? "…" : "Enviar"}
          </button>
        </div>
      ) : (
        <button className="comentario-invitacion" onClick={onShowAuth}>
          Inicia sesión para responder
        </button>
      )}
    </div>
  );
}
