import { useState } from "react";

import { Badge, EmptyState, Pagination, Spinner } from "@/shared/components/ui";
import type { Settlement } from "../api";
import { useSettlements } from "../api";
import {
  CREATOR_PAGE_SIZE,
  SETTLEMENT_STATUS_LABEL,
  type SettlementStatus,
} from "../constants";
import { formatKRW } from "@/shared/utils/format";

const STATUS_VARIANT: Record<
  SettlementStatus,
  "warning" | "info" | "success" | "danger"
> = {
  CALCULATED: "warning",
  APPROVED: "info",
  PAID_OUT: "success",
  CANCELLED: "danger",
};

function formatPeriod(start: string, end: string): string {
  const s = new Date(start).toLocaleDateString("ko-KR");
  const e = new Date(end).toLocaleDateString("ko-KR");
  return `${s} ~ ${e}`;
}

function StatusBadge({ status }: { status: Settlement["status"] }) {
  return (
    <Badge variant={STATUS_VARIANT[status]}>
      {SETTLEMENT_STATUS_LABEL[status]}
    </Badge>
  );
}

export function SettlementList() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useSettlements(page);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="py-12 text-center text-slate-400">
        정산 내역을 불러오지 못했습니다.
      </div>
    );
  }

  if (!data || data.data.length === 0) {
    return <EmptyState title="정산 내역이 없습니다" />;
  }

  const totalPages = Math.ceil(data.total / CREATOR_PAGE_SIZE);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-100">정산 내역</h1>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700">
              <th scope="col" className="py-3 text-left text-sm font-medium text-slate-400">
                기간
              </th>
              <th scope="col" className="py-3 text-right text-sm font-medium text-slate-400">
                총 코인
              </th>
              <th scope="col" className="py-3 text-right text-sm font-medium text-slate-400">
                총 금액
              </th>
              <th scope="col" className="py-3 text-right text-sm font-medium text-slate-400">
                세금
              </th>
              <th scope="col" className="py-3 text-right text-sm font-medium text-slate-400">
                실지급액
              </th>
              <th scope="col" className="py-3 text-right text-sm font-medium text-slate-400">
                상태
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {data.data.map((settlement) => (
              <tr key={settlement.id}>
                <td className="py-3 text-sm text-slate-300">
                  {formatPeriod(
                    settlement.period_start,
                    settlement.period_end,
                  )}
                </td>
                <td className="py-3 text-right text-sm text-slate-300">
                  {settlement.total_coins.toLocaleString("ko-KR")}
                </td>
                <td className="py-3 text-right text-sm text-slate-200">
                  {formatKRW(settlement.total_krw)}
                </td>
                <td className="py-3 text-right text-sm text-slate-400">
                  {formatKRW(settlement.tax_amount)}
                </td>
                <td className="py-3 text-right text-sm font-medium text-amber-400">
                  {formatKRW(settlement.net_amount)}
                </td>
                <td className="py-3 text-right">
                  <StatusBadge status={settlement.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-center">
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
