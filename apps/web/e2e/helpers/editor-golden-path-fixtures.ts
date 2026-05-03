/**
 * Phase 18.4 PR-7 / HIGH-1 — editor golden path 공용 fixture.
 *
 * mocked-backend 전용. 9 시나리오의 모든 API 라우트 + mutable state 를 캡슐화.
 *
 * HIGH-1 변경: page.evaluate(fetch) 대신 UI interaction 경로를 검증할 수 있도록
 * - 메서드별 호출 카운터 (flowPatchCalls/flowPutCalls, configPutCalls, imageUploadUrlCalls)
 * - method별 분기 fulfill
 * - allRequests 누적 로그
 * 를 추가한다.
 */
import type { Page } from "@playwright/test";

export const BASE = "http://localhost:3000";
export const THEME_ID = "00000000-0000-0000-0000-000000000184";
export const CLUE_ID = "cccccccc-0000-0000-0000-000000000001";
export const MAP_ID = "bbbbbbbb-0000-0000-0000-000000000001";
export const LOCATION_ID = "dddddddd-0000-0000-0000-000000000001";
export const FLOW_NODE_ID = "eeeeeeee-0000-0000-0000-000000000001";

export interface RecordedRequest {
  url: string;
  method: string;
}

export interface MockState {
  configVersion: number;
  configJson: Record<string, unknown>;
  clueImageURL: string | null;
  startingClueIds: string[];
  locationClueIds: string[];
  moduleToggles: Record<string, boolean>;
  /** N 중 1회 409 반환 (silent rebase 테스트) */
  conflictCountdown: number;
  flowPatchCalls: number;
  flowPutCalls: number;
  characterUpdateCalls: number;
  lastCharacterUpdateBody: Record<string, unknown> | null;
  characterMysteryRole: "suspect" | "culprit" | "accomplice" | "detective";
  roleSheet: Record<string, unknown>;
  configPutCalls: number;
  imageUploadUrlCalls: number;
  templatesCalls: number;
  clueRelationsCalls: number;
  allRequests: RecordedRequest[];
}

export function freshState(): MockState {
  return {
    configVersion: 1,
    configJson: { characters: [], locations: [], modules: {}, module_configs: {} },
    clueImageURL: null,
    startingClueIds: [],
    locationClueIds: [],
    moduleToggles: {},
    conflictCountdown: 1,
    flowPatchCalls: 0,
    flowPutCalls: 0,
    characterUpdateCalls: 0,
    lastCharacterUpdateBody: null,
    characterMysteryRole: "detective",
    roleSheet: {
      character_id: "char-1",
      theme_id: THEME_ID,
      format: "markdown",
      markdown: { body: "" },
    },
    configPutCalls: 0,
    imageUploadUrlCalls: 0,
    templatesCalls: 0,
    clueRelationsCalls: 0,
    allRequests: [],
  };
}

