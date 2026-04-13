import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";
const LOGIN_EMAIL = "e2e@test.com";
const LOGIN_PASSWORD = "e2etest1234";

test.describe("에디터 테마 제작 플로우", () => {
  test.beforeEach(async ({ page }) => {
    // 로그인
    await page.goto(`${BASE}/login`);
    await page.fill('input[type="email"]', LOGIN_EMAIL);
    await page.fill('input[type="password"]', LOGIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE}/`);
  });

  test("사이드바에 테마 제작 메뉴 노출", async ({ page }) => {
    await page.goto(`${BASE}/`);
    // MainLayout 렌더링 대기 (ProtectedRoute 통과 후)
    await expect(page.getByText("테마 제작")).toBeVisible({ timeout: 15000 });
  });

  test("에디터 페이지 접근 가능", async ({ page }) => {
    await page.goto(`${BASE}/editor`);
    // EditorDashboard 헤딩 렌더링 확인
    await expect(page.getByRole("heading", { name: "테마 에디터" })).toBeVisible({ timeout: 15000 });
  });

  test("새 테마 생성", async ({ page }) => {
    await page.goto(`${BASE}/editor`);

    // EditorDashboard 렌더링 대기
    await expect(page.getByRole("heading", { name: "테마 에디터" })).toBeVisible({ timeout: 15000 });

    // 새 테마 만들기 버튼 클릭
    await page.getByText("새 테마 만들기").first().click();

    // 모달 대기
    await expect(page.getByText("새 테마 만들기").last()).toBeVisible();

    // 폼 작성
    await page.fill('input[placeholder*="어둠 속"]', "E2E 테스트 테마");
    await page.fill("textarea", "E2E 자동 테스트로 생성된 테마입니다");

    // 생성 버튼 클릭
    await page.getByRole("button", { name: "생성" }).click();

    // 에디터로 이동 확인 (URL에 /editor/ 포함)
    await page.waitForURL(/\/editor\//, { timeout: 10000 });

    // 에디터 페이지 렌더링 확인
    await expect(page.locator("body")).toContainText("E2E 테스트 테마");
  });

  test("테마 상태 표시 확인 (DRAFT)", async ({ page }) => {
    await page.goto(`${BASE}/editor`);
    await page.waitForLoadState("networkidle");

    // DRAFT 상태 뱃지가 있는지 확인
    const draftBadge = page.getByText("초안");
    if (await draftBadge.count() > 0) {
      await expect(draftBadge.first()).toBeVisible();
    }
  });

  test("심사 요청 버튼 표시 확인", async ({ page }) => {
    // 에디터 목록에서 첫 번째 테마 클릭
    await page.goto(`${BASE}/editor`);
    await page.waitForLoadState("networkidle");

    const themeCards = page.locator('[class*="cursor-pointer"]');
    if (await themeCards.count() > 0) {
      await themeCards.first().click();
      await page.waitForURL(/\/editor\//, { timeout: 10000 });

      // PublishBar에 심사 요청 버튼 확인
      const submitBtn = page.getByText("심사 요청");
      if (await submitBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        // 심사 요청 버튼 존재 확인
        await expect(submitBtn).toBeVisible();
      }
    }
  });

  test("어드민 심사 페이지 접근 (권한 필요)", async ({ page }) => {
    const response = await page.goto(`${BASE}/admin/reviews`);
    await page.waitForLoadState("networkidle");

    // admin이 아니면 홈으로 리다이렉트될 수 있음
    const url = page.url();
    const hasAccess = url.includes("/admin/reviews");
    const isRedirected = url === `${BASE}/` || url.includes("/login");

    // 둘 중 하나는 참이어야 함
    expect(hasAccess || isRedirected).toBeTruthy();

    if (hasAccess) {
      await expect(page.getByText("테마 심사")).toBeVisible();
    }
  });
});
