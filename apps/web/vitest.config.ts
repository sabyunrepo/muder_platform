import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      "@mmp/shared": resolve(__dirname, "../../packages/shared/src/index.ts"),
      "@mmp/ws-client": resolve(__dirname, "../../packages/ws-client/dist/index.js"),
      "@mmp/game-logic": resolve(__dirname, "../../packages/game-logic/dist/index.js"),
    },
  },
  test: {
    environment: "jsdom",
    globals: false,
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["json-summary", "json", "html", "text-summary"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/__tests__/**",
        "src/mocks/**",
        "src/**/*.d.ts",
        "src/main.tsx",
        "src/vite-env.d.ts",
      ],
      // Phase 19 Residual PR-5b — Coverage Gate.
      // baseline: Lines 51.75% / Branches 79.66% / Functions 55.66% (2026-04-21)
      // threshold: baseline - 2% buffer to absorb flaky/env variance.
      // 로드맵: Phase 20 → Lines 55% / Branches 80% / Functions 58%
      //         Phase 21 → Lines 65% / Branches 85% / Functions 68%
      thresholds: {
        lines: 49,
        statements: 49,
        branches: 77,
        functions: 53,
      },
    },
  },
});
