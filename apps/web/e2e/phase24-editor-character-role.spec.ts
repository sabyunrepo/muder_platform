import { expect, test } from "@playwright/test";
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
    await expect(page.getByRole("button", { name: "배정" })).toBeVisible();
    await page.getByRole("button", { name: "배정" }).click();

    await page.getByRole("button", { name: /탐정 A/ }).click();

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
  });
});
