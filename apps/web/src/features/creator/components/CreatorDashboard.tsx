import { Link } from 'react-router';
import { Coins, ShoppingBag } from 'lucide-react';

import { Card, LoadingState, SectionHeader } from '@/shared/components/ui';
import { useDashboard } from '../api';

export function CreatorDashboard() {
  const { data, isLoading, isError } = useDashboard();

  if (isLoading) {
    return <LoadingState label="제작자 대시보드를 불러오는 중" className="py-20" />;
  }

  if (isError || !data) {
    return (
      <div className="py-12 text-center text-[var(--mmp-color-steel)]">
        대시보드를 불러오지 못했습니다.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <SectionHeader title="제작자 대시보드" />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Total Earnings */}
        <Card padding="lg">
          <div className="flex items-center gap-2 text-sm text-[var(--mmp-color-steel)]">
            <Coins className="h-4 w-4 text-[var(--mmp-color-primary)]" />총 수익
          </div>
          <p className="mt-2 text-3xl font-bold text-[var(--mmp-color-primary)]">
            {data.total_earnings.toLocaleString('ko-KR')}
            <span className="ml-1 text-base font-normal text-[var(--mmp-color-steel)]">코인</span>
          </p>
        </Card>

        {/* Unsettled Earnings */}
        <Card padding="lg">
          <div className="flex items-center gap-2 text-sm text-[var(--mmp-color-steel)]">
            <Coins className="h-4 w-4 text-[var(--mmp-color-muted)]" />
            미정산
          </div>
          <p className="mt-2 text-3xl font-bold text-[var(--mmp-color-ink)]">
            {data.unsettled_earnings.toLocaleString('ko-KR')}
            <span className="ml-1 text-base font-normal text-[var(--mmp-color-steel)]">코인</span>
          </p>
        </Card>

        {/* Total Sales */}
        <Card padding="lg">
          <div className="flex items-center gap-2 text-sm text-[var(--mmp-color-steel)]">
            <ShoppingBag className="h-4 w-4 text-[var(--mmp-color-muted)]" />총 판매
          </div>
          <p className="mt-2 text-3xl font-bold text-[var(--mmp-color-ink)]">
            {data.total_sales.toLocaleString('ko-KR')}
            <span className="ml-1 text-base font-normal text-[var(--mmp-color-steel)]">건</span>
          </p>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="flex gap-4">
        <Link
          to="/creator/earnings"
          className="text-sm text-[var(--mmp-color-primary)] transition-colors hover:text-[var(--mmp-color-primary-strong)]"
        >
          수익 내역 &rarr;
        </Link>
        <Link
          to="/creator/settlements"
          className="text-sm text-[var(--mmp-color-primary)] transition-colors hover:text-[var(--mmp-color-primary-strong)]"
        >
          정산 내역 &rarr;
        </Link>
      </div>
    </div>
  );
}
