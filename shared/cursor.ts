/**
 * Opaque keyset-cursor codec (Phase 1, CONT-03 / D-04).
 *
 * A single encode/decode pair over the (createdAt, id) tuple, imported
 * byte-identically by the Phase 2 frontend mock and the Phase 6 real backend so
 * cursor semantics never drift across the mock->real swap.
 *
 * Pure TS — NO zod, NO typeorm, NO node-only APIs — so it compiles and runs
 * under both build toolchains (Bun backend + TanStack Start / Nitro frontend).
 *
 * Portability: uses btoa / atob (available in Bun and the Nitro/edge runtime;
 * Buffer is NOT guaranteed in the FE edge runtime) wrapped with
 * encodeURIComponent / decodeURIComponent for unicode safety.
 *
 * Opacity (T-01-02): the cursor encodes only (createdAt, id) — no table names,
 * offsets, or internal numeric keys — so it leaks no DB internals.
 */

/**
 * The keyset tuple. `createdAt` is stored as an ISO-8601 string for a lossless
 * round-trip and to preserve the (createdAt DESC, id DESC) ordering inputs that
 * the Phase 6 keyset query binds as parameters.
 */
export type CursorTuple = {
  createdAt: string
  id: string
}

/** Stable error type so callers can distinguish a malformed cursor from other failures. */
export class InvalidCursorError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidCursorError'
  }
}

/**
 * base64url (RFC 4648 §5) helpers. The cursor rides verbatim inside the contract's
 * `nextCursor` URL query param, so it MUST be URL-safe. Standard base64 is NOT:
 * `+` is decoded to a space by application/x-www-form-urlencoded query parsers,
 * and `=`/`/` are ambiguous/path-significant — any of which silently corrupts a
 * round-tripped cursor and breaks pagination. Since this codec is imported
 * byte-identically by the mock (Phase 2) and the real backend (Phase 6), the
 * encoding must be URL-safe at the source.
 */
function toBase64Url(s: string): string {
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(s: string): string {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  return atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)
}

export function encodeCursor(tuple: CursorTuple): string {
  const json = JSON.stringify({ createdAt: tuple.createdAt, id: tuple.id })
  return toBase64Url(encodeURIComponent(json))
}

/**
 * Decode + VALIDATE (T-01-01). A tampered or garbage cursor is rejected with an
 * InvalidCursorError rather than handed back as a malformed tuple that could flow
 * into a query. The decoded object must have a non-empty string `id` and a
 * non-empty string `createdAt` that parses as a real date.
 */
export function decodeCursor(cursor: string): CursorTuple {
  if (typeof cursor !== 'string' || cursor.length === 0) {
    throw new InvalidCursorError('cursor must be a non-empty string')
  }

  let json: string
  try {
    json = decodeURIComponent(fromBase64Url(cursor))
  } catch {
    throw new InvalidCursorError('cursor is not valid base64')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new InvalidCursorError('cursor payload is not valid JSON')
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new InvalidCursorError('cursor payload is not an object')
  }

  const { createdAt, id } = parsed as Record<string, unknown>

  if (typeof id !== 'string' || id.length === 0) {
    throw new InvalidCursorError('cursor id must be a non-empty string')
  }
  if (typeof createdAt !== 'string' || createdAt.length === 0) {
    throw new InvalidCursorError('cursor createdAt must be a non-empty string')
  }
  if (Number.isNaN(Date.parse(createdAt))) {
    throw new InvalidCursorError('cursor createdAt is not a parseable date')
  }

  return { createdAt, id }
}
