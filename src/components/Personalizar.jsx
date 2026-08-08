// src/components/Personalizar.jsx
// Elegir avatar y series favoritas del perfil.

import { useState, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { useModal } from "../lib/useModal";
import { toast } from "../lib/toast.jsx";
import Portal from "./Portal.jsx";
import Avatar, { EMOJIS_AVATAR, COLORES_AVATAR, colorPorNombre } from "./Avatar.jsx";
import { poster as posterTam } from "../lib/series";

export default function Personalizar({ user, series, onClose, onSaved }) {
  const modalRef = useModal(onClose);
  const p = user.profile || {};

  const [emoji, setEmoji]   = useState(p.avatar_emoji || "");
  const [color, setColor]   = useState(p.avatar_color || colorPorNombre(p.username || ""));
  const [favs, setFavs]     = useState(Array.isArray(p.favoritas) ? p.favoritas : []);
  const [pestana, setPest]  = useState("avatar");
  const [busca, setBusca]   = useState("");
  const [guardando, setGuardando] = useState(false);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const lista = q ? series.filter(s => s.titulo.toLowerCase().includes(q)) : series;
    return lista.slice(0, 40);
  }, [series, busca]);

  function alternarFavorita(id) {
    setFavs(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 4) {
        toast("Solo puedes destacar 4 series. Quita una primero.", "info");
        return prev;
      }
      return [...prev, id];
    });
  }

  async function guardar() {
    setGuardando(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        avatar_emoji: emoji || null,
        avatar_color: color || null,
        favoritas: favs,
      })
      .eq("id", user.id);
    setGuardando(false);

    if (error) { toast.error(error.message || "No hemos podido guardar."); return; }
    toast.ok("Perfil actualizado");
    onSaved?.();
    onClose();
  }

  const perfilPrevio = { username: p.username, avatar_emoji: emoji, avatar_color: color };

  return (
    <Portal>
      <div className="overlay" onClick={onClose}>
        <div ref={modalRef} className="modal" role="dialog" aria-modal="true"
             aria-labelledby="pers-titulo" tabIndex={-1}
             style={{ maxWidth: 520, padding: "1.8rem" }}
             onClick={e => e.stopPropagation()}>

          <h2 id="pers-titulo" className="font-display"
              style={{ fontSize: 26, color: "var(--accent)", marginBottom: "1.2rem" }}>
            🎨 Personalizar perfil
          </h2>

          {/* Vista previa */}
          <div className="pers-previo">
            <Avatar perfil={perfilPrevio} size={62} />
            <div>
              <strong>{p.display_name || p.username}</strong>
              <em>@{p.username}</em>
            </div>
          </div>

          {/* Pestañas */}
          <div className="sort-bar" role="tablist" style={{ marginTop: "1.2rem" }}>
            {[
              { id: "avatar",  label: "🎭 Avatar" },
              { id: "favs",    label: `⭐ Favoritas (${favs.length}/4)` },
            ].map(t => (
              <button key={t.id} role="tab" aria-selected={pestana === t.id}
                      className={`sort-btn${pestana === t.id ? " active" : ""}`}
                      onClick={() => setPest(t.id)}>{t.label}</button>
            ))}
          </div>

          <div className="pers-panel">
            {/* ── AVATAR ── */}
            {pestana === "avatar" && (
              <>
                <p className="pers-label">Color</p>
                <div className="pers-colores">
                  {COLORES_AVATAR.map(c => (
                    <button key={c} className={`pers-color${color === c ? " activo" : ""}`}
                            style={{ background: c }} onClick={() => setColor(c)}
                            aria-label={`Color ${c}`} aria-pressed={color === c} />
                  ))}
                </div>

                <p className="pers-label" style={{ marginTop: "1rem" }}>Icono</p>
                <div className="pers-emojis">
                  <button className={`pers-emoji${!emoji ? " activo" : ""}`}
                          onClick={() => setEmoji("")}
                          title="Usar mi inicial">
                    {(p.username?.[0] || "?").toUpperCase()}
                  </button>
                  {EMOJIS_AVATAR.map(e => (
                    <button key={e} className={`pers-emoji${emoji === e ? " activo" : ""}`}
                            onClick={() => setEmoji(e)} aria-pressed={emoji === e}>
                      {e}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* ── FAVORITAS ── */}
            {pestana === "favs" && (
              <>
                <p style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 700, marginBottom: 10 }}>
                  Elige hasta cuatro. Aparecerán destacadas en lo alto de tu perfil.
                </p>
                <input className="input" type="search" value={busca}
                       onChange={e => setBusca(e.target.value)}
                       placeholder="🔍  Buscar serie…" style={{ marginBottom: 12 }} />
                <div className="pers-series">
                  {filtradas.map(s => {
                    const elegida = favs.includes(s.id);
                    return (
                      <button key={s.id}
                              className={`pers-serie${elegida ? " elegida" : ""}`}
                              onClick={() => alternarFavorita(s.id)}
                              aria-pressed={elegida}
                              title={s.titulo}>
                        {s.poster
                          ? <img src={posterTam(s.poster, "w185")} alt="" loading="lazy" />
                          : <span style={{ background: s.color }} className="pers-serie-color" />}
                        <span className="pers-serie-nombre">{s.titulo}</span>
                        {elegida && <span className="pers-serie-orden">{favs.indexOf(s.id) + 1}</span>}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

          </div>

          <div style={{ display: "flex", gap: 10, marginTop: "1.4rem" }}>
            <button className="btn btn-primary" style={{ flex: 1, padding: "11px 0", fontSize: 15 }}
                    onClick={guardar} disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar cambios"}
            </button>
            <button className="btn btn-ghost" style={{ padding: "11px 18px", fontSize: 15 }}
                    onClick={onClose}>Cancelar</button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
