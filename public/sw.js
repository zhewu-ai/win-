/* PinNote 离线 App Shell 缓存策略
 * - navigate 请求：network-first，失败回退缓存 "/"（离线也能打开 App Shell）
 * - 同源静态资源（.js/.css/字体/图标）：cache-first 并回填
 * - /api/* 永不缓存（只走网络）
 * 首次注册后由页面 postMessage 预热 shell 缓存。 */
const CACHE_NAME = "pinote-shell-v1";
const APP_SHELL = ["/", "/login"];

self.addEventListener("install", (event) => {
  // 不在 install 期 addAll（未登录时 "/" 返回 307 会导致安装失败），
  // 改为由页面 postMessage 预热 + navigate 过程中按需缓存。
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// 预热 shell：页面在 SW 激活后发送该消息
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "CACHE_SHELL") {
    event.waitUntil(
      Promise.all(
        APP_SHELL.map((url) =>
          fetch(url)
            .then((res) => {
              if (res.ok) {
                return caches
                  .open(CACHE_NAME)
                  .then((cache) => cache.put(url, res));
              }
              return null;
            })
            .catch(() => null)
        )
      )
    );
  }
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;
  if (event.request.method !== "GET") return;

  // API 请求永不缓存
  if (url.pathname.startsWith("/api/")) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put("/", copy));
          }
          return res;
        })
        .catch(() =>
          caches
            .match("/")
            .then((r) => r || caches.match("/login"))
        )
    );
    return;
  }

  // 静态资源：cache-first + 回填
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((res) => {
        if (
          res.ok &&
          /\.(js|css|woff2?|png|svg|ico|jpg|jpeg|webp|gif)$/.test(url.pathname)
        ) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return res;
      });
    })
  );
});
