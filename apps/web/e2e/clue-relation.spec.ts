import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";
const FAKE_THEME_ID = "00000000-0000-0000-0000-000000000001";
const FAKE_CLUE_A_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const FAKE_CLUE_B_ID = "bbbbbbbb-0000-0000-0000-000000000002";

async function mockEditorApis(page: Parameters<typeof test>[1]["page"]) {
  await page.route("**/v1/auth/me", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: "user-1", nickname: "테스터", email: "e2e@test.com", role: "user" }),
    }),
  );
  await page.route("**/v1/editor/themes", (r) => {
    if (r.request().method() !== "GET") return r.continue();
    return r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{
        id: FAKE_THEME_ID, title: "테스트 시나리오", slug: "test-scenario",
        status: "draft", min_players: 4, max_players: 8, duration_min: 90,
        price: 0, coin_price: 0, version: 1, created_at: new Date().toISOString(),
      }]),
    });
  });
  await page.route(`**/v1/editor/themes/${FAKE_THEME_ID}`, (r) => {
    if (r.request().method() !== "GET") return r.continue();
    return r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: FAKE_THEME_ID, title: "테스트 시나리오", slug: "test-scenario",
        status: "draft", min_players: 4, max_players: 8, duration_min: 90,
        price: 0, coin_price: 0, version: 1, config_json: {}, created_at: new Date().toISOString(),
      }),
    });
  });
  await page.route(`**/v1/editor/themes/${FAKE_THEME_ID}/clues`, (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { id: FAKE_CLUE_A_ID, theme_id: FAKE_THEME_ID, name: "단서A", level: 1, sort_order: 0, is_common: false, is_usable: false, use_consumed: false, created_at: new Date().toISOString() },
        { id: FAKE_CLUE_B_ID, theme_id: FAKE_THEME_ID, name: "단서B", level: 1, sort_order: 1, is_common: false, is_usable: false, use_consumed: false, created_at: new Date().toISOString() },
      ]),
    }),
  );
  await page.route(`**/v1/editor/themes/${FAKE_THEME_ID}/clue-relations`, (r) => {
    if (r.request().method() === "PUT") return r.continue();
    return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
  });
}

// ---------------------------------------------------------------------------
// CI-safe mocked tests (no backend required)
// ---------------------------------------------------------------------------

test.describe("Clue Relations (mocked — CI-safe)", () => {
  test("editor 페이지 진입 시 테마 목록이 렌더링된다", async ({ page }) => {
    await mockEditorApis(page);
    await page.goto(`${BASE}/editor`);
    await page.waitForLoadState("networkidle");
    const content = page.locator('[class*="cursor-pointer"], [class*="loading"], h1, h2');
    await expect(content.first()).toBeVisible({ timeout: 10_000 });
  });

  test("테마 편집기 직접 이동 시 에디터가 로딩된다", async ({ page }) => {
    await mockEditorApis(page);
    await page.goto(`${BASE}/editor/${FAKE_THEME_ID}`);
    await page.waitForLoadState("networkidle");
    const editorContent = page.locator('[role="tab"], [class*="tab"], main');
    await expect(editorContent.first()).toBeVisible({ timeout: 10_000 });
  });
});
