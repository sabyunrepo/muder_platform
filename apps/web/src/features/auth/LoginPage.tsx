import { useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { LogIn } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { getOAuthUrl } from "@/features/auth/oauth-urls";
import { api } from "@/services/api";

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

function LoginPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const navigate = useNavigate();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // 이미 로그인 상태면 로비로 이동
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleKakaoLogin = () => {
    window.location.href = getOAuthUrl("kakao");
  };

  const handleGoogleLogin = () => {
    window.location.href = getOAuthUrl("google");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint = mode === "register" ? "/v1/auth/register" : "/v1/auth/login";
      const body = mode === "register"
        ? { email, password, nickname }
        : { email, password };

      const tokens = await api.post<TokenPair>(endpoint, body);
      useAuthStore.getState().setTokens(tokens.access_token, tokens.refresh_token);

      const user = await api.get<UserResponse>("/v1/auth/me");
      useAuthStore.getState().setUser({
        id: user.id,
        nickname: user.nickname,
        email: user.email,
        profileImage: user.avatar_url,
        role: user.role as "user" | "creator" | "admin",
        provider: user.provider,
      });

      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그인에 실패했습니다");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 p-8 shadow-2xl">
        {/* 로고 + 제목 */}
        <div className="mb-6 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10">
            <LogIn className="h-7 w-7 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100">
            {mode === "login" ? "로그인" : "회원가입"}
          </h1>
          <p className="text-sm text-slate-400">
            Murder Mystery Platform에 오신 것을 환영합니다
          </p>
        </div>

        {/* 이메일/비밀번호 폼 */}
        <form onSubmit={handleSubmit} className="mb-6 flex flex-col gap-3">
          {mode === "register" && (
            <input
              type="text"
              placeholder="닉네임"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              required
              minLength={2}
              maxLength={30}
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
            />
          )}
          <input
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
          />
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={4}
            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
          />
          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-amber-500 px-4 py-3 text-sm font-semibold text-slate-950 transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "처리 중..." : mode === "login" ? "로그인" : "회원가입"}
          </button>
          <button
            type="button"
            onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
            className="text-sm text-slate-400 hover:text-amber-400"
          >
            {mode === "login" ? "계정이 없으신가요? 회원가입" : "이미 계정이 있으신가요? 로그인"}
          </button>
        </form>

        {/* 구분선 */}
        <div className="mb-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-700" />
          <span className="text-xs text-slate-500">또는</span>
          <div className="h-px flex-1 bg-slate-700" />
        </div>

        {/* OAuth 버튼 */}
        <div className="flex flex-col gap-3">
          {/* 카카오 로그인 */}
          <button
            type="button"
            onClick={handleKakaoLogin}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#FEE500] px-4 py-3 text-sm font-semibold text-[#191919] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 3C6.477 3 2 6.463 2 10.691c0 2.724 1.8 5.117 4.508 6.473-.197.735-.714 2.666-.818 3.08-.128.507.186.5.39.364.16-.106 2.55-1.734 3.58-2.44.77.112 1.562.17 2.34.17 5.523 0 10-3.463 10-7.647C22 6.463 17.523 3 12 3" />
            </svg>
            카카오로 시작하기
          </button>

          {/* 구글 로그인 */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-3 text-sm font-semibold text-gray-900 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Google로 시작하기
          </button>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
