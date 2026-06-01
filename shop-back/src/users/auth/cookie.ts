import type { CookieOptions } from 'express';

// Shared attributes for the `Authentication` cookie. The SET (login) and CLEAR
// (signout) calls MUST use identical attributes or the browser won't delete the
// cookie, so both go through this single source.
//
// Secure defaults ON in every environment (the token must never travel over
// plaintext HTTP); set COOKIE_SECURE=false only for local http development.
export function authCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    // SameSite mitigates CSRF for this cookie-based auth. The frontend is a
    // same-site SPA, so 'lax' is sufficient and keeps top-level navigation working.
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE !== 'false',
  };
}