export async function mockCommonApis(page: Page, state: MockState): Promise<void> {
  // 전역 요청 로거 — UI interaction 이 실제로 어떤 엔드포인트를 때리는지 가시화
  page.on("request", (req) => {
    const url = req.url();
    if (url.includes("/v1/editor/") || url.includes("/v1/templates") || url.includes("/api/v1/templates")) {
      state.allRequests.push({ url, method: req.method() });
    }
  });

  // HIGH-1 회귀 가드: 흐름 노드는 PATCH 만 허용. PUT 요청이 발생하면 테스트가 감지하도록
  // 405 대신 예외를 던지지 않고 카운터 증가 + 405 응답 유지 (프론트가 PUT 을 쓰면 카운터로 실패)

  await page.route("**/v1/auth/me", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "user-1",
        nickname: "테스터",
        email: "e2e@test.com",
        avatar_url: null,
        role: "user",
        provider: "local",
      }),
    }),
  );

  await page.route("**/v1/auth/refresh", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        access_token: "e2e-access-token",
        refresh_token: "e2e-refresh-token",
        expires_in: 3600,
      }),
    }),
  );

  // #9 templates
  for (const pattern of ["**/api/v1/templates", "**/v1/templates"]) {
    await page.route(pattern, (r) => {
      state.templatesCalls += 1;
      return r.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    });
  }

  await page.route("**/v1/editor/themes", async (r) => {
    const method = r.request().method();
    if (method === "POST") {
      return r.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(themePayload(state)),
      });
    }
    return r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([themeListEntry(state)]),
    });
  });

  await page.route(`**/v1/editor/themes/${THEME_ID}`, (r) => {
    if (r.request().method() !== "GET") return r.continue();
    return r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(themePayload(state)),
    });
  });

  await page.route(`**/v1/editor/themes/${THEME_ID}/clues`, (r) => {
    if (r.request().method() !== "GET") return r.continue();
    return r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([cluePayload(state)]),
    });
  });

  // #5 clue-edges 빈 결과 200 (Phase 20 PR-6: /clue-relations → /clue-edges)
  await page.route(`**/v1/editor/themes/${THEME_ID}/clue-edges`, (r) => {
    if (r.request().method() === "PUT") return r.continue();
    state.clueRelationsCalls += 1;
    return r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });

  await page.route(`**/v1/editor/themes/${THEME_ID}/maps`, (r) => {
    if (r.request().method() !== "GET") return r.continue();
    return r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: MAP_ID,
          theme_id: THEME_ID,
          name: "저택 1층",
          image_url: null,
          sort_order: 0,
          created_at: new Date().toISOString(),
        },
      ]),
    });
  });

  await page.route(`**/v1/editor/themes/${THEME_ID}/locations`, (r) => {
    if (r.request().method() !== "GET") return r.continue();
    return r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: LOCATION_ID,
          theme_id: THEME_ID,
          map_id: MAP_ID,
          name: "거실",
          restricted_characters: "char-1",
          image_url: "https://mock-storage.example/themes/location.png",
          from_round: 2,
          until_round: 4,
          sort_order: 0,
          created_at: new Date().toISOString(),
          clueIds: state.locationClueIds,
        },
      ]),
    });
  });

  await page.route(`**/v1/editor/themes/${THEME_ID}/characters`, (r) => {
    if (r.request().method() !== "GET") return r.continue();
    return r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([characterPayload(state)]),
    });
  });

  await page.route("**/v1/editor/characters/char-1", async (r) => {
    if (r.request().method() !== "PUT") return r.continue();
    const body = JSON.parse(r.request().postData() ?? "{}") as Record<string, unknown>;
    state.characterUpdateCalls += 1;
    state.lastCharacterUpdateBody = body;
    if (
      body.mystery_role === "suspect" ||
      body.mystery_role === "culprit" ||
      body.mystery_role === "accomplice" ||
      body.mystery_role === "detective"
    ) {
      state.characterMysteryRole = body.mystery_role;
    } else if (body.is_culprit === true) {
      state.characterMysteryRole = "culprit";
    } else if (body.is_culprit === false) {
      state.characterMysteryRole = "suspect";
    }
    return r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(characterPayload(state)),
    });
  });

  await page.route("**/v1/editor/characters/char-1/role-sheet", async (r) => {
    const method = r.request().method();
    if (method === "PUT") {
      const body = JSON.parse(r.request().postData() ?? "{}") as Record<string, unknown>;
      state.roleSheet = {
        ...body,
        character_id: "char-1",
        theme_id: THEME_ID,
        updated_at: new Date().toISOString(),
      };
      return r.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(state.roleSheet),
      });
    }
    if (method === "GET") {
      return r.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(state.roleSheet),
      });
    }
    return r.fulfill({
      status: 405,
      contentType: "application/problem+json",
      body: JSON.stringify({
        type: "about:blank",
        title: "Method Not Allowed",
        status: 405,
        detail: "method not allowed",
      }),
    });
  });

  await page.route(`**/v1/editor/themes/${THEME_ID}/content/**`, (r) => {
    const url = new URL(r.request().url());
    const key = decodeURIComponent(url.pathname.split("/content/")[1] ?? "");
    const id = `content-${key.replace(/[^a-zA-Z0-9_-]/g, "-") || "unknown"}`;

    if (r.request().method() === "PUT") {
      return r.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id,
          theme_id: THEME_ID,
          key,
          body: JSON.parse(r.request().postData() ?? "{}").body ?? "",
          version: 2,
          updated_at: new Date().toISOString(),
        }),
      });
    }
    return r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id,
        theme_id: THEME_ID,
        key,
        body: "",
        version: 1,
        updated_at: new Date().toISOString(),
      }),
    });
  });

  // #2 upload-url — 프론트가 이 경로로 호출하는지 확인
  await page.route(`**/v1/editor/themes/${THEME_ID}/images/upload-url`, (r) => {
    state.imageUploadUrlCalls += 1;
    return r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        upload_url: `https://mock-storage.example/upload/${CLUE_ID}`,
        object_key: `themes/${THEME_ID}/clues/${CLUE_ID}/image.png`,
        public_url: `https://mock-storage.example/themes/${THEME_ID}/clues/${CLUE_ID}/image.png`,
      }),
    });
  });

  // #6 config 409 silent rebase
  await page.route(`**/v1/editor/themes/${THEME_ID}/config`, async (r) => {
    if (r.request().method() !== "PUT") return r.continue();
    state.configPutCalls += 1;
    const body = JSON.parse(r.request().postData() ?? "{}");
    if (state.conflictCountdown > 0 && body.version === state.configVersion) {
      state.conflictCountdown -= 1;
      return r.fulfill({
        status: 409,
        contentType: "application/problem+json",
        body: JSON.stringify({
          type: "about:blank",
          title: "Conflict",
          status: 409,
          detail: "version mismatch",
          current_version: state.configVersion + 1,
          current_config: state.configJson,
        }),
      });
    }
    state.configVersion = (body.version ?? state.configVersion) + 1;
    state.configJson = { ...state.configJson, ...(body.config_json ?? {}) };
    return r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ version: state.configVersion, config_json: state.configJson }),
    });
  });

  // #7 flow nodes — PATCH 만 허용 (PUT 호출 시 카운터 증가해서 테스트가 감지)
  await page.route(`**/v1/editor/themes/${THEME_ID}/flow/nodes/${FLOW_NODE_ID}`, async (r) => {
    const method = r.request().method();
    if (method === "PATCH") {
      state.flowPatchCalls += 1;
      return r.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: FLOW_NODE_ID, updated: true }),
      });
    }
    if (method === "PUT") {
      state.flowPutCalls += 1;
      return r.fulfill({
        status: 405,
        contentType: "application/problem+json",
        body: JSON.stringify({ title: "Method Not Allowed", status: 405 }),
      });
    }
    return r.continue();
  });
}

