import { defineConfig } from 'vitest/config'
import viteReact from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'url'

// Dedicated Vitest config: the app's vite.config.ts loads the TanStack Start /
// Nitro SSR plugins, which externalize React into a second module instance and
// break client-hook rendering (invalid hook call) under the test runner. Tests
// only need the React plugin, jsdom, the path aliases, and a single deduped
// React copy — so this config is intentionally minimal and does NOT pull in the
// Start/Nitro plugins.
const config = defineConfig({
  plugins: [viteReact()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('../shared', import.meta.url)),
    },
    // Force a single React instance regardless of node_modules symlinking.
    dedupe: ['react', 'react-dom'],
  },
  test: {
    // Default to node for the pure-logic suites (catalog.source.mock,
    // catalog.query); component suites opt into jsdom via a per-file
    // `// @vitest-environment jsdom` docblock.
    environment: 'node',
    globals: false,
    css: false,
  },
})

export default config
