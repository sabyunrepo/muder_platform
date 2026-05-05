import { describe, expect, it } from "vitest";
import type { ApiError } from "@mmp/shared";

import { ApiHttpError } from "@/lib/api-error";
import { queryClient } from "@/services/queryClient";

function apiError(overrides: Partial<ApiError>): ApiError {
  return {
    type: "about:blank",
    title: "Service Unavailable",
    status: 503,
    detail: "temporarily unavailable",
    code: "SERVICE_UNAVAILABLE",
    ...overrides,
  };
}

describe("queryClient retry policy", () => {
  it("ProblemDetail retryable=true이면 첫 실패만 재시도한다", () => {
    const retry = queryClient.getDefaultOptions().queries?.retry;
    if (typeof retry !== "function") {
      throw new Error("query retry policy must be a function");
    }

    const error = new ApiHttpError(apiError({ retryable: true, user_action: "retry_later" }));

    expect(retry(0, error)).toBe(true);
    expect(retry(1, error)).toBe(false);
  });

  it("ProblemDetail retryable=false이면 5xx여도 재시도하지 않는다", () => {
    const retry = queryClient.getDefaultOptions().queries?.retry;
    if (typeof retry !== "function") {
      throw new Error("query retry policy must be a function");
    }

    const error = new ApiHttpError(apiError({ retryable: false }));

    expect(retry(0, error)).toBe(false);
  });
});
