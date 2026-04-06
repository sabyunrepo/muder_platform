import { Link } from "react-router";
import { Coins, ShoppingBag } from "lucide-react";

import { Spinner } from "@/shared/components/ui";
import { useDashboard } from "../api";

export function CreatorDashboard() {
  const { data, isLoading, isError } = useDashboard();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="py-12 text-center text-slate-400">
        대시보드를 불러오지 못했습니다.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-slate-100">제작자 대시보드</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Total Earnings */}
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-6">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Coins className="h-4 w-4 text-amber-500" />
            총 수익
          </div>
          <p className="mt-2 text-3xl font-bold text-amber-400">
            {data.total_earnings.toLocaleString("ko-KR")}
            <span className="ml-1 text-base font-normal text-slate-400">
              코인
            </span>
          </p>
        </div>

        {/* Unsettled Earnings */}
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-6">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Coins className="h-4 w-4 text-slate-400" />
            미정산
          </div>
          <p className="mt-2 text-3xl font-bold text-slate-100">
            {data.unsettled_earnings.toLocaleString("ko-KR")}
            <span className="ml-1 text-base font-normal text-slate-400">
              코인
            </span>
          </p>
        </div>

        {/* Total Sales */}
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-6">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <ShoppingBag className="h-4 w-4 text-slate-400" />
            총 판매
          </div>
          <p className="mt-2 text-3xl font-bold text-slate-100">
            {data.total_sales.toLocaleString("ko-KR")}
            <span className="ml-1 text-base font-normal text-slate-400">
              건
            </span>
          </p>
        </div>
      </div>

      {/* Quick Links */}
      <div className="flex gap-4">
        <Link
          to="/creator/earnings"
          className="text-sm text-amber-400 transition-colors hover:text-amber-300"
        >
          수익 내역 &rarr;
        </Link>
        <Link
          to="/creator/settlements"
          className="text-sm text-amber-400 transition-colors hover:text-amber-300"
        >
          정산 내역 &rarr;
        </Link>
      </div>
    </div>
  );
}
