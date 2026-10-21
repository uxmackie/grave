/**
 * Security headers are applied at the Worker boundary so every dynamic
 * response, including route handlers and RSC payloads, gets the same policy.
 *
 * The CSP starts in report-only mode. Once the reports from the production
 * preview are clean, rename the header to `Content-Security-Policy` and
 * remove this comment.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  "connect-src 'self'",
  "frame-src 'self' https:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join("; ");

function isLocalHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

export function applySecurityHeaders(
  response: Response,
  requestUrl: string,
  production = false,
): Response {
  const headers = new Headers(response.headers);
  const url = new URL(requestUrl);
  const contentType = headers.get("content-type") ?? "";
  const isHtml = contentType.includes("text/html");

  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("X-Permitted-Cross-Domain-Policies", "none");
  headers.set("X-DNS-Prefetch-Control", "off");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  );

  if (production && isHtml) {
    headers.set("Content-Security-Policy-Report-Only", CONTENT_SECURITY_POLICY);
  }

  if (url.protocol === "https:" && !isLocalHost(url.hostname)) {
    headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
