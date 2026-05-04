import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";
import {
  BASE,
  THEME_ID,
  FLOW_NODE_ID,
  freshState,
  mockCommonApis,
  loginAsE2EUser,
  type MockState,
} from "./helpers/editor-golden-path-fixtures";

test.describe("Phase 24 페이즈/결말 entity smoke", () => {
  let state: MockState;

  test.beforeEach(async ({ page }) => {
    state = freshState();
    state.conflictCountdown = 0;
    state.configJson = {
      ...state.configJson,
      modules: {
        ending_branch: {
          enabled: true,
          config: {
            questions: [
              { id: "q1", text: "범인은 누구인가?", type: "single", choices: ["하윤", "민재"], respondents: "all", impact: "branch" },
            ],
            matrix: [
              { priority: 1, ending: FLOW_NODE_ID, condition: { in: ["하윤", { var: "answers.q1.choices" }] } },
            ],
            defaultEnding: FLOW_NODE_ID,
          },
        },
      },
    };
    await mockCommonApis(page, state);
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
                type: "ending",
                data: {
                  label: "진실",
                  icon: "🎭",
                  color: "amber",
                  description: "사건의 전말",
                  endingContent: "범인은 밝혀졌다.",
                },
                position_x: 320,
                position_y: 200,
                created_at: "2026-05-03T00:00:00Z",
                updated_at: "2026-05-03T00:00:00Z",
              },
            ],
            edges: [
              {
                id: "edge-ending-1",
                theme_id: THEME_ID,
                source_id: "phase-final",
                target_id: FLOW_NODE_ID,
                condition: null,
                label: "기본",
                sort_order: 0,
                created_at: "2026-05-03T00:00:00Z",
              },
            ],
          }),
        });
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ nodes: [], edges: [] }) });
    });
    await loginAsE2EUser(page);
  });

  test("페이즈 흐름 안내와 결말 목록을 볼 수 있다", async ({ page }) => {
    await page.goto(`${BASE}/editor/${THEME_ID}/flow`);

    await expect(page.getByText("페이즈 흐름")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/페이즈는 게임 진행 순서를 화살표로 연결합니다/)).toBeVisible();

    await page.getByRole("button", { name: /결말/ }).click();

    await expect(page.getByRole("heading", { name: "결말 목록" })).toBeVisible();
    await expect(page.getByLabel("결말 판정 준비")).toBeVisible();
    await expect(page.getByLabel("결말 판정 준비").getByText("본문 작성", { exact: true })).toBeVisible();
    await expect(page.getByText("진실").first()).toBeVisible();
    await expect(page.getByLabel("결말 이름")).toHaveValue("진실");
    await expect(page.getByLabel("결말 본문")).toHaveValue("범인은 밝혀졌다.");

    await expect(page.getByRole("heading", { name: "결말 판정 설정" })).toBeVisible();
    await expect(page.getByLabel("질문 1 내용")).toHaveValue("범인은 누구인가?");
    await page.getByLabel("질문 1 내용").fill("진범은 누구인가?");

    const configRequest = page.waitForRequest((request) =>
      request.method() === "PUT" && request.url().includes(`/v1/editor/themes/${THEME_ID}/config`),
    );
    await page.getByRole("button", { name: "판정 설정 저장" }).click();
    const request = await configRequest;
    expect(request.postDataJSON()).toMatchObject({
      version: 1,
      modules: {
        ending_branch: {
          enabled: true,
          config: {
            questions: [expect.objectContaining({ text: "진범은 누구인가?" })],
            defaultEnding: FLOW_NODE_ID,
          },
        },
      },
    });

    const a11y = await new AxeBuilder({ page })
      .include('[data-testid="ending-entity-panel"]')
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(a11y.violations).toEqual([]);
  });
});
