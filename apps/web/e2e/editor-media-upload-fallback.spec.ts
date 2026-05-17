import { expect, test } from '@playwright/test';

import {
  BASE,
  THEME_ID,
  freshState,
  loginAsE2EUser,
  mockCommonApis,
} from './helpers/editor-golden-path-fixtures';

test.describe('미디어 업로드 fallback', () => {
  test.beforeEach(async ({ page }) => {
    await mockCommonApis(page, freshState());
    await loginAsE2EUser(page);
  });

  test('R2 직접 PUT이 막히면 백엔드 업로드 API로 이어서 confirm한다', async ({ page }) => {
    const uploadId = '11111111-1111-1111-1111-111111111111';
    const directPutUrls: string[] = [];
    const fallbackUploads: Array<{ url: string; method: string; bodySize: number }> = [];
    let confirmCalls = 0;

    await page.route(`**/v1/editor/themes/${THEME_ID}/media/upload-url`, (route) =>
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          upload_id: uploadId,
          upload_url: 'https://mock-r2.example/themes/e2e/upload.png',
          expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
        }),
      }),
    );

    await page.route('https://mock-r2.example/**', (route) => {
      directPutUrls.push(route.request().url());
      return route.fulfill({ status: 403, contentType: 'text/plain', body: 'CORS blocked' });
    });

    await page.route(`**/api/v1/editor/themes/${THEME_ID}/media/uploads/${uploadId}`, async (route) => {
      const request = route.request();
      fallbackUploads.push({
        url: request.url(),
        method: request.method(),
        bodySize: (request.postDataBuffer() ?? Buffer.alloc(0)).byteLength,
      });
      return route.fulfill({ status: 204, body: '' });
    });

    await page.route(`**/v1/editor/themes/${THEME_ID}/media/confirm`, async (route) => {
      confirmCalls += 1;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'media-uploaded',
          theme_id: THEME_ID,
          name: 'fallback-image',
          type: 'IMAGE',
          source_type: 'FILE',
          url: 'https://mock-storage.example/themes/e2e/upload.png',
          file_size: 4,
          mime_type: 'image/png',
          tags: [],
          sort_order: 0,
          created_at: new Date().toISOString(),
        }),
      });
    });

    await page.goto(`${BASE}/editor/${THEME_ID}/media`);
    await expect(page.getByRole('tab', { name: /미디어/, selected: true })).toBeVisible({
      timeout: 10_000,
    });

    await page.getByRole('button', { name: '파일 업로드' }).click();
    await page.setInputFiles('[data-testid="media-upload-input"]', {
      name: 'fallback-image.png',
      mimeType: 'image/png',
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    });
    await page.getByRole('dialog', { name: '파일 업로드' }).getByRole('button', { name: '업로드' }).click();

    await expect.poll(() => directPutUrls.length).toBe(3);
    await expect.poll(() => fallbackUploads.length).toBe(1);
    await expect.poll(() => confirmCalls).toBe(1);
    expect(fallbackUploads[0]).toMatchObject({
      method: 'PUT',
      bodySize: 4,
    });
  });
});
