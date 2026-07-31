// src/lib/supabase.js
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error(
    "Faltan variables de entorno: asegúrate de tener VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en tu .env"
  );
}

console.log("URL Supabase:", JSON.stringify(SUPABASE_URL));
console.log("Key empieza por:", SUPABASE_KEY?.slice(0, 12));

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
