import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';
import type { ReactNode } from 'react';
import { Alert, Button, Panel } from '@/shared/components/ui';

function PageFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Panel className="w-full max-w-lg space-y-4 text-center">
        <Alert title="페이지를 불러오지 못했습니다" tone="error">
          잠시 후 다시 시도해 주세요.
        </Alert>
        {import.meta.env.DEV && (
          <pre className="max-h-56 overflow-auto rounded-lg border border-[var(--mmp-color-hairline)] bg-[var(--mmp-color-surface-soft)] p-3 text-left text-xs text-[var(--mmp-color-error)]">
            {error.message}
          </pre>
        )}
        <Button onClick={resetErrorBoundary}>다시 시도</Button>
      </Panel>
    </div>
  );
}

export function PageErrorBoundary({ children }: { children: ReactNode }) {
  return <ErrorBoundary FallbackComponent={PageFallback}>{children}</ErrorBoundary>;
}
