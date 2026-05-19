import { Navigate } from 'react-router';
import { LogIn } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { LoginFormSection } from '@/features/auth/LoginFormSection';
import { OAuthSection } from '@/features/auth/OAuthSection';
import { useLoginSubmit } from '@/features/auth/useLoginSubmit';
import { PublicThemeShell } from '@/shared/components/PublicThemeShell';

function LoginPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const loginSubmit = useLoginSubmit();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <PublicThemeShell center>
      <div className="w-full max-w-sm rounded-xl border border-[var(--mmp-color-hairline)] bg-[var(--mmp-color-surface)] p-8 shadow-[var(--mmp-shadow-card)]">
        <div className="mb-6 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--mmp-color-tint-amber)]">
            <LogIn className="h-7 w-7 text-[var(--mmp-color-primary)]" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--mmp-color-ink)]">
            {loginSubmit.mode === 'login' ? '로그인' : '회원가입'}
          </h1>
          <p className="text-center text-sm text-[var(--mmp-color-steel)]">
            Murder Mystery Platform에 오신 것을 환영합니다
          </p>
        </div>

        <LoginFormSection
          mode={loginSubmit.mode}
          email={loginSubmit.email}
          password={loginSubmit.password}
          nickname={loginSubmit.nickname}
          error={loginSubmit.error}
          loading={loginSubmit.loading}
          onEmailChange={loginSubmit.setEmail}
          onPasswordChange={loginSubmit.setPassword}
          onNicknameChange={loginSubmit.setNickname}
          onToggleMode={loginSubmit.toggleMode}
          onSubmit={loginSubmit.handleSubmit}
        />

        <div className="mb-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-[var(--mmp-color-hairline)]" />
          <span className="text-xs text-[var(--mmp-color-steel)]">또는</span>
          <div className="h-px flex-1 bg-[var(--mmp-color-hairline)]" />
        </div>

        <OAuthSection />
      </div>
    </PublicThemeShell>
  );
}

export default LoginPage;
