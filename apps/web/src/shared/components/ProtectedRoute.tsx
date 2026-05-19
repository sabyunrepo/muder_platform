import { Link, Navigate, Outlet } from "react-router";
import { useAuthStore } from "@/stores/authStore";
import { PublicThemeShell } from "@/shared/components/PublicThemeShell";
import { Spinner } from "@/shared/components/ui";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type ProtectedRouteMode = "redirect" | "prompt";

interface ProtectedRouteProps {
  mode?: ProtectedRouteMode;
}

// ---------------------------------------------------------------------------
// 로그인 안내 패널
// ---------------------------------------------------------------------------

export function LoginRequiredPanel() {
  return (
    <section
      aria-labelledby="login-required-title"
      className="mx-auto flex min-h-[360px] max-w-2xl flex-col items-center justify-center rounded-lg border border-[var(--mmp-color-hairline)] bg-[var(--mmp-color-surface)] px-6 py-12 text-center shadow-[var(--mmp-shadow-card)]"
    >
      <p className="mb-3 text-sm font-semibold text-[var(--mmp-color-primary)]">로그인 필요</p>
      <h1
        id="login-required-title"
        className="text-2xl font-bold text-[var(--mmp-color-ink)]"
      >
        이 페이지는 로그인 후 이용할 수 있어요
      </h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-[var(--mmp-color-charcoal)]">
        프로필, 방 입장, 제작 도구처럼 내 계정 정보가 필요한 화면은 로그인한 사용자에게만
        열립니다.
      </p>
      <Link
        to="/login"
        className="mt-6 rounded-md bg-[var(--mmp-color-primary)] px-5 py-2.5 text-sm font-semibold text-[var(--mmp-color-on-primary)] transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mmp-color-primary)] focus-visible:ring-offset-2"
      >
        로그인하러 가기
      </Link>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 컴포넌트
// ---------------------------------------------------------------------------

/**
 * 인증된 사용자만 접근 가능한 라우트 가드.
 *
 * 조건 분리:
 * - isLoading true → 스피너 (초기 토큰 갱신 대기)
 * - !isLoading && !isAuthenticated → /login 리다이렉트 또는 인라인 안내
 * - !isLoading && isAuthenticated → 자식 렌더링 (Outlet)
 *
 * accessToken에 직접 의존하지 않음 — isAuthenticated를 단일 진실 공급원으로 사용.
 * 토큰 갱신 중에는 isLoading=true가 보장되므로 무한 스피너 방지.
 */
function ProtectedRoute({ mode = "redirect" }: ProtectedRouteProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);

  // 초기화 / 토큰 갱신 진행 중
  if (isLoading) {
    return (
      <PublicThemeShell center>
        <Spinner />
      </PublicThemeShell>
    );
  }

  // 로딩 완료 후 미인증 → 로그인으로 이동
  if (!isAuthenticated) {
    if (mode === "prompt") {
      return <LoginRequiredPanel />;
    }
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
