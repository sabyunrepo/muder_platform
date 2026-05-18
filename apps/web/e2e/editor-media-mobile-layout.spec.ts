import { expect, test } from '@playwright/test';

import {
  BASE,
  THEME_ID,
  freshState,
  loginAsE2EUser,
  mockCommonApis,
} from './helpers/editor-golden-path-fixtures';

const MOBILE_WIDTHS = [360, 390, 430] as const;

test.describe('미디어 관리 모바일 레이아웃', () => {
  for (const width of MOBILE_WIDTHS) {
    test(`${width}px에서 목록과 상세 하단 시트가 겹치지 않는다`, async ({ page }) => {
      await page.setViewportSize({ width, height: 812 });
      await mockCommonApis(page, freshState());
      await page.route('**/v1/editor/media/*/references', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ references: [] }),
        }),
      );
      await loginAsE2EUser(page);

      await page.goto(`${BASE}/editor/${THEME_ID}/media`);
      await expect(page.getByRole('tab', { name: /미디어/, selected: true })).toBeVisible({
        timeout: 10_000,
      });
      await expect(page.getByRole('button', { name: '파일 업로드' })).toBeVisible();
      await expect(page.getByLabel('미디어 검색')).toBeVisible();

      await page.getByText('긴장감 배경음').click();

      const sheet = page.getByRole('dialog', { name: '미디어 상세' });
      await expect(sheet).toBeVisible();
      await expect(page.locator('aside')).toHaveCount(0);

      const metrics = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        bodyOverflow: document.body.style.overflow,
      }));
      expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
      expect(metrics.bodyOverflow).toBe('hidden');

      const sheetBox = await sheet.boundingBox();
      expect(sheetBox?.height ?? 0).toBeLessThanOrEqual(812 * 0.82);

      await page.screenshot({
        path: `test-results/media-mobile-layout-${width}.png`,
        fullPage: true,
      });

      await page.keyboard.press('Escape');
      await expect(sheet).toBeHidden();
      await expect
        .poll(() => page.evaluate(() => document.body.style.overflow))
        .toBe('');
    });
  }
});
