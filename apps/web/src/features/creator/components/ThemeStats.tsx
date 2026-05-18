import { useMemo } from 'react';
import { BarChart3 } from 'lucide-react';

import { EmptyState, LoadingState, Panel } from '@/shared/components/ui';
import { useThemeStats } from '../api';

interface ThemeStatsProps {
  themeId: string;
  from?: string;
  to?: string;
}

function defaultDateRange(): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const past = new Date(now);
  past.setDate(past.getDate() - 30);
  const from = past.toISOString().slice(0, 10);
  return { from, to };
}

export function ThemeStats({ themeId, from, to }: ThemeStatsProps) {
  const defaults = useMemo(() => defaultDateRange(), []);
  const resolvedFrom = from ?? defaults.from;
  const resolvedTo = to ?? defaults.to;

  const { data: stats, isLoading, isError } = useThemeStats(themeId, resolvedFrom, resolvedTo);

  const maxSales = useMemo(() => {
    if (!stats || stats.length === 0) return 1;
    return Math.max(...stats.map((s) => s.sales_count), 1);
  }, [stats]);

  const maxCoins = useMemo(() => {
    if (!stats || stats.length === 0) return 1;
    return Math.max(...stats.map((s) => s.daily_earnings), 1);
  }, [stats]);

  if (isLoading) {
    return <LoadingState label="테마 통계를 불러오는 중" className="py-12" />;
  }

  if (isError) {
    return (
      <div className="py-8 text-center text-[var(--mmp-color-steel)]">
        통계를 불러오지 못했습니다.
      </div>
    );
  }

  if (!stats || stats.length === 0) {
    return (
      <EmptyState icon={<BarChart3 className="h-8 w-8" />} title="해당 기간 데이터가 없습니다" />
    );
  }

  return (
    <div className="space-y-6">
      {/* Sales Bar Chart */}
      <Panel>
        <h3 className="mb-4 text-sm font-medium text-[var(--mmp-color-steel)]">일별 판매 수</h3>
        <div className="flex h-40 items-end gap-1">
          {stats.map((s) => (
            <div
              key={`sales-${s.date}`}
              className="group relative flex flex-1 flex-col items-center"
            >
              <div className="relative w-full flex-1 flex items-end">
                <div
                  style={{
                    height: `${(s.sales_count / maxSales) * 100}%`,
                  }}
                  className="w-full rounded-t bg-[var(--mmp-color-primary)] transition-opacity group-hover:opacity-80"
                />
              </div>
              {/* Tooltip */}
              <div className="pointer-events-none absolute -top-8 hidden rounded bg-[var(--mmp-color-ink)] px-2 py-1 text-xs text-[var(--mmp-color-canvas)] group-hover:block">
                {s.sales_count}건
              </div>
            </div>
          ))}
        </div>
        {/* X Axis Labels */}
        <div className="mt-2 flex gap-1">
          {stats.map((s, i) => (
            <div
              key={`label-sales-${s.date}`}
              className="flex-1 text-center text-[10px] text-[var(--mmp-color-muted)]"
            >
              {i % Math.max(1, Math.floor(stats.length / 7)) === 0 ? s.date.slice(5) : ''}
            </div>
          ))}
        </div>
      </Panel>

      {/* Coins Bar Chart */}
      <Panel>
        <h3 className="mb-4 text-sm font-medium text-[var(--mmp-color-steel)]">일별 수익 코인</h3>
        <div className="flex h-40 items-end gap-1">
          {stats.map((s) => (
            <div
              key={`coins-${s.date}`}
              className="group relative flex flex-1 flex-col items-center"
            >
              <div className="relative w-full flex-1 flex items-end">
                <div
                  style={{
                    height: `${(s.daily_earnings / maxCoins) * 100}%`,
                  }}
                  className="w-full rounded-t bg-[var(--mmp-color-success)] transition-opacity group-hover:opacity-80"
                />
              </div>
              <div className="pointer-events-none absolute -top-8 hidden rounded bg-[var(--mmp-color-ink)] px-2 py-1 text-xs text-[var(--mmp-color-canvas)] group-hover:block">
                {s.daily_earnings.toLocaleString('ko-KR')}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-1">
          {stats.map((s, i) => (
            <div
              key={`label-coins-${s.date}`}
              className="flex-1 text-center text-[10px] text-[var(--mmp-color-muted)]"
            >
              {i % Math.max(1, Math.floor(stats.length / 7)) === 0 ? s.date.slice(5) : ''}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
