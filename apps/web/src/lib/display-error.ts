import { getUserMessage } from '@/lib/error-messages';
import { getErrorReference } from '@/lib/show-error-toast';
import { isApiHttpError } from '@/lib/api-error';

export function getDisplayErrorMessage(
  error: unknown,
  fallback = '요청을 처리하지 못했습니다.'
): string {
  if (isApiHttpError(error)) {
    const message = getUserMessage(error.apiError);
    const ref = getErrorReference(error.apiError);
    return ref ? `${message} (Ref: ${ref})` : message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}
