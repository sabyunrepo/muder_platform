import { useMemo } from "react";
import { BarChart3 } from "lucide-react";

import { Spinner, EmptyState } from "@/shared/components/ui";
import { useThemeStats } from "../api";

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

  const { data: stats, isLoading, isError } = useThemeStats(
    themeId,
    resolvedFrom,
    resolvedTo,
  );

  const maxSales = useMemo(() => {
    if (!stats || stats.length === 0) return 1;
    return Math.max(...stats.map((s) => s.sales_count), 1);
  }, [stats]);

  const maxCoins = useMemo(() => {
    if (!stats || stats.length === 0) return 1;
    return Math.max(...stats.map((s) => s.daily_earnings), 1);
  }, [stats]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="md" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="py-8 text-center text-slate-400">
        통계를 불러오지 못했습니다.
      </div>
    );
  }

  if (!stats || stats.length === 0) {
    return (
      <EmptyState
        icon={<BarChart3 className="h-8 w-8" />}
        title="해당 기간 데이터가 없습니다"
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Sales Bar Chart */}
      <div className="rounded-lg bg-slate-800 p-4">
        <h3 className="mb-4 text-sm font-medium text-slate-400">
          일별 판매 수
        </h3>
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
                  className="w-full rounded-t bg-amber-500 transition-colors group-hover:bg-amber-400"
                />
              </div>
              {/* Tooltip */}
              <div className="pointer-events-none absolute -top-8 hidden rounded bg-slate-700 px-2 py-1 text-xs text-slate-200 group-hover:block">
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
              className="flex-1 text-center text-[10px] text-slate-500"
            >
              {i % Math.max(1, Math.floor(stats.length / 7)) === 0
                ? s.date.slice(5)
                : ""}
            </div>
          ))}
        </div>
      </div>

      {/* Coins Bar Chart */}
      <div className="rounded-lg bg-slate-800 p-4">
        <h3 className="mb-4 text-sm font-medium text-slate-400">
          일별 수익 코인
        </h3>
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
                  className="w-full rounded-t bg-emerald-500 transition-colors group-hover:bg-emerald-400"
                />
              </div>
              <div className="pointer-events-none absolute -top-8 hidden rounded bg-slate-700 px-2 py-1 text-xs text-slate-200 group-hover:block">
                {s.daily_earnings.toLocaleString("ko-KR")}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-1">
          {stats.map((s, i) => (
            <div
              key={`label-coins-${s.date}`}
              className="flex-1 text-center text-[10px] text-slate-500"
            >
              {i % Math.max(1, Math.floor(stats.length / 7)) === 0
                ? s.date.slice(5)
                : ""}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
