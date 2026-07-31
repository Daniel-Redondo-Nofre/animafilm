// src/lib/useThemeToggle.js
// Hook ultra-ligero: solo actualiza el botón del toggle, nada más.
import { useState, useEffect } from "react";
import { getTheme, toggleTheme } from "./theme.jsx";

export function useThemeToggle() {
  const [theme, setTheme] = useState(getTheme);

  useEffect(() => {
    const handler = () => setTheme(getTheme());
    window.addEventListener("themechange", handler);
    return () => window.removeEventListener("themechange", handler);
  }, []);

  return { theme, toggleTheme };
}
