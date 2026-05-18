import { Coins, Banknote, CheckCircle, FileText } from 'lucide-react';
import { Button, Card, LoadingState, SectionHeader } from '@/shared/components/ui';
import { useAdminRevenue } from '@/features/admin/api';
import { formatKRW } from '@/shared/utils/format';

// ---------------------------------------------------------------------------
// 포맷 헬퍼
// ---------------------------------------------------------------------------

function formatNumber(n: number): string {
  return new Intl.NumberFormat('ko-KR').format(n);
}

// ---------------------------------------------------------------------------
// 카드 데이터
// ---------------------------------------------------------------------------

interface StatCard {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const STAT_CARDS: StatCard[] = [
  { label: '총 코인', icon: Coins, color: 'text-[var(--mmp-color-primary)]' },
  { label: '총 매출 (KRW)', icon: Banknote, color: 'text-[var(--mmp-color-success)]' },
  { label: '총 세금', icon: CheckCircle, color: 'text-[var(--mmp-color-info)]' },
  { label: '순수익', icon: FileText, color: 'text-[var(--mmp-color-error)]' },
];

// ---------------------------------------------------------------------------
// AdminRevenue
// ---------------------------------------------------------------------------

export function AdminRevenue() {
  const { data, isLoading, isError, refetch } = useAdminRevenue();

  if (isLoading) {
    return <LoadingState label="매출 정보를 불러오는 중" className="py-16" />;
  }

  if (isError || !data) {
    return (
      <Card className="text-center">
        <p className="text-sm text-[var(--mmp-color-error)]">매출 정보를 불러오지 못했습니다.</p>
        <Button variant="secondary" size="sm" className="mt-3" onClick={() => refetch()}>
          재시도
        </Button>
      </Card>
    );
  }

  const values = [
    formatNumber(data.total_coins),
    formatKRW(data.total_krw),
    formatKRW(data.total_tax),
    formatKRW(data.total_net),
  ];

  return (
    <div className="space-y-6">
      <SectionHeader title="플랫폼 매출" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {STAT_CARDS.map((card, i) => (
          <Card key={card.label}>
            <div className="flex items-center gap-4">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--mmp-color-surface-soft)] ${card.color}`}
              >
                <card.icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-[var(--mmp-color-steel)]">{card.label}</p>
                <p className="text-xl font-bold text-[var(--mmp-color-ink)]">{values[i]}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
