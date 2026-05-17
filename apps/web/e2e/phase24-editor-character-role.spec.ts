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
  test.beforeEach(async ({ page }) => {
    const state: MockState = freshState();
    await mockCommonApis(page, state);
    await loginAsE2EUser(page);
  });

  test("실제 에디터 화면에서 캐릭터를 공범으로 변경하면 API에 mystery_role을 저장한다", async ({ page }) => {
    await page.goto(`${BASE}/editor/${THEME_ID}`);

    await page.getByRole("tab", { name: "등장인물 관리" }).click();
    await expect(page.getByRole("region", { name: "캐릭터 목록" })).toBeVisible();

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

  test("실제 에디터 화면에서 피해자 표시를 저장해도 역할을 유지한다", async ({ page }) => {
    await page.goto(`${BASE}/editor/${THEME_ID}`);

    await page.getByRole("tab", { name: "등장인물 관리" }).click();
    await expect(page.getByRole("region", { name: "캐릭터 목록" })).toBeVisible();
    await page.getByRole("button", { name: "탐정 A 선택" }).click();

    const updateRequestPromise = page.waitForRequest(
      (request) =>
        request.method() === "PUT" &&
        request.url().includes("/v1/editor/characters/char-1"),
    );
    await page.getByLabel("피해자").click();
    const updateRequest = await updateRequestPromise;

    expect(updateRequest.postDataJSON()).toMatchObject({
      name: "탐정 A",
      mystery_role: "detective",
      is_culprit: false,
      is_victim: true,
    });
  });

  test("캐릭터 저장 실패 시 서버 user_message와 오류 ID를 표시하고 내부 detail은 숨긴다", async ({ page }) => {
    await page.route("**/v1/editor/characters/char-1", async (route) => {
      if (route.request().method() !== "PUT") {
        return route.fallback();
      }
      return route.fulfill({
        status: 500,
        contentType: "application/problem+json",
        body: JSON.stringify({
          type: "about:blank",
          title: "Internal Server Error",
          status: 500,
          detail: "pq: relation theme_characters.is_victim does not exist",
          code: "EDITOR_ENTITY_SAVE_FAILED",
          user_message: "캐릭터 저장에 실패했습니다. 입력 내용은 유지됩니다. 잠시 후 다시 시도해주세요.",
          request_id: "req-character-save-1234",
          correlation_id: "req-character-save-1234",
          timestamp: new Date().toISOString(),
          severity: "high",
          retryable: true,
          user_action: "retry_later",
        }),
      });
    });
    await page.goto(`${BASE}/editor/${THEME_ID}`);

    await page.getByRole("tab", { name: "등장인물 관리" }).click();
    await expect(page.getByRole("region", { name: "캐릭터 목록" })).toBeVisible();
    await page.getByRole("button", { name: "탐정 A 선택" }).click();
    await page.getByLabel("피해자").click();

    await expect(
      page.getByText("캐릭터 저장에 실패했습니다. 입력 내용은 유지됩니다. 잠시 후 다시 시도해주세요."),
    ).toBeVisible();
    await expect(page.getByText("오류 ID: req-char")).toBeVisible();
    await expect(page.getByText(/theme_characters\.is_victim|SQLSTATE|relation/)).toHaveCount(0);
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

    await page.getByRole("tab", { name: "등장인물 관리" }).click();
    await expect(page.getByRole("region", { name: "캐릭터 목록" })).toBeVisible();
    await page.getByRole("button", { name: "탐정 A 선택" }).click();

    await page.getByRole("button", { name: /^역할지/ }).click();
    await page
      .getByRole("group", { name: "역할지 형식 선택" })
      .getByRole("button", { name: /이미지/ })
      .click();
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
      images: { image_urls: ["https://cdn.example/role-1.svg"], image_media_ids: [] },
    });
    await expect(page.getByText("저장되었습니다.")).toBeVisible();

    const a11y = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .disableRules(["color-contrast"])
      .analyze();
    expect(a11y.violations).toEqual([]);
  });

  test("역할지 Markdown 이미지 블록은 선택, 문단 삽입, 저장이 가능하다", async ({ page }) => {
    const mediaSnippet =
      '<MediaEmbed mediaId="image-media-1" type="image" align="center" width="medium" />';
    await page.route(`**/v1/editor/themes/${THEME_ID}/media**`, (route) => {
      if (route.request().method() !== "GET") return route.continue();
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "image-media-1",
            theme_id: THEME_ID,
            name: "역할지 이미지",
            type: "IMAGE",
            source_type: "FILE",
            url: "https://mock-storage.example/themes/media/role-image.png",
            duration: null,
            file_size: 12345,
            mime_type: "image/png",
            tags: ["역할지"],
            sort_order: 1,
            created_at: new Date().toISOString(),
          },
        ]),
      });
    });
    await page.route("https://mock-storage.example/themes/media/role-image.png", (route) =>
      route.fulfill({
        status: 200,
        contentType: "image/png",
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lLduGQAAAABJRU5ErkJggg==",
          "base64",
        ),
      }),
    );
    await page.route("**/v1/editor/characters/char-1/role-sheet", async (route) => {
      const method = route.request().method();
      if (method === "GET") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            character_id: "char-1",
            theme_id: THEME_ID,
            format: "markdown",
            markdown: { body: mediaSnippet },
          }),
        });
      }
      return route.fallback();
    });

    await page.goto(`${BASE}/editor/${THEME_ID}`);
    await page.getByRole("tab", { name: "등장인물 관리" }).click();
    await expect(page.getByRole("region", { name: "캐릭터 목록" })).toBeVisible();
    await page.getByRole("button", { name: "탐정 A 선택" }).click();
    await page.getByRole("button", { name: /^역할지/ }).click();

    const block = page.getByRole("group", { name: "역할지 이미지 미디어 블록" });
    await expect(block).toBeVisible();
    await block.focus();
    await expect(block.getByRole("button", { name: "역할지 이미지 위로 이동" })).toBeVisible();
    await expect(block.getByRole("button", { name: "보통" })).toHaveText("");
    await expect(block.getByRole("button", { name: "크게" })).toHaveText("");

    await block.getByRole("button", { name: "미디어 아래에 문단 추가" }).click();

    const roleSheetRequestPromise = page.waitForRequest(
      (request) =>
        request.method() === "PUT" &&
        request.url().includes("/v1/editor/characters/char-1/role-sheet"),
    );
    await page.getByRole("button", { name: "역할지 저장" }).click();
    const roleSheetRequest = await roleSheetRequestPromise;

    const body = roleSheetRequest.postDataJSON();
    expect(body).toMatchObject({ format: "markdown" });
    expect(body.markdown.body).toContain(mediaSnippet);
    expect(body.markdown.body).toContain(`${mediaSnippet}\n\n`);
  });
});
