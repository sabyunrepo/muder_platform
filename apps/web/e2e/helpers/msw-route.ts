/**
 * Phase 18.8 PR-2 — MSW handler → Playwright `page.route` 어댑터.
 *
 * Service Worker 없이 Playwright 단계에서 MSW v2 RequestHandler 를 그대로 사용한다.
 * 동일한 MSW 정의(`apps/web/src/mocks/handlers/**`) 를 Vitest, Playwright,
 * (장래) Storybook 이 공유하기 위한 SSOT 어댑터.
 *
 * 동작:
 *  1. Playwright route 가 발생하면 fetch Request 로 변환
 *  2. MSW HttpHandler.run() 으로 매칭 시도 (path/method/params)
 *  3. 매칭되면 MSW Response → Playwright fulfill 변환
 *  4. 미매칭이면 route.fallback() (다른 route 또는 실제 네트워크)
 */
import type { Page, Route, Request as PlaywrightRequest } from "@playwright/test";
import type { HttpHandler, RequestHandler } from "msw";

function toFetchRequest(req: PlaywrightRequest): Request {
  const headers: Record<string, string> = { ...req.headers() };
  // Playwright headers() always includes ":method" / ":path" pseudo on HTTP/2 — drop those.
  for (const k of Object.keys(headers)) {
    if (k.startsWith(":")) delete headers[k];
  }
  const init: RequestInit = { method: req.method(), headers };
  const body = req.postData();
  if (body && req.method() !== "GET" && req.method() !== "HEAD") {
    init.body = body;
  }
  return new Request(req.url(), init);
}

async function fulfillFromMswResponse(route: Route, response: Response): Promise<void> {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  const buf = await response.arrayBuffer();
  await route.fulfill({
    status: response.status,
    headers,
    body: Buffer.from(buf),
  });
}

/**
 * Playwright `page.route` 에 MSW handler 들을 설치한다.
 *
 * **Scope (fix-loop 1)**: `**\/v1/**` 만 가로챈다. 모든 handler 가
 * `*\/v1/...` prefix 로 정의돼 있어 광역 `**\/*` 는 정적 asset / HMR /
 * `/health` 등 무관 트래픽까지 가로채 불필요한 처리 비용 + 페이지 로드 지연을
 * 유발했다. asset 은 그대로 통과시키고 API 만 mocking 한다.
 *
 * @param page Playwright page
 * @param handlers MSW v2 RequestHandler 배열 (예: `handlers/index.ts` 의 `handlers`)
 */
export async function installMswRoutes(
  page: Page,
  handlers: RequestHandler[],
): Promise<void> {
  await page.route("**/v1/**", async (route, request) => {
    const fetchReq = toFetchRequest(request);
    for (const handler of handlers) {
      const httpHandler = handler as HttpHandler;
      // MSW v2 HttpHandler.run({ request }) returns { response, ... } if matched, else null.
      // We use the public `run` signature available in msw@^2.
      const result = await httpHandler
        .run({ request: fetchReq.clone() })
        .catch(() => null);
      if (result?.response) {
        await fulfillFromMswResponse(route, result.response);
        return;
      }
    }
    await route.fallback();
  });
}
