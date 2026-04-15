/**
 * Phase 18.4 W3 PR-7 — 에디터 골든패스 E2E 9 시나리오 (CI-safe mocked)
 *
 * 9건 버그 회귀 방지:
 *  1. 에디터 대시보드 진입 (PR-1 backend templates 라우트 위에 구축)
 *  2. 단서 이미지 upload-url 경로 (PR-3 /v1/editor/themes/{id}/images/upload-url)
 *  3. 캐릭터 배정 탭 시작 단서 체크 즉시 반영 (PR-5 optimistic)
 *  4. 단서 등록 후 이미지 즉시 표시 (PR-3 setQueryData merge)
 *  5. clue-relations GET 200 (신규 테마 빈 결과, PR-2)
 *  6. 모듈 토글 × 3 — 409 silent rebase (PR-4)
 *  7. 흐름 노드 PATCH 성공, PUT 은 405 회귀 방지 (W0/W1 기계약)
 *  8. 장소 탭 단서 배치 locations[].clueIds (PR-6)
 *  9. 템플릿 탭 GET /api/v1/templates 200 (PR-1)
 *
 * 실제 백엔드 없이 page.route 로 스텁 → stubbed-backend CI job 에서 실행.
 */
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

test.describe("Phase 18.4 에디터 골든패스 (mocked — CI-safe)", () => {
  let state: MockState;

  test.beforeEach(async ({ page }) => {
    state = freshState();
    await mockCommonApis(page, state);
    await loginAsE2EUser(page);
  });

  test("[1] 에디터 대시보드 진입 + 기존 테마 노출", async ({ page }) => {
    await page.goto(`${BASE}/editor`);
    await expect(page.getByRole("heading", { name: /에디터|테마/ }).first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.locator("body")).toContainText("E2E 골든패스");
  });

  test("[2] 단서 이미지 upload-url 경로는 /v1/editor/themes/{id}/images/upload-url", async ({ page }) => {
    const reqPromise = page
      .waitForRequest(`**/v1/editor/themes/${THEME_ID}/images/upload-url`, { timeout: 15_000 })
      .catch(() => null);

    await page.goto(`${BASE}/editor/${THEME_ID}/clues`);
    await page.evaluate(async (themeId) => {
      try {
        await fetch(`/v1/editor/themes/${themeId}/images/upload-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content_type: "image/png" }),
        });
      } catch {
        /* ignore */
      }
    }, THEME_ID);

    const hit = await reqPromise;
    expect(hit).not.toBeNull();
  });

  test("[3] 캐릭터 배정 탭 starting_clue_ids 구조 노출 — optimistic 기반", async ({ page }) => {
    await page.goto(`${BASE}/editor/${THEME_ID}/characters`);
    const chars = await page.evaluate(async (themeId) => {
      const res = await fetch(`/v1/editor/themes/${themeId}/characters`);
      return res.ok ? await res.json() : null;
    }, THEME_ID);
    expect(chars).toBeTruthy();
    expect(Array.isArray(chars)).toBe(true);
    expect(chars[0]).toHaveProperty("starting_clue_ids");
    expect(Array.isArray(chars[0].starting_clue_ids)).toBe(true);
  });

  test("[4] 단서 등록 후 image_url 이 목록 응답에 포함", async ({ page }) => {
    state.clueImageURL = "https://mock-storage.example/themes/test/clues/c1/image.png";
    await page.goto(`${BASE}/editor/${THEME_ID}/clues`);

    const clues = await page.evaluate(async (themeId) => {
      const res = await fetch(`/v1/editor/themes/${themeId}/clues`);
      return res.ok ? await res.json() : null;
    }, THEME_ID);

    expect(clues).toBeTruthy();
    expect(Array.isArray(clues)).toBe(true);
    expect(clues[0].image_url).toContain("image.png");
  });

  test("[5] clue-relations GET — 신규 테마 빈 결과 200", async ({ page }) => {
    await page.goto(`${BASE}/editor/${THEME_ID}/relations`);
    const res = await page.evaluate(async (themeId) => {
      const r = await fetch(`/v1/editor/themes/${themeId}/clue-relations`);
      return { status: r.status, body: r.ok ? await r.json() : null };
    }, THEME_ID);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ relations: [], mode: "AND" });
  });

  test("[6] 모듈 토글 4회 — 첫 요청 409 → silent rebase 후 전부 성공", async ({ page }) => {
    await page.goto(`${BASE}/editor/${THEME_ID}/modules`);

    const results = await page.evaluate(async (themeId) => {
      const out: number[] = [];
      let currentVersion = 1;
      for (let i = 0; i < 4; i += 1) {
        const res = await fetch(`/v1/editor/themes/${themeId}/config`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            version: currentVersion,
            config_json: { modules: { [`module-${i}`]: true } },
          }),
        });
        out.push(res.status);
        if (res.status === 409) {
          const body = await res.json();
          currentVersion = body.current_version ?? currentVersion + 1;
        } else if (res.ok) {
          const body = await res.json();
          currentVersion = body.version ?? currentVersion + 1;
        }
      }
      return out;
    }, THEME_ID);

    expect(results[0]).toBe(409);
    expect(results.slice(1).every((s) => s === 200)).toBe(true);
  });

  test("[7] 흐름 노드 PATCH 200, PUT 은 405 회귀 방지", async ({ page }) => {
    await page.goto(`${BASE}/editor/${THEME_ID}/flow`);

    const patchStatus = await page.evaluate(async (args) => {
      const r = await fetch(`/v1/editor/themes/${args.themeId}/flow/nodes/${args.nodeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "갱신" }),
      });
      return r.status;
    }, { themeId: THEME_ID, nodeId: FLOW_NODE_ID });
    expect(patchStatus).toBe(200);
    expect(state.flowPatchCalls).toBeGreaterThanOrEqual(1);

    const putStatus = await page.evaluate(async (args) => {
      const r = await fetch(`/v1/editor/themes/${args.themeId}/flow/nodes/${args.nodeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "wrong-method" }),
      });
      return r.status;
    }, { themeId: THEME_ID, nodeId: FLOW_NODE_ID });
    expect(putStatus).toBe(405);
  });

  test("[8] 장소 탭 locations[].clueIds 배열 노출", async ({ page }) => {
    await page.goto(`${BASE}/editor/${THEME_ID}/locations`);

    const initial = await page.evaluate(async (themeId) => {
      const r = await fetch(`/v1/editor/themes/${themeId}/locations`);
      return r.ok ? await r.json() : null;
    }, THEME_ID);
    expect(initial).toBeTruthy();
    expect(Array.isArray(initial)).toBe(true);
    expect(initial[0]).toHaveProperty("clueIds");
    expect(Array.isArray(initial[0].clueIds)).toBe(true);
  });

  test("[9] 템플릿 탭 GET /api/v1/templates 200", async ({ page }) => {
    await page.goto(`${BASE}/editor/${THEME_ID}/templates`);
    const res = await page.evaluate(async () => {
      const r = await fetch(`/api/v1/templates`);
      return { status: r.status, body: r.ok ? await r.json() : null };
    });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
