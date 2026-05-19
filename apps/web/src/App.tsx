import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { GlobalErrorBoundary } from '@/components/error';
import { queryClient } from '@/services/queryClient';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/services/api';
import { AppearanceProvider, useAppearance } from '@/shared/appearance';
import { MainLayout } from '@/shared/components/MainLayout';
import { NetworkBanner } from '@/shared/components/NetworkBanner';
import { LoadingState } from '@/shared/components/ui';
import ProtectedRoute from '@/shared/components/ProtectedRoute';
import RoleRoute from '@/shared/components/RoleRoute';

// ---------------------------------------------------------------------------
// Lazy-loaded 페이지
// ---------------------------------------------------------------------------

// 퍼블릭
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));
// OfflinePage는 오프라인에서도 렌더링해야 하므로 eager import
import OfflinePage from '@/pages/OfflinePage';
const LoginPage = lazy(() => import('@/features/auth/LoginPage'));
const AuthCallbackPage = lazy(() => import('@/features/auth/AuthCallbackPage'));

// 인증 필요
const LobbyPage = lazy(() => import('@/pages/LobbyPage'));
const ProfilePage = lazy(() => import('@/pages/ProfilePage'));
const RoomPage = lazy(() => import('@/pages/RoomPage'));
const EditorPage = lazy(() => import('@/pages/EditorPage'));
const AdminPage = lazy(() => import('@/pages/AdminPage'));
const PublicProfilePage = lazy(() => import('@/pages/PublicProfilePage'));
const GamePage = lazy(() => import('@/pages/GamePage'));
const SocialPage = lazy(() => import('@/pages/SocialPage'));
const ReadingScriptEditorMockPage = lazy(() => import('@/pages/ReadingScriptEditorMockPage'));
const ReadingScriptPlayerMockPage = lazy(() => import('@/pages/ReadingScriptPlayerMockPage'));
const UIKitPreviewPage = lazy(() => import('@/pages/UIKitPreviewPage'));

// Shop
const ShopPage = lazy(() => import('@/pages/ShopPage'));
const ShopHistoryPage = lazy(() => import('@/pages/ShopHistoryPage'));

// My Themes
const MyThemesPage = lazy(() => import('@/pages/MyThemesPage'));

// Creator
const CreatorDashboardPage = lazy(() => import('@/pages/CreatorDashboardPage'));
const CreatorThemeStatsPage = lazy(() => import('@/pages/CreatorThemeStatsPage'));
const CreatorEarningsPage = lazy(() => import('@/pages/CreatorEarningsPage'));
const CreatorSettlementsPage = lazy(() => import('@/pages/CreatorSettlementsPage'));

// Admin (payment management)
const AdminSettlementsPage = lazy(() => import('@/pages/AdminSettlementsPage'));
const AdminRevenuePage = lazy(() => import('@/pages/AdminRevenuePage'));
const AdminPackagesPage = lazy(() => import('@/pages/AdminPackagesPage'));
const AdminCoinGrantPage = lazy(() => import('@/pages/AdminCoinGrantPage'));
const AdminReviewPage = lazy(() => import('@/pages/AdminReviewPage'));

// ---------------------------------------------------------------------------
// 로딩 폴백
// ---------------------------------------------------------------------------

