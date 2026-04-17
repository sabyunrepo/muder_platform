/**
 * Phase 18.8 PR-4 — Clue Relations (stubbed).
 *
 * `clue-relation-live.spec.ts` 의 stubbed 복제본. 본질은 "서버가 주는 단서
 * 그래프가 React Flow 로 올바르게 렌더되는지" — FE 렌더링 검증이므로, real
 * backend 없이 MSW handler 로 노드 3 / 엣지 2 fixture 를 돌려 주고 렌더
 * 결과를 검증한다. Live 쪽은 drag-drop / 저장 / cycle detect 까지 포함하지만
 * stubbed 쪽은 "화면 표시" 3 시나리오에 집중한다.
 *
 * Routes mock: `apps/web/src/mocks/handlers/clue.ts` (PR-4) +
 *   theme.ts (E2E_THEME_ID fixture) + auth.ts + room.ts.
 *
 * Phase 18.8 follow-up (#9 flaky monitor): 노드 클릭 인터랙션은 React Flow
 * fitView 애니메이션 직후 호출되므로 layout settle 시점에 따라 click 이
 * 비결정적일 수 있다. 현재 `toHaveCount` 명시 동기화 + FLOW_TIMEOUT 으로
 * mitigated. CI shard 에서 flaky 가 관측되면 `.react-flow__viewport`
 * waitFor 동기화 포인트를 추가하고 retry 는 도입하지 않는다 (race 마스킹).
 */
import { test, expect, type Page } from "@playwright/test";
import { handlers } from "../src/mocks/handlers";
import { login, BASE } from "./helpers/common";
import { installMswRoutes } from "./helpers/msw-route";
import { E2E_THEME_ID } from "../src/mocks/handlers/theme";
import { E2E_CLUE_IDS } from "../src/mocks/handlers/clue";

const FLOW_TIMEOUT = 10_000;

async function openRelationsTab(page: Page): Promise<void> {
  await page.goto(`${BASE}/editor/${E2E_THEME_ID}`);
  // Primary tab — `role="tab"` + `아이콘 + 텍스트` (EditorTabNav).
  await page.getByRole("tab", { name: /단서/ }).click();
  // Sub tab — native <button> with text label (CluesTab).
  await page.getByRole("button", { name: /관계/ }).click();
  await expect(page.locator(".react-flow")).toBeVisible({ timeout: FLOW_TIMEOUT });
}

test.describe("Clue Relations (stubbed)", () => {
  test.beforeEach(async ({ page }) => {
    await installMswRoutes(page, handlers);
    await login(page);
  });

  test("단서 2개 이상이면 React Flow 노드가 렌더된다", async ({ page }) => {
    await openRelationsTab(page);

    const nodes = page.locator(".react-flow__node");
    // fixture has 3 clues — ensure React Flow layout settles with them all.
    await expect(nodes).toHaveCount(3, { timeout: FLOW_TIMEOUT });
  });

  test("엣지가 있으면 React Flow 엣지 경로가 렌더된다", async ({ page }) => {
    await openRelationsTab(page);

    const edges = page.locator(".react-flow__edge");
    // fixture has 2 edges (c1→c2, c2→c3).
    await expect(edges).toHaveCount(2, { timeout: FLOW_TIMEOUT });
  });

  test("노드를 클릭하면 selected 상태로 전환된다", async ({ page }) => {
    await openRelationsTab(page);

    // React Flow 는 개별 node 에 `data-id` 를 부여한다 — fixture 의 c1 을 지정.
    const firstNode = page.locator(`.react-flow__node[data-id="${E2E_CLUE_IDS.c1}"]`);
    await expect(firstNode).toBeVisible({ timeout: FLOW_TIMEOUT });

    await firstNode.click();

    // React Flow 는 선택 시 `selected` class 를 추가한다.
    await expect(firstNode).toHaveClass(/selected/, { timeout: FLOW_TIMEOUT });
  });
});
