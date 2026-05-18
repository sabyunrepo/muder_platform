import { toast } from 'sonner';
import type { ApiError } from '@mmp/shared';
import { isApiHttpError } from '@/lib/api-error';
import { getUserMessage } from '@/lib/error-messages';
import { getErrorRecoveryStrategy } from '@/lib/error-recovery';
import { captureApiError } from '@/lib/sentry';

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ErrorToastOptions {
  id?: string;
  duration?: number;
  action?: ToastAction;
}

/**
 * API 에러를 sonner 토스트로 표시한다.
 * - recovery strategy가 login이면 로그인 페이지로 리다이렉트
 * - severity/retryability에 따라 표시 시간과 Sentry 캡처를 결정
 */
export function showErrorToast(error: ApiError, options?: ErrorToastOptions): void {
  const strategy = getErrorRecoveryStrategy(error);

  // 401은 토스트 대신 리다이렉트 (로그인 페이지에서는 루프 방지)
  if (strategy.surface === 'redirect-login' && !window.location.pathname.startsWith('/login')) {
    window.location.href = '/login';
    return;
  }

  const message = getUserMessage(error);
  const ref = getErrorReference(error);
  const description = ref ? `오류 ID: ${ref}` : undefined;

  if (strategy.capture) {
    captureApiError(new Error(error.detail), error);
  }

  toast.error(
    message,
    buildToastOptions({ ...options, description, duration: options?.duration ?? strategy.duration })
  );
}

export function showUnknownErrorToast(
  error: unknown,
  fallback: string,
  options?: ErrorToastOptions
): void {
  if (isApiHttpError(error)) {
    showErrorToast(error.apiError, options);
    return;
  }

  const toastOptions = buildToastOptions(options);
  if (toastOptions) {
    toast.error(fallback, toastOptions);
    return;
  }
  toast.error(fallback);
}

export function getErrorReference(error: ApiError): string | undefined {
  const requestId = error.request_id?.trim();
  const traceId = error.trace_id?.trim();
  const correlationId = error.correlation_id?.trim();
  const id = requestId || traceId || correlationId;
  return id ? id.slice(0, 8) : undefined;
}

function buildToastOptions(
  options?: ErrorToastOptions & { description?: string }
): Record<string, unknown> | undefined {
  const toastOptions: Record<string, unknown> = {};
  if (options?.id) toastOptions.id = options.id;
  if (options?.description) toastOptions.description = options.description;
  if (options?.duration !== undefined) toastOptions.duration = options.duration;
  if (options?.action) toastOptions.action = options.action;
  return Object.keys(toastOptions).length > 0 ? toastOptions : undefined;
}
