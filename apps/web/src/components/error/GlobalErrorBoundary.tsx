import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import type { ReactNode } from "react";
import { captureApiError } from "@/lib/sentry";

function GlobalFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 text-white">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-red-400">오류 발생</h1>
        <p className="mt-2 text-slate-400">
          예기치 않은 오류가 발생했습니다.
        </p>
        {import.meta.env.DEV && (
          <pre className="mt-4 max-w-lg overflow-auto rounded bg-slate-900 p-4 text-left text-xs text-red-300">
            {error.message}
          </pre>
        )}
        <button
          onClick={resetErrorBoundary}
          className="mt-6 rounded-lg bg-amber-500 px-6 py-2 font-medium text-slate-900 transition hover:bg-amber-400"
        >
          다시 시도
        </button>
      </div>
    </div>
  );
}

export function GlobalErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      FallbackComponent={GlobalFallback}
      onError={(error, info) => {
        captureApiError(error);
        if (import.meta.env.DEV) {
          console.error("[GlobalErrorBoundary]", error, info.componentStack);
        }
      }}
      onReset={() => {
        window.location.href = "/";
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
