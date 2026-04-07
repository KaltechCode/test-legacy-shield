import { useEffect, useRef, useCallback, useState } from "react";

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onError?: () => void;
  onExpire?: () => void;
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "error-callback"?: () => void;
          "expired-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
        }
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || "";

// Development warning for missing configuration
if (!TURNSTILE_SITE_KEY && import.meta.env.DEV) {
  console.warn(
    "[TurnstileWidget] VITE_TURNSTILE_SITE_KEY is not configured. " +
    "The Turnstile widget will not render. " +
    "Please set this environment variable with your Cloudflare Turnstile site key."
  );
}

export const TurnstileWidget = ({ onVerify, onError, onExpire }: TurnstileWidgetProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  const handleVerify = useCallback((token: string) => {
    onVerify(token);
  }, [onVerify]);

  const handleError = useCallback(() => {
    onError?.();
  }, [onError]);

  const handleExpire = useCallback(() => {
    onExpire?.();
    onVerify(""); // Clear the token on expiry
  }, [onExpire, onVerify]);

  // Load the Turnstile script
  useEffect(() => {
    if (window.turnstile) {
      setScriptLoaded(true);
      return;
    }

    const existingScript = document.querySelector('script[src*="turnstile"]');
    if (existingScript) {
      existingScript.addEventListener("load", () => setScriptLoaded(true));
      return;
    }

    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    script.async = true;
    script.defer = true;
    script.onload = () => setScriptLoaded(true);
    document.head.appendChild(script);

    return () => {
      // Don't remove the script - it may be needed by other components
    };
  }, []);

  // Render the widget once the script is loaded
  useEffect(() => {
    if (!scriptLoaded || !window.turnstile || !containerRef.current) return;

    // Clear any existing widget
    if (widgetIdRef.current) {
      try {
        window.turnstile.remove(widgetIdRef.current);
      } catch (e) {
        // Ignore errors during cleanup
      }
      widgetIdRef.current = null;
    }

    // Render new widget
    if (TURNSTILE_SITE_KEY) {
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: handleVerify,
        "error-callback": handleError,
        "expired-callback": handleExpire,
        theme: "auto",
      });
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch (e) {
          // Ignore errors during cleanup
        }
        widgetIdRef.current = null;
      }
    };
  }, [scriptLoaded, handleVerify, handleError, handleExpire]);

  if (!TURNSTILE_SITE_KEY) {
    // Show placeholder in development for visibility
    if (import.meta.env.DEV) {
      return (
        <div className="flex justify-center my-4 p-4 border border-dashed border-muted-foreground/50 rounded-md">
          <span className="text-sm text-muted-foreground">
            [Turnstile Widget - Site key not configured]
          </span>
        </div>
      );
    }
    return null;
  }

  return <div ref={containerRef} className="flex justify-center my-4" />;
};

export const resetTurnstile = (widgetId: string) => {
  if (window.turnstile && widgetId) {
    window.turnstile.reset(widgetId);
  }
};
