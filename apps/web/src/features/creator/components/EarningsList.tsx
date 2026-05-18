import { useState } from 'react';

import {
  Badge,
  EmptyState,
  LoadingState,
  Pagination,
  Table,
  type TableColumn,
} from '@/shared/components/ui';
import { useEarnings } from '../api';
import { CREATOR_PAGE_SIZE } from '../constants';

export function EarningsList() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useEarnings(page);

  if (isLoading) {
    return <LoadingState label="수익 내역을 불러오는 중" className="py-20" />;
  }

  if (isError) {
    return (
      <div className="py-12 text-center text-[var(--mmp-color-steel)]">
        수익 내역을 불러오지 못했습니다.
      </div>
    );
  }

  if (!data || data.data.length === 0) {
    return <EmptyState title="수익 내역이 없습니다" />;
  }

  const totalPages = Math.ceil(data.total / CREATOR_PAGE_SIZE);
  const columns: TableColumn<(typeof data.data)[number]>[] = [
    {
      id: 'date',
      header: '날짜',
      render: (earning) => new Date(earning.created_at).toLocaleDateString('ko-KR'),
    },
    {
      id: 'theme',
      header: '테마명',
      render: (earning) => (
        <span className="font-medium text-[var(--mmp-color-ink)]">{earning.theme_title}</span>
      ),
    },
    {
      id: 'total',
      header: '총 코인',
      align: 'right',
      render: (earning) => earning.total_coins.toLocaleString('ko-KR'),
    },
    {
      id: 'creator',
      header: '제작자 몫 (70%)',
      align: 'right',
      render: (earning) => (
        <span className="font-medium text-[var(--mmp-color-primary)]">
          {earning.creator_share_coins.toLocaleString('ko-KR')}
        </span>
      ),
    },
    {
      id: 'platform',
      header: '플랫폼 (30%)',
      align: 'right',
      render: (earning) => earning.platform_share_coins.toLocaleString('ko-KR'),
    },
    {
      id: 'status',
      header: '정산 상태',
      align: 'right',
      render: (earning) => (
        <Badge variant={earning.settled ? 'success' : 'warning'}>
          {earning.settled ? '정산됨' : '미정산'}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Table
        columns={columns}
        data={data.data}
        getRowKey={(earning) => earning.id}
        emptyTitle="수익 내역이 없습니다"
      />

      <div className="flex justify-center">
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      </div>
    </div>
  );
}
