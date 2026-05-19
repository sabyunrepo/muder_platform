import { useState } from 'react';
import { Link } from 'react-router';
import { Menu, User, LogOut, ChevronDown } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { useAuth } from '@/hooks/useAuth';
import { CoinBalance } from '@/features/payment/components/CoinBalance';
import { ThemeModeToggle } from '@/shared/components/ui';

// ---------------------------------------------------------------------------
// 상단 네비게이션 바
// ---------------------------------------------------------------------------

export function Nav() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { logout } = useAuth();
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);

  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-[var(--mmp-color-hairline)] bg-[var(--mmp-color-surface)] px-4 text-[var(--mmp-color-ink)] shadow-sm lg:px-6">
      {/* 좌측: 모바일 햄버거 + 로고 */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggleSidebar}
          className="rounded-md p-2 text-[var(--mmp-color-steel)] transition hover:bg-[var(--mmp-color-surface-soft)] hover:text-[var(--mmp-color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mmp-color-primary)] lg:hidden"
          aria-label="사이드바 토글"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link to="/" className="text-lg font-bold text-[var(--mmp-color-primary)]">
          MMP
        </Link>
      </div>

      {/* 우측: 코인 잔액 + 유저 메뉴 또는 로그인 링크 */}
      <div className="flex items-center gap-3">
        <ThemeModeToggle compact ariaLabel="화면 모드" />
        {isAuthenticated && user && <CoinBalance />}
        <div className="relative">
          {isAuthenticated && user ? (
            <>
              <button
                type="button"
                onClick={() => setDropdownOpen((prev) => !prev)}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-[var(--mmp-color-charcoal)] transition hover:bg-[var(--mmp-color-surface-soft)] hover:text-[var(--mmp-color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mmp-color-primary)]"
              >
                {user.profileImage ? (
                  <img
                    src={user.profileImage}
                    alt={user.nickname}
                    className="h-7 w-7 rounded-full object-cover"
                  />
                ) : (
                  <User className="h-5 w-5 text-[var(--mmp-color-steel)]" />
                )}
                <span className="hidden sm:inline">{user.nickname}</span>
                <ChevronDown className="h-4 w-4 text-[var(--mmp-color-muted)]" />
              </button>

              {/* 드롭다운 메뉴 */}
              {dropdownOpen && (
                <>
                  {/* 오버레이 (클릭 시 닫기) */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setDropdownOpen(false)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setDropdownOpen(false);
                    }}
                    role="presentation"
                  />
                  <div className="absolute right-0 z-50 mt-2 w-48 rounded-lg border border-[var(--mmp-color-hairline)] bg-[var(--mmp-color-surface)] py-1 shadow-[var(--mmp-shadow-card)]">
                    <Link
                      to="/profile"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-[var(--mmp-color-charcoal)] hover:bg-[var(--mmp-color-surface-soft)] hover:text-[var(--mmp-color-ink)]"
                    >
                      <User className="h-4 w-4" />
                      프로필
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        logout();
                        setDropdownOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-[var(--mmp-color-charcoal)] hover:bg-[var(--mmp-color-surface-soft)] hover:text-[var(--mmp-color-ink)]"
                    >
                      <LogOut className="h-4 w-4" />
                      로그아웃
                    </button>
                  </div>
                </>
              )}
            </>
          ) : (
            <Link
              to="/login"
              className="rounded-md px-4 py-2 text-sm font-medium text-[var(--mmp-color-primary)] hover:bg-[var(--mmp-color-surface-soft)]"
            >
              로그인
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
