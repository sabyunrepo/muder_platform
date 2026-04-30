/**
 * useDebouncedMutation — Phase 21 E-1
 *
 * Editor 패널에서 debounced auto-save 패턴(`useRef + setTimeout`) 보일러플레이트가
 * 3개 컴포넌트에 복제되어 있던 것을 단일 훅으로 통합. 테스트는 다음을 검증:
 *
 *  1. schedule → debounce 후 mutate 호출 (timer)
 *  2. 다중 schedule → 마지막만 발화 (timer reset)
 *  3. flush() → 즉시 발화, timer 취소, pending 비움
 *  4. cancel() → 발화 X, pending 비움
 *  5. merge(prev) → 누적 동작 (key merge — 동일 debounce 윈도우 내 다른 키 보존)
 *  6. applyOptimistic returning rollback → 성공 시 rollback 호출 X
 *  7. applyOptimistic + mutate onError → rollback 호출 + options.onError 호출
 *  8. unmount → pending body flush (PhaseNodePanel cleanup 패턴)
 *  9. unmount with no pending → mutate 호출 X (no-op)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDebouncedMutation } from "@/hooks/useDebouncedMutation";

interface TestBody {
  label?: string;
  count?: number;
}

describe("useDebouncedMutation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("schedules a mutation and fires after debounceMs", () => {
    const mutate = vi.fn();
    const { result } = renderHook(() =>
      useDebouncedMutation<TestBody>({ mutate, debounceMs: 1000 }),
    );

    act(() => {
      result.current.schedule({ label: "hello" });
    });
    expect(mutate).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(mutate).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledWith({ label: "hello" }, expect.any(Object));
  });

  it("resets the timer when schedule is called repeatedly", () => {
    const mutate = vi.fn();
    const { result } = renderHook(() =>
      useDebouncedMutation<TestBody>({ mutate, debounceMs: 1000 }),
    );

    act(() => {
      result.current.schedule({ label: "first" });
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    act(() => {
      result.current.schedule({ label: "second" });
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(mutate).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledWith({ label: "second" }, expect.any(Object));
  });

  it("flush() fires immediately and cancels the timer", () => {
    const mutate = vi.fn();
    const { result } = renderHook(() =>
      useDebouncedMutation<TestBody>({ mutate, debounceMs: 1000 }),
    );

    act(() => {
      result.current.schedule({ label: "now" });
    });
    act(() => {
      result.current.flush();
    });
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledWith({ label: "now" }, expect.any(Object));

    // No further fire from the canceled timer.
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it("flush() with no pending body is a no-op", () => {
    const mutate = vi.fn();
    const { result } = renderHook(() =>
      useDebouncedMutation<TestBody>({ mutate, debounceMs: 1000 }),
    );

    act(() => {
      result.current.flush();
    });
    expect(mutate).not.toHaveBeenCalled();
  });

  it("cancel() discards the pending body without firing", () => {
    const mutate = vi.fn();
    const { result } = renderHook(() =>
      useDebouncedMutation<TestBody>({ mutate, debounceMs: 1000 }),
    );

    act(() => {
      result.current.schedule({ label: "discard me" });
    });
    act(() => {
      result.current.cancel();
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(mutate).not.toHaveBeenCalled();

    // flush() after cancel is also a no-op (pending was cleared).
    act(() => {
      result.current.flush();
    });
    expect(mutate).not.toHaveBeenCalled();
  });

  it("accumulates body via merge(prev) callback", () => {
    const mutate = vi.fn();
    const { result } = renderHook(() =>
      useDebouncedMutation<TestBody>({ mutate, debounceMs: 1000 }),
    );

    // First schedule → no prev (null).
    act(() => {
      result.current.schedule({ label: "a" }, (prev) => ({
        ...(prev ?? {}),
        label: "a",
      }));
    });
    // Second schedule within window → prev = { label: "a" }.
    act(() => {
      result.current.schedule({ count: 5 }, (prev) => ({
        ...(prev ?? {}),
        count: 5,
      }));
    });

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledWith(
      { label: "a", count: 5 },
      expect.any(Object),
    );
  });

  it("calls applyOptimistic at schedule time (not at flush)", () => {
    const rollback = vi.fn();
    const applyOptimistic = vi.fn(() => rollback);
    const mutate = vi.fn();
    const { result } = renderHook(() =>
      useDebouncedMutation<TestBody>({ mutate, debounceMs: 500, applyOptimistic }),
    );

    act(() => {
      result.current.schedule({ label: "x" });
    });
    // Optimistic side-effect fires synchronously so the UI reflects the change.
    expect(applyOptimistic).toHaveBeenCalledTimes(1);
    expect(applyOptimistic).toHaveBeenCalledWith({ label: "x" });
    // Mutation is still pending — only the timer is queued.
    expect(mutate).not.toHaveBeenCalled();

    // Success path: no onError invocation → rollback not called.
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(rollback).not.toHaveBeenCalled();
  });

  it("re-captures rollback on each schedule (last-write-wins)", () => {
    const rollback1 = vi.fn();
    const rollback2 = vi.fn();
    const applyOptimistic = vi
      .fn<(body: TestBody) => () => void>()
      .mockImplementationOnce(() => rollback1)
      .mockImplementationOnce(() => rollback2);
    const mutate = vi.fn((_body: TestBody, opts: { onError: (e?: unknown) => void }) => {
      opts.onError(new Error("boom"));
    });
    const { result } = renderHook(() =>
      useDebouncedMutation<TestBody>({ mutate, debounceMs: 500, applyOptimistic }),
    );

    // First schedule captures rollback1.
    act(() => {
      result.current.schedule({ label: "a" });
    });
    // Second schedule captures rollback2, replacing rollback1 (last-write-wins).
    act(() => {
      result.current.schedule({ label: "b" });
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    // Only the most recent rollback is invoked when the mutation fails.
    expect(rollback1).not.toHaveBeenCalled();
    expect(rollback2).toHaveBeenCalledTimes(1);
  });

  it("invokes rollback and onError when mutate fires onError", () => {
    const rollback = vi.fn();
    const applyOptimistic = vi.fn(() => rollback);
    const onError = vi.fn();
    // Simulated mutation: fire onError synchronously.
    const mutate = vi.fn((_body: TestBody, opts: { onError: (err?: unknown) => void }) => {
      opts.onError(new Error("boom"));
    });

    const { result } = renderHook(() =>
      useDebouncedMutation<TestBody>({
        mutate,
        debounceMs: 500,
        applyOptimistic,
        onError,
      }),
    );

    act(() => {
      result.current.schedule({ label: "fail" });
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(rollback).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it("flushes pending body on unmount", () => {
    const mutate = vi.fn();
    const { result, unmount } = renderHook(() =>
      useDebouncedMutation<TestBody>({ mutate, debounceMs: 1000 }),
    );

    act(() => {
      result.current.schedule({ label: "pending" });
    });
    expect(mutate).not.toHaveBeenCalled();

    unmount();
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledWith(
      { label: "pending" },
      expect.any(Object),
    );
  });

  it("unmount with no pending body does not call mutate", () => {
    const mutate = vi.fn();
    const { unmount } = renderHook(() =>
      useDebouncedMutation<TestBody>({ mutate, debounceMs: 1000 }),
    );

    unmount();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("isPending reflects the queued state", () => {
    const mutate = vi.fn();
    const { result, rerender } = renderHook(() =>
      useDebouncedMutation<TestBody>({ mutate, debounceMs: 1000 }),
    );

    expect(result.current.isPending).toBe(false);

    act(() => {
      result.current.schedule({ label: "x" });
    });
    rerender();
    expect(result.current.isPending).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    rerender();
    expect(result.current.isPending).toBe(false);
  });
});
