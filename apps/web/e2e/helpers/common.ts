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
const PLAYER_JOIN_TIMEOUT = 10_000;
const PLAYER_JOIN_POLL_INTERVAL = 200;
const NETWORK_IDLE_TIMEOUT = 5_000;

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
 * 호스트 page 의 `request` 컨텍스트로 `/v1/rooms/<roomId>` 를 polling 하여
 * `player_count === expected` 가 될 때까지 대기한다.
 *
 * 게스트가 `goto(/room/<id>)` 만 한 직후에는 join WS 핸드셰이크가 미완료
 * 일 수 있어 GAME_START 가 거부될 수 있다 (race). UI testid 는 아직 없으므로
 * REST API 의 권위 데이터를 polling 하는 것이 가장 신뢰 가능하다.
 */
async function waitForPlayerCount(
  hostPage: Page,
  roomId: string,
  expected: number,
  timeout: number = PLAYER_JOIN_TIMEOUT,
): Promise<void> {
  const deadline = Date.now() + timeout;
  let lastCount = -1;
  while (Date.now() < deadline) {
    const res = await hostPage.request
      .get(`${BASE}/v1/rooms/${roomId}`)
      .catch(() => null);
    if (res && res.ok()) {
      const body = (await res.json().catch(() => null)) as {
        player_count?: number;
      } | null;
      if (body && typeof body.player_count === "number") {
        lastCount = body.player_count;
        if (lastCount >= expected) return;
      }
    }
    await hostPage.waitForTimeout(PLAYER_JOIN_POLL_INTERVAL);
  }
  throw new Error(
    `waitForPlayerCount: room=${roomId} expected=${expected} last=${lastCount} (timeout=${timeout}ms)`,
  );
}

/**
 * n 명짜리 파티를 만들어 호스트 + 게스트 page 들을 반환한다.
 * 각 참가자는 독립 BrowserContext 를 가지며, 호스트가 방을 만든 직후
 * 게스트가 `/room/<roomId>` 로 직접 접근해 join 한다.
 *
 * Fix-loop 1:
 *  - 게스트 context 생성 + login + 방 입장 을 `Promise.all` 로 병렬화
 *  - 마지막에 host 측에서 `player_count === n` 이 될 때까지 polling
 *    → 후속 GAME_START 가 race 로 거부되는 일 없음
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

  // 게스트들을 병렬로 생성 + join — 직렬 for 루프 대비 성능/시간 모두 개선.
  const guestCount = n - 1;
  const guests: PartyResult["guests"] = await Promise.all(
    Array.from({ length: guestCount }, async () => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await login(page, DEFAULT_EMAIL, DEFAULT_PASSWORD);
      await page.goto(`${BASE}/room/${roomId}`);
      return { context: ctx, page };
    }),
  );

  // 호스트에서 권위 데이터(REST) polling — race 없이 join 완료 보장.
  if (n > 1) {
    await waitForPlayerCount(hostPage, roomId, n);
  }

  return { host: { context: hostContext, page: hostPage }, guests, roomId };
}

/**
 * 모든 page 가 `/game/...` URL 에 도달할 때까지 대기한다.
 *
 * Fix-loop 1: 동일 timeout 으로 3 번 retry 하던 패턴을 제거. retry 가
 * flaky 를 마스킹할 뿐 root cause 를 가리지 못했다. 단일 `Promise.all`
 * 로 navigation 을 기다린 뒤 `networkidle` 로 실 동기화 신호를 잡는다.
 */
export async function waitForGamePage(
  pages: Page[],
  timeout: number = SYNC_TIMEOUT,
): Promise<void> {
  await Promise.all(
    pages.map((p) => p.waitForURL(/\/game\//, { timeout })),
  );
  await Promise.all(
    pages.map((p) =>
      p.waitForLoadState("networkidle", { timeout: NETWORK_IDLE_TIMEOUT }),
    ),
  );
}
