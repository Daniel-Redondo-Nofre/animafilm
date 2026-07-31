// src/components/Auth.jsx
import { useState } from "react";
import { supabase } from "../lib/supabase";

const S = {
  overlay: {
    position: "fixed", inset: 0, background: "rgba(20,5,0,0.80)",
    zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center",
    padding: "1rem", backdropFilter: "blur(6px)",
  },
  card: {
    background: "#FFF8F0", borderRadius: 22, width: "100%",
    maxWidth: 420, padding: "2.5rem 2rem", boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
  },
  logo: { fontFamily: "'Fredoka One', cursive", fontSize: 32, color: "#7A0000", textAlign: "center", marginBottom: 6 },
  sub:  { textAlign: "center", color: "#7A4F3A", fontSize: 14, marginBottom: "2rem" },
  label: { display: "block", fontWeight: 800, fontSize: 12, color: "#7A0000", marginBottom: 5, letterSpacing: 1, textTransform: "uppercase" },
  input: {
    width: "100%", padding: "11px 14px", borderRadius: 10,
    border: "2px solid #DDD0C4", fontSize: 15, fontFamily: "'Nunito', sans-serif",
    background: "#fff", color: "#2C1810", marginBottom: "1rem",
  },
  btn: (primary) => ({
    width: "100%", padding: "13px 0", borderRadius: 12,
    fontWeight: 900, fontSize: 16, cursor: "pointer", fontFamily: "inherit",
    background: primary ? "#7A0000" : "transparent",
    color: primary ? "#FFD700" : "#7A0000",
    border: "2px solid #7A0000",
    transition: "all 0.15s",
    marginTop: primary ? "0.5rem" : "0.25rem",
  }),
  error: { background: "#FFE8E8", border: "1.5px solid #C00", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#900", marginBottom: "1rem" },
  toggle: { textAlign: "center", marginTop: "1.2rem", fontSize: 14, color: "#7A4F3A" },
};

export default function Auth({ onClose }) {
  const [mode, setMode]       = useState("login"); // login | register
  const [email, setEmail]     = useState("");
  const [password, setPass]   = useState("");
  const [username, setUser]   = useState("");
  const [error, setError]     = useState(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(false);

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onClose();
      } else {
        if (username.length < 3) throw new Error("El nombre de usuario debe tener al menos 3 caracteres.");
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { username } },
        });
        if (error) throw error;
        setDone(true);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (done) return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.card, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 64, marginBottom: 12 }}>📬</div>
        <p style={{ ...S.logo, marginBottom: 10 }}>¡Revisa tu email!</p>
        <p style={{ color: "#7A4F3A", fontSize: 15, lineHeight: 1.7 }}>
          Te hemos enviado un enlace de confirmación a <strong>{email}</strong>.<br />
          Haz clic en él para activar tu cuenta.
        </p>
        <button style={{ ...S.btn(true), marginTop: "1.5rem" }} onClick={onClose}>Entendido</button>
      </div>
    </div>
  );

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.card} onClick={(e) => e.stopPropagation()}>
        <div style={S.logo}>📺 AnimaFilm</div>
        <p style={S.sub}>{mode === "login" ? "Inicia sesión para guardar tu historial" : "Crea tu cuenta gratis"}</p>

        {error && <div style={S.error}>⚠️ {error}</div>}

        {mode === "register" && (
          <label style={{ display: "block" }}>
            <span style={S.label}>Nombre de usuario</span>
            <input style={S.input} value={username} onChange={(e) => setUser(e.target.value)} placeholder="Ej: infanteria80s" />
          </label>
        )}

        <label style={{ display: "block" }}>
          <span style={S.label}>Email</span>
          <input style={S.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" />
        </label>

        <label style={{ display: "block" }}>
          <span style={S.label}>Contraseña</span>
          <input style={S.input} type="password" value={password} onChange={(e) => setPass(e.target.value)} placeholder="Mínimo 6 caracteres" />
        </label>

        <button style={S.btn(true)} onClick={handleSubmit} disabled={loading}>
          {loading ? "Cargando…" : mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
        </button>

        <div style={S.toggle}>
          {mode === "login" ? (
            <span>¿Nuevo aquí? <button style={{ background: "none", border: "none", cursor: "pointer", color: "#7A0000", fontWeight: 800, fontSize: 14, fontFamily: "inherit" }} onClick={() => { setMode("register"); setError(null); }}>Regístrate</button></span>
          ) : (
            <span>¿Ya tienes cuenta? <button style={{ background: "none", border: "none", cursor: "pointer", color: "#7A0000", fontWeight: 800, fontSize: 14, fontFamily: "inherit" }} onClick={() => { setMode("login"); setError(null); }}>Inicia sesión</button></span>
          )}
        </div>
      </div>
    </div>
  );
}
