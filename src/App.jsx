// src/App.jsx — AnimaFilm v3 (diseño mejorado)
import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "./lib/supabase";
import { fetchAllPosters } from "./lib/tmdb";
import { useThemeToggle } from "./lib/useThemeToggle.js";
import Auth from "./components/Auth.jsx";

const SERIES = [
  { id:1,  titulo:"Heidi",                     englishTitle:"Heidi",                año:1974, decada:"70s", cadena:"TVE 1",          episodios:52,   generos:["Drama","Aventura"],           descripcion:"Niña huérfana que vive en los Alpes suizos con su abuelo. Una de las series más queridas de la infancia española.", color:"#C47A3A" },
  { id:2,  titulo:"Marco",                      englishTitle:"3000 Leagues",          año:1976, decada:"70s", cadena:"TVE 1",          episodios:52,   generos:["Drama","Aventura"],           descripcion:"Un niño genovés viaja desde Italia hasta Argentina en busca de su madre emigrante.", color:"#4A7E5A" },
  { id:3,  titulo:"Érase una vez el hombre",   englishTitle:"Once Upon a Time Man",  año:1978, decada:"70s", cadena:"TVE 1",          episodios:26,   generos:["Educativo","Historia"],       descripcion:"Serie educativa que narra la historia de la humanidad desde la prehistoria hasta el siglo XX.", color:"#4A6E9A" },
  { id:4,  titulo:"Don Quijote de la Mancha",  englishTitle:"Don Quixote",           año:1979, decada:"70s", cadena:"TVE 1",          episodios:39,   generos:["Aventura","Comedia"],         descripcion:"Adaptación animada de la obra maestra de Cervantes. Producción íntegramente española.", color:"#8A5E30" },
  { id:5,  titulo:"La abeja Maya",             englishTitle:"Maya the Bee",          año:1975, decada:"70s", cadena:"TVE 1",          episodios:104,  generos:["Infantil","Aventura"],        descripcion:"Las aventuras de Maya, una pequeña abeja curiosa que explora el mundo de los insectos.", color:"#C8A820" },
  { id:6,  titulo:"Mazinger Z",                englishTitle:"Mazinger Z",            año:1978, decada:"70s", cadena:"TVE 1",          episodios:92,   generos:["Acción","Mecha"],             descripcion:"El robot gigante pilotado por Koji Kabuto lucha contra el infame Doctor Infierno.", color:"#2A5E8A" },
  { id:7,  titulo:"Vicky el vikingo",          englishTitle:"Vicky the Viking",      año:1974, decada:"70s", cadena:"TVE 1",          episodios:78,   generos:["Aventura","Comedia"],         descripcion:"El pequeño Vicky usa su ingenio en lugar de la fuerza para resolver problemas.", color:"#B85A40" },
  { id:8,  titulo:"Los Pitufos",               englishTitle:"The Smurfs",            año:1981, decada:"80s", cadena:"TVE 1",          episodios:256,  generos:["Infantil","Fantasía"],        descripcion:"Los pequeños seres azules del bosque, siempre perseguidos por el malvado Gargamel.", color:"#2A50A0" },
  { id:9,  titulo:"David el gnomo",            englishTitle:"The World of David the Gnome", año:1985, decada:"80s", cadena:"TVE 1", episodios:26,   generos:["Infantil","Fantasía"],        descripcion:"Producción española sobre un médico gnomo que ayuda a los animales del bosque.", color:"#3A8A4A" },
  { id:10, titulo:"Oliver y Benji",            englishTitle:"Captain Tsubasa",       año:1983, decada:"80s", cadena:"TVE 1",          episodios:128,  generos:["Deporte","Drama"],            descripcion:"Las aventuras futbolísticas de Oliver Atom y su mejor amigo Benji.", color:"#1A7040" },
  { id:11, titulo:"Bola de Dragón",            englishTitle:"Dragon Ball",           año:1986, decada:"80s", cadena:"TVE 1",          episodios:153,  generos:["Acción","Aventura"],          descripcion:"Las aventuras del joven Goku en busca de las siete esferas del dragón.", color:"#C07010" },
  { id:12, titulo:"Inspector Gadget",          englishTitle:"Inspector Gadget",      año:1983, decada:"80s", cadena:"La 2",           episodios:86,   generos:["Comedia","Acción"],           descripcion:"El torpe inspector biónico lucha contra MAD, ayudado en secreto por su sobrina Penny.", color:"#6A4A90" },
  { id:13, titulo:"Doraemon",                  englishTitle:"Doraemon",              año:1988, decada:"80s", cadena:"TVE 1",          episodios:1787, generos:["Comedia","Ciencia ficción"],  descripcion:"El gato robot del futuro ayuda al torpe Nobita con sus fantásticos inventos.", color:"#1A70C0" },
  { id:14, titulo:"Thundercats",               englishTitle:"ThunderCats",           año:1985, decada:"80s", cadena:"TVE 1",          episodios:130,  generos:["Acción","Fantasía"],          descripcion:"Los felinos humanoides del planeta Thundera luchan con la Espada del Augurio.", color:"#A04030" },
  { id:15, titulo:"Candy Candy",               englishTitle:"Candy Candy",           año:1982, decada:"80s", cadena:"TVE 1",          episodios:115,  generos:["Romance","Drama"],            descripcion:"Las peripecias de la huerfanita Candy en su búsqueda del amor y la felicidad.", color:"#B84870" },
  { id:16, titulo:"Dragon Ball Z",             englishTitle:"Dragon Ball Z",         año:1990, decada:"90s", cadena:"Telecinco",      episodios:291,  generos:["Acción","Aventura"],          descripcion:"Goku y sus amigos defienden la Tierra contra supervillanos. La infancia de toda una generación.", color:"#C02010" },
  { id:17, titulo:"Sailor Moon",               englishTitle:"Sailor Moon",           año:1993, decada:"90s", cadena:"Telecinco",      episodios:200,  generos:["Acción","Romance"],           descripcion:"Usagi Tsukino protege el amor y la justicia como la guerrera Sailor Moon.", color:"#B03878" },
  { id:18, titulo:"Los Caballeros del Zodiaco",englishTitle:"Saint Seiya",           año:1991, decada:"90s", cadena:"TVE 1",          episodios:114,  generos:["Acción","Aventura"],          descripcion:"Los Caballeros de Atenea luchan para proteger a la diosa y a la humanidad.", color:"#2A4890" },
  { id:19, titulo:"Shin Chan",                 englishTitle:"Crayon Shin-chan",      año:1993, decada:"90s", cadena:"Telecinco",      episodios:1200, generos:["Comedia"],                    descripcion:"Las gamberradas del irreverente niño de cinco años Shinnosuke Nohara.", color:"#C09010" },
  { id:20, titulo:"Pokémon",                   englishTitle:"Pokemon",               año:1998, decada:"90s", cadena:"TVE 1",          episodios:1200, generos:["Aventura","Acción"],          descripcion:"Ash Ketchum y Pikachu viajan para convertirse en Maestros Pokémon.", color:"#C09A00" },
  { id:21, titulo:"Digimon",                   englishTitle:"Digimon",               año:1999, decada:"90s", cadena:"Fox Kids",        episodios:54,   generos:["Aventura","Acción"],          descripcion:"Niños transportados al Mundo Digital donde hacen amistad con criaturas que evolucionan.", color:"#2858A0" },
  { id:22, titulo:"Ranma 1/2",                 englishTitle:"Ranma 1/2",             año:1992, decada:"90s", cadena:"TVE 1",          episodios:161,  generos:["Comedia","Acción"],           descripcion:"Un joven que se transforma en chica al contacto con el agua fría.", color:"#A01818" },
  { id:23, titulo:"Dexter",                    englishTitle:"Dexter's Laboratory",   año:1998, decada:"90s", cadena:"Cartoon Network", episodios:78,  generos:["Comedia","Ciencia ficción"],  descripcion:"Un joven genio con laboratorio secreto que su hermana Dee Dee siempre acaba destrozando.", color:"#6030A0" },
  { id:24, titulo:"Cardcaptor Sakura",          englishTitle:"Cardcaptor Sakura",    año:1999, decada:"90s", cadena:"TVE 1",          episodios:70,   generos:["Fantasía","Romance"],         descripcion:"Sakura debe recuperar las Cartas Clow que liberó accidentalmente.", color:"#A03878" },
  { id:25, titulo:"Bob Esponja",               englishTitle:"SpongeBob SquarePants", año:1999, decada:"00s", cadena:"Nickelodeon",    episodios:400,  generos:["Comedia","Infantil"],         descripcion:"Las aventuras de la esponja más optimista del fondo marino en el colorido Fondo de Bikini.", color:"#A08800" },
  { id:26, titulo:"Naruto",                    englishTitle:"Naruto",                año:2002, decada:"00s", cadena:"Jetix",          episodios:220,  generos:["Acción","Aventura"],          descripcion:"Un joven ninja sueña con convertirse en Hokage y ser reconocido por todos.", color:"#C06010" },
  { id:27, titulo:"Yu-Gi-Oh!",                 englishTitle:"Yu-Gi-Oh!",             año:2001, decada:"00s", cadena:"Cartoon Network", episodios:224, generos:["Acción","Deporte"],           descripcion:"Yugi y el espíritu del Faraón compiten en duelos de cartas mágicas para salvar el mundo.", color:"#6830A0" },
  { id:28, titulo:"Kim Possible",              englishTitle:"Kim Possible",          año:2002, decada:"00s", cadena:"Disney Channel",  episodios:87,   generos:["Acción","Comedia"],           descripcion:"Una adolescente salva el mundo de supervillanos mientras lidia con el instituto.", color:"#2A7040" },
  { id:29, titulo:"Los Lunnis",                englishTitle:"Los Lunnis",            año:2003, decada:"00s", cadena:"La 2",           episodios:1000, generos:["Infantil","Musical"],         descripcion:"Los coloridos muñecos de TVE acompañaban a los más pequeños con canciones y aventuras.", color:"#208070" },
  { id:30, titulo:"Inuyasha",                  englishTitle:"Inuyasha",              año:2002, decada:"00s", cadena:"Jetix",          episodios:167,  generos:["Acción","Romance"],           descripcion:"Una chica moderna viaja al Japón feudal y lucha junto al semidemon Inuyasha.", color:"#903060" },
];

