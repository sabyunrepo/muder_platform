import { useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/authStore";
import { showErrorToast } from "@/lib/show-error-toast";
import { isApiHttpError } from "@/lib/api-error";

// ---------------------------------------------------------------------------
// Types
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

// ---------------------------------------------------------------------------
// 컴포넌트
// ---------------------------------------------------------------------------

function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const setTokens = useAuthStore((s) => s.setTokens);

  // 중복 실행 방지 (StrictMode 대응)
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    const code = searchParams.get("code");
    const provider = searchParams.get("provider");
    const state = searchParams.get("state");

    // OAuth state 검증 (CSRF 방어)
    const savedState = sessionStorage.getItem("oauth_state");
    sessionStorage.removeItem("oauth_state");

    if (!code || !provider || !state || state !== savedState) {
      navigate("/login", { replace: true });
      return;
    }

    const redirectUri = `${window.location.origin}/auth/callback?provider=${provider}`;

    api
      .post<TokenPair>("/v1/auth/callback", {
        provider,
        code,
        redirect_uri: redirectUri,
      })
      .then(async (tokens) => {
        setTokens(tokens.access_token, tokens.refresh_token);

        const me = await api.get<UserResponse>("/v1/auth/me");
        const setUser = useAuthStore.getState().setUser;
        setUser({
          id: me.id,
          nickname: me.nickname,
          email: me.email,
          profileImage: me.avatar_url,
          role: me.role as "user" | "creator" | "admin",
          provider: me.provider,
        });

        navigate("/lobby", { replace: true });
      })
      .catch((error: unknown) => {
        if (isApiHttpError(error)) {
          showErrorToast(error.apiError);
        }
        navigate("/login", { replace: true });
      });
  }, [searchParams, navigate, setTokens]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      <p className="text-sm text-slate-400">로그인 처리 중...</p>
    </div>
  );
}

export default AuthCallbackPage;
