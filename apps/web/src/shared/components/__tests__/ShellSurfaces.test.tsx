import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { ComponentErrorBoundary, PageErrorBoundary } from '@/components/error';
import { AppearanceProvider } from '@/shared/appearance';
import { MainLayout } from '@/shared/components/MainLayout';
import { NetworkBanner } from '@/shared/components/NetworkBanner';
import { useAuthStore } from '@/stores/authStore';

const { networkStatusMock } = vi.hoisted(() => ({
  networkStatusMock: vi.fn(),
}));

vi.mock('@/shared/hooks/useNetworkStatus', () => ({
  useNetworkStatus: networkStatusMock,
}));

vi.mock('@/hooks/useWsClient', () => ({
  useWsClient: vi.fn(),
}));

vi.mock('@/features/social/hooks/useSocialSync', () => ({
  useSocialSync: vi.fn(),
}));

function ThrowingChild() {
  throw new Error('boom');
}

describe('Shell surfaces', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    networkStatusMock.mockReturnValue('online');
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  });

  afterEach(() => {
    cleanup();
    consoleErrorSpy.mockRestore();
    vi.clearAllMocks();
  });

  it('renders the authenticated app shell with themed navigation chrome', () => {
    const { container } = render(
      <AppearanceProvider>
        <MemoryRouter initialEntries={['/lobby']}>
          <Routes>
            <Route element={<MainLayout />}>
              <Route path="/lobby" element={<div>로비 콘텐츠</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AppearanceProvider>
    );

    expect(screen.getByText('MMP')).toBeDefined();
    expect(screen.getByText('로비')).toBeDefined();
    expect(screen.getByText('로비 콘텐츠')).toBeDefined();
    expect(screen.getAllByRole('group', { name: '화면 모드' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: '다크' }).length).toBeGreaterThan(0);
    expect(container.firstElementChild?.className).toContain('var(--mmp-color-canvas)');
  });

  it('shows network feedback using alert semantics', () => {
    networkStatusMock.mockReturnValue('offline');

    render(<NetworkBanner />);

    expect(screen.getByRole('alert').textContent).toContain('연결이 끊어졌습니다');
  });

  it('shows the page error fallback with a retry action', () => {
    render(
      <PageErrorBoundary>
        <ThrowingChild />
      </PageErrorBoundary>
    );

    expect(screen.getByText('페이지를 불러오지 못했습니다')).toBeDefined();
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeDefined();
  });

  it('shows the component error fallback without exposing raw error text', () => {
    render(
      <ComponentErrorBoundary>
        <ThrowingChild />
      </ComponentErrorBoundary>
    );

    expect(screen.getByText('로드 실패')).toBeDefined();
    expect(screen.queryByText('boom')).toBeNull();
  });
});
