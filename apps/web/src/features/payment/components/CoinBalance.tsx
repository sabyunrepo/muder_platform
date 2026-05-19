import { useNavigate } from 'react-router';
import { Coins } from 'lucide-react';
import { useBalance } from '@/features/coin/api';
import { useAuthStore } from '@/stores/authStore';

// ---------------------------------------------------------------------------
// Nav 삽입용 잔액 위젯
// ---------------------------------------------------------------------------

export function CoinBalance() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { data: balance } = useBalance({ enabled: isAuthenticated });

  const total = balance ? balance.total_coins : 0;

  if (!isAuthenticated) {
    return (
      <button
        type="button"
        onClick={() => navigate('/login')}
        className="flex items-center gap-1.5 rounded-lg border border-[var(--mmp-color-hairline)] px-3 py-1.5 text-sm font-medium text-[var(--mmp-color-charcoal)] transition-colors hover:bg-[var(--mmp-color-surface-soft)]"
      >
        <Coins className="h-4 w-4 text-[var(--mmp-color-primary)]" />
        로그인하면 잔액을 볼 수 있어요
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => navigate('/shop')}
      className="flex items-center gap-1.5 rounded-lg bg-[color-mix(in_oklab,var(--mmp-color-primary)_12%,transparent)] px-3 py-1.5 text-sm font-medium text-[var(--mmp-color-primary)] transition-colors hover:bg-[color-mix(in_oklab,var(--mmp-color-primary)_20%,transparent)]"
      aria-label={`코인 잔액 ${total.toLocaleString('ko-KR')}개, 상점으로 이동`}
    >
      <Coins className="h-4 w-4" />
      <span>{total.toLocaleString('ko-KR')}</span>
    </button>
  );
}
