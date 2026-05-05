import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { mockGet, mockPut } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPut: vi.fn(),
}));

vi.mock("@/services/api", () => ({
  api: { get: mockGet, put: mockPut },
}));

let testQueryClient: QueryClient;

vi.mock("@/services/queryClient", () => ({
  get queryClient() {
    return testQueryClient;
  },
}));

import { editorKeys } from "./keys";
import { useCharacterRoleSheet, useUpsertCharacterRoleSheet } from "./roleSheets";
import type { RoleSheetResponse } from "./types";

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(
    QueryClientProvider,
    { client: testQueryClient },
    children,
  );
}

describe("editor role sheet API hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testQueryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  it("builds the character role sheet query key", () => {
    expect(editorKeys.characterRoleSheet("char-1")).toEqual([
      "editor",
      "characters",
      "char-1",
      "role-sheet",
    ]);
  });

  it("loads a role sheet from the typed character endpoint", async () => {
    const roleSheet: RoleSheetResponse = {
      character_id: "char-1",
      theme_id: "theme-1",
      format: "markdown",
      markdown: { body: "## 비밀" },
      updated_at: "2026-05-02T00:00:00Z",
    };
    mockGet.mockResolvedValue(roleSheet);

    const { result } = renderHook(() => useCharacterRoleSheet("char-1"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith("/v1/editor/characters/char-1/role-sheet");
    expect(result.current.data).toEqual(roleSheet);
  });

  it("uses the QueryClient default retry policy for role sheet loads", async () => {
    const retry = vi.fn((failureCount: number) => failureCount < 1);
    testQueryClient = new QueryClient({
      defaultOptions: { queries: { retry, retryDelay: 0 }, mutations: { retry: false } },
    });
    const roleSheet: RoleSheetResponse = {
      character_id: "char-1",
      theme_id: "theme-1",
      format: "markdown",
      markdown: { body: "## 비밀" },
    };
    mockGet.mockRejectedValueOnce(new Error("temporary"));
    mockGet.mockResolvedValueOnce(roleSheet);

    const { result } = renderHook(() => useCharacterRoleSheet("char-1"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(retry).toHaveBeenCalled();
    expect(result.current.data).toEqual(roleSheet);
  });

  it("upserts a markdown role sheet and invalidates its query", async () => {
    const roleSheet: RoleSheetResponse = {
      character_id: "char-1",
      theme_id: "theme-1",
      format: "markdown",
      markdown: { body: "## 새 역할지" },
    };
    mockPut.mockResolvedValue(roleSheet);
    const invalidateSpy = vi.spyOn(testQueryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpsertCharacterRoleSheet("char-1"), { wrapper });

    await result.current.mutateAsync({
      format: "markdown",
      markdown: { body: "## 새 역할지" },
    });

    expect(mockPut).toHaveBeenCalledWith(
      "/v1/editor/characters/char-1/role-sheet",
      { format: "markdown", markdown: { body: "## 새 역할지" } },
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: editorKeys.characterRoleSheet("char-1"),
    });
  });

  it("upserts a pdf role sheet and invalidates its query", async () => {
    const roleSheet: RoleSheetResponse = {
      character_id: "char-1",
      theme_id: "theme-1",
      format: "pdf",
      pdf: { media_id: "media-pdf-1" },
    };
    mockPut.mockResolvedValue(roleSheet);
    const invalidateSpy = vi.spyOn(testQueryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpsertCharacterRoleSheet("char-1"), { wrapper });

    await result.current.mutateAsync({
      format: "pdf",
      pdf: { media_id: "media-pdf-1" },
    });

    expect(mockPut).toHaveBeenCalledWith(
      "/v1/editor/characters/char-1/role-sheet",
      { format: "pdf", pdf: { media_id: "media-pdf-1" } },
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: editorKeys.characterRoleSheet("char-1"),
    });
  });

  it("upserts an image role sheet and invalidates its query", async () => {
    const roleSheet: RoleSheetResponse = {
      character_id: "char-1",
      theme_id: "theme-1",
      format: "images",
      images: { image_urls: ["https://cdn.example/role-1.webp"] },
    };
    mockPut.mockResolvedValue(roleSheet);
    const invalidateSpy = vi.spyOn(testQueryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpsertCharacterRoleSheet("char-1"), { wrapper });

    await result.current.mutateAsync({
      format: "images",
      images: { image_urls: ["https://cdn.example/role-1.webp"] },
    });

    expect(mockPut).toHaveBeenCalledWith(
      "/v1/editor/characters/char-1/role-sheet",
      { format: "images", images: { image_urls: ["https://cdn.example/role-1.webp"] } },
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: editorKeys.characterRoleSheet("char-1"),
    });
  });
});
