import { expect, test } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';
import {
  BASE,
  THEME_ID,
  freshState,
  loginAsE2EUser,
  mockCommonApis,
} from './helpers/editor-golden-path-fixtures';
import { EDITOR_APPEARANCE_STORAGE_KEY } from '../src/features/editor/design-system/useEditorAppearance';
import { APPEARANCE_STORAGE_KEY } from '../src/shared/appearance';

async function expectDarkEditorTokens(page: Page) {
  const tokens = await page.locator('.mmp-editor-design-scope').evaluate((scope) => {
    const scopeStyle = window.getComputedStyle(scope);
    const rootStyle = window.getComputedStyle(document.documentElement);
    const surface = scope.querySelector('.mmp-editor-surface');
    const surfaceStyle = surface ? window.getComputedStyle(surface) : null;

    return {
      editorCanvas: scopeStyle.getPropertyValue('--mmp-editor-color-canvas').trim(),
      editorInk: scopeStyle.getPropertyValue('--mmp-editor-color-ink').trim(),
      canvas: rootStyle.getPropertyValue('--mmp-color-canvas').trim(),
      ink: rootStyle.getPropertyValue('--mmp-color-ink').trim(),
      colorScheme: scopeStyle.colorScheme,
      surfaceBackground: surfaceStyle?.backgroundColor ?? '',
      surfaceColor: surfaceStyle?.color ?? '',
    };
  });

  expect(tokens).toEqual(
    expect.objectContaining({
      editorCanvas: '#191919',
      editorInk: '#f4f4f2',
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
    const rootStyle = window.getComputedStyle(document.documentElement);
    const surface = scope.querySelector('.mmp-editor-surface');
    const surfaceStyle = surface ? window.getComputedStyle(surface) : null;

    return {
      editorCanvas: scopeStyle.getPropertyValue('--mmp-editor-color-canvas').trim(),
      editorInk: scopeStyle.getPropertyValue('--mmp-editor-color-ink').trim(),
      canvas: rootStyle.getPropertyValue('--mmp-color-canvas').trim(),
      ink: rootStyle.getPropertyValue('--mmp-color-ink').trim(),
      colorScheme: scopeStyle.colorScheme,
      surfaceBackground: surfaceStyle?.backgroundColor ?? '',
      surfaceColor: surfaceStyle?.color ?? '',
    };
  });

  expect(tokens).toEqual(
    expect.objectContaining({
      editorCanvas: '#ffffff',
      editorInk: '#1a1a1a',
      canvas: '#ffffff',
      ink: '#1a1a1a',
      colorScheme: 'light',
      surfaceBackground: 'rgb(250, 250, 249)',
      surfaceColor: 'rgb(26, 26, 26)',
    })
  );
}

test.describe('editor appearance mode', () => {
  test('/editor 대시보드는 저장된 appearance mode와 무관하게 legacy design으로 남는다', async ({
    page,
  }, testInfo: TestInfo) => {
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
        page.evaluate((key) => window.localStorage.getItem(key), APPEARANCE_STORAGE_KEY)
      )
      .toBe('dark');

    const screenshot = await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath('editor-dashboard-legacy-design.png'),
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
    await expect(page.getByRole('button', { name: '시스템' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );

    await page.getByRole('button', { name: '다크' }).click();

    await expect(editorScope).toHaveAttribute('data-editor-theme', 'dark');
    await expectDarkEditorTokens(page);
    await expect(page.getByRole('button', { name: '다크' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect
      .poll(() =>
        page.evaluate((key) => window.localStorage.getItem(key), APPEARANCE_STORAGE_KEY)
      )
      .toBe('dark');

    await page.reload();

    await expect(editorScope).toHaveAttribute('data-editor-theme', 'dark');
    await expectDarkEditorTokens(page);
    await expect(page.getByRole('button', { name: '다크' })).toHaveAttribute(
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

    await page.getByRole('button', { name: '라이트' }).click();
    await expect(editorScope).toHaveAttribute('data-editor-theme', 'light');

    await page.getByRole('button', { name: '시스템' }).click();
    await expect(editorScope).toHaveAttribute('data-editor-theme', 'dark');
  });

  test('에디터 상세 화면의 system appearance 스크린샷을 캡처한다', async (
    { page },
    testInfo: TestInfo
  ) => {
    const state = freshState();
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.addInitScript(
      ({ storageKey }) => {
        window.localStorage.setItem(storageKey, 'system');
      },
      { storageKey: APPEARANCE_STORAGE_KEY }
    );
    await mockCommonApis(page, state);
    await loginAsE2EUser(page);

    await page.goto(`${BASE}/editor/${THEME_ID}`);

    const editorScope = page.locator('.mmp-editor-design-scope');
    await expect(editorScope).toHaveAttribute('data-editor-theme-preference', 'system');
    await expect(editorScope).toHaveAttribute('data-editor-theme', 'dark');
    await expect(page.getByRole('button', { name: '시스템' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expectDarkEditorTokens(page);

    const screenshot = await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath('editor-detail-system-appearance.png'),
    });
    expect(screenshot.length).toBeGreaterThan(0);
  });

  test('에디터 상세 화면의 light appearance 스크린샷을 캡처한다', async (
    { page },
    testInfo: TestInfo
  ) => {
    const state = freshState();
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.addInitScript(
      ({ storageKey }) => {
        window.localStorage.setItem(storageKey, 'light');
      },
      { storageKey: APPEARANCE_STORAGE_KEY }
    );
    await mockCommonApis(page, state);
    await loginAsE2EUser(page);

    await page.goto(`${BASE}/editor/${THEME_ID}`);

    const editorScope = page.locator('.mmp-editor-design-scope');
    await expect(editorScope).toHaveAttribute('data-editor-theme-preference', 'light');
    await expect(editorScope).toHaveAttribute('data-editor-theme', 'light');
    await expect(page.getByRole('button', { name: '라이트' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expectLightEditorTokens(page);

    const screenshot = await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath('editor-detail-light-appearance.png'),
    });
    expect(screenshot.length).toBeGreaterThan(0);
  });

  test('에디터 상세 화면의 dark appearance 스크린샷을 캡처한다', async (
    { page },
    testInfo: TestInfo
  ) => {
    const state = freshState();
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.emulateMedia({ colorScheme: 'light' });
    await page.addInitScript(
      ({ storageKey }) => {
        window.localStorage.setItem(storageKey, 'dark');
      },
      { storageKey: APPEARANCE_STORAGE_KEY }
    );
    await mockCommonApis(page, state);
    await loginAsE2EUser(page);

    await page.goto(`${BASE}/editor/${THEME_ID}`);

    const editorScope = page.locator('.mmp-editor-design-scope');
    await expect(editorScope).toHaveAttribute('data-editor-theme-preference', 'dark');
    await expect(editorScope).toHaveAttribute('data-editor-theme', 'dark');
    await expect(page.getByRole('button', { name: '다크' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expectDarkEditorTokens(page);

    const screenshot = await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath('editor-detail-dark-appearance.png'),
    });
    expect(screenshot.length).toBeGreaterThan(0);
  });

  test('PR-6 에디터 상세 화면 스크린샷 매트릭스를 캡처한다', async ({ page }) => {
    const state = freshState();
    await mockCommonApis(page, state);
    await loginAsE2EUser(page);

    const captures = [
      {
        url: `${BASE}/editor/${THEME_ID}/overview`,
        preference: 'light',
        viewport: { width: 1440, height: 960 },
        path: '../../screenshots/design-system/667-editor-overview-light.png',
      },
      {
        url: `${BASE}/editor/${THEME_ID}/overview`,
        preference: 'dark',
        viewport: { width: 1440, height: 960 },
        path: '../../screenshots/design-system/667-editor-overview-dark.png',
      },
      {
        url: `${BASE}/editor/${THEME_ID}/design/modules`,
        preference: 'light',
        viewport: { width: 1440, height: 960 },
        path: '../../screenshots/design-system/667-editor-modules-light.png',
      },
      {
        url: `${BASE}/editor/${THEME_ID}/design/modules`,
        preference: 'dark',
        viewport: { width: 1440, height: 960 },
        path: '../../screenshots/design-system/667-editor-modules-dark.png',
      },
      {
        url: `${BASE}/editor/${THEME_ID}/flow`,
        preference: 'system',
        viewport: { width: 1440, height: 960 },
        path: '../../screenshots/design-system/667-editor-flow-system-dark.png',
      },
      {
        url: `${BASE}/editor/${THEME_ID}/overview`,
        preference: 'light',
        viewport: { width: 390, height: 844 },
        path: '../../screenshots/design-system/667-editor-mobile-light.png',
      },
    ] as const;

    for (const capture of captures) {
      await page.setViewportSize(capture.viewport);
      await page.emulateMedia({ colorScheme: capture.preference === 'system' ? 'dark' : 'light' });
      await page.evaluate(
        ({ storageKey, preference }) => {
          window.localStorage.setItem(storageKey, preference);
        },
        { storageKey: APPEARANCE_STORAGE_KEY, preference: capture.preference }
      );

      await page.goto(capture.url);
      const editorScope = page.locator('.mmp-editor-design-scope');
      await expect(editorScope).toHaveAttribute('data-editor-theme-preference', capture.preference);
      await expect(editorScope).toHaveAttribute(
        'data-editor-theme',
        capture.preference === 'system' ? 'dark' : capture.preference
      );

      const screenshot = await page.screenshot({
        fullPage: true,
        path: capture.path,
      });
      expect(screenshot.length).toBeGreaterThan(0);
    }
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

    await page.getByRole('button', { name: '라이트' }).click();

    await expect(editorScope).toHaveAttribute('data-editor-theme-preference', 'light');
    await expect(editorScope).toHaveAttribute('data-editor-theme', 'light');
    await expect(page.getByRole('button', { name: '라이트' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect
      .poll(() =>
        page.evaluate((key) => window.localStorage.getItem(key), APPEARANCE_STORAGE_KEY)
      )
      .toBe('light');

    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(editorScope).toHaveAttribute('data-editor-theme', 'light');

    await page.reload();
    await expect(editorScope).toHaveAttribute('data-editor-theme-preference', 'light');
    await expect(editorScope).toHaveAttribute('data-editor-theme', 'light');
    await expect(page.getByRole('button', { name: '라이트' })).toHaveAttribute(
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
    await expect(page.getByRole('button', { name: '시스템' })).toHaveAttribute(
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
    await expectLightEditorTokens(page);
  });
});
