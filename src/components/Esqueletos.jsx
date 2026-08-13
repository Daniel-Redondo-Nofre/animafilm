// src/components/Esqueletos.jsx
//
// Esqueletos con la forma real de cada página.
//
// Un rectángulo genérico mientras carga es peor que nada: la página
// aparece con una silueta, luego con otra distinta, y el salto entre
// ambas es el parpadeo. Si el esqueleto tiene la misma estructura que
// el contenido final, la transición deja de notarse.

export function Bloque({ w = "100%", h = 20, r, style }) {
  return (
    <div
      className="skeleton"
      style={{ width: w, height: h, borderRadius: r, ...style }}
      aria-hidden="true"
    />
  );
}

/** Rejilla de tarjetas: catálogo y listas */
export function EsqueletoCatalogo({ n = 12 }) {
  return (
    <div className="series-grid" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="card" style={{ overflow: "hidden" }}>
          <div className="card-poster"><Bloque h="100%" r="0" /></div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <Bloque h={13} w="78%" />
            <Bloque h={10} w="52%" />
            <Bloque h={15} w={82} />
            <Bloque h={26} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Perfil: cabecera, cifras y contenido */
export function EsqueletoPerfil() {
  return (
    <div aria-hidden="true">
      <div className="perfil-ficha">
        <Bloque w={84} h={84} r="50%" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Bloque h={30} w="42%" style={{ marginBottom: 9 }} />
          <Bloque h={13} w="28%" style={{ marginBottom: 16 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <Bloque h={28} w={110} r="var(--radius-sm)" />
            <Bloque h={28} w={95}  r="var(--radius-sm)" />
          </div>
        </div>
      </div>

      <div className="perfil-cifras">
        {Array.from({ length: 6 }, (_, i) => <Bloque key={i} h={78} r="var(--radius-sm)" />)}
      </div>

      <Bloque h={44} w={280} r="var(--radius-sm)" style={{ marginBottom: 16 }} />
      <Bloque h={200} r="var(--radius)" />
    </div>
  );
}

/** Feed de la comunidad */
export function EsqueletoFeed() {
  return (
    <div aria-hidden="true">
      <Bloque h={38} w="45%" style={{ marginBottom: 18 }} />
      <Bloque h={46} r="var(--radius-sm)" style={{ marginBottom: 16 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="feed-item">
            <Bloque w={38} h={38} r="50%" />
            <div style={{ flex: 1 }}>
              <Bloque h={14} w={`${55 + (i % 3) * 12}%`} style={{ marginBottom: 6 }} />
              <Bloque h={10} w="32%" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Estadísticas */
export function EsqueletoStats() {
  return (
    <div aria-hidden="true">
      <Bloque h={40} w="38%" style={{ marginBottom: 20 }} />
      <div className="perfil-cifras">
        {Array.from({ length: 6 }, (_, i) => <Bloque key={i} h={78} r="var(--radius-sm)" />)}
      </div>
      <Bloque h={210} r="var(--radius)" style={{ marginBottom: 16 }} />
      <div className="rankings-grid">
        <Bloque h={330} r="var(--radius)" />
        <Bloque h={330} r="var(--radius)" />
      </div>
    </div>
  );
}

/** Esqueleto genérico según la ruta, para el Suspense de las rutas */
export function EsqueletoRuta({ ruta = "" }) {
  if (ruta.startsWith("/u/") || ruta.startsWith("/perfil")) return <EsqueletoPerfil />;
  if (ruta.startsWith("/comunidad"))    return <EsqueletoFeed />;
  if (ruta.startsWith("/estadisticas")) return <EsqueletoStats />;
  if (ruta.startsWith("/lista/"))       return <EsqueletoCatalogo n={6} />;
  return <EsqueletoCatalogo />;
}