function LoadingFallback() {
  return (
    <div className="flex h-screen items-center justify-center bg-[var(--mmp-color-canvas)] text-[var(--mmp-color-ink)]">
      <LoadingState label="화면을 불러오는 중" />
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
  avatar_url: string | null;
  role: string;
  provider: string;
}

function normalizeUserRole(role: string): 'user' | 'creator' | 'admin' {
  return role === 'user' || role === 'creator' || role === 'admin' ? role : 'user';
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
          const tokens = await api.post<TokenPair>('/v1/auth/refresh', {
            refresh_token: refreshToken,
          });
          useAuthStore.getState().setTokens(tokens.access_token, tokens.refresh_token);

          // 유저 정보 가져오기
          const user = await api.get<UserResponse>('/v1/auth/me');
          setUser({
            id: user.id,
            nickname: user.nickname,
            email: user.email,
            profileImage: user.avatar_url,
            role: normalizeUserRole(user.role),
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
  return (
    <GlobalErrorBoundary>
      <AppearanceProvider>
        <AppContent />
      </AppearanceProvider>
    </GlobalErrorBoundary>
  );
}

function AppContent() {
  useAppInitialize();
  const { resolvedTheme } = useAppearance();

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <NetworkBanner />
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            {/* 퍼블릭 */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            {import.meta.env.DEV && <Route path="/dev/ui-kit" element={<UIKitPreviewPage />} />}

            {/* 인증 필요 — 게임/에디터 상세는 전체화면 (MainLayout 밖) */}
            <Route element={<ProtectedRoute />}>
              <Route path="/dev/reading-script" element={<ReadingScriptEditorMockPage />} />
              <Route path="/dev/reading-player" element={<ReadingScriptPlayerMockPage />} />
              <Route path="/game/:id" element={<GamePage />} />
              <Route path="/editor/:id" element={<EditorPage />} />
              <Route path="/editor/:id/:tab" element={<EditorPage />} />
              <Route path="/editor/:id/design/:designTab" element={<EditorPage />} />
            </Route>

            <Route element={<MainLayout />}>
              <Route path="/" element={<LobbyPage />} />
              <Route path="/lobby" element={<LobbyPage />} />
              <Route path="/users/:id" element={<PublicProfilePage />} />

              {/* Shop */}
              <Route path="/shop" element={<ShopPage />} />

              {/* MainLayout 안의 인증 필요 페이지는 shell을 유지하고 안내 패널을 표시한다. */}
              <Route element={<ProtectedRoute mode="prompt" />}>
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/room/:id" element={<RoomPage />} />
                <Route path="/editor" element={<EditorPage />} />
                <Route path="/social" element={<SocialPage />} />
                <Route path="/shop/history" element={<ShopHistoryPage />} />
                <Route path="/my-themes" element={<MyThemesPage />} />
              </Route>

              {/* Creator — creator 또는 admin 역할만 접근 가능 */}
              <Route element={<RoleRoute roles={['creator', 'admin']} mode="prompt" />}>
                <Route path="/creator" element={<CreatorDashboardPage />} />
                <Route path="/creator/:id/stats" element={<CreatorThemeStatsPage />} />
                <Route path="/creator/earnings" element={<CreatorEarningsPage />} />
                <Route path="/creator/settlements" element={<CreatorSettlementsPage />} />
              </Route>

              {/* Admin — admin 역할만 접근 가능 */}
              <Route element={<RoleRoute roles={['admin']} mode="prompt" />}>
                <Route path="/admin" element={<AdminPage />} />
                <Route path="/admin/settlements" element={<AdminSettlementsPage />} />
                <Route path="/admin/revenue" element={<AdminRevenuePage />} />
                <Route path="/admin/packages" element={<AdminPackagesPage />} />
                <Route path="/admin/coins" element={<AdminCoinGrantPage />} />
                <Route path="/admin/reviews" element={<AdminReviewPage />} />
              </Route>
            </Route>

            <Route path="/offline" element={<OfflinePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster
        theme={resolvedTheme}
        position="bottom-right"
        toastOptions={{
          classNames: {
            toast:
              'border border-[var(--mmp-color-hairline)] bg-[var(--mmp-color-surface)] text-[var(--mmp-color-ink)] shadow-[var(--mmp-shadow-card)]',
            title: 'text-[var(--mmp-color-ink)]',
            description: 'text-[var(--mmp-color-steel)]',
            actionButton: 'bg-[var(--mmp-color-primary)] text-[var(--mmp-color-on-primary)]',
            cancelButton: 'bg-[var(--mmp-color-surface-soft)] text-[var(--mmp-color-charcoal)]',
          },
        }}
      />
    </QueryClientProvider>
  );
}
