// src/components/Estrellas.jsx
//
// Valoración con media estrella, al estilo de Letterboxd.
//
// Internamente todo se mueve en MEDIAS ESTRELLAS (1..10): los enteros no
// arrastran errores de redondeo. La escala visible (0,5..5) sale de
// dividir entre 2 al mostrar.
//
// Por qué SVG y no el glifo ★: la fuente no centra el carácter en su
// caja —deja espacios laterales distintos—, así que recortar al 50 % de
// ancho no cae en el eje de la estrella y la media queda descuadrada.
// Con un path propio la geometría es exacta y el corte cae donde debe.

import { useState, useId } from "react";

const TOTAL = 5;

// Estrella de cinco puntas centrada en (12,12), radio 11
const PATH =
  "M12 1.6l3.09 6.26 6.91 1-5 4.87 1.18 6.87L12 17.35 " +
  "5.82 20.6 7 13.73l-5-4.87 6.91-1L12 1.6z";

function Estrella({ relleno, tam, gradId, animando }) {
  return (
    <svg
      className={`estrella-svg${animando ? " pop" : ""}`}
      width={tam} height={tam} viewBox="0 0 24 24"
      aria-hidden="true" focusable="false"
    >
      <defs>
        <linearGradient id={gradId} x1="0" x2="1" y1="0" y2="0">
          <stop offset={`${relleno}%`} stopColor="var(--estrella-on)" />
          <stop offset={`${relleno}%`} stopColor="var(--estrella-off)" />
        </linearGradient>
      </defs>
      <path
        d={PATH}
        fill={`url(#${gradId})`}
        stroke="var(--estrella-borde)"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Estrellas({
  valor = 0,           // medias estrellas: 0..10
  onChange,
  size = 22,
  readonly = false,
  mostrarNumero = false,
}) {
  const [hover, setHover] = useState(0);
  const [ultima, setUltima] = useState(null);
  const uid = useId();

  const activo = hover || valor;

  // Posición del puntero → medias estrellas
  function desdeEvento(e, indice) {
    const { left, width } = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX ?? e.touches?.[0]?.clientX ?? 0) - left;
    return indice * 2 + (x < width / 2 ? 1 : 2);
  }

  function alPulsar(e, i) {
    if (readonly) return;
    e.stopPropagation();
    e.preventDefault();
    const nuevo = desdeEvento(e, i);
    const final = nuevo === valor ? 0 : nuevo;   // repetir la nota la retira
    setUltima(final);
    setTimeout(() => setUltima(null), 460);
    onChange?.(final);
  }

  function alTeclear(e) {
    if (readonly) return;
    const paso = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
    if (paso) { e.preventDefault(); onChange?.(Math.max(0, Math.min(10, valor + paso))); }
    else if (e.key === "Home")   { e.preventDefault(); onChange?.(1); }
    else if (e.key === "End")    { e.preventDefault(); onChange?.(10); }
    else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); onChange?.(0); }
  }

  const etiqueta = valor > 0 ? `${valor / 2} de 5 estrellas` : "Sin valorar";

  return (
    <div className="estrellas-wrap">
      <div
        className={`estrellas${readonly ? " solo-lectura" : ""}${hover ? " tocando" : ""}`}
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
          const medias = activo - i * 2;
          const relleno = medias <= 0 ? 0 : medias === 1 ? 50 : 100;
          // La animación recorre las estrellas en cascada al puntuar
          const anim = ultima != null && ultima > 0 && i * 2 < ultima;
          return (
            <span
              key={i}
              className="estrella"
              style={{ "--retardo": `${i * 45}ms` }}
              onMouseMove={(e) => !readonly && setHover(desdeEvento(e, i))}
              onClick={(e) => alPulsar(e, i)}
            >
              <Estrella
                relleno={relleno}
                tam={size}
                gradId={`${uid}-g${i}`}
                animando={anim}
              />
            </span>
          );
        })}
      </div>

      {mostrarNumero && activo > 0 && (
        <span className="estrellas-numero">
          {(activo / 2).toFixed(1).replace(".0", "")}
        </span>
      )}
    </div>
  );
}

/** Estrellas de solo lectura a partir de una nota decimal (0..5) */
export function EstrellasNota({ nota, size = 15 }) {
  if (nota == null) return null;
  return <Estrellas valor={Math.round(Number(nota) * 2)} size={size} readonly />;
}
