import { useState } from 'react';

import {
  Badge,
  EmptyState,
  LoadingState,
  Pagination,
  Table,
  type TableColumn,
} from '@/shared/components/ui';
import type { Settlement } from '../api';
import { useSettlements } from '../api';
import { CREATOR_PAGE_SIZE, SETTLEMENT_STATUS_LABEL, type SettlementStatus } from '../constants';
import { formatKRW } from '@/shared/utils/format';

const STATUS_VARIANT: Record<SettlementStatus, 'warning' | 'info' | 'success' | 'danger'> = {
  CALCULATED: 'warning',
  APPROVED: 'info',
  PAID_OUT: 'success',
  CANCELLED: 'danger',
};

function formatPeriod(start: string, end: string): string {
  const s = new Date(start).toLocaleDateString('ko-KR');
  const e = new Date(end).toLocaleDateString('ko-KR');
  return `${s} ~ ${e}`;
}

function StatusBadge({ status }: { status: Settlement['status'] }) {
  return <Badge variant={STATUS_VARIANT[status]}>{SETTLEMENT_STATUS_LABEL[status]}</Badge>;
}

export function SettlementList() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useSettlements(page);

  if (isLoading) {
    return <LoadingState label="정산 내역을 불러오는 중" className="py-20" />;
  }

  if (isError) {
    return (
      <div className="py-12 text-center text-[var(--mmp-color-steel)]">
        정산 내역을 불러오지 못했습니다.
      </div>
    );
  }

  if (!data || data.data.length === 0) {
    return <EmptyState title="정산 내역이 없습니다" />;
  }

  const totalPages = Math.ceil(data.total / CREATOR_PAGE_SIZE);
  const columns: TableColumn<Settlement>[] = [
    {
      id: 'period',
      header: '기간',
      render: (settlement) => formatPeriod(settlement.period_start, settlement.period_end),
    },
    {
      id: 'coins',
      header: '총 코인',
      align: 'right',
      render: (settlement) => settlement.total_coins.toLocaleString('ko-KR'),
    },
    {
      id: 'total',
      header: '총 금액',
      align: 'right',
      render: (settlement) => formatKRW(settlement.total_krw),
    },
    {
      id: 'tax',
      header: '세금',
      align: 'right',
      render: (settlement) => formatKRW(settlement.tax_amount),
    },
    {
      id: 'net',
      header: '실지급액',
      align: 'right',
      render: (settlement) => (
        <span className="font-medium text-[var(--mmp-color-primary)]">
          {formatKRW(settlement.net_amount)}
        </span>
      ),
    },
    {
      id: 'status',
      header: '상태',
      align: 'right',
      render: (settlement) => <StatusBadge status={settlement.status} />,
    },
  ];

  return (
    <div className="space-y-6">
      <Table
        columns={columns}
        data={data.data}
        getRowKey={(settlement) => settlement.id}
        emptyTitle="정산 내역이 없습니다"
      />

      <div className="flex justify-center">
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      </div>
    </div>
  );
}
