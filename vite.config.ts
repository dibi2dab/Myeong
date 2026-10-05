// `defineConfig` comes from `vitest/config` so the same file can carry both the
// production build options and the test runner options without type conflicts.
import { defineConfig } from "vitest/config";

/**
 * Myeong ships as a purely static site on GitHub Pages.
 *
 * `base: "./"` keeps every asset reference relative, so the exact same build
 * works on a user/org page (`<user>.github.io/myeong`) and on a custom domain
 * without any re-configuration. There is no server, no API and no runtime
 * dependency on Node.js in the browser bundle.
 */
export default defineConfig({
  base: "./",
  build: {
    target: "es2022",
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    // Keep the calculation core readable in the shipped bundle names.
    rollupOptions: {
      output: {
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    reporters: ["default"],
  },
});
