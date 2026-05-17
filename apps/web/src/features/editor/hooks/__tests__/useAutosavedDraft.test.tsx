import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAutosavedDraft } from "../useAutosavedDraft";

interface ServerValue {
  id: string;
  title: string;
  version: number;
}

interface DraftValue {
  title: string;
  version: number;
}

function toDraft(value: ServerValue): DraftValue {
  return { title: value.title, version: value.version };
}

function isEqual(left: DraftValue, right: DraftValue) {
  return left.title === right.title && left.version === right.version;
}

describe("useAutosavedDraft", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("preserves a dirty draft when the same entity refetches stale server data", () => {
    const save = vi.fn().mockResolvedValue({ id: "info-1", title: "지도", version: 2 });
    const { result, rerender } = renderHook(
      ({ serverValue }: { serverValue: ServerValue }) =>
        useAutosavedDraft<ServerValue, DraftValue, DraftValue>({
          serverValue,
          serverKey: serverValue.id,
          debounceMs: 1000,
          toDraft,
          isEqual,
          buildSaveBody: (draft) => draft,
          save,
        }),
      {
        initialProps: {
          serverValue: { id: "info-1", title: "지", version: 1 },
        },
      },
    );

    act(() => {
      result.current.setDraft({ title: "지도", version: 1 });
    });
    rerender({ serverValue: { id: "info-1", title: "지", version: 1 } });

    expect(result.current.draft.title).toBe("지도");
    expect(result.current.isDirty).toBe(true);
  });

  it("accepts server data when there are no local changes", () => {
    const save = vi.fn().mockResolvedValue({ id: "info-1", title: "지도", version: 2 });
    const { result, rerender } = renderHook(
      ({ serverValue }: { serverValue: ServerValue }) =>
        useAutosavedDraft<ServerValue, DraftValue, DraftValue>({
          serverValue,
          serverKey: serverValue.id,
          debounceMs: 1000,
          toDraft,
          isEqual,
          buildSaveBody: (draft) => draft,
          save,
        }),
      {
        initialProps: {
          serverValue: { id: "info-1", title: "지", version: 1 },
        },
      },
    );

    rerender({ serverValue: { id: "info-1", title: "지도", version: 2 } });

    expect(result.current.draft).toEqual({ title: "지도", version: 2 });
    expect(result.current.baseline).toEqual({ title: "지도", version: 2 });
    expect(result.current.isDirty).toBe(false);
  });

  it("clears dirty state only for the draft that was submitted", async () => {
    const serverValue = { id: "info-1", title: "", version: 1 };
    const save = vi.fn().mockResolvedValue({ id: "info-1", title: "지", version: 2 });
    const { result } = renderHook(() =>
      useAutosavedDraft<ServerValue, DraftValue, DraftValue>({
        serverValue,
        serverKey: "info-1",
        debounceMs: 1000,
        toDraft,
        isEqual,
        buildSaveBody: (draft) => draft,
        save,
      }),
    );

    act(() => {
      result.current.setDraft({ title: "지", version: 1 });
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    act(() => {
      result.current.setDraft({ title: "지도", version: 1 });
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(save).toHaveBeenCalledTimes(1);
    expect(result.current.draft.title).toBe("지도");
    expect(result.current.isDirty).toBe(true);
  });

  it("saveNow flushes the current draft immediately", async () => {
    const serverValue = { id: "info-1", title: "", version: 1 };
    const save = vi.fn().mockResolvedValue({ id: "info-1", title: "즉시 저장", version: 2 });
    const { result } = renderHook(() =>
      useAutosavedDraft<ServerValue, DraftValue, DraftValue>({
        serverValue,
        serverKey: "info-1",
        debounceMs: 1000,
        toDraft,
        isEqual,
        buildSaveBody: (draft) => draft,
        save,
      }),
    );

    act(() => {
      result.current.setDraft({ title: "즉시 저장", version: 1 });
    });
    act(() => {
      result.current.saveNow();
    });

    await act(async () => {
      await Promise.resolve();
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({ title: "즉시 저장", version: 1 });
  });
});
