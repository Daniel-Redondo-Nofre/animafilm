// src/lib/theme.jsx
// El tema vive en el DOM (data-theme), no en estado de React.
// Así el cambio es instantáneo y no re-renderiza el árbol.

const BG = { light: "#F3E9C8", dark: "#0B0A14" };

function applyTheme(theme) {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  // IMPORTANTE: el script anti-parpadeo del index.html deja un background
  // inline en <html>. Hay que actualizarlo aquí o el fondo se queda pillado.
  root.style.backgroundColor = BG[theme];
  localStorage.setItem("animafilm_theme", theme);
}

export function initTheme() {
  const saved = localStorage.getItem("animafilm_theme")
    || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  applyTheme(saved);
}

export function toggleTheme() {
  const next = getTheme() === "light" ? "dark" : "light";
  applyTheme(next);
  window.dispatchEvent(new CustomEvent("themechange"));
}

export function getTheme() {
  return document.documentElement.getAttribute("data-theme") || "light";
}