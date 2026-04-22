import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// ---------------------------------------------------------------------------
// H-2 focus-visible + axe-core a11y smoke (WCAG 2.4.7 + 2.1.1 + 1.4.3)
//
// 대상 라우트: /login (백엔드 독립 — 다른 e2e spec 과 달리 로그인 불필요)
// 목표: (a) axe-core 자동 스캔 위반 0 건, (b) Tab 순회에서 focused element 가
// 시각적 focus 지표(outline 또는 box-shadow/ring)를 실제로 가짐을 확인.
// 회귀 방지: outline-none 클래스가 focus-visible:ring-* 병기 없이 단독으로
// 도입될 경우 이 spec 이 실패하도록 설계.
// ---------------------------------------------------------------------------

test.describe("a11y: focus-visible + axe-core", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /로그인/ })).toBeVisible();
  });

  test("login 페이지 axe-core WCAG 2.1 A/AA 위반 0 건", async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const critical = results.violations.filter((v) =>
      ["critical", "serious"].includes(v.impact ?? "minor"),
    );
    expect(
      critical,
      `critical/serious a11y violations:\n${critical
        .map((v) => `  - ${v.id}: ${v.help}`)
        .join("\n")}`,
    ).toHaveLength(0);
  });

  test("Tab 순회 시 focused element 가 시각적 focus 지표를 가진다", async ({ page }) => {
    const emailInput = page.getByPlaceholder("이메일");
    const passwordInput = page.getByPlaceholder("비밀번호");
    const submitButton = page.getByRole("button", { name: "로그인" });

    // 순회 대상 element 를 포커스하고 각각 outline 또는 box-shadow 가 visible 한지 확인
    for (const locator of [emailInput, passwordInput, submitButton]) {
      await locator.focus();
      const style = await locator.evaluate((el) => {
        const cs = window.getComputedStyle(el);
        return { outline: cs.outline, boxShadow: cs.boxShadow };
      });

      // Tailwind `focus-visible:ring-*` → box-shadow 로 렌더됨.
      // outline-none 단독은 outline 이 "none 0px" 이고 box-shadow 도 "none" 이므로 실패.
      const hasOutline =
        !!style.outline && style.outline !== "none" && !style.outline.startsWith("rgba(0, 0, 0, 0)");
      const hasRing = !!style.boxShadow && style.boxShadow !== "none";
      expect(
        hasOutline || hasRing,
        `focus indicator missing — outline=${style.outline} boxShadow=${style.boxShadow}`,
      ).toBe(true);
    }
  });
});
