// src/App.jsx — AnimaFilm v3 (diseño mejorado)
import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from "react";
import { Routes, Route, NavLink, Navigate, useNavigate, useMatch, useLocation, useSearchParams, Link } from "react-router-dom";
import { supabase } from "./lib/supabase";
import { fetchSeries, fetchSeriesStats, poster as posterTam } from "./lib/series";
import { slugify, findBySlug } from "./lib/slug";
const EditarPerfil  = lazy(() => import("./components/GestionCuenta.jsx").then(m => ({ default: m.EditarPerfil })));
const BorrarCuenta  = lazy(() => import("./components/GestionCuenta.jsx").then(m => ({ default: m.BorrarCuenta })));
import Portal from "./components/Portal.jsx";
import Avatar from "./components/Avatar.jsx";
import Estrellas, { EstrellasNota } from "./components/Estrellas.jsx";
import { fetchResenas, darLike, quitarLike } from "./lib/resenas";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { fetchSeguidos, buscarUsuarios } from "./lib/social";
const PerfilPublico = lazy(() => import("./components/PerfilPublico.jsx"));
const DetalleLista  = lazy(() => import("./components/Listas.jsx"));
const Estadisticas  = lazy(() => import("./components/Estadisticas.jsx"));
const AnadirALista  = lazy(() => import("./components/Listas.jsx").then(m => ({ default: m.AnadirALista })));
const MisListas     = lazy(() => import("./components/Listas.jsx").then(m => ({ default: m.MisListas })));
import { useModal } from "./lib/useModal";
import { Toasts, toast, mensajeDeError } from "./lib/toast.jsx";
import { avisar, useCambios, CAMBIO } from "./lib/eventos";
import { useThemeToggle } from "./lib/useThemeToggle.js";
// Estos componentes solo aparecen al pulsar algo: no deben pesar
// en la descarga inicial.
const Auth          = lazy(() => import("./components/Auth.jsx"));



const DECADAS = ["Todas","70s","80s","90s","00s"];

// Criterios de ordenación. `fn` recibe (a, b, stats) y devuelve el
// comparador; las series sin datos van siempre al final.
const ORDENES = [
  { id:"año",     label:"Año",        icon:"📅" },
  { id:"nota",    label:"Mejor nota", icon:"⭐" },
  { id:"vistas",  label:"Más vistas", icon:"👁️" },
  { id:"titulo",  label:"A-Z",        icon:"🔤" },
];

function Skeleton({ width="100%", height=20, style={} }) {
  return <div className="skeleton" style={{ width, height, ...style }} />;
}

function CardSkeleton() {
  return (
    <div className="card" style={{ overflow:"hidden" }}>
      <Skeleton height={190} style={{ borderRadius:0 }} />
      <div style={{ padding:"10px 12px 14px", display:"flex", flexDirection:"column", gap:8 }}>
        <Skeleton height={14} width="75%" /><Skeleton height={11} width="50%" />
        <Skeleton height={16} width="80px" /><Skeleton height={32} />
      </div>
    </div>
  );
}

function SerieCard({ serie, poster, stats, vista, pendiente, rating, onToggleVista, onTogglePendiente, onRate, animDelay=0, prioritaria=false, filtros="" }) {
  // Arrastrar los filtros evita que el catálogo de detrás se "desfiltre"
  // mientras el modal está abierto.
  const url = `/serie/${slugify(serie.titulo)}${filtros}`;
  return (
    <article className={`card animate-fadeUp${vista?" watched":""}`} style={{ animationDelay:`${animDelay}ms` }}>
      <Link to={url} className="card-poster-link" tabIndex={-1} aria-hidden="true">
      <div className="card-poster" style={{ background:serie.color }}>
        {poster
          ? <img src={posterTam(poster,"w185")} alt="" width="185" height="278"
                 loading={prioritaria ? "eager" : "lazy"}
                 fetchPriority={prioritaria ? "high" : "auto"}
                 decoding={prioritaria ? "sync" : "async"} />
          : <div className="card-poster-fallback">
              <span className="font-display">{serie.titulo}</span>
            </div>
        }
        {vista && <div className="status-badge status-vista">✓</div>}
        {pendiente&&!vista && <div className="status-badge status-pendiente">🕐</div>}
        <span className="poster-badge">{serie.decada} · {serie.año}</span>
      </div>
      </Link>
      <div className="card-body">
        <h3 className="card-title truncate"><Link to={url}>{serie.titulo}</Link></h3>
        <div className="card-meta">
          <span>{serie.cadena} · {serie.episodios} ep.</span>
          {stats?.nota_media != null && (
            <span className="card-avg" title={`${stats.votos} ${stats.votos===1?"voto":"votos"} de la comunidad`}>
              ⭐ {Number(stats.nota_media).toFixed(1)}
              <em>({stats.votos})</em>
            </span>
          )}
        </div>
        <div style={{ marginBottom:9 }}><Estrellas valor={rating} onChange={onRate} size={15} /></div>
        <div style={{ display:"flex", gap:6 }}>
          <button className={vista?"btn btn-primary":"btn btn-secondary"} style={{ flex:1, padding:"5px 0", fontSize:11, borderRadius:8 }}
                  aria-pressed={vista}
                  aria-label={vista?`Desmarcar ${serie.titulo} como vista`:`Marcar ${serie.titulo} como vista`}
                  onClick={e=>{ e.stopPropagation(); onToggleVista(); }}>{vista?"✓ Vista":"Marcar vista"}</button>
          <button className={pendiente?"btn btn-warning":"btn btn-ghost"} style={{ padding:"5px 10px", fontSize:13, borderRadius:8 }}
                  aria-pressed={pendiente}
                  aria-label={pendiente?`Quitar ${serie.titulo} de pendientes`:`Añadir ${serie.titulo} a pendientes`}
                  onClick={e=>{ e.stopPropagation(); onTogglePendiente(); }}>🕐</button>
        </div>
      </div>
    </article>
  );
}

