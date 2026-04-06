import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { captureApiError } from "@/lib/sentry";
import { Button } from "@/shared/components/ui";

function GameFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-4 bg-slate-950">
      <AlertTriangle className="h-12 w-12 text-red-400" />
      <h2 className="text-lg font-semibold text-slate-200">
        게임에 문제가 발생했습니다
      </h2>
      <p className="text-sm text-slate-400">
        잠시 후 다시 시도하거나, 로비로 돌아가세요
      </p>
      {import.meta.env.DEV && (
        <pre className="max-w-lg overflow-auto rounded bg-slate-900 p-4 text-left text-xs text-red-300">
          {error.message}
        </pre>
      )}
      <div className="flex gap-3">
        <Button variant="primary" onClick={resetErrorBoundary}>
          다시 시도
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            window.location.href = "/lobby";
          }}
        >
          로비로 돌아가기
        </Button>
      </div>
    </div>
  );
}

export function GameErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      FallbackComponent={GameFallback}
      onError={(error, info) => {
        captureApiError(error);
        if (import.meta.env.DEV) {
          console.error("[GameErrorBoundary]", error, info.componentStack);
        }
      }}
      onReset={() => {
        window.location.reload();
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
