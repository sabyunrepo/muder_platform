/**
 * Phase 18.8 PR-2 — MSW v2 handler 배럴.
 *
 * Vitest, Playwright(`installMswRoutes`), Storybook이 동일한 handler set을
 * 공유한다. drift 발생 시 서버 응답 struct (`apps/server/internal/domain/**`)
 * 와 비교해 동기화 한다.
 */
import { authHandlers } from "./auth";
import { themeHandlers } from "./theme";
import { roomHandlers } from "./room";
import { clueHandlers } from "./clue";

export * from "./auth";
export * from "./theme";
export * from "./room";
export * from "./clue";

export const handlers = [
  ...authHandlers,
  ...themeHandlers,
  ...roomHandlers,
  ...clueHandlers,
];
