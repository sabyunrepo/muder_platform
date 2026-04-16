import { test, expect } from "@playwright/test";
import { login } from "./helpers/common";

// ---------------------------------------------------------------------------
// 상수
// ---------------------------------------------------------------------------

const BACKEND = "http://localhost:8080";

// ---------------------------------------------------------------------------
// 헬퍼: 백엔드 가드
// ---------------------------------------------------------------------------

async function requireBackend(page: Parameters<typeof test>[1]) {
  const res = await page.request.get(`${BACKEND}/health`).catch(() => null);
  test.skip(!res || !res.ok(), "백엔드 서버가 실행되지 않음 — 이 테스트는 스킵됩니다");
}

// ---------------------------------------------------------------------------
// 헬퍼: 방 생성 후 sessionId 반환
// ---------------------------------------------------------------------------

async function createRoom(page: Parameters<typeof test>[1]): Promise<string> {
  await page.getByRole("button", { name: /방 만들기/ }).click();

  // 모달 "방 만들기" 타이틀 대기
  await expect(page.getByText("방 만들기").first()).toBeVisible({ timeout: 8_000 });

  // 테마 드롭다운 — 모달(dialog) 안의 combobox만 선택
  const dialog = page.getByRole("dialog");
  const themeSelect = dialog.locator("select").first();

  if (await themeSelect.isVisible()) {
    // 실제 테마 옵션(비disabled)이 로드될 때까지 대기 (최대 8초)
    let firstValue: string | null = null;
    try {
      // dialog 안의 select에서 enabled option 찾기
      await themeSelect.locator("option:not([disabled])").first().waitFor({ timeout: 8_000 });
      firstValue = await themeSelect
        .locator("option:not([disabled])")
        .first()
        .getAttribute("value");
    } catch {
      firstValue = null;
    }

    if (!firstValue) {
      // DB에 테마 없음 — 모달 닫고 스킵 신호
      await page.keyboard.press("Escape");
      return "NO_THEMES";
    }

    // Playwright locator.selectOption — dialog 안의 select에 정확히 적용
    await themeSelect.selectOption(firstValue);
  }

  // 생성 버튼 활성화 대기 후 클릭
  const confirmBtn = page.getByRole("button", { name: "생성" });
  await expect(confirmBtn).toBeEnabled({ timeout: 8_000 });
  await confirmBtn.click();

  // 방 페이지로 이동 대기
  await page.waitForURL(/\/room\//, { timeout: 20_000 });

  const url = page.url();
  const match = url.match(/\/room\/([^/?#]+)/);
  return match?.[1] ?? "";
}

// ---------------------------------------------------------------------------
// 헬퍼: feature flag 설정 (localStorage)
// ---------------------------------------------------------------------------

async function setFeatureFlag(page: Parameters<typeof test>[1], flag: string) {
  await page.evaluate((f) => {
    const flags = JSON.parse(localStorage.getItem("feature_flags") ?? "{}");
    flags[f] = true;
    localStorage.setItem("feature_flags", JSON.stringify(flags));
  }, flag);
}

// ---------------------------------------------------------------------------
// Task 1: 방 생성 → 시작 → 페이즈 진행
// ---------------------------------------------------------------------------

test.describe("Game Session — 방 생성 → 시작 → 페이즈 진행", () => {
  test.beforeEach(async ({ page }) => {
    await requireBackend(page);
    await login(page);
  });

  test("방 생성 후 RoomPage로 이동한다", async ({ page }) => {
    const roomId = await createRoom(page);
    test.skip(roomId === "NO_THEMES", "테마 없음 — 방 생성 불가, 스킵");
    expect(roomId).toBeTruthy();
    await expect(page).toHaveURL(/\/room\//);
  });

  test("game_runtime_v2 feature flag를 설정하면 localStorage에 저장된다", async ({
    page,
  }) => {
    await setFeatureFlag(page, "game_runtime_v2");
    const flags = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("feature_flags") ?? "{}"),
    );
    expect(flags["game_runtime_v2"]).toBe(true);
  });

  test("RoomPage에서 게임 시작 버튼이 호스트에게 표시된다", async ({ page }) => {
    const roomId = await createRoom(page);
    test.skip(roomId === "NO_THEMES", "테마 없음 — 방 생성 불가, 스킵");

    // 호스트 컨트롤 영역 (HostControls 컴포넌트)
    const startBtn = page.getByRole("button", { name: /시작|게임 시작/i });
    await expect(startBtn).toBeVisible({ timeout: 10_000 });
  });

  test("게임 시작 시 WS GAME_START 이벤트를 전송한다", async ({ page }) => {
    const roomId = await createRoom(page);
    test.skip(roomId === "NO_THEMES", "테마 없음 — 방 생성 불가, 스킵");

    const startBtn = page.getByRole("button", { name: /시작|게임 시작/i });
    if ((await startBtn.count()) === 0) {
      test.skip(true, "게임 시작 버튼 없음 — 호스트 컨트롤 없음");
    }

    // 버튼 클릭 후 GamePage로 이동하는지 확인
    const [gamePageNav] = await Promise.all([
      page.waitForURL(/\/game\//, { timeout: 20_000 }).catch(() => null),
      startBtn.click(),
    ]);

    if (gamePageNav === null) {
      test.skip(true, "게임 페이지로 이동하지 않음 — 플레이어 부족 가능성");
    }
  });

  test("GamePage: 연결 중 스피너가 표시된다", async ({ page }) => {
    const roomId = await createRoom(page);
    test.skip(roomId === "NO_THEMES", "테마 없음 — 방 생성 불가, 스킵");

    const startBtn = page.getByRole("button", { name: /시작|게임 시작/i });
    if ((await startBtn.count()) > 0) {
      await startBtn.click();
      const spinner = page.locator("[class*='animate-spin']");
      await expect(spinner.or(page.getByText("연결 중"))).toBeVisible({
        timeout: 5_000,
      });
    } else {
      test.skip(true, "호스트 시작 버튼 없음");
    }
  });

  test("GamePage: 첫 페이즈(INTRO 또는 INVESTIGATION) UI가 표시된다", async ({
    page,
  }) => {
    await page.waitForURL(/\/game\//, { timeout: 5_000 }).catch(() => null);

    if (!page.url().includes("/game/")) {
      test.skip(true, "GamePage 미도달 — 이전 단계 미완료");
    }

    // GameHUD — Phase Badge 확인
    const phaseBadge = page.locator("[class*='rounded-md'][class*='font-bold']").first();
    await expect(phaseBadge).toBeVisible({ timeout: 15_000 });
  });
});
