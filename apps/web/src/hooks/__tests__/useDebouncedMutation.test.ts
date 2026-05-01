/**
 * useDebouncedMutation — Phase 21 E-1
 *
 * Editor 패널에서 debounced auto-save 패턴(`useRef + setTimeout`) 보일러플레이트가
 * 3개 컴포넌트에 복제되어 있던 것을 단일 훅으로 통합. round-2 (Phase 21)에서
 * applyOptimistic을 schedule 시점이 아닌 flush 시점에 호출하도록 변경 (perf-H2).
 *
 * 검증 대상:
 *   1. schedule → debounce 후 mutate 호출
 *   2. 다중 schedule → 마지막만 발화 (timer reset)
 *   3. flush() → 즉시 발화, timer 취소, pending 비움
 *   4. flush() with no pending → no-op
 *   5. cancel() → 발화 X, pending 비움, applyOptimistic도 호출 X (의도된 설계)
 *   6. merge(prev) → 누적 동작 (key merge — 같은 debounce 윈도우 내 다른 키 보존)
 *   7. applyOptimistic은 flush 시점에 호출 (schedule 시점 X) — 빠른 타이핑 시
 *      cache subscriber re-render 폭증 회피
 *   8. applyOptimistic + mutate onError → rollback + options.onError
 *   9. unmount → pending body 자동 flush (PhaseNodePanel cleanup 패턴)
 *  10. unmount with no pending → mutate 호출 X
 *  11. StrictMode 더블 mount/unmount → flush idempotent (pending null guard)
 *  12. cancel() after schedule with applyOptimistic → rollback 호출 X
 *      (cancel은 "버린다" — 외부 책임, JSDoc 계약 잠금)
 *  13. applyOptimistic이 throw → schedule 정상 / flush에서 throw 전파, hook 상태
 *      consistent (timer cleared, pending null)
 */
