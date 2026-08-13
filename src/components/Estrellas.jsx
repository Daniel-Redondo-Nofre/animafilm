// src/components/Estrellas.jsx
//
// Valoración con media estrella, al estilo de Letterboxd.
//
// Internamente todo se mueve en MEDIAS ESTRELLAS (1..10) porque los
// enteros no arrastran errores de redondeo. La conversión a la escala
// visible (0,5..5) se hace solo al mostrar.
//
// Cada estrella se dibuja dos veces, una encima de la otra: la de abajo
// apagada y la de arriba recortada al 50 % de ancho. Así media estrella
// es media estrella de verdad, no un glifo distinto.

import { useState, useRef } from "react";

const TOTAL = 5;

export default function Estrellas({
  valor = 0,           // en medias estrellas: 0..10
  onChange,
  size = 22,
  readonly = false,
  mostrarNumero = false,
}) {
  const [hover, setHover] = useState(0);
  const [ultima, setUltima] = useState(null);
  const ref = useRef(null);

  const activo = hover || valor;

  // Convierte la posición del puntero en medias estrellas
  function medidasDesdeEvento(e, indice) {
    const el = e.currentTarget;
    const { left, width } = el.getBoundingClientRect();
    const x = (e.clientX ?? e.touches?.[0]?.clientX ?? 0) - left;
    const mitadIzquierda = x < width / 2;
    return indice * 2 + (mitadIzquierda ? 1 : 2);
  }

  function alMover(e, i) {
    if (readonly) return;
    setHover(medidasDesdeEvento(e, i));
  }

  function alPulsar(e, i) {
    if (readonly) return;
    e.stopPropagation();
    e.preventDefault();
    const nuevo = medidasDesdeEvento(e, i);
    // Volver a pulsar la misma nota la retira
    const final = nuevo === valor ? 0 : nuevo;
    setUltima(final);
    setTimeout(() => setUltima(null), 400);
    onChange?.(final);
  }

  // Teclado: flechas suben y bajan de media en media
  function alTeclear(e) {
    if (readonly) return;
    const paso = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
    if (paso) {
      e.preventDefault();
      onChange?.(Math.max(0, Math.min(10, valor + paso)));
    } else if (e.key === "Home") {
      e.preventDefault(); onChange?.(1);
    } else if (e.key === "End") {
      e.preventDefault(); onChange?.(10);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault(); onChange?.(0);
    }
  }

  const etiqueta = valor > 0
    ? `${valor / 2} de 5 estrellas`
    : "Sin valorar";

  return (
    <div className="estrellas-wrap">
      <div
        ref={ref}
        className={`estrellas${readonly ? " solo-lectura" : ""}`}
        style={{ "--tam": `${size}px` }}
        onMouseLeave={() => !readonly && setHover(0)}
        role={readonly ? "img" : "slider"}
        aria-label={readonly ? etiqueta : "Tu valoración"}
        aria-valuemin={readonly ? undefined : 0}
        aria-valuemax={readonly ? undefined : 5}
        aria-valuenow={readonly ? undefined : valor / 2}
        aria-valuetext={etiqueta}
        tabIndex={readonly ? -1 : 0}
        onKeyDown={alTeclear}
      >
        {Array.from({ length: TOTAL }, (_, i) => {
          const medias = activo - i * 2;          // 0 = vacía, 1 = media, ≥2 = llena
          const relleno = medias <= 0 ? 0 : medias === 1 ? 50 : 100;
          return (
            <span
              key={i}
              className={`estrella${ultima != null && Math.ceil(ultima / 2) === i + 1 ? " pop" : ""}`}
              onMouseMove={(e) => alMover(e, i)}
              onClick={(e) => alPulsar(e, i)}
            >
              <span className="estrella-base" aria-hidden="true">★</span>
              <span className="estrella-llena" style={{ width: `${relleno}%` }} aria-hidden="true">★</span>
            </span>
          );
        })}
      </div>

      {mostrarNumero && valor > 0 && (
        <span className="estrellas-numero">{(valor / 2).toFixed(1).replace(".0", "")}</span>
      )}
    </div>
  );
}

/** Estrellas solo de lectura a partir de una nota decimal (0..5) */
export function EstrellasNota({ nota, size = 15 }) {
  if (nota == null) return null;
  // Redondeo al medio punto más cercano
  const medias = Math.round(Number(nota) * 2);
  return <Estrellas valor={medias} size={size} readonly />;
}
