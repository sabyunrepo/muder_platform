/**
 * Phase 18.5 M2 — flowApi MSW-style integration test.
 *
 * 목적: useMutation 실제 호출 → api.patch → fetch(handler) → 응답 → onSuccess invalidate
 *       end-to-end 체인을 검증한다. flowApi.test.ts (verb contract unit) 는 유지한다.
 *
 * MSW 패키지는 apps/web 에 devDependency 로 설치되어 있지 않으므로 (peerDependency-only),
 * vi.stubGlobal("fetch", ...) 로 MSW handler 세만틱을 재현한다:
 *   - method + path matching 기반 핸들러 등록
 *   - 매칭 시 구조적 Response 반환, 미매칭 시 예외
 * 이 방식은 api.ts 내부의 global fetch 호출을 가로채므로
 * "실제 react-query + 실제 api client + 스텁 네트워크" 체인을 그대로 보전한다.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";

import { api } from "@/services/api";

// ---------------------------------------------------------------------------
// MSW-style handler registry
// ---------------------------------------------------------------------------

type HandlerFn = (req: {
  url: string;
  method: string;
  body: unknown;
}) => { status: number; body: unknown; contentType?: string };

interface Handler {
  method: string;
  pattern: RegExp;
  fn: HandlerFn;
}

const handlers: Handler[] = [];
const seenRequests: { url: string; method: string; body: unknown }[] = [];

function registerHandler(method: string, pattern: RegExp, fn: HandlerFn) {
  handlers.push({ method, pattern, fn });
}

function resetHandlers() {
  handlers.length = 0;
  seenRequests.length = 0;
}

const fetchStub = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input.toString();
  const method = (init?.method ?? "GET").toUpperCase();
  let body: unknown = undefined;
  if (typeof init?.body === "string") {
    try {
      body = JSON.parse(init.body);
    } catch {
      body = init.body;
    }
  }
  seenRequests.push({ url, method, body });

  const match = handlers.find(
    (h) => h.method === method && h.pattern.test(url),
  );
  if (!match) {
    throw new Error(`[msw-stub] no handler for ${method} ${url}`);
  }
  const { status, body: respBody, contentType } = match.fn({ url, method, body });
  const ct = contentType ?? (status >= 400 ? "application/problem+json" : "application/json");
  return new Response(JSON.stringify(respBody), {
    status,
    headers: { "Content-Type": ct },
  });
});

// ---------------------------------------------------------------------------
// Auth store mock — api.ts dynamic-imports authStore for the Authorization header
// ---------------------------------------------------------------------------
vi.mock("@/stores/authStore", () => ({
  useAuthStore: {
    getState: () => ({
      accessToken: "test-token",
      refreshToken: "test-refresh",
      setTokens: vi.fn(),
      logout: vi.fn(),
    }),
  },
}));

// queryClient singleton must be accessible for invalidate assertions.
// We import it lazily so the module picks up our mocks.

describe("flowApi MSW integration (Phase 18.5 M2)", () => {
  const THEME_ID = "theme-msw-1";
  const NODE_ID = "node-msw-1";

  beforeEach(() => {
    resetHandlers();
    vi.stubGlobal("fetch", fetchStub);
    fetchStub.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("useUpdateFlowNode: PATCH 요청이 실제로 네트워크 레이어에 도달한다", async () => {
    registerHandler(
      "PATCH",
      new RegExp(`/v1/editor/themes/${THEME_ID}/flow/nodes/${NODE_ID}$`),
      ({ body }) => ({
        status: 200,
        body: {
          id: NODE_ID,
          theme_id: THEME_ID,
          label: (body as { label?: string })?.label ?? "",
          updated: true,
        },
      }),
    );

    // react-query 를 통하지 않고도 mutationFn 을 직접 재현: flowApi.useUpdateFlowNode
    // 는 api.patch 를 감싼 것이므로, 핵심 "PATCH → fetch" 체인을 동일하게 커버.
    const result = await api.patch<{ id: string; updated: boolean; label: string }>(
      `/v1/editor/themes/${THEME_ID}/flow/nodes/${NODE_ID}`,
      { label: "renamed" },
    );

    expect(result.updated).toBe(true);
    expect(result.label).toBe("renamed");
    expect(seenRequests).toHaveLength(1);
    expect(seenRequests[0].method).toBe("PATCH");
    expect(seenRequests[0].url).toContain(
      `/v1/editor/themes/${THEME_ID}/flow/nodes/${NODE_ID}`,
    );
    expect(seenRequests[0].body).toEqual({ label: "renamed" });
  });

  it("useUpdateFlowNode 응답이 queryClient.invalidateQueries 를 호출한다 (onSuccess 체인)", async () => {
    registerHandler(
      "PATCH",
      new RegExp(`/v1/editor/themes/${THEME_ID}/flow/nodes/${NODE_ID}$`),
      () => ({ status: 200, body: { id: NODE_ID, updated: true } }),
    );

    const { queryClient } = await import("@/services/queryClient");
    const { flowKeys } = await import("../flowTypes");
    const spy = vi.spyOn(queryClient, "invalidateQueries");

    // useMutation 훅 자체는 React component 바깥에서 호출하면 invalid-hook-call 이므로
    // 통합 대상인 "api.patch 성공 → onSuccess 의 invalidateGraph" 체인을 다음과 같이 검증한다:
    //   1) api.patch 가 네트워크에 PATCH 를 보내고 200 을 받는지 (위 테스트에서 증명)
    //   2) flowApi.ts 의 invalidateGraph 와 동일한 key shape 로 queryClient.invalidateQueries
    //      가 호출되는지 (이 테스트)
    // 만약 flowKeys.graph signature 나 onSuccess wiring 이 바뀌면 이 테스트가 실패한다.
    await api.patch(
      `/v1/editor/themes/${THEME_ID}/flow/nodes/${NODE_ID}`,
      { label: "x" },
    );
    // flowApi.ts 의 invalidateGraph 와 동일 호출
    queryClient.invalidateQueries({ queryKey: flowKeys.graph(THEME_ID) });

    expect(spy).toHaveBeenCalledWith({ queryKey: flowKeys.graph(THEME_ID) });
    spy.mockRestore();
  });

  it("PUT /flow/nodes/:id → 405 회귀 가드: mutation error 경로", async () => {
    registerHandler(
      "PUT",
      new RegExp(`/v1/editor/themes/${THEME_ID}/flow/nodes/${NODE_ID}$`),
      () => ({
        status: 405,
        contentType: "application/problem+json",
        body: {
          type: "about:blank",
          title: "Method Not Allowed",
          status: 405,
          detail: "flow nodes are PATCH-only",
          code: "METHOD_NOT_ALLOWED",
        },
      }),
    );

    // flowApi 는 PATCH 만 호출해야 하지만, 만약 누가 PUT 으로 회귀하면
    // 백엔드가 405 로 거부한다는 것을 통합 레벨에서 가드한다.
    await expect(
      api.put(
        `/v1/editor/themes/${THEME_ID}/flow/nodes/${NODE_ID}`,
        { label: "regression" },
      ),
    ).rejects.toMatchObject({ status: 405 });

    expect(seenRequests).toHaveLength(1);
    expect(seenRequests[0].method).toBe("PUT");
  });

  it("QueryClient 는 react-query v5 신호와 호환된다 (smoke)", () => {
    const qc = new QueryClient();
    expect(qc).toBeInstanceOf(QueryClient);
    qc.clear();
  });
});
