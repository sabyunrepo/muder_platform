import { Navigate, Outlet } from "react-router";
import { useAuthStore } from "@/stores/authStore";
import type { User } from "@/stores/authStore";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RoleRouteProps {
  roles: Array<User["role"]>;
}

// ---------------------------------------------------------------------------
// 컴포넌트
// ---------------------------------------------------------------------------

/**
 * 특정 역할(role)을 가진 사용자만 접근 가능한 라우트 가드.
 *
 * - 인증되지 않은 상태 → /login 리다이렉트
 * - 인증됐지만 역할 없음(로딩 중) → 스피너 표시
 * - 역할이 허용 목록에 없음 → / 리다이렉트
 * - 역할이 허용 목록에 있음 → 자식 렌더링 (Outlet)
 *
 * ProtectedRoute 내부에 중첩해서 사용.
 */
function RoleRoute({ roles }: RoleRouteProps) {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);

  // 아직 사용자 정보 로딩 중
  if (isLoading || (isAuthenticated && !user)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      </div>
    );
  }

  // 비로그인 상태
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // 역할 미보유
  if (!roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

export default RoleRoute;
