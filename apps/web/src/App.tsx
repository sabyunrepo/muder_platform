import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { GlobalErrorBoundary } from "@/components/error";
import { queryClient } from "@/services/queryClient";
import { useAuthStore } from "@/stores/authStore";
import { api } from "@/services/api";
import { MainLayout } from "@/shared/components/MainLayout";
import ProtectedRoute from "@/shared/components/ProtectedRoute";

// ---------------------------------------------------------------------------
// Lazy-loaded 페이지
// ---------------------------------------------------------------------------

// 퍼블릭
const HomePage = lazy(() => import("@/pages/HomePage"));
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"));
const LoginPage = lazy(() => import("@/features/auth/LoginPage"));
const AuthCallbackPage = lazy(
  () => import("@/features/auth/AuthCallbackPage"),
);

// 인증 필요
const LobbyPage = lazy(() => import("@/pages/LobbyPage"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));
const RoomPage = lazy(() => import("@/pages/RoomPage"));
const EditorPage = lazy(() => import("@/pages/EditorPage"));
const AdminPage = lazy(() => import("@/pages/AdminPage"));
const PublicProfilePage = lazy(() => import("@/pages/PublicProfilePage"));
const GamePage = lazy(() => import("@/pages/GamePage"));

// ---------------------------------------------------------------------------
// 로딩 폴백
// ---------------------------------------------------------------------------

function LoadingFallback() {
  return (
    <div className="flex h-screen items-center justify-center bg-slate-950">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// 앱 초기화 훅
// ---------------------------------------------------------------------------

interface TokenPair {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

interface UserResponse {
  id: string;
  nickname: string;
  email: string;
  profile_image: string | null;
  role: string;
  provider: string;
}

function useAppInitialize() {
  useEffect(() => {
    const init = async () => {
      const { initialize, setUser, setLoading } = useAuthStore.getState();
      initialize();

      const refreshToken = useAuthStore.getState().refreshToken;
      if (refreshToken) {
        try {
          // 토큰 갱신
          const tokens = await api.post<TokenPair>("/v1/auth/refresh", {
            refresh_token: refreshToken,
          });
          useAuthStore.getState().setTokens(tokens.access_token, tokens.refresh_token);

          // 유저 정보 가져오기
          const user = await api.get<UserResponse>("/v1/auth/me");
          setUser({
            id: user.id,
            nickname: user.nickname,
            email: user.email,
            profileImage: user.profile_image,
            role: user.role as "user" | "creator" | "admin",
            provider: user.provider,
          });
        } catch {
          // refresh 실패 — 로그인 필요
          useAuthStore.getState().clear();
        }
      }
      setLoading(false);
    };
    init();
  }, []);
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export function App() {
  useAppInitialize();

  return (
    <GlobalErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              {/* 퍼블릭 */}
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/auth/callback" element={<AuthCallbackPage />} />

              {/* 인증 필요 — 게임은 전체화면 (MainLayout 밖) */}
              <Route element={<ProtectedRoute />}>
                <Route path="/game/:id" element={<GamePage />} />
                <Route element={<MainLayout />}>
                  <Route path="/lobby" element={<LobbyPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/room/:id" element={<RoomPage />} />
                  <Route path="/editor" element={<EditorPage />} />
                  <Route path="/editor/:id" element={<EditorPage />} />
                  <Route path="/admin" element={<AdminPage />} />
                  <Route path="/users/:id" element={<PublicProfilePage />} />
                </Route>
              </Route>

              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            className: "!bg-slate-900 !border-slate-700 !text-slate-100",
          }}
        />
      </QueryClientProvider>
    </GlobalErrorBoundary>
  );
}
