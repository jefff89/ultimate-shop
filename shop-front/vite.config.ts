import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import { fileURLToPath, URL } from 'url'

import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

const isProd = process.env.NODE_ENV === 'production'

// Inline scripts are required by TanStack Start (SSR hydration) and Vite HMR (dev).
// 'unsafe-inline' is the pragmatic trade-off; switch to nonces/strict-dynamic if/when supported.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ')

const securityHeaders: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  // HSTS only takes effect on HTTPS; harmless on HTTP localhost.
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  // Enforce in prod; report-only in dev so it can be tuned without breaking HMR.
  [isProd ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only']: csp,
}

const config = defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('../shared', import.meta.url)),
      // The shared contract (../shared/*.ts) lives outside this Vite root, so its
      // bare `import { z } from 'zod'` can't resolve against shop-front's
      // node_modules during the production build (rollup can't walk up out of
      // root). Pin zod to shop-front's installed copy. This is the build-time
      // half of the Phase 1 "shared/ bare zod import" runtime follow-up; no new
      // dependency is added (zod@4.2.1 is already installed here).
      zod: fileURLToPath(new URL('./node_modules/zod', import.meta.url)),
    },
  },
  plugins: [
    devtools(),
    nitro({
      routeRules: {
        '/**': { headers: securityHeaders },
      },
    }),
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
