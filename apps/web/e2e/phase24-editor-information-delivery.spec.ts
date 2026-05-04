import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  BASE,
  THEME_ID,
  FLOW_NODE_ID,
  freshState,
  loginAsE2EUser,
  mockCommonApis,
  type MockState,
} from "./helpers/editor-golden-path-fixtures";

test.describe("Phase 24 페이즈 정보 전달 Frontend Adapter", () => {
  let state: MockState;

  test.beforeEach(async ({ page }) => {
    state = freshState();
    await mockCommonApis(page, state);

    await page.route(`**/v1/editor/themes/${THEME_ID}/characters`, (route) => {
      if (route.request().method() !== "GET") return route.continue();
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "char-1",
            theme_id: THEME_ID,
            name: "탐정 A",
            description: "사건을 추적하는 탐정입니다.",
            image_url: null,
            is_culprit: false,
            mystery_role: "detective",
            sort_order: 0,
            created_at: "2026-05-03T00:00:00Z",
          },
          {
            id: "char-2",
            theme_id: THEME_ID,
            name: "용의자 B",
            description: "저택의 비밀을 알고 있습니다.",
            image_url: null,
            is_culprit: false,
            mystery_role: "suspect",
            sort_order: 1,
            created_at: "2026-05-03T00:00:00Z",
          },
        ]),
      });
    });

    await page.route(`**/v1/editor/themes/${THEME_ID}/reading-sections`, (route) => {
      if (route.request().method() !== "GET") return route.continue();
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "rs-1",
            themeId: THEME_ID,
            name: "비밀 편지",
            bgmMediaId: null,
            lines: [{ Index: 0, Text: "편지의 첫 문장" }],
            sortOrder: 0,
            version: 1,
            createdAt: "2026-05-03T00:00:00Z",
            updatedAt: "2026-05-03T00:00:00Z",
          },
          {
            id: "rs-2",
            themeId: THEME_ID,
            name: "저택 소문",
            bgmMediaId: null,
            lines: [{ Index: 0, Text: "소문" }, { Index: 1, Text: "증언" }],
            sortOrder: 1,
            version: 1,
            createdAt: "2026-05-03T00:00:00Z",
            updatedAt: "2026-05-03T00:00:00Z",
          },
        ]),
      });
    });

    await page.route(`**/v1/editor/themes/${THEME_ID}/flow`, async (route) => {
      if (route.request().method() === "GET") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            nodes: [
              {
                id: FLOW_NODE_ID,
                theme_id: THEME_ID,
                type: "phase",
                data: {
                  label: "1차 조사",
                  phase_type: "investigation",
                  duration: 25,
                  rounds: 3,
                },
                position_x: 240,
                position_y: 180,
                created_at: "2026-05-03T00:00:00Z",
                updated_at: "2026-05-03T00:00:00Z",
              },
            ],
            edges: [],
          }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ nodes: [], edges: [] }),
      });
    });

    await loginAsE2EUser(page);
  });

  test("페이즈 선택 후 캐릭터별 전달 정보를 여러 개 선택해 저장한다", async ({ page }) => {
    await page.goto(`${BASE}/editor/${THEME_ID}/flow`);

    await expect(page.getByText("페이즈 흐름")).toBeVisible({ timeout: 10_000 });
    await page.getByText("1차 조사").click();
    await expect(page.getByText("페이즈 요약")).toBeVisible();
    await expect(page.getByText("수사 · 25분 · 3라운드")).toBeVisible();
    await expect(page.getByText("기본 이동 없음 · 조건 이동 0개")).toBeVisible();
    await expect(page.getByRole("heading", { name: "정보 전달" })).toBeVisible();

    await page.getByRole("button", { name: "캐릭터별 추가" }).click();
    await page.getByRole("searchbox", { name: "캐릭터 검색" }).fill("용의자");
    await page.getByRole("button", { name: /용의자 B/ }).click();

    await page.getByRole("searchbox", { name: "전달 정보 검색" }).fill("비밀");
    await page.getByRole("button", { name: /비밀 편지/ }).click();
    await page.getByRole("searchbox", { name: "전달 정보 검색" }).fill("");
    await page.getByRole("button", { name: /저택 소문/ }).click();

    await expect(page.getByText("용의자 B · 2개 정보")).toBeVisible();

    const patchRequest = page.waitForRequest(
      (request) =>
        request.method() === "PATCH" &&
        request.url().includes(`/v1/editor/themes/${THEME_ID}/flow/nodes/${FLOW_NODE_ID}`),
    );
    await page.waitForTimeout(1700);
    const request = await patchRequest;

    expect(request.postDataJSON()).toMatchObject({
      data: {
        onEnter: [
          {
            type: "DELIVER_INFORMATION",
            params: {
              deliveries: [
                {
                  target: { type: "character", character_id: "char-2" },
                  reading_section_ids: ["rs-1", "rs-2"],
                },
              ],
            },
          },
        ],
      },
    });

    const a11y = await new AxeBuilder({ page })
      .include('[data-testid="flow-workspace"]')
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .disableRules(["color-contrast"])
      .analyze();
    expect(a11y.violations).toEqual([]);
  });
});
