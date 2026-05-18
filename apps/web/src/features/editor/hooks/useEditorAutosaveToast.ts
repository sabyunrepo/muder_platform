import { useCallback } from 'react';
import { toast } from 'sonner';

import {
  useDebouncedMutation,
  type UseDebouncedMutationReturn,
} from '@/hooks/useDebouncedMutation';
import { showUnknownErrorToast } from '@/lib/show-error-toast';

const toastWithLoading = toast as typeof toast & {
  loading?: (message: string, options?: Record<string, unknown>) => void;
};

interface EditorAutosaveToastMessages {
  toastId: string;
  loading: string;
  success: string;
  error: string;
}

interface EditorAutosaveToastOptions<TBody> {
  debounceMs?: number;
  messages: EditorAutosaveToastMessages;
  mutate: (
    body: TBody,
    opts: { onError: (error?: unknown) => void; onSuccess?: () => void }
  ) => void;
  applyOptimistic?: (body: TBody) => (() => void) | null;
  onSuccess?: (body: TBody) => void;
  onError?: (error?: unknown) => void;
}

function showAutosaveFailureToast<TBody>(
  error: unknown,
  body: TBody,
  messages: EditorAutosaveToastMessages,
  retry: (body: TBody) => void
): void {
  showUnknownErrorToast(error, messages.error, {
    id: messages.toastId,
    action: {
      label: '재시도',
      onClick: () => retry(body),
    },
  });
}

export function useEditorAutosaveToast<TBody>({
  debounceMs,
  messages,
  mutate,
  applyOptimistic,
  onSuccess,
  onError,
}: EditorAutosaveToastOptions<TBody>): UseDebouncedMutationReturn<TBody> {
  const retryMutation = useCallback(
    (body: TBody) => {
      toastWithLoading.loading?.(messages.loading, { id: messages.toastId });
      mutate(body, {
        onSuccess: () => {
          onSuccess?.(body);
          toast.success(messages.success, { id: messages.toastId, duration: 1200 });
        },
        onError: (error) => {
          onError?.(error);
          showAutosaveFailureToast(error, body, messages, retryMutation);
        },
      });
    },
    [messages, mutate, onError, onSuccess]
  );

  return useDebouncedMutation<TBody>({
    debounceMs,
    applyOptimistic,
    mutate: (body, opts) => {
      toastWithLoading.loading?.(messages.loading, { id: messages.toastId });
      mutate(body, opts);
    },
    onSuccess: (body) => {
      onSuccess?.(body);
      toast.success(messages.success, { id: messages.toastId, duration: 1200 });
    },
    onFailure: (error, body) => {
      onError?.(error);
      showAutosaveFailureToast(error, body, messages, retryMutation);
    },
  });
}
