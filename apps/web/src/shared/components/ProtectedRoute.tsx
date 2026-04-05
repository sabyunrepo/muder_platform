import { Navigate, Outlet } from "react-router";
import { useAuthStore } from "@/stores/authStore";

// ---------------------------------------------------------------------------
// 컴포넌트
// ---------------------------------------------------------------------------

/**
 * 인증된 사용자만 접근 가능한 라우트 가드.
 *
 * - refreshToken 없음 → /login 리다이렉트
 * - refreshToken 있고 accessToken 없음 → 로딩 (토큰 갱신 대기)
 * - isAuthenticated → 자식 렌더링 (Outlet)
 */
function ProtectedRoute() {
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const accessToken = useAuthStore((s) => s.accessToken);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);

  // refreshToken 자체가 없으면 비로그인 상태
  if (!refreshToken) {
    return <Navigate to="/login" replace />;
  }

  // refreshToken은 있지만 아직 토큰 갱신/사용자 정보 로딩 중
  if (!isAuthenticated || isLoading || !accessToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      </div>
    );
  }

  return <Outlet />;
}

export default ProtectedRoute;
