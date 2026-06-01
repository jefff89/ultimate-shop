// Origin allowlist for state-changing requests. Defends against CSRF from
// cross-site forms. Pair with SameSite=Strict cookies on the backend.
//
// PUBLIC_URL lists comma-separated allowed origins (e.g. https://shop.example.com,https://www.shop.example.com).
// Falls back to http://localhost:3001 for local dev.

const allowedOrigins = (
  process.env.PUBLIC_URL ?? 'http://localhost:3001'
)
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

export function isOriginAllowed(request: Request | undefined | null): boolean {
  const origin = request?.headers.get('origin')
  // Same-origin requests (no Origin header on top-level GET / some SSR contexts) are permitted.
  if (!origin) return true
  return allowedOrigins.includes(origin)
}

export function forbiddenOriginResponse(): Response {
  return new Response(JSON.stringify({ error: 'Forbidden origin' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  })
}
