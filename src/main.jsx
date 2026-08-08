// src/main.jsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { initTheme } from "./lib/theme.jsx";
import "./index.css";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

// Aplica el tema ANTES de que React monte nada → sin parpadeo
initTheme();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      {/* Segundo límite, por encima de todo: si falla algo fuera de las
          rutas (la cabecera, un contexto…), tampoco queremos pantalla
          en blanco. */}
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>
);
