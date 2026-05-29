import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    // globals:true enables describe/it/expect without explicit imports under Vitest.
    // Tests also explicitly import from "vitest" for IDE support — both work.
    globals: true,
    environment: "jsdom",
    include: ["src/**/*.{test,spec}.ts"],
    exclude: ["node_modules", "dist"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      // Baseline threshold — raise incrementally as coverage grows.
      thresholds: {
        statements: 50,
      },
    },
  },
  resolve: {
    alias: {
      $src: path.resolve(__dirname, "src"),
    },
  },
});
