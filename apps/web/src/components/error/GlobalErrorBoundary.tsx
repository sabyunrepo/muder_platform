import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';
import type { ReactNode } from 'react';
import { captureApiError } from '@/lib/sentry';
import { Alert, Button, PageShell, Panel } from '@/shared/components/ui';

function GlobalFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <PageShell className="flex min-h-screen items-center justify-center">
      <Panel className="w-full max-w-xl space-y-5 text-center">
        <Alert title="오류 발생" tone="error">
          예기치 않은 오류가 발생했습니다.
        </Alert>
        {import.meta.env.DEV && (
          <pre className="max-h-64 overflow-auto rounded-lg border border-[var(--mmp-color-hairline)] bg-[var(--mmp-color-surface-soft)] p-4 text-left text-xs text-[var(--mmp-color-error)]">
            {error.message}
          </pre>
        )}
        <Button onClick={resetErrorBoundary}>다시 시도</Button>
      </Panel>
    </PageShell>
  );
}

export function GlobalErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      FallbackComponent={GlobalFallback}
      onError={(error, info) => {
        captureApiError(error);
        if (import.meta.env.DEV) {
          console.error('[GlobalErrorBoundary]', error, info.componentStack);
        }
      }}
      onReset={() => {
        window.location.href = '/';
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
