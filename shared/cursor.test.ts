import { describe, expect, it } from 'bun:test'
import { decodeCursor, encodeCursor } from './cursor'

// Run with:  bun test shared/cursor.test.ts   (from the repo root)
// bun's built-in runner resolves `bun:test` natively and needs no extra deps,
// which keeps shared/ dependency-light and runnable without a workspace install.

describe('cursor codec', () => {
  const tuple = {
    createdAt: '2026-06-02T12:34:56.789Z',
    id: '3f1a9c2e-7b4d-4c8a-9e21-0a1b2c3d4e5f',
  }

  it('round-trips a (createdAt, id) tuple losslessly', () => {
    expect(decodeCursor(encodeCursor(tuple))).toEqual(tuple)
  })

  it('produces an opaque string that leaks no plaintext id or ISO timestamp', () => {
    const encoded = encodeCursor(tuple)
    expect(encoded).not.toContain(tuple.id)
    expect(encoded).not.toContain(tuple.createdAt)
  })

  it('emits URL-safe base64url only (no +, /, or = padding)', () => {
    // The cursor rides in a URL query param; standard base64 (`+` `/` `=`) corrupts
    // in transit. Assert the encoding stays within the base64url alphabet.
    expect(encodeCursor(tuple)).toMatch(/^[A-Za-z0-9_-]+$/)
    // A single-character id is the case standard base64 would pad with `==`.
    expect(encodeCursor({ createdAt: tuple.createdAt, id: 'x' })).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('round-trips a single-character id (the standard-base64 padding case)', () => {
    const short = { createdAt: tuple.createdAt, id: 'x' }
    expect(decodeCursor(encodeCursor(short))).toEqual(short)
  })

  it('throws on non-base64 / garbage input', () => {
    expect(() => decodeCursor('!!!not base64 at all!!!')).toThrow()
    expect(() => decodeCursor('')).toThrow()
  })

  it('rejects a valid-base64 payload whose decoded shape is wrong (tamper rejection)', () => {
    // valid base64 of JSON, but missing `id`
    const missingId = btoa(encodeURIComponent(JSON.stringify({ createdAt: tuple.createdAt })))
    expect(() => decodeCursor(missingId)).toThrow()

    // missing `createdAt`
    const missingCreatedAt = btoa(encodeURIComponent(JSON.stringify({ id: tuple.id })))
    expect(() => decodeCursor(missingCreatedAt)).toThrow()

    // wrong types
    const wrongTypes = btoa(encodeURIComponent(JSON.stringify({ createdAt: 123, id: true })))
    expect(() => decodeCursor(wrongTypes)).toThrow()

    // empty strings
    const emptyStrings = btoa(encodeURIComponent(JSON.stringify({ createdAt: '', id: '' })))
    expect(() => decodeCursor(emptyStrings)).toThrow()

    // createdAt not parseable as a date
    const badDate = btoa(encodeURIComponent(JSON.stringify({ createdAt: 'not-a-date', id: tuple.id })))
    expect(() => decodeCursor(badDate)).toThrow()
  })
})