function themePayload(state: MockState) {
  return {
    id: THEME_ID,
    title: "E2E 골든패스",
    slug: "e2e-golden",
    status: "draft",
    min_players: 4,
    max_players: 8,
    duration_min: 90,
    price: 0,
    coin_price: 0,
    version: state.configVersion,
    config_json: state.configJson,
    created_at: new Date().toISOString(),
  };
}

function themeListEntry(state: MockState) {
  const { config_json: _, ...rest } = themePayload(state);
  return rest;
}

function cluePayload(state: MockState) {
  return {
    id: CLUE_ID,
    theme_id: THEME_ID,
    name: "첫 단서",
    level: 1,
    sort_order: 0,
    is_common: false,
    is_usable: true,
    use_effect: "reveal",
    use_target: "self",
    use_consumed: true,
    image_url: state.clueImageURL,
    created_at: new Date().toISOString(),
  };
}

function characterPayload(state: MockState) {
  return {
    id: "char-1",
    theme_id: THEME_ID,
    name: "탐정 A",
    description: "사건을 추적하는 탐정입니다.",
    image_url: null,
    is_culprit: state.characterMysteryRole === "culprit",
    mystery_role: state.characterMysteryRole,
    starting_clue_ids: state.startingClueIds,
    sort_order: 0,
    created_at: new Date().toISOString(),
  };
}

export async function loginAsE2EUser(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem("mmp_refresh_token", "e2e-refresh-token");
      window.localStorage.setItem(
        "auth_user",
        JSON.stringify({ id: "user-1", email: "e2e@test.com" }),
      );
    } catch {
      /* ignore */
    }
  });
  await page.goto(`${BASE}/`);
}
