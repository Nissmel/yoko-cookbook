/**
 * PWA / Service Worker registration with Lovable-safe guards.
 *
 * Service workers MUST NOT register inside:
 *   - the Lovable preview iframe (breaks HMR + caches stale builds)
 *   - any preview host (id-preview-*.lovable.app, *.lovableproject.com)
 *
 * They only register on the published domain, in a real browser tab.
 */

const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const host = typeof window !== "undefined" ? window.location.hostname : "";
const isPreviewHost =
  host.includes("id-preview--") ||
  host.includes("lovableproject.com") ||
  host === "localhost" ||
  host === "127.0.0.1";

// Bump this whenever you need to force-evict stale service workers / caches
// on already-installed clients (e.g. users stuck on an old build whose SW
// keeps serving stale HTML). Anything other than the currently-stored value
// triggers a full unregister + caches.delete() sweep on next load.
const SW_KILL_SWITCH_VERSION = "2026-04-23-1";

async function nukeServiceWorkersAndCaches() {
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
  } catch {
    /* noop */
  }
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* noop */
  }
}

export async function setupPWA() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  if (isInIframe || isPreviewHost) {
    // Defensive cleanup: if a SW was ever registered here in the past, kill it.
    await nukeServiceWorkersAndCaches();
    return;
  }

  // Kill switch: if the stored version doesn't match, wipe SWs + caches and
  // force a one-time hard reload so the user gets the latest bundle. This
  // unblocks users stuck on a stale install (common on Firefox / iOS where
  // the user can't easily clear site data).
  try {
    const stored = localStorage.getItem("sw-kill-switch");
    if (stored !== SW_KILL_SWITCH_VERSION) {
      await nukeServiceWorkersAndCaches();
      localStorage.setItem("sw-kill-switch", SW_KILL_SWITCH_VERSION);
      // Only reload if there actually was a SW controlling this page,
      // otherwise we'd reload on every fresh visit.
      if (navigator.serviceWorker.controller) {
        window.location.reload();
        return;
      }
    }
  } catch {
    /* noop */
  }

  try {
    const [{ registerSW }, { toast }] = await Promise.all([
      import("virtual:pwa-register"),
      import("sonner"),
    ]);

    const updateSW = registerSW({
      immediate: true,
      onRegisteredSW(swUrl, registration) {
        // eslint-disable-next-line no-console
        console.log("[PWA] Service worker registered:", swUrl);
        // Poll for updates every 60s so long-running tabs notice new builds.
        if (registration) {
          setInterval(() => {
            registration.update().catch(() => {});
          }, 60 * 1000);
        }
      },
      onNeedRefresh() {
        // New SW waiting. With skipWaiting + clientsClaim it takes over
        // automatically, but we still nudge the user to reload so React state
        // matches the new bundle.
        toast("Dostępna nowa wersja", {
          description: "Odśwież, aby zobaczyć najnowsze zmiany.",
          duration: Infinity,
          action: {
            label: "Odśwież",
            onClick: () => updateSW(true),
          },
        });
      },
      onOfflineReady() {
        // eslint-disable-next-line no-console
        console.log("[PWA] App ready to work offline");
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[PWA] Registration skipped:", err);
  }
}
