import { Navigate, Outlet } from "react-router";
import { useAuthStore } from "@/stores/authStore";

// ---------------------------------------------------------------------------
// 컴포넌트
// ---------------------------------------------------------------------------

/**
 * 인증된 사용자만 접근 가능한 라우트 가드.
 *
 * 조건 분리:
 * - isLoading true → 스피너 (초기 토큰 갱신 대기)
 * - !isLoading && !isAuthenticated → /login 리다이렉트
 * - !isLoading && isAuthenticated → 자식 렌더링 (Outlet)
 *
 * accessToken에 직접 의존하지 않음 — isAuthenticated를 단일 진실 공급원으로 사용.
 * 토큰 갱신 중에는 isLoading=true가 보장되므로 무한 스피너 방지.
 */
function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);

  // 초기화 / 토큰 갱신 진행 중
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      </div>
    );
  }

  // 로딩 완료 후 미인증 → 로그인으로 이동
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
