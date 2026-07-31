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
