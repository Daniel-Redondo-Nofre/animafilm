// src/components/Avatar.jsx
// Avatar compartido: emoji y color propios si el usuario los eligió,
// y si no, la inicial sobre un color deducido del nombre.

const PALETA = ["#C01200", "#0044BB", "#00742F", "#6030A0", "#C06400", "#B03878", "#1A6E8A", "#7A4F00"];

export const COLORES_AVATAR = PALETA;

export const EMOJIS_AVATAR = [
  "📺","🎬","🍿","⭐","🎭","🕹️","🚀","🦸","🐉","🐝","🧙","🤖",
  "👾","🐱","🐶","🦊","🐼","🦁","🌈","⚡","🔥","🍭","🎸","⚽",
];

export function colorPorNombre(nombre = "") {
  let h = 0;
  for (let i = 0; i < nombre.length; i++) h = (h * 31 + nombre.charCodeAt(i)) >>> 0;
  return PALETA[h % PALETA.length];
}

export default function Avatar({ perfil, username, size = 36, className = "" }) {
  const nombre = perfil?.username ?? username ?? "?";
  const emoji  = perfil?.avatar_emoji;
  const color  = perfil?.avatar_color || colorPorNombre(nombre);

  return (
    <div
      className={`avatar ${className}`}
      style={{
        width: size, height: size,
        background: color,
        // El emoji necesita algo más de tamaño relativo que una letra
        fontSize: emoji ? size * 0.52 : size * 0.42,
      }}
      aria-hidden="true"
    >
      {emoji || nombre[0].toUpperCase()}
    </div>
  );
}
