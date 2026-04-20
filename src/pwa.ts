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

export async function setupPWA() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  if (isInIframe || isPreviewHost) {
    // Defensive cleanup: if a SW was ever registered here in the past, kill it.
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    } catch {
      /* noop */
    }
    return;
  }

  try {
    const { registerSW } = await import("virtual:pwa-register");
    registerSW({
      immediate: true,
      onRegisteredSW(swUrl) {
        // eslint-disable-next-line no-console
        console.log("[PWA] Service worker registered:", swUrl);
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
