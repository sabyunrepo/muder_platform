import { test, expect, type Page } from '@playwright/test';
import {
  BASE,
  THEME_ID,
  MAP_ID,
  freshState,
  loginAsE2EUser,
  mockCommonApis,
} from './helpers/editor-golden-path-fixtures';

const PARENT_LOCATION_ID = 'dddddddd-0000-0000-0000-000000000101';
const CHILD_LOCATION_ID = 'dddddddd-0000-0000-0000-000000000102';

type E2ELocation = {
  id: string;
  theme_id: string;
  map_id: string;
  name: string;
  restricted_characters: string | null;
  image_url: string | null;
  parent_location_id: string | null;
  sort_order: number;
  created_at: string;
};

function baseLocation(id: string, name: string, sortOrder: number): E2ELocation {
  return {
    id,
    theme_id: THEME_ID,
    map_id: MAP_ID,
    name,
    restricted_characters: null,
    image_url: null,
    parent_location_id: null,
    sort_order: sortOrder,
    created_at: '2026-05-17T00:00:00Z',
  };
}

async function installLocationHierarchyRoutes(page: Page) {
  const state = {
    locations: [
      baseLocation(PARENT_LOCATION_ID, '거실', 0),
      baseLocation(CHILD_LOCATION_ID, '금고', 1),
    ],
    lastUpdateBody: null as Record<string, unknown> | null,
  };

  await page.route(`**/v1/editor/themes/${THEME_ID}/locations`, (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(state.locations),
    });
  });

  await page.route(`**/v1/editor/locations/${CHILD_LOCATION_ID}`, async (route) => {
    if (route.request().method() !== 'PUT') return route.continue();
    const body = JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>;
    state.lastUpdateBody = body;
    state.locations = state.locations.map((location) =>
      location.id === CHILD_LOCATION_ID
        ? {
            ...location,
            parent_location_id: (body.parent_location_id as string | null) ?? null,
            sort_order: typeof body.sort_order === 'number' ? body.sort_order : location.sort_order,
          }
        : location
    );
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(state.locations.find((location) => location.id === CHILD_LOCATION_ID)),
    });
  });

  return state;
}

test.describe('location hierarchy clue placement', () => {
  test('장소 계층 저장 후 새로고침해도 하위장소와 단서 조사 경로가 복원된다', async ({ page }) => {
    const commonState = freshState();
    await mockCommonApis(page, commonState);
    const hierarchyState = await installLocationHierarchyRoutes(page);
    await loginAsE2EUser(page);

    await page.goto(`${BASE}/editor/${THEME_ID}/locations`);
    await expect(page.getByLabel('장소 목록')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: '금고 선택' }).click();

    const updateUrl = `/v1/editor/locations/${CHILD_LOCATION_ID}`;
    const updateRequest = page.waitForRequest(
      (request) =>
        request.method() === 'PUT' && request.url().includes(updateUrl)
    );
    const updateResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'PUT' && response.url().includes(updateUrl)
    );
    await page.getByRole('combobox', { name: '금고 상위 장소' }).selectOption(PARENT_LOCATION_ID);
    const request = await updateRequest;
    await updateResponse;
    expect(JSON.parse(request.postData() ?? '{}')).toMatchObject({
      parent_location_id: PARENT_LOCATION_ID,
    });
    expect(hierarchyState.lastUpdateBody).toMatchObject({
      parent_location_id: PARENT_LOCATION_ID,
    });

    await page.reload();
    await expect(page.getByLabel('장소 목록')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: '거실 / 금고 선택' }).click();
    await expect(page.getByLabel('거실 / 금고 단서 조사')).toBeVisible({ timeout: 10_000 });
  });
});
