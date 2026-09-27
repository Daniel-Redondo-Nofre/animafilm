// src/components/Etiquetas.jsx
// Selector de etiquetas para una reseña: sugerencias más las que quieras.

import { useState, useEffect } from "react";
import { fetchEtiquetasPopulares } from "../lib/resenas";

const MAX = 5;

export default function Etiquetas({ valor = [], onChange }) {
  const [sugeridas, setSugeridas] = useState([]);
  const [texto, setTexto] = useState("");

  useEffect(() => {
    fetchEtiquetasPopulares(10).then(setSugeridas).catch(() => setSugeridas([]));
  }, []);

  // Compara sin tildes ni mayúsculas, igual que hace el servidor: si no,
  // "Nostalgia" y "nostalgia" parecerían distintas en la interfaz y el
  // servidor las rechazaría como duplicadas.
  const normaliza = (s) =>
    s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const yaEsta = (n) => valor.some(v => normaliza(v) === normaliza(n));

  function anadir(nombre) {
    const n = nombre.trim();
    if (n.length < 2 || yaEsta(n) || valor.length >= MAX) return;
    onChange([...valor, n]);
    setTexto("");
  }

  function quitar(nombre) {
    onChange(valor.filter(v => v !== nombre));
  }

  function alTeclear(e) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      anadir(texto);
    } else if (e.key === "Backspace" && !texto && valor.length > 0) {
      // Borrar con el campo vacío quita la última: es lo que se espera
      onChange(valor.slice(0, -1));
    }
  }

  const disponibles = sugeridas.filter(s => !yaEsta(s.nombre)).slice(0, 6);

  return (
    <div className="etq">
      <span className="pers-label">
        Etiquetas <em className="etq-cuenta">{valor.length}/{MAX}</em>
      </span>

      {valor.length > 0 && (
        <div className="etq-puestas">
          {valor.map(n => (
            <span key={n} className="etq-chip puesta">
              {n}
              <button onClick={() => quitar(n)} aria-label={`Quitar etiqueta ${n}`}>✕</button>
            </span>
          ))}
        </div>
      )}

      {valor.length < MAX && (
        <>
          <input
            className="input etq-campo"
            value={texto}
            maxLength={24}
            onChange={e => setTexto(e.target.value)}
            onKeyDown={alTeclear}
            onBlur={() => texto.trim() && anadir(texto)}
            placeholder="Escribe y pulsa Enter…"
          />

          {disponibles.length > 0 && (
            <div className="etq-sugeridas">
              {disponibles.map(s => (
                <button key={s.slug} className="etq-chip sugerida"
                        onClick={() => anadir(s.nombre)}>
                  + {s.nombre}
                  {Number(s.usos) > 0 && <em>{s.usos}</em>}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
