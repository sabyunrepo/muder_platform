import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import type { ReactNode } from "react";

function PageFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
      <p className="text-lg font-semibold text-red-400">
        페이지를 불러오지 못했습니다
      </p>
      {import.meta.env.DEV && (
        <pre className="max-w-md overflow-auto rounded bg-slate-900 p-3 text-xs text-red-300">
          {error.message}
        </pre>
      )}
      <button
        onClick={resetErrorBoundary}
        className="rounded bg-amber-500 px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-amber-400"
      >
        다시 시도
      </button>
    </div>
  );
}

export function PageErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary FallbackComponent={PageFallback}>
      {children}
    </ErrorBoundary>
  );
}
