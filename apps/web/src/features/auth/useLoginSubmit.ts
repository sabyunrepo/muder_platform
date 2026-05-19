import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/services/api';

export type AuthMode = 'login' | 'register';

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

export function useLoginSubmit() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const toggleMode = () => {
    setMode((current) => (current === 'login' ? 'register' : 'login'));
    setError('');
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = mode === 'register' ? '/v1/auth/register' : '/v1/auth/login';
      const body = mode === 'register' ? { email, password, nickname } : { email, password };

      const tokens = await api.post<TokenPair>(endpoint, body);
      useAuthStore.getState().setTokens(tokens.access_token, tokens.refresh_token);

      const user = await api.get<UserResponse>('/v1/auth/me');
      useAuthStore.getState().setUser({
        id: user.id,
        nickname: user.nickname,
        email: user.email,
        profileImage: user.avatar_url,
        role: user.role as 'user' | 'creator' | 'admin',
        provider: user.provider,
      });

      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  return {
    mode,
    email,
    password,
    nickname,
    error,
    loading,
    setEmail,
    setPassword,
    setNickname,
    toggleMode,
    handleSubmit,
  };
}
