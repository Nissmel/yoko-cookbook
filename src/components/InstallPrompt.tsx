import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Share, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "pwa-install-dismissed-at";
const DISMISS_DAYS = 7;

function wasRecentlyDismissed() {
  const v = localStorage.getItem(DISMISS_KEY);
  if (!v) return false;
  const ts = Number(v);
  if (!ts) return false;
  return Date.now() - ts < DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS
    (window.navigator as any).standalone === true
  );
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSHint, setShowIOSHint] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone() || wasRecentlyDismissed()) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // iOS Safari never fires beforeinstallprompt - show a manual hint instead
    if (isIOS()) {
      const t = setTimeout(() => {
        setShowIOSHint(true);
        setVisible(true);
      }, 3000);
      return () => {
        clearTimeout(t);
        window.removeEventListener("beforeinstallprompt", handler);
      };
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50 animate-fade-in">
      <div className="bg-card border border-border rounded-2xl shadow-xl p-4 flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Download className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-semibold text-sm text-foreground">
            Install Yoko Cookbook
          </p>
          {showIOSHint ? (
            <p className="text-xs text-muted-foreground font-body mt-0.5 leading-snug">
              Tap <Share className="inline h-3 w-3 mx-0.5" /> Share, then{" "}
              <span className="font-medium">"Add to Home Screen"</span>.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground font-body mt-0.5">
              Add to your home screen for a faster, full-screen experience.
            </p>
          )}
          {deferredPrompt && (
            <Button size="sm" onClick={install} className="mt-2 h-8 gap-1.5">
              <Download className="h-3.5 w-3.5" /> Install
            </Button>
          )}
        </div>
        <button
          onClick={dismiss}
          className="text-muted-foreground hover:text-foreground p-1 -m-1 shrink-0"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