import { StrictMode } from "react";
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

    act(() => {
      result.current.schedule({ label: "a" }, (prev) => ({
        ...(prev ?? {}),
        label: "a",
      }));
    });
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

  it("calls applyOptimistic at flush time (not at schedule)", () => {
    const rollback = vi.fn();
    const applyOptimistic = vi.fn(() => rollback);
    const mutate = vi.fn();
    const { result } = renderHook(() =>
      useDebouncedMutation<TestBody>({ mutate, debounceMs: 500, applyOptimistic }),
    );

    // Schedule should NOT trigger optimistic side-effect — that's the perf-H2
    // fix point. Fast keystroke bursts must not write the cache N times.
    act(() => {
      result.current.schedule({ label: "x" });
    });
    expect(applyOptimistic).not.toHaveBeenCalled();
    expect(mutate).not.toHaveBeenCalled();

    // Timer fires → flushMutation → applyOptimistic invoked once with the
    // queued body, then mutate.
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(applyOptimistic).toHaveBeenCalledTimes(1);
    expect(applyOptimistic).toHaveBeenCalledWith({ label: "x" });
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(rollback).not.toHaveBeenCalled();
  });

  it("multiple schedule + flush only invokes applyOptimistic once (debounce)", () => {
    const applyOptimistic = vi.fn(() => vi.fn());
    const mutate = vi.fn();
    const { result } = renderHook(() =>
      useDebouncedMutation<TestBody>({ mutate, debounceMs: 500, applyOptimistic }),
    );

    // 5 rapid schedules within the window simulate fast typing.
    act(() => {
      for (let i = 0; i < 5; i++) {
        result.current.schedule({ label: `step-${i}` });
      }
    });
    // No optimistic side-effect yet — schedule is pure queueing.
    expect(applyOptimistic).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(500);
    });
    // Exactly one optimistic apply with the latest body.
    expect(applyOptimistic).toHaveBeenCalledTimes(1);
    expect(applyOptimistic).toHaveBeenCalledWith({ label: "step-4" });
    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it("invokes rollback and onError when mutate fires onError", () => {
    const rollback = vi.fn();
    const applyOptimistic = vi.fn(() => rollback);
    const onError = vi.fn();
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

  it("StrictMode double-mount cleanup is idempotent", () => {
    // React StrictMode (dev) intentionally mounts → unmounts → re-mounts so
    // effects must be safe to run twice. The hook's unmount cleanup calls
    // flushRef.current(); the pending-null guard inside flushMutation makes
    // a second cleanup a no-op.
    const mutate = vi.fn();
    const { result, unmount } = renderHook(
      () => useDebouncedMutation<TestBody>({ mutate, debounceMs: 1000 }),
      { wrapper: StrictMode },
    );

    act(() => {
      result.current.schedule({ label: "strict" });
    });
    unmount();
    // First cleanup flushed; second cleanup (StrictMode synthetic) is a no-op
    // because pendingRef is already null.
    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it("cancel() after schedule does NOT invoke applyOptimistic or rollback", () => {
    // Contract: `cancel` discards without firing or rollback. Since the
    // optimistic side-effect now happens at flush time, cancel never reaches
    // applyOptimistic. The caller is responsible for any UI cleanup.
    const rollback = vi.fn();
    const applyOptimistic = vi.fn(() => rollback);
    const mutate = vi.fn();
    const { result } = renderHook(() =>
      useDebouncedMutation<TestBody>({ mutate, debounceMs: 500, applyOptimistic }),
    );

    act(() => {
      result.current.schedule({ label: "cancel-me" });
    });
    act(() => {
      result.current.cancel();
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(applyOptimistic).not.toHaveBeenCalled();
    expect(rollback).not.toHaveBeenCalled();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("schedule across two debounce windows fires twice with independent bodies", () => {
    // E-12 회귀: 한 debounce cycle이 완료된 뒤 새 schedule을 시작하면 별도
    // window로 동작해야 한다. timer 재사용/누수 또는 pendingRef 비움 누락 시
    // 첫 body가 두 번째 발화에 누설되는 회귀를 잡는다.
    const mutate = vi.fn();
    const { result } = renderHook(() =>
      useDebouncedMutation<TestBody>({ mutate, debounceMs: 1000 }),
    );

    act(() => {
      result.current.schedule({ label: "first" });
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenLastCalledWith({ label: "first" }, expect.any(Object));

    // Second window — body 격리 + timer 재시작 검증.
    act(() => {
      result.current.schedule({ label: "second" });
    });
    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(mutate).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(mutate).toHaveBeenCalledTimes(2);
    expect(mutate).toHaveBeenLastCalledWith({ label: "second" }, expect.any(Object));
  });

  it("re-entrant schedule from inside mutate is queued for the next window", () => {
    // E-12 회귀: JSDoc은 mutate 콜백 안에서 schedule 동기 호출을 금지하지만
    // 실수로 호출되어도 hook이 손상되지 않아야 한다 (timer/pending invariant 유지).
    // 기대 동작: 동기 schedule은 새 timer를 arm하고 다음 window에서 1번 더 발화.
    let scheduledFollowUp = false;
    const mutate = vi.fn((_body: TestBody) => {
      if (!scheduledFollowUp) {
        scheduledFollowUp = true;
        result.current.schedule({ label: "follow-up" });
      }
    });
    const { result } = renderHook(() =>
      useDebouncedMutation<TestBody>({ mutate, debounceMs: 500 }),
    );

    act(() => {
      result.current.schedule({ label: "initial" });
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenNthCalledWith(1, { label: "initial" }, expect.any(Object));

    // re-entrant schedule이 새 timer를 arm했는지 — 다음 window에서 1번 더 발화.
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(mutate).toHaveBeenCalledTimes(2);
    expect(mutate).toHaveBeenNthCalledWith(2, { label: "follow-up" }, expect.any(Object));
  });

  it("applyOptimistic that throws leaves the hook in a consistent state", () => {
    // Defensive: if a host's setQueryData impl throws (e.g. malformed key),
    // flush must clear the timer + pending body before propagating so the
    // hook is not stuck in a half-fired state.
    const applyOptimistic = vi.fn(() => {
      throw new Error("optimistic-fail");
    });
    const mutate = vi.fn();
    const { result } = renderHook(() =>
      useDebouncedMutation<TestBody>({ mutate, debounceMs: 500, applyOptimistic }),
    );

    act(() => {
      result.current.schedule({ label: "x" });
    });
    expect(() => {
      act(() => {
        vi.advanceTimersByTime(500);
      });
    }).toThrow("optimistic-fail");

    // pendingRef was cleared *before* applyOptimistic call (flushMutation
    // clears it first), so a follow-up flush is a no-op.
    expect(mutate).not.toHaveBeenCalled();
    act(() => {
      result.current.flush();
    });
    expect(mutate).not.toHaveBeenCalled();
  });
});
