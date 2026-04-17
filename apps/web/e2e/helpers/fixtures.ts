/**
 * Phase 18.8 PR-2 — Playwright fixtures (opt-in).
 *
 * 기존 spec 영향을 주지 않기 위해 별도 진입점으로 둔다. 사용 측은
 * `import { test, expect } from "./helpers/fixtures";` 로 교체한다.
 *
 * - `authenticatedPage`: login() 자동 수행한 page 주입
 * - `multiPartyContext`: 4-인 파티 생성, teardown 에서 context 정리
 */
// Playwright fixture 콜백의 `use(value)` 는 fixture provide/cleanup 메커니즘이며
// React Hook 이 아니다. ESLint react-hooks/rules-of-hooks 가 이를 오탐하므로
// e2e fixtures 파일 한정으로 비활성화한다 (Phase 18.8 hotfix #1).
/* eslint-disable react-hooks/rules-of-hooks */
import { test as base, expect, type Browser, type Page } from "@playwright/test";
import { createPartyOfN, login, type PartyResult } from "./common";

interface Fixtures {
  authenticatedPage: Page;
  multiPartyContext: PartyResult;
}

export const test = base.extend<Fixtures>({
  authenticatedPage: async ({ page }, use) => {
    await login(page);
    await use(page);
  },
  multiPartyContext: async ({ browser }: { browser: Browser }, use) => {
    const party = await createPartyOfN(browser, 4);
    await use(party);
    await Promise.all([
      party.host.context.close(),
      ...party.guests.map((g) => g.context.close()),
    ]);
  },
});

export { expect };
