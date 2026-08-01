// scripts/fetch-posters.mjs
//
// Se ejecuta UNA VEZ, en local. Pide los pósters a TMDB y escupe las
// sentencias UPDATE que hay que pegar en el SQL Editor de Supabase.
//
//   node scripts/fetch-posters.mjs > posters.sql
//
// Genera SQL en lugar de escribir directamente en la base de datos para
// que no necesites la service_role key en tu máquina. Tú revisas el
// fichero y lo pegas.

import { readFileSync } from "node:fs";

// ── Lee VITE_TMDB_API_KEY del .env sin dependencias externas ──────────
function readEnv(key) {
  try {
    const raw = readFileSync(new URL("../.env", import.meta.url), "utf8");
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i > 0 && t.slice(0, i).trim() === key) {
        return t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
      }
    }
  } catch { /* sin .env */ }
  return process.env[key];
}

const TMDB_KEY = readEnv("VITE_TMDB_API_KEY");
if (!TMDB_KEY) {
  console.error("Falta VITE_TMDB_API_KEY en el .env");
  process.exit(1);
}

const BASE = "https://api.themoviedb.org/3";
const IMG  = "https://image.tmdb.org/t/p/w342";   // w342: buena calidad, poco peso

// ── Catálogo: id + títulos con los que buscar ─────────────────────────
const SERIES = [
  [1,  "Heidi",                      "Heidi"],
  [2,  "Marco",                      "3000 Leagues in Search of Mother"],
  [3,  "Érase una vez el hombre",    "Once Upon a Time... Man"],
  [4,  "Don Quijote de la Mancha",   "Don Quixote of La Mancha"],
  [5,  "La abeja Maya",              "Maya the Bee"],
  [6,  "Mazinger Z",                 "Mazinger Z"],
  [7,  "Vicky el vikingo",           "Vicky the Viking"],
  [8,  "Los Pitufos",                "The Smurfs"],
  [9,  "David el gnomo",             "The World of David the Gnome"],
  [10, "Oliver y Benji",             "Captain Tsubasa"],
  [11, "Bola de Dragón",             "Dragon Ball"],
  [12, "Inspector Gadget",           "Inspector Gadget"],
  [13, "Doraemon",                   "Doraemon"],
  [14, "Thundercats",                "ThunderCats"],
  [15, "Candy Candy",                "Candy Candy"],
  [16, "Dragon Ball Z",              "Dragon Ball Z"],
  [17, "Sailor Moon",                "Sailor Moon"],
  [18, "Los Caballeros del Zodiaco", "Saint Seiya"],
  [19, "Shin Chan",                  "Crayon Shin-chan"],
  [20, "Pokémon",                    "Pokémon"],
  [21, "Digimon",                    "Digimon Adventure"],
  [22, "Ranma ½",                    "Ranma ½"],
  [23, "Dexter",                     "Dexter's Laboratory"],
  [24, "Cardcaptor Sakura",          "Cardcaptor Sakura"],
  [25, "Bob Esponja",                "SpongeBob SquarePants"],
  [26, "Naruto",                     "Naruto"],
  [27, "Yu-Gi-Oh!",                  "Yu-Gi-Oh! Duel Monsters"],
  [28, "Kim Possible",               "Kim Possible"],
  [29, "Los Lunnis",                 "Los Lunnis"],
  [30, "Inuyasha",                   "InuYasha"],
];

async function search(query, lang) {
  const url = `${BASE}/search/tv?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}&language=${lang}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return data.results?.[0]?.poster_path ?? null;
}

const lines = [];
const fallos = [];

for (const [id, es, en] of SERIES) {
  // Primero en español; si no hay, con el título internacional
  let path = await search(es, "es-ES");
  if (!path && en) path = await search(en, "en-US");

  if (path) {
    lines.push(`update public.series set poster_url = '${IMG}${path}' where id = ${id};  -- ${es}`);
    process.stderr.write(`  ✓ ${es}\n`);
  } else {
    fallos.push(es);
    process.stderr.write(`  ✗ ${es} — sin resultado\n`);
  }
  await new Promise(r => setTimeout(r, 120));   // no saturar la API
}

console.log("-- Pósters obtenidos de TMDB. Pega esto en el SQL Editor de Supabase.");
console.log("-- Generado el " + new Date().toISOString().slice(0, 10) + "\n");
console.log(lines.join("\n"));

process.stderr.write(`\n${lines.length}/${SERIES.length} pósters encontrados\n`);
if (fallos.length) {
  process.stderr.write(`Sin póster: ${fallos.join(", ")}\n`);
  process.stderr.write("Puedes añadirlos a mano desde el Table Editor de Supabase.\n");
}
