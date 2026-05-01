/**
 * useDebouncedMutation — debounced auto-save 훅 (Phase 21 E-1).
 *
 * Editor 패널의 `useRef + setTimeout` debounce 패턴 (PhaseNodePanel /
 * CharacterAssignPanel / EndingNodePanel)을 단일 훅으로 통합한다. Timer 관리,
 * pending body 누적, optimistic rollback closure 캡처, unmount cleanup이
 * 캡슐화된다.
 *
 * ## Lifecycle 의미론
 *
 * - `schedule(body, merge?)` — pending body를 갱신하고 debounce timer를
 *   재시작한다. **사이드 이펙트 없음** (UI 즉시 반영을 원하면 호출자가
 *   별도로 `queryClient.setQueryData` 호출).
 * - `flush()` — timer 취소 + 즉시 fire. **이때 `applyOptimistic`이 호출되어
 *   rollback closure를 캡처**하고, 그 직후 `mutate(body, { onError })`로
 *   넘긴다. mutation이 onError를 발화하면 rollback이 실행되고 호출자의
 *   `onError`도 함께 발화한다.
 * - `cancel()` — timer 취소 + pending 폐기. rollback **호출하지 않음**
 *   (호출자가 의도적으로 버린 상황).
 * - 컴포넌트 unmount 시 pending body가 있으면 자동 flush.
 *
 * ## 호출 제약 (재진입 금지)
 *
 * `mutate`/`applyOptimistic`/`onError` 콜백 안에서 `schedule`/`flush`/`cancel`을
 * 동기 호출하지 마라. flush는 `pendingRef.current`를 null로 비우고 `mutate`을
 * 호출하므로, 재진입 schedule은 쓰지만 그 결과를 보호하는 rollback closure가
 * 이미 사용된 상태다. 재진입이 필요하면 `queueMicrotask` 또는
 * `setTimeout(..., 0)`으로 비동기 dispatch.
 *
 * ## Optimistic 시점에 대한 결정 (perf-H2)
 *
 * 빠른 타이핑 시 schedule이 N번 → 매 호출마다 setQueryData 발화 시 cache
 * subscriber (예: FlowCanvas)가 N회 re-render. 이를 회피하기 위해
 * `applyOptimistic`은 **flush 시점**에만 호출한다 (1 keystroke = 1 setState).
 *
 * 호출자가 schedule 시점 즉시 UI 반영을 원하면 `schedule` 호출 직전에 직접
 * `queryClient.setQueryData`를 한다 (CharacterAssignPanel 패턴 — 토글 즉시
 * 반응이 사용자 체감 critical).
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
import { useCallback, useEffect, useRef } from "react";

export interface UseDebouncedMutationOptions<TBody> {
  /**
   * Underlying mutation. Called with the queued body and a `{ onError }` hook
   * the debouncer wires to its own rollback + onError chain. Typical wiring:
   *   mutate: (body, opts) => myMutation.mutate(adaptedRequest(body), opts)
   *
   * **재진입 금지**: 이 콜백 안에서 `schedule`/`flush`/`cancel`을 동기 호출
   * 하지 마라. 필요하면 `queueMicrotask`로 다음 tick에 dispatch.
   */
  mutate: (body: TBody, opts: { onError: (error?: unknown) => void }) => void;
  /** Debounce window in milliseconds. Defaults to 1500 (Phase 18.5 W2 PR-5). */
  debounceMs?: number;
  /**
   * Apply an optimistic side-effect (typically `queryClient.setQueryData`) and
   * return a rollback closure. **Called at flush time** (not schedule time)
   * to avoid N re-renders during fast typing — see header comment.
   * Returning `null` skips both the side-effect and rollback.
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
   * Without `merge`, subsequent calls replace the pending body. **No
   * side-effect** — the optimistic apply happens at flush time.
   */
  schedule: (body: TBody, merge?: (prev: TBody | null) => TBody) => void;
  /** Cancel the timer and fire any pending body immediately. */
  flush: () => void;
  /** Cancel the timer and discard the pending body without firing or rollback. */
  cancel: () => void;
}

const DEFAULT_DEBOUNCE_MS = 1500;

interface OptsRef<TBody> {
  mutate: UseDebouncedMutationOptions<TBody>["mutate"];
  applyOptimistic: UseDebouncedMutationOptions<TBody>["applyOptimistic"];
  onError: UseDebouncedMutationOptions<TBody>["onError"];
}

type TimerRef = React.MutableRefObject<ReturnType<typeof setTimeout> | null>;

/** Cancel any active timer; idempotent. */
function clearTimer(timerRef: TimerRef): void {
  if (timerRef.current) {
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }
}

/**
 * Apply optimistic side-effect, capture rollback, and fire the mutation. The
 * rollback closure is created lazily here (not at schedule time) so a fast
 * keystroke burst does not write to the query cache N times.
 */
function flushPending<TBody>(
  timerRef: TimerRef,
  pendingRef: React.MutableRefObject<TBody | null>,
  optsRef: React.MutableRefObject<OptsRef<TBody>>,
): void {
  clearTimer(timerRef);
  const body = pendingRef.current;
  if (body === null) return;
  pendingRef.current = null;
  const rollback = optsRef.current.applyOptimistic?.(body) ?? null;
  optsRef.current.mutate(body, {
    onError: (error) => {
      rollback?.();
      optsRef.current.onError?.(error);
    },
  });
}

export function useDebouncedMutation<TBody>(
  options: UseDebouncedMutationOptions<TBody>,
): UseDebouncedMutationReturn<TBody> {
  const { mutate, debounceMs = DEFAULT_DEBOUNCE_MS, applyOptimistic, onError } = options;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<TBody | null>(null);

  // Latest options snapshot, synced via useEffect so we only mutate the ref
  // post-commit (Round-2 N-2: render-body ref writes are unsafe under React 19
  // concurrent rendering — speculative renders can replay).
  const optsRef = useRef<OptsRef<TBody>>({ mutate, applyOptimistic, onError });
  useEffect(() => {
    optsRef.current = { mutate, applyOptimistic, onError };
  }, [mutate, applyOptimistic, onError]);

  const flush = useCallback(
    () => flushPending(timerRef, pendingRef, optsRef),
    [],
  );

  const schedule = useCallback(
    (body: TBody, merge?: (prev: TBody | null) => TBody) => {
      pendingRef.current = merge ? merge(pendingRef.current) : body;
      clearTimer(timerRef);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        flushPending(timerRef, pendingRef, optsRef);
      }, debounceMs);
    },
    [debounceMs],
  );

  const cancel = useCallback(() => {
    clearTimer(timerRef);
    pendingRef.current = null;
  }, []);

  // Unmount cleanup: flush via a latest-closure ref so the cleanup never
  // captures a stale `flush` identity. StrictMode double-mount is safe — the
  // pending-null guard inside flushPending makes a second cleanup a no-op.
  const flushRef = useRef(flush);
  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);
  useEffect(() => () => flushRef.current(), []);

  return { schedule, flush, cancel };
}
