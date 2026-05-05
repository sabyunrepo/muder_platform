import { describe, expect, it } from "vitest";
import type { ApiError } from "@mmp/shared";

import {
  getErrorRecoveryStrategy,
  getRecoveryAction,
  shouldRetryApiError,
} from "@/lib/error-recovery";

function apiError(overrides: Partial<ApiError>): ApiError {
  return {
    type: "about:blank",
    title: "Bad Request",
    status: 400,
    detail: "bad request",
    code: "BAD_REQUEST",
    ...overrides,
  };
}

describe("getRecoveryAction", () => {
  it("backend user_action을 프론트 복구 액션으로 변환한다", () => {
    expect(
      getRecoveryAction(
        apiError({
          status: 409,
          code: "EDITOR_CONFIG_VERSION_MISMATCH",
          user_action: "reload_or_merge",
        }),
      ),
    ).toBe("reload-or-merge");
  });

  it("user_action이 없으면 대표 code와 status로 fallback한다", () => {
    expect(getRecoveryAction(apiError({ code: "MEDIA_REFERENCE_IN_USE" }))).toBe(
      "review-references",
    );
    expect(getRecoveryAction(apiError({ status: 403, code: "FORBIDDEN" }))).toBe(
      "request-access",
    );
    expect(getRecoveryAction(apiError({ status: 503, code: "SERVICE_UNAVAILABLE" }))).toBe(
      "retry-later",
    );
  });
});

describe("getErrorRecoveryStrategy", () => {
  it("login 액션은 토스트 대신 로그인 이동 surface를 선택한다", () => {
    const strategy = getErrorRecoveryStrategy(
      apiError({ status: 401, code: "AUTH_TOKEN_EXPIRED", user_action: "login" }),
    );

    expect(strategy.surface).toBe("redirect-login");
    expect(strategy.retryable).toBe(false);
  });

  it("high severity 4xx는 더 오래 보이는 토스트로 표시한다", () => {
    const strategy = getErrorRecoveryStrategy(
      apiError({
        status: 409,
        code: "EDITOR_CONFIG_VERSION_MISMATCH",
        severity: "high",
        retryable: false,
        user_action: "reload_or_merge",
      }),
    );

    expect(strategy.surface).toBe("toast");
    expect(strategy.action).toBe("reload-or-merge");
    expect(strategy.duration).toBe(8000);
    expect(strategy.capture).toBe(false);
  });

  it("5xx는 캡처와 수동 닫기 토스트 대상으로 분류한다", () => {
    const strategy = getErrorRecoveryStrategy(
      apiError({ status: 500, code: "INTERNAL_ERROR", severity: "high" }),
    );

    expect(strategy.action).toBe("retry-later");
    expect(strategy.retryable).toBe(true);
    expect(strategy.duration).toBe(Infinity);
    expect(strategy.capture).toBe(true);
  });
});

describe("shouldRetryApiError", () => {
  it("retryable problem detail은 한 번만 조용히 재시도한다", () => {
    const error = apiError({
      status: 503,
      code: "SERVICE_UNAVAILABLE",
      retryable: true,
      user_action: "retry_later",
    });

    expect(shouldRetryApiError(error, 0)).toBe(true);
    expect(shouldRetryApiError(error, 1)).toBe(false);
  });

  it("입력/권한 오류는 retryable이 아니면 재시도하지 않는다", () => {
    expect(shouldRetryApiError(apiError({ status: 422, code: "VALIDATION_ERROR" }), 0)).toBe(
      false,
    );
    expect(shouldRetryApiError(apiError({ status: 403, code: "FORBIDDEN" }), 0)).toBe(false);
  });
});
