import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// ws-client tests run in node — the WebSocket global is replaced by a
// hand-rolled FakeWebSocket in src/__tests__/fake-websocket.ts so we do
// not need a DOM environment.
export default defineConfig({
  resolve: {
    alias: {
      // Test through the src entry rather than the built dist so a fresh
      // edit lands without `pnpm build` in between.
      "@mmp/shared": resolve(__dirname, "../shared/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    globals: false,
    include: ["src/**/*.test.ts"],
  },
});
