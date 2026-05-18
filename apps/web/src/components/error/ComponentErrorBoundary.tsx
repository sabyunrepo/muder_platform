import { ErrorBoundary } from 'react-error-boundary';
import type { ReactNode } from 'react';
import { Alert } from '@/shared/components/ui';

function ComponentFallback() {
  return (
    <Alert title="로드 실패" tone="error">
      이 영역을 불러오지 못했습니다.
    </Alert>
  );
}

export function ComponentErrorBoundary({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return <ErrorBoundary fallback={fallback ?? <ComponentFallback />}>{children}</ErrorBoundary>;
}
