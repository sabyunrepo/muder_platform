/**
 * useDebouncedMutation — debounced auto-save 훅 (Phase 21 E-1).
 *
 * Editor 패널의 `useRef + setTimeout` debounce 패턴을 단일 훅으로 통합. PhaseNodePanel /
 * CharacterAssignPanel / EndingNodePanel의 보일러플레이트 (debounceRef + pendingRef +
 * flush + onBlur + unmount cleanup)를 캡슐화한다.
 *
 * Optimistic side-effect는 `schedule` 시점에 즉시 적용되어 UI가 같은 tick 안에서 반영되고,
 * `applyOptimistic`이 반환한 rollback 함수는 훅 내부에 저장되었다가 mutation의 `onError`에
 * 연결된다. 다중 schedule 호출 시 매번 새 rollback이 캡처되며 (기존 single-ref 패턴과
 * 동일한 의미론) — last-write-wins 의도이므로 동시 편집 race는 호출자가 처리한다.
 *
 * @example
 * const updateNode = useUpdateFlowNode(themeId);
 * const queryClient = useQueryClient();
 * const debouncer = useDebouncedMutation<FlowNodeData>({
 *   debounceMs: 1500,
 *   mutate: (body, opts) =>
 *     updateNode.mutate({ nodeId, body: { data: body } }, opts),
 *   applyOptimistic: (body) => {
 *     const key = flowKeys.graph(themeId);
 *     const prev = queryClient.getQueryData<FlowGraphResponse>(key);
 *     if (!prev) return null;
 *     queryClient.setQueryData(key, patchedSnapshot(prev, body));
 *     return () => queryClient.setQueryData(key, prev);
 *   },
 *   onError: () => toast.error('저장에 실패했습니다'),
 * });
 *
 * // input change → debouncer.schedule(merged); blur → debouncer.flush();
 */
import { useCallback, useEffect, useRef, useState } from "react";

export interface UseDebouncedMutationOptions<TBody> {
  /**
   * Underlying mutation. Called with the merged body and a `{ onError }` hook
   * the debouncer wires to its own rollback + onError chain. Typical wiring:
   *   mutate: (body, opts) => myMutation.mutate(adaptedRequest(body), opts)
   */
  mutate: (body: TBody, opts: { onError: (error?: unknown) => void }) => void;
  /** Debounce window in milliseconds. Defaults to 1500 (Phase 18.5 W2 PR-5). */
  debounceMs?: number;
  /**
   * Apply an optimistic side-effect (typically `queryClient.setQueryData`) and
   * return a rollback closure. Called at `schedule` time so the UI reflects the
   * change within the same React tick. Returning `null` skips both the
   * side-effect and rollback. Each schedule re-captures the rollback target
   * (last-write-wins, mirrors the pre-hook pattern).
   */
  applyOptimistic?: (body: TBody) => (() => void) | null;
  /** Fired after rollback when the mutation hits onError. */
  onError?: (error?: unknown) => void;
}

export interface UseDebouncedMutationReturn<TBody> {
  /**
   * Queue a body for the next debounced flush. Pass `merge` to accumulate
   * across schedules — `merge(prev)` receives the currently-pending body
   * (or `null` if the queue is empty) and must return the next pending body.
   * Without `merge`, subsequent calls replace the pending body. The merged
   * body is passed to `applyOptimistic` immediately.
   */
  schedule: (body: TBody, merge?: (prev: TBody | null) => TBody) => void;
  /** Cancel the timer and fire any pending body immediately. */
  flush: () => void;
  /** Cancel the timer and discard the pending body without firing or rollback. */
  cancel: () => void;
  /** True while a body is queued (debounce timer is active). */
  isPending: boolean;
}

const DEFAULT_DEBOUNCE_MS = 1500;

export function useDebouncedMutation<TBody>(
  options: UseDebouncedMutationOptions<TBody>,
): UseDebouncedMutationReturn<TBody> {
  const { mutate, debounceMs = DEFAULT_DEBOUNCE_MS, applyOptimistic, onError } = options;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<TBody | null>(null);
  const rollbackRef = useRef<(() => void) | null>(null);
  const [isPending, setIsPending] = useState(false);

  // Latest options snapshot — accessed inside the cleanup closure to avoid
  // stale captures when the parent re-renders with new mutate/onError refs.
  const optsRef = useRef({ mutate, applyOptimistic, onError });
  useEffect(() => {
    optsRef.current = { mutate, applyOptimistic, onError };
  }, [mutate, applyOptimistic, onError]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const flush = useCallback(() => {
    clearTimer();
    const body = pendingRef.current;
    if (body === null) return;
    pendingRef.current = null;
    setIsPending(false);

    // Capture the rollback at flush-time so onError still has access after
    // pendingRef is cleared. Reset rollbackRef so a follow-up schedule starts
    // a fresh optimistic cycle.
    const rollback = rollbackRef.current;
    rollbackRef.current = null;

    optsRef.current.mutate(body, {
      onError: (error) => {
        rollback?.();
        optsRef.current.onError?.(error);
      },
    });
  }, [clearTimer]);

  const schedule = useCallback(
    (body: TBody, merge?: (prev: TBody | null) => TBody) => {
      const merged = merge ? merge(pendingRef.current) : body;
      pendingRef.current = merged;
      setIsPending(true);
      // Apply optimistic at schedule-time so the UI reflects the change in
      // the same tick. Last-write-wins for the rollback target.
      rollbackRef.current = optsRef.current.applyOptimistic?.(merged) ?? null;
      clearTimer();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        flush();
      }, debounceMs);
    },
    [clearTimer, debounceMs, flush],
  );

  const cancel = useCallback(() => {
    clearTimer();
    pendingRef.current = null;
    rollbackRef.current = null;
    setIsPending(false);
  }, [clearTimer]);

  // Unmount cleanup — fire any pending body so navigation away from the panel
  // does not silently drop edits made within the debounce window. flushRef
  // pattern avoids stale closure on unmount when `flush` identity changes.
  const flushRef = useRef(flush);
  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  useEffect(() => {
    return () => {
      flushRef.current();
    };
  }, []);

  return { schedule, flush, cancel, isPending };
}
