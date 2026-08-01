// src/components/GestionCuenta.jsx
// Editar perfil, descargar tus datos y borrar la cuenta.
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import Portal from "./Portal.jsx";
import { useModal } from "../lib/useModal";

const USER_RE = /^[a-z0-9_.-]{3,20}$/;

/* ═══════════════════════════════════════════════════════════════════════
   EDITAR PERFIL
   ═══════════════════════════════════════════════════════════════════════ */
export function EditarPerfil({ user, onClose, onSaved }) {
  const p = user.profile || {};
  const [username, setUsername] = useState(p.username || "");
  const [display,  setDisplay]  = useState(p.display_name || "");
  const [bio,      setBio]      = useState(p.bio || "");
  const [estado,   setEstado]   = useState(null);   // null | "libre" | "ocupado" | "comprobando"
  const [error,    setError]    = useState(null);
  const [guardando, setGuardando] = useState(false);
  const modalRef = useModal(onClose);

  // Comprueba disponibilidad con retardo, para no consultar en cada tecla
  useEffect(() => {
    const limpio = username.toLowerCase().trim();
    if (limpio === (p.username || "") || !USER_RE.test(limpio)) { setEstado(null); return; }
    setEstado("comprobando");
    const t = setTimeout(async () => {
      const { data, error } = await supabase.rpc("username_disponible", { nombre: limpio });
      setEstado(error ? null : (data ? "libre" : "ocupado"));
    }, 450);
    return () => clearTimeout(t);
  }, [username, p.username]);

  async function guardar() {
    const limpio = username.toLowerCase().trim();
    if (!USER_RE.test(limpio)) {
      setError("El usuario debe tener 3–20 caracteres: letras, números, guion, punto o guion bajo.");
      return;
    }
    if (estado === "ocupado") { setError("Ese nombre de usuario ya está cogido."); return; }

    setError(null); setGuardando(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        username: limpio,
        display_name: display.trim() || null,
        bio: bio.trim() || null,
      })
      .eq("id", user.id);
    setGuardando(false);

    if (error) {
      setError(
        error.code === "23505"
          ? "Ese nombre de usuario ya está cogido."
          : error.message || "No hemos podido guardar los cambios."
      );
      return;
    }
    onSaved?.();
    onClose();
  }

  const label = { display:"block", fontFamily:"var(--font-display)", fontSize:14, color:"var(--accent)", marginBottom:5, letterSpacing:".06em" };

  return (
    <Portal>
    <div className="overlay" onClick={onClose}>
      <div ref={modalRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="editar-titulo" tabIndex={-1} style={{ maxWidth:440, padding:"2rem" }} onClick={e=>e.stopPropagation()}>
        <h2 id="editar-titulo" className="font-display" style={{ fontSize:28, color:"var(--accent)", marginBottom:"1.4rem" }}>
          ✏️ Editar perfil
        </h2>

        {error && (
          <div role="alert" style={{ background:"var(--rojo)", color:"#fff", border:"3px solid var(--border)", borderRadius:"var(--radius-sm)", padding:"10px 14px", fontSize:14, marginBottom:"1rem", fontWeight:700, boxShadow:"3px 3px 0 var(--border)" }}>
            ¡ZAS! {error}
          </div>
        )}

        <div style={{ marginBottom:"1rem" }}>
          <span style={label}>Nombre de usuario</span>
          <input className="input" value={username} maxLength={20}
                 onChange={e=>setUsername(e.target.value)} />
          <div aria-live="polite" style={{ minHeight:18, marginTop:5, fontSize:12, fontWeight:700 }}>
            {estado==="comprobando" && <span style={{ color:"var(--text-faint)" }}>Comprobando…</span>}
            {estado==="libre"       && <span style={{ color:"var(--verde-ok)" }}>✓ Disponible</span>}
            {estado==="ocupado"     && <span style={{ color:"var(--rojo)" }}>✕ Ya está cogido</span>}
          </div>
        </div>

        <div style={{ marginBottom:"1rem" }}>
          <span style={label}>Nombre visible</span>
          <input className="input" value={display} maxLength={40}
                 onChange={e=>setDisplay(e.target.value)}
                 placeholder="Como quieres que te vean" />
        </div>

        <div style={{ marginBottom:"1.5rem" }}>
          <span style={label}>Sobre ti</span>
          <textarea className="textarea" rows={3} value={bio} maxLength={300}
                    onChange={e=>setBio(e.target.value)}
                    placeholder="¿Qué serie te marcó más de pequeño?" />
          <div style={{ textAlign:"right", fontSize:11, color:"var(--text-faint)", fontWeight:700, marginTop:3 }}>
            {bio.length}/300
          </div>
        </div>

        <div style={{ display:"flex", gap:10 }}>
          <button className="btn btn-primary" style={{ flex:1, padding:"11px 0", fontSize:15 }}
                  onClick={guardar} disabled={guardando || estado==="ocupado"}>
            {guardando ? "Guardando…" : "Guardar cambios"}
          </button>
          <button className="btn btn-ghost" style={{ padding:"11px 18px", fontSize:15 }} onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
    </Portal>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   BORRAR CUENTA
   ═══════════════════════════════════════════════════════════════════════ */
export function BorrarCuenta({ user, onClose }) {
  const [confirmacion, setConfirmacion] = useState("");
  const [error, setError]   = useState(null);
  const [fase, setFase]     = useState("aviso");   // aviso | confirmar | borrando
  const nombre = user.profile?.username || "";
  // Mientras se borra no se puede cerrar: la operación es irreversible
  const modalRef = useModal(fase === "borrando" ? undefined : onClose);

  async function descargarDatos() {
    const uid = user.id;
    const [r, rv, w, wl] = await Promise.all([
      supabase.from("ratings").select("serie_id, rating, created_at").eq("user_id", uid),
      supabase.from("reviews").select("serie_id, content, created_at").eq("user_id", uid),
      supabase.from("watched").select("serie_id, watched_at").eq("user_id", uid),
      supabase.from("watchlist").select("serie_id, added_at").eq("user_id", uid),
    ]);
    const datos = {
      exportado: new Date().toISOString(),
      perfil: user.profile,
      valoraciones: r.data ?? [],
      resenas: rv.data ?? [],
      vistas: w.data ?? [],
      pendientes: wl.data ?? [],
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(datos, null, 2)], { type: "application/json" })
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `animafilm-${nombre || "datos"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function borrar() {
    setFase("borrando"); setError(null);
    const { error } = await supabase.rpc("delete_own_account");
    if (error) {
      setError(error.message || "No hemos podido borrar la cuenta.");
      setFase("confirmar");
      return;
    }
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <Portal>
    <div className="overlay" onClick={fase==="borrando" ? undefined : onClose}>
      <div ref={modalRef} className="modal danger-modal" role="alertdialog" aria-modal="true" aria-labelledby="borrar-titulo" tabIndex={-1} style={{ maxWidth:420, padding:"2rem" }} onClick={e=>e.stopPropagation()}>
        <h2 id="borrar-titulo" className="font-display" style={{ fontSize:26, color:"var(--rojo)", marginBottom:"1rem" }}>
          ⚠️ Borrar mi cuenta
        </h2>

        {error && (
          <div role="alert" style={{ background:"var(--rojo)", color:"#fff", border:"3px solid var(--border)", borderRadius:"var(--radius-sm)", padding:"10px 14px", fontSize:14, marginBottom:"1rem", fontWeight:700 }}>
            {error}
          </div>
        )}

        {fase === "aviso" ? (
          <>
            <p style={{ color:"var(--text-muted)", fontSize:15, lineHeight:1.7, fontWeight:700, marginBottom:"1rem" }}>
              Se borrarán <strong>para siempre</strong> tu perfil, tus valoraciones,
              tus reseñas y tus listas. Esto no se puede deshacer.
            </p>
            <p style={{ color:"var(--text-muted)", fontSize:14, lineHeight:1.6, fontWeight:700, marginBottom:"1.4rem" }}>
              Antes de irte puedes llevarte una copia de todo lo que has guardado.
            </p>

            <button className="btn btn-secondary" style={{ width:"100%", padding:"10px 0", fontSize:14, marginBottom:10 }}
                    onClick={descargarDatos}>
              ⬇️ Descargar mis datos
            </button>

            <div style={{ display:"flex", gap:10 }}>
              <button className="btn btn-ghost" style={{ flex:1, padding:"11px 0", fontSize:15 }} onClick={onClose}>
                Mejor no
              </button>
              <button className="btn btn-danger" style={{ flex:1, padding:"11px 0", fontSize:15 }}
                      onClick={()=>setFase("confirmar")}>
                Continuar
              </button>
            </div>
          </>
        ) : (
          <>
            <p style={{ color:"var(--text-muted)", fontSize:15, lineHeight:1.7, fontWeight:700, marginBottom:"1rem" }}>
              Escribe <strong style={{ color:"var(--rojo)" }}>{nombre}</strong> para confirmar.
            </p>
            <input className="input" value={confirmacion} autoFocus
                   disabled={fase==="borrando"}
                   onChange={e=>setConfirmacion(e.target.value)}
                   placeholder={nombre} style={{ marginBottom:"1.4rem" }} />

            <div style={{ display:"flex", gap:10 }}>
              <button className="btn btn-ghost" style={{ flex:1, padding:"11px 0", fontSize:15 }}
                      onClick={onClose} disabled={fase==="borrando"}>
                Cancelar
              </button>
              <button className="btn btn-danger" style={{ flex:1, padding:"11px 0", fontSize:15 }}
                      onClick={borrar}
                      disabled={confirmacion !== nombre || fase==="borrando"}>
                {fase==="borrando" ? "Borrando…" : "Borrar cuenta"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
    </Portal>
  );
}
