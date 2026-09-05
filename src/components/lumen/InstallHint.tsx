import { useEffect, useState } from "react";
import { Share, X } from "lucide-react";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "lumen.install.dismissed";

type BipEvent = Event & { prompt: () => Promise<void> };

function isStandalone() {
  if (typeof window === "undefined") return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    nav.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches
  );
}

export function InstallHint({ className }: { className?: string }) {
  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(false);
  const [deferred, setDeferred] = useState<BipEvent | null>(null);

  useEffect(() => {
    if (isStandalone()) return;
    if (window.localStorage.getItem(DISMISS_KEY) === "1") return;
    setIos(/iphone|ipad|ipod/i.test(window.navigator.userAgent));
    setShow(true);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BipEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!show) return null;

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  };

  return (
    <div
      className={cn(
        "animate-[fade-in_180ms_ease-out] relative rounded-xl border border-dashed border-border bg-surface/70 p-3 pr-8",
        className,
      )}
    >
      <button
        onClick={dismiss}
        aria-label="Dismiss install hint"
        className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
      <p className="text-xs font-medium text-foreground">Keep Lumen on your home screen</p>
      {ios ? (
        <p className="mt-1 flex items-center gap-1 text-[11px] leading-relaxed text-muted-foreground">
          Tap <Share className="size-3" /> Share, then “Add to Home Screen”.
        </p>
      ) : deferred ? (
        <button
          onClick={() => {
            void deferred.prompt();
            dismiss();
          }}
          className="mt-2 min-h-[36px] rounded-lg bg-ember px-3 py-1.5 text-xs font-medium text-[oklch(0.99_0.005_85)] transition-opacity hover:opacity-90"
        >
          Install app
        </button>
      ) : (
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          Use your browser menu and choose “Install”.
        </p>
      )}
    </div>
  );
}
