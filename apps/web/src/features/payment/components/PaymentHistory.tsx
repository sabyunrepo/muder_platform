import { useState } from "react";
import { Receipt } from "lucide-react";
import {
  Badge,
  Pagination,
  Spinner,
  EmptyState,
} from "@/shared/components/ui";
import { usePaymentHistory } from "@/features/payment/api";
import type { PaymentResponse } from "@/features/payment/api";
import { PAYMENT_STATUS_LABEL } from "@/features/payment/constants";
import type { PaymentStatus } from "@/features/payment/constants";
import { formatDate } from "@/shared/utils/format";

// ---------------------------------------------------------------------------
// 결제 내역
// ---------------------------------------------------------------------------

const STATUS_VARIANT: Record<
  PaymentStatus,
  "success" | "warning" | "danger" | "default" | "info"
> = {
  CONFIRMED: "success",
  PENDING: "warning",
  FAILED: "danger",
  REFUNDED: "info",
  CANCELLED: "default",
};

function PaymentRow({ payment }: { payment: PaymentResponse }) {
  const totalCoins = payment.base_coins + payment.bonus_coins;

  return (
    <tr className="border-b border-slate-800 last:border-b-0">
      <td className="px-4 py-3 text-sm text-slate-300">
        {formatDate(payment.created_at)}
      </td>
      <td className="px-4 py-3 text-sm text-slate-100">
        {payment.amount_krw.toLocaleString("ko-KR")}원
      </td>
      <td className="px-4 py-3">
        <Badge variant={STATUS_VARIANT[payment.status as PaymentStatus]}>
          {PAYMENT_STATUS_LABEL[payment.status as PaymentStatus]}
        </Badge>
      </td>
      <td className="px-4 py-3 text-right text-sm font-medium text-amber-400">
        +{totalCoins.toLocaleString("ko-KR")}
      </td>
    </tr>
  );
}

export function PaymentHistory() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = usePaymentHistory(page);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!data?.data.length) {
    return (
      <EmptyState
        icon={<Receipt className="h-10 w-10" />}
        title="결제 내역이 없습니다"
        description="코인을 충전하면 여기에 내역이 표시됩니다."
      />
    );
  }

  const totalPages = Math.ceil(data.total / 20);

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full">
          <thead className="bg-slate-800/50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                날짜
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                금액
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                상태
              </th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-400">
                코인
              </th>
            </tr>
          </thead>
          <tbody>
            {data.data.map((payment) => (
              <PaymentRow key={payment.id} payment={payment} />
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
