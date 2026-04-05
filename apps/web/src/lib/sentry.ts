import * as Sentry from "@sentry/react";

/**
 * Sentry를 초기화한다. VITE_SENTRY_DSN이 없으면 초기화하지 않는다.
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_APP_VERSION ?? "0.1.0",
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: true, maskAllInputs: true, blockAllMedia: true }),
    ],
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    ignoreErrors: [
      "ResizeObserver loop",
      "Network request failed",
      /Loading chunk \d+ failed/,
    ],

    beforeSend(event) {
      if (event.request?.cookies) {
        delete event.request.cookies;
      }
      return event;
    },
  });
}

/**
 * API 에러를 Sentry에 캡처한다. trace_id가 있으면 태그로 첨부.
 */
export function captureApiError(
  error: Error,
  apiError?: { code?: string; status?: number; trace_id?: string },
): void {
  Sentry.captureException(error, {
    tags: {
      ...(apiError?.trace_id && { trace_id: apiError.trace_id }),
      ...(apiError?.code && { "error.code": apiError.code }),
    },
    contexts: apiError
      ? {
          api_error: {
            code: apiError.code,
            status: apiError.status,
          },
        }
      : undefined,
  });
}
