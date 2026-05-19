import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { Button, Input } from '@/shared/components/ui';
import type { AuthMode } from '@/features/auth/useLoginSubmit';

interface LoginFormSectionProps {
  mode: AuthMode;
  email: string;
  password: string;
  nickname: string;
  error: string;
  loading: boolean;
  onEmailChange: Dispatch<SetStateAction<string>>;
  onPasswordChange: Dispatch<SetStateAction<string>>;
  onNicknameChange: Dispatch<SetStateAction<string>>;
  onToggleMode: () => void;
  onSubmit: (event: FormEvent) => void;
}

export function LoginFormSection({
  mode,
  email,
  password,
  nickname,
  error,
  loading,
  onEmailChange,
  onPasswordChange,
  onNicknameChange,
  onToggleMode,
  onSubmit,
}: LoginFormSectionProps) {
  return (
    <form onSubmit={onSubmit} autoComplete="on" className="mb-6 flex flex-col gap-3">
      {mode === 'register' && (
        <Input
          id="nickname"
          name="nickname"
          type="text"
          placeholder="닉네임"
          aria-label="닉네임"
          autoComplete="nickname"
          value={nickname}
          onChange={(event) => onNicknameChange(event.target.value)}
          required
          minLength={2}
          maxLength={30}
          className="min-h-12 px-4"
        />
      )}
      <Input
        id="email"
        name="email"
        type="email"
        placeholder="이메일"
        aria-label="이메일"
        autoComplete="username"
        value={email}
        onChange={(event) => onEmailChange(event.target.value)}
        required
        className="min-h-12 px-4"
      />
      <Input
        id={mode === 'register' ? 'new-password' : 'current-password'}
        name="password"
        type="password"
        placeholder="비밀번호"
        aria-label="비밀번호"
        autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
        value={password}
        onChange={(event) => onPasswordChange(event.target.value)}
        required
        minLength={4}
        className="min-h-12 px-4"
      />
      {error && <p className="text-sm text-[var(--mmp-color-error)]">{error}</p>}
      <Button type="submit" isLoading={loading} className="w-full" size="lg">
        {loading ? '처리 중...' : mode === 'login' ? '로그인' : '회원가입'}
      </Button>
      <button
        type="button"
        onClick={onToggleMode}
        className="rounded-md py-1 text-sm text-[var(--mmp-color-steel)] transition hover:text-[var(--mmp-color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mmp-color-primary)]"
      >
        {mode === 'login' ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
      </button>
    </form>
  );
}
