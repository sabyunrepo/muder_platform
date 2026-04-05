import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      "@mmp/ws-client": resolve(__dirname, "../../packages/ws-client/dist/index.js"),
      "@mmp/game-logic": resolve(__dirname, "../../packages/game-logic/dist/index.js"),
    },
  },
  test: {
    environment: "jsdom",
    globals: false,
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