const DECADAS = ["Todas","70s","80s","90s","00s"];

function StarRating({ rating, onRate, size=18, readonly=false }) {
  const [hover, setHover] = useState(0);
  const [lastClicked, setLC] = useState(null);
  return (
    <div style={{ display:"flex", gap:1 }}>
      {[1,2,3,4,5].map(i => (
        <button key={i}
          className={`star-btn${lastClicked===i?" active":""}`}
          onClick={readonly?undefined:(e)=>{ e.stopPropagation(); setLC(i); setTimeout(()=>setLC(null),400); onRate(i===rating?0:i); }}
          onMouseEnter={readonly?undefined:()=>setHover(i)}
          onMouseLeave={readonly?undefined:()=>setHover(0)}
          style={{ fontSize:size, width:size*1.2, height:size*1.2, cursor:readonly?"default":"pointer" }}
          aria-label={`${i} estrella${i>1?"s":""}`}
        ><span className={i<=(hover||rating)?"star-on":"star-off"}>⭐</span></button>
      ))}
    </div>
  );
}

function Avatar({ username, size=36 }) {
  const COLORS=["#7A0000","#1A5A9A","#3A8A4A","#6030A0","#C07010"];
  const bg=COLORS[(username?.charCodeAt(0)||0)%COLORS.length];
  return <div className="avatar" style={{ width:size, height:size, background:bg, fontSize:size*0.42 }}>{(username?.[0]||"?").toUpperCase()}</div>;
}

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

