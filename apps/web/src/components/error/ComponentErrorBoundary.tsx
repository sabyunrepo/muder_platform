import { ErrorBoundary } from "react-error-boundary";
import type { ReactNode } from "react";

function ComponentFallback() {
  return (
    <div className="rounded border border-slate-700 bg-slate-900/50 p-3 text-center text-sm text-slate-500">
      로드 실패
    </div>
  );
}

export function ComponentErrorBoundary({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <ErrorBoundary
      fallback={fallback ?? <ComponentFallback />}
    >
      {children}
    </ErrorBoundary>
  );
}
