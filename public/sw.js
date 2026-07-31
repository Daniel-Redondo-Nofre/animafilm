// public/sw.js — AnimaFilm Service Worker
const CACHE = "animafilm-v3";

const PRECACHE = [
  "/",
  "/index.html",
  "https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@400;600;700;800;900&display=swap",
];

// Instalar: precache assets estáticos
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE))
  );
  self.skipWaiting();
});

// Activar: limpiar caches viejos
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first para API, cache-first para assets
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Supabase y TMDB siempre desde la red
  if (url.hostname.includes("supabase.co") || url.hostname.includes("themoviedb.org")) {
    e.respondWith(fetch(e.request).catch(() => new Response("Offline", { status: 503 })));
    return;
  }

  // Google Fonts: cache-first
  if (url.hostname.includes("fonts.g")) {
    e.respondWith(
      caches.match(e.request).then((cached) =>
        cached || fetch(e.request).then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
          return res;
        })
      )
    );
    return;
  }

  // Assets estáticos: stale-while-revalidate
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fresh = fetch(e.request).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      });
      return cached || fresh;
    })
  );
});
