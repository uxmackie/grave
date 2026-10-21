type ErrorPayload = {
  message: string;
  stack?: string;
  url: string;
  context?: string;
};

/**
 * Client-side failures go to the Worker log, where Cloudflare's Workers Logs
 * can retain and query them. The endpoint is intentionally provider-agnostic;
 * an external error service can be added without changing error boundaries.
 */
export function reportClientError(error: unknown, context?: string) {
  const normalized = error instanceof Error ? error : new Error(String(error));

  if (process.env.NODE_ENV !== 'production') {
    console.error(normalized);
    return;
  }

  const payload: ErrorPayload = {
    message: normalized.message.slice(0, 1000),
    stack: normalized.stack?.slice(0, 6000),
    url: window.location.href.slice(0, 2000),
    context,
  };

  void fetch('/api/errors', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {
    // Error reporting must never become another user-visible failure.
  });
}
