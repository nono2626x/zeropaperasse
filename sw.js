/* ZéroPaperasse — service worker : l'app fonctionne hors ligne après 1re ouverture */
"use strict";
const CACHE = "zp-v5";
const FICHIERS = [
  "./", "./index.html", "./style.css", "./app.js", "./store.js",
  "./pdf.js", "./facturepdf.js", "./relances.js", "./manifest.webmanifest",
  "./icons/icon-192.png", "./icons/icon-512.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  // requêtes hors origine : toujours réseau, jamais cachées
  if (!e.request.url.startsWith(self.location.origin)) return;
  // réseau d'abord (mises à jour immédiates), cache en secours (hors ligne)
  e.respondWith(
    fetch(e.request).then(rep => {
      const copie = rep.clone();
      caches.open(CACHE).then(c => c.put(e.request, copie)).catch(() => {});
      return rep;
    }).catch(() =>
      caches.match(e.request, { ignoreSearch: true })
        .then(hit => hit || caches.match("./index.html"))
    )
  );
});