function SerieCard({ serie, poster, vista, pendiente, rating, onCardClick, onToggleVista, onTogglePendiente, onRate, animDelay=0 }) {
  return (
    <div className={`card animate-fadeUp${vista?" watched":""}`} style={{ cursor:"pointer", animationDelay:`${animDelay}ms` }} onClick={onCardClick}>
      <div className="card-poster" style={{ background:serie.color }}>
        {poster
          ? <img src={poster} alt={serie.titulo} loading="lazy" />
          : <div className="card-poster-fallback">
              <span className="font-display">{serie.titulo}</span>
            </div>
        }
        {vista && <div className="status-badge status-vista">✓</div>}
        {pendiente&&!vista && <div className="status-badge status-pendiente">🕐</div>}
        <span className="poster-badge">{serie.decada} · {serie.año}</span>
      </div>
      <div className="card-body">
        <div className="card-title truncate">{serie.titulo}</div>
        <div style={{ fontSize:11, color:"var(--text-muted)", marginBottom:8 }}>{serie.cadena} · {serie.episodios} ep.</div>
        <div style={{ marginBottom:9 }}><StarRating rating={rating} onRate={onRate} size={15} /></div>
        <div style={{ display:"flex", gap:6 }}>
          <button className={vista?"btn btn-primary":"btn btn-secondary"} style={{ flex:1, padding:"5px 0", fontSize:11, borderRadius:8 }} onClick={e=>{ e.stopPropagation(); onToggleVista(); }}>{vista?"✓ Vista":"Marcar vista"}</button>
          <button className={pendiente?"btn btn-warning":"btn btn-ghost"} style={{ padding:"5px 10px", fontSize:13, borderRadius:8 }} onClick={e=>{ e.stopPropagation(); onTogglePendiente(); }}>🕐</button>
        </div>
      </div>
    </div>
  );
}

