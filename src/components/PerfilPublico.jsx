// src/components/PerfilPublico.jsx
import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  fetchPerfilPublico, fetchColeccion, fetchResenasDe,
  seguir, dejarDeSeguir, estoySiguiendo, compararCon,
} from "../lib/social";
import { slugify } from "../lib/slug";
import { toast } from "../lib/toast.jsx";
const MisListas = lazy(() => import("./Listas.jsx").then(m => ({ default: m.MisListas })));

function Avatar({ username, size = 36 }) {
  const COLORS = ["#7A0000", "#1A5A9A", "#3A8A4A", "#6030A0", "#C07010"];
  const bg = COLORS[(username?.charCodeAt(0) || 0) % COLORS.length];
  return (
    <div className="avatar" style={{ width: size, height: size, background: bg, fontSize: size * 0.42 }}>
      {(username?.[0] || "?").toUpperCase()}
    </div>
  );
}

function Skeleton({ width = "100%", height = 20, style = {} }) {
  return <div className="skeleton" style={{ width, height, ...style }} />;
}

export default function PerfilPublico({ user, series, onShowAuth }) {
  const { username } = useParams();
  const navigate = useNavigate();

  const [perfil, setPerfil]       = useState(null);
  const [coleccion, setColeccion] = useState({ vistas: [], notas: {} });
  const [resenas, setResenas]     = useState([]);
  const [siguiendo, setSiguiendo] = useState(false);
  const [comparacion, setComp]    = useState(null);
  const [cargando, setCargando]   = useState(true);
  const [ocupado, setOcupado]     = useState(false);
  const [pestana, setPestana]     = useState("vistas");

  const esMiPerfil = user?.profile?.username?.toLowerCase() === username?.toLowerCase();

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    setComp(null);

    (async () => {
      try {
        const p = await fetchPerfilPublico(username);
        if (!vivo) return;
        setPerfil(p);
        if (!p) { setCargando(false); return; }

        document.title = `${p.display_name || p.username} — AnimaFilm`;

        const [col, res] = await Promise.all([
          fetchColeccion(p.id),
          fetchResenasDe(p.id),
        ]);
        if (!vivo) return;
        setColeccion(col);
        setResenas(res);

        if (user && user.id !== p.id) {
          const [sig, cmp] = await Promise.all([
            estoySiguiendo(user.id, p.id),
            compararCon(p.id).catch(() => null),
          ]);
          if (!vivo) return;
          setSiguiendo(sig);
          setComp(cmp);
        }
      } catch (e) {
        if (vivo) toast.error("No hemos podido cargar el perfil.");
      } finally {
        if (vivo) setCargando(false);
      }
    })();

    return () => { vivo = false; };
  }, [username, user]);

  const alternarSeguir = useCallback(async () => {
    if (!user) { onShowAuth?.(); return; }
    if (ocupado || !perfil) return;

    const antes = siguiendo;
    setSiguiendo(!antes);            // optimista
    setOcupado(true);
    try {
      antes ? await dejarDeSeguir(perfil.id) : await seguir(perfil.id);
      setPerfil(p => ({ ...p, seguidores: Number(p.seguidores) + (antes ? -1 : 1) }));
    } catch (e) {
      setSiguiendo(antes);           // reversión
      toast.error(e.message || "No hemos podido completar la acción.");
    } finally {
      setOcupado(false);
    }
  }, [user, perfil, siguiendo, ocupado, onShowAuth]);

  // ── Cargando ────────────────────────────────────────────────────────
  if (cargando) return (
    <div className="page-enter">
      <div className="perfil-cabecera">
        <Skeleton width={84} height={84} style={{ borderRadius: "50%" }} />
        <div style={{ flex: 1 }}>
          <Skeleton height={30} width="45%" style={{ marginBottom: 8 }} />
          <Skeleton height={14} width="30%" />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 12, marginTop: "1.5rem" }}>
        {Array(5).fill(0).map((_, i) => <Skeleton key={i} height={90} />)}
      </div>
    </div>
  );

  // ── No existe ───────────────────────────────────────────────────────
  if (!perfil) return (
    <div className="empty-state page-enter">
      <div style={{ fontSize: 72, marginBottom: 8 }}>🔍</div>
      <p className="font-display" style={{ fontSize: 30, color: "var(--accent)", marginBottom: 10 }}>
        Usuario no encontrado
      </p>
      <p style={{ color: "var(--text-muted)", fontSize: 15, fontWeight: 700, marginBottom: "1.5rem" }}>
        No hay nadie con el nombre <strong>@{username}</strong>.
      </p>
      <Link className="btn btn-primary" to="/" style={{ fontSize: 15, padding: "11px 26px" }}>
        Volver al catálogo
      </Link>
    </div>
  );

  const seriesVistas = series.filter(s => coleccion.vistas.includes(s.id));
  const getSerie = id => series.find(s => s.id === id);

  return (
    <div className="page-enter">
      {/* ── Cabecera ── */}
      <div className="perfil-cabecera">
        <Avatar username={perfil.username} size={84} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="font-display" style={{ fontSize: 32, color: "var(--accent)", lineHeight: 1.1 }}>
            {perfil.display_name || perfil.username}
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 700 }}>
            @{perfil.username} · desde {new Date(perfil.created_at).getFullYear()}
          </p>
          {perfil.bio && (
            <p style={{ fontSize: 14, color: "var(--text-muted)", fontWeight: 700, marginTop: 8, lineHeight: 1.6, maxWidth: 520 }}>
              {perfil.bio}
            </p>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            {esMiPerfil ? (
              <Link className="btn btn-secondary" to="/perfil" style={{ fontSize: 12, padding: "6px 14px" }}>
                ✏️ Editar mi perfil
              </Link>
            ) : (
              <button
                className={siguiendo ? "btn btn-ghost" : "btn btn-primary"}
                style={{ fontSize: 13, padding: "7px 18px" }}
                onClick={alternarSeguir}
                disabled={ocupado}
                aria-pressed={siguiendo}
              >
                {siguiendo ? "✓ Siguiendo" : "+ Seguir"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Cifras ── */}
      <div className="perfil-cifras">
        {[
          { v: perfil.vistas,        l: "vistas" },
          { v: perfil.valoraciones,  l: "valoradas" },
          { v: perfil.nota_media ?? "—", l: "nota media" },
          { v: perfil.resenas,       l: "reseñas" },
          { v: perfil.seguidores,    l: "seguidores" },
          { v: perfil.siguiendo,     l: "siguiendo" },
        ].map(x => (
          <div key={x.l} className="perfil-cifra">
            <span className="font-display">{x.v}</span>
            <span>{x.l}</span>
          </div>
        ))}
      </div>

      {/* ── Comparación ── */}
      {comparacion && comparacion.ambos.length + comparacion.soloOtro.length > 0 && (
        <div className="comparacion animate-fadeUp">
          <h2 className="font-display" style={{ fontSize: 19, color: "var(--accent)", marginBottom: 12 }}>
            🤝 Vosotros dos
          </h2>
          <div className="comparacion-grid">
            <div>
              <strong className="font-display">{comparacion.ambos.length}</strong>
              <span>series en común</span>
            </div>
            <div>
              <strong className="font-display">{comparacion.soloOtro.length}</strong>
              <span>que solo ha visto {perfil.username}</span>
            </div>
            <div>
              <strong className="font-display">{comparacion.soloYo.length}</strong>
              <span>que solo has visto tú</span>
            </div>
            {comparacion.afinidad != null && (
              <div>
                <strong className="font-display" style={{ color: "var(--accent)" }}>
                  {comparacion.afinidad}%
                </strong>
                <span>afinidad, sobre {comparacion.comparadas} puntuadas por ambos</span>
              </div>
            )}
          </div>

          {comparacion.soloOtro.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <p style={{ fontSize: 12, fontWeight: 800, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
                Te podría recomendar
              </p>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                {comparacion.soloOtro.slice(0, 8).map(id => {
                  const s = getSerie(id);
                  return s ? (
                    <Link key={id} to={`/serie/${slugify(s.titulo)}`} className="serie-pill" style={{ background: s.color }}>
                      {s.titulo}
                    </Link>
                  ) : null;
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Pestañas ── */}
      <div className="sort-bar" role="tablist" style={{ marginTop: "1.8rem" }}>
        {[
          { id: "vistas",  label: `📺 Vistas (${seriesVistas.length})` },
          { id: "resenas", label: `💬 Reseñas (${resenas.length})` },
          { id: "listas",  label: "📋 Listas" },
        ].map(t => (
          <button key={t.id} role="tab" aria-selected={pestana === t.id}
                  className={`sort-btn${pestana === t.id ? " active" : ""}`}
                  onClick={() => setPestana(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Contenido ── */}
      {pestana === "listas" ? (
        <Suspense fallback={<div className="skeleton" style={{ height:80, marginTop:"1rem" }}/>}>
          <MisListas user={user} userId={perfil.id} propias={esMiPerfil} />
        </Suspense>
      ) : pestana === "vistas" ? (
        seriesVistas.length > 0 ? (
          <div style={{ display: "flex", gap: 9, flexWrap: "wrap", marginTop: "1rem" }}>
            {seriesVistas.map(s => (
              <Link key={s.id} to={`/serie/${slugify(s.titulo)}`} className="serie-pill" style={{ background: s.color }}>
                {s.titulo}
                {coleccion.notas[s.id] && <em>{coleccion.notas[s.id]}★</em>}
              </Link>
            ))}
          </div>
        ) : (
          <p style={{ color: "var(--text-muted)", fontWeight: 700, padding: "2rem 0", textAlign: "center" }}>
            Todavía no ha marcado ninguna serie.
          </p>
        )
      ) : (
        resenas.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: "1rem" }}>
            {resenas.map(r => {
              const s = getSerie(r.serie_id);
              return (
                <div key={r.id} className="review-card">
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                    {s && (
                      <Link to={`/serie/${slugify(s.titulo)}`} className="chip chip-accent" style={{ textDecoration: "none" }}>
                        {s.titulo}
                      </Link>
                    )}
                    <span style={{ fontSize: 11, color: "var(--text-faint)", fontWeight: 700 }}>
                      {new Date(r.created_at).toLocaleDateString("es-ES")}
                    </span>
                  </div>
                  <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7, fontWeight: 700 }}>
                    {r.content}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ color: "var(--text-muted)", fontWeight: 700, padding: "2rem 0", textAlign: "center" }}>
            Todavía no ha escrito ninguna reseña.
          </p>
        )
      )}
    </div>
  );
}