function SerieModal({ serie, poster, stats, vista, pendiente, rating, user, onClose, onToggleVista, onTogglePendiente, onRate, onShowAuth, onFiltrarGenero }) {
  // En móvil abre el menú nativo de compartir; en escritorio copia el enlace.
  async function compartir() {
    const url   = `${window.location.origin}/serie/${slugify(serie.titulo)}`;
    const texto = `${serie.titulo} (${serie.año}) en AnimaFilm`;
    // El menú nativo de compartir existe también en Windows, pero ahí
    // interrumpe más de lo que ayuda: en escritorio se espera que un
    // botón de compartir copie el enlace. Lo reservamos para táctiles.
    const esTactil = window.matchMedia("(pointer: coarse)").matches;

    try {
      if (esTactil && navigator.share) {
        await navigator.share({ title: texto, text: texto, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.ok("Enlace copiado al portapapeles");
    } catch (e) {
      // AbortError = el usuario cerró el menú de compartir. No es un fallo.
      if (e?.name !== "AbortError") toast.error("No hemos podido copiar el enlace.");
    }
  }

  const [reviews, setReviews] = useState([]);
  const [myReview, setMyReview] = useState("");
  const [editing, setEditing] = useState(false);
  const [loadingR, setLoadingR] = useState(true);
  const modalRef = useModal(onClose);

  const [orden, setOrden] = useState("populares");

  const cargarResenas = useCallback(async ()=>{
    setLoadingR(true);
    try {
      const data = await fetchResenas(serie.id, orden);
      setReviews(data);
      if(user) setMyReview(data.find(r=>r.user_id===user.id)?.content || "");
    } catch {
      setReviews([]);
    } finally {
      setLoadingR(false);
    }
  },[serie.id, orden, user]);

  useEffect(()=>{ cargarResenas(); },[cargarResenas]);

  const hasMyReview=reviews.some(r=>r.user_id===user?.id);

  const [guardando, setGuardando] = useState(false);
  const [mostrarListas, setMostrarListas] = useState(false);

  const recargarReseñas = cargarResenas;

  // ── ME GUSTA ────────────────────────────────────────────────────────
  // Optimista: el corazón responde al instante y se revierte si falla.
  const [ocupadoLike, setOcupadoLike] = useState(null);

  async function alternarLike(r){
    if(!user){ onShowAuth?.(); return; }
    if(r.user_id === user.id){ toast("No puedes dar me gusta a tu propia reseña.", "info"); return; }
    if(ocupadoLike === r.id) return;

    const teGustaba = r.me_gusta;
    setOcupadoLike(r.id);
    setReviews(prev => prev.map(x => x.id === r.id
      ? { ...x, me_gusta: !teGustaba, likes: Number(x.likes) + (teGustaba ? -1 : 1) }
      : x));

    try {
      teGustaba ? await quitarLike(r.id, user.id) : await darLike(r.id, user.id);
    } catch (e) {
      setReviews(prev => prev.map(x => x.id === r.id
        ? { ...x, me_gusta: teGustaba, likes: Number(x.likes) + (teGustaba ? 1 : -1) }
        : x));
      toast.error(e.message || "No hemos podido registrar tu me gusta.");
    } finally {
      setOcupadoLike(null);
    }
  }

  async function saveReview(){
    const texto = myReview.trim();
    if(!texto||!user||guardando) return;
    if(texto.length > 2000){ toast.error("La reseña no puede pasar de 2000 caracteres."); return; }

    setGuardando(true);
    const {error}=await supabase.from("reviews")
      .upsert({user_id:user.id,serie_id:serie.id,content:texto},{onConflict:"user_id,serie_id"});
    setGuardando(false);

    if(error){ toast.error(mensajeDeError(error)); return; }

    setEditing(false);
    toast.ok("Reseña publicada");
    recargarReseñas();
    avisar(CAMBIO.RESENA, { serie: serie.id });
  }

  async function deleteReview(){
    if(guardando) return;
    const copia = myReview;              // por si hay que devolverlo
    setGuardando(true);
    const {error}=await supabase.from("reviews").delete().eq("user_id",user.id).eq("serie_id",serie.id);
    setGuardando(false);

    if(error){ setMyReview(copia); toast.error(mensajeDeError(error)); return; }

    setMyReview("");
    toast.ok("Reseña eliminada");
    recargarReseñas();
    avisar(CAMBIO.RESENA, { serie: serie.id });
  }

  return (
    <Portal>
    <div className="overlay" onClick={onClose}>
      <div ref={modalRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="serie-titulo" tabIndex={-1} onClick={e=>e.stopPropagation()}>
        <div className="modal-head">
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">✕</button>

          {/* Póster completo, con su proporción real y enmarcado como viñeta */}
          <div className="modal-poster" style={{ background:serie.color }}>
            {poster
              ? <img src={posterTam(poster,"w342")} alt={`Cartel de ${serie.titulo}`} width="342" height="513" />
              : <span className="font-display">{serie.titulo}</span>
            }
          </div>

          <div className="modal-head-info">
            <h2 id="serie-titulo" className="modal-title font-display">{serie.titulo}</h2>
            <p className="modal-meta">{serie.año}</p>
            <p className="modal-meta">{serie.cadena}</p>
            <p className="modal-meta">{serie.episodios} episodios</p>
            <div className="modal-genres">
              {serie.generos.map(g=>(
                <button key={g} className="genre-chip genre-chip-btn"
                        onClick={()=>onFiltrarGenero?.(g)}
                        title={`Ver todas las series de ${g}`}>{g}</button>
              ))}
              <span className="chip chip-accent">{serie.decada}</span>
            </div>
          </div>
        </div>
        <div style={{ padding:"1.5rem 1.8rem 2rem" }}>
          <p style={{ color:"var(--text-muted)", lineHeight:1.75, fontSize:15, marginBottom:"1.5rem" }}>{serie.descripcion}</p>
          {stats?.nota_media != null && (
            <div className="community-box">
              <div className="community-score">
                <span className="community-num">{Number(stats.nota_media).toFixed(1)}</span>
                <span className="community-max">/5</span>
              </div>
              <div className="community-detail">
                <strong>Nota de la comunidad</strong>
                <EstrellasNota nota={stats.nota_media} size={14} />
                <span>
                  {stats.votos} {stats.votos===1?"voto":"votos"}
                  {stats.vistas_totales>0 && ` · ${stats.vistas_totales} la han visto`}
                </span>
              </div>
            </div>
          )}

          <div style={{ marginBottom:"1.2rem" }}>
            <p style={{ fontWeight:800, fontSize:11, color:"var(--accent)", marginBottom:10, letterSpacing:1.5, textTransform:"uppercase" }}>Tu valoración</p>
            <Estrellas valor={rating} onChange={onRate} size={30} mostrarNumero />
            {rating>0&&<p style={{ fontSize:12, color:"var(--text-faint)", marginTop:7, fontWeight:700 }}>Pulsa la mitad izquierda de una estrella para media nota</p>}
          </div>
          <div style={{ display:"flex", gap:10, marginBottom:"2rem" }}>
            <button className={vista?"btn btn-primary":"btn btn-secondary"} style={{ flex:1, padding:"11px 0", fontSize:14 }} onClick={onToggleVista}>{vista?"✓ Ya la he visto":"Marcar como vista"}</button>
            <button className={pendiente?"btn btn-warning":"btn btn-ghost"} style={{ padding:"11px 18px", fontSize:14 }} onClick={onTogglePendiente}>{pendiente?"🕐 Guardada":"🕐 Pendiente"}</button>
            <button className="btn btn-ghost" style={{ padding:"11px 16px", fontSize:14 }}
                    onClick={()=> user ? setMostrarListas(true) : onShowAuth?.()}
                    aria-label={`Añadir ${serie.titulo} a una lista`} title="Añadir a lista">
              📋
            </button>
            <button className="btn btn-ghost" style={{ padding:"11px 16px", fontSize:14 }}
                    onClick={compartir} aria-label={`Compartir ${serie.titulo}`} title="Compartir">
              🔗
            </button>
          </div>
          <div className="resenas-cabecera">
            <h3 className="font-display">💬 Reseñas ({reviews.length})</h3>
            {reviews.length > 1 && (
              <div className="resenas-orden" role="group" aria-label="Ordenar reseñas">
                {[
                  { id:"populares", label:"❤️ Populares" },
                  { id:"recientes", label:"🕐 Recientes" },
                  ...(user ? [{ id:"amigos", label:"👥 Seguidos" }] : []),
                ].map(o=>(
                  <button key={o.id} className={`sort-btn${orden===o.id?" active":""}`}
                          aria-pressed={orden===o.id}
                          onClick={()=>setOrden(o.id)}>{o.label}</button>
                ))}
              </div>
            )}
          </div>
          {user?(
            <div className="review-card" style={{ marginBottom:"1rem" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                <Link to={`/u/${user.profile?.username}`} aria-label="Ver mi perfil">
                  <Avatar perfil={user.profile} size={30}/>
                </Link>
                <Link to={`/u/${user.profile?.username}`} className="enlace-usuario">
                  <span style={{ fontWeight:800, fontSize:13, color:"var(--text)" }}>{user.profile?.display_name||user.profile?.username}</span>
                </Link>
                <span style={{ fontSize:11, color:"var(--text-faint)" }}>· tu reseña</span>
              </div>
              {editing||!hasMyReview?(
                <>
                  <textarea className="textarea" value={myReview} onChange={e=>setMyReview(e.target.value)} placeholder="¿Qué recuerdas? ¿La veías con alguien especial?" rows={3}/>
                  <div style={{ display:"flex", gap:8, marginTop:8 }}>
                    <button className="btn btn-primary" style={{ flex:1, padding:"8px 0", fontSize:13 }} onClick={saveReview} disabled={guardando}>{guardando?"Publicando…":"Publicar"}</button>
                    {hasMyReview&&<button className="btn btn-ghost" style={{ padding:"8px 14px", fontSize:13 }} onClick={()=>setEditing(false)}>Cancelar</button>}
                  </div>
                </>
              ):(
                <>
                  <p style={{ fontSize:14, color:"var(--text-muted)", lineHeight:1.7 }}>{myReview}</p>
                  <div style={{ display:"flex", gap:8, marginTop:10 }}>
                    <button className="btn btn-ghost" style={{ fontSize:12, padding:"5px 12px" }} onClick={()=>setEditing(true)}>Editar</button>
                    <button style={{ fontSize:12, padding:"5px 12px", borderRadius:8, background:"#FFE8E8", color:"#900", border:"1.5px solid #C00", cursor:"pointer", fontFamily:"inherit", fontWeight:700 }} onClick={deleteReview} disabled={guardando}>Eliminar</button>
                  </div>
                </>
              )}
            </div>
          ):(
            <div style={{ background:"var(--bg-muted)", borderRadius:"var(--radius)", padding:"1rem", marginBottom:"1rem", textAlign:"center" }}>
              <p style={{ fontSize:14, color:"var(--text-muted)", marginBottom:10 }}>Inicia sesión para dejar tu reseña</p>
              <button className="btn btn-primary" style={{ fontSize:13, padding:"8px 18px" }} onClick={onShowAuth}>Iniciar sesión</button>
            </div>
          )}
          {loadingR
            ?Array(2).fill(0).map((_,i)=><div key={i} className="review-card" style={{ marginBottom:10 }}><Skeleton height={80}/></div>)
            :reviews.filter(r=>r.user_id!==user?.id).map(r=>(
              <div key={r.id} className="review-card animate-fadeUp" style={{ marginBottom:10 }}>
                <div className="resena-cabecera">
                  <Link to={`/u/${r.username}`} aria-label={`Ver perfil de ${r.username}`}><Avatar perfil={r} size={30}/></Link>
                  <div style={{ flex:1, minWidth:0 }}>
                    <Link to={`/u/${r.username}`} className="enlace-usuario">
                      <strong className="resena-autor">{r.display_name||r.username}</strong>
                    </Link>
                    <div className="resena-meta">
                      {r.rating != null && (
                        <>
                          <EstrellasNota nota={r.rating / 2} size={13} />
                          <span className="resena-sep" aria-hidden="true">·</span>
                        </>
                      )}
                      <span>{new Date(r.created_at).toLocaleDateString("es-ES",{day:"numeric",month:"short",year:"numeric"})}</span>
                      {r.la_sigo && <span className="chip resena-sigo">Le sigues</span>}
                    </div>
                  </div>
                </div>

                <p className="resena-texto">{r.content}</p>

                <button
                  className={`like-btn${r.me_gusta ? " activo" : ""}`}
                  onClick={()=>alternarLike(r)}
                  disabled={ocupadoLike === r.id}
                  aria-pressed={!!r.me_gusta}
                  aria-label={r.me_gusta
                    ? `Quitar me gusta a la reseña de ${r.display_name||r.username}`
                    : `Me gusta la reseña de ${r.display_name||r.username}`}
                >
                  <svg className="like-icono" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
                    <path d="M12 20.7l-1.45-1.32C5.4 14.74 2 11.65 2 7.87 2 4.78 4.42 2.36 7.5 2.36c1.74 0 3.41.81 4.5 2.09 1.09-1.28 2.76-2.09 4.5-2.09 3.08 0 5.5 2.42 5.5 5.51 0 3.78-3.4 6.87-8.55 11.52L12 20.7z"/>
                  </svg>
                  <span className="like-num">{Number(r.likes) > 0 ? r.likes : "Me gusta"}</span>
                </button>
              </div>
            ))
          }
          {!loadingR&&reviews.length===0&&<p style={{ color:"var(--text-faint)", fontSize:14, textAlign:"center", padding:"1rem" }}>Sé el primero en reseñar esta serie</p>}
        </div>

        {mostrarListas && user && (
          <Suspense fallback={null}>
            <AnadirALista user={user} serie={serie} onClose={()=>setMostrarListas(false)} />
          </Suspense>
        )}
      </div>
    </div>
    </Portal>
  );
}

function Feed({ user, onShowAuth, series }) {
  const [ambito, setAmbito]     = useState("todos");   // todos | siguiendo
  const [seguidos, setSeguidos] = useState(null);
  const [busca, setBusca]       = useState("");
  const [hallados, setHallados] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  // A quién sigue el usuario: hace falta para filtrar el feed
  useEffect(()=>{
    if(!user){ setSeguidos([]); return; }
    fetchSeguidos(user.id).then(setSeguidos).catch(()=>setSeguidos([]));
  },[user, recarga]);

  // Búsqueda de usuarios, con retardo para no consultar en cada tecla
  useEffect(()=>{
    if(busca.trim().length < 2){ setHallados([]); return; }
    const t = setTimeout(()=>{ buscarUsuarios(busca).then(setHallados); }, 320);
    return ()=>clearTimeout(t);
  },[busca]);

  const [recarga, setRecarga] = useState(0);
  // Cualquier actividad de la comunidad afecta al feed
  useCambios(
    [CAMBIO.ACTIVIDAD, CAMBIO.RESENA, CAMBIO.SEGUIMIENTO, CAMBIO.PERFIL],
    useCallback(()=>setRecarga(n=>n+1), [])
  );

  useEffect(()=>{
    if(ambito==="siguiendo" && seguidos===null) return;
    (async()=>{
      setLoading(true);

      // Filtrar en el servidor y no en el navegador: si algún día hay
      // miles de usuarios, traérselo todo para descartarlo aquí sería
      // insostenible.
      const filtrar = (q) =>
        ambito==="siguiendo" ? q.in("user_id", seguidos.length ? seguidos : ["00000000-0000-0000-0000-000000000000"]) : q;

      const [{ data:r },{ data:w },{ data:rev }]=await Promise.all([
        filtrar(supabase.from("ratings").select("*,profiles(username,display_name,avatar_emoji,avatar_color)")).order("created_at",{ascending:false}).limit(40),
        filtrar(supabase.from("watched").select("*,profiles(username,display_name,avatar_emoji,avatar_color)")).order("watched_at",{ascending:false}).limit(40),
        filtrar(supabase.from("reviews").select("*,profiles(username,display_name,avatar_emoji,avatar_color)")).order("created_at",{ascending:false}).limit(40),
      ]);
      const all=[
        ...(r||[]).map(x=>({type:"rating",date:x.created_at,...x})),
        ...(w||[]).map(x=>({type:"watch",date:x.watched_at,...x})),
        ...(rev||[]).map(x=>({type:"review",date:x.created_at,...x})),
      ].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,50);
      setItems(all); setLoading(false);
    })();
  },[ambito, seguidos, recarga]);
  const getSerie=id=>series.find(s=>s.id===id);
  if(!user) return (
    <div style={{ textAlign:"center", padding:"5rem 2rem" }} className="animate-fadeUp">
      <div style={{ fontSize:72, marginBottom:16 }}>🌐</div>
      <p className="font-display" style={{ fontSize:26, color:"var(--accent)", marginBottom:12 }}>El feed de la comunidad</p>
      <p style={{ color:"var(--text-muted)", fontSize:15, maxWidth:380, margin:"0 auto 1.5rem" }}>Regístrate para ver lo que está viendo y puntuando la comunidad</p>
      <button className="btn btn-primary" style={{ fontSize:15, padding:"12px 28px" }} onClick={onShowAuth}>Unirme a la comunidad</button>
    </div>
  );
  return (
    <div className="page-enter">
      <h2 className="font-display" style={{ fontSize:34, color:"var(--accent)", marginBottom:"1rem" }}>🌐 Comunidad</h2>

      {/* Buscar gente a la que seguir */}
      <div style={{ position:"relative", marginBottom:"1rem" }}>
        <input className="input" type="search" value={busca}
               onChange={e=>setBusca(e.target.value)}
               aria-label="Buscar usuarios por nombre"
               placeholder="🔍  Buscar usuarios…" />
        {hallados.length > 0 && (
          <div className="buscador-resultados">
            {hallados.map(u=>(
              <Link key={u.id} to={`/u/${u.username}`} className="resultado-usuario"
                    onClick={()=>{ setBusca(""); setHallados([]); }}>
                <Avatar perfil={u} size={32}/>
                <div style={{ flex:1, minWidth:0 }}>
                  <strong>{u.display_name || u.username}</strong>
                  <span>@{u.username} · {u.vistas} vistas</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Ámbito del feed */}
      <div className="sort-bar" role="group" aria-label="Ámbito del feed">
        {[
          { id:"todos",     label:"🌍 Todos" },
          { id:"siguiendo", label:`👥 Siguiendo${seguidos?.length ? ` (${seguidos.length})` : ""}` },
        ].map(t=>(
          <button key={t.id} className={`sort-btn${ambito===t.id?" active":""}`}
                  aria-pressed={ambito===t.id}
                  onClick={()=>setAmbito(t.id)}>{t.label}</button>
        ))}
      </div>
      {loading
        ?Array(5).fill(0).map((_,i)=><div key={i} className="feed-item animate-fadeUp" style={{ marginBottom:12, animationDelay:`${i*60}ms` }}><Skeleton width={38} height={38} style={{ borderRadius:"50%" }}/><div style={{ flex:1 }}><Skeleton height={14} width="70%" style={{ marginBottom:6 }}/><Skeleton height={11} width="40%"/></div></div>)
        :items.length===0
          ?<p style={{ color:"var(--text-muted)" }}>Aún no hay actividad. ¡Sé el primero en puntuar una serie!</p>
          :items.map((item,i)=>{
            const serie=getSerie(item.serie_id); if(!serie) return null;
            const name=item.profiles?.display_name||item.profiles?.username||"Alguien";
            return (
              <div key={i} className="feed-item animate-fadeUp" style={{ marginBottom:10, animationDelay:`${Math.min(i*40,300)}ms` }}>
                <Link to={`/u/${item.profiles?.username}`} aria-label={`Ver perfil de ${name}`}>
                  <Avatar perfil={item.profiles} size={38}/>
                </Link>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, color:"var(--text)", lineHeight:1.6 }}>
                    <Link to={`/u/${item.profiles?.username}`} className="enlace-usuario"><strong>{name}</strong></Link>{" "}
                    {item.type==="rating"&&<>ha puntuado <Link to={`/serie/${slugify(serie.titulo)}`} className="enlace-usuario"><strong>{serie.titulo}</strong></Link> con <EstrellasNota nota={item.rating / 2} size={13} /></>}
                    {item.type==="watch"&&<>ha marcado <Link to={`/serie/${slugify(serie.titulo)}`} className="enlace-usuario"><strong>{serie.titulo}</strong></Link> como vista ✅</>}
                    {item.type==="review"&&<>ha reseñado <Link to={`/serie/${slugify(serie.titulo)}`} className="enlace-usuario"><strong>{serie.titulo}</strong></Link>: <em style={{ color:"var(--text-muted)" }}>"{item.content?.slice(0,90)}{item.content?.length>90?"…":""}"</em></>}
                  </div>
                  <div style={{ fontSize:11, color:"var(--text-faint)", marginTop:3 }}>
                    {new Date(item.date).toLocaleDateString("es-ES",{day:"numeric",month:"short"})}
                    {" · "}<span style={{ background:serie.color, color:"#fff", padding:"1px 8px", borderRadius:8, fontSize:10, fontWeight:700 }}>{serie.decada}</span>
                  </div>
                </div>
              </div>
            );
          })
      }
    </div>
  );
}

// La página de perfil propio y la pública eran dos vistas distintas del
// mismo usuario, con contenido diferente. Ahora hay una sola: /perfil
// redirige a /u/tu-usuario, que muestra los apartados privados cuando
// eres tú quien la visita.
function MiPerfil({ user, onShowAuth }) {
  if (!user) return (
    <div className="empty-state page-enter">
      <div style={{ fontSize:72, marginBottom:16 }}>👤</div>
      <p className="font-display" style={{ fontSize:26, color:"var(--accent)", marginBottom:12 }}>
        Tu perfil te espera
      </p>
      <p style={{ color:"var(--text-muted)", fontSize:15, maxWidth:380, margin:"0 auto 1.5rem", fontWeight:700 }}>
        Guarda tu historial en la nube y accede desde cualquier dispositivo
      </p>
      <button className="btn btn-primary" style={{ fontSize:15, padding:"12px 28px" }} onClick={onShowAuth}>
        Iniciar sesión
      </button>
    </div>
  );

  // El perfil puede tardar un instante en llegar tras iniciar sesión
  if (!user.profile?.username) return <div className="skeleton" style={{ height:200 }} />;

  return <Navigate to={`/u/${user.profile.username}`} replace />;
}

function NoEncontrado() {
  useEffect(()=>{ document.title = "Página no encontrada — AnimaFilm"; },[]);
  return (
    <div className="empty-state page-enter">
      <div style={{ fontSize:76, marginBottom:4 }}>📺</div>
      <p className="font-display" style={{ fontSize:56, color:"var(--accent)", lineHeight:1 }}>404</p>
      <p className="font-display" style={{ fontSize:24, color:"var(--text)", marginBottom:10 }}>
        Aquí no hay nada
      </p>
      <p style={{ color:"var(--text-muted)", fontSize:15, fontWeight:700, maxWidth:360, margin:"0 auto 1.5rem" }}>
        Esta página no existe, como aquel episodio que jurabas haber visto y nadie más recuerda.
      </p>
      <Link className="btn btn-primary" style={{ fontSize:15, padding:"11px 26px" }} to="/">
        Volver al catálogo
      </Link>
    </div>
  );
}

export default function App() {
  const { theme, toggleTheme } = useThemeToggle();
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [series, setSeries]         = useState([]);
  const [stats, setStats]           = useState({});
  const [loadError, setLoadError]   = useState(null);
  // ── FILTROS EN LA URL ────────────────────────────────────────────────
  // Los filtros viven en la barra de direcciones, no en el estado. Así
  // un catálogo filtrado es un enlace que se puede compartir o guardar
  // en marcadores, y el botón atrás deshace el último filtro.
  const [params, setParams] = useSearchParams();

  const decada     = params.get("decada") || "Todas";
  const genero     = params.get("genero") || "Todos";
  const orden      = params.get("orden")  || "año";
  const ascendente = params.get("dir") !== "desc";
  const busqueda   = params.get("q") || "";

  // Escribe solo los parámetros que se apartan del valor por defecto:
  // así la URL limpia es "/" y no "/?decada=Todas&genero=Todos&…"
  const aplicarFiltro = useCallback((cambios, reemplazar = false) => {
    setParams(prev => {
      const p = new URLSearchParams(prev);
      Object.entries(cambios).forEach(([k, v]) => {
        const esDefecto =
          (k === "decada" && v === "Todas") ||
          (k === "genero" && v === "Todos") ||
          (k === "orden"  && v === "año")   ||
          (k === "dir"    && v === "asc")   ||
          (k === "q"      && !v);
        if (esDefecto || v == null || v === "") p.delete(k);
        else p.set(k, v);
      });
      return p;
    }, { replace: reemplazar });
  }, [setParams]);

  const setDecada = useCallback(v => aplicarFiltro({ decada: v }), [aplicarFiltro]);
  const setGenero = useCallback(v => aplicarFiltro({ genero: v }), [aplicarFiltro]);

  // El texto de búsqueda se escribe en la URL con retardo y con replace:
  // si no, cada letra dejaría una entrada en el historial.
  const [textoBusqueda, setTextoBusqueda] = useState(busqueda);
  useEffect(() => {
    if (textoBusqueda === busqueda) return;
    const t = setTimeout(() => aplicarFiltro({ q: textoBusqueda }, true), 280);
    return () => clearTimeout(t);
  }, [textoBusqueda, busqueda, aplicarFiltro]);

  const limpiarFiltros = useCallback(() => {
    setTextoBusqueda("");
    setParams(new URLSearchParams(), { replace: true });
  }, [setParams]);
  const [vistas, setVistas] = useState({});
  const [pendientes, setPendientes] = useState({});
  const [ratings, setRatings] = useState({});
  const [catalogLoaded, setCatalogLoaded] = useState(false);

  const pedirLogin = useCallback(()=>{ setAuthMode("login"); setShowAuth(true); }, []);

  const navigate    = useNavigate();
  const location    = useLocation();
  const matchSerie  = useMatch("/serie/:slug");
  const slugActivo  = matchSerie?.params?.slug ?? null;

  // La serie abierta se deduce de la URL, no de un estado aparte.
  // Así el botón atrás del navegador y compartir enlaces funcionan solos.
  const serieActiva = useMemo(
    () => findBySlug(series, slugActivo),
    [series, slugActivo]
  );

  const filtrarPorGenero = useCallback((g) => {
    navigate(`/?genero=${encodeURIComponent(g)}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [navigate]);

  const cerrarSerie = useCallback(() => {
    // Si llegamos desde dentro de la app, volvemos atrás para no romper
    // el historial. Si el usuario entró directo por el enlace, al catálogo.
    if (location.key !== "default") navigate(-1);
    else navigate("/", { replace: true });
  }, [navigate, location.key]);

  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>setSession(session));
    const {data:{subscription}}=supabase.auth.onAuthStateChange((evento, s)=>{
      setSession(s);
      // El usuario vuelve desde el enlace de "recuperar contraseña"
      if (evento === "PASSWORD_RECOVERY") { setAuthMode("update"); setShowAuth(true); }
    });
    return ()=>subscription.unsubscribe();
  },[]);

  const refreshProfile = useCallback(()=>{
    if(!session) return;
    supabase.from("profiles").select("*").eq("id",session.user.id).single()
      .then(({data})=>setProfile(data));
  },[session]);

  useEffect(()=>{ refreshProfile(); },[refreshProfile]);

  useEffect(()=>{
    if(!session) return;
    const uid=session.user.id;
    Promise.all([
      supabase.from("watched").select("serie_id").eq("user_id",uid),
      supabase.from("watchlist").select("serie_id").eq("user_id",uid),
      supabase.from("ratings").select("serie_id,rating").eq("user_id",uid),
    ]).then(([w,wl,r])=>{
      const v={}; (w.data||[]).forEach(x=>v[x.serie_id]=true);
      const p={}; (wl.data||[]).forEach(x=>p[x.serie_id]=true);
      const rt={}; (r.data||[]).forEach(x=>rt[x.serie_id]=x.rating);
      setVistas(v); setPendientes(p); setRatings(rt);
    });
  },[session]);

  useEffect(()=>{
    // Una única consulta a Supabase en lugar de 30 peticiones a TMDB
    fetchSeries()
      .then(list => {
        setSeries(list);
        setCatalogLoaded(true);
        // Las estadísticas van después: no deben retrasar el catálogo
        fetchSeriesStats().then(setStats);
      })
      .catch(err => {
        setLoadError("No hemos podido cargar el catálogo. Revisa tu conexión.");
        setCatalogLoaded(true);
        console.error("[series]", err);
      });
    setTimeout(()=>setCatalogLoaded(true), 1500); // red de seguridad
  },[]);

  // Sin useMemo este objeto se recreaba en cada render, y los efectos
  // que dependen de `user` volvían a consultar sin motivo.
  const user = useMemo(
    () => session ? { ...session.user, profile } : null,
    [session, profile]
  );

  // ── ESCRITURAS OPTIMISTAS CON REVERSIÓN ──────────────────────────────
  // El patrón: aplicamos el cambio en pantalla al instante (la interfaz
  // responde sin esperar a la red), lanzamos la petición, y si falla
  // devolvemos el estado a como estaba y avisamos.
  //
  // Antes se aplicaba el cambio pasara lo que pasara: si Supabase fallaba,
  // la estrella se quedaba marcada y el usuario creía haber guardado algo
  // que no existía. Eso es peor que no guardar: es mentir.

  const toggleVista=useCallback(async(id)=>{
    if(!session){ pedirLogin(); return; }
    const uid=session.user.id;
    const eraVista     = !!vistas[id];
    const eraPendiente = !!pendientes[id];

    setVistas(p=>({...p,[id]:!eraVista}));
    if(!eraVista && eraPendiente) setPendientes(p=>({...p,[id]:false}));

    const { error } = eraVista
      ? await supabase.from("watched").delete().eq("user_id",uid).eq("serie_id",id)
      : await supabase.from("watched").insert({user_id:uid,serie_id:id});

    if(error){
      setVistas(p=>({...p,[id]:eraVista}));
      setPendientes(p=>({...p,[id]:eraPendiente}));
      toast.error(mensajeDeError(error));
      return;
    }

    // Marcar como vista saca la serie de pendientes. Si esto falla no
    // revertimos: lo importante (la marca de vista) ya se guardó.
    if(!eraVista && eraPendiente){
      await supabase.from("watchlist").delete().eq("user_id",uid).eq("serie_id",id);
    }

    avisar(CAMBIO.ACTIVIDAD, { serie: id });
  },[session,vistas,pendientes,pedirLogin]);

  const togglePendiente=useCallback(async(id)=>{
    if(!session){ pedirLogin(); return; }
    const uid=session.user.id;
    const antes = !!pendientes[id];

    setPendientes(p=>({...p,[id]:!antes}));

    const { error } = antes
      ? await supabase.from("watchlist").delete().eq("user_id",uid).eq("serie_id",id)
      : await supabase.from("watchlist").insert({user_id:uid,serie_id:id});

    if(error){
      setPendientes(p=>({...p,[id]:antes}));
      toast.error(mensajeDeError(error));
      return;
    }
    avisar(CAMBIO.ACTIVIDAD, { serie: id });
  },[session,pendientes,pedirLogin]);

  const setRating=useCallback(async(id,r)=>{
    if(!session){ pedirLogin(); return; }
    const uid=session.user.id;
    const antes = ratings[id] ?? 0;

    setRatings(prev=>({...prev,[id]:r}));

    const { error } = r===0
      ? await supabase.from("ratings").delete().eq("user_id",uid).eq("serie_id",id)
      : await supabase.from("ratings").upsert({user_id:uid,serie_id:id,rating:r},{onConflict:"user_id,serie_id"});

    if(error){
      setRatings(prev=>({...prev,[id]:antes}));
      toast.error(mensajeDeError(error));
      return;
    }

    // La nota de la comunidad ha cambiado: la refrescamos sin bloquear
    fetchSeriesStats().then(setStats).catch(()=>{});
    avisar(CAMBIO.ACTIVIDAD, { serie: id });
  },[session,ratings,pedirLogin]);

  // Los géneros salen del propio catálogo: si añades una serie con un
  // género nuevo, aparece solo en el filtro.
  const GENEROS = useMemo(()=>{
    const set = new Set();
    series.forEach(s => s.generos.forEach(g => set.add(g)));
    return ["Todos", ...[...set].sort((a,b)=>a.localeCompare(b,"es"))];
  },[series]);

  const seriesFiltradas=useMemo(()=>{
    const q = busqueda.trim().toLowerCase();
    const lista = series.filter(s =>
      (decada==="Todas" || s.decada===decada) &&
      (genero==="Todos" || s.generos.includes(genero)) &&
      (q === "" || s.titulo.toLowerCase().includes(q) ||
                   (s.englishTitle||"").toLowerCase().includes(q) ||
                   (s.cadena||"").toLowerCase().includes(q) ||
                   s.generos.some(g=>g.toLowerCase().includes(q)))
    );

    // Las series sin datos de comunidad se quedan al final,
    // independientemente de la dirección del orden.
    const sinDato = (v) => v === null || v === undefined;
    const dir = ascendente ? 1 : -1;

    return [...lista].sort((a,b)=>{
      if (orden === "titulo") return a.titulo.localeCompare(b.titulo,"es") * dir;
      if (orden === "año")    return (a.año - b.año) * dir;

      const campo = orden === "nota" ? "nota_media" : "vistas_totales";
      const va = stats[a.id]?.[campo];
      const vb = stats[b.id]?.[campo];
      if (sinDato(va) && sinDato(vb)) return a.titulo.localeCompare(b.titulo,"es");
      if (sinDato(va)) return 1;
      if (sinDato(vb)) return -1;
      if (Number(va) === Number(vb)) return a.titulo.localeCompare(b.titulo,"es");
      return (Number(va) - Number(vb)) * dir;
    });
  },[series,decada,genero,busqueda,orden,ascendente,stats]);

  // Título del documento según la ruta: mejora el historial del
  // navegador, los marcadores y cómo se ve al compartir.
  useEffect(()=>{
    const base = "AnimaFilm — Series de tu infancia";
    if (serieActiva)                     document.title = `${serieActiva.titulo} (${serieActiva.año}) — AnimaFilm`;
    else if (location.pathname === "/comunidad") document.title = "Comunidad — AnimaFilm";
    else if (location.pathname === "/perfil")    document.title = "Mi perfil — AnimaFilm";
    else if (location.pathname === "/")          document.title = base;
  },[serieActiva, location.pathname]);

  const totalVistas=Object.values(vistas).filter(Boolean).length;
  const totalPendientes=Object.values(pendientes).filter(Boolean).length;

  const NAV=[
    {to:"/",             label:"📽️ Catálogo",  icono:"📽️", corto:"Catálogo",  end:true},
    {to:"/comunidad",    label:"🌐 Comunidad", icono:"🌐", corto:"Comunidad"},
    {to:"/estadisticas", label:"📊 Datos",     icono:"📊", corto:"Datos"},
    {to:"/perfil",       label:`⭐ Mi Perfil${totalVistas>0?` (${totalVistas})`:""}`, icono:"⭐", corto:"Perfil"},
  ];

  const catalogo = (
    <div className="page-enter">
            <div style={{ textAlign:"center", marginBottom:"2rem" }}>
              <h1 className="hero-title animate-fadeUp">Las series de tu infancia</h1>
              <p className="animate-fadeUp delay-1" style={{ color:"var(--text-muted)", fontSize:16, marginTop:8, maxWidth:480, margin:"8px auto 0" }}>Puntúa, reseña y recuerda las series que marcaron toda una generación</p>
            </div>
            <div style={{ display:"flex", gap:12, marginBottom:"1.2rem", flexWrap:"wrap", alignItems:"center" }} className="animate-fadeUp delay-2">
              <input className="input" type="search" aria-label="Buscar serie por título, cadena o género" placeholder="🔍  Buscar serie…" value={textoBusqueda} onChange={e=>setTextoBusqueda(e.target.value)} style={{ flex:1, minWidth:180 }}/>
              <div role="group" aria-label="Filtrar por década" className="filtros-decadas" style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {DECADAS.map(d=>(
                  <button key={d} className={d===decada?"btn btn-primary":"btn btn-secondary"} aria-pressed={d===decada} style={{ padding:"8px 16px", fontSize:13, borderRadius:24 }} onClick={()=>setDecada(d)}>{d}</button>
                ))}
              </div>
            </div>

            {/* Aviso de filtros activos */}
            {(decada!=="Todas" || genero!=="Todos" || busqueda) && (
              <div className="filtros-activos animate-fadeIn">
                <span>Filtrando por:</span>
                {busqueda && <span className="chip">"{busqueda}"</span>}
                {decada!=="Todas" && <span className="chip">{decada}</span>}
                {genero!=="Todos" && <span className="chip">{genero}</span>}
                <button className="btn btn-ghost" style={{ fontSize:11, padding:"3px 10px" }}
                        onClick={limpiarFiltros}>✕ Limpiar</button>
              </div>
            )}

            {/* Géneros */}
            {GENEROS.length > 1 && (
              <div className="genre-bar animate-fadeUp delay-2" role="group" aria-label="Filtrar por género">
                <span className="sort-label">Género</span>
                {GENEROS.map(g=>(
                  <button key={g}
                          className={`genre-pill${genero===g?" active":""}`}
                          aria-pressed={genero===g}
                          onClick={()=>setGenero(g)}>{g}</button>
                ))}
              </div>
            )}

            {/* Ordenación */}
            <div className="sort-bar animate-fadeUp delay-2" role="group" aria-label="Ordenar catálogo">
              <span className="sort-label">Ordenar por</span>
              {ORDENES.map(o=>(
                <button
                  key={o.id}
                  className={`sort-btn${orden===o.id?" active":""}`}
                  aria-pressed={orden===o.id}
                  onClick={()=>{
                    if (orden===o.id) {
                      aplicarFiltro({ orden:o.id, dir: ascendente ? "desc" : "asc" });
                    } else {
                      // Al cambiar de criterio, la dirección más útil por
                      // defecto: nota y vistas de mayor a menor, el resto al revés.
                      const desc = o.id==="nota" || o.id==="vistas";
                      aplicarFiltro({ orden:o.id, dir: desc ? "desc" : "asc" });
                    }
                  }}
                  title={orden===o.id ? "Pulsa para invertir el orden" : `Ordenar por ${o.label.toLowerCase()}`}
                >
                  <span>{o.icon}</span> {o.label}
                  {orden===o.id && <em>{ascendente ? "↑" : "↓"}</em>}
                </button>
              ))}
            </div>
            <div aria-live="polite" style={{ display:"flex", gap:10, marginBottom:"1.5rem", flexWrap:"wrap" }} className="animate-fadeUp delay-3">
              {[{icon:"🎬",value:seriesFiltradas.length,label:"en catálogo"},{icon:"✅",value:totalVistas,label:"vistas"},{icon:"🕐",value:totalPendientes,label:"pendientes"}].map(s=>(
                <div key={s.label} className="mini-stat"><span style={{ fontSize:16 }}>{s.icon}</span><span style={{ fontWeight:900, fontSize:16, color:"var(--accent)" }}>{s.value}</span><span style={{ fontSize:12, color:"var(--text-muted)", fontWeight:600 }}>{s.label}</span></div>
              ))}
            </div>
            {loadError && (
              <div className="load-error" role="alert">
                <span style={{ fontSize:34 }}>📡</span>
                <div>
                  <strong>{loadError}</strong>
                  <button className="btn btn-secondary" style={{ marginTop:10, fontSize:13 }}
                          onClick={()=>window.location.reload()}>Reintentar</button>
                </div>
              </div>
            )}

            {/* Encabezado de sección: la rejilla pasaba de h1 a h3.
                Va oculto visualmente, pero ordena el documento. */}
            <h2 className="sr-only">Catálogo de series</h2>

            {!catalogLoaded
              ?<div className="series-grid" aria-hidden="true">{Array(12).fill(0).map((_,i)=><CardSkeleton key={i}/>)}</div>
              :seriesFiltradas.length>0
                ?<div className="series-grid">
                  {seriesFiltradas.map((serie,i)=>(
                    <SerieCard key={serie.id} serie={serie} poster={serie.poster} stats={stats[serie.id]}
                      vista={!!vistas[serie.id]} pendiente={!!pendientes[serie.id]} rating={ratings[serie.id]||0}
                      animDelay={Math.min(i*30,400)}
                      prioritaria={i < 6}
                      filtros={location.search}
                      onToggleVista={()=>toggleVista(serie.id)}
                      onTogglePendiente={()=>togglePendiente(serie.id)}
                      onRate={r=>setRating(serie.id,r)}
                    />
                  ))}
                </div>
                :<div style={{ textAlign:"center", padding:"4rem", color:"var(--text-muted)" }}>
                  <div style={{ fontSize:52, marginBottom:12 }}>🔍</div>
                  <p className="font-display" style={{ fontSize:22, color:"var(--accent)" }}>No encontramos ninguna serie</p>
                </div>
            }
    </div>
  );

  return (
    <>
      {/* Primer elemento tabulable: permite saltarse la navegación */}
      <a href="#contenido" className="skip-link">Saltar al contenido</a>

      <header className="site-header">
        <div className="header-inner">
          <Link
            to="/"
            className="brand"
            onClick={()=>{ limpiarFiltros(); window.scrollTo({ top:0, behavior:"smooth" }); }}
            title="Volver al catálogo"
          >
            <span className="brand-icono">📺</span>
            <span className="font-display brand-texto">AnimaFilm</span>
          </Link>

          {/* Navegación de escritorio. En móvil se traslada abajo, al
              alcance del pulgar, que es donde se espera encontrarla. */}
          <nav aria-label="Navegación principal" className="nav-escritorio">
            {NAV.map(v=>(
              <NavLink key={v.to} to={v.to} end={v.end}
                className={({isActive})=>`nav-pill${isActive?" active":""}`}>
                {v.label}
              </NavLink>
            ))}
          </nav>

          <div className="header-acciones">
            <button className={`theme-toggle ${theme}`} onClick={toggleTheme}
                    role="switch" aria-checked={theme==="dark"}
                    aria-label={theme==="dark"?"Cambiar a modo claro":"Cambiar a modo oscuro"}
                    title="Cambiar tema">
              <div className="knob" aria-hidden="true">{theme==="dark"?"🌙":"☀️"}</div>
            </button>
            {session
              ?<button className="btn btn-ghost btn-sesion" onClick={()=>supabase.auth.signOut()}>Salir</button>
              :<button className="btn btn-sesion btn-entrar" onClick={()=>{ setAuthMode("login"); setShowAuth(true); }}>Entrar</button>
            }
          </div>
        </div>
      </header>

      {/* Barra inferior: solo en móvil */}
      <nav aria-label="Navegación principal" className="nav-movil">
        {NAV.map(v=>(
          <NavLink key={v.to} to={v.to} end={v.end}
            className={({isActive})=>`nav-movil-item${isActive?" active":""}`}>
            <span className="nav-movil-icono" aria-hidden="true">{v.icono}</span>
            <span className="nav-movil-texto">{v.corto}</span>
          </NavLink>
        ))}
      </nav>

      <main id="contenido" className="contenido">
        <ErrorBoundary>
        <Suspense fallback={<div className="skeleton" style={{ height:240 }}/>}>
        <Routes>
          <Route path="/"             element={catalogo} />
          <Route path="/serie/:slug"  element={catalogo} />
          <Route path="/comunidad"    element={<Feed user={user} series={series} onShowAuth={pedirLogin}/>} />
          <Route path="/perfil"       element={<MiPerfil user={user} onShowAuth={pedirLogin}/>} />
          <Route path="/u/:username"  element={<PerfilPublico user={user} series={series} onShowAuth={pedirLogin} onProfileUpdate={refreshProfile}/>} />
          <Route path="/lista/:id"    element={<DetalleLista user={user} series={series}/>} />
          <Route path="/estadisticas" element={<Estadisticas/>} />
          <Route path="*"             element={<NoEncontrado/>} />
        </Routes>
        </Suspense>
        </ErrorBoundary>
      </main>

      {slugActivo && catalogLoaded && !serieActiva && (
        <Portal>
        <div className="overlay" onClick={cerrarSerie}>
          <div className="modal" style={{ maxWidth:380, padding:"2.2rem 2rem", textAlign:"center" }} onClick={e=>e.stopPropagation()}>
            <div style={{ fontSize:56, marginBottom:10 }}>🔍</div>
            <p className="font-display" style={{ fontSize:24, color:"var(--accent)", marginBottom:8 }}>Serie no encontrada</p>
            <p style={{ color:"var(--text-muted)", fontSize:14, fontWeight:700, marginBottom:"1.4rem" }}>
              No tenemos ninguna serie con esa dirección.
            </p>
            <button className="btn btn-primary" style={{ width:"100%", padding:"11px 0", fontSize:15 }} onClick={cerrarSerie}>
              Ver el catálogo
            </button>
          </div>
        </div>
        </Portal>
      )}

      {serieActiva&&(
        <SerieModal serie={serieActiva} poster={serieActiva.poster} stats={stats[serieActiva.id]}
          vista={!!vistas[serieActiva.id]} pendiente={!!pendientes[serieActiva.id]} rating={ratings[serieActiva.id]||0}
          user={user}
          onClose={cerrarSerie}
          onToggleVista={()=>toggleVista(serieActiva.id)}
          onTogglePendiente={()=>togglePendiente(serieActiva.id)}
          onRate={r=>setRating(serieActiva.id,r)}
          onShowAuth={()=>{ cerrarSerie(); pedirLogin(); }}
          onFiltrarGenero={filtrarPorGenero}
        />
      )}
      <Toasts />

      <Suspense fallback={null}>
        {showAuth&&<Auth initialMode={authMode} onClose={()=>{ setShowAuth(false); setAuthMode("login"); }}/>}
      </Suspense>
    </>
  );
}
