const CACHE_NAME_STATIC = "storyapp-static-v1.8";
const CACHE_NAME_DYNAMIC = "storyapp-dynamic-v1.8";
const CACHE_NAME_API = "storyapp-api-v1.8";

const CORE_ASSETS = [
  "/",
  "/index.html",
  "/script.js",
  "/style.css",
  "/models/authModel.js",
  "/models/storyModel.js",
  "/views/authView.js",
  "/views/storyView.js",
  "/presenters/authPresenter.js",
  "/presenters/storyPresenter.js",
  "/manifest.json",
  "/assets/img/dicoding.jpg",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
  "/offline.html",
];

self.addEventListener("install", (event) => {
  console.log("[Service Worker] Installing Service Worker...");
  event.waitUntil(
    caches
      .open(CACHE_NAME_STATIC)
      .then((cache) => {
        console.log("[Service Worker] Precaching App Shell...");
        return Promise.all(
          CORE_ASSETS.map((url) => {
            return cache.add(url).catch((error) => {
              console.warn(`[Service Worker] Failed to cache: ${url}`, error);
            });
          })
        );
      })
      .then(() => {
        console.log("[Service Worker] App Shell precached successfully.");
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error("[Service Worker] App Shell precaching failed:", error);
      })
  );
});

self.addEventListener("activate", (event) => {
  console.log("[Service Worker] Activating Service Worker...");
  event.waitUntil(
    caches
      .keys()
      .then((keyList) => {
        return Promise.all(
          keyList.map((key) => {
            if (
              key !== CACHE_NAME_STATIC &&
              key !== CACHE_NAME_DYNAMIC &&
              key !== CACHE_NAME_API
            ) {
              console.log("[Service Worker] Removing old cache:", key);
              return caches.delete(key);
            }
          })
        );
      })
      .then(() => {
        console.log("[Service Worker] Old caches removed.");
        return self.clients.claim();
      })
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.protocol === "chrome-extension:") {
    return;
  }

  if (
    url.origin === "https://story-api.dicoding.dev" &&
    request.url.includes("/v1/stories")
  ) {
    if (request.method === "GET") {
      event.respondWith(
        caches.open(CACHE_NAME_API).then(async (cache) => {
          try {
            const networkResponse = await fetch(request);
            console.log(
              "[Service Worker] Fetching from network (API stories):",
              request.url
            );
            if (networkResponse.ok) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          } catch (error) {
            console.warn(
              "[Service Worker] Network failed for API stories, trying cache:",
              request.url,
              error
            );
            const cachedResponse = await cache.match(request);
            if (cachedResponse) {
              console.log(
                "[Service Worker] Serving from API cache:",
                request.url
              );
              return cachedResponse;
            }
            console.warn(
              "[Service Worker] No cache match for API stories:",
              request.url
            );
            throw error;
          }
        })
      );
      return;
    } else {
      event.respondWith(fetch(request));
      return;
    }
  }

  if (
    url.origin === "https://story-api.dicoding.dev" &&
    (request.url.includes("/v1/login") ||
      request.url.includes("/v1/register") ||
      request.url.includes("/notifications/subscribe"))
  ) {
    event.respondWith(
      fetch(request).catch(() => {
        console.warn(
          "[Service Worker] Network request failed (auth/subscribe) and no cache fallback:",
          request.url
        );
      })
    );
    return;
  }

  if (
    CORE_ASSETS.map(
      (asset) => new URL(asset, self.location.origin).pathname
    ).includes(url.pathname) ||
    url.origin === "https://unpkg.com"
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.ok) {
              if (url.protocol === "http:" || url.protocol === "https:") {
                return caches.open(CACHE_NAME_DYNAMIC).then((cache) => {
                  cache.put(request, networkResponse.clone());
                  return networkResponse;
                });
              }
            }
            return networkResponse;
          })
          .catch((error) => {
            console.warn(
              "[Service Worker] Failed to fetch and cache (static/cdn):",
              request.url,
              error
            );
            if (
              request.destination === "document" &&
              CORE_ASSETS.includes("/offline.html")
            ) {
              return caches.match("/offline.html");
            }
          });
      })
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.ok && request.method === "GET") {
          if (url.protocol === "http:" || url.protocol === "https:") {
            return caches.open(CACHE_NAME_DYNAMIC).then((cache) => {
              cache.put(request, networkResponse.clone());
              return networkResponse;
            });
          }
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          console.warn(
            "[Service Worker] No cache match & network failed (other assets):",
            request.url
          );
          if (
            request.destination === "document" &&
            CORE_ASSETS.includes("/offline.html")
          ) {
            return caches.match("/offline.html");
          }
        });
      })
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.action === "clearApiCache") {
    const cacheNameToClear = event.data.cacheName || CACHE_NAME_API; 
    const urlToDelete = event.data.urlToDelete;

    console.log(
      `[Service Worker] Received message to clear cache: ${cacheNameToClear} for URL: ${urlToDelete}`
    );

    event.waitUntil(
      caches
        .open(cacheNameToClear)
        .then((cache) => {
          if (urlToDelete) {
            return cache.delete(urlToDelete).then((wasDeleted) => {
              if (wasDeleted) {
                console.log(
                  `[Service Worker] Successfully deleted ${urlToDelete} from ${cacheNameToClear}`
                );
              } else {
                console.log(
                  `[Service Worker] URL ${urlToDelete} not found in ${cacheNameToClear}`
                );
              }
            });
          } else {
            console.warn(
              `[Service Worker] No specific URL provided to delete from ${cacheNameToClear}. Implement full cache clear if needed.`
            );
          }
        })
        .catch((error) => {
          console.error(
            `[Service Worker] Error clearing cache ${cacheNameToClear}:`,
            error
          );
        })
    );
  }
});

self.addEventListener("push", function (event) {
  console.log("[Service Worker] Push Received.");

  let pushData = {
    title: "Story App Update",
    options: {
      body: "Sesuatu yang baru telah terjadi!",
      icon: "./assets/icons/icon-96x96.png", // Pastikan path ini benar relatif terhadap root service worker
      badge: "./assets/icons/icon-96x96.png", // Pastikan path ini benar
    },
  };

  if (event.data) {
    try {
      const dataJson = event.data.json();
      console.log("[Service Worker] Push data (JSON):", dataJson);
      pushData.title = dataJson.title || pushData.title;
      if (dataJson.options) {
        pushData.options.body = dataJson.options.body || pushData.options.body;
        pushData.options.icon = dataJson.options.icon || pushData.options.icon;
        pushData.options.badge =
          dataJson.options.badge || pushData.options.badge;
        if (dataJson.options.data) {
          pushData.options.data = dataJson.options.data;
        }
      }
    } catch (e) {
      const dataText = event.data.text();
      console.log("[Service Worker] Push data (Text):", dataText);
      pushData.options.body = dataText || pushData.options.body;
    }
  }

  const title = pushData.title;
  const options = pushData.options;

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
  console.log("[Service Worker] Notification click Received.");
  event.notification.close();

  const urlToOpen =
    event.notification.data && event.notification.data.url
      ? event.notification.data.url
      : "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          if (
            new URL(client.url).pathname ===
              new URL(self.location.origin + urlToOpen).pathname &&
            "focus" in client
          ) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

self.addEventListener("pushsubscriptionchange", function (event) {
  console.log("[Service Worker]: 'pushsubscriptionchange' event fired.");
});
