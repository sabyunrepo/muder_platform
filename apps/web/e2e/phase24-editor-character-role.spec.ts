import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  BASE,
  THEME_ID,
  freshState,
  loginAsE2EUser,
  mockCommonApis,
  type MockState,
} from "./helpers/editor-golden-path-fixtures";

test.describe("Phase 24 에디터 캐릭터 역할 저장", () => {
  let state: MockState;

  test.beforeEach(async ({ page }) => {
    state = freshState();
    await mockCommonApis(page, state);
    await loginAsE2EUser(page);
  });

  test("실제 에디터 화면에서 캐릭터를 공범으로 변경하면 API에 mystery_role을 저장한다", async ({ page }) => {
    await page.goto(`${BASE}/editor/${THEME_ID}`);

    await page.getByRole("tab", { name: "등장인물" }).click();
    await expect(page.getByRole("button", { name: "제작" })).toBeVisible();

    await page.getByRole("button", { name: "탐정 A 선택" }).click();

    const updateRequestPromise = page.waitForRequest(
      (request) =>
        request.method() === "PUT" &&
        request.url().includes("/v1/editor/characters/char-1"),
    );
    await page.getByRole("button", { name: /공범/ }).click();
    const updateRequest = await updateRequestPromise;

    expect(updateRequest.postDataJSON()).toMatchObject({
      name: "탐정 A",
      is_culprit: false,
      mystery_role: "accomplice",
      sort_order: 0,
    });

    const a11y = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .disableRules(["color-contrast"])
      .analyze();
    expect(a11y.violations).toEqual([]);
  });

  test("실제 에디터 화면에서 이미지 롤지를 추가하고 저장한다", async ({ page }) => {
    await page.route("https://cdn.example/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "image/svg+xml",
        body: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280"><rect width="200" height="280" fill="#111827"/><text x="24" y="48" fill="#f59e0b">Role Page</text></svg>`,
      }),
    );
    await page.goto(`${BASE}/editor/${THEME_ID}`);

    await page.getByRole("tab", { name: "등장인물" }).click();
    await expect(page.getByRole("button", { name: "제작" })).toBeVisible();
    await page.getByRole("button", { name: "탐정 A 선택" }).click();

    await page.getByRole("button", { name: /이미지/ }).click();
    await page.getByRole("textbox", { name: "이미지 페이지 URL" }).fill("https://cdn.example/role-1.svg");
    await page.getByRole("button", { name: "이미지 페이지 추가" }).click();
    await expect(page.getByText("1 / 1페이지")).toBeVisible();

    const roleSheetRequestPromise = page.waitForRequest(
      (request) =>
        request.method() === "PUT" &&
        request.url().includes("/v1/editor/characters/char-1/role-sheet"),
    );
    await page.getByRole("button", { name: "이미지 롤지 저장" }).click();
    const roleSheetRequest = await roleSheetRequestPromise;

    expect(roleSheetRequest.postDataJSON()).toEqual({
      format: "images",
      images: { image_urls: ["https://cdn.example/role-1.svg"] },
    });
    await expect(page.getByText("저장되었습니다.")).toBeVisible();

    const a11y = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .disableRules(["color-contrast"])
      .analyze();
    expect(a11y.violations).toEqual([]);
  });
});
