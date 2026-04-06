import { useState } from "react";
import { ArrowUpDown } from "lucide-react";
import {
  Badge,
  Pagination,
  Spinner,
  EmptyState,
} from "@/shared/components/ui";
import { useTransactions } from "@/features/coin/api";
import type { CoinTransaction } from "@/features/coin/api";
import { TRANSACTION_TYPE_LABEL } from "@/features/coin/constants";
import type { CoinTransactionType } from "@/features/coin/constants";

// ---------------------------------------------------------------------------
// 코인 이력 (타입별 필터 탭)
// ---------------------------------------------------------------------------

interface FilterTab {
  label: string;
  value: string | undefined;
}

const FILTER_TABS: FilterTab[] = [
  { label: "전체", value: undefined },
  { label: "충전", value: "CHARGE" },
  { label: "구매", value: "PURCHASE" },
  { label: "환불", value: "REFUND" },
];

const TYPE_VARIANT: Record<
  CoinTransactionType,
  "success" | "warning" | "danger" | "default" | "info"
> = {
  CHARGE: "success",
  PURCHASE: "warning",
  REFUND: "info",
  ADMIN_GRANT: "success",
  ADMIN_REVOKE: "danger",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TransactionRow({ tx }: { tx: CoinTransaction }) {
  const amount = tx.base_amount + tx.bonus_amount;
  const isPositive = amount >= 0;
  const balanceAfter = tx.balance_after_base + tx.balance_after_bonus;

  return (
    <tr className="border-b border-slate-800 last:border-b-0">
      <td className="px-4 py-3 text-sm text-slate-300">
        {formatDate(tx.created_at)}
      </td>
      <td className="px-4 py-3">
        <Badge variant={TYPE_VARIANT[tx.type]} size="sm">
          {TRANSACTION_TYPE_LABEL[tx.type]}
        </Badge>
      </td>
      <td
        className={`px-4 py-3 text-right text-sm font-medium ${
          isPositive ? "text-emerald-400" : "text-red-400"
        }`}
      >
        {isPositive ? "+" : ""}
        {amount.toLocaleString("ko-KR")}
      </td>
      <td className="px-4 py-3 text-right text-sm text-slate-400">
        {balanceAfter.toLocaleString("ko-KR")}
      </td>
    </tr>
  );
}

export function CoinTransactions() {
  const [filter, setFilter] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);
  const { data, isLoading } = useTransactions(filter, page);

  function handleFilterChange(value: string | undefined) {
    setFilter(value);
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 필터 탭 */}
      <div className="flex gap-1 rounded-lg bg-slate-800/50 p-1">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.label}
            type="button"
            onClick={() => handleFilterChange(tab.value)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              filter === tab.value
                ? "bg-amber-500 text-slate-950"
                : "text-slate-400 hover:bg-slate-700 hover:text-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 테이블 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : !data?.data.length ? (
        <EmptyState
          icon={<ArrowUpDown className="h-10 w-10" />}
          title="거래 내역이 없습니다"
          description="코인 거래가 발생하면 여기에 표시됩니다."
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full">
              <thead className="bg-slate-800/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                    날짜
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                    타입
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-400">
                    변동
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-400">
                    잔액
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((tx) => (
                  <TransactionRow key={tx.id} tx={tx} />
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-center">
            <Pagination
              currentPage={page}
              totalPages={Math.ceil(data.total / 20)}
              onPageChange={setPage}
            />
          </div>
        </>
      )}
    </div>
  );
}
