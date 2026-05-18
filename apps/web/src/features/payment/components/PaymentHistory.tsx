import { useState } from 'react';
import { Receipt } from 'lucide-react';
import {
  Badge,
  Pagination,
  EmptyState,
  LoadingState,
  Table,
  type TableColumn,
} from '@/shared/components/ui';
import { usePaymentHistory } from '@/features/payment/api';
import type { PaymentResponse } from '@/features/payment/api';
import { PAYMENT_STATUS_LABEL } from '@/features/payment/constants';
import type { PaymentStatus } from '@/features/payment/constants';
import { formatDate } from '@/shared/utils/format';

// ---------------------------------------------------------------------------
// 결제 내역
// ---------------------------------------------------------------------------

const STATUS_VARIANT: Record<PaymentStatus, 'success' | 'warning' | 'danger' | 'default' | 'info'> =
  {
    CONFIRMED: 'success',
    PENDING: 'warning',
    FAILED: 'danger',
    REFUNDED: 'info',
    CANCELLED: 'default',
  };

export function PaymentHistory() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = usePaymentHistory(page);

  if (isLoading) {
    return <LoadingState label="결제 내역을 불러오는 중" className="py-20" />;
  }

  if (!data?.data?.length) {
    return (
      <EmptyState
        icon={<Receipt className="h-10 w-10" />}
        title="결제 내역이 없습니다"
        description="코인을 충전하면 여기에 내역이 표시됩니다."
      />
    );
  }

  const totalPages = Math.ceil(data.total / 20);
  const columns: TableColumn<PaymentResponse>[] = [
    { id: 'date', header: '날짜', render: (payment) => formatDate(payment.created_at) },
    {
      id: 'amount',
      header: '금액',
      render: (payment) => (
        <span className="font-medium text-[var(--mmp-color-ink)]">
          {payment.amount_krw.toLocaleString('ko-KR')}원
        </span>
      ),
    },
    {
      id: 'status',
      header: '상태',
      render: (payment) => (
        <Badge variant={STATUS_VARIANT[payment.status as PaymentStatus]}>
          {PAYMENT_STATUS_LABEL[payment.status as PaymentStatus]}
        </Badge>
      ),
    },
    {
      id: 'coins',
      header: '코인',
      align: 'right',
      render: (payment) => (
        <span className="font-medium text-[var(--mmp-color-primary)]">
          +{(payment.base_coins + payment.bonus_coins).toLocaleString('ko-KR')}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Table
        columns={columns}
        data={data.data}
        getRowKey={(payment) => payment.id}
        emptyTitle="결제 내역이 없습니다"
      />

      <div className="flex justify-center">
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      </div>
    </div>
  );
}
