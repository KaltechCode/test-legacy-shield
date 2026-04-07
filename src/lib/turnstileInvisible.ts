/**
 * Invisible Turnstile execution — generates a token programmatically
 * without rendering any visible widget. Loads the Turnstile script lazily.
 */

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || "";

function loadTurnstileScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.turnstile) {
      resolve();
      return;
    }
    const existing = document.querySelector('script[src*="turnstile"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      if (window.turnstile) resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Turnstile script"));
    document.head.appendChild(script);
  });
}

/**
 * Execute Turnstile invisibly and return a token.
 * Creates a hidden container, renders the widget, resolves on callback, then cleans up.
 */
export async function getInvisibleTurnstileToken(): Promise<string> {
  if (!TURNSTILE_SITE_KEY) {
    console.warn("[Turnstile] No site key configured, skipping verification");
    return "";
  }

  await loadTurnstileScript();

  return new Promise<string>((resolve, reject) => {
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.top = "-9999px";
    container.style.left = "-9999px";
    container.style.visibility = "hidden";
    document.body.appendChild(container);

    let widgetId: string | null = null;

    const cleanup = () => {
      if (widgetId && window.turnstile) {
        try { window.turnstile.remove(widgetId); } catch {}
      }
      container.remove();
    };

    try {
      widgetId = window.turnstile!.render(container, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (token: string) => {
          cleanup();
          resolve(token);
        },
        "error-callback": () => {
          cleanup();
          reject(new Error("Turnstile verification failed"));
        },
        "expired-callback": () => {
          cleanup();
          reject(new Error("Turnstile token expired during verification"));
        },
        theme: "auto",
      });
    } catch (err) {
      cleanup();
      reject(err);
    }
  });
}
