import path from "node:path"

import { defineConfig } from "vitest/config"

/**
 * Vitest rather than Jest: esbuild handles TS and JSX with no transform chain to
 * configure, and nothing here needs a browser.
 *
 * No jsdom or happy-dom either. The tests worth writing in this app are over
 * pure functions — the conflict join, the scorecard arithmetic, the evidence
 * dedupe — where the whole risk is the maths, not the markup. Add an
 * environment when there is a component whose logic cannot be reached any other
 * way.
 */
export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
  },
})
