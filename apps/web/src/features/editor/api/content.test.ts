import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { mockGet, mockPut, mockPost } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPut: vi.fn(),
  mockPost: vi.fn(),
}));

vi.mock("@/services/api", () => ({
  api: { get: mockGet, put: mockPut, post: mockPost },
}));

let testQueryClient: QueryClient;

vi.mock("@/services/queryClient", () => ({
  get queryClient() {
    return testQueryClient;
  },
}));

import { useEditorContent } from "./content";
import type { ContentResponse } from "./types";

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(
    QueryClientProvider,
    { client: testQueryClient },
    children,
  );
}

describe("editor content API hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testQueryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  it("uses the QueryClient default retry policy for content loads", async () => {
    const retry = vi.fn((failureCount: number) => failureCount < 1);
    testQueryClient = new QueryClient({
      defaultOptions: { queries: { retry, retryDelay: 0 }, mutations: { retry: false } },
    });
    const content: ContentResponse = {
      id: "content-1",
      theme_id: "theme-1",
      key: "intro",
      body: "환영합니다",
      updated_at: "2026-05-05T00:00:00Z",
    };
    mockGet.mockRejectedValueOnce(new Error("temporary"));
    mockGet.mockResolvedValueOnce(content);

    const { result } = renderHook(() => useEditorContent("theme-1", "intro"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(mockGet).toHaveBeenCalledWith("/v1/editor/themes/theme-1/content/intro");
    expect(retry).toHaveBeenCalled();
    expect(result.current.data).toEqual(content);
  });
});
