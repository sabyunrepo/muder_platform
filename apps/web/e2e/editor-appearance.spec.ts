import { expect, test } from '@playwright/test';
import {
  BASE,
  THEME_ID,
  freshState,
  loginAsE2EUser,
  mockCommonApis,
} from './helpers/editor-golden-path-fixtures';
import { EDITOR_APPEARANCE_STORAGE_KEY } from '../src/features/editor/design-system/useEditorAppearance';

test.describe('editor appearance mode', () => {
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

    await page.getByRole('button', { name: '라이트 모드' }).click();
    await expect(editorScope).toHaveAttribute('data-editor-theme', 'light');

    await page.getByRole('button', { name: '시스템 설정 사용' }).click();
    await expect(editorScope).toHaveAttribute('data-editor-theme', 'dark');
  });
});
