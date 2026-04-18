---
name: Playwright E2E 테스트 설정
description: apps/web E2E 테스트 — Playwright + Chromium, 12개 프론트 페이지 테스트, pnpm test:e2e
type: project
originSessionId: b2c1ae4d-dc4a-4f34-bd7e-4301f4fcbcd4
---
Playwright E2E 테스트가 `apps/web/e2e/`에 설정됨 (2026-04-12).

**Why:** 프론트 페이지를 수동 테스트 없이 반복 검증.

**How to apply:**
- 실행: `pnpm test:e2e` (headless), `pnpm test:e2e:headed` (브라우저), `pnpm test:e2e:ui` (디버깅)
- 설정: `apps/web/playwright.config.ts` (포트 3000, dev 서버 자동 시작, reuseExistingServer)
- 테스트: `apps/web/e2e/front-pages.spec.ts` (12건)
  - 로그인 페이지 UI/전환/validation/에러 (4건)
  - 인증 리다이렉트 (2건)
  - 404 페이지 (2건)
  - 로그인→로비 플로우 (4건, 백엔드 없으면 자동 스킵)
- 테스트 계정: `e2e@test.com` / `e2etest1234`
- 의존: `@playwright/test` (devDependencies), Chromium 브라우저 (`npx playwright install chromium`)
- 기존 단위 테스트(Vitest)와 독립: `pnpm test`는 Vitest, `pnpm test:e2e`는 Playwright
