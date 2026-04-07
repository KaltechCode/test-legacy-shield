// Allowed origins for CORS
export const ALLOWED_ORIGINS = [
  "https://legacy-shield-suite.lovable.app",
  "https://kbklegacyshield.com",
  "https://www.kbklegacyshield.com",
  // Localhost for local development
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
];

// Check if origin matches Lovable preview pattern
export const isAllowedPreviewOrigin = (origin: string): boolean => {
  // Match Lovable preview domains with various formats:
  // - https://id-preview--{uuid}.lovable.app (preview builds)
  // - https://{project-name}--{uuid}.lovable.app (other preview patterns)
  // - https://{uuid}.lovableproject.com (new preview format)
  return /^https:\/\/[a-z0-9-]+--[a-z0-9-]+\.lovable\.app$/.test(origin) ||
    /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/.test(origin);
};

// Get CORS headers based on request origin
export const getCorsHeaders = (origin: string | null): Record<string, string> => {
  const allowedOrigin = origin && (ALLOWED_ORIGINS.includes(origin) || isAllowedPreviewOrigin(origin))
    ? origin
    : ALLOWED_ORIGINS[0];
  
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
};
