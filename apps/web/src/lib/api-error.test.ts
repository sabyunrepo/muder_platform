import { describe, expect, it } from "vitest";
import type { ApiError } from "@mmp/shared";

import { ApiHttpError, isApiError } from "@/lib/api-error";

describe("ApiHttpError", () => {
  it("ProblemDetail 확장 필드를 throwable error에 보존한다", () => {
    const problem: ApiError = {
      type: "about:blank",
      title: "Conflict",
      status: 409,
      detail: "stale editor config",
      code: "EDITOR_CONFIG_VERSION_MISMATCH",
      request_id: "req-123456",
      trace_id: "trace-123456",
      severity: "high",
      retryable: false,
      user_action: "reload_or_merge",
    };

    const error = new ApiHttpError(problem);

    expect(error.apiError).toBe(problem);
    expect(error.status).toBe(409);
    expect(error.code).toBe("EDITOR_CONFIG_VERSION_MISMATCH");
    expect(error.requestId).toBe("req-123456");
    expect(error.traceId).toBe("trace-123456");
    expect(error.severity).toBe("high");
    expect(error.retryable).toBe(false);
    expect(error.userAction).toBe("reload_or_merge");
  });
});

describe("isApiError", () => {
  it("ProblemDetail 최소 shape만 있으면 unknown 확장 필드를 보존할 수 있게 통과시킨다", () => {
    expect(
      isApiError({
        type: "about:blank",
        title: "Conflict",
        status: 409,
        detail: "stale editor config",
        code: "EDITOR_CONFIG_VERSION_MISMATCH",
        severity: "high",
        retryable: false,
        user_action: "reload_or_merge",
      }),
    ).toBe(true);
  });
});
