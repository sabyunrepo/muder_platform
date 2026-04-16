/**
 * Phase 18.8 PR-2 — MSW Node server (Vitest용).
 *
 * Vitest setup 파일에서 listen / resetHandlers / close 라이프사이클을 연결한다.
 *
 * 사용 예 (vitest setup):
 *   import { server } from "@/mocks/server";
 *   beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
 *   afterEach(() => server.resetHandlers());
 *   afterAll(() => server.close());
 */
import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);
