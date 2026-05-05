import { toast } from 'sonner';
import type { ApiError } from '@mmp/shared';
import { getUserMessage } from '@/lib/error-messages';
import { getErrorRecoveryStrategy } from '@/lib/error-recovery';
import { captureApiError } from '@/lib/sentry';

/**
 * API 에러를 sonner 토스트로 표시한다.
 * - recovery strategy가 login이면 로그인 페이지로 리다이렉트
 * - severity/retryability에 따라 표시 시간과 Sentry 캡처를 결정
 */
export function showErrorToast(error: ApiError): void {
  const strategy = getErrorRecoveryStrategy(error);

  // 401은 토스트 대신 리다이렉트 (로그인 페이지에서는 루프 방지)
  if (strategy.surface === 'redirect-login' && !window.location.pathname.startsWith('/login')) {
    window.location.href = '/login';
    return;
  }

  const message = getUserMessage(error);
  const ref = getErrorReference(error);
  const description = ref ? `Ref: ${ref}` : undefined;

  if (strategy.capture) {
    captureApiError(new Error(error.detail), error);
  }

  toast.error(message, {
    description,
    duration: strategy.duration,
  });
}

export function getErrorReference(error: ApiError): string | undefined {
  const requestId = error.request_id?.trim();
  const traceId = error.trace_id?.trim();
  const id = requestId || traceId;
  return id ? id.slice(0, 8) : undefined;
}
