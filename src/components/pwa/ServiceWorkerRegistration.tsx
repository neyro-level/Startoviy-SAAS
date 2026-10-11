"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration({ enabled, cachePrefix }: { enabled: boolean; cachePrefix: string }) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    if (!enabled) {
      // Remove only this application's prior root worker and shell caches.
      void navigator.serviceWorker.getRegistrations().then((registrations) => Promise.all(
        registrations.filter((registration) => [registration.active, registration.waiting, registration.installing].some((worker) => worker && new URL(worker.scriptURL).origin === location.origin && new URL(worker.scriptURL).pathname === "/sw.js"))
          .map((registration) => registration.unregister()),
      )).then(async () => {
        if (!("caches" in window)) return;
        await Promise.all((await caches.keys()).filter((key) => key.startsWith(cachePrefix)).map((key) => caches.delete(key)));
      }).catch(() => { /* Cleanup is best effort; server endpoints remain closed. */ });
      return;
    }

    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // PWA registration is progressive enhancement; UI must keep working without it.
    });
  }, [enabled, cachePrefix]);

  return null;
}
