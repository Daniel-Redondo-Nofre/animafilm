// public/sw-cleanup.js
// AnimaFilm ya no es PWA. Este script limpia el service worker y las
// cachés que quedaron instalados en los navegadores que visitaron la
// versión anterior. Sin esto seguirían sirviendo ficheros viejos.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then(function (regs) { regs.forEach(function (r) { r.unregister(); }); })
    .catch(function () {});
}
if (window.caches && caches.keys) {
  caches.keys()
    .then(function (keys) { keys.forEach(function (k) { caches.delete(k); }); })
    .catch(function () {});
}
