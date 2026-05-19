import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Coins, Sparkles } from 'lucide-react';
import { Badge, Card, LoadingState } from '@/shared/components/ui';
import { usePackages } from '@/features/payment/api';
import type { CoinPackage } from '@/features/payment/api';
import { useAuthStore } from '@/stores/authStore';
import { PaymentModal } from './PaymentModal';

// ---------------------------------------------------------------------------
// 코인 패키지 상점
// ---------------------------------------------------------------------------

function PackageCard({
  pkg,
  onSelect,
}: {
  pkg: CoinPackage;
  onSelect: (pkg: CoinPackage) => void;
}) {
  return (
    <Card hoverable onClick={() => onSelect(pkg)}>
      <div className="flex flex-col gap-3">
        {/* 패키지명 + 가격 */}
        <div className="flex items-start justify-between">
          <h3 className="text-base font-semibold text-[var(--mmp-color-ink)]">{pkg.name}</h3>
          <span className="text-lg font-bold text-[var(--mmp-color-ink)]">
            {pkg.price_krw.toLocaleString('ko-KR')}
            <span className="ml-0.5 text-sm font-normal text-[var(--mmp-color-steel)]">원</span>
          </span>
        </div>

        {/* 코인 정보 */}
        <div className="flex items-center gap-2">
          <Coins className="h-5 w-5 text-[var(--mmp-color-primary)]" />
          <span className="text-xl font-bold text-[var(--mmp-color-primary)]">
            {pkg.total_coins.toLocaleString('ko-KR')}
          </span>
        </div>

        {/* 기본 + 보너스 분리 표시 */}
        <div className="flex items-center gap-2 text-sm text-[var(--mmp-color-steel)]">
          <span>기본 {pkg.base_coins.toLocaleString('ko-KR')}</span>
          {pkg.bonus_coins > 0 && (
            <Badge variant="warning" size="sm">
              <Sparkles className="mr-1 h-3 w-3" />
              보너스 +{pkg.bonus_coins.toLocaleString('ko-KR')}
            </Badge>
          )}
        </div>
      </div>
    </Card>
  );
}

export function CoinPackageList() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { data: packages, isLoading } = usePackages('WEB');
  const [selected, setSelected] = useState<CoinPackage | null>(null);

  function handleSelect(pkg: CoinPackage) {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    setSelected(pkg);
  }

  if (isLoading) {
    return <LoadingState label="코인 패키지를 불러오는 중" className="py-20" />;
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {packages?.map((pkg) => (
          <PackageCard key={pkg.id} pkg={pkg} onSelect={handleSelect} />
        ))}
      </div>

      {selected && (
        <PaymentModal pkg={selected} isOpen={!!selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
