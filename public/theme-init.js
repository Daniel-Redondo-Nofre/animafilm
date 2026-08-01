// public/theme-init.js
// Se carga en el <head> antes de pintar nada: evita el parpadeo al abrir
// en modo oscuro. Va como fichero externo (y no inline) para que la
// Content-Security-Policy pueda prohibir scripts inline por completo.
(function () {
  try {
    var theme = localStorage.getItem("animafilm_theme")
      || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.backgroundColor = theme === "dark" ? "#0B0A14" : "#F3E9C8";
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "light");
  }
})();

// ── Fuentes sin bloquear el renderizado ───────────────────────────────
// Una <link rel="stylesheet"> normal bloquea el primer pintado hasta que
// llega. El truco: cargarla con media="print" (el navegador la trata como
// no urgente) y cambiarla a "all" cuando termine.
//
// Va aquí y no como atributo onload en el HTML porque nuestra CSP prohíbe
// los manejadores inline; este fichero sí está permitido.
(function () {
  var href = "https://fonts.googleapis.com/css2?family=Bangers&family=Comic+Neue:ital,wght@0,400;0,700;1,700&display=swap";
  var l = document.createElement("link");
  l.rel = "stylesheet";
  l.href = href;
  l.media = "print";
  l.onload = function () { this.media = "all"; this.onload = null; };
  document.head.appendChild(l);
})();