function SerieModal({ serie, poster, vista, pendiente, rating, user, onClose, onToggleVista, onTogglePendiente, onRate, onShowAuth }) {
  const [reviews, setReviews] = useState([]);
  const [myReview, setMyReview] = useState("");
  const [editing, setEditing] = useState(false);
  const [loadingR, setLoadingR] = useState(true);

  useEffect(() => {
    const h=(e)=>{ if(e.key==="Escape") onClose(); };
    window.addEventListener("keydown",h);
    return ()=>window.removeEventListener("keydown",h);
  },[onClose]);

  useEffect(()=>{
    (async()=>{
      setLoadingR(true);
      const {data}=await supabase.from("reviews").select("*,profiles(username,display_name)").eq("serie_id",serie.id).order("created_at",{ascending:false});
      setReviews(data||[]);
      if(user) setMyReview((data||[]).find(r=>r.user_id===user.id)?.content||"");
      setLoadingR(false);
    })();
  },[serie.id,user]);

  const hasMyReview=reviews.some(r=>r.user_id===user?.id);

  async function saveReview(){
    if(!myReview.trim()||!user) return;
    await supabase.from("reviews").upsert({user_id:user.id,serie_id:serie.id,content:myReview.trim()},{onConflict:"user_id,serie_id"});
    setEditing(false);
    const {data}=await supabase.from("reviews").select("*,profiles(username,display_name)").eq("serie_id",serie.id).order("created_at",{ascending:false});
    setReviews(data||[]);
  }

  async function deleteReview(){
    await supabase.from("reviews").delete().eq("user_id",user.id).eq("serie_id",serie.id);
    setMyReview("");
    const {data}=await supabase.from("reviews").select("*,profiles(username,display_name)").eq("serie_id",serie.id).order("created_at",{ascending:false});
    setReviews(data||[]);
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div style={{ position:"relative", borderRadius:"22px 22px 0 0", overflow:"hidden", minHeight:poster?260:160, background:serie.color }}>
          {poster&&<img src={poster} alt={serie.titulo} style={{ width:"100%", height:260, objectFit:"cover", display:"block" }}/>}
          <div style={{ position:"absolute", inset:0, background:"linear-gradient(transparent 20%,rgba(0,0,0,0.82))", display:"flex", flexDirection:"column", justifyContent:"flex-end", padding:"1.5rem 1.8rem 1.2rem" }}>
            <button onClick={onClose} style={{ position:"absolute", top:14, right:14, background:"rgba(0,0,0,0.5)", color:"#fff", border:"none", borderRadius:"50%", width:34, height:34, fontSize:16, cursor:"pointer" }}>✕</button>
            <h2 style={{ fontFamily:"'Fredoka One',cursive", fontSize:28, color:"#fff", marginBottom:4, textShadow:"0 2px 10px rgba(0,0,0,0.7)" }}>{serie.titulo}</h2>
            <p style={{ color:"rgba(255,255,255,0.8)", fontSize:13 }}>{serie.año} · {serie.cadena} · {serie.episodios} episodios</p>
          </div>
        </div>
        <div style={{ padding:"1.5rem 1.8rem 2rem" }}>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:"1rem" }}>
            {serie.generos.map(g=><span key={g} className="genre-chip">{g}</span>)}
            <span className="chip chip-accent">{serie.decada}</span>
          </div>
          <p style={{ color:"var(--text-muted)", lineHeight:1.75, fontSize:15, marginBottom:"1.5rem" }}>{serie.descripcion}</p>
          <div style={{ marginBottom:"1.2rem" }}>
            <p style={{ fontWeight:800, fontSize:11, color:"var(--accent)", marginBottom:10, letterSpacing:1.5, textTransform:"uppercase" }}>Tu valoración</p>
            <StarRating rating={rating} onRate={onRate} size={28}/>
            {rating>0&&<p style={{ fontSize:13, color:"var(--text-muted)", marginTop:8 }}>{rating}/5 estrellas</p>}
          </div>
          <div style={{ display:"flex", gap:10, marginBottom:"2rem" }}>
            <button className={vista?"btn btn-primary":"btn btn-secondary"} style={{ flex:1, padding:"11px 0", fontSize:14 }} onClick={onToggleVista}>{vista?"✓ Ya la he visto":"Marcar como vista"}</button>
            <button className={pendiente?"btn btn-warning":"btn btn-ghost"} style={{ padding:"11px 18px", fontSize:14 }} onClick={onTogglePendiente}>{pendiente?"🕐 Guardada":"🕐 Pendiente"}</button>
          </div>
          <h3 style={{ fontFamily:"'Fredoka One',cursive", fontSize:20, color:"var(--accent)", marginBottom:"1rem" }}>💬 Reseñas ({reviews.length})</h3>
          {user?(
            <div className="review-card" style={{ marginBottom:"1rem" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                <Avatar username={user.profile?.username} size={30}/>
                <span style={{ fontWeight:800, fontSize:13, color:"var(--text)" }}>{user.profile?.display_name||user.profile?.username}</span>
                <span style={{ fontSize:11, color:"var(--text-faint)" }}>· tu reseña</span>
              </div>
              {editing||!hasMyReview?(
                <>
                  <textarea className="textarea" value={myReview} onChange={e=>setMyReview(e.target.value)} placeholder="¿Qué recuerdas? ¿La veías con alguien especial?" rows={3}/>
                  <div style={{ display:"flex", gap:8, marginTop:8 }}>
                    <button className="btn btn-primary" style={{ flex:1, padding:"8px 0", fontSize:13 }} onClick={saveReview}>Publicar</button>
                    {hasMyReview&&<button className="btn btn-ghost" style={{ padding:"8px 14px", fontSize:13 }} onClick={()=>setEditing(false)}>Cancelar</button>}
                  </div>
                </>
              ):(
                <>
                  <p style={{ fontSize:14, color:"var(--text-muted)", lineHeight:1.7 }}>{myReview}</p>
                  <div style={{ display:"flex", gap:8, marginTop:10 }}>
                    <button className="btn btn-ghost" style={{ fontSize:12, padding:"5px 12px" }} onClick={()=>setEditing(true)}>Editar</button>
                    <button style={{ fontSize:12, padding:"5px 12px", borderRadius:8, background:"#FFE8E8", color:"#900", border:"1.5px solid #C00", cursor:"pointer", fontFamily:"inherit", fontWeight:700 }} onClick={deleteReview}>Eliminar</button>
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
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                  <Avatar username={r.profiles?.username} size={28}/>
                  <span style={{ fontWeight:800, fontSize:13, color:"var(--text)" }}>{r.profiles?.display_name||r.profiles?.username}</span>
                  <span style={{ fontSize:11, color:"var(--text-faint)" }}>{new Date(r.created_at).toLocaleDateString("es-ES")}</span>
                </div>
                <p style={{ fontSize:14, color:"var(--text-muted)", lineHeight:1.7 }}>{r.content}</p>
              </div>
            ))
          }
          {!loadingR&&reviews.length===0&&<p style={{ color:"var(--text-faint)", fontSize:14, textAlign:"center", padding:"1rem" }}>Sé el primero en reseñar esta serie</p>}
        </div>
      </div>
    </div>
  );
}

function Feed({ user, onShowAuth }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(()=>{
    (async()=>{
      setLoading(true);
      const [{ data:r },{ data:w },{ data:rev }]=await Promise.all([
        supabase.from("ratings").select("*,profiles(username,display_name)").order("created_at",{ascending:false}).limit(40),
        supabase.from("watched").select("*,profiles(username,display_name)").order("watched_at",{ascending:false}).limit(40),
        supabase.from("reviews").select("*,profiles(username,display_name)").order("created_at",{ascending:false}).limit(40),
      ]);
      const all=[
        ...(r||[]).map(x=>({type:"rating",date:x.created_at,...x})),
        ...(w||[]).map(x=>({type:"watch",date:x.watched_at,...x})),
        ...(rev||[]).map(x=>({type:"review",date:x.created_at,...x})),
      ].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,50);
      setItems(all); setLoading(false);
    })();
  },[]);
  const getSerie=id=>SERIES.find(s=>s.id===id);
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
      <h2 className="font-display" style={{ fontSize:34, color:"var(--accent)", marginBottom:"1.5rem" }}>🌐 Feed de la comunidad</h2>
      {loading
        ?Array(5).fill(0).map((_,i)=><div key={i} className="feed-item animate-fadeUp" style={{ marginBottom:12, animationDelay:`${i*60}ms` }}><Skeleton width={38} height={38} style={{ borderRadius:"50%" }}/><div style={{ flex:1 }}><Skeleton height={14} width="70%" style={{ marginBottom:6 }}/><Skeleton height={11} width="40%"/></div></div>)
        :items.length===0
          ?<p style={{ color:"var(--text-muted)" }}>Aún no hay actividad. ¡Sé el primero en puntuar una serie!</p>
          :items.map((item,i)=>{
            const serie=getSerie(item.serie_id); if(!serie) return null;
            const name=item.profiles?.display_name||item.profiles?.username||"Alguien";
            return (
              <div key={i} className="feed-item animate-fadeUp" style={{ marginBottom:10, animationDelay:`${Math.min(i*40,300)}ms` }}>
                <Avatar username={item.profiles?.username} size={38}/>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, color:"var(--text)", lineHeight:1.6 }}>
                    <strong>{name}</strong>{" "}
                    {item.type==="rating"&&<>ha puntuado <strong>{serie.titulo}</strong> con {"⭐".repeat(item.rating)}</>}
                    {item.type==="watch"&&<>ha marcado <strong>{serie.titulo}</strong> como vista ✅</>}
                    {item.type==="review"&&<>ha reseñado <strong>{serie.titulo}</strong>: <em style={{ color:"var(--text-muted)" }}>"{item.content?.slice(0,90)}{item.content?.length>90?"…":""}"</em></>}
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

function MiPerfil({ user, onShowAuth }) {
  const [stats, setStats] = useState({ vistas:0, ratings:0, reviews:0, avg:null });
  const [vistas, setVistas] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(()=>{
    if(!user){ setLoading(false); return; }
    (async()=>{
      const [{ data:w },{ data:r },{ data:rev }]=await Promise.all([
        supabase.from("watched").select("serie_id").eq("user_id",user.id),
        supabase.from("ratings").select("rating").eq("user_id",user.id),
        supabase.from("reviews").select("id").eq("user_id",user.id),
      ]);
      const ids=(w||[]).map(x=>x.serie_id);
      const avg=r?.length?(r.reduce((a,b)=>a+b.rating,0)/r.length).toFixed(1):null;
      setStats({ vistas:ids.length, ratings:r?.length||0, reviews:rev?.length||0, avg });
      setVistas(SERIES.filter(s=>ids.includes(s.id)));
      setLoading(false);
    })();
  },[user]);
  if(!user) return (
    <div style={{ textAlign:"center", padding:"5rem 2rem" }} className="animate-fadeUp">
      <div style={{ fontSize:72, marginBottom:16 }}>👤</div>
      <p className="font-display" style={{ fontSize:26, color:"var(--accent)", marginBottom:12 }}>Tu perfil te espera</p>
      <p style={{ color:"var(--text-muted)", fontSize:15, maxWidth:380, margin:"0 auto 1.5rem" }}>Guarda tu historial en la nube y accede desde cualquier dispositivo</p>
      <button className="btn btn-primary" style={{ fontSize:15, padding:"12px 28px" }} onClick={onShowAuth}>Iniciar sesión</button>
    </div>
  );
  if(loading) return (
    <div>
      <div style={{ display:"flex", gap:16, marginBottom:"2rem", alignItems:"center" }}>
        <Skeleton width={64} height={64} style={{ borderRadius:"50%" }}/>
        <div style={{ flex:1 }}><Skeleton height={28} width="60%" style={{ marginBottom:8 }}/><Skeleton height={13} width="40%"/></div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:"2rem" }}>
        {Array(4).fill(0).map((_,i)=><Skeleton key={i} height={100}/>)}
      </div>
    </div>
  );
  return (
    <div className="page-enter">
      <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:"2rem", background:"var(--bg-card)", border:"1.5px solid var(--border)", borderRadius:"var(--radius)", padding:"1.5rem" }}>
        <Avatar username={user.profile?.username} size={64}/>
        <div>
          <p className="font-display" style={{ fontSize:28, color:"var(--accent)" }}>{user.profile?.display_name||user.profile?.username}</p>
          <p style={{ fontSize:13, color:"var(--text-muted)" }}>@{user.profile?.username} · desde {new Date(user.created_at).getFullYear()}</p>
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))", gap:14, marginBottom:"2rem" }}>
        {[{ icon:"📺", value:stats.vistas, label:"Series vistas" },{ icon:"⭐", value:stats.avg??"—", label:"Nota media" },{ icon:"🎬", value:stats.ratings, label:"Valoradas" },{ icon:"💬", value:stats.reviews, label:"Reseñas" }].map((s,i)=>(
          <div key={s.label} className={`stat-card animate-fadeUp delay-${i+1}`}>
            <div style={{ fontSize:26, marginBottom:4 }}>{s.icon}</div>
            <div className="font-display" style={{ fontSize:34, color:"var(--accent)", lineHeight:1 }}>{s.value}</div>
            <div style={{ fontSize:12, color:"var(--text-muted)", fontWeight:700, marginTop:4 }}>{s.label}</div>
          </div>
        ))}
      </div>
      {vistas.length>0&&(
        <div style={{ background:"var(--bg-card)", border:"1.5px solid var(--border)", borderRadius:"var(--radius)", padding:"1.2rem 1.5rem", marginBottom:"2rem" }}>
          <h3 className="font-display" style={{ fontSize:18, color:"var(--accent)", marginBottom:"1rem" }}>📊 Progreso por década</h3>
          {["70s","80s","90s","00s"].map(d=>{
            const count=vistas.filter(s=>s.decada===d).length;
            const total=SERIES.filter(s=>s.decada===d).length;
            return (
              <div key={d} style={{ marginBottom:12 }}>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, fontWeight:700, color:"var(--text)", marginBottom:4 }}><span>{d}</span><span style={{ color:"var(--text-muted)" }}>{count}/{total}</span></div>
                <div className="progress-track"><div className="progress-fill" style={{ width:`${total>0?(count/total)*100:0}%` }}/></div>
              </div>
            );
          })}
        </div>
      )}
      {vistas.length>0&&(
        <div>
          <h3 className="font-display" style={{ fontSize:22, color:"var(--accent)", marginBottom:"1rem" }}>✅ Series vistas</h3>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
            {vistas.map(s=>(
              <div key={s.id} style={{ background:s.color, padding:"6px 14px", borderRadius:20, color:"#fff", fontWeight:700, fontSize:13, transition:"transform 0.15s", cursor:"default" }}
                onMouseEnter={e=>e.currentTarget.style.transform="scale(1.05)"}
                onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}
              >{s.titulo}</div>
            ))}
          </div>
        </div>
      )}
      {vistas.length===0&&<div style={{ textAlign:"center", padding:"3rem", color:"var(--text-muted)" }}><div style={{ fontSize:60, marginBottom:12 }}>📺</div><p className="font-display" style={{ fontSize:22, color:"var(--accent)" }}>¡Empieza tu historial!</p></div>}
    </div>
  );
}

