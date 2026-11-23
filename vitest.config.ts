import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["src/test/e2e/**", "node_modules/**"],
    // Default is node_modules/.vitest-cache, which `next dev` (Turbopack) watches:
    // every test run made it wait for the filesystem to settle. .next/ is the dev
    // server's own output dir, so writes there are not treated as source changes.
    // Invalidation is unaffected (Vitest keys the cache on the lockfile).
    fsModuleCachePath: ".next/cache/vitest",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["src/test/**", "**/*.d.ts", "**/*.config.*"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
