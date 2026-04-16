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
    },
  },
});
