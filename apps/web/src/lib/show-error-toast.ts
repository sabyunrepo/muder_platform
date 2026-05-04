import { toast } from 'sonner';
import type { ApiError } from '@mmp/shared';
import { getUserMessage } from '@/lib/error-messages';
import { captureApiError } from '@/lib/sentry';

/**
 * API 에러를 sonner 토스트로 표시한다.
 * - 401: 로그인 페이지로 리다이렉트
 * - 4xx: 5초 자동 닫힘
 * - 5xx: 수동 닫기 + trace_id 표시
 */
export function showErrorToast(error: ApiError): void {
  // 401은 토스트 대신 리다이렉트 (로그인 페이지에서는 루프 방지)
  if (error.status === 401 && !window.location.pathname.startsWith('/login')) {
    window.location.href = '/login';
    return;
  }

  const message = getUserMessage(error);
  const ref = getErrorReference(error);
  const description = ref ? `Ref: ${ref}` : undefined;

  if (error.status >= 500) {
    captureApiError(new Error(error.detail), error);
    // 서버 에러: 수동 닫기, 더 오래 표시
    toast.error(message, {
      description,
      duration: Infinity,
    });
  } else {
    // 클라이언트 에러: 5초 후 자동 닫힘
    toast.error(message, {
      description,
      duration: 5000,
    });
  }
}

export function getErrorReference(error: ApiError): string | undefined {
  const id = error.request_id ?? error.trace_id;
  return id ? id.slice(0, 8) : undefined;
}
