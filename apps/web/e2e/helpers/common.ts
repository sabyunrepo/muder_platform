/**
 * Phase 18.8 PR-2 — 공용 E2E helper.
 *
 * 7개 spec 에 흩어져 있던 `login()` 의 중복을 통합하고, n-인 파티 생성
 * (multi-context) 헬퍼를 제공한다. fixtures (playwright.config 확장) 가 자동
 * 주입하지만, 직접 호출도 가능하다.
 *
 * 패턴 출처: editor-golden-path-fixtures.ts:268-281 (loginAsE2EUser).
 */
import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";

export const BASE = "http://localhost:3000";
export const DEFAULT_EMAIL = "e2e@test.com";
export const DEFAULT_PASSWORD = "e2etest1234";

const LOBBY_HEADING = "로비";
const CREATE_ROOM_TIMEOUT = 8_000;
const NAV_TIMEOUT = 20_000;
const SYNC_TIMEOUT = 30_000;
const SYNC_RETRY = 3;

/**
 * /login 페이지로 이동해 자격 증명을 제출하고, 로비 도착을 기다린다.
 * 7개 spec 에 흩어져 있던 동일 로직을 통합한 진입점.
 */
export async function login(
  page: Page,
  email: string = DEFAULT_EMAIL,
  password: string = DEFAULT_PASSWORD,
): Promise<void> {
  await page.goto(`${BASE}/login`);
  await page.getByPlaceholder("이메일").fill(email);
  await page.getByPlaceholder("비밀번호").fill(password);
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page.getByRole("heading", { name: LOBBY_HEADING })).toBeVisible({
    timeout: 15_000,
  });
}

/**
 * 로비에서 "방 만들기" 모달을 열어 첫 번째 활성 테마로 방을 생성하고 roomId 를 반환한다.
 * 테마가 하나도 없으면 "NO_THEMES" 를 반환해 호출 측에서 skip 처리한다.
 */
export async function createRoom(page: Page): Promise<string> {
  await page.getByRole("button", { name: /방 만들기/ }).click();
  await expect(page.getByText("방 만들기").first()).toBeVisible({
    timeout: CREATE_ROOM_TIMEOUT,
  });

  const dialog = page.getByRole("dialog");
  const themeSelect = dialog.locator("select").first();
  if (await themeSelect.isVisible()) {
    let firstValue: string | null = null;
    try {
      await themeSelect.locator("option:not([disabled])").first().waitFor({
        timeout: CREATE_ROOM_TIMEOUT,
      });
      firstValue = await themeSelect
        .locator("option:not([disabled])")
        .first()
        .getAttribute("value");
    } catch {
      firstValue = null;
    }
    if (!firstValue) {
      await page.keyboard.press("Escape");
      return "NO_THEMES";
    }
    await themeSelect.selectOption(firstValue);
  }

  const confirmBtn = page.getByRole("button", { name: "생성" });
  await expect(confirmBtn).toBeEnabled({ timeout: CREATE_ROOM_TIMEOUT });
  await confirmBtn.click();
  await page.waitForURL(/\/room\//, { timeout: NAV_TIMEOUT });
  const match = page.url().match(/\/room\/([^/?#]+)/);
  return match?.[1] ?? "";
}

export interface PartyResult {
  host: { context: BrowserContext; page: Page };
  guests: { context: BrowserContext; page: Page }[];
  roomId: string;
}

/**
 * n 명짜리 파티를 만들어 호스트 + 게스트 page 들을 반환한다.
 * 각 참가자는 독립 BrowserContext 를 가지며, 호스트가 방을 만든 직후
 * 게스트가 `/room/<roomId>` 로 직접 접근해 join 한다.
 *
 * 호출자 책임:
 *  - 사용 후 모든 context.close() 호출
 *  - n 은 1~8 사이여야 함 (E2E 테마 max_players=8)
 */
export async function createPartyOfN(
  browser: Browser,
  n: number,
): Promise<PartyResult> {
  if (n < 1 || n > 8) {
    throw new Error(`createPartyOfN: n must be 1..8 (got ${n})`);
  }
  const hostContext = await browser.newContext();
  const hostPage = await hostContext.newPage();
  await login(hostPage);
  const roomId = await createRoom(hostPage);
  if (roomId === "NO_THEMES" || !roomId) {
    return { host: { context: hostContext, page: hostPage }, guests: [], roomId };
  }

  const guests: PartyResult["guests"] = [];
  for (let i = 1; i < n; i++) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await login(page, DEFAULT_EMAIL, DEFAULT_PASSWORD);
    await page.goto(`${BASE}/room/${roomId}`);
    guests.push({ context: ctx, page });
  }
  return { host: { context: hostContext, page: hostPage }, guests, roomId };
}

/**
 * 모든 page 가 `/game/...` URL 에 도달할 때까지 대기한다.
 * SYNC_RETRY 번 retry 하며, 한 번이라도 timeout 이면 throw.
 */
export async function waitForGamePage(
  pages: Page[],
  timeout: number = SYNC_TIMEOUT,
): Promise<void> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < SYNC_RETRY; attempt++) {
    try {
      await Promise.all(
        pages.map((p) => p.waitForURL(/\/game\//, { timeout })),
      );
      return;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error("waitForGamePage: failed after retries");
}
