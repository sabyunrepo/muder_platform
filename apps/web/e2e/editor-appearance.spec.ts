import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  BASE,
  THEME_ID,
  freshState,
  loginAsE2EUser,
  mockCommonApis,
} from './helpers/editor-golden-path-fixtures';
import { EDITOR_APPEARANCE_STORAGE_KEY } from '../src/features/editor/design-system/useEditorAppearance';

async function expectDarkEditorTokens(page: Page) {
  const tokens = await page.locator('.mmp-editor-design-scope').evaluate((scope) => {
    const scopeStyle = window.getComputedStyle(scope);
    const surface = scope.querySelector('.mmp-editor-surface');
    const surfaceStyle = surface ? window.getComputedStyle(surface) : null;

    return {
      canvas: scopeStyle.getPropertyValue('--mmp-editor-color-canvas').trim(),
      ink: scopeStyle.getPropertyValue('--mmp-editor-color-ink').trim(),
      colorScheme: scopeStyle.colorScheme,
      surfaceBackground: surfaceStyle?.backgroundColor ?? '',
      surfaceColor: surfaceStyle?.color ?? '',
    };
  });

  expect(tokens).toEqual(
    expect.objectContaining({
      canvas: '#191919',
      ink: '#f4f4f2',
      colorScheme: 'dark',
      surfaceBackground: 'rgb(32, 32, 32)',
      surfaceColor: 'rgb(244, 244, 242)',
    })
  );
}

async function expectLightEditorTokens(page: Page) {
  const tokens = await page.locator('.mmp-editor-design-scope').evaluate((scope) => {
    const scopeStyle = window.getComputedStyle(scope);
    const surface = scope.querySelector('.mmp-editor-surface');
    const surfaceStyle = surface ? window.getComputedStyle(surface) : null;

    return {
      canvas: scopeStyle.getPropertyValue('--mmp-editor-color-canvas').trim(),
      ink: scopeStyle.getPropertyValue('--mmp-editor-color-ink').trim(),
      surfaceBackground: surfaceStyle?.backgroundColor ?? '',
      surfaceColor: surfaceStyle?.color ?? '',
    };
  });

  expect(tokens).toEqual(
    expect.objectContaining({
      canvas: '#ffffff',
      ink: '#1a1a1a',
      surfaceBackground: 'rgb(250, 250, 249)',
      surfaceColor: 'rgb(26, 26, 26)',
    })
  );
}

