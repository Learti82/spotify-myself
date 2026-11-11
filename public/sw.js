/* Cadence service worker: caches the app shell so the app opens and plays
 * downloaded music with no network. Audio itself lives in IndexedDB. */
const VERSION = "v2";
const PAGES = `pages-${VERSION}`;
const ASSETS = `assets-${VERSION}`;
const RSC = `rsc-${VERSION}`;
const ROUTES = [
  "/", "/search", "/library", "/playlists", "/playlist", "/liked", "/recent",
  "/offline", "/import", "/album", "/artist", "/collection", "/settings",
];
const STATIC = ["/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];
const ASSET_RE = /\/_next\/static\/[^"'\s)\\]+/g;

async function cacheAssetsFromHtml(html) {
  const urls = [...new Set(html.match(ASSET_RE) || [])];
  const cache = await caches.open(ASSETS);
  await Promise.all(
    urls.map(async (u) => {
      if (await cache.match(u)) return;
      try {
        const res = await fetch(u);
        if (res.ok) await cache.put(u, res);
      } catch {}
    }),
  );
}

async function cachePage(path, res) {
  if (!res.ok || res.redirected || !(res.headers.get("content-type") || "").includes("text/html")) return;
  const html = await res.clone().text();
  await (await caches.open(PAGES)).put(path, res);
  await cacheAssetsFromHtml(html);
}

function rscKey(pathname, segment) {
  return `${self.location.origin}${pathname}?__sw_rsc=${encodeURIComponent(segment)}`;
}

// Next.js names a route group's segment "!" + base64("(group)"); all pages live in "(main)".
const MAIN_GROUP = `!${btoa("(main)").replace(/=+$/, "")}`;

/**
 * Fetch the client-side navigation data (route tree + page segment) for every
 * section, so in-app navigation works offline even for sections never opened
 * online. Without it, the first offline visit to such a section would fall back
 * to a full page load, which stops the music.
 */
async function precacheNavigationData() {
  const cache = await caches.open(RSC);
  await Promise.all(
    ROUTES.flatMap((route) => {
      const page = route === "/" ? `/${MAIN_GROUP}/__PAGE__` : `/${MAIN_GROUP}${route}/__PAGE__`;
      return ["/_tree", page].map(async (segment) => {
        try {
          const res = await fetch(route, {
            credentials: "same-origin",
            cache: "no-store",
            headers: { RSC: "1", "Next-Router-Prefetch": "1", "Next-Router-Segment-Prefetch": segment },
          });
          if (res.ok && (res.headers.get("content-type") || "").includes("text/x-component")) {
            await cache.put(rscKey(route, segment), res);
          }
        } catch {}
      });
    }),
  );
}

async function precache() {
  const assets = await caches.open(ASSETS);
  await Promise.all(STATIC.map((u) => assets.add(u).catch(() => {})));
  for (const route of ROUTES) {
    try {
      const res = await fetch(route, { credentials: "same-origin", cache: "reload" });
      await cachePage(route, res);
    } catch {}
  }
  await precacheNavigationData();
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([PAGES, ASSETS, RSC]);
      for (const key of await caches.keys()) if (!keep.has(key)) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "precache") event.waitUntil(precache());
});

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms));
}

async function handleNavigation(event) {
  const url = new URL(event.request.url);
  const key = url.pathname;
  try {
    const res = await Promise.race([fetch(event.request), timeout(6000)]);
    event.waitUntil(cachePage(key, res.clone()).catch(() => {}));
    return res;
  } catch {
    const cache = await caches.open(PAGES);
    return (
      (await cache.match(key)) ||
      (await cache.match("/")) ||
      new Response("<h1>Offline</h1><p>Open the app once while online so it can be saved for offline use.</p>", {
        headers: { "content-type": "text/html; charset=utf-8" },
        status: 503,
      })
    );
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname === "/login" || url.pathname === "/sw.js") return;
  if (request.headers.has("range")) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(event));
    return;
  }

  // Immutable, content-hashed build assets: cache-first.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(ASSETS);
        const hit = await cache.match(request, { ignoreSearch: true });
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok) event.waitUntil(cache.put(request, res.clone()));
        return res;
      })(),
    );
    return;
  }

  // RSC (segment) payloads used for client-side navigation. Cached so in-app
  // navigation keeps working offline without a full reload (which would stop the
  // music). Pages are static client components, so payloads don't depend on the
  // query string: key by path + segment.
  if (request.headers.get("RSC") === "1" || url.searchParams.has("_rsc")) {
    const segment = request.headers.get("Next-Router-Segment-Prefetch") || (request.headers.get("Next-Router-Prefetch") ? "prefetch" : "full");
    const key = rscKey(url.pathname, segment);
    event.respondWith(
      (async () => {
        const cache = await caches.open(RSC);
        try {
          const res = await Promise.race([fetch(request), timeout(5000)]);
          if (res.ok && !res.redirected) event.waitUntil(cache.put(key, res.clone()));
          return res;
        } catch {
          return (await cache.match(key)) || Response.error();
        }
      })(),
    );
    return;
  }

  // Other same-origin files (icons, manifest): stale-while-revalidate.
  event.respondWith(
    (async () => {
      const cache = await caches.open(ASSETS);
      const hit = await cache.match(request);
      const network = fetch(request)
        .then((res) => {
          if (res.ok) cache.put(request, res.clone());
          return res;
        })
        .catch(() => hit || Response.error());
      return hit || network;
    })(),
  );
});
