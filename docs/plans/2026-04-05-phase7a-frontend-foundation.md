# Phase 7-A: 프론트엔드 상태관리 기반 + Auth + 라우팅

> 설계 문서. Phase 7의 첫 번째 하위 단계.

## 범위

1. Zustand 3레이어 스토어 (auth, connection, ui)
2. React Query 설정 + 도메인별 API hooks
3. WsClient ↔ Zustand 연동 (useWsClient, useWsEvent)
4. OAuth 로그인 플로우 + ProtectedRoute
5. 메인 레이아웃 (Nav, Sidebar) + 전체 라우트 구조

## 파일 구조

```
apps/web/src/
  stores/
    authStore.ts         # Layer 2: 인증 상태 (user, accessToken, refreshToken)
    connectionStore.ts   # Layer 1: WS 연결 상태 (wsClient, state, sessionId)
    uiStore.ts           # Layer 3: UI 상태 (sidebar, modal, theme)
  hooks/
    useWsClient.ts       # WsClient lifecycle + connectionStore 동기화
    useWsEvent.ts        # 특정 WS 이벤트 구독 hook
    useAuth.ts           # authStore + React Query 통합
  services/
    api.ts               # (기존) ApiClient
    queryClient.ts       # React Query 설정
  features/
    auth/
      api.ts             # useMe, useLogout, useRefreshToken
      LoginPage.tsx       # OAuth 로그인 UI
      AuthCallbackPage.tsx # OAuth 콜백 처리
    lobby/
      api.ts             # useThemes, useRooms
    profile/
      api.ts             # useProfile, useUpdateProfile
  shared/
    components/
      Layout.tsx          # (기존) 기본 래퍼 → 심플 유지
      MainLayout.tsx      # 인증된 사용자용 (Nav + Sidebar + Outlet)
      Nav.tsx             # 상단 네비게이션
      Sidebar.tsx         # 좌측 사이드바
      ProtectedRoute.tsx  # 인증 가드
  pages/
    HomePage.tsx          # (기존) 랜딩
    NotFoundPage.tsx      # (기존) 404
    LobbyPage.tsx         # 테마 목록 (placeholder)
    ProfilePage.tsx       # 프로필 (placeholder)
    RoomPage.tsx          # 방 대기실 (placeholder)
    EditorPage.tsx        # 에디터 (placeholder)
    AdminPage.tsx         # 어드민 (placeholder)
  App.tsx                 # 라우트 트리 + QueryClientProvider
  main.tsx                # (기존) Sentry + 글로벌 에러
```

## 1. Zustand 스토어

### authStore
```ts
interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
interface AuthActions {
  setTokens: (access: string, refresh: string) => void;
  setUser: (user: User) => void;
  logout: () => void;
  clear: () => void;
}
```
- localStorage에 refreshToken 저장 (accessToken은 메모리 only)
- logout 시 서버 호출 + 상태 초기화 + localStorage 클리어

### connectionStore
```ts
interface ConnectionState {
  gameClient: WsClient | null;
  socialClient: WsClient | null;
  gameState: WsClientState;
  socialState: WsClientState;
  sessionId: string | null;
}
interface ConnectionActions {
  connectGame: (sessionId: string, token: string) => void;
  connectSocial: (token: string) => void;
  disconnectAll: () => void;
}
```
- /ws/game, /ws/social 분리
- WsClient 인스턴스 관리, state 동기화

### uiStore
```ts
interface UIState {
  sidebarOpen: boolean;
  activeModal: string | null;
  theme: 'dark'; // 다크 모드 기본 (향후 라이트 지원)
}
```

## 2. React Query

### queryClient.ts
- defaultOptions: staleTime 30초, retry 1회
- onError: showErrorToast 통합
- QueryClientProvider를 App.tsx에 래핑

### API hooks 패턴
```ts
// features/auth/api.ts
export function useMe() {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => api.get<UserResponse>('/v1/auth/me'),
    retry: false,
  });
}
```

## 3. WsClient 연동

### useWsClient hook
```ts
function useWsClient(endpoint: 'game' | 'social', options?: {
  sessionId?: string;
  autoConnect?: boolean;
}) => {
  client: WsClient | null;
  state: WsClientState;
  send: (type, payload) => void;
  connect: () => void;
  disconnect: () => void;
}
```
- connectionStore와 동기화
- cleanup on unmount
- authStore.accessToken 자동 전달

### useWsEvent hook
```ts
function useWsEvent<T>(
  endpoint: 'game' | 'social',
  eventType: WsEventType,
  handler: (payload: T, seq: number) => void,
): void
```
- useEffect로 on/off lifecycle 관리

## 4. OAuth 플로우

```
[LoginPage] → 카카오/구글 OAuth URL로 리다이렉트
→ Provider가 /auth/callback?code=xxx&provider=kakao 로 리다이렉트
→ [AuthCallbackPage] code+provider 추출 → POST /api/v1/auth/callback
→ TokenPair 수신 → authStore.setTokens → /lobby 로 이동
```

### 토큰 갱신
- api.ts의 rawFetch에서 401 응답 시 자동 refresh 시도
- refreshToken으로 POST /api/v1/auth/refresh
- 성공: 새 토큰 설정 + 원래 요청 재시도
- 실패: logout + /login 리다이렉트

### ProtectedRoute
```tsx
function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuthStore();
  const { data: user, isLoading: meLoading } = useMe();

  if (isLoading || meLoading) return <LoadingSpinner />;
  if (!isAuthenticated) return <Navigate to="/login" />;
  return children;
}
```

## 5. 라우트 구조

```tsx
<Routes>
  {/* Public */}
  <Route path="/" element={<HomePage />} />
  <Route path="/login" element={<LoginPage />} />
  <Route path="/auth/callback" element={<AuthCallbackPage />} />

  {/* Authenticated — MainLayout */}
  <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
    <Route path="/lobby" element={<LobbyPage />} />
    <Route path="/profile" element={<ProfilePage />} />
    <Route path="/room/:id" element={<RoomPage />} />
    <Route path="/editor" element={<EditorPage />} />
    <Route path="/admin" element={<AdminPage />} />
  </Route>

  <Route path="*" element={<NotFoundPage />} />
</Routes>
```

## 6. 레이아웃

### Nav
- 좌: 로고 (MMP) + 홈 링크
- 우: 유저 아바타 + 드롭다운 (프로필, 설정, 로그아웃)
- 반응형: 모바일에서 햄버거 메뉴

### Sidebar
- 네비게이션: 로비, 에디터, 관리자 (역할별 표시)
- 접기/펼치기 (uiStore.sidebarOpen)
- 현재 경로 하이라이트

## 설계 결정

1. **accessToken 메모리 only** — XSS 피해 최소화. refreshToken만 localStorage.
2. **WS 분리 (game/social)** — 게임 세션과 소셜 채팅 독립. 설계 문서 일치.
3. **React Query + Zustand 분리** — RQ는 서버 상태(캐시), Zustand는 클라이언트 상태.
4. **Placeholder 페이지** — Phase 7-B/C에서 실제 UI 구현. 7-A는 뼈대만.
5. **401 자동 갱신** — api.ts에서 interceptor 패턴으로 투명하게 처리.

## 테스트 계획

- **단위 (Vitest)**: authStore, connectionStore, uiStore 각 스토어 로직
- **Hook (Vitest + renderHook)**: useWsClient, useWsEvent, useAuth
- **컴포넌트 (Vitest + Testing Library)**: ProtectedRoute, Nav, Sidebar
- **통합**: API hooks + MSW 모킹
- **Typecheck**: tsc --noEmit 0 errors