function InstallBanner() {
  const [prompt, setPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  useEffect(()=>{
    const h=(e)=>{ e.preventDefault(); setPrompt(e); setVisible(true); };
    window.addEventListener("beforeinstallprompt",h);
    return ()=>window.removeEventListener("beforeinstallprompt",h);
  },[]);
  if(!visible) return null;
  return (
    <div className="install-banner">
      <span style={{ fontSize:32 }}>📺</span>
      <div style={{ flex:1 }}>
        <p style={{ fontWeight:800, fontSize:14, color:"var(--text)", marginBottom:2 }}>Instalar AnimaFilm</p>
        <p style={{ fontSize:12, color:"var(--text-muted)" }}>Añade la app a tu pantalla de inicio</p>
      </div>
      <button className="btn btn-primary" style={{ fontSize:13, padding:"8px 16px" }} onClick={async()=>{ await prompt.prompt(); setVisible(false); }}>Instalar</button>
      <button className="btn btn-ghost" style={{ fontSize:13, padding:"8px 12px" }} onClick={()=>setVisible(false)}>✕</button>
    </div>
  );
}

export default function App() {
  const { theme, toggleTheme } = useThemeToggle();
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [posters, setPosters] = useState({});
  const [decada, setDecada] = useState("Todas");
  const [busqueda, setBusqueda] = useState("");
  const [vistas, setVistas] = useState({});
  const [pendientes, setPendientes] = useState({});
  const [ratings, setRatings] = useState({});
  const [serieActiva, setSerieActiva] = useState(null);
  const [vistaActual, setVistaActual] = useState("catalogo");
  const [catalogLoaded, setCatalogLoaded] = useState(false);

  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>setSession(session));
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_,s)=>setSession(s));
    return ()=>subscription.unsubscribe();
  },[]);

  useEffect(()=>{
    if(!session){ setProfile(null); return; }
    supabase.from("profiles").select("*").eq("id",session.user.id).single().then(({data})=>setProfile(data));
  },[session]);

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
    // Carga progresiva: actualiza la UI tras cada lote de 6 series
    fetchAllPosters(SERIES, 6, (partial) => setPosters(partial)).then(setPosters);
    setTimeout(()=>setCatalogLoaded(true), 80);
  },[]);

  const user=session?{...session.user,profile}:null;

  const toggleVista=useCallback(async(id)=>{
    if(!session){ setShowAuth(true); return; }
    const uid=session.user.id;
    if(vistas[id]){
      await supabase.from("watched").delete().eq("user_id",uid).eq("serie_id",id);
      setVistas(p=>({...p,[id]:false}));
    } else {
      await supabase.from("watched").insert({user_id:uid,serie_id:id});
      setVistas(p=>({...p,[id]:true}));
      await supabase.from("watchlist").delete().eq("user_id",uid).eq("serie_id",id);
      setPendientes(p=>({...p,[id]:false}));
    }
  },[session,vistas]);

  const togglePendiente=useCallback(async(id)=>{
    if(!session){ setShowAuth(true); return; }
    const uid=session.user.id;
    if(pendientes[id]){
      await supabase.from("watchlist").delete().eq("user_id",uid).eq("serie_id",id);
      setPendientes(p=>({...p,[id]:false}));
    } else {
      await supabase.from("watchlist").insert({user_id:uid,serie_id:id});
      setPendientes(p=>({...p,[id]:true}));
    }
  },[session,pendientes]);

  const setRating=useCallback(async(id,r)=>{
    if(!session){ setShowAuth(true); return; }
    const uid=session.user.id;
    if(r===0) await supabase.from("ratings").delete().eq("user_id",uid).eq("serie_id",id);
    else await supabase.from("ratings").upsert({user_id:uid,serie_id:id,rating:r},{onConflict:"user_id,serie_id"});
    setRatings(prev=>({...prev,[id]:r}));
  },[session]);

  const seriesFiltradas=useMemo(()=>
    SERIES.filter(s=>(decada==="Todas"||s.decada===decada)&&s.titulo.toLowerCase().includes(busqueda.toLowerCase()))
  ,[decada,busqueda]);

  const totalVistas=Object.values(vistas).filter(Boolean).length;
  const totalPendientes=Object.values(pendientes).filter(Boolean).length;

  const NAV=[
    {id:"catalogo",label:"📽️ Catálogo"},
    {id:"feed",label:"🌐 Comunidad"},
    {id:"miperfil",label:`⭐ Mi Perfil${totalVistas>0?` (${totalVistas})`:""}`},
  ];

  return (
    <>
      <header className="site-header">
        <div style={{ maxWidth:1200, margin:"0 auto", display:"flex", alignItems:"center", justifyContent:"space-between", height:62, padding:"0 1.5rem", gap:10 }}>
          <button
            className="brand"
            onClick={()=>{ setVistaActual("catalogo"); setDecada("Todas"); window.scrollTo({ top:0, behavior:"smooth" }); }}
            title="Volver al catálogo"
          >
            <span style={{ fontSize:26 }}>📺</span>
            <span className="font-display" style={{ fontSize:24 }}>AnimaFilm</span>
          </button>
          <nav style={{ display:"flex", gap:5, alignItems:"center" }}>
            {NAV.map(v=>(
              <button key={v.id} className={`nav-pill${vistaActual===v.id?" active":""}`} onClick={()=>setVistaActual(v.id)}>{v.label}</button>
            ))}
            <button className={`theme-toggle ${theme}`} onClick={toggleTheme} title="Cambiar tema" style={{ marginLeft:6 }}>
              <div className="knob">{theme==="dark"?"🌙":"☀️"}</div>
            </button>
            {session
              ?<button className="btn btn-ghost" style={{ color:"#FFD700", borderColor:"rgba(255,215,0,0.3)", fontSize:12, padding:"6px 12px", marginLeft:4 }} onClick={()=>supabase.auth.signOut()}>Salir</button>
              :<button className="btn" style={{ background:"#FFD700", color:"var(--header-bg)", border:"none", fontSize:13, padding:"7px 16px", marginLeft:4 }} onClick={()=>setShowAuth(true)}>Iniciar sesión</button>
            }
          </nav>
        </div>
      </header>

      <main style={{ maxWidth:1200, margin:"0 auto", padding:"2rem 1.5rem" }}>
        {vistaActual==="catalogo"&&(
          <div className="page-enter">
            <div style={{ textAlign:"center", marginBottom:"2rem" }}>
              <h1 className="hero-title animate-fadeUp">Las series de tu infancia</h1>
              <p className="animate-fadeUp delay-1" style={{ color:"var(--text-muted)", fontSize:16, marginTop:8, maxWidth:480, margin:"8px auto 0" }}>Puntúa, reseña y recuerda las series que marcaron toda una generación</p>
            </div>
            <div style={{ display:"flex", gap:12, marginBottom:"1.2rem", flexWrap:"wrap", alignItems:"center" }} className="animate-fadeUp delay-2">
              <input className="input" type="text" placeholder="🔍  Buscar serie…" defaultValue={busqueda} onChange={e=>{ clearTimeout(window._st); window._st=setTimeout(()=>setBusqueda(e.target.value),220); }} style={{ flex:1, minWidth:180 }}/>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {DECADAS.map(d=>(
                  <button key={d} className={d===decada?"btn btn-primary":"btn btn-secondary"} style={{ padding:"8px 16px", fontSize:13, borderRadius:24 }} onClick={()=>setDecada(d)}>{d}</button>
                ))}
              </div>
            </div>
            <div style={{ display:"flex", gap:10, marginBottom:"1.5rem", flexWrap:"wrap" }} className="animate-fadeUp delay-3">
              {[{icon:"🎬",value:seriesFiltradas.length,label:"en catálogo"},{icon:"✅",value:totalVistas,label:"vistas"},{icon:"🕐",value:totalPendientes,label:"pendientes"}].map(s=>(
                <div key={s.label} className="mini-stat"><span style={{ fontSize:16 }}>{s.icon}</span><span style={{ fontWeight:900, fontSize:16, color:"var(--accent)" }}>{s.value}</span><span style={{ fontSize:12, color:"var(--text-muted)", fontWeight:600 }}>{s.label}</span></div>
              ))}
            </div>
            {!catalogLoaded
              ?<div className="series-grid">{Array(12).fill(0).map((_,i)=><CardSkeleton key={i}/>)}</div>
              :seriesFiltradas.length>0
                ?<div className="series-grid">
                  {seriesFiltradas.map((serie,i)=>(
                    <SerieCard key={serie.id} serie={serie} poster={posters[serie.id]}
                      vista={!!vistas[serie.id]} pendiente={!!pendientes[serie.id]} rating={ratings[serie.id]||0}
                      animDelay={Math.min(i*30,400)}
                      onCardClick={()=>setSerieActiva(serie)}
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
        )}
        {vistaActual==="feed"&&<Feed user={user} onShowAuth={()=>setShowAuth(true)}/>}
        {vistaActual==="miperfil"&&<MiPerfil user={user} onShowAuth={()=>setShowAuth(true)}/>}
      </main>

      {serieActiva&&(
        <SerieModal serie={serieActiva} poster={posters[serieActiva.id]}
          vista={!!vistas[serieActiva.id]} pendiente={!!pendientes[serieActiva.id]} rating={ratings[serieActiva.id]||0}
          user={user}
          onClose={()=>setSerieActiva(null)}
          onToggleVista={()=>toggleVista(serieActiva.id)}
          onTogglePendiente={()=>togglePendiente(serieActiva.id)}
          onRate={r=>setRating(serieActiva.id,r)}
          onShowAuth={()=>{ setSerieActiva(null); setShowAuth(true); }}
        />
      )}
      {showAuth&&<Auth onClose={()=>setShowAuth(false)}/>}
      <InstallBanner/>
    </>
  );
}