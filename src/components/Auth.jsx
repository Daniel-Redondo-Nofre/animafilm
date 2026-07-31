// src/components/Auth.jsx — estilo tebeo + validación endurecida
import { useState } from "react";
import { supabase } from "../lib/supabase";

const MIN_PASS = 8;
const USER_RE  = /^[a-zA-Z0-9_.-]{3,20}$/;
const MAIL_RE  = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Traduce errores de Supabase a mensajes útiles SIN revelar si una cuenta
// existe. "Invalid login credentials" es deliberadamente ambiguo: si
// dijéramos "ese email no está registrado", cualquiera podría sondear
// direcciones para averiguar quién tiene cuenta (enumeración de usuarios).
function friendlyError(msg = "") {
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials")) return "Email o contraseña incorrectos.";
  if (m.includes("email not confirmed"))       return "Confirma tu email antes de entrar. Revisa tu bandeja.";
  if (m.includes("user already registered"))   return "No hemos podido crear la cuenta. Prueba a iniciar sesión.";
  if (m.includes("rate limit") || m.includes("too many")) return "Demasiados intentos. Espera unos minutos.";
  if (m.includes("password"))                  return `La contraseña debe tener al menos ${MIN_PASS} caracteres.`;
  if (m.includes("network") || m.includes("fetch")) return "Problema de conexión. Inténtalo de nuevo.";
  return "Algo ha fallado. Inténtalo de nuevo en un momento.";
}

// Medidor simple: longitud + variedad de caracteres
function passScore(p) {
  if (!p) return 0;
  let s = 0;
  if (p.length >= MIN_PASS) s++;
  if (p.length >= 12) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^\w\s]/.test(p)) s++;
  return Math.min(s, 4);
}
const SCORE_LABEL = ["Muy débil", "Débil", "Aceptable", "Buena", "Fuerte"];
const SCORE_COLOR = ["#E8200A", "#E8200A", "#C86400", "#0044BB", "#008A3C"];

