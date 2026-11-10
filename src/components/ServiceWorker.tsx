"use client";

import { useEffect } from "react";
import { toast } from "@/store/ui";

/** Registers the service worker that caches the app shell for offline use. */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production" && !localStorage.getItem("sw-dev")) return;
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
      })
      .catch((err) => console.warn("Service worker registration failed", err));

    const onOnline = () => toast("Back online", "success");
    const onOffline = () => toast("You're offline — downloaded music still plays");
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);
  return null;
}
