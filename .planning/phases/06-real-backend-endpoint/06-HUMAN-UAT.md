---
status: partial
phase: 06-real-backend-endpoint
source: [06-VERIFICATION.md]
started: 2026-06-07T07:52:59Z
updated: 2026-06-07T07:52:59Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. GET /products returns real paginated data
expected: Start dev server, run curl/HTTP client against GET /products — response is a CatalogPage<CatalogProductCard> JSON object with real product rows from the database, not mock data. hasMore is true when more rows exist.
result: [pending]

### 2. GET /products?limit=999 clamps to 48 items
expected: Requesting a limit above MAX_PAGE_SIZE (48) returns at most 48 items in the page, not 999.
result: [pending]

### 3. GET /products with tampered cursor returns HTTP 400
expected: Passing a malformed or corrupted cursor value (e.g. ?cursor=garbage) returns a 400 Bad Request response with an error message.
result: [pending]

### 4. Feed rail endpoints return correctly filtered plain arrays
expected: GET /products/featured, GET /products/trending, GET /products/categories all return plain arrays (no nextCursor/hasMore fields) with the correct data from the database. Categories returns {id, name, slug} objects.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