test.describe('editor appearance mode', () => {
  test('/editor 대시보드는 저장된 appearance mode와 무관하게 legacy design으로 남는다', async ({
    page,
  }) => {
    const state = freshState();
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.addInitScript(
      ({ storageKey }) => {
        window.localStorage.setItem(storageKey, 'dark');
      },
      { storageKey: EDITOR_APPEARANCE_STORAGE_KEY }
    );
    await mockCommonApis(page, state);
    await loginAsE2EUser(page);

    await page.goto(`${BASE}/editor`);

    await expect(page.getByRole('heading', { name: '테마 에디터' })).toBeVisible();
    await expect(page.getByText('E2E 골든패스')).toBeVisible();
    await expect(page.locator('.mmp-editor-design-scope')).toHaveCount(0);
    await expect(page.locator('[data-editor-theme]')).toHaveCount(0);
    await expect(page.locator('[data-editor-theme-preference]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '시스템 설정 사용' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '다크 모드' })).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate((key) => window.localStorage.getItem(key), EDITOR_APPEARANCE_STORAGE_KEY)
      )
      .toBe('dark');

    const screenshot = await page.screenshot({
      fullPage: true,
      path: 'test-results/editor-dashboard-legacy-design.png',
    });
    expect(screenshot.length).toBeGreaterThan(0);
  });

  test('에디터 상세 화면에서 다크 모드를 선택하면 저장되고 새로고침 뒤에도 유지된다', async ({
    page,
  }) => {
    const state = freshState();
    await mockCommonApis(page, state);
    await loginAsE2EUser(page);

    await page.goto(`${BASE}/editor/${THEME_ID}`);

    const editorScope = page.locator('.mmp-editor-design-scope');
    await expect(editorScope).toHaveAttribute('data-editor-theme', 'light');
    await expect(page.getByRole('button', { name: '시스템 설정 사용' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );

    await page.getByRole('button', { name: '다크 모드' }).click();

    await expect(editorScope).toHaveAttribute('data-editor-theme', 'dark');
    await expectDarkEditorTokens(page);
    await expect(page.getByRole('button', { name: '다크 모드' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect
      .poll(() =>
        page.evaluate((key) => window.localStorage.getItem(key), EDITOR_APPEARANCE_STORAGE_KEY)
      )
      .toBe('dark');

    await page.reload();

    await expect(editorScope).toHaveAttribute('data-editor-theme', 'dark');
    await expectDarkEditorTokens(page);
    await expect(page.getByRole('button', { name: '다크 모드' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  test('시스템 설정 모드는 브라우저 색상 설정을 따라간다', async ({ page }) => {
    const state = freshState();
    await page.emulateMedia({ colorScheme: 'dark' });
    await mockCommonApis(page, state);
    await loginAsE2EUser(page);

    await page.goto(`${BASE}/editor/${THEME_ID}`);

    const editorScope = page.locator('.mmp-editor-design-scope');
    await expect(editorScope).toHaveAttribute('data-editor-theme-preference', 'system');
    await expect(editorScope).toHaveAttribute('data-editor-theme', 'dark');
    await expectDarkEditorTokens(page);

    await page.getByRole('button', { name: '라이트 모드' }).click();
    await expect(editorScope).toHaveAttribute('data-editor-theme', 'light');

    await page.getByRole('button', { name: '시스템 설정 사용' }).click();
    await expect(editorScope).toHaveAttribute('data-editor-theme', 'dark');
  });

  test('에디터 상세 화면의 system appearance 스크린샷을 캡처한다', async ({ page }) => {
    const state = freshState();
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.addInitScript(
      ({ storageKey }) => {
        window.localStorage.setItem(storageKey, 'system');
      },
      { storageKey: EDITOR_APPEARANCE_STORAGE_KEY }
    );
    await mockCommonApis(page, state);
    await loginAsE2EUser(page);

    await page.goto(`${BASE}/editor/${THEME_ID}`);

    const editorScope = page.locator('.mmp-editor-design-scope');
    await expect(editorScope).toHaveAttribute('data-editor-theme-preference', 'system');
    await expect(editorScope).toHaveAttribute('data-editor-theme', 'dark');
    await expect(page.getByRole('button', { name: '시스템 설정 사용' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expectDarkEditorTokens(page);

    const screenshot = await page.screenshot({
      fullPage: true,
      path: 'test-results/editor-detail-system-appearance.png',
    });
    expect(screenshot.length).toBeGreaterThan(0);
  });

  test('에디터 상세 화면의 light appearance 스크린샷을 캡처한다', async ({ page }) => {
    const state = freshState();
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.addInitScript(
      ({ storageKey }) => {
        window.localStorage.setItem(storageKey, 'light');
      },
      { storageKey: EDITOR_APPEARANCE_STORAGE_KEY }
    );
    await mockCommonApis(page, state);
    await loginAsE2EUser(page);

    await page.goto(`${BASE}/editor/${THEME_ID}`);

    const editorScope = page.locator('.mmp-editor-design-scope');
    await expect(editorScope).toHaveAttribute('data-editor-theme-preference', 'light');
    await expect(editorScope).toHaveAttribute('data-editor-theme', 'light');
    await expect(page.getByRole('button', { name: '라이트 모드' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expectLightEditorTokens(page);

    const screenshot = await page.screenshot({
      fullPage: true,
      path: 'test-results/editor-detail-light-appearance.png',
    });
    expect(screenshot.length).toBeGreaterThan(0);
  });

  test('에디터 상세 화면의 dark appearance 스크린샷을 캡처한다', async ({ page }) => {
    const state = freshState();
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.emulateMedia({ colorScheme: 'light' });
    await page.addInitScript(
      ({ storageKey }) => {
        window.localStorage.setItem(storageKey, 'dark');
      },
      { storageKey: EDITOR_APPEARANCE_STORAGE_KEY }
    );
    await mockCommonApis(page, state);
    await loginAsE2EUser(page);

    await page.goto(`${BASE}/editor/${THEME_ID}`);

    const editorScope = page.locator('.mmp-editor-design-scope');
    await expect(editorScope).toHaveAttribute('data-editor-theme-preference', 'dark');
    await expect(editorScope).toHaveAttribute('data-editor-theme', 'dark');
    await expect(page.getByRole('button', { name: '다크 모드' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expectDarkEditorTokens(page);

    const screenshot = await page.screenshot({
      fullPage: true,
      path: 'test-results/editor-detail-dark-appearance.png',
    });
    expect(screenshot.length).toBeGreaterThan(0);
  });

  test('에디터 상세 화면에서 라이트 모드를 선택하면 시스템 dark 설정보다 우선한다', async ({
    page,
  }) => {
    const state = freshState();
    await page.emulateMedia({ colorScheme: 'dark' });
    await mockCommonApis(page, state);
    await loginAsE2EUser(page);

    await page.goto(`${BASE}/editor/${THEME_ID}/characters`);

    const editorScope = page.locator('.mmp-editor-design-scope');
    await expect(editorScope).toHaveAttribute('data-editor-theme-preference', 'system');
    await expect(editorScope).toHaveAttribute('data-editor-theme', 'dark');

    await page.getByRole('button', { name: '라이트 모드' }).click();

    await expect(editorScope).toHaveAttribute('data-editor-theme-preference', 'light');
    await expect(editorScope).toHaveAttribute('data-editor-theme', 'light');
    await expect(page.getByRole('button', { name: '라이트 모드' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect
      .poll(() =>
        page.evaluate((key) => window.localStorage.getItem(key), EDITOR_APPEARANCE_STORAGE_KEY)
      )
      .toBe('light');

    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(editorScope).toHaveAttribute('data-editor-theme', 'light');

    await page.reload();
    await expect(editorScope).toHaveAttribute('data-editor-theme-preference', 'light');
    await expect(editorScope).toHaveAttribute('data-editor-theme', 'light');
    await expect(page.getByRole('button', { name: '라이트 모드' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  test('시스템 설정 모드는 열린 에디터 상세 화면에서 브라우저 색상 변경을 즉시 반영한다', async ({
    page,
  }) => {
    const state = freshState();
    await page.emulateMedia({ colorScheme: 'light' });
    await mockCommonApis(page, state);
    await loginAsE2EUser(page);

    await page.goto(`${BASE}/editor/${THEME_ID}/characters`);

    const editorScope = page.locator('.mmp-editor-design-scope');
    await expect(editorScope).toHaveAttribute('data-editor-theme-preference', 'system');
    await expect(editorScope).toHaveAttribute('data-editor-theme', 'light');
    await expect(page.getByRole('button', { name: '시스템 설정 사용' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );

    await page.emulateMedia({ colorScheme: 'dark' });

    await expect(editorScope).toHaveAttribute('data-editor-theme-preference', 'system');
    await expect(editorScope).toHaveAttribute('data-editor-theme', 'dark');
    await expectDarkEditorTokens(page);

    await page.emulateMedia({ colorScheme: 'light' });

    await expect(editorScope).toHaveAttribute('data-editor-theme-preference', 'system');
    await expect(editorScope).toHaveAttribute('data-editor-theme', 'light');
  });
});
