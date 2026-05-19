import { expect, test } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';

async function expectThemeControls(page: Page) {
  await expect(page.getByRole('button', { name: '시스템' })).toBeVisible();
  await expect(page.getByRole('button', { name: '라이트' })).toBeVisible();
  await expect(page.getByRole('button', { name: '다크' })).toBeVisible();
}

async function expectThemePreference(page: Page, preference: 'system' | 'light' | 'dark') {
  await expect(page.locator('html')).toHaveAttribute('data-theme-preference', preference);
  await expect(page.getByRole('button', { name: preferenceLabel(preference) })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
}

function preferenceLabel(preference: 'system' | 'light' | 'dark') {
  if (preference === 'system') return '시스템';
  if (preference === 'light') return '라이트';
  return '다크';
}

async function capture(page: Page, testInfo: TestInfo, name: string) {
  const screenshot = await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath(name),
  });
  expect(screenshot.length).toBeGreaterThan(0);
}

test.describe('public theme shell', () => {
  test('로그인 페이지에서 light/dark/system 전환 버튼이 보이고 실제 테마가 바뀐다', async ({
    page,
  }, testInfo) => {
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible();
    await expectThemeControls(page);

    await page.getByRole('button', { name: '다크' }).click();
    await expectThemePreference(page, 'dark');
    await capture(page, testInfo, 'login-dark-theme.png');

    await page.getByRole('button', { name: '라이트' }).click();
    await expectThemePreference(page, 'light');
    await capture(page, testInfo, 'login-light-theme.png');

    await page.getByRole('button', { name: '시스템' }).click();
    await expectThemePreference(page, 'system');
  });

  test('모바일 로그인에서도 compact 테마 전환 버튼이 보인다', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible();
    await expectThemeControls(page);

    await page.getByRole('button', { name: '다크' }).click();
    await expectThemePreference(page, 'dark');
    await capture(page, testInfo, 'login-mobile-dark-theme.png');
  });

  test('오프라인 페이지와 404 fallback도 같은 테마 전환 shell을 사용한다', async ({
    page,
  }, testInfo) => {
    await page.goto('/offline');
    await expect(page.getByRole('heading', { name: '연결이 끊어졌습니다' })).toBeVisible();
    await expectThemeControls(page);

    await page.getByRole('button', { name: '다크' }).click();
    await expectThemePreference(page, 'dark');
    await capture(page, testInfo, 'offline-dark-theme.png');

    await page.goto('/does-not-exist');
    await expect(page.getByText('404')).toBeVisible();
    await expectThemeControls(page);
    await expectThemePreference(page, 'dark');
    await capture(page, testInfo, 'not-found-dark-theme.png');
  });
});
