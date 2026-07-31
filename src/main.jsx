// src/main.jsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { initTheme } from "./lib/theme.jsx";
import "./index.css";
import App from "./App.jsx";

// Aplica el tema ANTES de que React monte nada → sin parpadeo
initTheme();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
