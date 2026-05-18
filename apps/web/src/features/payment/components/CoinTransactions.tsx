import { useState } from 'react';
import { ArrowUpDown } from 'lucide-react';
import {
  Badge,
  Pagination,
  EmptyState,
  LoadingState,
  Table,
  type TableColumn,
} from '@/shared/components/ui';
import { useTransactions } from '@/features/coin/api';
import type { CoinTransaction } from '@/features/coin/api';
import { TRANSACTION_TYPE_LABEL } from '@/features/coin/constants';
import type { CoinTransactionType } from '@/features/coin/constants';
import { formatDateTime } from '@/shared/utils/format';

// ---------------------------------------------------------------------------
// 코인 이력 (타입별 필터 탭)
// ---------------------------------------------------------------------------

interface FilterTab {
  label: string;
  value: string | undefined;
}

const FILTER_TABS: FilterTab[] = [
  { label: '전체', value: undefined },
  { label: '충전', value: 'CHARGE' },
  { label: '구매', value: 'PURCHASE' },
  { label: '환불', value: 'REFUND' },
];

const TYPE_VARIANT: Record<
  CoinTransactionType,
  'success' | 'warning' | 'danger' | 'default' | 'info'
> = {
  CHARGE: 'success',
  PURCHASE: 'warning',
  REFUND: 'info',
  ADMIN_GRANT: 'success',
  ADMIN_REVOKE: 'danger',
};

export function CoinTransactions() {
  const [filter, setFilter] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);
  const { data, isLoading } = useTransactions(filter, page);

  function handleFilterChange(value: string | undefined) {
    setFilter(value);
    setPage(1);
  }
  const columns: TableColumn<CoinTransaction>[] = [
    { id: 'date', header: '날짜', render: (tx) => formatDateTime(tx.created_at) },
    {
      id: 'type',
      header: '타입',
      render: (tx) => (
        <Badge variant={TYPE_VARIANT[tx.type]} size="sm">
          {TRANSACTION_TYPE_LABEL[tx.type]}
        </Badge>
      ),
    },
    {
      id: 'amount',
      header: '변동',
      align: 'right',
      render: (tx) => {
        const amount = tx.base_amount + tx.bonus_amount;
        const isPositive = amount >= 0;
        return (
          <span
            className={`font-medium ${
              isPositive ? 'text-[var(--mmp-color-success)]' : 'text-[var(--mmp-color-error)]'
            }`}
          >
            {isPositive ? '+' : ''}
            {amount.toLocaleString('ko-KR')}
          </span>
        );
      },
    },
    {
      id: 'balance',
      header: '잔액',
      align: 'right',
      render: (tx) => (tx.balance_after_base + tx.balance_after_bonus).toLocaleString('ko-KR'),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* 필터 탭 */}
      <div className="flex gap-1 rounded-lg bg-[var(--mmp-color-surface-soft)] p-1">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.label}
            type="button"
            onClick={() => handleFilterChange(tab.value)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              filter === tab.value
                ? 'bg-[var(--mmp-color-primary)] text-white'
                : 'text-[var(--mmp-color-steel)] hover:bg-[var(--mmp-color-surface)] hover:text-[var(--mmp-color-ink)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 테이블 */}
      {isLoading ? (
        <LoadingState label="거래 내역을 불러오는 중" className="py-20" />
      ) : !data?.data?.length ? (
        <EmptyState
          icon={<ArrowUpDown className="h-10 w-10" />}
          title="거래 내역이 없습니다"
          description="코인 거래가 발생하면 여기에 표시됩니다."
        />
      ) : (
        <>
          <Table
            columns={columns}
            data={data.data}
            getRowKey={(tx) => tx.id}
            emptyTitle="거래 내역이 없습니다"
          />

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
