// ネットワーク優先のシェルキャッシュ。開発中の更新が古いキャッシュに
// 阻まれないよう、まず必ずネットワークへ行き、オフライン時だけキャッシュを使う。
// キャッシュの中身そのものの仕様を変えたときは、この名前をバージョンアップすること。
const CACHE = "gym-tracker-shell-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(event.request, copy));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
