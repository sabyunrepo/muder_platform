// Stubbed 복제본: clue-relation-stubbed.spec.ts (Phase 18.8 PR-4)
// 이 spec은 PLAYWRIGHT_BACKEND 환경에서만 실행. stubbed CI는 복제본으로 검증.
import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";
const LOGIN_EMAIL = "e2e@test.com";
const LOGIN_PASSWORD = "e2etest1234";

// ---------------------------------------------------------------------------
// Live tests — skipped when backend is unavailable
// ---------------------------------------------------------------------------

test.describe("Clue Relations (live)", () => {
  test.beforeEach(async ({ page }) => {
    const res = await page.request
      .get("http://localhost:8080/health")
      .catch(() => null);
    test.skip(
      !res || !res.ok(),
      "백엔드 서버가 실행되지 않음 — 이 테스트는 스킵됩니다",
    );

    await page.goto(`${BASE}/login`);
    await page.getByPlaceholder("이메일").fill(LOGIN_EMAIL);
    await page.getByPlaceholder("비밀번호").fill(LOGIN_PASSWORD);
    await page.getByRole("button", { name: "로그인" }).click();
    await expect(page.getByRole("heading", { name: "로비" })).toBeVisible({ timeout: 15_000 });

    await page.goto(`${BASE}/editor`);
    await page.waitForLoadState("networkidle");
    const themeCard = page.locator('[class*="cursor-pointer"]').first();
    if ((await themeCard.count()) > 0) {
      await themeCard.click();
      await page.waitForURL(/\/editor\//, { timeout: 10_000 });
    }
  });

  test("단서 탭 → 관계 서브탭 이동", async ({ page }) => {
    await page.getByRole("tab", { name: /단서/i }).click();
    await page.getByRole("tab", { name: /관계/i }).click();
    await expect(page.locator(".react-flow")).toBeVisible({ timeout: 10_000 });
  });

  test("단서 노드 표시 확인", async ({ page }) => {
    await page.getByRole("tab", { name: /단서/i }).click();
    await page.getByRole("tab", { name: /관계/i }).click();
    await expect(page.locator(".react-flow")).toBeVisible({ timeout: 10_000 });
    const nodesOrEmpty = page.locator(".react-flow__node, :text('단서를 먼저 추가하세요')");
    await expect(nodesOrEmpty.first()).toBeVisible({ timeout: 10_000 });
  });

  test("관계 엣지 추가 후 서버 저장", async ({ page }) => {
    await page.getByRole("tab", { name: /단서/i }).click();
    await page.getByRole("tab", { name: /관계/i }).click();
    await expect(page.locator(".react-flow")).toBeVisible({ timeout: 10_000 });

    const nodes = page.locator(".react-flow__node");
    if ((await nodes.count()) < 2) test.skip(true, "단서가 2개 미만");

    const [request] = await Promise.all([
      page.waitForRequest(
        (req) => req.url().includes("/clue-relations") && req.method() === "PUT",
        { timeout: 10_000 },
      ),
      (async () => {
        const srcBox = await nodes.first().boundingBox();
        const tgtBox = await nodes.nth(1).boundingBox();
        if (!srcBox || !tgtBox) return;
        await page.mouse.move(srcBox.x + srcBox.width, srcBox.y + srcBox.height / 2);
        await page.mouse.down();
        await page.mouse.move(tgtBox.x, tgtBox.y + tgtBox.height / 2, { steps: 10 });
        await page.mouse.up();
      })(),
    ]);
    expect(request.url()).toContain("/clue-relations");
  });

  test("관계 엣지 삭제 후 서버 반영", async ({ page }) => {
    await page.getByRole("tab", { name: /단서/i }).click();
    await page.getByRole("tab", { name: /관계/i }).click();
    await expect(page.locator(".react-flow")).toBeVisible({ timeout: 10_000 });

    const edges = page.locator(".react-flow__edge");
    if ((await edges.count()) === 0) test.skip(true, "엣지가 없음");

    const [request] = await Promise.all([
      page.waitForRequest(
        (req) => req.url().includes("/clue-relations") && req.method() === "PUT",
        { timeout: 10_000 },
      ),
      (async () => {
        await edges.first().click();
        await page.keyboard.press("Delete");
      })(),
    ]);
    expect(request.url()).toContain("/clue-relations");
  });

  test("cycle 감지 시 에러 토스트", async ({ page }) => {
    await page.getByRole("tab", { name: /단서/i }).click();
    await page.getByRole("tab", { name: /관계/i }).click();
    await expect(page.locator(".react-flow")).toBeVisible({ timeout: 10_000 });

    await page.route("**/clue-relations", (route) => {
      if (route.request().method() === "PUT") {
        route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ code: "CYCLE_DETECTED", message: "cycle" }) });
      } else {
        route.continue();
      }
    });

    const nodes = page.locator(".react-flow__node");
    if ((await nodes.count()) < 2) test.skip(true, "단서가 2개 미만");

    const srcBox = await nodes.first().boundingBox();
    const tgtBox = await nodes.nth(1).boundingBox();
    if (srcBox && tgtBox) {
      await page.mouse.move(srcBox.x + srcBox.width, srcBox.y + srcBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(tgtBox.x, tgtBox.y + tgtBox.height / 2, { steps: 10 });
      await page.mouse.up();
    }
    await expect(page.locator("[data-sonner-toast]")).toContainText("순환 참조", { timeout: 5_000 });
  });
});