export default function Auth({ onClose }) {
  const [mode, setMode]     = useState("login");
  const [email, setEmail]   = useState("");
  const [password, setPass] = useState("");
  const [username, setUser] = useState("");
  const [error, setError]   = useState(null);
  const [loading, setLoad]  = useState(false);
  const [done, setDone]     = useState(false);

  const score = passScore(password);

  function validate() {
    if (!MAIL_RE.test(email.trim())) return "Introduce un email válido.";
    if (mode === "register") {
      if (!USER_RE.test(username))
        return "El usuario debe tener entre 3 y 20 caracteres: letras, números, guion, punto o guion bajo.";
      if (password.length < MIN_PASS)
        return `La contraseña necesita al menos ${MIN_PASS} caracteres.`;
      if (score < 2)
        return "Contraseña demasiado predecible. Combina mayúsculas, números o símbolos.";
      if (password.toLowerCase().includes(username.toLowerCase()))
        return "La contraseña no debería contener tu nombre de usuario.";
    }
    return null;
  }

  async function handleSubmit() {
    const problem = validate();
    if (problem) { setError(problem); return; }

    setError(null); setLoad(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        if (error) throw error;
        onClose();
      } else {
        const { error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: { data: { username: username.trim().toLowerCase() } },
        });
        if (error) throw error;
        setDone(true);
      }
    } catch (e) {
      setError(friendlyError(e?.message));
    } finally {
      setLoad(false);
      setPass("");   // no dejamos la contraseña viva en memoria del componente
    }
  }

  const onKey = (e) => { if (e.key === "Enter" && !loading) handleSubmit(); };

  const label   = { display:"block", fontFamily:"var(--font-display)", fontSize:14, color:"var(--accent)", marginBottom:5, letterSpacing:".06em" };
  const linkBtn = { background:"none", border:"none", cursor:"pointer", color:"var(--accent)", fontFamily:"var(--font-display)", fontSize:15, letterSpacing:".04em", padding:0 };

  if (done) return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth:400, padding:"2.5rem 2rem", textAlign:"center" }} onClick={e=>e.stopPropagation()}>
        <div style={{ fontSize:64, marginBottom:12 }}>🎉</div>
        <p className="font-display" style={{ fontSize:30, color:"var(--accent)", marginBottom:10 }}>¡Cuenta creada!</p>
        <p style={{ color:"var(--text-muted)", fontSize:15, lineHeight:1.7, fontWeight:700 }}>
          Si tu proyecto pide confirmación, revisa el correo de <strong>{email}</strong>.
          Si no, ya puedes empezar a puntuar.
        </p>
        <button className="btn btn-primary" style={{ marginTop:"1.5rem", width:"100%", padding:"11px 0", fontSize:16 }} onClick={onClose}>
          Entendido
        </button>
      </div>
    </div>
  );

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth:400, padding:"2.2rem 2rem" }} onClick={e=>e.stopPropagation()}>
        <p className="font-display" style={{ fontSize:34, color:"var(--accent)", textAlign:"center", marginBottom:4 }}>📺 AnimaFilm</p>
        <p style={{ textAlign:"center", color:"var(--text-muted)", fontSize:14, marginBottom:"1.8rem", fontWeight:700 }}>
          {mode==="login" ? "Inicia sesión para guardar tu historial" : "Crea tu cuenta gratis"}
        </p>

        {error && (
          <div role="alert" style={{ background:"var(--rojo)", color:"#fff", border:"3px solid var(--border)", borderRadius:"var(--radius-sm)", padding:"10px 14px", fontSize:14, marginBottom:"1rem", fontWeight:700, boxShadow:"3px 3px 0 var(--border)" }}>
            ¡ZAS! {error}
          </div>
        )}

        {mode==="register" && (
          <div style={{ marginBottom:"1rem" }}>
            <span style={label}>Nombre de usuario</span>
            <input className="input" value={username} maxLength={20} autoComplete="username"
                   onChange={e=>setUser(e.target.value)} onKeyDown={onKey}
                   placeholder="Ej: capitantrueno80" />
          </div>
        )}

        <div style={{ marginBottom:"1rem" }}>
          <span style={label}>Email</span>
          <input className="input" type="email" value={email} maxLength={120}
                 autoComplete={mode==="login" ? "username" : "email"}
                 onChange={e=>setEmail(e.target.value)} onKeyDown={onKey}
                 placeholder="tu@email.com" />
        </div>

        <div style={{ marginBottom: mode==="register" ? ".6rem" : "1.4rem" }}>
          <span style={label}>Contraseña</span>
          <input className="input" type="password" value={password} maxLength={72}
                 autoComplete={mode==="login" ? "current-password" : "new-password"}
                 onChange={e=>setPass(e.target.value)} onKeyDown={onKey}
                 placeholder={mode==="login" ? "Tu contraseña" : `Mínimo ${MIN_PASS} caracteres`} />
        </div>

        {/* Medidor de fuerza, solo al registrarse */}
        {mode==="register" && password.length > 0 && (
          <div style={{ marginBottom:"1.4rem" }}>
            <div style={{ display:"flex", gap:4, marginBottom:5 }}>
              {[0,1,2,3].map(i => (
                <div key={i} style={{
                  flex:1, height:6, borderRadius:3,
                  border:"1.5px solid var(--border)",
                  background: i < score ? SCORE_COLOR[score] : "var(--bg-muted)",
                  transition:"background .2s ease",
                }} />
              ))}
            </div>
            <span style={{ fontSize:12, fontWeight:700, color:"var(--text-muted)" }}>
              Seguridad: <strong style={{ color: SCORE_COLOR[score] }}>{SCORE_LABEL[score]}</strong>
            </span>
          </div>
        )}

        <button className="btn btn-primary" style={{ width:"100%", padding:"12px 0", fontSize:17, opacity: loading ? .6 : 1 }}
                onClick={handleSubmit} disabled={loading}>
          {loading ? "Cargando…" : mode==="login" ? "¡Adelante!" : "Crear cuenta"}
        </button>

        <div style={{ textAlign:"center", marginTop:"1.2rem", fontSize:14, color:"var(--text-muted)", fontWeight:700 }}>
          {mode==="login"
            ? <>¿Nuevo aquí? <button style={linkBtn} onClick={()=>{setMode("register");setError(null);setPass("");}}>Regístrate</button></>
            : <>¿Ya tienes cuenta? <button style={linkBtn} onClick={()=>{setMode("login");setError(null);setPass("");}}>Inicia sesión</button></>
          }
        </div>
      </div>
    </div>
  );
}
