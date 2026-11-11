"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "@/store/ui";

/** Every section of the app. Detail pages use query strings, so one entry covers all items. */
export const APP_ROUTES = [
  "/",
  "/search",
  "/library",
  "/playlists",
  "/playlist",
  "/liked",
  "/recent",
  "/offline",
  "/import",
  "/album",
  "/artist",
  "/collection",
  "/settings",
] as const;

/**
 * Registers the service worker (it caches every page's HTML for offline use)
 * and warms Next.js' client-side navigation data for every section. The
 * service worker caches those responses too, so even sections never opened
 * online can be navigated to offline without a full reload that would stop
 * the music.
 */
export function ServiceWorkerRegistration() {
  const router = useRouter();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production" && !localStorage.getItem("sw-dev")) return;

    let warmed = false;
    const warmNavigationCache = () => {
      if (warmed || !navigator.onLine || !navigator.serviceWorker.controller) return;
      warmed = true;
      for (const route of APP_ROUTES) router.prefetch(route);
    };

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((reg) => {
        reg.addEventListener("updatefound", () => {
          const worker = reg.installing;
          worker?.addEventListener("statechange", () => {
            if (worker.state === "activated" && navigator.serviceWorker.controller) {
              toast("App updated — offline cache refreshed");
            }
          });
        });
        warmNavigationCache();
      })
      .catch((err) => console.warn("Service worker registration failed", err));

    // On the very first visit the page becomes controlled only once the worker activates.
    const onControllerChange = () => warmNavigationCache();
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const onOnline = () => {
      toast("Back online", "success");
      warmNavigationCache();
    };
    const onOffline = () => toast("You're offline — downloaded music still plays");
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [router]);
  return null;
}
