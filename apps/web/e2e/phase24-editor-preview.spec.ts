import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Phase 24 에디터 entity preview", () => {
  test("데스크톱에서 entity 탐색, 상세, 검수 패널을 표시한다", async ({ page }) => {
    await page.goto("/__dev/phase24-editor-preview");

    await expect(page.getByRole("heading", { name: "에디터 Entity Page Preview" })).toBeVisible();
    await expect(page.getByText("Phase 24 PR-3 entity workspace")).toBeVisible();

    await expect(page.getByRole("button", { name: /캐릭터\s*5개 entity/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /김철수 상속자 범인 후보/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "김철수" })).toBeVisible();

    await expect(page.getByText("역할지 Markdown")).toBeVisible();
    await expect(page.getByRole("button", { name: "켜짐 · starting_clue" })).toBeVisible();
    await expect(page.getByText("참조 상태")).toBeVisible();
    await expect(page.getByText("단서 backlink")).toBeVisible();

    const a11y = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .disableRules(["color-contrast"])
      .analyze();
    expect(a11y.violations).toEqual([]);
  });

  test("모바일 폭에서도 핵심 흐름을 세로로 읽을 수 있다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/__dev/phase24-editor-preview");

    await expect(page.getByRole("heading", { name: "에디터 Entity Page Preview" })).toBeVisible();
    await expect(page.getByText("모바일 우선 세로 흐름")).toBeVisible();
    await expect(page.getByText("모바일에서는 위에서 아래로: 선택 → 베이스 → 모듈 → 참조 순서로 읽습니다.")).toBeVisible();

    await expect(page.getByText("역할지 Markdown")).toBeVisible();
    await expect(page.getByText("참조 상태")).toBeVisible();

    const a11y = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .disableRules(["color-contrast"])
      .analyze();
    expect(a11y.violations).toEqual([]);
  });

  test("이미지 롤지 viewer preview를 실제 페이지로 표시한다", async ({ page }) => {
    await page.goto("/__dev/phase24-image-role-sheet-preview");

    await expect(page.getByRole("heading", { name: "이미지 롤지 Viewer Preview" })).toBeVisible();
    await expect(page.getByText("이미지 롤지", { exact: true })).toBeVisible();
    await expect(page.getByText("1 / 3페이지")).toBeVisible();
    await expect(page.getByAltText("홍길동 이미지 롤지 1페이지")).toBeVisible();

    await page.getByRole("button", { name: "다음 이미지 페이지" }).click();
    await expect(page.getByText("2 / 3페이지")).toBeVisible();
    await expect(page.getByAltText("홍길동 이미지 롤지 2페이지")).toBeVisible();
  });

  test("모바일 폭에서 이미지 롤지 viewer preview를 세로 흐름으로 읽을 수 있다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/__dev/phase24-image-role-sheet-preview");

    await expect(page.getByRole("heading", { name: "이미지 롤지 Viewer Preview" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "이미지 페이지 URL" })).toBeVisible();
    await expect(page.getByText("1 / 3페이지")).toBeVisible();
    await expect(page.getByText("확인 포인트")).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
  });
});
