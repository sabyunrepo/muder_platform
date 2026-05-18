import { expect, test } from "@playwright/test";
import type { Page, TestInfo } from "@playwright/test";
import {
  BASE,
  freshState,
  loginAsE2EUser,
  mockCommonApis,
} from "./helpers/editor-golden-path-fixtures";
import { APPEARANCE_STORAGE_KEY } from "../src/shared/appearance";

async function loginWithLightShell(page: Page) {
  const state = freshState();
  await page.addInitScript(
    ({ storageKey }) => {
      window.localStorage.setItem(storageKey, "light");
    },
    { storageKey: APPEARANCE_STORAGE_KEY },
  );
  await mockCommonApis(page, state);
  await loginAsE2EUser(page);
}

async function expectRuntimeBoundary(page: Page) {
  const tokens = await page.locator(".mmp-runtime-boundary").first().evaluate((scope) => {
    const style = window.getComputedStyle(scope);
    return {
      theme: scope.getAttribute("data-game-runtime-theme"),
      colorScheme: style.colorScheme,
      canvas: style.getPropertyValue("--mmp-color-canvas").trim(),
      surface: style.getPropertyValue("--mmp-color-surface").trim(),
      ink: style.getPropertyValue("--mmp-color-ink").trim(),
      primary: style.getPropertyValue("--mmp-color-primary").trim(),
      rootTheme: document.documentElement.getAttribute("data-theme"),
    };
  });

  expect(tokens).toEqual(
    expect.objectContaining({
      theme: "immersive",
      colorScheme: "dark",
      canvas: "#020617",
      surface: "#0f172a",
      ink: "#f8fafc",
      primary: "#fbbf24",
      rootTheme: "light",
    }),
  );
}

test.describe("runtime theme boundary", () => {
  test("game loading/fallback state stays immersive inside a light app shell", async ({
    page,
  }, testInfo: TestInfo) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await loginWithLightShell(page);

    await page.goto(`${BASE}/game/runtime-boundary-smoke`);

    await expect(page.locator(".mmp-runtime-boundary")).toBeVisible({ timeout: 10_000 });
    await expectRuntimeBoundary(page);

    const screenshot = await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath("game-runtime-boundary-desktop-light-shell.png"),
    });
    expect(screenshot.length).toBeGreaterThan(0);
  });

  test("game fallback keeps the same boundary on mobile", async ({ page }, testInfo: TestInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginWithLightShell(page);

    await page.goto(`${BASE}/game/runtime-boundary-smoke`);

    await expect(page.locator(".mmp-runtime-boundary")).toBeVisible({ timeout: 10_000 });
    await expectRuntimeBoundary(page);

    const screenshot = await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath("game-runtime-boundary-mobile-light-shell.png"),
    });
    expect(screenshot.length).toBeGreaterThan(0);
  });

  test("reading player mock uses the same immersive runtime boundary on mobile", async ({
    page,
  }, testInfo: TestInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginWithLightShell(page);

    await page.goto(`${BASE}/dev/reading-player`);

    await expect(page.getByRole("heading", { name: "읽기 대사 테스트 화면" })).toBeVisible();
    await expectRuntimeBoundary(page);

    const screenshot = await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath("reading-player-runtime-boundary-mobile-light-shell.png"),
    });
    expect(screenshot.length).toBeGreaterThan(0);
  });
});
