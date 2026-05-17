import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { toast } from "sonner";

import { useDebouncedMutation } from "@/hooks/useDebouncedMutation";

const toastWithLoading = toast as typeof toast & {
  loading?: (message: string, options?: Record<string, unknown>) => void;
};

export interface AutosavedDraftToastMessages {
  toastId: string;
  loading: string;
  success: string;
  error: string;
}

export interface UseAutosavedDraftOptions<TServer, TDraft, TSaveBody> {
  serverValue: TServer;
  serverKey?: string;
  debounceMs?: number;
  toDraft: (serverValue: TServer) => TDraft;
  isEqual: (left: TDraft, right: TDraft) => boolean;
  buildSaveBody: (draft: TDraft, latestServerValue: TServer) => TSaveBody | null;
  save: (body: TSaveBody) => Promise<TServer>;
  mergeSavedDraft?: (args: {
    currentDraft: TDraft;
    savedDraft: TDraft;
    submittedDraft: TDraft;
  }) => TDraft;
  messages?: AutosavedDraftToastMessages;
  enabled?: boolean;
  onError?: (error?: unknown) => void;
  onSaved?: (saved: TServer) => void;
}

export interface UseAutosavedDraftReturn<TDraft> {
  draft: TDraft;
  setDraft: Dispatch<SetStateAction<TDraft>>;
  baseline: TDraft;
  isDirty: boolean;
  saveNow: () => void;
  flush: () => void;
  cancel: () => void;
}

function defaultMergeSavedDraft<TDraft>({
  currentDraft,
  savedDraft,
  submittedDraft,
  isEqual,
}: {
  currentDraft: TDraft;
  savedDraft: TDraft;
  submittedDraft: TDraft;
  isEqual: (left: TDraft, right: TDraft) => boolean;
}): TDraft {
  return isEqual(currentDraft, submittedDraft) ? savedDraft : currentDraft;
}

export function useAutosavedDraft<TServer, TDraft, TSaveBody>({
  serverValue,
  serverKey,
  debounceMs,
  toDraft,
  isEqual,
  buildSaveBody,
  save,
  mergeSavedDraft,
  messages,
  enabled = true,
  onError,
  onSaved,
}: UseAutosavedDraftOptions<TServer, TDraft, TSaveBody>): UseAutosavedDraftReturn<TDraft> {
  const initialDraft = useMemo(() => toDraft(serverValue), [serverValue, toDraft]);
  const [draft, setDraftState] = useState(initialDraft);
  const [baseline, setBaseline] = useState(initialDraft);

  const draftRef = useRef(draft);
  const baselineRef = useRef(baseline);
  const latestServerValueRef = useRef(serverValue);
  const serverKeyRef = useRef(serverKey);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const setDraft = useCallback<Dispatch<SetStateAction<TDraft>>>((next) => {
    setDraftState((current) => {
      const resolved =
        typeof next === "function"
          ? (next as (current: TDraft) => TDraft)(current)
          : next;
      draftRef.current = resolved;
      return resolved;
    });
  }, []);

  useEffect(() => {
    baselineRef.current = baseline;
  }, [baseline]);

  const isDirty = !isEqual(draft, baseline);
  const isDirtyRef = useRef(isDirty);
  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  const acceptSavedValue = useCallback(
    (saved: TServer, submittedDraft: TDraft) => {
      latestServerValueRef.current = saved;
      const savedDraft = toDraft(saved);
      setBaseline(savedDraft);
      setDraft((currentDraft) => {
        const nextDraft = mergeSavedDraft
          ? mergeSavedDraft({
              currentDraft,
              savedDraft,
              submittedDraft,
            })
          : defaultMergeSavedDraft({
              currentDraft,
              savedDraft,
              submittedDraft,
              isEqual,
            });
        draftRef.current = nextDraft;
        return nextDraft;
      });
      onSaved?.(saved);
    },
    [isEqual, mergeSavedDraft, onSaved, setDraft, toDraft],
  );

  const retrySave = useCallback(
    (payload: { body: TSaveBody; submittedDraft: TDraft }) => {
      if (!messages) {
        void save(payload.body)
          .then((saved) => acceptSavedValue(saved, payload.submittedDraft))
          .catch((error) => onError?.(error));
        return;
      }
      toastWithLoading.loading?.(messages.loading, { id: messages.toastId });
      save(payload.body)
        .then((saved) => {
          acceptSavedValue(saved, payload.submittedDraft);
          toast.success(messages.success, { id: messages.toastId, duration: 1200 });
        })
        .catch((error) => {
          onError?.(error);
          toast.error(messages.error, {
            id: messages.toastId,
            duration: 6000,
            action: { label: "재시도", onClick: () => retrySave(payload) },
          });
        });
    },
    [acceptSavedValue, messages, onError, save],
  );

  const { schedule, flush, cancel } = useDebouncedMutation<{
    body: TSaveBody;
    submittedDraft: TDraft;
  }>({
    debounceMs,
    mutate: (payload, opts) => {
      if (messages) {
        toastWithLoading.loading?.(messages.loading, { id: messages.toastId });
      }
      save(payload.body)
        .then((saved) => {
          acceptSavedValue(saved, payload.submittedDraft);
          opts.onSuccess?.();
        })
        .catch(opts.onError);
    },
    onSuccess: () => {
      if (messages) {
        toast.success(messages.success, { id: messages.toastId, duration: 1200 });
      }
    },
    onFailure: (error, payload) => {
      onError?.(error);
      if (!messages) return;
      toast.error(messages.error, {
        id: messages.toastId,
        duration: 6000,
        action: { label: "재시도", onClick: () => retrySave(payload) },
      });
    },
  });

  useEffect(() => {
    const incomingDraft = toDraft(serverValue);
    const keyChanged = serverKeyRef.current !== serverKey;
    serverKeyRef.current = serverKey;

    if (keyChanged) {
      cancel();
      latestServerValueRef.current = serverValue;
      setDraft(incomingDraft);
      setBaseline(incomingDraft);
      return;
    }

    if (isDirtyRef.current) return;

    latestServerValueRef.current = serverValue;
    setDraft(incomingDraft);
    setBaseline(incomingDraft);
  }, [cancel, serverKey, serverValue, setDraft, toDraft]);

  useEffect(() => {
    if (!enabled || !isDirty) return;
    const body = buildSaveBody(draft, latestServerValueRef.current);
    if (!body) {
      cancel();
      return;
    }
    schedule({ body, submittedDraft: draft });
  }, [buildSaveBody, cancel, draft, enabled, isDirty, schedule]);

  const saveNow = useCallback(() => {
    if (!enabled) return;
    const currentDraft = draftRef.current;
    if (isEqual(currentDraft, baselineRef.current)) return;
    const body = buildSaveBody(currentDraft, latestServerValueRef.current);
    if (!body) return;
    schedule({ body, submittedDraft: currentDraft });
    flush();
  }, [buildSaveBody, enabled, flush, isEqual, schedule]);

  return { draft, setDraft, baseline, isDirty, saveNow, flush, cancel };
}
