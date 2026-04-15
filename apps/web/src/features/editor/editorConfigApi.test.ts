import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/services/api", () => ({
  api: { put: vi.fn() },
}));

const invalidateSpy = vi.fn();
vi.mock("@/services/queryClient", () => ({
  queryClient: {
    invalidateQueries: (...args: unknown[]) => invalidateSpy(...args),
  },
}));

// Imports must come after mocks.
import { api } from "@/services/api";
import { ApiHttpError } from "@/lib/api-error";
import { useUpdateConfigJson, readCurrentVersion } from "./editorConfigApi";
import type { ApiError } from "@mmp/shared";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return React.createElement(
    QueryClientProvider,
    { client },
    children as React.ReactElement,
  );
}

function conflictError(extensions?: Record<string, unknown>): ApiHttpError {
  const body: ApiError & { extensions?: Record<string, unknown> } = {
    type: "about:blank",
    title: "Conflict",
    status: 409,
    detail: "optimistic lock",
    code: "OPTIMISTIC_LOCK",
    ...(extensions ? { extensions } : {}),
  };
  return new ApiHttpError(body);
}

const themeResponse = { id: "t1", version: 42 };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("readCurrentVersion", () => {
  it("returns the numeric extension when present", () => {
    const err: ApiError & { extensions?: Record<string, unknown> } = {
      type: "about:blank",
      title: "Conflict",
      status: 409,
      detail: "",
      extensions: { current_version: 7 },
    };
    expect(readCurrentVersion(err)).toBe(7);
  });

  it("returns null when extensions is absent", () => {
    const err: ApiError = {
      type: "about:blank",
      title: "Conflict",
      status: 409,
      detail: "",
    };
    expect(readCurrentVersion(err)).toBeNull();
  });

  it("returns null when current_version is not a finite number", () => {
    const err: ApiError & { extensions?: Record<string, unknown> } = {
      type: "about:blank",
      title: "Conflict",
      status: 409,
      detail: "",
      extensions: { current_version: "nope" },
    };
    expect(readCurrentVersion(err)).toBeNull();
  });
});

describe("useUpdateConfigJson — 409 silent rebase", () => {
  it("retries once with current_version when first PUT returns 409", async () => {
    const putMock = api.put as unknown as ReturnType<typeof vi.fn>;
    putMock
      .mockRejectedValueOnce(conflictError({ current_version: 99 }))
      .mockResolvedValueOnce(themeResponse);

    const onConflict = vi.fn();
    const { result } = renderHook(
      () => useUpdateConfigJson("theme-1", { onConflictAfterRetry: onConflict }),
      { wrapper },
    );

    result.current.mutate({ modules: ["a"], version: 1 });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(putMock).toHaveBeenCalledTimes(2);
    const [, secondPayload] = putMock.mock.calls[1] as [string, { version: number }];
    expect(secondPayload.version).toBe(99);
    expect(onConflict).not.toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["editor", "themes", "theme-1"],
    });
  });

  it("fires onConflictAfterRetry when the retried request also 409s", async () => {
    const putMock = api.put as unknown as ReturnType<typeof vi.fn>;
    putMock
      .mockRejectedValueOnce(conflictError({ current_version: 5 }))
      .mockRejectedValueOnce(conflictError({ current_version: 6 }));

    const onConflict = vi.fn();
    const { result } = renderHook(
      () => useUpdateConfigJson("theme-1", { onConflictAfterRetry: onConflict }),
      { wrapper },
    );

    result.current.mutate({ modules: ["a"], version: 1 });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(putMock).toHaveBeenCalledTimes(2);
    expect(onConflict).toHaveBeenCalledOnce();
  });

  it("skips retry for 409 without current_version (back-compat)", async () => {
    const putMock = api.put as unknown as ReturnType<typeof vi.fn>;
    putMock.mockRejectedValueOnce(conflictError());

    const onConflict = vi.fn();
    const { result } = renderHook(
      () => useUpdateConfigJson("theme-1", { onConflictAfterRetry: onConflict }),
      { wrapper },
    );

    result.current.mutate({ modules: ["a"], version: 1 });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(putMock).toHaveBeenCalledTimes(1);
    expect(onConflict).toHaveBeenCalledOnce();
  });

  it("propagates non-409 errors without retrying or calling onConflictAfterRetry", async () => {
    const putMock = api.put as unknown as ReturnType<typeof vi.fn>;
    putMock.mockRejectedValueOnce(
      new ApiHttpError({
        type: "about:blank",
        title: "Server Error",
        status: 500,
        detail: "boom",
      }),
    );

    const onConflict = vi.fn();
    const { result } = renderHook(
      () => useUpdateConfigJson("theme-1", { onConflictAfterRetry: onConflict }),
      { wrapper },
    );

    result.current.mutate({ modules: ["a"], version: 1 });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(putMock).toHaveBeenCalledTimes(1);
    expect(onConflict).not.toHaveBeenCalled();
  });

  it("invalidates theme query on success (no conflict)", async () => {
    const putMock = api.put as unknown as ReturnType<typeof vi.fn>;
    putMock.mockResolvedValueOnce(themeResponse);

    const { result } = renderHook(() => useUpdateConfigJson("theme-1"), {
      wrapper,
    });
    result.current.mutate({ modules: [], version: 1 });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["editor", "themes", "theme-1"],
    });
  });
});
