/**
 * Phase 18.8 PR-2 — MSW Service Worker (browser용).
 *
 * dev-mock 모드(예: VITE_USE_MSW=1)나 Storybook에서 활성화한다. 운영
 * 빌드는 호출하지 않는다.
 *
 * 사용 예:
 *   if (import.meta.env.DEV && import.meta.env.VITE_USE_MSW === "1") {
 *     const { worker } = await import("@/mocks/browser");
 *     await worker.start({ onUnhandledRequest: "bypass" });
 *   }
 */
import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export const worker = setupWorker(...handlers);
