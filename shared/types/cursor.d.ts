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
    createdAt: string;
    id: string;
};
/** Stable error type so callers can distinguish a malformed cursor from other failures. */
export declare class InvalidCursorError extends Error {
    constructor(message: string);
}
export declare function encodeCursor(tuple: CursorTuple): string;
/**
 * Decode + VALIDATE (T-01-01). A tampered or garbage cursor is rejected with an
 * InvalidCursorError rather than handed back as a malformed tuple that could flow
 * into a query. The decoded object must have a non-empty string `id` and a
 * non-empty string `createdAt` that parses as a real date.
 */
export declare function decodeCursor(cursor: string): CursorTuple;
